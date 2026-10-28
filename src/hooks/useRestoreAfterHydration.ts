"use client";

import { useEffect, useRef } from "react";
import { useHydrationStatus } from "@/lib/hydrationStatus";

/**
 * 首屏恢复门禁（S6-2c）。
 *
 * 持久化 store 由 `hydrateStores()` 显式补齐，状态变为 `ready` 后才执行一次
 * 恢复；idle/hydrating 保持默认 UI（不覆盖持久化状态），error 不恢复但页面
 * 继续可用。恢复放在 effect 中：SSR 与首帧渲染一致（server snapshot 恒为
 * idle），不会产生 hydration mismatch，也不会在 hydrate 完成前写 store。
 */
export function useRestoreAfterHydration(restore: () => void): void {
  const status = useHydrationStatus();
  const restoreRef = useRef(restore);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    restoreRef.current = restore;
  }, [restore]);

  useEffect(() => {
    if (status !== "ready" || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    restoreRef.current();
  }, [status]);
}
