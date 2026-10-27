import { afterEach, describe, expect, it, vi } from "vitest";
import { createRafScheduler, type RafScheduler, type RafSchedulerEnv } from "./rafScheduler";

function createHarness(initialHidden = false) {
  const frames = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;
  let hidden = initialHidden;
  let visibilityListener: (() => void) | null = null;

  const env: RafSchedulerEnv = {
    requestFrame: vi.fn((callback: FrameRequestCallback) => {
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      return handle;
    }),
    cancelFrame: vi.fn((handle: number) => {
      frames.delete(handle);
    }),
    isHidden: () => hidden,
    onVisibilityChange: (listener) => {
      visibilityListener = listener;
      return () => {
        visibilityListener = null;
      };
    },
  };

  const scheduler: RafScheduler = createRafScheduler(env);
  const flush = (timestamp = 16) => {
    const batch = Array.from(frames.values());
    frames.clear();
    batch.forEach((callback) => callback(timestamp));
  };
  const setHidden = (value: boolean) => {
    hidden = value;
    visibilityListener?.();
  };

  return { env, scheduler, flush, setHidden };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rafScheduler", () => {
  it("把多个动画合并为一条全局 rAF 循环", () => {
    const h = createHarness();
    const ticks = [vi.fn(), vi.fn(), vi.fn()];
    const handles: number[] = [];

    ticks.forEach((tick, index) => {
      const step = () => {
        tick();
        handles[index] = h.scheduler.request(step);
      };
      handles[index] = h.scheduler.request(step);
    });

    // 三个订阅者同时请求，但同一帧只排一次 rAF
    expect(h.env.requestFrame).toHaveBeenCalledTimes(1);
    expect(h.scheduler.stats()).toEqual({ pending: 3, running: true });

    h.flush(16);
    ticks.forEach((tick) => expect(tick).toHaveBeenCalledTimes(1));
    expect(h.env.requestFrame).toHaveBeenCalledTimes(2);

    handles.forEach((handle) => h.scheduler.cancel(handle));
    expect(h.scheduler.stats()).toEqual({ pending: 0, running: false });
  });

  it("一次性回调执行完后自动停表，空闲时不再排帧", () => {
    const h = createHarness();
    const callback = vi.fn();

    h.scheduler.request(callback);
    expect(h.scheduler.stats()).toEqual({ pending: 1, running: true });

    h.flush(16);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(h.scheduler.stats()).toEqual({ pending: 0, running: false });
    expect(h.env.requestFrame).toHaveBeenCalledTimes(1);
  });

  it("document 隐藏时暂停排帧，恢复可见后继续", () => {
    const h = createHarness();
    const callback = vi.fn();
    let handle = 0;
    const step = () => {
      callback();
      handle = h.scheduler.request(step);
    };
    handle = h.scheduler.request(step);
    expect(h.scheduler.stats()).toEqual({ pending: 1, running: true });

    h.setHidden(true);
    expect(h.env.cancelFrame).toHaveBeenCalledWith(1);
    expect(h.scheduler.stats()).toEqual({ pending: 1, running: false });
    h.flush(32);
    expect(callback).not.toHaveBeenCalled();

    h.setHidden(false);
    expect(h.env.requestFrame).toHaveBeenCalledTimes(2);
    h.flush(48);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(h.scheduler.stats().running).toBe(true);

    h.scheduler.cancel(handle);
    expect(h.scheduler.stats()).toEqual({ pending: 0, running: false });
  });

  it("隐藏状态下首次请求会延迟到可见后再排帧", () => {
    const h = createHarness(true);
    const callback = vi.fn();

    h.scheduler.request(callback);
    expect(h.env.requestFrame).not.toHaveBeenCalled();
    expect(h.scheduler.stats()).toEqual({ pending: 1, running: false });

    h.setHidden(false);
    expect(h.env.requestFrame).toHaveBeenCalledTimes(1);
    h.flush(16);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("取消回调会同步清理待执行项并停止全局循环", () => {
    const h = createHarness();
    const callback = vi.fn();
    const first = h.scheduler.request(callback);
    const second = h.scheduler.request(callback);

    h.scheduler.cancel(first);
    expect(h.scheduler.stats()).toEqual({ pending: 1, running: true });
    h.scheduler.cancel(second);
    expect(h.scheduler.stats()).toEqual({ pending: 0, running: false });
    expect(h.env.cancelFrame).toHaveBeenCalledWith(1);

    h.flush(16);
    expect(callback).not.toHaveBeenCalled();
  });

  it("单个动画回调抛错不会中断同帧其它回调", () => {
    const h = createHarness();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const healthy = vi.fn();

    h.scheduler.request(() => {
      throw new Error("boom");
    });
    h.scheduler.request(healthy);

    h.flush(16);
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
