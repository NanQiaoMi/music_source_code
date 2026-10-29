import { act, Profiler } from "react";
import type { ProfilerOnRenderCallback, ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";
import type { EmotionPoint } from "@/types/emotion";
import { AIToolbox } from "@/components/layout/AIToolbox";
import {
  AudioQualityDisplay,
  HiResBadge,
  HiResMiniBadge,
  QualityIndicator,
} from "@/components/audio/HiResBadge";
import EmotionVisualizer from "@/components/emotion/EmotionVisualizer";
import { PlayerSkinsPanel } from "@/components/player/PlayerSkinsPanel";
import { QueuePanel } from "@/components/player/QueuePanel";
import { SourceManagementModal } from "@/components/sources/SourceManagementModal";
import { VisualizationSettingsPanel } from "@/components/visualization/VisualizationSettingsPanel";
import { useAIStore } from "@/store/aiStore";
import { useAudioStore } from "@/store/audioStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useHiResStore } from "@/store/hiresStore";
import { useQueueStore } from "@/store/queueStore";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { usePanelStore } from "@/store/panelStore";
import { useUIStore } from "@/store/uiStore";
import { useUiShellStore } from "@/store/uiShellStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import { useVisualizationStore } from "@/store/visualizationStore";

// S3-10 回归：整店订阅改为原子 selector 后，无关字段变化不得触发 commit。
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
              "dragConstraints",
              "dragMomentum",
              "dragElastic",
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
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children ?? null,
  };
});

// EmotionVisualizer 的绘制循环依赖完整 Canvas 2D 实现；commit 计数不需要逐帧绘制。
vi.stubGlobal("requestAnimationFrame", () => 0);
vi.stubGlobal("cancelAnimationFrame", () => undefined);

// 光环预览会真实绘制渐变；用一个任意方法均可调用的 2D 上下文桩承接。
function installCanvasContextStub() {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(function (this: HTMLCanvasElement) {
      const gradient = { addColorStop: vi.fn() };
      const props: Record<string, unknown> = { canvas: this };
      return new Proxy(props, {
        get(target, prop) {
          if (prop === "canvas") return target.canvas;
          if (!(prop in target)) {
            target[prop as string] =
              typeof prop === "string" && prop.startsWith("create")
                ? vi.fn(() => gradient)
                : vi.fn();
          }
          return target[prop as string];
        },
        set(target, prop, value) {
          target[prop as string] = value;
          return true;
        },
      });
    }) as unknown as HTMLCanvasElement["getContext"],
  });
}
installCanvasContextStub();

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    sizes: _sizes,
    unoptimized: _unoptimized,
    ...props
  }: { fill?: boolean } & Record<string, unknown>) => (
    <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />
  ),
}));

const initialUIState = useUIStore.getInitialState();
const initialAudioState = useAudioStore.getInitialState();
const initialQueueState = useQueueStore.getInitialState();
const initialOfflineState = useOfflineDownloadStore.getInitialState();
const initialHiResState = useHiResStore.getInitialState();
const initialEmotionState = useEmotionStore.getInitialState();
const initialSourceConfigState = useSourceConfigStore.getInitialState();
const initialVisualizationState = useVisualizationStore.getInitialState();
const initialVisualSettingsState = useVisualSettingsStore.getInitialState();

const song: Song = { id: "s3-10", title: "Selector", artist: "S3", duration: 200, source: "local" };
const nextSong: Song = {
  id: "s3-10-next",
  title: "Next",
  artist: "S3",
  duration: 210,
  source: "netease",
};
const point: EmotionPoint = {
  id: song.id,
  title: song.title,
  artist: song.artist,
  x: 0.4,
  y: -0.2,
  isTagged: true,
};
const quality = {
  format: "FLAC",
  sampleRate: 96000,
  bitDepth: 24,
  channels: 2,
  bitrate: 4608,
  quality: "Hi-Res" as const,
  isLossless: true,
  isHighRes: true,
};

interface SubscriptionCase {
  name: string;
  make: () => ReactElement;
  unrelated: () => void;
  related: () => void;
}

const subscriptionCases: SubscriptionCase[] = [
  {
    name: "HiResBadge",
    make: () => (
      <>
        <HiResBadge />
        <AudioQualityDisplay />
        <HiResMiniBadge song={song} />
        <QualityIndicator sampleRate={96000} bitDepth={24} channels={2} format="FLAC" />
      </>
    ),
    unrelated: () => useHiResStore.setState({ autoDetect: true }),
    related: () => useHiResStore.setState({ currentQuality: { ...quality, bitDepth: 32 } }),
  },
  {
    name: "EmotionVisualizer",
    make: () => <EmotionVisualizer />,
    unrelated: () => {
      useEmotionStore.setState({ viewMode: "heatmap" });
      useAudioStore.setState({ currentTime: 12 });
    },
    related: () => useEmotionStore.setState({ points: [point] }),
  },
  {
    name: "SourceManagementModal",
    make: () => <SourceManagementModal />,
    unrelated: () => useSourceConfigStore.setState({ activePreset: "studio" }),
    related: () => useSourceConfigStore.setState({ activeManagementTab: "backup" }),
  },
  {
    name: "VisualizationSettingsPanel",
    make: () => <VisualizationSettingsPanel isOpen={false} onClose={() => undefined} />,
    unrelated: () => useVisualizationStore.setState({ isFullscreen: true }),
    related: () => useVisualizationStore.setState({ currentEffect: "cyberMatrix" }),
  },
  {
    name: "QueuePanel",
    make: () => <QueuePanel isOpen onClose={() => undefined} />,
    unrelated: () => {
      useUiShellStore.setState({ currentView: "player" });
      useAudioStore.setState({ currentTime: 8 });
    },
    related: () => useQueueStore.setState({ queue: [nextSong] }),
  },
  {
    name: "PlayerSkinsPanel",
    make: () => <PlayerSkinsPanel isOpen onClose={() => undefined} />,
    unrelated: () => useUiShellStore.setState({ currentView: "player" }),
    related: () =>
      useVisualSettingsStore.setState({
        customThemes: [...initialVisualSettingsState.customThemes],
      }),
  },
  {
    name: "AIToolbox",
    make: () => <AIToolbox />,
    unrelated: () => useAIStore.setState({ configs: [...useAIStore.getState().configs] }),
    related: () =>
      usePanelStore.setState({ panels: { ...usePanelStore.getState().panels, aiSettings: true } }),
  },
];

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

describe("S3-10 narrow store subscriptions", () => {
  let container: HTMLDivElement;
  let root: Root;
  const counter = createCommitCounter();

  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState(initialUIState, true);
    useUiShellStore.setState(useUiShellStore.getInitialState(), true);
    useAudioStore.setState(initialAudioState, true);
    useQueueStore.setState(initialQueueState, true);
    useOfflineDownloadStore.setState(initialOfflineState, true);
    useHiResStore.setState(initialHiResState, true);
    useEmotionStore.setState(initialEmotionState, true);
    useSourceConfigStore.setState(initialSourceConfigState, true);
    useVisualizationStore.setState(initialVisualizationState, true);
    useVisualSettingsStore.setState(initialVisualSettingsState, true);

    // 组件挂载副作用走桩，避免网络/落盘噪声污染 commit 计数。
    useOfflineDownloadStore.setState({ loadOfflineRecords: vi.fn().mockResolvedValue(undefined) });
    useSourceConfigStore.setState({
      isManagementModalOpen: false,
      syncBuiltinDesktopSources: vi.fn().mockResolvedValue(undefined),
    });
    useHiResStore.setState({
      currentQuality: quality,
      showQualityBadge: true,
      showDetailedInfo: true,
    });
    useQueueStore.setState({ queue: [song], currentIndex: 0 });
    useAudioStore.setState({ currentSong: song, isPlaying: true });
    useEmotionStore.setState({ points: [point], selectedIds: [] });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    counter.reset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    counter.reset();
  });

  async function mount(name: string, node: ReactElement) {
    await act(async () => {
      root.render(
        <Profiler id={name} onRender={counter.onRender}>
          {node}
        </Profiler>
      );
    });
    await act(async () => {});
    counter.reset();
  }

  it.each(subscriptionCases)(
    "$name ignores unrelated store fields",
    async ({ name, make, unrelated }) => {
      await mount(name, make());

      await act(async () => {
        unrelated();
      });

      expect(counter.updates()).toBe(0);
    }
  );

  it.each(subscriptionCases)(
    "$name commits when a selected field changes",
    async ({ name, make, related }) => {
      await mount(name, make());

      await act(async () => {
        related();
      });

      expect(counter.updates()).toBeGreaterThan(0);
    }
  );
});
