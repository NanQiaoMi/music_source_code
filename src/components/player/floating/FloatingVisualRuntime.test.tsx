import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 频率/波形数据固定为非零：两个可视层都必须逐帧绘制，才能数清共享帧与重复循环。
const audio = vi.hoisted(() => ({
  analyser: {
    frequencyBinCount: 512,
    fftSize: 2048,
    context: { state: "running" },
    getByteFrequencyData: (data: Uint8Array) => data.fill(180),
    getByteTimeDomainData: (data: Uint8Array) => data.fill(150),
  },
}));

vi.mock("@/hooks/useAudioPlayer", () => ({
  getAudioAnalyser: () => audio.analyser,
}));

import { FloatingSpectrumGlow } from "./FloatingSpectrumGlow";
import { FloatingWaveformGlow } from "./FloatingWaveformGlow";
import { featureFlags } from "@/lib/perf/featureFlags";
import { rafScheduler } from "@/lib/perf/rafScheduler";
import { visualRuntime } from "@/runtime/visualRuntime";
import { useAudioStore } from "@/store/audioStore";
import { useFloatingDebugStore } from "@/store/floatingDebugStore";

// jsdom 的 2D 桩缺渐变 API；这里补一个“任意方法可调用”的上下文，并记录 clearRect。
const clearRectSpy = vi.fn();

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(function (this: HTMLCanvasElement) {
    const gradient = { addColorStop: vi.fn() };
    const target: Record<PropertyKey, unknown> = {
      canvas: this,
      clearRect: clearRectSpy,
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

const song = {
  id: "s5-3-glow",
  title: "Shared Frame",
  artist: "Perf Lab",
  album: "S5",
  duration: 200,
  cover: "https://example.com/cover.jpg",
  source: "local" as const,
};

describe("S5-3 浮动层 VisualRuntime 迁移", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  const frames = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;
  let clock = 1000;

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

  const flush = () => {
    const batch = Array.from(frames.values());
    frames.clear();
    clock += 1000 / 60;
    act(() => {
      batch.forEach((callback) => callback(clock));
    });
  };

  beforeEach(() => {
    useAudioStore.setState({
      currentSong: song,
      isPlaying: true,
      currentTime: 10,
      duration: 200,
    });
    useFloatingDebugStore.setState({ isHUDOpen: false, glowIntensity: 1, magnifyPower: 2.4 });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      return handle;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
      frames.delete(handle);
    });
    clearRectSpy.mockClear();
    clock = 1000;
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
    expect(rafScheduler.stats().pending).toBe(0);
    vi.restoreAllMocks();
  });

  it("flag on：两个可视层共享同一条 runtime 帧，每帧每个消费者各画一次", () => {
    const subscribeSpy = vi.spyOn(visualRuntime, "subscribe");
    const requestSpy = vi.spyOn(rafScheduler, "request");

    mount(
      <>
        <FloatingWaveformGlow height={56} />
        <FloatingSpectrumGlow height={56} />
      </>
    );

    expect(subscribeSpy.mock.calls.map(([id]) => id)).toEqual([
      "floating-waveform",
      "floating-spectrum",
    ]);
    // 两个订阅者只换来 1 个 scheduler 请求。
    expect(rafScheduler.stats().pending).toBe(1);
    expect(requestSpy).toHaveBeenCalledTimes(1);

    requestSpy.mockClear();
    clearRectSpy.mockClear();
    for (let frame = 0; frame < 5; frame += 1) flush();

    expect(clearRectSpy).toHaveBeenCalledTimes(10); // 2 consumers × 5 frames
    expect(requestSpy).toHaveBeenCalledTimes(5); // 1 request per frame
    expect(rafScheduler.stats().pending).toBe(1);
  });

  it("hidden 时共享帧停止（0 帧），恢复可见后重新只排 1 帧", () => {
    mount(
      <>
        <FloatingWaveformGlow height={56} />
        <FloatingSpectrumGlow height={56} />
      </>
    );
    flush();
    expect(rafScheduler.stats().pending).toBe(1);

    setDocumentHidden(true);
    expect(rafScheduler.stats()).toEqual({ pending: 0, running: false });

    clearRectSpy.mockClear();
    for (let frame = 0; frame < 5; frame += 1) flush();
    expect(clearRectSpy).not.toHaveBeenCalled();

    setDocumentHidden(false);
    expect(rafScheduler.stats().pending).toBe(1);
    flush();
    expect(clearRectSpy).toHaveBeenCalledTimes(2);
  });

  it("帧时基：60fps 驱动 2 秒，两个消费者各 120 帧、每帧仅 1 次排帧，实测 FPS ≥ 50", () => {
    mount(
      <>
        <FloatingWaveformGlow height={56} />
        <FloatingSpectrumGlow height={56} />
      </>
    );
    const requestSpy = vi.spyOn(rafScheduler, "request");
    clearRectSpy.mockClear();

    const FRAMES = 120;
    for (let frame = 0; frame < FRAMES; frame += 1) flush();

    // 时间是 120 帧 / 2s = 60fps；runtime 的 1s FPS 窗口应回读到 ≥50。
    expect(visualRuntime.getStats().fps).toBeGreaterThanOrEqual(50);
    expect(clearRectSpy).toHaveBeenCalledTimes(FRAMES * 2);
    expect(requestSpy).toHaveBeenCalledTimes(FRAMES);
  });

  it("flag off：回到每个消费者一条 rafScheduler 链（2 请求/帧），不订阅 runtime", () => {
    const mutableFlags = featureFlags as { visualRuntime: boolean };
    const previous = mutableFlags.visualRuntime;
    mutableFlags.visualRuntime = false;

    try {
      const subscribeSpy = vi.spyOn(visualRuntime, "subscribe");
      const requestSpy = vi.spyOn(rafScheduler, "request");

      mount(
        <>
          <FloatingWaveformGlow height={56} />
          <FloatingSpectrumGlow height={56} />
        </>
      );

      expect(subscribeSpy).not.toHaveBeenCalled();
      expect(rafScheduler.stats().pending).toBe(2);

      requestSpy.mockClear();
      clearRectSpy.mockClear();
      for (let frame = 0; frame < 3; frame += 1) flush();

      expect(clearRectSpy).toHaveBeenCalledTimes(6);
      expect(requestSpy).toHaveBeenCalledTimes(6); // 2 legacy chains × 3 frames
    } finally {
      mutableFlags.visualRuntime = previous;
    }
  });
});
