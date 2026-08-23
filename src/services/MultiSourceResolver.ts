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
import { LXRunner } from "@/lib/sources/lxRunner";

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

  let score = 0;

  if (normTargetTitle === normCandTitle) {
    score += 60;
  } else if (normCandTitle.includes(normTargetTitle) || normTargetTitle.includes(normCandTitle)) {
    score += 35;
  } else {
    return 0;
  }

  // 2. 歌手匹配
  if (normTargetArtist) {
    if (normTargetArtist === normCandArtist) {
      score += 40;
    } else if (normCandArtist.includes(normTargetArtist) || normTargetArtist.includes(normCandArtist)) {
      score += 35;
    } else if (normCandTitle.includes(normTargetArtist)) {
      score += 30; // 标题内嵌歌手名
    } else if (
      (normTargetArtist.includes("beyond") && (normCandArtist.includes("黄家驹") || normCandTitle.includes("黄家驹"))) ||
      (normTargetArtist.includes("黄家驹") && (normCandArtist.includes("beyond") || normCandTitle.includes("beyond")))
    ) {
      score += 35; // 乐队主唱关联匹配
    } else if (normTargetArtist === "未知歌手" || normCandArtist === "未知歌手") {
      score += 10;
    } else {
      return 0; // 歌手不匹配，直接淘汰
    }
  } else {
    score += 20;
  }

  if (!candidateTitle.includes("(") && !candidateTitle.includes("（")) {
    score += 10;
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

  /**
   * 聚合解析核心入口：按照用户设定的优先级队列自动检索与多级降级熔断
   */
  public async resolvePlayableAudio(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    // 0. 如果明确指定了音源类型，优先调用该音源的原生直连解析 (试听片段自动跳过，优先寻找完整母带)
    if (query.source === "kuwo") {
      try {
        const res = await this.resolveKuwo(query);
        if (res && res.url && !res.isTrial) return res;
      } catch {
        // ignore
      }
    } else if (query.source === "qq") {
      try {
        const res = await this.resolveQQMusic(query);
        if (res && res.url && !res.isTrial) return res;
      } catch {
        // ignore
      }
    } else if (query.source === "kugou") {
      try {
        const res = await this.resolveKugou(query);
        if (res && res.url && !res.isTrial) return res;
      } catch {
        // ignore
      }
    } else if (query.source === "qishui") {
      try {
        const res = await this.resolveQishui(query);
        if (res && res.url && !res.isTrial) return res;
      } catch {
        // ignore
      }
    } else if (query.source === "netease") {
      try {
        const res = await this.resolveNetease(query.id || "", query);
        if (res && res.url && !res.isTrial) return res;
      } catch {
        // ignore
      }
    } else if (query.source === "lx_custom") {
      try {
        const lxScripts = typeof window !== "undefined" ? useSourceConfigStore.getState().lxScripts : [];
        const enabledScripts = lxScripts.filter((s) => s.enabled);
        for (const script of enabledScripts) {
          const songObj: Song = {
            id: query.id || "",
            title: query.title,
            artist: query.artist || "",
            album: query.album || "",
            duration: query.duration || 240,
            cover: "/default-cover.svg",
            source: (query.source as any) || "wy",
            audioUrl: "",
            format: "mp3",
          };
          const lxUrlResult = await LXRunner.getMusicUrl(script, songObj, "320k");
          if (lxUrlResult?.url && lxUrlResult.url.startsWith("http")) {
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
        }
      } catch (e) {
        console.warn("[MultiSourceResolver] LXRunner script resolve error:", e);
      }
    }

    // 1. 服务端跨源智能嗅探 (支持网易云、酷我、QQ 音乐等自动版权突破与直通流提取)
    if (query.title || query.id) {
      try {
        const params = new URLSearchParams({
          name: query.title || "",
          artist: query.artist || "",
          album: query.album || "",
          id: query.id || "",
        });
        const serverRes = await fetch(`${getApiBase()}/api/song/url?${params.toString()}`, {
          signal: AbortSignal.timeout(3500),
        });
        if (serverRes.ok) {
          const data = await serverRes.json();
          if (data && data.url && data.url.startsWith("http")) {
            return {
              url: data.url,
              source: data.source || "cross_matched",
              quality: data.level === "hires" ? "hires" : data.level === "lossless" ? "lossless" : "high",
              format: data.url.includes(".flac") ? "flac" : "mp3",
              bitrate: data.br || 320000,
              isTrial: false,
              name: `${query.title || "未知曲目"} (全网高解析直通流)`,
            };
          }
        }
      } catch (e) {
        console.warn("[MultiSourceResolver] Server cross-matching fallback:", e);
      }
    }

    // 2. 酷我高解析直通流直接嗅探 (支持绝大部分全网版权歌曲)
    if (query.title) {
      try {
        const kuwoResult = await this.resolveKuwo(query);
        if (kuwoResult && kuwoResult.url) return kuwoResult;
      } catch {
        // ignore
      }
    }

    // 3. QQ 音乐 / 酷狗音乐 / 汽水音乐
    if (query.title) {
      try {
        const qqResult = await this.resolveQQMusic(query);
        if (qqResult && qqResult.url) return qqResult;
      } catch {
        // ignore
      }

      try {
        const kugouResult = await this.resolveKugou(query);
        if (kugouResult && kugouResult.url) return kugouResult;
      } catch {
        // ignore
      }

      try {
        const qishuiResult = await this.resolveQishui(query);
        if (qishuiResult && qishuiResult.url) return qishuiResult;
      } catch {
        // ignore
      }
    }

    // 4. 网易云原生外链或公开代理
    const neteaseFallback = await this.resolveNetease(query.id || "", query);
    if (neteaseFallback?.url) return neteaseFallback;

    // 5. 纯净数字 ID 直连
    if (query.id && /^\d+$/.test(query.id)) {
      return {
        url: `https://music.163.com/song/media/outer/url?id=${query.id}.mp3`,
        source: "netease",
        quality: "high",
        format: "mp3",
        bitrate: 320000,
        isTrial: false,
        name: "网易云音乐 (CDN 直通流)",
      };
    }

    return null;
  }

  /**
   * 酷我音乐音源解析 (高音质直通源，支持直连转换与高精度模糊嗅探)
   */
  public async resolveKuwo(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    // 1. 如果已有明确的酷我 RID，优先直连转换母带 URL (超高速 50ms 直出)
    if (query.id && (query.source === "kuwo" || !query.source)) {
      try {
        const rid = String(query.id).replace("MUSIC_", "").trim();
        if (/^\d+$/.test(rid)) {
          const directRes = await fetch(
            `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=${rid}&format=mp3&response=url`,
            { signal: AbortSignal.timeout(3000) }
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
        });
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          const songs = searchJson?.songs || [];

          let bestSong: any = null;
          let highestScore = 0;

          for (const s of songs) {
            const score = calculateMatchScore(query.title, query.artist || "", s.title || "", s.artist || "");
            if (score > highestScore && score >= 50) {
              highestScore = score;
              bestSong = s;
            }
          }

          if (bestSong?.id) {
            const rid = bestSong.id.replace("MUSIC_", "");
            const urlRes = await fetch(
              `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=${rid}&format=mp3&response=url`,
              { signal: AbortSignal.timeout(3000) }
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
   * 获取当前歌曲在所有平台的可用音源版本候选列表 (供用户手动选择)
   */
  public async getAvailableSourceCandidates(query: SongMetadataQuery): Promise<ResolvedAudioSource[]> {
    const promises = [
      this.resolveNetease(query.id || "", query),
      this.resolveQQMusic(query),
      this.resolveKugou(query),
      this.resolveQishui(query),
    ];

    const results = await Promise.allSettled(promises);
    const candidates: ResolvedAudioSource[] = [];

    results.forEach((res) => {
      if (res.status === "fulfilled" && res.value && res.value.url) {
        candidates.push(res.value);
      }
    });

    if (candidates.length === 0) {
      if (query.id && /^\d+$/.test(query.id)) {
        candidates.push({
          url: `https://music.163.com/song/media/outer/url?id=${query.id}.mp3`,
          source: "netease",
          quality: "high",
          format: "mp3",
          bitrate: 320000,
          isTrial: false,
          name: "网易云官方 CDN 直通流",
        });
      }
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
   * 网易云原生音源嗅探与多级降级解析
   */
  public async resolveNetease(songId: string, query?: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    const numericId = songId ? songId.replace(/^[a-zA-Z_-]+/, "") : "";
    const effectiveId = numericId || songId;

    // 尝试 1: 后端代理 API
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
      });
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
      // ignore & fallback
    }

    // 尝试 2: 公开 Meting 解析代理
    if (effectiveId && /^\d+$/.test(effectiveId)) {
      try {
        const metingRes = await fetch(
          `https://api.injahow.cn/meting/?type=url&id=${effectiveId}&server=netease`,
          { signal: AbortSignal.timeout(3500) }
        );
        if (metingRes.ok) {
          const text = await metingRes.text();
          let streamUrl = "";
          try {
            const parsed = JSON.parse(text);
            streamUrl = parsed.url || parsed.data?.url || "";
          } catch {
            if (text.startsWith("http")) streamUrl = text.trim();
          }
          if (streamUrl) {
            return {
              url: streamUrl,
              source: "netease",
              quality: "high",
              format: "mp3",
              bitrate: 320000,
              isTrial: false,
              name: "网易云音乐 (Meting 极速流)",
            };
          }
        }
      } catch {
        // ignore & fallback
      }
    }

    return null;
  }

  /**
   * QQ 音乐音源解析
   */
  public async resolveQQMusic(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    try {
      const kw = encodeURIComponent(`${query.title} ${query.artist || ""}`.trim());
      const searchRes = await fetch(`${getApiBase()}/api/qq/search?keywords=${kw}&limit=10`, {
        signal: AbortSignal.timeout(3500),
      });
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
            { signal: AbortSignal.timeout(3500) }
          );
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
   * 酷狗音乐音源解析
   */
  public async resolveKugou(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    try {
      const kw = encodeURIComponent(`${query.title} ${query.artist || ""}`.trim());
      const searchRes = await fetch(`${getApiBase()}/api/kugou/search?keywords=${kw}&limit=10`, {
        signal: AbortSignal.timeout(3500),
      });
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
            `${getApiBase()}/api/kugou/song/url?hash=${bestSong.id}&albumAudioId=${bestSong.albumAudioId || ""}&quality=lossless`,
            { signal: AbortSignal.timeout(3500) }
          );
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
   * 汽水音乐音源解析
   */
  public async resolveQishui(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    try {
      const kw = encodeURIComponent(`${query.title} ${query.artist || ""}`.trim());
      const searchRes = await fetch(`${getApiBase()}/api/qishui/search?keywords=${kw}&limit=10`, {
        signal: AbortSignal.timeout(3500),
      });
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

  /**
   * 全网分平台在线歌曲深度并发搜索 (支持本地后端与公开接口全自动降级)
   */
  public async searchOnlineMusicSegmented(keywords: string): Promise<SegmentedSearchResults> {
    if (!keywords || !keywords.trim()) {
      return { netease: [], qq: [], kugou: [], kuwo: [], qishui: [], local: [], lx_custom: [], all: [] };
    }

    const kw = encodeURIComponent(keywords.trim());
    const sourceConfigs = typeof window !== "undefined" ? useSourceConfigStore.getState().sources : null;
    const isEnabled = (id: string) => (sourceConfigs ? (sourceConfigs as Record<string, any>)[id]?.enabled !== false : true);

    const endpoints: { key: string; url: string }[] = [];
    if (isEnabled("netease")) {
      const base = sourceConfigs?.netease?.customApiBase || getApiBase();
      endpoints.push({ key: "netease", url: `${base}/api/search?keywords=${kw}&limit=100` });
    }
    if (isEnabled("qq")) {
      const base = sourceConfigs?.qq?.customApiBase || getApiBase();
      endpoints.push({ key: "qq", url: `${base}/api/qq/search?keywords=${kw}&limit=100` });
    }
    if (isEnabled("kugou")) {
      const base = sourceConfigs?.kugou?.customApiBase || getApiBase();
      endpoints.push({ key: "kugou", url: `${base}/api/kugou/search?keywords=${kw}&limit=100` });
    }
    if (isEnabled("kuwo")) {
      const base = sourceConfigs?.kuwo?.customApiBase || getApiBase();
      endpoints.push({ key: "kuwo", url: `${base}/api/kuwo/search?keywords=${kw}&limit=100` });
    }
    if (isEnabled("qishui")) {
      const base = sourceConfigs?.qishui?.customApiBase || getApiBase();
      endpoints.push({ key: "qishui", url: `${base}/api/qishui/search?keywords=${kw}&limit=60` });
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
        const r = await fetch(ep.url, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) return { key: ep.key, songs: [] };
        const data = await r.json();
        return { key: ep.key, songs: Array.isArray(data.songs) ? data.songs : [] };
      } catch {
        return { key: ep.key, songs: [] };
      }
    });

    const lxTask = async () => {
      if (!isEnabled("lx_custom")) return { key: "lx_custom", songs: [] };
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
              audioUrl:
                s.audioUrl ||
                s.url ||
                (key === "netease" && /^\d+$/.test(songId)
                  ? `https://music.163.com/song/media/outer/url?id=${songId}.mp3`
                  : ""),
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

    // 备用降级策略：如果上述代理均未返回结果，调用网易云与 QQ 音乐公开开放检索
    if (results.all.length === 0) {
      try {
        const directRes = await fetch(
          `https://music.163.com/api/search/get/web?csrf_token=&hlpretag=&hlposttag=&s=${kw}&type=1&offset=0&total=true&limit=50`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (directRes.ok) {
          const directData = await directRes.json();
          const neteaseSongs: Song[] = [];
          (directData?.result?.songs || []).forEach((s: any) => {
            const songId = String(s.id);
            const artist = Array.isArray(s.artists)
              ? s.artists.map((a: any) => a.name).join("/")
              : s.artist?.name || "未知歌手";
            const uniqKey = `${s.name}-${artist}`.toLowerCase();
            const song: Song = {
              id: songId,
              title: s.name || "未知曲目",
              artist,
              album: s.album?.name || "精选大碟",
              duration: s.duration ? Math.round(s.duration / 1000) : 240,
              cover: s.album?.artist?.img1v1Url || "/default-cover.svg",
              source: "netease",
              audioUrl: `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
              format: "mp3",
            };
            neteaseSongs.push(song);
            if (!seen.has(uniqKey)) {
              seen.add(uniqKey);
              results.all.push(song);
            }
          });
          results.netease = neteaseSongs;
        }
      } catch (err) {
        console.warn("[MultiSourceResolver] Direct NetEase search fallback failed:", err);
      }
    }

    return results;
  }

  /**
   * 全网在线歌曲综合搜索
   */
  public async searchOnlineMusic(keywords: string, limit: number = 30): Promise<Song[]> {
    const segmented = await this.searchOnlineMusicSegmented(keywords);
    return segmented.all.slice(0, limit);
  }

  /**
   * 在线歌词抓取
   */
  public async fetchOnlineLyrics(
    songId: string,
    source: string = "netease",
    query?: SongMetadataQuery
  ): Promise<{ lyrics?: string; translationLyrics?: string }> {
    if (!songId && !query?.title) return {};

    const numericId = songId ? songId.replace(/^[a-zA-Z_-]+/, "") : "";
    const effectiveId = numericId || songId;

    // 尝试 1: 后端代理 API (传递 id 及可选 title/artist 供服务端智能降级)
    try {
      let url = `${getApiBase()}/api/lyric?id=${encodeURIComponent(effectiveId)}`;
      if (query?.title) {
        url += `&title=${encodeURIComponent(query.title)}&artist=${encodeURIComponent(query.artist || "")}`;
      }
      if (source === "qq") url = `${getApiBase()}/api/qq/lyric?mid=${encodeURIComponent(effectiveId)}`;
      else if (source === "kugou") url = `${getApiBase()}/api/kugou/lyric?hash=${encodeURIComponent(effectiveId)}`;
      else if (source === "qishui") url = `${getApiBase()}/api/qishui/lyric?id=${encodeURIComponent(effectiveId)}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
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

    // 尝试 2: 公开 Meting / 网易官方歌词 API
    if (effectiveId && /^\d+$/.test(effectiveId)) {
      try {
        const metingRes = await fetch(
          `https://api.injahow.cn/meting/?type=lrc&id=${effectiveId}&server=netease`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (metingRes.ok) {
          const lrcText = await metingRes.text();
          if (lrcText && lrcText.includes("[")) {
            return { lyrics: lrcText };
          }
        }
      } catch {
        // ignore
      }
    }

    // 尝试 3: 按歌名与歌手全网搜索歌词
    if (query?.title) {
      try {
        const kw = encodeURIComponent(`${query.title} ${query.artist || ""}`.trim());
        const searchRes = await fetch(`${getApiBase()}/api/search?keywords=${kw}&limit=5`, {
          signal: AbortSignal.timeout(3000),
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const firstSong = searchData?.result?.songs?.[0] || searchData?.songs?.[0];
          if (firstSong?.id) {
            const lrcRes = await fetch(`${getApiBase()}/api/lyric?id=${firstSong.id}`, {
              signal: AbortSignal.timeout(3000),
            });
            if (lrcRes.ok) {
              const lrcJson = await lrcRes.json();
              if (lrcJson.lrc?.lyric) {
                return {
                  lyrics: lrcJson.lrc.lyric,
                  translationLyrics: lrcJson.tlyric?.lyric || "",
                };
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return {};
  }
}

export const multiSourceResolver = MultiSourceResolver.getInstance();
