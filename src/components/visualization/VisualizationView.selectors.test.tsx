import { act, Profiler } from "react";
import type { CSSProperties, ImgHTMLAttributes, ProfilerOnRenderCallback } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    ...props
  }: MockImageProps) => <img {...props} />,
}));

// 重组件/异步加载在提交次数测试里没有价值：dynamic 只保留占位 null，
// framer-motion 换成普通 DOM 元素，避免无限动画的帧回调污染 commit 计数。
vi.mock("next/dynamic", () => ({ default: () => () => null }));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const cache = new Map<string, unknown>();
  const motion = new Proxy(
    {},
    {
      get(_target, tag: string) {
        if (!cache.has(tag)) {
          const Component = ({
            children,
            ...props
          }: { children?: React.ReactNode } & Record<string, unknown>) => {
            const clean: Record<string, unknown> = { ...props };
            for (const key of [
              "initial",
              "animate",
              "exit",
              "transition",
              "variants",
              "layout",
              "layoutId",
              "whileHover",
              "whileTap",
              "drag",
            ]) {
              delete clean[key];
            }
            return React.createElement(
              tag,
              clean as unknown as React.HTMLAttributes<HTMLElement>,
              children
            );
          };
          cache.set(tag, Component);
        }
        return cache.get(tag);
      },
    }
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children ?? null,
  };
});

import {
  VisualizationView,
  makeCanvasStyle,
  useVisualizationCanvasStyle,
} from "./VisualizationView";
import { VisualizationProgressContainer } from "./VisualizationProgressContainer";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { useVisualizationStore } from "@/store/visualizationStore";
import type { EffectSettings, VisualizationEffect } from "@/store/visualizationStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import { featureFlags } from "@/lib/perf/featureFlags";
import { visualRuntime } from "@/runtime/visualRuntime";

const initialAudioState = useAudioStore.getState();
const initialUIState = useUIStore.getState();
const initialVisualizationState = useVisualizationStore.getState();
const initialVisualSettingsState = useVisualSettingsStore.getState();

function resetStores() {
  useAudioStore.setState(initialAudioState, true);
  useUIStore.setState(initialUIState, true);
  useVisualizationStore.setState(initialVisualizationState, true);
  useVisualSettingsStore.setState(initialVisualSettingsState, true);
}

/** 只统计 Profiler 的 update 提交；mount 由各用例在挂载后清空。 */
function createCommitCounter() {
  let updates = 0;
  const onRender: ProfilerOnRenderCallback = (_id, phase) => {
    if (phase === "update") updates += 1;
  };
  return {
    onRender,
    reset: () => {
      updates = 0;
    },
    updates: () => updates,
  };
}

type ProbeProps = {
  effect: VisualizationEffect;
  settings: EffectSettings;
};

const renderedStyles: CSSProperties[] = [];

function StyleProbe({ effect, settings }: ProbeProps) {
  renderedStyles.push(useVisualizationCanvasStyle(effect, settings));
  return null;
}

describe("VisualizationView selector 隔离", () => {
  let container: HTMLDivElement;
  let root: Root;
  const counter = createCommitCounter();

  beforeEach(() => {
    resetStores();
    renderedStyles.length = 0;
    counter.reset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function mountView() {
    await act(async () => {
      root.render(
        <Profiler id="viz" onRender={counter.onRender}>
          <VisualizationView />
        </Profiler>
      );
    });
    // 挂载期的 effect / microtask 全部落定后再开始计数
    await act(async () => {});
    counter.reset();
  }

  it("audioStore.currentTime 变化 10 次，VisualizationView 顶层 commit 0", async () => {
    await mountView();

    for (let i = 1; i <= 10; i += 1) {
      await act(async () => {
        useAudioStore.setState({ currentTime: i });
      });
    }

    expect(counter.updates()).toBe(0);
  });

  it("duration / bufferedRanges 及无关的 UI、视觉设置变化，顶层 commit 0", async () => {
    await mountView();

    await act(async () => {
      useAudioStore.setState({ duration: 240, bufferedRanges: [{ start: 0, end: 120 }] });
    });
    await act(async () => {
      useUIStore.setState({ toasts: [{ id: "t1", message: "hi", type: "info" }] });
    });
    await act(async () => {
      useVisualSettingsStore.setState({ currentTheme: "light" });
    });

    expect(counter.updates()).toBe(0);
  });

  it("currentEffect 变化仍提交一次，并把新滤镜写到 canvas style", async () => {
    await mountView();

    await act(async () => {
      useVisualizationStore.getState().setCurrentEffect("auroraWave");
    });

    expect(counter.updates()).toBe(1);
    expect(container.querySelector("canvas")?.getAttribute("style")).toContain("saturate(1.2)");
  });

  it("effectSettings 未变时 canvas style 引用稳定", async () => {
    const settings = initialVisualizationState.effectSettings;

    await act(async () => {
      root.render(<StyleProbe effect="spatialMesh" settings={settings} />);
    });
    const first = renderedStyles[renderedStyles.length - 1];

    await act(async () => {
      root.render(<StyleProbe effect="spatialMesh" settings={settings} />);
    });

    expect(renderedStyles[renderedStyles.length - 1]).toBe(first);
  });

  it("currentEffect 变化时 canvas style 引用改变且只重算一次", async () => {
    const settings = initialVisualizationState.effectSettings;

    await act(async () => {
      root.render(<StyleProbe effect="spatialMesh" settings={settings} />);
    });
    const spatial = renderedStyles[renderedStyles.length - 1];

    await act(async () => {
      root.render(<StyleProbe effect="auroraWave" settings={settings} />);
    });
    const aurora = renderedStyles[renderedStyles.length - 1];
    expect(aurora).not.toBe(spatial);
    expect(aurora.filter).toContain("saturate(1.2)");

    // 依赖没再变：重渲染沿用同一个 style 对象，不再重算
    await act(async () => {
      root.render(<StyleProbe effect="auroraWave" settings={settings} />);
    });
    expect(renderedStyles[renderedStyles.length - 1]).toBe(aurora);
  });

  it("renders the hero cover through CoverImage with priority", async () => {
    useVisualizationStore.getState().setCurrentEffect("spatialMesh");
    useAudioStore.setState({
      currentSong: {
        id: "song-1",
        title: "Song",
        artist: "Artist",
        duration: 200,
        cover: "https://example.com/hero.jpg",
        source: "netease",
      },
    });

    await act(async () => {
      root.render(<VisualizationView />);
    });

    const cover = container.querySelector('img[alt="cover"]');
    expect(cover).not.toBeNull();
    expect(cover?.getAttribute("src")).toBe("https://example.com/hero.jpg");
    expect(cover?.getAttribute("loading")).toBe("eager");
    expect(cover?.getAttribute("fetchpriority")).toBe("high");
    expect(cover?.getAttribute("sizes")).toBe("100vw");
  });

  it("flag on: VisualizationView 订阅共享 VisualRuntime", async () => {
    const stop = vi.fn();
    const subscribe = vi.spyOn(visualRuntime, "subscribe").mockReturnValue({
      id: "visualization",
      active: true,
      stop,
    });

    try {
      useUIStore.setState({ currentView: "visualization" });
      await mountView();

      expect(subscribe).toHaveBeenCalledWith("visualization", expect.any(Function));
    } finally {
      subscribe.mockRestore();
    }
  });

  it("flag off: 保留旧的 requestRaf 调度路径", async () => {
    const mutableFlags = featureFlags as { visualRuntime: boolean };
    const previousFlag = mutableFlags.visualRuntime;
    mutableFlags.visualRuntime = false;
    const subscribe = vi.spyOn(visualRuntime, "subscribe");
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");

    try {
      useUIStore.setState({ currentView: "visualization" });
      await mountView();

      expect(subscribe).not.toHaveBeenCalled();
      expect(requestFrame).toHaveBeenCalled();
    } finally {
      mutableFlags.visualRuntime = previousFlag;
      subscribe.mockRestore();
      requestFrame.mockRestore();
    }
  });

  it("makeCanvasStyle 对 spatialMesh 的 blurIntensity 做 80px 上限", () => {
    const style = makeCanvasStyle("spatialMesh", initialVisualizationState.effectSettings);

    expect(style.filter).toContain("blur(80px)");
  });
});

describe("VisualizationProgressContainer", () => {
  let container: HTMLDivElement;
  let root: Root;
  const counter = createCommitCounter();
  const onSeek = vi.fn();

  beforeEach(() => {
    resetStores();
    counter.reset();
    onSeek.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("audioStore.currentTime 变化 10 次，进度子树 commit 10 次", async () => {
    await act(async () => {
      root.render(
        <Profiler id="progress" onRender={counter.onRender}>
          <VisualizationProgressContainer onSeek={onSeek} />
        </Profiler>
      );
    });
    counter.reset();

    for (let i = 1; i <= 10; i += 1) {
      await act(async () => {
        useAudioStore.setState({ currentTime: i });
      });
    }

    expect(counter.updates()).toBe(10);
    expect(container.textContent).toContain("0:10");
  });
});
