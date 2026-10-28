"use client";

/**
 * S6-12a：存储降级事件 -> toast 桥。
 *
 * src/lib/storage/degradedNotifier 是框架无关的底层模块，不能 import uiStore：
 * 那会形成 safeStorage -> degradedNotifier -> uiStore -> safeStorage 的循环。
 * 因此 toast 订阅上移到 UI 层（本 hook 由 GlobalClientComponents 挂载）。
 */
import { useEffect } from "react";
import { STORAGE_DEGRADED_EVENT, STORAGE_DEGRADED_TOAST } from "@/lib/storage/degradedNotifier";
import { useUIStore } from "@/store/uiStore";

const TOAST_THROTTLE_MS = 30_000;

export function useStorageDegradedToast(): void {
  useEffect(() => {
    let lastToastAt = 0;
    const onDegraded = () => {
      const now = Date.now();
      if (now - lastToastAt < TOAST_THROTTLE_MS) return;
      lastToastAt = now;
      useUIStore.getState().showToast(STORAGE_DEGRADED_TOAST, "warning", 5000);
    };
    window.addEventListener(STORAGE_DEGRADED_EVENT, onDegraded);
    return () => window.removeEventListener(STORAGE_DEGRADED_EVENT, onDegraded);
  }, []);
}
