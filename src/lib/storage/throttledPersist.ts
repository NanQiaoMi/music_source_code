/**
 * Throttled persistence for high-frequency stores (S2-2).
 *
 * 播放进度（currentTime）过去在每次 store 更新时都会触发一次 localStorage 写盘：
 * 媒体桥按 250ms 节流写 store，playerStore 与 audioStore 两个 key 因此合计约
 * 8 次/秒写盘。本模块把节流下沉到 **存储层**：内存中的 state 更新完全不变
 * （UI 依旧 4Hz 平滑刷新），只有真正的写盘被合并为每 key 最多 1 次/间隔，
 * 且总是落盘"最后一次"的值。这样既满足写盘 <=1 次/秒，又不牺牲进度显示。
 *
 * 语义：
 * - leading：距上次写盘已超过间隔时立即写（首次写盘同步落盘）。
 * - trailing：间隔内的写入只记录最新值，并在窗口结束时落盘一次。
 * - flush()：同步落盘挂起值，用于 pause/ended（mediaBridge）与 pagehide（bootstrap）。
 * - 组合顺序：throttled(outer) -> createSafeStorage(inner)，配额降级仍由 S1-3 负责。
 */
import type { StateStorage } from "zustand/middleware";
import { createSafeStorage } from "./safeStorage";

/** 默认 2000ms：每个 key 最多 0.5 次/秒，两个播放 key 合计 <=1 次/秒。 */
export const DEFAULT_MIN_WRITE_INTERVAL_MS = 2000;

export interface ThrottledStorageOptions {
  /** 两次真实写盘的最小间隔（毫秒）；默认 {@link DEFAULT_MIN_WRITE_INTERVAL_MS}。 */
  minWriteIntervalMs?: number;
  /** 底层存储；默认是带配额降级（S1-3）的 createSafeStorage(key)。 */
  base?: StateStorage;
}

export interface ThrottledStateStorage extends StateStorage {
  /** 立即同步落盘挂起值（无挂起值时为 no-op）。 */
  flush: () => void;
  /** 是否存在等待 trailing 写盘的新值。 */
  hasPendingWrite: () => boolean;
  /** 丢弃挂起值/定时器并移出全局 flush 列表（测试与 HMR 用）。 */
  dispose: () => void;
}

interface PendingWrite {
  name: string;
  value: string;
}

const registry = new Set<ThrottledStateStorage>();

export function createThrottledStorage(
  key: string,
  options: ThrottledStorageOptions = {}
): ThrottledStateStorage {
  const minWriteIntervalMs = Math.max(
    0,
    options.minWriteIntervalMs ?? DEFAULT_MIN_WRITE_INTERVAL_MS
  );
  const base = options.base ?? createSafeStorage(key);

  let lastWriteAt = Number.NEGATIVE_INFINITY;
  let pending: PendingWrite | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const writeNow = (name: string, value: string): void => {
    lastWriteAt = Date.now();
    try {
      base.setItem(name, value);
    } catch {
      // 底层存储（safeStorage）负责配额降级与上报（S1-3），节流层不重复处理。
    }
  };

  const flush = (): void => {
    clearTimer();
    const next = pending;
    pending = null;
    if (next) writeNow(next.name, next.value);
  };

  const storage: ThrottledStateStorage = {
    getItem: (name) => base.getItem(name),
    setItem: (name, value) => {
      const elapsed = Date.now() - lastWriteAt;
      if (elapsed >= minWriteIntervalMs) {
        pending = null;
        clearTimer();
        writeNow(name, value);
        return;
      }
      pending = { name, value };
      if (timer === null) timer = setTimeout(flush, minWriteIntervalMs - elapsed);
    },
    removeItem: (name) => {
      pending = null;
      clearTimer();
      base.removeItem(name);
    },
    flush,
    hasPendingWrite: () => pending !== null,
    dispose: () => {
      pending = null;
      clearTimer();
      registry.delete(storage);
    },
  };

  registry.add(storage);
  return storage;
}

/** 同步落盘所有已注册 key 的挂起值（单个 key 失败不阻塞其它 key）。 */
export function flushAllThrottledStorages(): void {
  for (const storage of Array.from(registry)) {
    try {
      storage.flush();
    } catch {
      // 单个存储失败不能阻塞其它 key 的收尾写盘。
    }
  }
}

let removeLifecycleListeners: (() => void) | null = null;

/**
 * pagehide / beforeunload / visibilitychange(hidden) 时补写全部挂起值。
 * 幂等：重复调用返回同一个清理函数；SSR 环境下为 no-op。
 */
export function installFlushOnPageHide(): () => void {
  if (removeLifecycleListeners) return removeLifecycleListeners;
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const flushAll = (): void => flushAllThrottledStorages();
  const onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") flushAll();
  };

  window.addEventListener("pagehide", flushAll);
  window.addEventListener("beforeunload", flushAll);
  document.addEventListener("visibilitychange", onVisibilityChange);

  removeLifecycleListeners = () => {
    window.removeEventListener("pagehide", flushAll);
    window.removeEventListener("beforeunload", flushAll);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    removeLifecycleListeners = null;
  };

  return removeLifecycleListeners;
}
