import { act } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentSong: null,
  globalEmotion: { x: 0, y: 0 },
  setGlobalEmotion: vi.fn(),
  saveSongEmotion: vi.fn(),
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & {
  layout?: unknown;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  drag?: unknown;
  dragMomentum?: unknown;
  dragConstraints?: unknown;
  dragElastic?: unknown;
  whileDrag?: unknown;
  onDragEnd?: () => void;
};

vi.mock("framer-motion", async () => {
  const React = await import("react");

  return {
    motion: {
      div: ({
        children,
        layout: _layout,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        drag: _drag,
        dragMomentum: _dragMomentum,
        dragConstraints: _dragConstraints,
        dragElastic: _dragElastic,
        whileDrag: _whileDrag,
        onDragEnd,
        ...props
      }: MotionDivProps) =>
        React.createElement(
          "div",
          { ...props, "data-has-drag-end": onDragEnd ? "true" : undefined },
          children
        ),
    },
    useMotionValue: (initial: number) => {
      let value = initial;
      return {
        get: () => value,
        set: (next: number) => {
          value = next;
        },
      };
    },
    useTransform: () => "rgba(255, 255, 255, 0.1)",
    AnimatePresence: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock("@/store/emotionStore", () => ({
  useEmotionStore: () => ({
    globalEmotion: mocks.globalEmotion,
    setGlobalEmotion: mocks.setGlobalEmotion,
    emotionMap: {},
    saveSongEmotion: mocks.saveSongEmotion,
  }),
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: (selector: (state: { currentSong: null }) => unknown) =>
    selector({ currentSong: mocks.currentSong }),
}));

vi.mock("@/components/shared/GlassToast", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("GlassRadarWidget", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.setGlobalEmotion.mockClear();
    mocks.saveSongEmotion.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows readable emotion quadrant labels when expanded", async () => {
    const { GlassRadarWidget } = await import("./GlassRadarWidget");

    await act(async () => {
      root.render(<GlassRadarWidget />);
    });

    const toggle = container.querySelector(".cursor-pointer");
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("情绪偏好矩阵");
    expect(container.textContent).toContain("高能明亮");
    expect(container.textContent).toContain("忧郁阴影");
    expect(container.textContent).toContain("平静低沉");
    expect(container.textContent).toContain("欢快明亮");
  });
});
