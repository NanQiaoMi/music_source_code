import { describe, expect, it } from "vitest";
import type { PlaybackPhase } from "@/lib/audio/playbackStateMachine";
import {
  PLAYER3D_PRESENCE_MODE,
  PLAYER3D_TRACK_CHANGE_OFFSET,
  PLAYER3D_TRACK_CHANGE_TRANSITION,
  getPlayer3DAuraOpacity,
  getPlayer3DCoverScale,
  getPlayer3DTrackMotion,
  isPlayer3DVisualsActive,
  readPlayer3DAudioLevel,
  shouldRunPlayer3DFrameLoop,
} from "./player3dMotion";

describe("Player3D motion policy", () => {
  it("animates only after the confirmed playing phase and respects reduced motion", () => {
    const phases: PlaybackPhase[] = [
      "idle",
      "loading",
      "playing",
      "paused",
      "buffering",
      "ended",
      "error",
    ];

    expect(phases.filter((phase) => isPlayer3DVisualsActive(phase, false))).toEqual(["playing"]);
    expect(isPlayer3DVisualsActive("playing", true)).toBe(false);
  });

  describe("shouldRunPlayer3DFrameLoop", () => {
    it("stops sampling while another view is active even if playback is playing", () => {
      expect(
        shouldRunPlayer3DFrameLoop({
          phase: "playing",
          reducedMotion: false,
          isPlayerViewActive: false,
        })
      ).toBe(false);
    });

    it("runs while the player view is active and playback is playing", () => {
      expect(
        shouldRunPlayer3DFrameLoop({
          phase: "playing",
          reducedMotion: false,
          isPlayerViewActive: true,
        })
      ).toBe(true);
    });

    it("stays off when reduced motion is preferred", () => {
      expect(
        shouldRunPlayer3DFrameLoop({
          phase: "playing",
          reducedMotion: true,
          isPlayerViewActive: true,
        })
      ).toBe(false);
    });

    it("stays off before playback is confirmed playing", () => {
      const phase: PlaybackPhase[] = ["idle", "loading", "paused", "buffering", "ended", "error"];
      expect(
        phase.filter((value) =>
          shouldRunPlayer3DFrameLoop({
            phase: value,
            reducedMotion: false,
            isPlayerViewActive: true,
          })
        )
      ).toEqual([]);
    });
  });

  it("uses a small pop-layout spring so the latest track target stays in flow", () => {
    expect(PLAYER3D_PRESENCE_MODE).toBe("popLayout");
    expect(PLAYER3D_TRACK_CHANGE_OFFSET).toBeLessThanOrEqual(6);
    expect(PLAYER3D_TRACK_CHANGE_TRANSITION).toMatchObject({
      type: "spring",
      damping: expect.any(Number),
      mass: expect.any(Number),
      stiffness: expect.any(Number),
      bounce: 0,
    });
    expect(PLAYER3D_TRACK_CHANGE_TRANSITION.damping).toBeGreaterThan(
      PLAYER3D_TRACK_CHANGE_TRANSITION.stiffness * 0.05
    );
    expect(getPlayer3DTrackMotion(false)).toMatchObject({
      offset: PLAYER3D_TRACK_CHANGE_OFFSET,
      initial: { opacity: 1, y: PLAYER3D_TRACK_CHANGE_OFFSET },
      exit: { opacity: 0, pointerEvents: "none" },
      transition: PLAYER3D_TRACK_CHANGE_TRANSITION,
    });
  });

  it("removes track movement and fades when reduced motion is preferred", () => {
    expect(getPlayer3DTrackMotion(true)).toMatchObject({
      offset: 0,
      initial: false,
      exit: { opacity: 1, y: 0, pointerEvents: "none" },
      transition: { duration: 0 },
    });
  });

  it("reads the existing running analyser and leaves only a dim aura without audio", () => {
    const analyser = {
      context: { state: "running" },
      frequencyBinCount: 8,
      getByteFrequencyData: (data: Uint8Array) => data.set([128, 64, 32, 0, 255, 255, 255, 255]),
    } as unknown as AnalyserNode;
    const samples = new Uint8Array(analyser.frequencyBinCount);
    const level = readPlayer3DAudioLevel(analyser, samples);

    expect(level).toBeCloseTo(96 / 255);
    expect(readPlayer3DAudioLevel(null, samples)).toBe(0);
    expect(getPlayer3DAuraOpacity(true, 0)).toBeLessThanOrEqual(0.08);
    expect(getPlayer3DAuraOpacity(false, level)).toBe(0);
    expect(getPlayer3DCoverScale(true, 1)).toBeCloseTo(1.012);
    expect(getPlayer3DCoverScale(false, 1)).toBe(1);
  });

  it("falls back to silence when analyser access is unavailable", () => {
    const analyser = {
      context: { state: "running" },
      frequencyBinCount: 4,
      getByteFrequencyData: () => {
        throw new Error("analyser unavailable");
      },
    } as unknown as AnalyserNode;

    expect(readPlayer3DAudioLevel(analyser, new Uint8Array(4))).toBe(0);
  });
});
