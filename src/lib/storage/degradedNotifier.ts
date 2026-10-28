/**
 * Storage degradation notifier (S1-3).
 *
 * Emits a DOM event for tests/other listeners so a quota failure is observable instead of
 * silently "working" in memory. Toast rendering is a UI concern: it is subscribed in
 * src/hooks/useStorageDegradedToast.ts (S6-12a) so this lib module stays free of store imports.
 */
export type StorageDegradedReason = "quota" | "unknown";

export interface StorageDegradedDetail {
  key: string;
  reason: StorageDegradedReason;
  degradedTo?: string;
}

export const STORAGE_DEGRADED_EVENT = "mimi:storage-degraded";
export const STORAGE_DEGRADED_TOAST = "存储空间不足，已保留上一次有效数据";

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
}
