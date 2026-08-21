import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  playTactileTick,
  playMechanicalGearTick,
  playCardSelectTick,
  playModeSwitchTick,
  setTactileVolume,
  getTactileVolume,
} from "./tactileSound";

describe("tactileSound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows setting and getting master volume", () => {
    setTactileVolume(0.75);
    expect(getTactileVolume()).toBe(0.75);

    setTactileVolume(1.5); // clamps to 1
    expect(getTactileVolume()).toBe(1);

    setTactileVolume(-0.2); // clamps to 0
    expect(getTactileVolume()).toBe(0);

    setTactileVolume(0.5);
  });

  it("handles playTactileTick safely in headless / test environment", () => {
    expect(() => {
      playTactileTick();
      playTactileTick({ freq: 1100, volume: 0.5, type: "gear" });
      playTactileTick({ type: "snap" });
      playTactileTick({ type: "soft" });
      playTactileTick({ type: "switch" });
    }).not.toThrow();
  });

  it("handles playMechanicalGearTick with step and velocity modulation", () => {
    expect(() => {
      playMechanicalGearTick(0, 1.0);
      playMechanicalGearTick(1, 1.2);
      playMechanicalGearTick(2, 0.8);
    }).not.toThrow();
  });

  it("handles playCardSelectTick and playModeSwitchTick without errors", () => {
    expect(() => {
      playCardSelectTick();
      playModeSwitchTick();
    }).not.toThrow();
  });
});
