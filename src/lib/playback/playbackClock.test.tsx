import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { usePlaybackClock } from "@/hooks/usePlaybackClock";
import {
  PLAYBACK_CLOCK_SERVER_SNAPSHOT,
  getPlaybackClockServerSnapshot,
  getPlaybackClockSnapshot,
  subscribePlaybackClock,
} from "./playbackClock";

function resetProgress(): void {
  useAudioStore.setState({ currentTime: 0, duration: 0, isPlaying: false, isLoading: false });
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function unmount(): void {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
}

beforeEach(resetProgress);
afterEach(() => {
  unmount();
  resetProgress();
});

describe("PlaybackClock", () => {
  it("mirrors the 250ms mediaBridge timeupdate writes stored on audioStore", () => {
    const seen: number[] = [];
    const unsubscribe = subscribePlaybackClock(() => {
      seen.push(getPlaybackClockSnapshot().currentTime);
    });

    // useAudioPlayer.onTimeUpdate 的写形状：currentTime + duration 一次 setState
    useAudioStore.setState({ currentTime: 12.25, duration: 210, isPlaying: true });
    expect(getPlaybackClockSnapshot()).toEqual({
      currentTime: 12.25,
      duration: 210,
      isPlaying: true,
      isLoading: false,
    });

    // 下一次节流窗口只推进 currentTime
    useAudioStore.setState({ currentTime: 12.5 });
    useAudioStore.setState({ currentTime: 12.75 });
    expect(getPlaybackClockSnapshot().currentTime).toBe(12.75);
    expect(seen).toEqual([12.25, 12.5, 12.75]);

    unsubscribe();
    useAudioStore.setState({ currentTime: 13 });
    expect(seen).toEqual([12.25, 12.5, 12.75]);
  });

  it("exposes stable SSR defaults of 0/false", () => {
    expect(PLAYBACK_CLOCK_SERVER_SNAPSHOT).toEqual({
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      isLoading: false,
    });
    expect(getPlaybackClockServerSnapshot()).toBe(PLAYBACK_CLOCK_SERVER_SNAPSHOT);
  });

  it("keeps isPlaying selectors isolated from currentTime updates", () => {
    let playingRenders = 0;
    let timeRenders = 0;

    function PlayingProbe() {
      playingRenders += 1;
      return <span>{String(usePlaybackClock((state) => state.isPlaying))}</span>;
    }
    function TimeProbe() {
      timeRenders += 1;
      return <span>{usePlaybackClock((state) => state.currentTime)}</span>;
    }

    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() =>
      root?.render(
        <>
          <PlayingProbe />
          <TimeProbe />
        </>
      )
    );

    expect(playingRenders).toBe(1);
    expect(timeRenders).toBe(1);

    act(() => {
      useAudioStore.setState({ currentTime: 1 });
    });
    expect(timeRenders).toBe(2);
    expect(playingRenders).toBe(1);

    act(() => {
      useAudioStore.setState({ isPlaying: true });
    });
    expect(playingRenders).toBe(2);
    expect(timeRenders).toBe(2);
  });
});
