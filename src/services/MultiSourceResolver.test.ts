import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 可变的依赖桩：resolutionMode / 登录态 / 洛雪脚本，各用例按需改写
const h = vi.hoisted(() => ({
  config: {
    resolutionMode: "hybrid_racing" as string,
    lxScripts: [] as { id: string; name: string; enabled: boolean; scriptContent: string }[],
  },
  loggedIn: false,
}));

vi.mock("@/store/sourceConfigStore", () => ({
  useSourceConfigStore: { getState: () => h.config },
}));

vi.mock("@/store/userAccountStore", () => ({
  isPlatformLoggedIn: () => h.loggedIn,
  PlatformType: {},
  useUserAccountStore: {
    getState: () => ({
      getPlatformCookie: () => null,
      handlePlatformSessionExpired: () => {},
    }),
  },
}));

vi.mock("@/store/audioSourceStore", () => ({ AudioSourceType: {} }));

vi.mock("@/lib/sources/lxRunner", () => ({
  LXRunner: { getMusicUrl: vi.fn() },
}));

import { MultiSourceResolver } from "./MultiSourceResolver";
import { LXRunner } from "@/lib/sources/lxRunner";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 记录 fetch 调用时间与目标，按 URL 前缀决定响应时机 */
function installFetchMock(routes: { match: string; delayMs: number; body?: unknown }[]) {
  const calls: { url: string; at: number }[] = [];
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push({ url, at: performance.now() });
    const route = routes.find((r) => url.includes(r.match));
    await sleep(route?.delayMs ?? 0);
    const body = route?.body ?? {};
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", mock);
  return { calls, mock };
}

const LX_SCRIPT = {
  id: "s1",
  name: "测试音源",
  enabled: true,
  scriptContent: "/* placeholder */",
};

const resolver = MultiSourceResolver.getInstance();

beforeEach(() => {
  MultiSourceResolver.clearCache();
  h.config.resolutionMode = "hybrid_racing";
  h.config.lxScripts = [LX_SCRIPT];
  h.loggedIn = false;
  (LXRunner.getMusicUrl as ReturnType<typeof vi.fn>).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MultiSourceResolver.resolvePlayableAudio 并发改造", () => {
  it("洛雪慢时兜底 /api/song/url 已在并发进行，不必等它跑完", async () => {
    // 洛雪要 5s（旧实现会先干等这 5s 才轮到兜底），兜底 120ms 就好了
    (LXRunner.getMusicUrl as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      await sleep(5000);
      return null;
    });
    const { calls } = installFetchMock([
      {
        match: "/api/song/url",
        delayMs: 120,
        body: {
          url: "http://fallback.example/a.mp3",
          source: "kuwo",
          level: "lossless",
          br: 320000,
        },
      },
    ]);

    const t0 = performance.now();
    const result = await resolver.resolvePlayableAudio(
      { title: "并发测试", artist: "测试", source: "netease" },
      true
    );
    const elapsed = performance.now() - t0;

    expect(result?.url).toBe("http://fallback.example/a.mp3");
    // 兜底必须在 t≈0 就发起，而不是等洛雪预算耗尽之后才开始
    const fallbackCall = calls.find((c) => c.url.includes("/api/song/url"));
    expect(fallbackCall).toBeDefined();
    expect(fallbackCall!.at - t0).toBeLessThan(50);
    // 旧实现：5000ms 洛雪 + 兜底耗时；现在被优先分支预算封顶
    expect(elapsed).toBeLessThan(3000);
  }, 15000);

  it("洛雪在预算内成功时优先于兜底（优先级与旧实现一致）", async () => {
    (LXRunner.getMusicUrl as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      await sleep(200);
      return { url: "http://lx.example/song.mp3" };
    });
    installFetchMock([
      { match: "/api/song/url", delayMs: 20, body: { url: "http://fallback.example/b.mp3" } },
    ]);

    const result = await resolver.resolvePlayableAudio(
      { title: "优先级测试", artist: "测试", source: "netease" },
      true
    );

    expect(result?.url).toBe("http://lx.example/song.mp3");
    expect(result?.source).toBe("lx_custom");
  }, 15000);

  it("lx_only 模式下不发起兜底请求", async () => {
    h.config.resolutionMode = "lx_only";
    (LXRunner.getMusicUrl as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { calls } = installFetchMock([
      { match: "/api/song/url", delayMs: 10, body: { url: "http://fallback.example/c.mp3" } },
    ]);

    const result = await resolver.resolvePlayableAudio(
      { title: "仅洛雪", artist: "测试", source: "netease" },
      true
    );

    expect(result).toBeNull();
    expect(calls.some((c) => c.url.includes("/api/song/url"))).toBe(false);
  }, 15000);

  it("洛雪与兜底都失败时返回 null，而不是抛出", async () => {
    (LXRunner.getMusicUrl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("script boom"));
    installFetchMock([{ match: "/api/song/url", delayMs: 5 }]); // body 默认 {}，无 url

    const result = await resolver.resolvePlayableAudio(
      { title: "全失败", artist: "测试", source: "netease" },
      true
    );

    expect(result).toBeNull();
  }, 15000);

  it("同一首歌重复解析命中缓存，不重复发起网络请求", async () => {
    (LXRunner.getMusicUrl as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { mock } = installFetchMock([
      { match: "/api/song/url", delayMs: 1, body: { url: "http://fallback.example/d.mp3" } },
    ]);

    const query = { title: "缓存测试", artist: "测试", source: "netease" };
    const first = await resolver.resolvePlayableAudio(query, false);
    const callsAfterFirst = mock.mock.calls.length;

    const second = await resolver.resolvePlayableAudio(query, false);
    expect(second?.url).toBe(first?.url);
    expect(mock.mock.calls.length).toBe(callsAfterFirst);
  }, 15000);
});
