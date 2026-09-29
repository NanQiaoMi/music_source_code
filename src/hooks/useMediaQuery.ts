"use client";

import { useMemo, useSyncExternalStore } from "react";

function makeSubscribe(query: string) {
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
 * subscribe 必须在 query 不变时保持同一引用，否则 useSyncExternalStore
 * 会在每次渲染时退订再重订（不会造成渲染循环，但白做一遍订阅/退订）。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useMemo(() => makeSubscribe(query), [query]);

  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false
  );
}
