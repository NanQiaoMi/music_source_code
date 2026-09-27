import { vi } from "vitest";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function createCanvas2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    canvas,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      colorSpace: "srgb" as PredefinedColorSpace,
      height: 1,
      width: 1,
    })),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(function (this: HTMLCanvasElement, contextId: string) {
    if (contextId === "2d") {
      return createCanvas2DContext(this);
    }

    return null;
  }) as HTMLCanvasElement["getContext"],
});

Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
  configurable: true,
  value: vi.fn(() => "data:image/png;base64,"),
});

// jsdom 不实现 ResizeObserver，组件用它跟踪尺寸时会在测试里直接抛 ReferenceError。
// 给一个 no-op 实现：组件在 observe 之前已经同步测过一次尺寸，无需回调即可渲染。
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
