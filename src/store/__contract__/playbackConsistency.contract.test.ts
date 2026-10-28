// S6-11c playback consistency: PlaybackClock is a synchronous projection of the progress
// authority (audioStore). Identity/mixer writes must not perturb the clock, progress writes must
// land in the same tick, and unsubscribe must stop delivery without freezing the snapshot.
import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import type { Song } from "@/types/song";
import {
  getPlaybackClockSnapshot,
  subscribePlaybackClock,
  type PlaybackClockSnapshot,
} from "@/lib/playback/playbackClock";

const track = (id: string): Song => ({
  id,
  title: id,
  artist: "contract",
  duration: 210,
  source: "local",
});

const finite = (value: number): number => (Number.isFinite(value) && value >= 0 ? value : 0);

/** Contract projection: the clock equals the clamped progress authority, never a mirror store. */
const project = (): PlaybackClockSnapshot => {
  const s = useAudioStore.getState();
  return {
    currentTime: finite(s.currentTime),
    duration: finite(s.duration),
    isPlaying: s.isPlaying === true,
    isLoading: s.isLoading === true,
  };
};

beforeEach(() => {
  usePlayerStore.setState({
    currentSong: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
    volume: 0.7,
    isMuted: false,
    playbackRate: 1,
  });
  useAudioStore.setState({
    currentSong: null,
    currentTime: 0,
    persistedCurrentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
    volume: 0.7,
    isMuted: false,
    playbackRate: 1,
  });
});

describe("playback clock consistency (S6-11c)", () => {
  it("projects identity/progress/mixer writes in the same tick", () => {
    const player = usePlayerStore.getState();
    const song = track("identity");
    player.setCurrentSong(song);
    player.setCurrentTime(12.25);
    player.setDuration(210);
    player.setIsLoading(true);
    // mediaBridge 的权威写入路径：播放状态由音频管线回写 audioStore，而非由 setter 直接赋值。
    useAudioStore.setState({ isPlaying: true });

    expect(getPlaybackClockSnapshot()).toEqual(project());
    expect(project()).toEqual({
      currentTime: 12.25,
      duration: 210,
      isPlaying: true,
      isLoading: true,
    });
    expect(usePlayerStore.getState().currentSong).toBe(song);
    expect(useAudioStore.getState().currentSong).toBe(song);

    const stable = getPlaybackClockSnapshot();
    usePlayerStore.getState().setVolume(0.42);
    usePlayerStore.getState().toggleMute();
    usePlayerStore.getState().setPlaybackRate(1.25);
    expect(getPlaybackClockSnapshot()).toBe(stable);
    expect(useAudioStore.getState()).toMatchObject({
      volume: 0.42,
      isMuted: true,
      playbackRate: 1.25,
    });
  });

  it("projects seek writes and clamps non-finite progress", () => {
    useAudioStore.getState().seekTo(42.5);
    expect(getPlaybackClockSnapshot().currentTime).toBe(42.5);
    expect(usePlayerStore.getState().currentTime).toBe(42.5);
    expect(getPlaybackClockSnapshot().currentTime).toBe(
      finite(useAudioStore.getState().currentTime)
    );

    useAudioStore.getState().seekTo(Number.NaN);
    expect(getPlaybackClockSnapshot()).toMatchObject({ currentTime: 0, duration: 0 });
  });

  it("stops delivery on unsubscribe while the snapshot stays live", () => {
    const seen: number[] = [];
    const unsubscribe = subscribePlaybackClock(() =>
      seen.push(getPlaybackClockSnapshot().currentTime)
    );
    usePlayerStore.getState().setCurrentTime(1);
    usePlayerStore.getState().setCurrentTime(2);
    expect(seen).toEqual([1, 2]);

    const beforeUnsubscribe = getPlaybackClockSnapshot();
    unsubscribe();
    usePlayerStore.getState().setCurrentTime(3);
    expect(seen).toEqual([1, 2]);
    expect(getPlaybackClockSnapshot()).not.toBe(beforeUnsubscribe);
    expect(getPlaybackClockSnapshot()).toMatchObject({ currentTime: 3 });
  });
});
