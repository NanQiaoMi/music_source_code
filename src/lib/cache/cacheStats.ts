import { audioPrefetcher } from "@/lib/audio/audioPrefetcher";
import { MultiSourceResolver } from "@/services/MultiSourceResolver";
import type { TtlLruCacheStats } from "./TtlLruCache";

/** 单个缓存的只读指标：计数器 + 当前存活条目数。 */
export type CacheStatBlock = TtlLruCacheStats & { size: number };

/** 三处内存缓存的聚合快照。 */
export interface CacheStatsSnapshot {
  resolvedUrl: CacheStatBlock;
  prefetch: CacheStatBlock;
  search: CacheStatBlock;
}

const CACHE_STATS_KEY = "__MIMI_CACHE_STATS__";

function isDevBrowser(): boolean {
  // 生产构建里 process.env.NODE_ENV 被静态替换，整段探针代码可被 DCE 掉。
  return process.env.NODE_ENV === "development" && typeof window !== "undefined";
}

/** 按需聚合，不启动定时器；只有读取探针时才会调用各缓存的 stats()。 */
export function getCacheStats(): CacheStatsSnapshot {
  return {
    resolvedUrl: MultiSourceResolver.getResolvedUrlCacheStats(),
    prefetch: audioPrefetcher.getPrefetchCacheStats(),
    search: MultiSourceResolver.getSearchCacheStats(),
  };
}

/**
 * 开发环境挂载 window.__MIMI_CACHE_STATS__ 惰性 getter。
 * SSR / 生产环境直接 no-op，不产生任何全局副作用。
 */
export function installCacheStatsProbe(): boolean {
  if (!isDevBrowser()) return false;
  Object.defineProperty(window, CACHE_STATS_KEY, {
    configurable: true,
    enumerable: false,
    get: getCacheStats,
  });
  return true;
}

export function uninstallCacheStatsProbe(): void {
  if (typeof window === "undefined") return;
  delete window.__MIMI_CACHE_STATS__;
}

declare global {
  interface Window {
    /** 仅开发环境存在；每次读取都会重新聚合（供 DevTools 采样）。 */
    __MIMI_CACHE_STATS__?: CacheStatsSnapshot;
  }
}
