import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom 没有 WebGL：只替换 renderer 构造函数，几何/材质仍走真实 three，
// 让 Shelf3DView 的 setup 真正跑完并建立排帧路径。
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class FakeWebGLRenderer {
    domElement: HTMLCanvasElement | null = null;
    toneMapping = 0;
    toneMappingExposure = 1;
    setPixelRatio = () => undefined;
    setSize = () => undefined;
    render = () => undefined;
    dispose = () => undefined;
    constructor(params: { canvas?: HTMLCanvasElement }) {
      this.domElement = params.canvas ?? null;
    }
  }
  return {
    ...actual,
    WebGLRenderer: FakeWebGLRenderer as unknown as typeof actual.WebGLRenderer,
  };
});

// 离线曲库加载是异步 store 副作用，与本用例的排帧断言无关；避免 act 之外的更新。
vi.mock("@/store/useOfflineDownloadStore", () => {
  const state = { offlineRecords: [], loadOfflineRecords: async () => undefined };
  return {
    useOfflineDownloadStore: (selector: (value: typeof state) => unknown) => selector(state),
  };
});

import { Shelf3DView } from "./Shelf3DView";
import { FloatingWaveformGlow } from "@/components/player/floating/FloatingWaveformGlow";
import { featureFlags } from "@/lib/perf/featureFlags";
import { rafScheduler } from "@/lib/perf/rafScheduler";
import { visualRuntime } from "@/runtime/visualRuntime";

// jsdom 的 2D 桩缺渐变 API；Shelf3D setup 会烘焙阴影贴图，需要可调用的上下文。
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(function (this: HTMLCanvasElement) {
    const gradient = { addColorStop: vi.fn() };
    const target: Record<PropertyKey, unknown> = {
      canvas: this,
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
    };
    return new Proxy(target, {
      get(obj, prop) {
        if (Reflect.has(obj, prop)) return Reflect.get(obj, prop);
        return () => undefined;
      },
      set(obj, prop, value) {
        return Reflect.set(obj, prop, value);
      },
    });
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext,
});

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
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("S5-3 Shelf3D 调度迁移", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  const mount = (element: React.ReactElement) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(element);
    });
  };

  beforeEach(() => {
    // jsdom 没有 matchMedia；Shelf3D 用它读取 reduced-motion 偏好。
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    // 只替换 rAF 队列，不 flush 帧：setup 阶段即可判断谁在排帧。
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
    restoreDocumentVisibility();
    expect(rafScheduler.stats().pending).toBe(0);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("flag on：Shelf3D 与浮动层共享 1 个 runtime 帧，Shelf 不再自排 rAF", () => {
    const subscribeSpy = vi.spyOn(visualRuntime, "subscribe");
    const requestSpy = vi.spyOn(rafScheduler, "request");

    mount(
      <>
        <Shelf3DView isOpen />
        <FloatingWaveformGlow height={56} />
      </>
    );

    expect(subscribeSpy.mock.calls.map(([id]) => id)).toEqual(["shelf3d", "floating-waveform"]);
    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(rafScheduler.stats().pending).toBe(1);
  });

  it("flag on：隐藏时不排帧，恢复可见后重新订阅式续帧", () => {
    setDocumentHidden(true);
    mount(<Shelf3DView isOpen />);

    expect(visualRuntime.getStats().subscribers).toBe(1);
    expect(rafScheduler.stats()).toEqual({ pending: 0, running: false });

    setDocumentHidden(false);
    expect(rafScheduler.stats().pending).toBe(1);
  });

  it("flag off：保留旧 requestRaf 链，不订阅 runtime", () => {
    const mutableFlags = featureFlags as { visualRuntime: boolean };
    const previous = mutableFlags.visualRuntime;
    mutableFlags.visualRuntime = false;

    try {
      const subscribeSpy = vi.spyOn(visualRuntime, "subscribe");
      mount(<Shelf3DView isOpen />);

      expect(subscribeSpy).not.toHaveBeenCalled();
      expect(rafScheduler.stats().pending).toBe(1);
    } finally {
      mutableFlags.visualRuntime = previous;
    }
  });
});
