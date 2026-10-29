"use client";

/**
 * S6-12a：存储降级事件 -> toast 桥。
 *
 * src/lib/storage/degradedNotifier 是框架无关的底层模块，不能 import store：
 * 那会形成 safeStorage -> degradedNotifier -> toastStore -> safeStorage 的循环。
 * 因此 toast 订阅上移到 UI 层（本 hook 由 GlobalClientComponents 挂载）。
 * S6-6a：写入目标改为 toastStore（toast 唯一 owner）。
 */
import { useEffect } from "react";
import { STORAGE_DEGRADED_EVENT, STORAGE_DEGRADED_TOAST } from "@/lib/storage/degradedNotifier";
import { showToast } from "@/store/actions/uiActions";

const TOAST_THROTTLE_MS = 30_000;

export function useStorageDegradedToast(): void {
  useEffect(() => {
    let lastToastAt = 0;
    const onDegraded = () => {
      const now = Date.now();
      if (now - lastToastAt < TOAST_THROTTLE_MS) return;
      lastToastAt = now;
      showToast(STORAGE_DEGRADED_TOAST, "warning", 5000);
    };
    window.addEventListener(STORAGE_DEGRADED_EVENT, onDegraded);
    return () => window.removeEventListener(STORAGE_DEGRADED_EVENT, onDegraded);
  }, []);
}
