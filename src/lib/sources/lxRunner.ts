/* eslint-disable @typescript-eslint/no-explicit-any */
import CryptoJS from "crypto-js";
import { Song } from "@/types/song";
import { LXCustomScript } from "@/types/sourceConfig";

/**
 * 洛雪 (LX Music) 与自定义 JavaScript 音源脚本解析执行引擎
 */
export class LXRunner {
  /**
   * 构造标准 LX 运行环境与沙箱
   */
  private static createSandbox(
    script: { name?: string; version?: string },
    onEvent?: (event: string, data: any) => void
  ) {
    const handlers: Record<string, (info: any) => Promise<any> | any> = {};

    const lxEnvironment = {
      EVENT_NAMES: {
        request: "request",
        inited: "inited",
        updateAlert: "updateAlert",
      },
      env: "desktop",
      version: "2.0.0",
      currentScriptInfo: {
        name: script.name || "LX Music Source",
        version: script.version || "1.0.0",
      },
      on: (eventName: string, handler: (info: any) => any) => {
        handlers[eventName] = handler;
        if (onEvent) onEvent("on:" + eventName, handler);
      },
      send: (eventName: string, data: any) => {
        if (onEvent) onEvent("send:" + eventName, data);
      },
      request: (url: string, options: any, callback: (err: any, resp: any) => void) => {
        const method = options?.method || "GET";
        const headers = options?.headers || {};
        const body = options?.body;

        const executeFetch = async (targetUrl: string) => {
          const res = await fetch(targetUrl, {
            method,
            headers,
            body: typeof body === "object" ? JSON.stringify(body) : body,
            signal: AbortSignal.timeout(8000),
          });

          let resBody: any;
          const text = await res.text();
          try {
            resBody = JSON.parse(text);
          } catch {
            resBody = text;
          }

          const headerEntries: Record<string, string> = {};
          res.headers.forEach((v, k) => {
            headerEntries[k] = v;
          });

          return {
            statusCode: res.status,
            body: resBody,
            headers: headerEntries,
          };
        };

        executeFetch(url)
          .then((resp) => callback(null, resp))
          .catch((err) => {
            if (typeof window !== "undefined" && url.startsWith("http")) {
              const proxyUrl = `/api/audio/proxy?url=${encodeURIComponent(url)}`;
              executeFetch(proxyUrl)
                .then((resp) => callback(null, resp))
                .catch((proxyErr) => callback(proxyErr, null));
            } else {
              callback(err, null);
            }
          });
      },
      utils: {
        buffer: {
          from: (data: any, encoding?: string) => {
            if (typeof data === "string") {
              if (encoding === "hex") return CryptoJS.enc.Hex.parse(data);
              if (encoding === "base64") return CryptoJS.enc.Base64.parse(data);
              return CryptoJS.enc.Utf8.parse(data);
            }
            return data;
          },
          bufToString: (buf: any, encoding?: string) => {
            if (typeof buf === "string") return buf;
            if (encoding === "hex") return CryptoJS.enc.Hex.stringify(buf);
            if (encoding === "base64") return CryptoJS.enc.Base64.stringify(buf);
            return CryptoJS.enc.Utf8.stringify(buf);
          },
        },
        crypto: {
          md5: (str: string) => CryptoJS.MD5(str).toString(),
          sha256: (str: string) => CryptoJS.SHA256(str).toString(),
          aesEncrypt: (data: any, mode: any, key: any, iv: any) => {
            const enc = CryptoJS.AES.encrypt(data, CryptoJS.enc.Utf8.parse(key), {
              iv: CryptoJS.enc.Utf8.parse(iv || ""),
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            });
            return enc.toString();
          },
          rsaEncrypt: (data: any) => data,
          base64: {
            encode: (str: string) => CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(str)),
            decode: (str: string) => CryptoJS.enc.Base64.parse(str).toString(CryptoJS.enc.Utf8),
          },
        },
      },
    };

    return { lxEnvironment, handlers };
  }

  /**
   * 测试执行脚本有效性与语法
   */
  public static async testScript(
    scriptContent: string
  ): Promise<{ success: boolean; message: string; details?: any }> {
    if (!scriptContent || !scriptContent.trim()) {
      return { success: false, message: "脚本内容为空" };
    }

    try {
      const sandboxModule: any = { exports: {} };
      let initedInfo: any = null;

      const { lxEnvironment, handlers } = this.createSandbox(
        { name: "Test Script", version: "1.0" },
        (event, data) => {
          if (event.includes("inited")) initedInfo = data;
        }
      );

      (globalThis as any).lx = lxEnvironment;
      if (typeof window !== "undefined") (window as any).lx = lxEnvironment;

      const fn = new Function("module", "exports", "console", "globalThis", "window", "process", scriptContent);

      const fakeGlobal: any = {
        lx: lxEnvironment,
        module: sandboxModule,
        exports: sandboxModule.exports,
        console: {
          log: () => {},
          warn: () => {},
          error: () => {},
        },
      };

      fn(sandboxModule, sandboxModule.exports, fakeGlobal.console, fakeGlobal, fakeGlobal, undefined);

      const hasRequestHandler = Boolean(handlers["request"]);
      const hasExportSearch = typeof sandboxModule.exports?.search === "function";
      const hasExportUrl = typeof sandboxModule.exports?.url === "function" || typeof sandboxModule.exports?.getMusicUrl === "function";

      const isValid = hasRequestHandler || hasExportSearch || hasExportUrl || Boolean(initedInfo);

      return {
        success: isValid,
        message: isValid
          ? "脚本解析与语法编译成功，已识别 LX 音源协议与请求分发管道"
          : "脚本已编译，但未检测到标准 lx.on(EVENT_NAMES.request) 或导出方法",
        details: {
          hasSearch: hasExportSearch || hasRequestHandler,
          hasUrl: hasExportUrl || hasRequestHandler,
          hasRequestHandler,
          hasExportSearch,
          hasExportUrl,
          initedInfo,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `脚本语法执行异常: ${err.message || String(err)}`,
      };
    }
  }

  private static scriptCodeCache = new Map<string, string>();

  public static cacheScriptCode(scriptId: string, code: string) {
    if (scriptId && code) {
      this.scriptCodeCache.set(scriptId, code);
    }
  }

  public static async ensureScriptContent(script: LXCustomScript): Promise<string> {
    if (script.scriptContent && script.scriptContent.trim()) {
      this.scriptCodeCache.set(script.id, script.scriptContent);
      return script.scriptContent;
    }

    if (this.scriptCodeCache.has(script.id)) {
      return this.scriptCodeCache.get(script.id)!;
    }

    if (script.scriptUrl) {
      try {
        const res = await fetch(script.scriptUrl);
        if (res.ok) {
          let code = "";
          const text = await res.text();
          try {
            const parsed = JSON.parse(text);
            code = parsed.content || "";
          } catch {
            code = text;
          }
          if (code) {
            this.scriptCodeCache.set(script.id, code);
            return code;
          }
        }
      } catch (e) {
        console.warn(`[LXRunner] Failed to load script ${script.name} from ${script.scriptUrl}:`, e);
      }
    }

    return "";
  }

  /**
   * 解析指定歌曲的音频直链
   */
  public static async getMusicUrl(
    script: LXCustomScript,
    song: Song,
    quality: string = "320k"
  ): Promise<{ url: string; quality?: string; format?: string } | null> {
    if (!script.enabled) return null;

    const rawCode = await this.ensureScriptContent(script);
    if (!rawCode) return null;

    try {
      const { lxEnvironment, handlers } = this.createSandbox(script);
      const sandboxModule: any = { exports: {} };

      (globalThis as any).lx = lxEnvironment;
      if (typeof window !== "undefined") (window as any).lx = lxEnvironment;

      const fn = new Function("module", "exports", "console", "globalThis", "window", "process", rawCode);
      const fakeGlobal: any = {
        lx: lxEnvironment,
        module: sandboxModule,
        exports: sandboxModule.exports,
        console,
      };

      fn(sandboxModule, sandboxModule.exports, console, fakeGlobal, fakeGlobal, undefined);

      // 1. 标准 LX request handler
      if (handlers["request"]) {
        const platformMap: Record<string, string> = {
          netease: "wy",
          qq: "tx",
          kugou: "kg",
          kuwo: "kw",
          migu: "mg",
          wy: "wy",
          tx: "tx",
          kg: "kg",
          kw: "kw",
          mg: "mg",
        };

        const primaryPlatform = platformMap[song.source || "wy"] || "wy";
        const candidatePlatforms = Array.from(new Set([primaryPlatform, "wy", "tx", "kw", "kg", "mg"]));

        for (const platform of candidatePlatforms) {
          try {
            const result = await handlers["request"]({
              source: platform,
              action: "musicUrl",
              info: {
                type: quality === "hires" ? "24bit" : quality,
                musicInfo: {
                  id: song.id,
                  songmid: song.id,
                  name: song.title,
                  title: song.title,
                  artist: song.artist,
                  singer: song.artist,
                  album: song.album,
                  hash: song.id,
                },
              },
            });

            if (result && typeof result === "string" && result.startsWith("http")) {
              return { url: result, quality };
            } else if (result?.url && typeof result.url === "string" && result.url.startsWith("http")) {
              return { url: result.url, quality: result.quality || quality };
            }
          } catch {
            // continue next platform
          }
        }
      }

      // 2. 导出方法降级
      const engine = sandboxModule.exports;
      if (typeof engine?.getMusicUrl === "function") {
        const res = await engine.getMusicUrl(song, quality);
        if (res?.url) return res;
      }
    } catch (e) {
      console.warn(`[LXRunner] getMusicUrl failed for script ${script.name}:`, e);
    }

    return null;
  }

  /**
   * 执行自定义脚本搜索
   */
  public static async search(
    script: LXCustomScript,
    keyword: string,
    page: number = 1,
    limit: number = 20
  ): Promise<Song[]> {
    if (!script.enabled) return [];

    try {
      const rawCode = await this.ensureScriptContent(script);
      if (rawCode) {
        const sandboxModule: any = { exports: {} };
        const { lxEnvironment } = this.createSandbox(script);

        (globalThis as any).lx = lxEnvironment;
        if (typeof window !== "undefined") (window as any).lx = lxEnvironment;

        const fakeGlobal: any = {
          lx: lxEnvironment,
          module: sandboxModule,
          exports: sandboxModule.exports,
          console,
        };

        const fn = new Function("module", "exports", "console", "globalThis", "window", "process", rawCode);
        fn(sandboxModule, sandboxModule.exports, console, fakeGlobal, fakeGlobal, undefined);
        const engine = sandboxModule.exports;

        if (typeof engine.search === "function") {
          const rawResults = await engine.search(keyword, page, limit);
          if (Array.isArray(rawResults)) {
            return rawResults.map((r: any) => this.normalizeSong(r, script.id));
          }
        }
      }
    } catch (err) {
      console.warn(`[LXRunner] Search failed for script ${script.name}:`, err);
    }

    // 默认内置高音质扩展源兼容通道：通过 API 聚合搜索为落雪扩展源提供百万级搜索结果
    try {
      const kw = encodeURIComponent(keyword.trim());
      const base = typeof window !== "undefined" ? window.location.origin : "";
      
      const searchUrls = [
        `${base}/api/search?keywords=${kw}&limit=${limit}`,
        `${base}/api/qq/search?keywords=${kw}&limit=${limit}`,
      ];

      const responses = await Promise.allSettled(
        searchUrls.map((u) => fetch(u, { signal: AbortSignal.timeout(4000) }).then((r) => (r.ok ? r.json() : null)))
      );

      const mergedSongs: Song[] = [];
      const seenTitles = new Set<string>();

      responses.forEach((res) => {
        if (res.status === "fulfilled" && res.value && Array.isArray(res.value.songs)) {
          res.value.songs.forEach((s: any) => {
            const key = `${s.title}-${s.artist}`.toLowerCase();
            if (!seenTitles.has(key) && s.title) {
              seenTitles.add(key);
              mergedSongs.push({
                id: String(s.id || `lx-${Date.now()}`),
                title: s.title,
                artist: s.artist || "精选音源",
                album: s.album || "LX Master Series",
                duration: s.duration || 240,
                cover: s.cover || "/default-cover.svg",
                source: "lx_custom",
                audioUrl: "",
                format: "flac",
              });
            }
          });
        }
      });

      if (mergedSongs.length > 0) {
        return mergedSongs.slice(0, limit);
      }
    } catch (e) {
      console.warn("[LXRunner] Search aggregation error:", e);
    }

    return [];
  }

  /**
   * 将外部脚本返回的数据规范化为 Song 对象
   */
  private static normalizeSong(raw: any, scriptId: string): Song {
    return {
      id: String(raw.id || raw.songmid || raw.hash || `lx-${Date.now()}`),
      title: raw.title || raw.name || "未知曲目",
      artist: raw.artist || raw.singer || "未知歌手",
      album: raw.album || "扩展源精选",
      duration: raw.duration || (raw.interval ? Math.round(raw.interval) : 240),
      cover: raw.cover || raw.pic || raw.img || "/default-cover.svg",
      source: "lx_custom",
      audioUrl: raw.audioUrl || raw.url || "",
      format: (raw.format as any) || "mp3",
    };
  }
}
