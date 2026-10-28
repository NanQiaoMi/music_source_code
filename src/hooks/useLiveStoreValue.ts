import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand";

/**
 * S6-10b：SSR 下也要读「此刻」store 的选择器。
 *
 * zustand 原生 hook 的服务端快照取 getInitialState，renderToStaticMarkup
 * 会忽略渲染前写入的状态（音源页空态判断因此失真）。本 hook 的客户端/服务端
 * 快照都取 getState，同时保留订阅与变化时重渲染。
 *
 * 仅用于选择器返回引用稳定字段（如 state.sources）；返回新对象会触发无限重渲染。
 */
export function useLiveStoreValue<T, S>(store: StoreApi<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );
}
