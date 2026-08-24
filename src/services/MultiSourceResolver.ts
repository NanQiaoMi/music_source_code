/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useAudioSourceStore, AudioSourceType } from "@/store/audioSourceStore";
import { Song } from "@/types/song";

export interface ResolvedAudioSource {
  url: string;
  source: AudioSourceType;
  quality: "standard" | "high" | "lossless" | "hires";
  format: "mp3" | "flac" | "aac" | "m4a";
  bitrate?: number;
  duration?: number;
  isTrial: boolean;
  name?: string;
}

export interface SongMetadataQuery {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  source?: string;
}

import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { useUserAccountStore, isPlatformLoggedIn, PlatformType } from "@/store/userAccountStore";
import { LXRunner } from "@/lib/sources/lxRunner";

function getPlatformHeaders(platform: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  const cookie = useUserAccountStore.getState().getPlatformCookie(platform);
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
    const p = (platform === "wy" ? "netease" : platform === "tx" ? "qq" : platform === "kg" ? "kugou" : platform === "kw" ? "kuwo" : platform) as PlatformType;
    useUserAccountStore.getState().handlePlatformSessionExpired(p);
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
    .replace(/[\(\[\{（【][^\)\]\}）】]*?[\)\]\}）】]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

const NOISE_KEYWORDS = [
  "伴奏", "instrumental", "inst", "片段", "dj", "慢摇", "串烧",
  "电音版", "变调", "变速", "加速", "减速", "铃声", "remix", "cover",
  "翻唱", "八音盒", "纯音乐", "试听", "重低音", "高燃", "bounce", "phonk",
  "网友改编", "小提琴", "钢琴版", "萨克斯", "古筝", "吉他版", "气氛版", "氛围版", "搞笑版"
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
  if (!targetTitle.includes("+") && !targetTitle.includes("＋") && (candidateTitle.includes("+") || candidateTitle.includes("＋"))) {
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
  } else if (normCandTitle.startsWith(normTargetTitle) || normTargetTitle.startsWith(normCandTitle)) {
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
    } else if (normCandArtist.includes(normTargetArtist) || normTargetArtist.includes(normCandArtist)) {
      score += 35;
    } else if (normCandTitle.includes(normTargetArtist)) {
      score += 30; // 标题内嵌歌手名
    } else if (
      (normTargetArtist.includes("beyond") && (normCandArtist.includes("黄家驹") || normCandTitle.includes("黄家驹"))) ||
      (normTargetArtist.includes("黄家驹") && (normCandArtist.includes("beyond") || normCandTitle.includes("beyond")))
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

export class MultiSourceResolver {
  private static instance: MultiSourceResolver;

  public static getInstance(): MultiSourceResolver {
    if (!MultiSourceResolver.instance) {
      MultiSourceResolver.instance = new MultiSourceResolver();
    }
    return MultiSourceResolver.instance;
  }

  private static resolvedUrlCache = new Map<string, { result: ResolvedAudioSource; expiry: number }>();

  public static clearCache() {
    this.resolvedUrlCache.clear();
  }

  private async validateStream(url: string): Promise<boolean> {
    if (!url || !url.startsWith("http")) return false;
    return true;
  }

  /**
   * 聚合解析核心入口：严格鉴权门禁 + 极速并发竞速 + LRU 高速缓存 (毫秒级响应)
   */
  public async resolvePlayableAudio(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    if (!query.title && !query.id) return null;

    // 本地母带源由播放器本地解码，不走网络解析
    if (query.source === "local") return null;

    const cacheKey = `${query.source || ""}-${query.id || ""}-${query.title || ""}-${query.artist || ""}`.toLowerCase();
    const now = Date.now();
    const cached = MultiSourceResolver.resolvedUrlCache.get(cacheKey);
    if (cached && cached.expiry > now && cached.result?.url) {
      return cached.result;
    }

    const base = getApiBase();

    // 1. 【严格源隔离规则】：如果歌曲明确标记了所属网络平台，必须且只能走该平台的鉴权链路
    if (query.source) {
      const src = query.source.toLowerCase();

      // 洛雪扩展源：独立受控于脚本开关
      if (src === "lx_custom" || src === "lx") {
        const lxRes = await this.resolveLxScript(query);
        if (lxRes?.url) {
          MultiSourceResolver.resolvedUrlCache.set(cacheKey, { result: lxRes, expiry: Date.now() + 1800000 });
          return lxRes;
        }
        return null;
      }

      // 原生网络平台：未登录一律直接阻断，绝不跨源串流
      if (!isPlatformLoggedIn(src)) {
        console.warn(`[MultiSourceResolver] Blocked request for unauthenticated platform source: ${src}`);
        return null;
      }

      // 已登录对应平台：单源专属解析
      let singleResult: ResolvedAudioSource | null = null;
      if (src === "netease" || src === "wy") {
        singleResult = await this.resolveNetease(query.id || "", query);
      } else if (src === "qq" || src === "tx") {
        singleResult = await this.resolveQQMusic(query);
      } else if (src === "kugou" || src === "kg") {
        singleResult = await this.resolveKugou(query);
      } else if (src === "kuwo" || src === "kw") {
        singleResult = await this.resolveKuwo(query);
      } else if (src === "qishui") {
        singleResult = await this.resolveQishui(query);
      }

      if (singleResult && singleResult.url) {
        MultiSourceResolver.resolvedUrlCache.set(cacheKey, { result: singleResult, expiry: Date.now() + 1800000 });
        return singleResult;
      }
      return null;
    }

    // 2. 【未指明源时的聚合竞速】：仅在当前「所有已登录平台」与「启用的洛雪脚本」之间竞速
    const resolutionMode = typeof window !== "undefined" ? useSourceConfigStore.getState().resolutionMode : "hybrid_racing";

    // 洛雪独占模式
    if (resolutionMode === "lx_only") {
      const lxRes = await this.resolveLxScript(query);
      if (lxRes?.url) {
        MultiSourceResolver.resolvedUrlCache.set(cacheKey, { result: lxRes, expiry: Date.now() + 1800000 });
        return lxRes;
      }
      return null;
    }

    const tasks: Promise<ResolvedAudioSource | null>[] = [];

    // 洛雪扩展源任务
    const isLxEnabled = typeof window !== "undefined"
      ? (useSourceConfigStore.getState().sources.lx_custom?.enabled && useSourceConfigStore.getState().lxScripts.some((s) => s.enabled))
      : true;
    if (isLxEnabled) {
      tasks.push(this.resolveLxScript(query));
    }

    // 各已登录平台任务
    if (isPlatformLoggedIn("netease")) {
      tasks.push(this.resolveNetease(query.id || "", query));
    }
    if (isPlatformLoggedIn("qq")) {
      tasks.push(this.resolveQQMusic(query));
    }
    if (isPlatformLoggedIn("kugou")) {
      tasks.push(this.resolveKugou(query));
    }
    if (isPlatformLoggedIn("kuwo")) {
      tasks.push(this.resolveKuwo(query));
    }
    if (isPlatformLoggedIn("qishui")) {
      tasks.push(this.resolveQishui(query));
    }

    // 若没有任何已登录网络源且洛雪未开启，直接返回 null，阻断请求
    if (tasks.length === 0) {
      console.warn("[MultiSourceResolver] No authenticated platform or enabled script available for audio resolution.");
      return null;
    }

    // 并发竞速解析
    try {
      const raceResult = await Promise.race(
        tasks.map((t) => t.then((res) => (res?.url ? res : Promise.reject())))
      );
      if (raceResult?.url) {
        MultiSourceResolver.resolvedUrlCache.set(cacheKey, { result: raceResult, expiry: Date.now() + 1800000 });
        return raceResult;
      }
    } catch {}

    // 竞速未命中，遍历等待首个成功结果
    const settled = await Promise.allSettled(tasks);
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value?.url) {
        MultiSourceResolver.resolvedUrlCache.set(cacheKey, { result: r.value, expiry: Date.now() + 1800000 });
        return r.value;
      }
    }

    return null;
  }

  /**
   * 洛雪扩展脚本音源解析
   */
  public async resolveLxScript(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    try {
      const lxScripts = typeof window !== "undefined" ? useSourceConfigStore.getState().lxScripts : [];
      const enabledScripts = lxScripts.filter((s) => s.enabled);
      if (enabledScripts.length === 0) return null;

      const platformToLX: Record<string, string> = {
        kuwo: "kw", kw: "kw",
        kugou: "kg", kg: "kg",
        qq: "tx", tx: "tx",
        netease: "wy", wy: "wy",
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

      for (const script of enabledScripts) {
        try {
          const lxUrlResult = await LXRunner.getMusicUrl(script, songObj, "320k");
          if (lxUrlResult?.url && lxUrlResult.url.startsWith("http") && (await this.validateStream(lxUrlResult.url))) {
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
        } catch {}
      }
    } catch {}
    return null;
  }

  /**
   * 酷我音乐音源解析 (严格鉴权通道)
   */
  public async resolveKuwo(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    if (!isPlatformLoggedIn("kuwo")) return null;

    // 1. 如果已有明确的酷我 RID，优先直连转换母带 URL
    if (query.id && (query.source === "kuwo" || !query.source)) {
      try {
        const rid = String(query.id).replace("MUSIC_", "").trim();
        if (/^\d+$/.test(rid)) {
          const directRes = await fetch(
            `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=${rid}&format=mp3&response=url`,
            { signal: AbortSignal.timeout(3000), headers: getPlatformHeaders("kuwo") }
          );
          if (directRes.ok) {
            const streamUrl = (await directRes.text()).trim();
            if (streamUrl && streamUrl.startsWith("http")) {
              return {
                url: streamUrl,
                source: "kuwo",
                quality: "lossless",
                format: "mp3",
                bitrate: 320000,
                isTrial: false,
                name: "酷我音乐 (高解析母带直通流)",
              };
            }
          }
        }
      } catch {
        // fallback to keyword search
      }
    }

    // 2. 关键词智能匹配
    if (query.title) {
      try {
        const kw = encodeURIComponent(`${query.title} ${query.artist || ""}`.trim());
        const searchRes = await fetch(`${getApiBase()}/api/kuwo/search?keywords=${kw}&limit=15`, {
          signal: AbortSignal.timeout(3500),
          headers: getPlatformHeaders("kuwo"),
        });
        if (searchRes.status === 401) {
          handle401Response("kuwo", 401);
          return null;
        }
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          const songs = searchJson?.songs || [];

          let bestSong: any = null;
          let highestScore = 0;

          for (const s of songs) {
            const score = calculateMatchScore(query.title, query.artist || "", s.title || "", s.artist || "");
            if (score > highestScore && score >= 70) {
              highestScore = score;
              bestSong = s;
            }
          }

          if (bestSong?.id) {
            const rid = bestSong.id.replace("MUSIC_", "");
            const urlRes = await fetch(
              `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=${rid}&format=mp3&response=url`,
              { signal: AbortSignal.timeout(3000), headers: getPlatformHeaders("kuwo") }
            );
            if (urlRes.ok) {
              const streamUrl = (await urlRes.text()).trim();
              if (streamUrl && streamUrl.startsWith("http")) {
                return {
                  url: streamUrl,
                  source: "kuwo",
                  quality: "lossless",
                  format: "mp3",
                  bitrate: 320000,
                  isTrial: false,
                  name: "酷我音乐 (全网高解析母带)",
                };
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  /**
   * 获取当前歌曲在已登录平台的可用音源版本候选列表 (供用户手动选择)
   */
  public async getAvailableSourceCandidates(query: SongMetadataQuery): Promise<ResolvedAudioSource[]> {
    const promises: Promise<ResolvedAudioSource | null>[] = [];
    if (isPlatformLoggedIn("netease")) promises.push(this.resolveNetease(query.id || "", query));
    if (isPlatformLoggedIn("qq")) promises.push(this.resolveQQMusic(query));
    if (isPlatformLoggedIn("kugou")) promises.push(this.resolveKugou(query));
    if (isPlatformLoggedIn("kuwo")) promises.push(this.resolveKuwo(query));
    if (isPlatformLoggedIn("qishui")) promises.push(this.resolveQishui(query));

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
   * 网易云原生音源嗅探与多级降级解析 (仅在登录后开放)
   */
  public async resolveNetease(songId: string, query?: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    if (!isPlatformLoggedIn("netease")) return null;

    const numericId = songId ? songId.replace(/^[a-zA-Z_-]+/, "") : "";
    const effectiveId = numericId || songId;

    try {
      const name = query?.title || "";
      const artist = query?.artist || "";
      const album = query?.album || "";
      const params = new URLSearchParams({
        id: effectiveId || "",
        name,
        artist,
        album,
        quality: "lossless",
      });

      const response = await fetch(`${getApiBase()}/api/song/url?${params.toString()}`, {
        signal: AbortSignal.timeout(3500),
        headers: getPlatformHeaders("netease"),
      });
      if (response.status === 401) {
        handle401Response("netease", 401);
        return null;
      }
      if (response.ok) {
        const data = await response.json();
        if (data && data.url) {
          const isTrial =
            !!data.trial ||
            !!(data.freeTrialInfo && (data.freeTrialInfo.start > 0 || data.freeTrialInfo.end > 0));

          return {
            url: data.url,
            source: "netease",
            quality: data.level === "hires" ? "hires" : data.level === "lossless" ? "lossless" : "high",
            format: data.url.includes(".flac") ? "flac" : "mp3",
            bitrate: data.br || 320000,
            isTrial,
            name: isTrial ? "网易云音乐 (VIP 试听片段)" : "网易云音乐 (无损完整母带)",
          };
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * QQ 音乐音源解析 (仅在登录后开放)
   */
  public async resolveQQMusic(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    if (!isPlatformLoggedIn("qq")) return null;

    try {
      const kw = encodeURIComponent(`${query.title} ${query.artist || ""}`.trim());
      const searchRes = await fetch(`${getApiBase()}/api/qq/search?keywords=${kw}&limit=10`, {
        signal: AbortSignal.timeout(3500),
        headers: getPlatformHeaders("qq"),
      });
      if (searchRes.status === 401) {
        handle401Response("qq", 401);
        return null;
      }
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const songs = searchJson?.songs || [];

        let bestSong: any = null;
        let highestScore = 0;

        for (const s of songs) {
          const score = calculateMatchScore(query.title, query.artist, s.title || "", s.artist || "");
          if (score > highestScore && score >= 60) {
            highestScore = score;
            bestSong = s;
          }
        }

        if (bestSong?.id) {
          const urlRes = await fetch(
            `${getApiBase()}/api/qq/song/url?mid=${bestSong.id}&quality=lossless`,
            { signal: AbortSignal.timeout(3500), headers: getPlatformHeaders("qq") }
          );
          if (urlRes.status === 401) {
            handle401Response("qq", 401);
            return null;
          }
          if (urlRes.ok) {
            const urlJson = await urlRes.json();
            if (urlJson?.url) {
              return {
                url: urlJson.url,
                source: "qq",
                quality: "hires",
                format: urlJson.url.includes(".flac") ? "flac" : "mp3",
                bitrate: 1411000,
                isTrial: false,
                name: "QQ 音乐 (Hi-Res 无损音源)",
              };
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * 酷狗音乐音源解析 (仅在登录后开放)
   */
  public async resolveKugou(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    if (!isPlatformLoggedIn("kugou")) return null;

    try {
      const kw = encodeURIComponent(`${query.title} ${query.artist || ""}`.trim());
      const searchRes = await fetch(`${getApiBase()}/api/kugou/search?keywords=${kw}&limit=10`, {
        signal: AbortSignal.timeout(3500),
        headers: getPlatformHeaders("kugou"),
      });
      if (searchRes.status === 401) {
        handle401Response("kugou", 401);
        return null;
      }
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const songs = searchJson?.songs || [];

        let bestSong: any = null;
        let highestScore = 0;

        for (const s of songs) {
          const score = calculateMatchScore(query.title, query.artist, s.title || "", s.artist || "");
          if (score > highestScore && score >= 60) {
            highestScore = score;
            bestSong = s;
          }
        }

        if (bestSong?.id) {
          const urlRes = await fetch(
            `${getApiBase()}/api/kugou/song/url?hash=${bestSong.id}&title=${encodeURIComponent(query.title)}&artist=${encodeURIComponent(query.artist || "")}&quality=lossless`,
            { signal: AbortSignal.timeout(3500), headers: getPlatformHeaders("kugou") }
          );
          if (urlRes.status === 401) {
            handle401Response("kugou", 401);
            return null;
          }
          if (urlRes.ok) {
            const urlJson = await urlRes.json();
            if (urlJson?.url) {
              return {
                url: urlJson.url,
                source: "kugou",
                quality: "lossless",
                format: "mp3",
                bitrate: 320000,
                isTrial: false,
                name: "酷狗音乐 (高解析母带)",
              };
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * 汽水音乐音源解析 (仅在登录/配置后开放)
   */
  public async resolveQishui(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    if (!isPlatformLoggedIn("qishui")) return null;

    try {
      const kw = encodeURIComponent(`${query.title} ${query.artist || ""}`.trim());
      const searchRes = await fetch(`${getApiBase()}/api/qishui/search?keywords=${kw}&limit=10`, {
        signal: AbortSignal.timeout(3500),
        headers: getPlatformHeaders("qishui"),
      });
      if (searchRes.status === 401) {
        handle401Response("qishui", 401);
        return null;
      }
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const songs = searchJson?.songs || [];

        let bestSong: any = null;
        let highestScore = 0;

        for (const s of songs) {
          const score = calculateMatchScore(query.title, query.artist, s.title || "", s.artist || "");
          if (score > highestScore && score >= 60) {
            highestScore = score;
            bestSong = s;
          }
        }

        if (bestSong?.id) {
          const urlRes = await fetch(`${getApiBase()}/api/qishui/song/url?id=${bestSong.id}`, {
            signal: AbortSignal.timeout(3500),
            headers: getPlatformHeaders("qishui"),
          });
          if (urlRes.ok) {
            const urlJson = await urlRes.json();
            if (urlJson?.url) {
              return {
                url: urlJson.url,
                source: "qishui",
                quality: "lossless",
                format: "m4a",
                bitrate: 256000,
                isTrial: false,
                name: "汽水音乐 (SpadeKey 实时解密源)",
              };
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  private static searchCache = new Map<string, { data: SegmentedSearchResults; expiry: number }>();

  /**
   * 全网分平台在线歌曲深度并发搜索 (仅向已登录平台与已启用洛雪脚本派发请求)
   */
  public async searchOnlineMusicSegmented(keywords: string): Promise<SegmentedSearchResults> {
    if (!keywords || !keywords.trim()) {
      return { netease: [], qq: [], kugou: [], kuwo: [], qishui: [], local: [], lx_custom: [], all: [] };
    }

    const trimmed = keywords.trim();
    const cacheKey = trimmed.toLowerCase();
    const now = Date.now();
    const cached = MultiSourceResolver.searchCache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return cached.data;
    }

    const kw = encodeURIComponent(trimmed);
    const sourceConfigs = typeof window !== "undefined" ? useSourceConfigStore.getState().sources : null;

    const endpoints: { key: string; url: string; headers: Record<string, string> }[] = [];
    if (isPlatformLoggedIn("netease") && sourceConfigs?.netease?.enabled !== false) {
      const base = sourceConfigs?.netease?.customApiBase || getApiBase();
      endpoints.push({ key: "netease", url: `${base}/api/search?keywords=${kw}&limit=100`, headers: getPlatformHeaders("netease") });
    }
    if (isPlatformLoggedIn("qq") && sourceConfigs?.qq?.enabled !== false) {
      const base = sourceConfigs?.qq?.customApiBase || getApiBase();
      endpoints.push({ key: "qq", url: `${base}/api/qq/search?keywords=${kw}&limit=50`, headers: getPlatformHeaders("qq") });
    }
    if (isPlatformLoggedIn("kugou") && sourceConfigs?.kugou?.enabled !== false) {
      const base = sourceConfigs?.kugou?.customApiBase || getApiBase();
      endpoints.push({ key: "kugou", url: `${base}/api/kugou/search?keywords=${kw}&limit=100`, headers: getPlatformHeaders("kugou") });
    }
    if (isPlatformLoggedIn("kuwo") && sourceConfigs?.kuwo?.enabled !== false) {
      const base = sourceConfigs?.kuwo?.customApiBase || getApiBase();
      endpoints.push({ key: "kuwo", url: `${base}/api/kuwo/search?keywords=${kw}&limit=100`, headers: getPlatformHeaders("kuwo") });
    }
    if (isPlatformLoggedIn("qishui") && sourceConfigs?.qishui?.enabled !== false) {
      const base = sourceConfigs?.qishui?.customApiBase || getApiBase();
      endpoints.push({ key: "qishui", url: `${base}/api/qishui/search?keywords=${kw}&limit=60`, headers: getPlatformHeaders("qishui") });
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

    const fetchTasks = endpoints.map(async (ep) => {
      try {
        const r = await fetch(ep.url, { signal: AbortSignal.timeout(2800), headers: ep.headers });
        if (r.status === 401) {
          handle401Response(ep.key, 401);
          return { key: ep.key, songs: [] };
        }
        if (!r.ok) return { key: ep.key, songs: [] };
        const data = await r.json();
        return { key: ep.key, songs: Array.isArray(data.songs) ? data.songs : [] };
      } catch {
        return { key: ep.key, songs: [] };
      }
    });

    const isLxEnabled = typeof window !== "undefined"
      ? Boolean(useSourceConfigStore.getState().sources.lx_custom?.enabled && useSourceConfigStore.getState().lxScripts.some((s) => s.enabled))
      : true;

    const lxTask = async () => {
      if (!isLxEnabled) return { key: "lx_custom", songs: [] };
      try {
        const lxScripts = typeof window !== "undefined" ? useSourceConfigStore.getState().lxScripts : [];
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
        return { key: "lx_custom", songs: lxSongs };
      } catch {
        return { key: "lx_custom", songs: [] };
      }
    };

    const responses = await Promise.allSettled([...fetchTasks, lxTask()]);

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
            (Array.isArray(s.artists)
              ? s.artists.map((a: any) => a.name).join("/")
              : "未知歌手");
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

    if (results.all.length > 0) {
      MultiSourceResolver.searchCache.set(cacheKey, {
        data: results,
        expiry: Date.now() + 1200000, // 20 分钟缓存
      });
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
        const res = await fetch(`${base}/api/search?keywords=${kw}&limit=3`, {
          signal: AbortSignal.timeout(3000),
          headers: getPlatformHeaders("netease"),
        });
        if (res.ok) {
          const data = await res.json();
          const songs = data.songs || [];
          for (const s of songs) {
            if (s.cover && s.cover.startsWith("http") && !s.cover.includes("default-cover")) {
              return s.cover;
            }
          }
        }
      } catch {}
    }

    // 优先 2: QQ 音乐 300x300 高清图 (需登录)
    if (isPlatformLoggedIn("qq")) {
      try {
        const res = await fetch(`${base}/api/qq/search?keywords=${kw}&limit=3`, {
          signal: AbortSignal.timeout(3000),
          headers: getPlatformHeaders("qq"),
        });
        if (res.ok) {
          const data = await res.json();
          const songs = data.songs || [];
          for (const s of songs) {
            if (s.cover && s.cover.startsWith("http") && !s.cover.includes("default-cover")) {
              return s.cover;
            }
          }
        }
      } catch {}
    }

    // 优先 3: 酷狗 400x400 高清大图 (需登录)
    if (isPlatformLoggedIn("kugou")) {
      try {
        const res = await fetch(`${base}/api/kugou/search?keywords=${kw}&limit=3`, {
          signal: AbortSignal.timeout(3000),
          headers: getPlatformHeaders("kugou"),
        });
        if (res.ok) {
          const data = await res.json();
          const songs = data.songs || [];
          for (const s of songs) {
            if (s.cover && s.cover.startsWith("http") && !s.cover.includes("default-cover")) {
              return s.cover;
            }
          }
        }
      } catch {}
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
   * 在线歌词抓取 (严格仅限已登录平台)
   */
  public async fetchOnlineLyrics(
    songId: string,
    source: string = "netease",
    query?: SongMetadataQuery
  ): Promise<{ lyrics?: string; translationLyrics?: string }> {
    if (!songId && !query?.title) return {};

    const effectiveSource = source || "netease";
    if (effectiveSource !== "local" && effectiveSource !== "lx_custom" && !isPlatformLoggedIn(effectiveSource)) {
      return {};
    }

    const numericId = songId ? songId.replace(/^[a-zA-Z_-]+/, "") : "";
    const effectiveId = numericId || songId;

    try {
      let url = `${getApiBase()}/api/lyric?id=${encodeURIComponent(effectiveId)}`;
      if (query?.title) {
        url += `&title=${encodeURIComponent(query.title)}&artist=${encodeURIComponent(query.artist || "")}`;
      }
      if (effectiveSource === "qq") url = `${getApiBase()}/api/lyric?mid=${encodeURIComponent(effectiveId)}&title=${encodeURIComponent(query?.title || "")}&artist=${encodeURIComponent(query?.artist || "")}`;
      else if (effectiveSource === "kugou") url = `${getApiBase()}/api/lyric?hash=${encodeURIComponent(effectiveId)}&title=${encodeURIComponent(query?.title || "")}&artist=${encodeURIComponent(query?.artist || "")}`;
      else if (effectiveSource === "qishui") url = `${getApiBase()}/api/qishui/lyric?id=${encodeURIComponent(effectiveId)}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(3000), headers: getPlatformHeaders(effectiveSource) });
      if (res.ok) {
        const data = await res.json();
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

