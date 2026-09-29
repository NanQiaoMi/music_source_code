"use client";

import { useSyncExternalStore } from "react";

function subscribe(query: string) {
  return (onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

/**
 * 订阅一条 CSS 媒体查询。
 * 用 useSyncExternalStore 而非 useState+effect：
 *  - getServerSnapshot 返回 false，水合时与服务端一致，不产生不匹配告警；
 *  - 水合完成后 React 静默重渲染成真实值。
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () =>
      typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false
  );
}
