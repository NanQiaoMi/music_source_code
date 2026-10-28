import React, { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingDebugHUD } from "./FloatingDebugHUD";
import { FloatingSpectrumGlow } from "./FloatingSpectrumGlow";
import { FloatingWaveformGlow } from "./FloatingWaveformGlow";
import { useFloatingActive } from "@/hooks/useFloatingActive";
import { rafScheduler } from "@/lib/perf/rafScheduler";
import { useAudioStore } from "@/store/audioStore";
import { useFloatingDebugStore } from "@/store/floatingDebugStore";

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  type MotionProps = {
    children?: React.ReactNode;
    animate?: unknown;
    initial?: unknown;
    exit?: unknown;
    transition?: unknown;
    whileHover?: unknown;
    whileTap?: unknown;
    variants?: unknown;
    layoutId?: unknown;
    layout?: unknown;
  } & Record<string, unknown>;

  const strip = (props: MotionProps) => {
    const {
      animate: _a,
      initial: _i,
      exit: _e,
      transition: _t,
      whileHover: _wh,
      whileTap: _wt,
      variants: _v,
      layoutId: _lid,
      layout: _ly,
      ...rest
    } = props;
    return rest;
  };

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    motion: {
      div: (props: MotionProps) => ReactModule.createElement("div", strip(props)),
      button: (props: MotionProps) => ReactModule.createElement("button", strip(props)),
      aside: (props: MotionProps) => ReactModule.createElement("aside", strip(props)),
    },
    useReducedMotion: () => false,
  };
});

// jsdom 的 canvas 桩缺少渐变/路径 API；给一个“任意方法可调用”的 2D 上下文，
// 让画布循环真正跑到自停条件，才能测量“还剩下几个循环”。
function createCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() };
  const target: Record<PropertyKey, unknown> = { canvas };
  return new Proxy(target, {
    get(obj, prop) {
      if (Reflect.has(obj, prop)) return Reflect.get(obj, prop);
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => gradient;
      }
      if (prop === "measureText") return () => ({ width: 0 });
      return () => undefined;
    },
    set(obj, prop, value) {
      return Reflect.set(obj, prop, value);
    },
  }) as unknown as CanvasRenderingContext2D;
}

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(function (this: HTMLCanvasElement, contextId: string) {
    return contextId === "2d" ? createCanvasContext(this) : null;
  }),
});

interface FrameHarness {
  flush: (timestamp?: number) => void;
}

/** 把 rAF 换成可控队列：只有 flush 才推进一帧，便于数“同时存在的循环数”。 */
function installRafHarness(): FrameHarness {
  const frames = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
    const handle = nextHandle;
    nextHandle += 1;
    frames.set(handle, callback);
    return handle;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle: number) => {
    frames.delete(handle);
  });

  return {
    flush(timestamp = 16) {
      const batch = Array.from(frames.values());
      frames.clear();
      act(() => {
        batch.forEach((callback) => callback(timestamp));
      });
    },
  };
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function restoreDocumentVisibility() {
  const doc = document as unknown as Record<string, unknown>;
  delete doc.visibilityState;
  delete doc.hidden;
}

function ActiveProbe({ active }: { active: boolean }) {
  const value = useFloatingActive({ active });
  return <span data-testid="active-probe" data-active={String(value)} />;
}

function IntersectionProbe({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const value = useFloatingActive({ active, targetRef: ref });
  return <div ref={ref} data-testid="active-probe" data-active={String(value)} />;
}

const song = {
  id: "s3-5-track",
  title: "Gated Layers",
  artist: "Perf Lab",
  album: "S3",
  duration: 200,
  cover: "https://example.com/cover.jpg",
  source: "local" as const,
};

describe("S3-5 浮动层 gating", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let raf: FrameHarness;

  const mount = (element: React.ReactElement) => {
    if (!container) {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }
    act(() => {
      root?.render(element);
    });
  };

  beforeEach(() => {
    useAudioStore.setState({
      currentSong: song,
      isPlaying: false,
      currentTime: 10,
      duration: 200,
    });
    useFloatingDebugStore.setState({ isHUDOpen: false, glowIntensity: 1, magnifyPower: 2.4 });
    raf = installRafHarness();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    restoreDocumentVisibility();
    // 卸载后必须没有残留循环，否则会污染后续用例
    expect(rafScheduler.stats().pending).toBe(0);
    vi.restoreAllMocks();
  });

  it("暂停时只保留环境波形一个循环（≤1）：频谱衰减后自停、HUD 关闭时 0 帧", () => {
    mount(
      <>
        <FloatingWaveformGlow height={56} />
        <FloatingSpectrumGlow height={56} />
        <FloatingDebugHUD isOpen={false} />
      </>
    );

    // flag on：波形与频谱共享 visualRuntime 的同一条帧（挂载即 1 个待执行回调，而不是每条链 1 个）；
    // 关闭的 HUD 不再常驻 FPS 循环。flag off 时才是 2 条独立链。
    expect(rafScheduler.stats().pending).toBe(1);

    raf.flush(16);
    raf.flush(32);
    raf.flush(48);

    expect(rafScheduler.stats()).toEqual({ pending: 1, running: true });
  });

  it("document.hidden 时 0 帧，恢复可见后重新排帧", () => {
    mount(
      <>
        <FloatingWaveformGlow height={56} />
        <FloatingSpectrumGlow height={56} />
      </>
    );
    raf.flush(16);
    expect(rafScheduler.stats().pending).toBe(1);

    setDocumentHidden(true);
    expect(rafScheduler.stats()).toEqual({ pending: 0, running: false });

    const requestFrame = vi.mocked(window.requestAnimationFrame);
    const scheduledBefore = requestFrame.mock.calls.length;
    raf.flush(64);
    expect(requestFrame.mock.calls.length).toBe(scheduledBefore);

    setDocumentHidden(false);
    expect(rafScheduler.stats().running).toBe(true);
    raf.flush(80);
    expect(rafScheduler.stats().pending).toBe(1);
  });

  it("外部门控 active=false 时 0 帧，翻转 true 后恢复一个循环", () => {
    mount(<FloatingWaveformGlow height={56} active={false} />);
    expect(rafScheduler.stats()).toEqual({ pending: 0, running: false });

    act(() => {
      root?.render(<FloatingWaveformGlow height={56} active={true} />);
    });
    expect(rafScheduler.stats().pending).toBe(1);

    raf.flush(16);
    expect(rafScheduler.stats().pending).toBe(1);

    act(() => {
      root?.render(<FloatingWaveformGlow height={56} active={false} />);
    });
    expect(rafScheduler.stats()).toEqual({ pending: 0, running: false });
  });

  it("组件卸载后取消已排帧并回到 0 循环", () => {
    mount(<FloatingSpectrumGlow height={56} />);
    expect(rafScheduler.stats().pending).toBe(1);

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(rafScheduler.stats()).toEqual({ pending: 0, running: false });
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("FPS 遥测只在 HUD 打开且活跃时运行", () => {
    mount(<FloatingDebugHUD isOpen={false} />);
    expect(rafScheduler.stats().pending).toBe(0);

    act(() => {
      root?.render(<FloatingDebugHUD isOpen={true} />);
    });
    expect(rafScheduler.stats().pending).toBe(1);

    setDocumentHidden(true);
    expect(rafScheduler.stats()).toEqual({ pending: 0, running: false });

    setDocumentHidden(false);
    expect(rafScheduler.stats().pending).toBe(1);

    act(() => {
      root?.render(<FloatingDebugHUD isOpen={false} />);
    });
    expect(rafScheduler.stats()).toEqual({ pending: 0, running: false });
  });

  it("useFloatingActive 默认 true（SSR 语义），外部门控与隐藏标签页都能压回 false", () => {
    mount(<ActiveProbe active={false} />);
    expect(
      container?.querySelector("[data-testid='active-probe']")?.getAttribute("data-active")
    ).toBe("false");

    act(() => {
      root?.render(<ActiveProbe active={true} />);
    });
    expect(
      container?.querySelector("[data-testid='active-probe']")?.getAttribute("data-active")
    ).toBe("true");

    setDocumentHidden(true);
    expect(
      container?.querySelector("[data-testid='active-probe']")?.getAttribute("data-active")
    ).toBe("false");

    setDocumentHidden(false);
    expect(
      container?.querySelector("[data-testid='active-probe']")?.getAttribute("data-active")
    ).toBe("true");
  });

  it("IntersectionObserver 判定离屏时不活跃，回到视口后恢复", () => {
    const observers: IntersectionObserverCallback[] = [];
    class IntersectionObserverStub {
      root = null;
      rootMargin = "0px";
      thresholds: number[] = [];
      constructor(callback: IntersectionObserverCallback) {
        observers.push(callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

    mount(<IntersectionProbe active={true} />);
    expect(
      container?.querySelector("[data-testid='active-probe']")?.getAttribute("data-active")
    ).toBe("true");

    act(() => {
      observers.forEach((callback) =>
        callback(
          [{ isIntersecting: false } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      );
    });
    expect(
      container?.querySelector("[data-testid='active-probe']")?.getAttribute("data-active")
    ).toBe("false");

    act(() => {
      observers.forEach((callback) =>
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      );
    });
    expect(
      container?.querySelector("[data-testid='active-probe']")?.getAttribute("data-active")
    ).toBe("true");

    vi.unstubAllGlobals();
  });
});
