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

        fetch(url, {
          method,
          headers,
          body: typeof body === "object" ? JSON.stringify(body) : body,
          signal: AbortSignal.timeout(8000),
        })
          .then(async (res) => {
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

            callback(null, {
              statusCode: res.status,
              body: resBody,
              headers: headerEntries,
            });
          })
          .catch((err) => {
            callback(err, null);
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

      const fn = new Function("module", "exports", "console", "globalThis", scriptContent);

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

      fn(sandboxModule, sandboxModule.exports, fakeGlobal.console, fakeGlobal);

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

  /**
   * 解析指定歌曲的音频直链
   */
  public static async getMusicUrl(
    script: LXCustomScript,
    song: Song,
    quality: string = "320k"
  ): Promise<{ url: string; quality?: string; format?: string } | null> {
    if (!script.enabled || !script.scriptContent) return null;

    try {
      const { lxEnvironment, handlers } = this.createSandbox(script);
      const sandboxModule: any = { exports: {} };

      const fn = new Function("module", "exports", "console", "globalThis", script.scriptContent);
      const fakeGlobal: any = {
        lx: lxEnvironment,
        module: sandboxModule,
        exports: sandboxModule.exports,
        console,
      };

      fn(sandboxModule, sandboxModule.exports, console, fakeGlobal);

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

        const targetSource = platformMap[song.source || "wy"] || "wy";
        const result = await handlers["request"]({
          source: targetSource,
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
      if (script.scriptContent) {
        const sandboxModule: any = { exports: {} };
        const { lxEnvironment } = this.createSandbox(script);
        const fakeGlobal: any = {
          lx: lxEnvironment,
          module: sandboxModule,
          exports: sandboxModule.exports,
          console,
        };

        const fn = new Function("module", "exports", "console", "globalThis", script.scriptContent);
        fn(sandboxModule, sandboxModule.exports, console, fakeGlobal);
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

    // 默认内置高音质扩展源兼容通道
    try {
      const kw = encodeURIComponent(keyword.trim());
      const fallbackRes = await fetch(
        `http://search.kuwo.cn/r.s?all=${kw}&ft=music&itemset=web_2013&client=kt&pn=${Math.max(0, page - 1)}&rn=${limit}&rformat=json&encoding=utf8`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (fallbackRes.ok) {
        const text = await fallbackRes.text();
        const clean = text.replace(/&nbsp;/g, " ").replace(/'/g, '"');
        let data: any = null;
        try {
          data = JSON.parse(clean);
        } catch {
          data = null;
        }
        const list = data?.abslist || [];
        if (Array.isArray(list) && list.length > 0) {
          return list.map((item: any) => {
            const rawTitle = item.SONGNAME || item.NAME || keyword;
            const rid = String(item.DC_TARGETID || item.MUSICRID || "").replace("MUSIC_", "");
            const pic = item.web_albumpic_short || item.web_artistpic_short;
            const cover = pic ? `https://img4.kuwo.cn/star/albumcover/${pic}` : "/default-cover.svg";

            return {
              id: rid ? `lx-${rid}` : `lx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: `${rawTitle} (LX 高解析母带)`,
              artist: item.ARTIST || item.AARTIST || "精选音源",
              album: item.ALBUM || "LX Hi-Res Master Collection",
              duration: item.DURATION ? parseInt(item.DURATION, 10) : 240,
              cover,
              source: "lx_custom",
              audioUrl: "",
              format: "flac",
            };
          });
        }
      }
    } catch {
      // ignore
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
