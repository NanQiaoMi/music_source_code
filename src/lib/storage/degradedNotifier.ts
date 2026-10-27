/**
 * Storage degradation notifier (S1-3).
 *
 * Emits a DOM event for tests/other listeners and shows a throttled toast so a quota
 * failure is observable instead of silently "working" in memory.
 */
export type StorageDegradedReason = "quota" | "unknown";

export interface StorageDegradedDetail {
  key: string;
  reason: StorageDegradedReason;
  degradedTo?: string;
}

export const STORAGE_DEGRADED_EVENT = "mimi:storage-degraded";
export const STORAGE_DEGRADED_TOAST = "存储空间不足，已保留上一次有效数据";
const TOAST_THROTTLE_MS = 30_000;

let lastToastAt = 0;

export function reportStorageDegraded(detail: StorageDegradedDetail): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent(STORAGE_DEGRADED_EVENT, { detail }));
    } catch {
      // CustomEvent may be unavailable in non-DOM test environments; console still reports.
    }
  }
  console.warn(
    "[storage-degraded] key=" +
      detail.key +
      " reason=" +
      detail.reason +
      (detail.degradedTo ? " degradedTo=" + detail.degradedTo : "")
  );
  void notifyToast();
}

async function notifyToast(): Promise<void> {
  const now = Date.now();
  if (now - lastToastAt < TOAST_THROTTLE_MS) return;
  lastToastAt = now;
  try {
    const mod = await import("@/store/uiStore");
    mod.useUIStore.getState().showToast(STORAGE_DEGRADED_TOAST, "warning", 5000);
  } catch {
    // UI store unavailable (SSR/tests) -> console warning is enough.
  }
}
