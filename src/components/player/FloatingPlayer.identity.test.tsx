import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";
import { usePlayerStore } from "@/store/playerStore";
import { FloatingPlayer } from "./FloatingPlayer";

// S6-4：audioStore 侧不再持有身份字段（currentSong 永远缺席），FloatingPlayer 必须
// 只靠 playerStore 决定显隐 —— 这就是"单一身份权威"的可执行证据。
vi.mock("@/store/audioStore", () => {
  const useAudioStore = (selector?: (state: Record<string, unknown>) => unknown) =>
    selector ? selector({ isPlaying: false, setIsPlaying: vi.fn() }) : undefined;
  // 键盘处理器仍会读进度，保留 getState 以免用例误触时崩溃
  Object.assign(useAudioStore, {
    getState: () => ({ currentTime: 0, duration: 0, seekTo: () => undefined }),
  });
  return { useAudioStore };
});

vi.mock("./floating/FloatingCompactControlsState", () => ({
  FloatingCompactControlsState: () => <div data-testid="floating-compact" />,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  return {
    motion: {
      aside: ({
        initial: _i,
        animate: _a,
        exit: _e,
        transition: _t,
        ...props
      }: Record<string, unknown>) => ReactModule.createElement("aside", props),
    },
    useReducedMotion: () => false,
  };
});

const song: Song = {
  id: "floating-identity",
  title: "Floating Identity",
  artist: "Mimi",
  duration: 200,
  source: "local",
};

describe("FloatingPlayer identity gating", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    usePlayerStore.getState().setCurrentSong(null);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    usePlayerStore.getState().setCurrentSong(null);
  });

  it("stays hidden while playerStore has no current song", async () => {
    await act(async () => root.render(<FloatingPlayer />));
    expect(host.querySelector('[aria-label="悬浮音乐播放器"]')).toBeNull();
  });

  it("appears from playerStore alone, with no audioStore identity", async () => {
    await act(async () => root.render(<FloatingPlayer />));
    await act(async () => {
      usePlayerStore.getState().setCurrentSong(song);
    });

    expect(host.querySelector('[aria-label="悬浮音乐播放器"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="floating-compact"]')).not.toBeNull();

    await act(async () => {
      usePlayerStore.getState().setCurrentSong(null);
    });
    expect(host.querySelector('[aria-label="悬浮音乐播放器"]')).toBeNull();
  });
});
