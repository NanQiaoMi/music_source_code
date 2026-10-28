import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";
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

const staleSong: Song = {
  id: "song-stale",
  title: "Stale Queue Entry",
  artist: "Mimi",
  duration: 195,
  source: "local",
  audioUrl: "file:///stale-queue-entry.mp3",
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
  // 2026-10-12 起 togglePlaybackIntent 改为读取 playback runtime 的 shouldPlay；
  // 该测试直接 setState 模拟 isPlaying 时也要同步意图，否则首击会变成“播放”而不是“暂停”。
  usePlaybackRuntimeStore.setState({ shouldPlay: false });
  useUIStore.setState((state) => ({
    panels: { ...state.panels, queue: false },
  }));
};

const loadDock = async () => {
  const module = await import("./DataManagerPlayerDock").catch(() => null);
  const component = module?.DataManagerPlayerDock;
  expect(component, "DataManagerPlayerDock should be exported").toBeTypeOf("function");
  if (!component) throw new Error("DataManagerPlayerDock should be exported");
  return component;
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
      isPlaying: true,
      isLoading: false,
    });
    // 进度写入走公开 API：playerStore setter 会委托 audioStore（唯一进度权威）
    usePlayerStore.getState().setCurrentTime(42);
    usePlayerStore.getState().setDuration(firstSong.duration);
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
    usePlaybackRuntimeStore.setState({ shouldPlay: true });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="暂停"]'));
    // 2026-10-12 起“是否播放”由 playback runtime 的 shouldPlay 表达；audioStore/playerStore
    // 的 isPlaying 要等真实 media 事件才会翻转，因此断言播放意图而不是镜像字段。
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(false);

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

  it("advances through QueueStore's visible queue when AudioStore has an older queue", async () => {
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 14,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong, staleSong],
      currentIndex: 0,
      loopMode: "all",
    });
    useQueueStore.setState({ queue: [firstSong, secondSong, thirdSong], currentIndex: 0 });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="下一首"]'));

    expect(useAudioStore.getState().currentSong?.id).toBe(secondSong.id);
    expect(useAudioStore.getState().queue.map((song) => song.id)).toEqual([
      firstSong.id,
      secondSong.id,
      thirdSong.id,
    ]);
    expect(useAudioStore.getState().currentIndex).toBe(1);
    expect(useAudioStore.getState().loopMode).toBe("all");
    expect(useQueueStore.getState().currentIndex).toBe(1);
  });

  it("moves back through QueueStore's visible queue when AudioStore has an older queue", async () => {
    useAudioStore.setState({
      currentSong: thirdSong,
      currentTime: 29,
      duration: thirdSong.duration,
      isPlaying: true,
      queue: [firstSong, staleSong],
      currentIndex: 0,
      loopMode: "all",
    });
    useQueueStore.setState({ queue: [firstSong, secondSong, thirdSong], currentIndex: 2 });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="上一首"]'));

    expect(useAudioStore.getState().currentSong?.id).toBe(secondSong.id);
    expect(useAudioStore.getState().queue.map((song) => song.id)).toEqual([
      firstSong.id,
      secondSong.id,
      thirdSong.id,
    ]);
    expect(useAudioStore.getState().currentIndex).toBe(1);
    expect(useAudioStore.getState().loopMode).toBe("all");
    expect(useQueueStore.getState().currentIndex).toBe(1);
  });

  it("aligns a queued current song by id before advancing", async () => {
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 14,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong, staleSong],
      currentIndex: 1,
      loopMode: "all",
    });
    useQueueStore.setState({ queue: [firstSong, secondSong, thirdSong], currentIndex: 2 });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="下一首"]'));

    expect(useAudioStore.getState().currentSong?.id).toBe(secondSong.id);
    expect(useQueueStore.getState().currentIndex).toBe(1);
  });

  it("uses QueueStore's current occurrence when the current song ID appears more than once", async () => {
    const repeatedQueue = [firstSong, secondSong, firstSong, thirdSong];
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 14,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong, secondSong, thirdSong],
      currentIndex: 0,
      loopMode: "all",
    });
    useQueueStore.setState({ queue: repeatedQueue, currentIndex: 2 });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="下一首"]'));

    expect(useAudioStore.getState().currentSong?.id).toBe(thirdSong.id);
    expect(useQueueStore.getState().currentIndex).toBe(3);
  });

  it("uses the repeated current song occurrence when moving to the previous song", async () => {
    const repeatedQueue = [firstSong, secondSong, firstSong, thirdSong];
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 14,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong, secondSong, thirdSong],
      currentIndex: 0,
      loopMode: "all",
    });
    useQueueStore.setState({ queue: repeatedQueue, currentIndex: 2 });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="上一首"]'));

    expect(useAudioStore.getState().currentSong?.id).toBe(secondSong.id);
    expect(useQueueStore.getState().currentIndex).toBe(1);
  });

  it("selects the visible current-index candidate when the playing song was removed", async () => {
    useAudioStore.setState({
      currentSong: staleSong,
      currentTime: 14,
      duration: staleSong.duration,
      isPlaying: true,
      queue: [staleSong, secondSong],
      currentIndex: 0,
      loopMode: "all",
    });
    useQueueStore.setState({ queue: [firstSong, secondSong], currentIndex: 0 });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="下一首"]'));

    expect(useAudioStore.getState().currentSong?.id).toBe(firstSong.id);
    expect(useQueueStore.getState().currentIndex).toBe(0);
  });

  it("selects the queue item immediately before its current-index candidate when going back", async () => {
    useAudioStore.setState({
      currentSong: staleSong,
      currentTime: 14,
      duration: staleSong.duration,
      isPlaying: true,
      queue: [staleSong, thirdSong],
      currentIndex: 0,
      loopMode: "all",
    });
    useQueueStore.setState({ queue: [firstSong, secondSong, thirdSong], currentIndex: 1 });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="上一首"]'));

    expect(useAudioStore.getState().currentSong?.id).toBe(firstSong.id);
    expect(useQueueStore.getState().currentIndex).toBe(0);
  });

  it("keeps a single visible candidate playable after the current song was removed", async () => {
    useAudioStore.setState({
      currentSong: staleSong,
      currentTime: 14,
      duration: staleSong.duration,
      isPlaying: true,
      queue: [staleSong],
      currentIndex: 0,
      loopMode: "none",
    });
    useQueueStore.setState({ queue: [firstSong], currentIndex: 0 });
    root = await renderDock(container);

    const nextButton = container.querySelector<HTMLButtonElement>('[aria-label="下一首"]');
    expect(nextButton?.disabled).toBe(false);
    await clickButton(nextButton);

    expect(useAudioStore.getState().currentSong?.id).toBe(firstSong.id);
  });

  it("preserves manual skip and single-loop mode while the current song is queued", async () => {
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 14,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong, staleSong],
      currentIndex: 0,
      loopMode: "single",
    });
    useQueueStore.setState({ queue: [firstSong, secondSong], currentIndex: 0 });
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="下一首"]'));

    expect(useAudioStore.getState().currentSong?.id).toBe(secondSong.id);
    expect(useAudioStore.getState().loopMode).toBe("single");
  });

  it("keeps shuffle selection random after aligning the current queued song", async () => {
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 14,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong, staleSong],
      currentIndex: 1,
      loopMode: "shuffle",
    });
    useQueueStore.setState({ queue: [firstSong, secondSong, thirdSong], currentIndex: 2 });
    const random = vi.spyOn(Math, "random").mockReturnValue(0.75);
    root = await renderDock(container);

    await clickButton(container.querySelector<HTMLButtonElement>('[aria-label="下一首"]'));

    expect(useAudioStore.getState().currentSong?.id).toBe(thirdSong.id);
    expect(useAudioStore.getState().loopMode).toBe("shuffle");
    random.mockRestore();
  });

  it("does not expose skip actions when the visible queue is empty", async () => {
    useAudioStore.setState({
      currentSong: firstSong,
      currentTime: 14,
      duration: firstSong.duration,
      isPlaying: true,
      queue: [firstSong],
      currentIndex: 0,
    });
    useQueueStore.setState({ queue: [], currentIndex: 0 });
    root = await renderDock(container);

    const previousButton = container.querySelector<HTMLButtonElement>('[aria-label="上一首"]');
    const nextButton = container.querySelector<HTMLButtonElement>('[aria-label="下一首"]');

    expect(previousButton?.disabled).toBe(true);
    expect(nextButton?.disabled).toBe(true);
    await clickButton(previousButton);
    await clickButton(nextButton);
    expect(useAudioStore.getState().currentSong?.id).toBe(firstSong.id);
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
