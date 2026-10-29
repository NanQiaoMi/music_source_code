import type { Song } from "@/types/song";

/**
 * @deprecated since S1-5. Read-only mirror of queueStore; owner = queueStore.
 * Navigation must use advanceQueue / queueStore. Removal: S6-5.
 *
 * 单独成文件：types.ts 已冻结在 store 行数棘轮基线（S6-12），兼容层文档不挤占预算；
 * audioStore 只做单向投影，写入一律委托 queueStore（见 audioStore 底部订阅）。
 */
export interface LegacyQueueCompatibilityState {
  /** @deprecated Read-only projection; write via queueStore.setQueue. */
  queue: Song[];
  /** @deprecated Read-only projection; write via queueStore.setCurrentIndex. */
  currentIndex: number;
  /** @deprecated Compatibility facade; forwards to queueStore.setQueue. */
  setQueue: (songs: Song[]) => void;
  /** @deprecated Compatibility facade; forwards to queueStore.setCurrentIndex. */
  setCurrentIndex: (index: number) => void;
}
