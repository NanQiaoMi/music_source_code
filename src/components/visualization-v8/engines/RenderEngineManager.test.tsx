import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RenderEngineManager } from "./RenderEngineManager";
import type { EffectPlugin } from "@/lib/visualization/types";

describe("RenderEngineManager", () => {
  let container: HTMLDivElement;
  let root: Root;
  const callbacksMap = new Map<number, FrameRequestCallback>();
  let nextRafId = 1;

  const mockEffect: EffectPlugin = {
    id: "test-effect",
    name: "Test Effect",
    category: "spectrum",
    description: "Test effect plugin",
    preferredEngine: "canvas",
    parameters: [],
    init: vi.fn(),
    render: vi.fn(),
    resize: vi.fn(),
    destroy: vi.fn(),
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    callbacksMap.clear();
    nextRafId = 1;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = nextRafId++;
      callbacksMap.set(id, cb);
      return id;
    });

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      callbacksMap.delete(id);
    });

    Object.defineProperty(document, "hidden", {
      configurable: true,
      writable: true,
      value: false,
    });

    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      writable: true,
      value: 2,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  const step = (timestamp: number) => {
    const entries = Array.from(callbacksMap.entries());
    if (entries.length === 0) return;
    const [id, cb] = entries[entries.length - 1];
    callbacksMap.delete(id);
    act(() => {
      cb(timestamp);
    });
  };

  it("sleeps and skips onRender when document is hidden, then resumes on visibilitychange", async () => {
    const onRenderMock = vi.fn();

    await act(async () => {
      root.render(
        <RenderEngineManager
          engine="canvas"
          effect={mockEffect}
          onRender={onRenderMock}
          width={800}
          height={600}
        />
      );
    });

    expect(callbacksMap.size).toBeGreaterThan(0);

    // 1. Normal render when visible
    onRenderMock.mockClear();
    step(100);
    expect(onRenderMock).toHaveBeenCalledTimes(1);

    // 2. Set document.hidden = true -> should sleep / not call onRender
    Object.defineProperty(document, "hidden", {
      configurable: true,
      writable: true,
      value: true,
    });

    onRenderMock.mockClear();
    step(200);
    expect(onRenderMock).not.toHaveBeenCalled();

    // 3. Document becomes visible -> dispatch visibilitychange
    Object.defineProperty(document, "hidden", {
      configurable: true,
      writable: true,
      value: false,
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    onRenderMock.mockClear();
    step(500);
    // onRender should be called again after resume
    expect(onRenderMock).toHaveBeenCalledTimes(1);
    // deltaTime should be 0 because lastTimeRef was reset to 0
    expect(onRenderMock.mock.calls[0][0].deltaTime).toBe(0);
  });

  it("triggers adaptive degradation clamping DPR to 1.0 after 3 consecutive seconds of low FPS (<35)", async () => {
    const onRenderMock = vi.fn();

    await act(async () => {
      root.render(
        <RenderEngineManager
          engine="canvas"
          effect={mockEffect}
          onRender={onRenderMock}
          width={800}
          height={600}
        />
      );
    });

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    // Initially medium quality limits DPR to 1.5 -> canvas.width should be 800 * 1.5 = 1200
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(900);

    // Frame 0 at t = 0
    step(0);

    // Low FPS Streak 1: t = 1000ms, only 1 frame rendered (FPS = 1 < 35)
    step(1000);
    expect(canvas.width).toBe(1200);

    // Low FPS Streak 2: t = 2000ms, only 1 frame rendered (FPS = 1 < 35)
    step(2000);
    expect(canvas.width).toBe(1200);

    // Low FPS Streak 3: t = 3000ms, 3rd consecutive second < 35 FPS
    // This triggers adaptive frame degradation clamping dpr to 1.0!
    step(3000);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });
});
