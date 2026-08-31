"use client";

import { useEffect, useRef } from "react";
import { useUIStore } from "@/store/uiStore";

export function TopEdgeSearchTrigger() {
  const _isSearchOpen = useUIStore((state) => state.panels.search);
  const openPanel = useUIStore((state) => state.openPanel);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    // 仅针对触屏设备自顶边缘大幅度下拉手势 (touch delta > 50px) 触发搜索，杜绝鼠标正常移动到顶部误触弹出
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0 && e.touches[0].clientY <= 30) {
        touchStartYRef.current = e.touches[0].clientY;
      } else {
        touchStartYRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current !== null && e.touches.length > 0) {
        const deltaY = e.touches[0].clientY - touchStartYRef.current;
        if (deltaY > 50 && !useUIStore.getState().panels.search) {
          openPanel("search");
          touchStartYRef.current = null;
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [openPanel]);

  return (
    // 占位安全隐形感知条（保留用于测试，无鼠标悬停误触发）
    <div
      data-testid="top-edge-search-sensor"
      className="fixed top-0 left-0 right-0 h-1 z-40 pointer-events-none select-none"
      aria-hidden="true"
    />
  );
}
