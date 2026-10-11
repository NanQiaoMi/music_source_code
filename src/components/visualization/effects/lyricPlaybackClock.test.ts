import { describe, expect, it } from "vitest";

import { advanceLyricPlaybackClock, createLyricPlaybackClock } from "./lyricPlaybackClock";

describe("lyric playback clock", () => {
  it("uses an exact zero-second start and projects forward with the music clock", () => {
    const initial = createLyricPlaybackClock();
    const first = advanceLyricPlaybackClock(initial, {
      reportedMusicTime: 0,
      frameTimeMs: 1000,
      isPlaying: true,
      playbackRate: 1,
    });
    const next = advanceLyricPlaybackClock(first.state, {
      reportedMusicTime: 0,
      frameTimeMs: 1100,
      isPlaying: true,
      playbackRate: 1,
    });

    expect(first.musicTime).toBe(0);
    expect(next.musicTime).toBeCloseTo(0.1, 5);
    expect(next.discontinuity).toBe(false);
  });

  it("accepts normal 250ms store updates without treating them as seeks", () => {
    const initial = createLyricPlaybackClock();
    const first = advanceLyricPlaybackClock(initial, {
      reportedMusicTime: 20,
      frameTimeMs: 1000,
      isPlaying: true,
      playbackRate: 1,
    });
    const updated = advanceLyricPlaybackClock(first.state, {
      reportedMusicTime: 20.25,
      frameTimeMs: 1250,
      isPlaying: true,
      playbackRate: 1,
    });

    expect(updated.discontinuity).toBe(false);
    expect(updated.musicTime).toBeCloseTo(20.25, 5);
  });

  it("absorbs small forward clock corrections inside a normal update window", () => {
    const first = advanceLyricPlaybackClock(createLyricPlaybackClock(), {
      reportedMusicTime: 20,
      frameTimeMs: 1000,
      isPlaying: true,
      playbackRate: 1,
    });
    const corrected = advanceLyricPlaybackClock(first.state, {
      reportedMusicTime: 20.35,
      frameTimeMs: 1250,
      isPlaying: true,
      playbackRate: 1,
    });

    expect(corrected.discontinuity).toBe(false);
    expect(corrected.musicTime).toBeCloseTo(20.35, 5);
  });

  it("applies playback-rate changes from the current reported position", () => {
    const first = advanceLyricPlaybackClock(createLyricPlaybackClock(), {
      reportedMusicTime: 4,
      frameTimeMs: 1000,
      isPlaying: true,
      playbackRate: 1,
    });
    const changedRate = advanceLyricPlaybackClock(first.state, {
      reportedMusicTime: 4.1,
      frameTimeMs: 1100,
      isPlaying: true,
      playbackRate: 2,
    });
    const next = advanceLyricPlaybackClock(changedRate.state, {
      reportedMusicTime: 4.1,
      frameTimeMs: 1200,
      isPlaying: true,
      playbackRate: 2,
    });

    expect(changedRate.discontinuity).toBe(true);
    expect(changedRate.musicTime).toBeCloseTo(4.1, 5);
    expect(next.musicTime).toBeCloseTo(4.3, 5);
    expect(changedRate.visualReset).toBe(false);
  });

  it("freezes the projected frame time when pausing between store updates", () => {
    const first = advanceLyricPlaybackClock(createLyricPlaybackClock(), {
      reportedMusicTime: 12,
      frameTimeMs: 1000,
      isPlaying: true,
      playbackRate: 1,
    });
    const projected = advanceLyricPlaybackClock(first.state, {
      reportedMusicTime: 12,
      frameTimeMs: 1250,
      isPlaying: true,
      playbackRate: 1,
    });
    const paused = advanceLyricPlaybackClock(projected.state, {
      reportedMusicTime: 12,
      frameTimeMs: 1260,
      isPlaying: false,
      playbackRate: 1,
    });
    const held = advanceLyricPlaybackClock(paused.state, {
      reportedMusicTime: 12,
      frameTimeMs: 1500,
      isPlaying: false,
      playbackRate: 1,
    });

    expect(paused.musicTime).toBeCloseTo(12.26, 5);
    expect(paused.visualReset).toBe(false);
    expect(held.musicTime).toBeCloseTo(paused.musicTime, 5);
  });

  it("continues from the projected time when playback speed changes between updates", () => {
    const first = advanceLyricPlaybackClock(createLyricPlaybackClock(), {
      reportedMusicTime: 10,
      frameTimeMs: 1000,
      isPlaying: true,
      playbackRate: 1,
    });
    const projected = advanceLyricPlaybackClock(first.state, {
      reportedMusicTime: 10,
      frameTimeMs: 1120,
      isPlaying: true,
      playbackRate: 1,
    });
    const changedRate = advanceLyricPlaybackClock(projected.state, {
      reportedMusicTime: 10,
      frameTimeMs: 1200,
      isPlaying: true,
      playbackRate: 2,
    });
    const next = advanceLyricPlaybackClock(changedRate.state, {
      reportedMusicTime: 10,
      frameTimeMs: 1300,
      isPlaying: true,
      playbackRate: 2,
    });

    expect(changedRate.musicTime).toBeCloseTo(10.2, 5);
    expect(changedRate.visualReset).toBe(false);
    expect(next.musicTime).toBeCloseTo(10.4, 5);
  });

  it("freezes while paused and immediately repositions on a paused seek", () => {
    const playing = advanceLyricPlaybackClock(createLyricPlaybackClock(), {
      reportedMusicTime: 8,
      frameTimeMs: 1000,
      isPlaying: true,
      playbackRate: 1,
    });
    const paused = advanceLyricPlaybackClock(playing.state, {
      reportedMusicTime: 8.2,
      frameTimeMs: 1200,
      isPlaying: false,
      playbackRate: 1,
    });
    const frozen = advanceLyricPlaybackClock(paused.state, {
      reportedMusicTime: 8.2,
      frameTimeMs: 1800,
      isPlaying: false,
      playbackRate: 1,
    });
    const seek = advanceLyricPlaybackClock(frozen.state, {
      reportedMusicTime: 42,
      frameTimeMs: 1900,
      isPlaying: false,
      playbackRate: 1,
    });

    expect(frozen.musicTime).toBeCloseTo(8.2, 5);
    expect(seek.musicTime).toBe(42);
    expect(seek.discontinuity).toBe(true);
    expect(seek.visualReset).toBe(true);
  });

  it("reconstructs forward and backward seeks from the reported time", () => {
    const first = advanceLyricPlaybackClock(createLyricPlaybackClock(), {
      reportedMusicTime: 30,
      frameTimeMs: 1000,
      isPlaying: true,
      playbackRate: 1,
    });
    const forward = advanceLyricPlaybackClock(first.state, {
      reportedMusicTime: 50,
      frameTimeMs: 1100,
      isPlaying: true,
      playbackRate: 1,
    });
    const backward = advanceLyricPlaybackClock(forward.state, {
      reportedMusicTime: 10,
      frameTimeMs: 1200,
      isPlaying: true,
      playbackRate: 1,
    });

    expect(forward.discontinuity).toBe(true);
    expect(forward.musicTime).toBe(50);
    expect(backward.discontinuity).toBe(true);
    expect(backward.musicTime).toBe(10);
    expect(backward.visualReset).toBe(true);
  });

  it("reanchors after a long frame gap and clamps to a known song duration", () => {
    const first = advanceLyricPlaybackClock(createLyricPlaybackClock(), {
      reportedMusicTime: 89.9,
      frameTimeMs: 1000,
      isPlaying: true,
      playbackRate: 2,
      duration: 90,
    });
    const resumed = advanceLyricPlaybackClock(first.state, {
      reportedMusicTime: 89.9,
      frameTimeMs: 1600,
      isPlaying: true,
      playbackRate: 2,
      duration: 90,
    });

    expect(resumed.discontinuity).toBe(true);
    expect(resumed.musicTime).toBe(89.9);
    expect(resumed.visualReset).toBe(true);
  });
});
