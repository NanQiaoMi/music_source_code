import { describe, expect, it } from "vitest";
import { smoothAudioValue } from "@/lib/audio/audioMotionSmoothing";

describe("smoothAudioValue", () => {
  it("uses time-based attack and release so output is frame-rate independent", () => {
    const singleFrame = smoothAudioValue(0, 1, 32);
    const splitFrames = smoothAudioValue(smoothAudioValue(0, 1, 16), 1, 16);

    expect(splitFrames).toBeCloseTo(singleFrame, 5);
  });

  it("attacks faster than it releases", () => {
    const attack = smoothAudioValue(0, 1, 48);
    const release = smoothAudioValue(1, 0, 48);

    expect(attack).toBeGreaterThan(0.6);
    expect(release).toBeGreaterThan(0.7);
  });

  it("normalizes invalid values and caps long frame gaps", () => {
    expect(Number.isFinite(smoothAudioValue(Number.NaN, 1, 16))).toBe(true);
    expect(smoothAudioValue(0.4, Number.NaN, 0)).toBe(0.4);
    expect(smoothAudioValue(0, 1, 1000)).toBeCloseTo(smoothAudioValue(0, 1, 100));
  });
});
