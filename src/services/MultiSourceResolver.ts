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
}

export interface SegmentedSearchResults {
  netease: Song[];
  qq: Song[];
  kugou: Song[];
  qishui: Song[];
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

function getApiBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://127.0.0.1:3000";
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
    const settings = useAudioSourceStore.getState();
    const priority = settings.sourcePriority || ["netease", "qq", "kugou", "qishui", "local"];
    const autoTrialFallback = settings.autoTrialFallback;

    // 1. 按用户优先级遍历音源平台
    for (const source of priority) {
      try {
        let result: ResolvedAudioSource | null = null;
        if (source === "netease") {
          result = await this.resolveNetease(query.id || "", query);
        } else if (source === "qq") {
          result = await this.resolveQQMusic(query);
        } else if (source === "kugou") {
          result = await this.resolveKugou(query);
        } else if (source === "qishui") {
          result = await this.resolveQishui(query);
        }

        if (result && result.url && !result.isTrial) {
          return result;
        }

        if (result && result.url && result.isTrial && !autoTrialFallback) {
          return result;
        }
      } catch (err) {
        console.warn(`[MultiSourceResolver] Failed on source ${source}:`, err);
      }
    }

    // 2. 备用兜底策略：网易云原生外链或公开代理
    const neteaseFallback = await this.resolveNetease(query.id || "", query);
    if (neteaseFallback?.url) return neteaseFallback;

    // 3. 跨平台兜底：纯净直链与数字 ID 直连
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

      // 尝试 3: 网易云官方外链 CDN 直通流 (无需服务器代理，纯前端即可播放)
      return {
        url: `https://music.163.com/song/media/outer/url?id=${effectiveId}.mp3`,
        source: "netease",
        quality: "high",
        format: "mp3",
        bitrate: 320000,
        isTrial: false,
        name: "网易云官方直通流 (Direct CDN)",
      };
    }

    return null;
  }

  /**
   * QQ 音乐音源解析
   */
  public async resolveQQMusic(query: SongMetadataQuery): Promise<ResolvedAudioSource | null> {
    try {
      const kw = encodeURIComponent(`${query.title} ${query.artist}`.trim());
      const searchRes = await fetch(`${getApiBase()}/api/qq/search?keywords=${kw}&limit=5`, {
        signal: AbortSignal.timeout(3500),
      });
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const song = searchJson?.songs?.[0];
        if (song?.id) {
          const urlRes = await fetch(
            `${getApiBase()}/api/qq/song/url?mid=${song.id}&quality=lossless`,
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
      const kw = encodeURIComponent(`${query.title} ${query.artist}`.trim());
      const searchRes = await fetch(`${getApiBase()}/api/kugou/search?keywords=${kw}&limit=5`, {
        signal: AbortSignal.timeout(3500),
      });
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const song = searchJson?.songs?.[0];
        if (song?.id) {
          const urlRes = await fetch(
            `${getApiBase()}/api/kugou/song/url?hash=${song.id}&albumAudioId=${song.albumAudioId || ""}&quality=lossless`,
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
      const kw = encodeURIComponent(`${query.title} ${query.artist}`.trim());
      const searchRes = await fetch(`${getApiBase()}/api/qishui/search?keywords=${kw}&limit=5`, {
        signal: AbortSignal.timeout(3500),
      });
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const track = searchJson?.songs?.[0];
        if (track?.id) {
          const urlRes = await fetch(`${getApiBase()}/api/qishui/song/url?id=${track.id}`, {
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
      return { netease: [], qq: [], kugou: [], qishui: [], all: [] };
    }

    const kw = encodeURIComponent(keywords.trim());
    const endpoints = [
      { key: "netease", url: `${getApiBase()}/api/search?keywords=${kw}&limit=30` },
      { key: "qq", url: `${getApiBase()}/api/qq/search?keywords=${kw}&limit=20` },
      { key: "kugou", url: `${getApiBase()}/api/kugou/search?keywords=${kw}&limit=20` },
      { key: "qishui", url: `${getApiBase()}/api/qishui/search?keywords=${kw}&limit=15` },
    ];

    const results: SegmentedSearchResults = {
      netease: [],
      qq: [],
      kugou: [],
      qishui: [],
      all: [],
    };

    const responses = await Promise.allSettled(
      endpoints.map(async (ep) => {
        try {
          const r = await fetch(ep.url, { signal: AbortSignal.timeout(3500) });
          if (!r.ok) return { key: ep.key, songs: [] };
          const data = await r.json();
          return { key: ep.key, songs: Array.isArray(data.songs) ? data.songs : [] };
        } catch {
          return { key: ep.key, songs: [] };
        }
      })
    );

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
          const uniqKey = `${songName}-${artistName}`.toLowerCase();

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
              audioUrl: s.url || (key === "netease" && /^\d+$/.test(songId) ? `https://music.163.com/song/media/outer/url?id=${songId}.mp3` : ""),
              format: "mp3",
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
        else if (key === "qishui") results.qishui = normalized;
      }
    });

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
    source: string = "netease"
  ): Promise<{ lyrics?: string; translationLyrics?: string }> {
    if (!songId) return {};

    const numericId = songId.replace(/^[a-zA-Z_-]+/, "");
    const effectiveId = numericId || songId;

    // 尝试 1: 后端代理 API
    try {
      let url = `${getApiBase()}/api/lyric?id=${encodeURIComponent(effectiveId)}`;
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

    return {};
  }
}

export const multiSourceResolver = MultiSourceResolver.getInstance();
