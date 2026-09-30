import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlayerStore } from "@/store/playerStore";
import { useUIStore } from "@/store/uiStore";
import type { Song } from "@/types/song";

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) => {
        return ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);
      },
    }
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    sizes: _sizes,
    unoptimized: _unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    sizes?: string;
    unoptimized?: boolean;
  }) => <img {...props} />,
}));

const firstSong: Song = {
  id: "song-1",
  title: "Blue Hour",
  artist: "Mimi",
  duration: 180,
  source: "local",
  audioUrl: "file:///blue-hour.mp3",
};

const secondSong: Song = {
  id: "song-2",
  title: "Afterglow",
  artist: "Mimi",
  duration: 210,
  source: "local",
  audioUrl: "file:///afterglow.mp3",
};

const thirdSong: Song = {
  id: "song-3",
  title: "North Star",
  artist: "Mimi",
  duration: 200,
  source: "local",
  audioUrl: "file:///north-star.mp3",
};

const resetPlaybackStores = () => {
  useAudioStore.setState({
    currentSong: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
    error: null,
    queue: [],
    currentIndex: 0,
  });
  usePlayerStore.setState({
    currentSong: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
  });
  useQueueStore.setState({ queue: [], currentIndex: 0 });
  useUIStore.setState((state) => ({
    panels: { ...state.panels, queue: false },
  }));
};

const loadDock = async () => {
  const module = await import("./DataManagerPlayerDock").catch(() => null);
  expect(module?.DataManagerPlayerDock, "DataManagerPlayerDock should be exported").toBeTypeOf(
    "function"
  );
  return module?.DataManagerPlayerDock;
};

const renderDock = async (container: HTMLDivElement) => {
  const DataManagerPlayerDock = await loadDock();
  const root = createRoot(container);
  await act(async () => root.render(<DataManagerPlayerDock />));
  return root;
};

const clickButton = async (button: HTMLButtonElement | null) => {
  expect(button).not.toBeNull();
  await act(async () =>
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  );
};

describe("DataManagerPlayerDock", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    resetPlaybackStores();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders nothing when there is no current song", async () => {
    root = await renderDock(container);

    expect(container.firstChild).toBeNull();
  });

  it("matches the floating player fallback when only PlayerStore has the current song", async () => {
    usePlayerStore.setState({
      currentSong: firstSong,
      currentTime: 42,
      duration: firstSong.duration,
      isPlaying: true,
      isLoading: false,
    });
    useQueueStore.setState({ queue: [firstSong], currentIndex: 0 });
    root = await renderDock(container);

    expect(container.textContent).toContain("Blue Hour");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="暂停"]')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('[aria-label="播放进度"]')?.value).toBe("42");
  });

  it("subscribes to the current song, progress, playing state, and queue", async () => {
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 31,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong, secondSong],
      currentIndex: 0,
    });
    useQueueStore.setState({ queue: [firstSong, secondSong], currentIndex: 0 });
    root = await renderDock(container);

    expect(container.textContent).toContain("Blue Hour");
    expect(container.textContent).toContain("Mimi");
    expect(container.querySelector<HTMLInputElement>('[aria-label="播放进度"]')?.value).toBe("31");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="暂停"]')).not.toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label^="播放队列"]')?.textContent
    ).toContain("2");

    await act(async () => {
      useAudioStore.setState({
        currentSong: secondSong,
        currentTime: 57,
        duration: secondSong.duration,
        isPlaying: false,
      });
      useQueueStore.setState({ queue: [firstSong, secondSong, thirdSong] });
    });

    expect(container.textContent).toContain("Afterglow");
    expect(container.querySelector<HTMLInputElement>('[aria-label="播放进度"]')?.value).toBe("57");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="播放"]')).not.toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label^="播放队列"]')?.textContent
    ).toContain("3");
  });

  it("keeps controls interactive and the compact row shrinkable on narrow screens", async () => {
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 31,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong, secondSong],
      currentIndex: 0,
    });
    useQueueStore.setState({ queue: [firstSong, secondSong], currentIndex: 0 });
    root = await renderDock(container);

    const dock = container.querySelector<HTMLElement>('[data-testid="data-manager-player-dock"]');
    const controls = dock?.firstElementChild;
    expect(controls?.classList.contains("pointer-events-auto")).toBe(true);
    expect(controls?.classList.contains("min-w-0")).toBe(true);
    expect(controls?.classList.contains("w-full")).toBe(true);
    expect(container.querySelector('[aria-label="播放进度"]')).not.toBeNull();
    expect(container.querySelector('[aria-label^="播放队列"]')).not.toBeNull();
  });

  it("uses the existing audio and queue actions for playback controls", async () => {
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 31,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong, secondSong],
      currentIndex: 0,
    });
    useQueueStore.setState({ queue: [firstSong, secondSong], currentIndex: 0 });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="暂停"]'));
    expect(useAudioStore.getState().isPlaying).toBe(false);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="下一首"]'));
    expect(useAudioStore.getState().currentSong?.id).toBe(secondSong.id);
    expect(useQueueStore.getState().currentIndex).toBe(1);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="上一首"]'));
    expect(useAudioStore.getState().currentSong?.id).toBe(firstSong.id);
    expect(useQueueStore.getState().currentIndex).toBe(0);

    const progress = container.querySelector<HTMLInputElement>('[aria-label="播放进度"]');
    expect(progress).not.toBeNull();
    if (progress) {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(progress, "52");
      await act(async () => progress.dispatchEvent(new Event("input", { bubbles: true })));
      await act(async () => progress.dispatchEvent(new Event("change", { bubbles: true })));
    }
    expect(useAudioStore.getState().currentTime).toBe(52);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label^="播放队列"]'));
    expect(useUIStore.getState().panels.queue).toBe(true);
  });

  it.each([
    { isLoading: true, error: null, status: "正在加载" },
    {
      isLoading: false,
      error: { type: "network" as const, message: "网络连接中断", timestamp: 1 },
      status: "网络连接中断",
    },
  ])(
    "shows $status without changing playback on route entry",
    async ({ isLoading, error, status }) => {
      useAudioStore.setState({
        currentSong: firstSong,
        currentTime: 36,
        duration: firstSong.duration,
        isPlaying: false,
        isLoading,
        error,
      });
      const playSong = vi.spyOn(useAudioStore.getState(), "playSong");
      const seekTo = vi.spyOn(useAudioStore.getState(), "seekTo");
      const nextSong = vi.spyOn(useAudioStore.getState(), "nextSong");
      const setIsPlaying = vi.spyOn(useAudioStore.getState(), "setIsPlaying");

      root = await renderDock(container);

      expect(container.textContent).toContain(status);
      expect(useAudioStore.getState().currentSong?.id).toBe(firstSong.id);
      expect(useAudioStore.getState().currentTime).toBe(36);
      expect(useAudioStore.getState().isPlaying).toBe(false);
      expect(useAudioStore.getState().isLoading).toBe(isLoading);
      expect(useAudioStore.getState().error).toEqual(error);
      expect(playSong).not.toHaveBeenCalled();
      expect(seekTo).not.toHaveBeenCalled();
      expect(nextSong).not.toHaveBeenCalled();
      expect(setIsPlaying).not.toHaveBeenCalled();
    }
  );
});
