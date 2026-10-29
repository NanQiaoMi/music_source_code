/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Song } from "@/types/song";
import { SongResult } from "@/types/aiAgent";
import { firstUsable, takeWithin } from "@/lib/resolve/urlRace";
import { TtlLruCache, type TtlLruCacheStats } from "@/lib/cache/TtlLruCache";
import { isAbortError } from "@/lib/playback/requestCoordinator";
import { fetchJson } from "@/services/http/client";
import {
  resolverRegistry,
  type ResolverPluginContext,
  type ResolverPluginMetrics,
} from "@/services/resolver/plugin";
import { platformPlugins } from "@/services/resolver/platforms";
import type { ResolvedAudioSource, SongMetadataQuery } from "@/services/resolver/types";

import { getPlatformCookie, getSourceConfigSnapshot } from "@/store/actions/sourceActions";
import {
  handlePlatformSessionExpired,
  isPlatformLoggedIn,
  PlatformType,
} from "@/store/userAccountStore";
import { LXRunner } from "@/lib/sources/lxRunner";

// 公开类型已迁到 services/resolver/types.ts（插件与门面共用）。re-export 保持既有
// import 路径与类型身份不变（S7-1b 的「公开 API 0 变化」）。
export type { ResolvedAudioSource, SongMetadataQuery } from "@/services/resolver/types";

// 平台插件注册：注册顺序即平台竞速顺序（netease -> qq -> kugou -> kuwo -> qishui）。
for (const plugin of platformPlugins) {
  resolverRegistry.register(plugin);
}

function getPlatformHeaders(platform: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  const cookie = getPlatformCookie(platform);
  const headers: Record<string, string> = {};
  if (cookie) {
    if (platform === "netease" || platform === "wy") headers["x-netease-cookie"] = cookie;
    else if (platform === "qq" || platform === "tx") headers["x-qq-cookie"] = cookie;
    else if (platform === "kugou" || platform === "kg") headers["x-kugou-cookie"] = cookie;
    else if (platform === "kuwo" || platform === "kw") headers["x-kuwo-cookie"] = cookie;
    else if (platform === "qishui") headers["x-qishui-cookie"] = cookie;
  }
  return headers;
}

function handle401Response(platform: string, status: number) {
  if (status === 401 && typeof window !== "undefined") {
    const p = (
      platform === "wy"
        ? "netease"
        : platform === "tx"
          ? "qq"
          : platform === "kg"
            ? "kugou"
            : platform === "kw"
              ? "kuwo"
              : platform
    ) as PlatformType;
    handlePlatformSessionExpired(p);
  }
}

export interface SegmentedSearchResults {
  netease: Song[];
  qq: Song[];
  kugou: Song[];
  kuwo: Song[];
  qishui: Song[];
  local: Song[];
  lx_custom: Song[];
  all: Song[];
}

export const HOT_SEARCH_TAGS = [
  "周杰伦",
  "晴天",
  "告白气球",
  "稻香",
  "林俊杰",
  "七里香",
  "陈奕迅",
  "起风了",
  "花海",
  "反方向的钟",
];

function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[([{（【][^)\]})】]*?[)\]})】]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

const NOISE_KEYWORDS = [
  "伴奏",
  "instrumental",
  "inst",
  "片段",
  "dj",
  "慢摇",
  "串烧",
  "电音版",
  "变调",
  "变速",
  "加速",
  "减速",
  "铃声",
  "remix",
  "cover",
  "翻唱",
  "八音盒",
  "纯音乐",
  "试听",
  "重低音",
  "高燃",
  "bounce",
  "phonk",
  "网友改编",
  "小提琴",
  "钢琴版",
  "萨克斯",
  "古筝",
  "吉他版",
  "气氛版",
  "氛围版",
  "搞笑版",
];

function isNoiseCandidate(candidateTitle: string, targetTitle: string): boolean {
  const cLower = (candidateTitle || "").toLowerCase();
  const tLower = (targetTitle || "").toLowerCase();

  for (const kw of NOISE_KEYWORDS) {
    if (cLower.includes(kw) && !tLower.includes(kw)) {
      return true;
    }
  }
  return false;
}

function calculateMatchScore(
  targetTitle: string,
  targetArtist: string,
  candidateTitle: string,
  candidateArtist: string
): number {
  if (isNoiseCandidate(candidateTitle, targetTitle)) {
    return -100;
  }

  const normTargetTitle = normalizeString(targetTitle);
  const normCandTitle = normalizeString(candidateTitle);
  const normTargetArtist = normalizeString(targetArtist);
  const normCandArtist = normalizeString(candidateArtist);

  if (!normTargetTitle || !normCandTitle) return 0;

  // 杜绝拼接串烧
  if (
    !targetTitle.includes("+") &&
    !targetTitle.includes("＋") &&
    (candidateTitle.includes("+") || candidateTitle.includes("＋"))
  ) {
    return -100;
  }

  // 杜绝超长标题拼接
  if (normCandTitle.length > normTargetTitle.length * 2.2 && normTargetTitle.length <= 6) {
    return -50;
  }

  let score = 0;

  // 1. 歌名匹配
  if (normTargetTitle === normCandTitle) {
    score += 80;
  } else if (
    normCandTitle.startsWith(normTargetTitle) ||
    normTargetTitle.startsWith(normCandTitle)
  ) {
    score += 45;
  } else if (normCandTitle.includes(normTargetTitle) || normTargetTitle.includes(normCandTitle)) {
    score += 25;
  } else {
    return 0; // 歌名不匹配，直接淘汰
  }

  // 2. 歌手匹配
  if (normTargetArtist) {
    if (normTargetArtist === normCandArtist) {
      score += 50;
    } else if (
      normCandArtist.includes(normTargetArtist) ||
      normTargetArtist.includes(normCandArtist)
    ) {
      score += 35;
    } else if (normCandTitle.includes(normTargetArtist)) {
      score += 30; // 标题内嵌歌手名
    } else if (
      (normTargetArtist.includes("beyond") &&
        (normCandArtist.includes("黄家驹") || normCandTitle.includes("黄家驹"))) ||
      (normTargetArtist.includes("黄家驹") &&
        (normCandArtist.includes("beyond") || normCandTitle.includes("beyond")))
    ) {
      score += 40; // 乐队主唱关联匹配
    } else if (normTargetArtist === "未知歌手" || normCandArtist === "未知歌手") {
      score += 10;
    } else {
      return 0; // 歌手不匹配，直接淘汰
    }
  } else {
    score += 20;
  }

  if (!candidateTitle.includes("(") && !candidateTitle.includes("（")) {
    score += 15;
  }

  return score;
}

function getApiBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3025";
}

/**
 * 优先分支（洛雪 / 登录平台 VIP）的总预算，同时也是洛雪串行脚本循环的预算。
 * 超过后转去接受次级分支（平台竞速 / 兜底）—— 它们从 t=0 就已并发在跑，
 * 所以"转过去"通常只是读一个已经就绪的结果，不额外增加耗时。
 * 洛雪必须串行（沙箱写 globalThis.lx，并发会互相覆盖），不封顶的话
 * N 个脚本 × 单次 8s 超时 = 起播前几十秒空窗。
 */
const PREFERRED_BUDGET_MS = 2000;

export interface ResolvePlayableOptions {
  bypassCache?: boolean;
  signal?: AbortSignal;
}

export class MultiSourceResolver {
  private static instance: MultiSourceResolver;

  public static getInstance(): MultiSourceResolver {
    if (!MultiSourceResolver.instance) {
      MultiSourceResolver.instance = new MultiSourceResolver();
    }
    return MultiSourceResolver.instance;
  }

  private static resolvedUrlCache = new TtlLruCache<string, ResolvedAudioSource>({
    maxEntries: 300,
    maxAgeMs: 30 * 60_000, // 30 分钟
  });

  public static clearCache() {
    this.resolvedUrlCache.clear();
    this.searchCache.clear();
  }

  /** 只读缓存指标（容量 + 命中率），供调试与长会话采样使用。 */
  public static getResolvedUrlCacheStats(): TtlLruCacheStats & { size: number } {
    return { ...this.resolvedUrlCache.stats(), size: this.resolvedUrlCache.size() };
  }

  public static invalidateSong(query: SongMetadataQuery): void {
    const key =
      `${query.source || ""}-${query.id || ""}-${query.title || ""}-${query.artist || ""}`.toLowerCase();
    this.resolvedUrlCache.delete(key);
  }

  public invalidateSong(query: SongMetadataQuery): void {
    MultiSourceResolver.invalidateSong(query);
  }

  private async validateStream(url: string): Promise<boolean> {
    if (!url || !url.startsWith("http")) return false;
    return true;
  }

  /**
   * 聚合解析核心入口：严格鉴权门禁 + 极速并发竞速 + LRU 高速缓存 (毫秒级响应)
   */
  public async resolvePlayableAudio(
    query: SongMetadataQuery,
    bypassCacheOrOptions: boolean | ResolvePlayableOptions = false
  ): Promise<ResolvedAudioSource | null> {
    // 兼容旧调用：第二个参数曾是 boolean；新调用可传 { bypassCache, signal }。
    const options: ResolvePlayableOptions =
      typeof bypassCacheOrOptions === "boolean"
        ? { bypassCache: bypassCacheOrOptions }
        : bypassCacheOrOptions;
    const bypassCache = options.bypassCache ?? false;
    const signal = options.signal;

    if (signal?.aborted) return null;
    if (!query.title && !query.id) return null;

    // 本地母带源由播放器本地解码，不走网络解析
    if (query.source === "local") return null;

    const cacheKey =
      `${query.source || ""}-${query.id || ""}-${query.title || ""}-${query.artist || ""}`.toLowerCase();
    if (!bypassCache) {
      const cached = MultiSourceResolver.resolvedUrlCache.get(cacheKey);
      if (cached?.url) return cached;
    } else {
      MultiSourceResolver.resolvedUrlCache.delete(cacheKey);
    }

    const base = getApiBase();
    const src = (query.source || "").toLowerCase();
    const explicitLx = src === "lx_custom" || src === "lx";

    // 解析模式必须在**发起分支之前**读取：lx_only 下不允许碰平台竞速与兜底
    const resolutionMode =
      typeof window !== "undefined" ? getSourceConfigSnapshot().resolutionMode : "hybrid_racing";

    // ---- 以下分支全部在 t=0 同时发起，只是**按优先级依次接受** ----
    // 旧实现是严格串行 await：洛雪（每脚本 8s 超时）→ 平台竞速 race 落空后还要
    // allSettled 等最慢的 → 兜底 /api/song/url 才开始，累计最坏十几秒。
    // 并发启动后总耗时接近 max 而非 sum，而接受顺序保持与旧实现一致。
    const lxPromise = this.resolveLxScript(query);
    const vipPromise =
      query.source && isPlatformLoggedIn(src)
        ? this.resolveSinglePlatform(src, query, signal)
        : null;
    const platformPromise =
      resolutionMode === "lx_only" ? null : this.resolvePlatformRace(query, signal);
    const fallbackPromise =
      resolutionMode === "lx_only" || !(query.title || query.id)
        ? null
        : this.resolveSongUrlFallback(query, base, signal);

    const remember = (result: ResolvedAudioSource): ResolvedAudioSource => {
      // 已被新的播放请求取代：结果仍然返回给调用方（由它自行丢弃），但绝不污染缓存
      if (signal?.aborted) return result;
      MultiSourceResolver.resolvedUrlCache.set(cacheKey, result);
      return result;
    };

    // 优先级与旧实现一致：显式洛雪源 > 登录平台 VIP 通道 > 洛雪。
    // 每一级都有截止时间，否则一条迟迟无果的高优先级分支会挡住已经就绪的后继分支。
    const preferred: (Promise<ResolvedAudioSource | null> | null)[] = explicitLx
      ? [lxPromise, vipPromise]
      : [vipPromise, lxPromise];

    const deadline = Date.now() + PREFERRED_BUDGET_MS;
    for (const branch of preferred) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const hit = await takeWithin(branch, remaining);
      if (signal?.aborted) return null;
      if (hit?.url) return remember(hit);
    }

    // 次级分支：平台竞速取首个可用者（不再等最慢的那个），兜底从 t=0 就已在跑
    const secondary = await firstUsable([platformPromise, fallbackPromise]);
    if (signal?.aborted) return null;
    if (secondary?.url) return remember(secondary);

    return null;
  }

  /**
   * 平台插件的依赖注入：store 读取、401 处理、匹配打分都在门面这一侧收敛，
   * 插件本身不直连 store（services 层可单测、不触发 zustand 初始化）。
   */
  private createPluginContext(signal?: AbortSignal): ResolverPluginContext {
    return {
      signal,
      apiBase: getApiBase(),
      isLoggedIn: (platform) => isPlatformLoggedIn(platform),
      headers: (platform) => getPlatformHeaders(platform),
      onUnauthorized: (platform) => handle401Response(platform, 401),
      score: calculateMatchScore,
    };
  }

  /** 已登录对应平台的单源专属解析（VIP Cookie 专属高清通道）。 */
  private resolveSinglePlatform(
    src: string,
    query: SongMetadataQuery,
    signal?: AbortSignal
  ): Promise<ResolvedAudioSource | null> {
    // 别名（wy/tx/kg/kw）由注册表归一；未知来源返回 null，与旧 if 链落空一致。
    return resolverRegistry.resolve(
      src,
      { query, id: query.id || "", source: src },
      this.createPluginContext(signal)
    );
  }

  /**
   * 所有已登录平台并发竞速，取**第一个可用**结果。
   * 旧实现是 Promise.race 落空后补 Promise.allSettled —— 等于把耗时重新
   * 拉平到最慢的那个平台（搜索+取链两跳可达 7s），竞速形同虚设。
   */
  private resolvePlatformRace(
    query: SongMetadataQuery,
    signal?: AbortSignal
  ): Promise<ResolvedAudioSource | null> | null {
    const ctx = this.createPluginContext(signal);
    const tasks = resolverRegistry
      .list()
      .filter((plugin) => isPlatformLoggedIn(plugin.id))
      .map((plugin) => resolverRegistry.resolve(plugin.id, { query, id: query.id || "" }, ctx));
    if (tasks.length === 0) return null;
    return firstUsable(tasks);
  }

  /** 服务端高可用直链管道 /api/song/url。永不 reject。 */
  private async resolveSongUrlFallback(
    query: SongMetadataQuery,
    base: string,
    signal?: AbortSignal
  ): Promise<ResolvedAudioSource | null> {
    try {
      const params = new URLSearchParams();
      if (query.id) params.set("id", String(query.id));
      if (query.title) params.set("title", query.title);
      if (query.artist) params.set("artist", query.artist);
      if (query.source) params.set("source", query.source);

      const res = await fetchJson<any>(`${base}/api/song/url?${params.toString()}`, {
        // 父 signal（换歌/新播放请求）与 4s 超时任一触发即中断（http client 内部组合），
        // 同时接入按 host 的熔断与指标；旧请求不再占带宽。
        timeoutMs: 4000,
        signal,
        headers: query.source ? getPlatformHeaders(query.source) : {},
      });
      if (signal?.aborted) return null;
      if (!res.ok || !res.data) return null;

      const data = res.data;
      if (data?.url && typeof data.url === "string" && data.url.startsWith("http")) {
        return {
          url: data.url,
          source: data.source || "kuwo",
          quality: data.level || "lossless",
          format: data.url.includes(".flac") ? "flac" : "mp3",
          bitrate: data.br || 320000,
          isTrial: false,
          name: `${query.title || "未知曲目"} (高可用母带流)`,
        };
      }
      return null;
    } catch (err) {
      // abort 是预期路径，不打 warn
      if (isAbortError(err)) return null;
      console.warn("[MultiSourceResolver] Fallback /api/song/url resolution error:", err);
      return null;
    }
  }

  /**
   * 洛雪扩展脚本音源解析
   */
  public async resolveLxScript(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    try {
      const lxScripts = typeof window !== "undefined" ? getSourceConfigSnapshot().lxScripts : [];
      const enabledScripts = lxScripts.filter((s) => s.enabled);
      if (enabledScripts.length === 0) return null;

      const platformToLX: Record<string, string> = {
        kuwo: "kw",
        kw: "kw",
        kugou: "kg",
        kg: "kg",
        qq: "tx",
        tx: "tx",
        netease: "wy",
        wy: "wy",
      };
      const targetPlatform = platformToLX[query.source || ""] || "wy";

      const songObj: Song = {
        id: query.id || "",
        title: query.title,
        artist: query.artist || "",
        album: query.album || "",
        duration: query.duration || 240,
        cover: "/default-cover.svg",
        source: targetPlatform as any,
        audioUrl: "",
        format: "mp3",
      };

      // 沙箱写 globalThis.lx，脚本之间**必须串行**，否则会互相覆盖运行环境。
      // 串行 + 每次请求 8s 超时意味着 N 个脚本最坏 N×8s，这里用总预算封顶。
      const deadline = Date.now() + PREFERRED_BUDGET_MS;
      for (const script of enabledScripts) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          console.warn(
            `[MultiSourceResolver] LX script budget exhausted (${PREFERRED_BUDGET_MS}ms), ` +
              `${enabledScripts.length} enabled script(s) not tried`
          );
          break;
        }
        try {
          const lxUrlResult = await Promise.race([
            LXRunner.getMusicUrl(script, songObj, "320k"),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), remaining)),
          ]);
          if (
            lxUrlResult?.url &&
            lxUrlResult.url.startsWith("http") &&
            (await this.validateStream(lxUrlResult.url))
          ) {
            return {
              url: lxUrlResult.url,
              source: "lx_custom",
              quality: (lxUrlResult.quality as any) || "lossless",
              format: lxUrlResult.url.includes(".flac") ? "flac" : "mp3",
              bitrate: 320000,
              isTrial: false,
              name: `${query.title || "未知曲目"} (${script.name})`,
            };
          }
        } catch {
          // 单个脚本抛错继续试下一个（总预算见 deadline）
        }
      }
    } catch {
      // 洛雪链路整体失败时回落到平台竞速与兜底分支
    }
    return null;
  }

  /**
   * 酷我音乐音源解析 (严格鉴权通道)。实现见 resolver/platforms.ts 的 kuwoPlugin，
   * 这里保留同名公开方法是为了公开 API 不变（S7-1b）。
   */
  public resolveKuwo(
    query: SongMetadataQuery,
    signal?: AbortSignal
  ): Promise<ResolvedAudioSource | null> {
    return resolverRegistry.resolve(
      "kuwo",
      { query, id: query.id, source: "kuwo" },
      this.createPluginContext(signal)
    );
  }

  /**
   * 获取当前歌曲在已登录平台的可用音源版本候选列表 (供用户手动选择)
   */
  public async getAvailableSourceCandidates(
    query: SongMetadataQuery
  ): Promise<ResolvedAudioSource[]> {
    const ctx = this.createPluginContext();
    const promises = resolverRegistry
      .list()
      .filter((plugin) => isPlatformLoggedIn(plugin.id))
      .map((plugin) => resolverRegistry.resolve(plugin.id, { query, id: query.id || "" }, ctx));

    const results = await Promise.allSettled(promises);
    const candidates: ResolvedAudioSource[] = [];

    results.forEach((res) => {
      if (res.status === "fulfilled" && res.value && res.value.url) {
        candidates.push(res.value);
      }
    });

    if (candidates.length === 0) {
      candidates.push({
        url: "",
        source: "local",
        quality: "hires",
        format: "flac",
        bitrate: 2842000,
        isTrial: false,
        name: "本地母带直通源 (Local Master)",
      });
    }

    return candidates;
  }

  /**
   * 网易云原生音源嗅探与多级降级解析。实现见 resolver/platforms.ts 的 neteasePlugin。
   */
  public resolveNetease(
    songId: string,
    query?: SongMetadataQuery,
    signal?: AbortSignal
  ): Promise<ResolvedAudioSource | null> {
    return resolverRegistry.resolve(
      "netease",
      { query, id: songId, source: "netease" },
      this.createPluginContext(signal)
    );
  }

  /** QQ 音乐音源解析。实现见 resolver/platforms.ts 的 qqPlugin。 */
  public resolveQQMusic(
    query: SongMetadataQuery,
    signal?: AbortSignal
  ): Promise<ResolvedAudioSource | null> {
    return resolverRegistry.resolve(
      "qq",
      { query, id: query.id || "", source: "qq" },
      this.createPluginContext(signal)
    );
  }

  /** 酷狗音乐音源解析。实现见 resolver/platforms.ts 的 kugouPlugin。 */
  public resolveKugou(
    query: SongMetadataQuery,
    signal?: AbortSignal
  ): Promise<ResolvedAudioSource | null> {
    return resolverRegistry.resolve(
      "kugou",
      { query, id: query.id || "", source: "kugou" },
      this.createPluginContext(signal)
    );
  }

  /** 汽水音乐音源解析。实现见 resolver/platforms.ts 的 qishuiPlugin。 */
  public resolveQishui(
    query: SongMetadataQuery,
    signal?: AbortSignal
  ): Promise<ResolvedAudioSource | null> {
    return resolverRegistry.resolve(
      "qishui",
      { query, id: query.id || "", source: "qishui" },
      this.createPluginContext(signal)
    );
  }

  // 搜索缓存：20 分钟 TTL + 最多 100 条（原为无界 Map，长会话下随搜索词线性增长）。
  // 时钟写成闭包而非 Date.now 引用，测试可用 spy 推进过期而无需真实等待 20 分钟。
  private static searchCache = new TtlLruCache<string, SegmentedSearchResults>({
    maxEntries: 100,
    maxAgeMs: 20 * 60_000,
    now: () => Date.now(),
  });

  /** 只读搜索缓存指标（容量 + 命中率），供调试与 dev 探针聚合。 */
  public static getSearchCacheStats(): TtlLruCacheStats & { size: number } {
    return { ...this.searchCache.stats(), size: this.searchCache.size() };
  }

  /**
   * 全网分平台在线歌曲深度并发搜索 (仅向已登录平台与已启用洛雪脚本派发请求)
   */
  public async searchOnlineMusicSegmented(keywords: string): Promise<SegmentedSearchResults> {
    if (!keywords || !keywords.trim()) {
      return {
        netease: [],
        qq: [],
        kugou: [],
        kuwo: [],
        qishui: [],
        local: [],
        lx_custom: [],
        all: [],
      };
    }

    const trimmed = keywords.trim();
    const cacheKey = trimmed.toLowerCase();
    const cached = MultiSourceResolver.searchCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const kw = encodeURIComponent(trimmed);
    const sourceConfigs = typeof window !== "undefined" ? getSourceConfigSnapshot().sources : null;

    const endpoints: { key: string; url: string; headers: Record<string, string> }[] = [];
    if (isPlatformLoggedIn("netease") && sourceConfigs?.netease?.enabled !== false) {
      const base = sourceConfigs?.netease?.customApiBase || getApiBase();
      endpoints.push({
        key: "netease",
        url: `${base}/api/search?keywords=${kw}&limit=100`,
        headers: getPlatformHeaders("netease"),
      });
    }
    if (isPlatformLoggedIn("qq") && sourceConfigs?.qq?.enabled !== false) {
      const base = sourceConfigs?.qq?.customApiBase || getApiBase();
      endpoints.push({
        key: "qq",
        url: `${base}/api/qq/search?keywords=${kw}&limit=50`,
        headers: getPlatformHeaders("qq"),
      });
    }
    if (isPlatformLoggedIn("kugou") && sourceConfigs?.kugou?.enabled !== false) {
      const base = sourceConfigs?.kugou?.customApiBase || getApiBase();
      endpoints.push({
        key: "kugou",
        url: `${base}/api/kugou/search?keywords=${kw}&limit=100`,
        headers: getPlatformHeaders("kugou"),
      });
    }
    if (isPlatformLoggedIn("kuwo") && sourceConfigs?.kuwo?.enabled !== false) {
      const base = sourceConfigs?.kuwo?.customApiBase || getApiBase();
      endpoints.push({
        key: "kuwo",
        url: `${base}/api/kuwo/search?keywords=${kw}&limit=100`,
        headers: getPlatformHeaders("kuwo"),
      });
    }
    if (isPlatformLoggedIn("qishui") && sourceConfigs?.qishui?.enabled !== false) {
      const base = sourceConfigs?.qishui?.customApiBase || getApiBase();
      endpoints.push({
        key: "qishui",
        url: `${base}/api/qishui/search?keywords=${kw}&limit=60`,
        headers: getPlatformHeaders("qishui"),
      });
    }

    const results: SegmentedSearchResults = {
      netease: [],
      qq: [],
      kugou: [],
      kuwo: [],
      qishui: [],
      local: [],
      lx_custom: [],
      all: [],
    };

    let attemptedProviderCount = 0;
    let successfulProviderCount = 0;
    const fetchTasks = endpoints.map(async (ep) => {
      attemptedProviderCount += 1;
      try {
        const r = await fetchJson<any>(ep.url, { timeoutMs: 2800, headers: ep.headers });
        if (r.status === 401) {
          handle401Response(ep.key, 401);
          return { key: ep.key, songs: [] };
        }
        if (!r.ok) return { key: ep.key, songs: [] };
        const data = r.data;
        successfulProviderCount += 1;
        return { key: ep.key, songs: Array.isArray(data?.songs) ? data.songs : [] };
      } catch {
        return { key: ep.key, songs: [] };
      }
    });

    const sourceConfig = typeof window !== "undefined" ? getSourceConfigSnapshot() : null;
    const isLxEnabled = sourceConfig
      ? Boolean(
          sourceConfig.sources.lx_custom?.enabled && sourceConfig.lxScripts.some((s) => s.enabled)
        )
      : true;

    const lxTask = async () => {
      if (!isLxEnabled) return { key: "lx_custom", songs: [] };
      attemptedProviderCount += 1;
      try {
        const lxScripts = typeof window !== "undefined" ? getSourceConfigSnapshot().lxScripts : [];
        const activeScript = lxScripts.find((s) => s.enabled) || {
          id: "lx-default",
          name: "LX Default",
          author: "LX",
          version: "1.0",
          description: "",
          enabled: true,
          lastUpdated: Date.now(),
          supportedActions: ["search" as const],
        };
        const lxSongs = await LXRunner.search(activeScript, keywords.trim(), 1, 100);
        successfulProviderCount += 1;
        return { key: "lx_custom", songs: lxSongs };
      } catch {
        return { key: "lx_custom", songs: [] };
      }
    };

    const responses = await Promise.allSettled([...fetchTasks, lxTask()]);
    if (attemptedProviderCount > 0 && successfulProviderCount === 0) {
      throw new Error("All enabled music search providers failed");
    }

    const seen = new Set<string>();

    responses.forEach((res) => {
      if (res.status === "fulfilled" && res.value) {
        const { key, songs } = res.value;
        const normalized: Song[] = [];

        songs.forEach((s: any) => {
          const songId = String(s.id || s.songmid || s.hash || "");
          const songName = s.name || s.title || "";
          const artistName =
            s.artist ||
            (Array.isArray(s.artists) ? s.artists.map((a: any) => a.name).join("/") : "未知歌手");
          const uniqKey = `${songName}-${artistName}-${key}`.toLowerCase();

          if (songName) {
            const item: Song = {
              id: songId,
              title: songName,
              artist: artistName,
              album: s.album || s.albumName || "精选大碟",
              duration: s.duration
                ? Math.round(s.duration > 1000 ? s.duration / 1000 : s.duration)
                : 240,
              cover: s.cover || s.picUrl || s.albumPic || "/default-cover.svg",
              source: key as any,
              audioUrl: s.audioUrl || s.url || "",
              format: s.format || "mp3",
            };
            normalized.push(item);

            if (!seen.has(uniqKey)) {
              seen.add(uniqKey);
              results.all.push(item);
            }
          }
        });

        if (key === "netease") results.netease = normalized;
        else if (key === "qq") results.qq = normalized;
        else if (key === "kugou") results.kugou = normalized;
        else if (key === "kuwo") results.kuwo = normalized;
        else if (key === "qishui") results.qishui = normalized;
        else if (key === "lx_custom") results.lx_custom = normalized;
      }
    });

    // 空结果不缓存：保留旧行为，避免把一次失败搜索固化 20 分钟。
    if (results.all.length > 0) {
      MultiSourceResolver.searchCache.set(cacheKey, results);
    }

    return results;
  }

  /**
   * 自动全网嗅探获取高清专辑封面 (仅限已登录平台)
   */
  public async fetchOnlineCover(query: {
    id?: string;
    title: string;
    artist?: string;
    source?: string;
  }): Promise<string | null> {
    if (!query.title) return null;
    const kw = encodeURIComponent(`${query.title} ${query.artist || ""}`.trim());
    const base = getApiBase();

    // 优先 1: 网易云 CloudSearch 高清大图 (需登录)
    if (isPlatformLoggedIn("netease")) {
      try {
        const res = await fetchJson<any>(`${base}/api/search?keywords=${kw}&limit=3`, {
          timeoutMs: 3000,
          headers: getPlatformHeaders("netease"),
        });
        if (res.ok && res.data) {
          const data = res.data;
          const songs = data.songs || [];
          for (const s of songs) {
            if (s.cover && s.cover.startsWith("http") && !s.cover.includes("default-cover")) {
              return s.cover;
            }
          }
        }
      } catch {
        // 网易云封面取不到就换下一个平台
      }
    }

    // 优先 2: QQ 音乐 300x300 高清图 (需登录)
    if (isPlatformLoggedIn("qq")) {
      try {
        const res = await fetchJson<any>(`${base}/api/qq/search?keywords=${kw}&limit=3`, {
          timeoutMs: 3000,
          headers: getPlatformHeaders("qq"),
        });
        if (res.ok && res.data) {
          const data = res.data;
          const songs = data.songs || [];
          for (const s of songs) {
            if (s.cover && s.cover.startsWith("http") && !s.cover.includes("default-cover")) {
              return s.cover;
            }
          }
        }
      } catch {
        // QQ 封面取不到就换下一个平台
      }
    }

    // 优先 3: 酷狗 400x400 高清大图 (需登录)
    if (isPlatformLoggedIn("kugou")) {
      try {
        const res = await fetchJson<any>(`${base}/api/kugou/search?keywords=${kw}&limit=3`, {
          timeoutMs: 3000,
          headers: getPlatformHeaders("kugou"),
        });
        if (res.ok && res.data) {
          const data = res.data;
          const songs = data.songs || [];
          for (const s of songs) {
            if (s.cover && s.cover.startsWith("http") && !s.cover.includes("default-cover")) {
              return s.cover;
            }
          }
        }
      } catch {
        // 酷狗封面取不到就换下一个平台
      }
    }

    return null;
  }

  /**
   * 全网在线歌曲综合搜索
   */
  public async searchOnlineMusic(keywords: string, limit: number = 30): Promise<Song[]> {
    const segmented = await this.searchOnlineMusicSegmented(keywords);
    return segmented.all.slice(0, limit);
  }

  /**
   * 跨全渠道 5 维加权智能优选与聚合搜索 (为 AI 助手挑选最符合资源)
   */
  public async searchBestMatchingSongResults(
    keywords: string,
    limit: number = 8
  ): Promise<SongResult[]> {
    const segmented = await this.searchOnlineMusicSegmented(keywords);
    const allCandidates: Song[] = [];

    const channels: (keyof SegmentedSearchResults)[] = [
      "netease",
      "qq",
      "kuwo",
      "kugou",
      "lx_custom",
      "local",
      "qishui",
    ];
    channels.forEach((ch) => {
      if (Array.isArray(segmented[ch])) {
        allCandidates.push(...segmented[ch]);
      }
    });

    if (allCandidates.length === 0) {
      allCandidates.push(...segmented.all);
    }

    if (allCandidates.length === 0) {
      return [];
    }

    // 解析搜索意图中的关键词（歌手与歌名提炼）
    const parts = keywords.trim().split(/\s+/);
    let targetArtist = "";
    let targetTitle = keywords.trim();
    if (parts.length >= 2) {
      targetArtist = parts[0];
      targetTitle = parts.slice(1).join(" ");
    }

    interface ScoredSong {
      song: Song;
      score: number;
      qualityLabel: string;
    }

    const scoredList: ScoredSong[] = allCandidates.map((s) => {
      let score = calculateMatchScore(targetTitle, targetArtist, s.title, s.artist);
      const altScore = calculateMatchScore(keywords, "", s.title, s.artist);
      score = Math.max(score, altScore);

      // 音质加权
      let qualityLabel = "标准音质";
      const sAny = s as any;
      if (s.format === "flac" || sAny.quality === "lossless" || sAny.quality === "hires") {
        score += 20;
        qualityLabel = "无损 FLAC";
      } else if (
        sAny.quality === "high" ||
        (sAny.bitrate && sAny.bitrate >= 320000) ||
        (sAny.bitRate && sAny.bitRate >= 320000)
      ) {
        score += 15;
        qualityLabel = "超清 320K";
      } else {
        score += 5;
      }

      // 封面有效性加分
      if (s.cover && s.cover.startsWith("http") && !s.cover.includes("default-cover")) {
        score += 5;
      }

      // 时长合理性 (大于 90s 且小于 600s 为标准歌曲长度)
      if (s.duration >= 90 && s.duration <= 600) {
        score += 10;
      } else if (s.duration < 60) {
        score -= 30; // 纯片段或短视频铃声扣分
      }

      // 官方主流渠道加分
      if (s.source === "netease" || s.source === "qq" || s.source === "kuwo") {
        score += 8;
      }

      return {
        song: s,
        score,
        qualityLabel,
      };
    });

    // 跨平台聚合去重：按规范化 (title + artist) 归组，组内取最高分代表
    const groupMap = new Map<string, ScoredSong[]>();
    scoredList.forEach((item) => {
      const key = `${normalizeString(item.song.title)}__${normalizeString(item.song.artist)}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    });

    const aggregatedBest: ScoredSong[] = [];
    groupMap.forEach((items) => {
      items.sort((a, b) => b.score - a.score);
      aggregatedBest.push(items[0]);
    });

    // 全局按总分降序排列
    aggregatedBest.sort((a, b) => b.score - a.score);

    const topList = aggregatedBest.slice(0, limit);
    const maxScore = topList[0]?.score || 0;

    return topList.map((item, idx) => ({
      song: item.song,
      source: item.song.source || "netease",
      confidence: Math.max(0.5, Math.min(1.0, item.score / 150)),
      canPlay: true,
      canDownload: true,
      isBestMatch: idx === 0 && (maxScore >= 60 || topList.length === 1),
      matchScore: Math.round(item.score),
      qualityLabel: item.qualityLabel,
    }));
  }

  /**
   * 在线歌词抓取 (严格仅限已登录平台)
   */
  public async fetchOnlineLyrics(
    songId: string,
    source: string = "netease",
    query?: SongMetadataQuery
  ): Promise<{ lyrics?: string; translationLyrics?: string }> {
    if (!songId && !query?.title) return {};

    const effectiveSource = source || "netease";
    if (
      effectiveSource !== "local" &&
      effectiveSource !== "lx_custom" &&
      !isPlatformLoggedIn(effectiveSource)
    ) {
      return {};
    }

    const numericId = songId ? songId.replace(/^[a-zA-Z_-]+/, "") : "";
    const effectiveId = numericId || songId;

    try {
      let url = `${getApiBase()}/api/lyric?id=${encodeURIComponent(effectiveId)}`;
      if (query?.title) {
        url += `&title=${encodeURIComponent(query.title)}&artist=${encodeURIComponent(query.artist || "")}`;
      }
      if (effectiveSource === "qq")
        url = `${getApiBase()}/api/lyric?mid=${encodeURIComponent(effectiveId)}&title=${encodeURIComponent(query?.title || "")}&artist=${encodeURIComponent(query?.artist || "")}`;
      else if (effectiveSource === "kugou")
        url = `${getApiBase()}/api/lyric?hash=${encodeURIComponent(effectiveId)}&title=${encodeURIComponent(query?.title || "")}&artist=${encodeURIComponent(query?.artist || "")}`;
      else if (effectiveSource === "qishui")
        url = `${getApiBase()}/api/qishui/lyric?id=${encodeURIComponent(effectiveId)}`;

      const res = await fetchJson<any>(url, {
        timeoutMs: 3000,
        headers: getPlatformHeaders(effectiveSource),
      });
      if (res.ok && res.data) {
        const data = res.data;
        if (data.lrc?.lyric || data.lyric) {
          return {
            lyrics: data.lrc?.lyric || data.lyric || "",
            translationLyrics: data.tlyric?.lyric || data.tlyric || "",
          };
        }
      }
    } catch {
      // ignore
    }

    return {};
  }
}

export const multiSourceResolver = MultiSourceResolver.getInstance();

/**
 * Resolver 统一指标出口（S7-1）：缓存命中/容量 + 插件分派计数 + HTTP 计数 + 熔断主机快照。
 * 纯读取，不发网络请求；供 dev 探针与 S7-9 长会话采样使用。
 */
export function getResolverMetrics(): ResolverPluginMetrics & {
  cache: {
    resolvedUrl: TtlLruCacheStats & { size: number };
    search: TtlLruCacheStats & { size: number };
  };
} {
  return {
    cache: {
      resolvedUrl: MultiSourceResolver.getResolvedUrlCacheStats(),
      search: MultiSourceResolver.getSearchCacheStats(),
    },
    ...resolverRegistry.metrics(),
  };
}
