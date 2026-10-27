import { describe, expect, it } from "vitest";
import { resolveDetectionFps, resolveDetectionIntervalMs } from "../timing";

describe("gesture timing", () => {
  it("uses maxFps while a hand is present", () => {
    expect(resolveDetectionFps(30, true)).toBe(30);
    expect(resolveDetectionIntervalMs(30, true)).toBeCloseTo(31.33, 2);
  });

  it("caps detection to the idle rate when no hand is present", () => {
    expect(resolveDetectionFps(30, false)).toBe(12);
    expect(resolveDetectionIntervalMs(30, false)).toBeCloseTo(81.33, 2);
  });

  it("never raises the configured cap for slow settings", () => {
    expect(resolveDetectionFps(10, false)).toBe(10);
    expect(resolveDetectionFps(10, true)).toBe(10);
  });

  it("falls back to 30fps for invalid configuration", () => {
    expect(resolveDetectionFps(0, true)).toBe(30);
    expect(resolveDetectionFps(Number.NaN, false)).toBe(12);
    expect(resolveDetectionIntervalMs(0, true)).toBeCloseTo(31.33, 2);
  });
});
