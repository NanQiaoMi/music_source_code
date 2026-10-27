"use client";

/**
 * 全局 rAF 调度器（单循环）。
 *
 * 页面里每个自绘 canvas / 3D 场景各自 requestAnimationFrame 会形成多条独立循环，
 * 标签页隐藏时还会继续排队；这里的调度器把所有动画合并到**一条**全局 rAF：
 * - 同一帧内多个回调只注册一次 requestAnimationFrame；
 * - document.hidden 时停止排帧，visibilitychange 恢复后继续（回调不会丢失）；
 * - 没有待执行回调时自动停表（idle 时全局 rAF 循环数为 0）。
 *
 * 语义与原生 requestAnimationFrame 对齐：每次 request 只执行一次；回调内再次
 * request 即得到下一帧。布局效果（Visibility、Offscreen、IntersectionObserver）
 * 仍由各组件自行决定是否继续订阅。
 */

export type RafCallback = (timestamp: number) => void;

export interface RafSchedulerEnv {
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(handle: number): void;
  isHidden(): boolean;
  /** 返回解除监听的函数；调度器首次 request 时懒挂载。 */
  onVisibilityChange(listener: () => void): () => void;
}

export interface RafScheduler {
  request(callback: RafCallback): number;
  cancel(handle: number): void;
  /** 诊断用：待执行回调数与当前是否已排帧。 */
  stats(): { pending: number; running: boolean };
}

const defaultEnv: RafSchedulerEnv = {
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
  isHidden: () => typeof document !== "undefined" && document.visibilityState === "hidden",
  onVisibilityChange: (listener) => {
    if (typeof document === "undefined") return () => undefined;
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
};

export function createRafScheduler(env: RafSchedulerEnv = defaultEnv): RafScheduler {
  const pending = new Map<number, RafCallback>();
  let nextHandle = 1;
  let frameHandle: number | null = null;
  let detachVisibility: (() => void) | null = null;

  const stopFrame = () => {
    if (frameHandle === null) return;
    env.cancelFrame(frameHandle);
    frameHandle = null;
  };

  const startFrame = () => {
    if (frameHandle !== null || pending.size === 0 || env.isHidden()) return;
    frameHandle = env.requestFrame(runFrame);
  };

  const handleVisibilityChange = () => {
    if (env.isHidden()) stopFrame();
    else startFrame();
  };

  function runFrame(timestamp: number) {
    frameHandle = null;
    if (env.isHidden()) return;

    // 先取快照再逐个执行：回调里再次 request 的回调属于下一帧；
    // 回调里 cancel 尚未执行的回调也能生效（pending.get 为空即跳过）。
    const handles = Array.from(pending.keys());
    for (const handle of handles) {
      const callback = pending.get(handle);
      if (!callback) continue;
      pending.delete(handle);
      try {
        callback(timestamp);
      } catch (error) {
        // 单个动画回调抛错不应中断同帧其它动画
        console.error("[rafScheduler] animation callback failed", error);
      }
    }

    startFrame();
  }

  return {
    request(callback) {
      if (!detachVisibility) detachVisibility = env.onVisibilityChange(handleVisibilityChange);
      const handle = nextHandle;
      nextHandle += 1;
      pending.set(handle, callback);
      startFrame();
      return handle;
    },
    cancel(handle) {
      pending.delete(handle);
      if (pending.size === 0) stopFrame();
    },
    stats() {
      return { pending: pending.size, running: frameHandle !== null };
    },
  };
}

export const rafScheduler = createRafScheduler();

export function requestRaf(callback: RafCallback): number {
  return rafScheduler.request(callback);
}

export function cancelRaf(handle: number): void {
  rafScheduler.cancel(handle);
}
