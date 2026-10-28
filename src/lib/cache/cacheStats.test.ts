import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  resolved: { hits: 1, misses: 2, evictions: 3, hitRate: 1 / 3, size: 4 },
  prefetch: { hits: 5, misses: 6, evictions: 7, hitRate: 5 / 11, size: 8 },
  search: { hits: 9, misses: 10, evictions: 11, hitRate: 9 / 19, size: 12 },
}));

vi.mock("@/services/MultiSourceResolver", () => ({
  MultiSourceResolver: {
    getResolvedUrlCacheStats: () => ({ ...h.resolved }),
    getSearchCacheStats: () => ({ ...h.search }),
  },
}));
vi.mock("@/lib/audio/audioPrefetcher", () => ({
  audioPrefetcher: { getPrefetchCacheStats: () => ({ ...h.prefetch }) },
}));

import { getCacheStats, installCacheStatsProbe, uninstallCacheStatsProbe } from "./cacheStats";

describe("cacheStats", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    uninstallCacheStatsProbe();
  });

  afterEach(() => {
    uninstallCacheStatsProbe();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("aggregates resolver, prefetch and search cache stats", () => {
    expect(getCacheStats()).toEqual({
      resolvedUrl: h.resolved,
      prefetch: h.prefetch,
      search: h.search,
    });
  });

  it("exposes a lazy getter that re-aggregates on every read", () => {
    expect(installCacheStatsProbe()).toBe(true);
    expect(window.__MIMI_CACHE_STATS__?.search).toEqual(h.search);

    h.search = { ...h.search, size: 77, hits: 70 };
    expect(window.__MIMI_CACHE_STATS__?.search.size).toBe(77);
    expect(window.__MIMI_CACHE_STATS__?.search.hits).toBe(70);
  });

  it("no-ops on the server where window is unavailable", () => {
    vi.stubGlobal("window", undefined);

    expect(installCacheStatsProbe()).toBe(false);
    expect(() => uninstallCacheStatsProbe()).not.toThrow();
    // 纯聚合函数不依赖 window，SSR 下仍可被采样脚本直接调用
    expect(getCacheStats().prefetch.size).toBe(8);
  });

  it("does not install outside the development environment", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(installCacheStatsProbe()).toBe(false);
    expect(window.__MIMI_CACHE_STATS__).toBeUndefined();
  });
});
