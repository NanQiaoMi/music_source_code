import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 可变的依赖桩：resolutionMode / 登录态 / 洛雪脚本，各用例按需改写
const h = vi.hoisted(() => ({
  config: {
    resolutionMode: "hybrid_racing" as string,
    lxScripts: [] as { id: string; name: string; enabled: boolean; scriptContent: string }[],
    sources: {
      netease: { enabled: true },
      qq: { enabled: true },
      kugou: { enabled: false },
      kuwo: { enabled: false },
      qishui: { enabled: false },
      lx_custom: { enabled: false },
    },
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
  LXRunner: { getMusicUrl: vi.fn(), search: vi.fn() },
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
  vi.mocked(LXRunner.search).mockReset();
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

  it("长会话下解析缓存不超过 300 条", async () => {
    (LXRunner.getMusicUrl as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    installFetchMock([
      { match: "/api/song/url", delayMs: 0, body: { url: "http://fallback.example/bounded.mp3" } },
    ]);

    for (let i = 0; i < 305; i += 1) {
      await resolver.resolvePlayableAudio(
        { title: `bounded-${i}`, artist: "测试", source: "netease" },
        false
      );
    }

    const stats = MultiSourceResolver.getResolvedUrlCacheStats();
    expect(stats.size).toBe(300);
    expect(stats.evictions).toBeGreaterThanOrEqual(5);
  }, 15000);
});

describe("MultiSourceResolver.searchOnlineMusicSegmented provider failures", () => {
  beforeEach(() => {
    h.loggedIn = true;
    h.config.lxScripts = [];
    h.config.sources = {
      netease: { enabled: true },
      qq: { enabled: true },
      kugou: { enabled: false },
      kuwo: { enabled: false },
      qishui: { enabled: false },
      lx_custom: { enabled: false },
    };
  });

  it("reports failure when every attempted provider request fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/search?")) throw new Error("network unavailable");
      return { ok: false, status: 503, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolver.searchOnlineMusicSegmented("all-providers-fail-2026")).rejects.toThrow(
      /all enabled music search providers failed/i
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps an empty result when at least one provider succeeds without matches", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/search?")) throw new Error("network unavailable");
      return { ok: true, status: 200, json: async () => ({ songs: [] }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolver.searchOnlineMusicSegmented("partial-success-empty-2026");

    expect(result.all).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves the empty result when no provider is available to attempt", async () => {
    h.loggedIn = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolver.searchOnlineMusicSegmented("no-provider-available-2026");

    expect(result.all).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts a successful empty LX script result as a successful provider", async () => {
    h.loggedIn = false;
    h.config.lxScripts = [LX_SCRIPT];
    h.config.sources = {
      netease: { enabled: false },
      qq: { enabled: false },
      kugou: { enabled: false },
      kuwo: { enabled: false },
      qishui: { enabled: false },
      lx_custom: { enabled: true },
    };
    vi.mocked(LXRunner.search).mockResolvedValue([]);

    const result = await resolver.searchOnlineMusicSegmented("lx-empty-success-2026");

    expect(result.all).toEqual([]);
    expect(LXRunner.search).toHaveBeenCalledTimes(1);
  });

  it("reports failure when the only enabled LX provider fails", async () => {
    h.loggedIn = false;
    h.config.lxScripts = [LX_SCRIPT];
    h.config.sources = {
      netease: { enabled: false },
      qq: { enabled: false },
      kugou: { enabled: false },
      kuwo: { enabled: false },
      qishui: { enabled: false },
      lx_custom: { enabled: true },
    };
    vi.mocked(LXRunner.search).mockRejectedValue(new Error("script and fallback failed"));

    await expect(resolver.searchOnlineMusicSegmented("lx-provider-fails-2026")).rejects.toThrow(
      /all enabled music search providers failed/i
    );
  });

  it("长会话下搜索缓存不超过 100 条", async () => {
    h.config.sources.qq.enabled = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const keyword = decodeURIComponent(String(input).match(/keywords=([^&]+)/)?.[1] ?? "");
      return {
        ok: true,
        status: 200,
        json: async () => ({ songs: [{ id: keyword, name: `song-${keyword}` }] }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < 105; i += 1) {
      await resolver.searchOnlineMusicSegmented(`bounded-search-${i}`);
    }

    const stats = MultiSourceResolver.getSearchCacheStats();
    expect(stats.size).toBe(100);
    expect(stats.evictions).toBeGreaterThanOrEqual(5);
  }, 15000);

  it("搜索缓存 20 分钟内命中，到期后重新请求", async () => {
    h.config.sources.qq.enabled = false;
    let now = 1_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ songs: [{ id: "ttl", name: "ttl-song" }] }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const keyword = "ttl-search-2026";
    await resolver.searchOnlineMusicSegmented(keyword);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now += 20 * 60_000 - 1; // 19:59.999，仍命中
    await resolver.searchOnlineMusicSegmented(keyword);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now += 1; // 恰好到期
    await resolver.searchOnlineMusicSegmented(keyword);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  }, 15000);
});
