/**
 * 内置平台解析插件（S7-1b）：netease / qq / kugou / kuwo / qishui。
 *
 * 从 MultiSourceResolver 的 resolveNetease/resolveQQMusic/resolveKugou/resolveKuwo/
 * resolveQishui 原样搬运（只把裸 fetch 换成 http client、把 store/工具函数改为 ctx 注入），
 * 返回值、分支顺序、匹配阈值、超时预算都不变。
 *
 * 说明：仓库内没有 wx / migu 平台解析器（migu 只出现在 lxRunner 的源映射里），
 * 因此本文件不包含这两个插件；新增平台只需实现 ResolverPlugin 并注册。
 */
import { fetchJson, fetchText } from "@/services/http/client";
import type { ResolvedAudioSource } from "./types";
import type { ResolverInput, ResolverPlugin, ResolverPluginContext } from "./plugin";

interface UrlPayload {
  url?: string;
  level?: string;
  br?: number;
  trial?: boolean;
  freeTrialInfo?: { start?: number; end?: number } | null;
}

interface SearchSong {
  id?: string;
  title?: string;
  artist?: string;
}

interface SearchPayload {
  songs?: SearchSong[];
}

function sourceOf(input: ResolverInput): string {
  return (input.source ?? "").toLowerCase();
}

function keywordOf(query: { title: string; artist?: string }): string {
  return encodeURIComponent((query.title + " " + (query.artist || "")).trim());
}

function bestMatch(
  songs: SearchSong[],
  ctx: ResolverPluginContext,
  title: string,
  artist: string,
  minScore: number
): SearchSong | null {
  let best: SearchSong | null = null;
  let highestScore = 0;
  for (const song of songs) {
    const score = ctx.score(title, artist, song.title || "", song.artist || "");
    if (score > highestScore && score >= minScore) {
      highestScore = score;
      best = song;
    }
  }
  return best;
}

export const neteasePlugin: ResolverPlugin = {
  id: "netease",
  label: "网易云音乐",
  aliases: ["wy"],
  canHandle(input) {
    const source = sourceOf(input);
    return !source || source === "netease" || source === "wy";
  },
  async resolve(input, ctx) {
    if (!ctx.isLoggedIn("netease")) return null;
    if (ctx.signal?.aborted) return null;

    const songId = input.id ?? "";
    const numericId = songId ? songId.replace(/^[a-zA-Z_-]+/, "") : "";
    const effectiveId = numericId || songId;

    try {
      const query = input.query;
      const params = new URLSearchParams({
        id: effectiveId || "",
        name: query?.title || "",
        artist: query?.artist || "",
        album: query?.album || "",
        quality: "lossless",
      });
      const res = await fetchJson<UrlPayload>(ctx.apiBase + "/api/song/url?" + params.toString(), {
        timeoutMs: 3500,
        signal: ctx.signal,
        headers: ctx.headers("netease"),
      });
      if (res.status === 401) {
        ctx.onUnauthorized("netease");
        return null;
      }
      if (!res.ok) return null;

      const data = res.data;
      const url = data?.url;
      if (!data || !url) return null;

      const isTrial =
        !!data.trial ||
        !!(
          data.freeTrialInfo &&
          ((data.freeTrialInfo.start ?? 0) > 0 || (data.freeTrialInfo.end ?? 0) > 0)
        );
      return {
        url,
        source: "netease",
        quality: data.level === "hires" ? "hires" : data.level === "lossless" ? "lossless" : "high",
        format: url.includes(".flac") ? "flac" : "mp3",
        bitrate: data.br || 320000,
        isTrial,
        name: isTrial ? "网易云音乐 (VIP 试听片段)" : "网易云音乐 (无损完整母带)",
      };
    } catch {
      return null;
    }
  },
};

export const qqPlugin: ResolverPlugin = {
  id: "qq",
  label: "QQ 音乐",
  aliases: ["tx"],
  canHandle(input) {
    const source = sourceOf(input);
    return !source || source === "qq" || source === "tx";
  },
  async resolve(input, ctx) {
    if (!ctx.isLoggedIn("qq")) return null;
    if (ctx.signal?.aborted) return null;
    const query = input.query;
    if (!query) return null;

    try {
      const searchRes = await fetchJson<SearchPayload>(
        ctx.apiBase + "/api/qq/search?keywords=" + keywordOf(query) + "&limit=10",
        { timeoutMs: 3500, signal: ctx.signal, headers: ctx.headers("qq") }
      );
      if (searchRes.status === 401) {
        ctx.onUnauthorized("qq");
        return null;
      }
      if (!searchRes.ok) return null;

      const best = bestMatch(searchRes.data?.songs ?? [], ctx, query.title, query.artist, 60);
      if (!best?.id) return null;

      const urlRes = await fetchJson<UrlPayload>(
        ctx.apiBase + "/api/qq/song/url?mid=" + best.id + "&quality=lossless",
        { timeoutMs: 3500, signal: ctx.signal, headers: ctx.headers("qq") }
      );
      if (urlRes.status === 401) {
        ctx.onUnauthorized("qq");
        return null;
      }
      if (!urlRes.ok || !urlRes.data?.url) return null;

      const url = urlRes.data.url;
      return {
        url,
        source: "qq",
        quality: "hires",
        format: url.includes(".flac") ? "flac" : "mp3",
        bitrate: 1411000,
        isTrial: false,
        name: "QQ 音乐 (Hi-Res 无损音源)",
      };
    } catch {
      return null;
    }
  },
};

export const kugouPlugin: ResolverPlugin = {
  id: "kugou",
  label: "酷狗音乐",
  aliases: ["kg"],
  canHandle(input) {
    const source = sourceOf(input);
    return !source || source === "kugou" || source === "kg";
  },
  async resolve(input, ctx) {
    if (!ctx.isLoggedIn("kugou")) return null;
    if (ctx.signal?.aborted) return null;
    const query = input.query;
    if (!query) return null;

    try {
      const searchRes = await fetchJson<SearchPayload>(
        ctx.apiBase + "/api/kugou/search?keywords=" + keywordOf(query) + "&limit=10",
        { timeoutMs: 3500, signal: ctx.signal, headers: ctx.headers("kugou") }
      );
      if (searchRes.status === 401) {
        ctx.onUnauthorized("kugou");
        return null;
      }
      if (!searchRes.ok) return null;

      const best = bestMatch(searchRes.data?.songs ?? [], ctx, query.title, query.artist, 60);
      if (!best?.id) return null;

      const urlRes = await fetchJson<UrlPayload>(
        ctx.apiBase +
          "/api/kugou/song/url?hash=" +
          best.id +
          "&title=" +
          encodeURIComponent(query.title) +
          "&artist=" +
          encodeURIComponent(query.artist || "") +
          "&quality=lossless",
        { timeoutMs: 3500, signal: ctx.signal, headers: ctx.headers("kugou") }
      );
      if (urlRes.status === 401) {
        ctx.onUnauthorized("kugou");
        return null;
      }
      if (!urlRes.ok || !urlRes.data?.url) return null;

      return {
        url: urlRes.data.url,
        source: "kugou",
        quality: "lossless",
        format: "mp3",
        bitrate: 320000,
        isTrial: false,
        name: "酷狗音乐 (高解析母带)",
      };
    } catch {
      return null;
    }
  },
};

function kuwoStream(url: string, name: string): ResolvedAudioSource {
  return {
    url,
    source: "kuwo",
    quality: "lossless",
    format: "mp3",
    bitrate: 320000,
    isTrial: false,
    name,
  };
}

export const kuwoPlugin: ResolverPlugin = {
  id: "kuwo",
  label: "酷我音乐",
  aliases: ["kw"],
  canHandle(input) {
    const source = sourceOf(input);
    return !source || source === "kuwo" || source === "kw";
  },
  async resolve(input, ctx) {
    if (!ctx.isLoggedIn("kuwo")) return null;
    if (ctx.signal?.aborted) return null;

    const query = input.query;
    // 1. 已有明确酷我 RID 时直连转换母带 URL（判定用 query.source，与迁移前一致）
    const explicitId = input.id ?? query?.id;
    const songSource = (query?.source ?? "").toLowerCase();
    if (explicitId && (songSource === "kuwo" || !songSource)) {
      try {
        const rid = String(explicitId).replace("MUSIC_", "").trim();
        if (/^\d+$/.test(rid)) {
          const directRes = await fetchText(
            "http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=" +
              rid +
              "&format=mp3&response=url",
            { timeoutMs: 3000, signal: ctx.signal, headers: ctx.headers("kuwo") }
          );
          if (directRes.ok && directRes.data) {
            const streamUrl = directRes.data.trim();
            if (streamUrl.startsWith("http")) {
              return kuwoStream(streamUrl, "酷我音乐 (高解析母带直通流)");
            }
          }
        }
      } catch {
        // 直连失败回落关键词搜索
      }
    }

    // 2. 关键词智能匹配
    if (!query?.title) return null;
    try {
      const searchRes = await fetchJson<SearchPayload>(
        ctx.apiBase + "/api/kuwo/search?keywords=" + keywordOf(query) + "&limit=15",
        { timeoutMs: 3500, signal: ctx.signal, headers: ctx.headers("kuwo") }
      );
      if (searchRes.status === 401) {
        ctx.onUnauthorized("kuwo");
        return null;
      }
      if (!searchRes.ok) return null;

      const best = bestMatch(searchRes.data?.songs ?? [], ctx, query.title, query.artist, 70);
      if (!best?.id) return null;

      const rid = best.id.replace("MUSIC_", "");
      const urlRes = await fetchText(
        "http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=" + rid + "&format=mp3&response=url",
        { timeoutMs: 3000, signal: ctx.signal, headers: ctx.headers("kuwo") }
      );
      if (!urlRes.ok || !urlRes.data) return null;
      const streamUrl = urlRes.data.trim();
      if (!streamUrl.startsWith("http")) return null;
      return kuwoStream(streamUrl, "酷我音乐 (全网高解析母带)");
    } catch {
      return null;
    }
  },
};

export const qishuiPlugin: ResolverPlugin = {
  id: "qishui",
  label: "汽水音乐",
  canHandle(input) {
    const source = sourceOf(input);
    return !source || source === "qishui";
  },
  async resolve(input, ctx) {
    if (!ctx.isLoggedIn("qishui")) return null;
    if (ctx.signal?.aborted) return null;
    const query = input.query;
    if (!query) return null;

    try {
      const searchRes = await fetchJson<SearchPayload>(
        ctx.apiBase + "/api/qishui/search?keywords=" + keywordOf(query) + "&limit=10",
        { timeoutMs: 3500, signal: ctx.signal, headers: ctx.headers("qishui") }
      );
      if (searchRes.status === 401) {
        ctx.onUnauthorized("qishui");
        return null;
      }
      if (!searchRes.ok) return null;

      const best = bestMatch(searchRes.data?.songs ?? [], ctx, query.title, query.artist, 60);
      if (!best?.id) return null;

      const urlRes = await fetchJson<UrlPayload>(
        ctx.apiBase + "/api/qishui/song/url?id=" + best.id,
        { timeoutMs: 3500, signal: ctx.signal, headers: ctx.headers("qishui") }
      );
      if (!urlRes.ok || !urlRes.data?.url) return null;

      return {
        url: urlRes.data.url,
        source: "qishui",
        quality: "lossless",
        format: "m4a",
        bitrate: 256000,
        isTrial: false,
        name: "汽水音乐 (SpadeKey 实时解密源)",
      };
    } catch {
      return null;
    }
  },
};

/** 注册顺序 = 平台竞速顺序（netease → qq → kugou → kuwo → qishui）。 */
export const platformPlugins: ResolverPlugin[] = [
  neteasePlugin,
  qqPlugin,
  kugouPlugin,
  kuwoPlugin,
  qishuiPlugin,
];
