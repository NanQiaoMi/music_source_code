import { describe, expect, it } from "vitest";
import { createAudioSnapshot } from "./audioSnapshot";

describe("createAudioSnapshot", () => {
  it("normalizes missing time fields to zero", () => {
    expect(createAudioSnapshot({})).toEqual({
      currentTime: 0,
      duration: 0,
      isPlaying: false,
    });
  });

  it("clamps negative time fields to zero", () => {
    expect(createAudioSnapshot({ currentTime: -4, duration: -20, isPlaying: true })).toEqual({
      currentTime: 0,
      duration: 0,
      isPlaying: true,
    });
  });

  it("normalizes non-finite time fields to zero", () => {
    expect(
      createAudioSnapshot({
        currentTime: Number.POSITIVE_INFINITY,
        duration: Number.NaN,
        isPlaying: true,
      })
    ).toEqual({
      currentTime: 0,
      duration: 0,
      isPlaying: true,
    });
  });

  it("preserves playing state and positive time fields", () => {
    expect(createAudioSnapshot({ currentTime: 42.5, duration: 180, isPlaying: true })).toEqual({
      currentTime: 42.5,
      duration: 180,
      isPlaying: true,
    });
  });
});
