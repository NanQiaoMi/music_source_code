import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";
import { DataManagerPlayerDock } from "./DataManagerPlayerDock";

const mocks = vi.hoisted(() => ({
  audioState: {
    currentSong: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
    error: null,
    setIsPlaying: vi.fn(),
    nextSong: vi.fn(),
    prevSong: vi.fn(),
    seekTo: vi.fn(),
  },
  playerState: {
    currentSong: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
  },
  queueState: { queue: [] as Song[], currentIndex: 0 },
  openPanel: vi.fn(),
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: (selector: (state: typeof mocks.audioState) => unknown) =>
    selector(mocks.audioState),
}));
vi.mock("@/store/playerStore", () => ({
  usePlayerStore: (selector: (state: typeof mocks.playerState) => unknown) =>
    selector(mocks.playerState),
}));
vi.mock("@/store/queueStore", () => ({
  useQueueStore: (selector: (state: typeof mocks.queueState) => unknown) =>
    selector(mocks.queueState),
}));
vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: (state: { openPanel: typeof mocks.openPanel }) => unknown) =>
    selector({ openPanel: mocks.openPanel }),
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
// S6-4: isPlaying/isLoading 读 PlaybackClock；本用例只 mock audioStore，桥无法安装，
// 因此直接给 hook 注入播放态快照，身份回退仍由 playerStore 验证。
vi.mock("@/hooks/usePlaybackClock", () => ({
  usePlaybackClock: (selector: (snapshot: Record<string, unknown>) => unknown) =>
    selector({ currentTime: 0, duration: 0, isPlaying: true, isLoading: true }),
}));

const fallbackSong: Song = {
  id: "player-store-song",
  title: "Player Store Track",
  artist: "Mimi",
  duration: 220,
  source: "local",
  audioUrl: "file:///player-store-track.mp3",
};

describe("DataManagerPlayerDock player store identity", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    Object.assign(mocks.audioState, {
      currentSong: null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      isLoading: false,
      error: null,
    });
    Object.assign(mocks.playerState, {
      currentSong: fallbackSong,
      currentTime: 42,
      duration: fallbackSong.duration,
      isPlaying: true,
      isLoading: true,
    });
    mocks.queueState.queue = [fallbackSong];
    mocks.queueState.currentIndex = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container.remove();
  });

  // S6-4: currentSong 只有 playerStore 一个权威，audioStore 侧没有歌也必须照常渲染
  it("uses PlayerStore as the single identity source when AudioStore has no current song", async () => {
    root = createRoot(container);
    await act(async () => root?.render(<DataManagerPlayerDock />));

    expect(mocks.audioState.currentSong).toBeNull();
    expect(container.textContent).toContain("Player Store Track");
    expect(container.textContent).toContain("正在加载");
    expect(container.querySelector<HTMLInputElement>('[aria-label="播放进度"]')?.value).toBe("42");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="暂停"]')).not.toBeNull();
  });
});
