import { describe, expect, it, vi } from "vitest";
import {
  LYRIC_FILM_STAGE_LIMITS,
  drawLyricFilmStage,
  getLyricFilmStageParticleCount,
  resolveLyricFilmStageRig,
  resolveLyricFilmStageFrame,
  resolveLyricFilmTransitionFrame,
  sampleLyricFilmIllumination,
  type LyricFilmStageDrawInput,
  type LyricFilmStageInput,
  type LyricFilmStageTransition,
} from "./lyricFilmStage";

function makeInput(overrides: Partial<LyricFilmStageInput> = {}): LyricFilmStageInput {
  return {
    startTime: 10,
    endTime: 20,
    musicTime: 15,
    seed: 48271,
    profile: "spotlight",
    transitionOut: null,
    isPlaying: true,
    reducedMotion: false,
    ...overrides,
  };
}

function makeCanvasContext() {
  const calls: Record<string, number> = {};
  const state = {
    stackDepth: 0,
    globalAlpha: 1,
    globalAlphaValues: [] as number[],
    drawAlphas: [] as Array<{ method: string; alpha: number }>,
  };
  const record = (name: string) => {
    calls[name] = (calls[name] ?? 0) + 1;
  };
  const gradient = { addColorStop: vi.fn() };
  const ctx = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "createLinearGradient" || property === "createRadialGradient") {
          return (..._args: unknown[]) => {
            record(String(property));
            return gradient;
          };
        }
        if (property === "calls") return calls;
        if (property === "stackDepth") return state.stackDepth;
        if (property === "globalAlphaValues") return state.globalAlphaValues;
        if (property === "drawAlphas") return state.drawAlphas;
        if (property === "save") {
          return () => {
            state.stackDepth += 1;
            record("save");
          };
        }
        if (property === "restore") {
          return () => {
            state.stackDepth -= 1;
            record("restore");
          };
        }
        return (..._args: unknown[]) => {
          const method = String(property);
          record(method);
          if (["fill", "fillRect", "stroke"].includes(method)) {
            state.drawAlphas.push({ method, alpha: state.globalAlpha });
          }
        };
      },
      set(_target, property, value) {
        if (property === "globalAlpha") {
          state.globalAlpha = Number(value);
          state.globalAlphaValues.push(state.globalAlpha);
        }
        return true;
      },
    }
  ) as CanvasRenderingContext2D & {
    calls: Record<string, number>;
    drawAlphas: Array<{ method: string; alpha: number }>;
    globalAlphaValues: number[];
    stackDepth: number;
  };

  return { ctx, calls };
}

describe("resolveLyricFilmStageFrame", () => {
  it("reconstructs the same camera and atmosphere for a seek to the same music time", () => {
    const input = makeInput({ musicTime: 16.25, profile: "prism" });
    const first = resolveLyricFilmStageFrame(input);
    const afterSeek = resolveLyricFilmStageFrame({ ...input, musicTime: 18, seed: 7 });
    const returned = resolveLyricFilmStageFrame(input);

    expect(returned).toEqual(first);
    expect(afterSeek.camera).not.toEqual(first.camera);
    expect(first.profile).toBe("prism");
    expect(first.particleCount).toBeLessThanOrEqual(LYRIC_FILM_STAGE_LIMITS.maxParticles);
  });

  it("clamps progress and camera motion at shot boundaries", () => {
    const before = resolveLyricFilmStageFrame(makeInput({ musicTime: -50 }));
    const start = resolveLyricFilmStageFrame(makeInput({ musicTime: 10 }));
    const middle = resolveLyricFilmStageFrame(makeInput({ musicTime: 15 }));
    const after = resolveLyricFilmStageFrame(makeInput({ musicTime: 50 }));

    expect(before.progress).toBe(0);
    expect(start.progress).toBe(0);
    expect(after.progress).toBe(1);
    expect(before.camera).toEqual(start.camera);
    expect(Math.abs(after.camera.zoom - start.camera.zoom)).toBeCloseTo(0.052, 4);
    expect(
      (middle.camera.zoom - start.camera.zoom) * (after.camera.zoom - start.camera.zoom)
    ).toBeGreaterThan(0);
    expect(Math.abs(after.camera.x)).toBeLessThanOrEqual(0.08);
    expect(Math.abs(after.camera.y)).toBeLessThanOrEqual(0.08);
  });

  it("uses a single directional push-pull and horizontal move across each shot", () => {
    const times = [10, 12.5, 15, 17.5, 20];
    const seeds = [48271, 7, 13];
    const followsOneDirection = (values: number[]) => {
      const deltas = values.slice(1).map((value, index) => value - values[index]!);
      const direction = Math.sign(deltas[deltas.length - 1]!);
      return direction !== 0 && deltas.every((delta) => delta * direction >= -1e-9);
    };
    const zoomDirections = new Set<number>();
    const panDirections = new Set<number>();

    for (const seed of seeds) {
      const frames = times.map((musicTime) =>
        resolveLyricFilmStageFrame(makeInput({ musicTime, seed }))
      );
      const zooms = frames.map(({ camera }) => camera.zoom);
      const pans = frames.map(({ camera }) => camera.x);

      expect(Math.abs(zooms[zooms.length - 1]! - zooms[0]!)).toBeGreaterThan(0.02);
      expect(Math.abs(pans[pans.length - 1]! - pans[0]!)).toBeGreaterThan(0.02);
      expect(followsOneDirection(zooms)).toBe(true);
      expect(followsOneDirection(pans)).toBe(true);
      zoomDirections.add(Math.sign(zooms[zooms.length - 1]! - zooms[0]!));
      panDirections.add(Math.sign(pans[pans.length - 1]! - pans[0]!));
    }

    expect(zoomDirections.size).toBe(2);
    expect(panDirections.size).toBe(2);
  });

  it("freezes continuous camera and particle drift while reduced motion is enabled", () => {
    const early = resolveLyricFilmStageFrame(
      makeInput({ musicTime: 11, profile: "botanical", reducedMotion: true })
    );
    const late = resolveLyricFilmStageFrame(
      makeInput({ musicTime: 19, profile: "botanical", reducedMotion: true })
    );

    expect(late.progress).toBeGreaterThan(early.progress);
    expect(late.camera).toEqual(early.camera);
    expect(late.particlePhase).toBe(early.particlePhase);
    expect(late.fogPhase).toBe(early.fogPhase);
    expect(late.profile).toBe("botanical");
  });

  it("scales continuous motion speed without changing shot-time progress", () => {
    const baseline = resolveLyricFilmStageFrame(makeInput({ musicTime: 14, motionSpeed: 1 }));
    const slower = resolveLyricFilmStageFrame(makeInput({ musicTime: 14, motionSpeed: 0.5 }));
    const faster = resolveLyricFilmStageFrame(makeInput({ musicTime: 14, motionSpeed: 1.5 }));

    expect(slower.progress).toBe(baseline.progress);
    expect(faster.progress).toBe(baseline.progress);
    expect(slower.particlePhase).toBeCloseTo(baseline.particlePhase * 0.5, 6);
    expect(faster.particlePhase).toBeCloseTo(baseline.particlePhase * 1.5, 6);
    expect(slower.camera).not.toEqual(baseline.camera);
    expect(faster.beamAngle).not.toBe(baseline.beamAngle);
    expect(faster.fogPhase).not.toBe(baseline.fogPhase);
  });

  it("defaults motion speed to one, clamps it to zero through two, and preserves paused low amplitude", () => {
    const defaults = resolveLyricFilmStageFrame(makeInput({ musicTime: 14 }));
    const explicitNormal = resolveLyricFilmStageFrame(makeInput({ musicTime: 14, motionSpeed: 1 }));
    const stopped = resolveLyricFilmStageFrame(makeInput({ musicTime: 14, motionSpeed: 0 }));
    const belowZero = resolveLyricFilmStageFrame(makeInput({ musicTime: 14, motionSpeed: -4 }));
    const maximum = resolveLyricFilmStageFrame(makeInput({ musicTime: 14, motionSpeed: 2 }));
    const aboveMaximum = resolveLyricFilmStageFrame(makeInput({ musicTime: 14, motionSpeed: 8 }));
    const paused = resolveLyricFilmStageFrame(
      makeInput({ musicTime: 14, isPlaying: false, motionSpeed: 1 })
    );

    expect(defaults).toEqual(explicitNormal);
    expect(stopped.particlePhase).toBe(0);
    expect(belowZero).toEqual(stopped);
    expect(aboveMaximum).toEqual(maximum);
    const activeCameraTravel = defaults.camera.zoom - stopped.camera.zoom;
    const pausedCameraTravel = paused.camera.zoom - stopped.camera.zoom;
    expect(pausedCameraTravel / activeCameraTravel).toBeCloseTo(0.16, 5);
  });

  it("suppresses the flare and focus animation under reduced motion", () => {
    const transitionOut: LyricFilmStageTransition = { kind: "flare-cut", duration: 0.8 };
    const normal = resolveLyricFilmStageFrame(
      makeInput({ musicTime: 19.6, transitionOut, reducedMotion: false })
    );
    const reduced = resolveLyricFilmStageFrame(
      makeInput({ musicTime: 19.6, transitionOut, reducedMotion: true })
    );

    expect(normal.transition?.flare).toBeGreaterThan(0);
    expect(reduced.transition?.flare).toBe(0);
    expect(reduced.transition?.focus).toBe(0);
    expect(reduced.transition?.progress).toBe(normal.transition?.progress);
  });

  it("keeps the selected profile and composition deterministic while paused", () => {
    const input = makeInput({ musicTime: 13, profile: "astral", isPlaying: false });

    expect(resolveLyricFilmStageFrame(input)).toEqual(resolveLyricFilmStageFrame(input));
    expect(resolveLyricFilmStageFrame(input).profile).toBe("astral");
  });

  it("uses a neutral finite frame for invalid time bounds", () => {
    const frame = resolveLyricFilmStageFrame(
      makeInput({ startTime: Number.NaN, endTime: Number.POSITIVE_INFINITY, musicTime: Number.NaN })
    );

    expect(frame.progress).toBe(0);
    expect(Number.isFinite(frame.camera.zoom)).toBe(true);
    expect(Number.isFinite(frame.camera.x)).toBe(true);
    expect(frame.particleCount).toBeGreaterThan(0);
  });
});

describe("resolveLyricFilmTransitionFrame", () => {
  const kinds: LyricFilmStageTransition["kind"][] = ["lights-out", "flare-cut", "focus-pull"];

  it.each(kinds)("resolves %s from absolute time with bounded progress", (kind) => {
    const transition: LyricFilmStageTransition = { kind, duration: 0.8 };
    const before = resolveLyricFilmTransitionFrame(transition, 10, 8.9);
    const middle = resolveLyricFilmTransitionFrame(transition, 10, 9.6);
    const after = resolveLyricFilmTransitionFrame(transition, 10, 12);

    expect(before?.progress).toBe(0);
    expect(middle?.progress).toBeCloseTo(0.5, 5);
    expect(after?.progress).toBe(1);
    expect([before?.blackout, before?.flare, before?.focus]).toHaveLength(3);
    expect([middle?.blackout, middle?.flare, middle?.focus].every(Number.isFinite)).toBe(true);
    expect([after?.blackout, after?.flare, after?.focus].every(Number.isFinite)).toBe(true);
  });

  it("clamps transition duration to the specified short cinematic range", () => {
    const tooShort = resolveLyricFilmTransitionFrame({ kind: "lights-out", duration: 0 }, 10, 10);
    const tooLong = resolveLyricFilmTransitionFrame({ kind: "focus-pull", duration: 20 }, 10, 8.9);

    expect(tooShort?.progress).toBeCloseTo(1, 5);
    expect(tooLong?.progress).toBe(0);
    expect(LYRIC_FILM_STAGE_LIMITS.minTransitionSeconds).toBeGreaterThan(0);
    expect(LYRIC_FILM_STAGE_LIMITS.maxTransitionSeconds).toBeLessThanOrEqual(1.1);
  });

  it("does not emit a transition when the descriptor or boundary is invalid", () => {
    expect(resolveLyricFilmTransitionFrame(null, 10, 9)).toBeNull();
    expect(
      resolveLyricFilmTransitionFrame({ kind: "flare-cut", duration: 1 }, Number.NaN, 9)
    ).toBeNull();
  });
});

describe("drawLyricFilmStage", () => {
  it("does no canvas work for an empty viewport", () => {
    const { ctx, calls } = makeCanvasContext();
    const input: LyricFilmStageDrawInput = {
      ctx,
      frame: resolveLyricFilmStageFrame(makeInput()),
      width: 0,
      height: 720,
      dpr: 2,
    };

    drawLyricFilmStage(input);

    expect(Object.keys(calls)).toHaveLength(0);
  });

  it("applies caller opacity to every stage layer for crossfade compositing", () => {
    const { ctx, calls } = makeCanvasContext();
    const frame = resolveLyricFilmStageFrame(
      makeInput({
        musicTime: 19.8,
        transitionOut: { kind: "flare-cut", duration: 0.8 },
      })
    );

    drawLyricFilmStage({ ctx, frame, width: 800, height: 600, dpr: 1, opacity: 0.5 });

    expect(calls.fillRect).toBeGreaterThan(0);
    expect(ctx.globalAlphaValues.length).toBeGreaterThan(0);
    const drawAlphaValues = ctx.drawAlphas.map(({ alpha }) => alpha);
    expect(Math.max(...drawAlphaValues)).toBeLessThanOrEqual(0.5);
    expect(Math.min(...drawAlphaValues)).toBeGreaterThanOrEqual(0);
    expect(ctx.drawAlphas.some(({ method }) => method === "stroke")).toBe(true);
    expect(drawAlphaValues.every((alpha) => alpha >= 0 && alpha <= 0.5)).toBe(true);
  });

  it("does no canvas work when caller opacity is zero", () => {
    const { ctx, calls } = makeCanvasContext();

    drawLyricFilmStage({
      ctx,
      frame: resolveLyricFilmStageFrame(makeInput()),
      width: 800,
      height: 600,
      dpr: 1,
      opacity: 0,
    });

    expect(Object.keys(calls)).toHaveLength(0);
  });

  it("scales stage light independently from shot crossfade opacity", () => {
    const low = makeCanvasContext();
    const high = makeCanvasContext();
    const frame = resolveLyricFilmStageFrame(makeInput({ profile: "spotlight", seed: 13 }));

    drawLyricFilmStage({
      ctx: low.ctx,
      frame,
      width: 800,
      height: 600,
      dpr: 1,
      opacity: 0.5,
      lightIntensity: 0.5,
    });
    drawLyricFilmStage({
      ctx: high.ctx,
      frame,
      width: 800,
      height: 600,
      dpr: 1,
      opacity: 0.5,
      lightIntensity: 1.5,
    });

    const maxFillAlpha = (alphas: typeof low.ctx.drawAlphas) =>
      Math.max(
        ...alphas
          .filter(({ method }) => method === "fill")
          .slice(0, 4)
          .map(({ alpha }) => alpha)
      );
    expect(maxFillAlpha(high.ctx.drawAlphas)).toBeGreaterThan(maxFillAlpha(low.ctx.drawAlphas));
    expect(Math.max(...high.ctx.globalAlphaValues)).toBeLessThanOrEqual(1);
    expect(high.ctx.stackDepth).toBe(0);
  });

  it("draws bounded Canvas 2D stage layers and lowers dust work at high DPR", () => {
    const { ctx, calls } = makeCanvasContext();
    const frame = resolveLyricFilmStageFrame(makeInput({ profile: "motes", seed: 9107 }));

    drawLyricFilmStage({ ctx, frame, width: 1920, height: 1080, dpr: 4 });

    expect(calls.fillRect).toBeGreaterThan(0);
    expect(calls.createLinearGradient).toBeGreaterThan(0);
    expect(calls.arc).toBeLessThanOrEqual(getLyricFilmStageParticleCount(4));
    expect(getLyricFilmStageParticleCount(4)).toBeLessThan(getLyricFilmStageParticleCount(1));
    expect(getLyricFilmStageParticleCount(4)).toBeLessThanOrEqual(
      LYRIC_FILM_STAGE_LIMITS.maxParticles
    );
  });

  it.each(["spotlight", "prism", "window", "caustic", "botanical", "astral", "motes"] as const)(
    "draws the %s stage profile without requiring external assets",
    (profile) => {
      const { ctx, calls } = makeCanvasContext();
      const frame = resolveLyricFilmStageFrame(makeInput({ profile }));

      expect(() =>
        drawLyricFilmStage({ ctx, frame, width: 800, height: 600, dpr: 1 })
      ).not.toThrow();
      expect(calls.fillRect).toBeGreaterThan(0);
      expect(ctx.stackDepth).toBe(0);
    }
  );
});

describe("Lyric Film stage composition", () => {
  it("gives each lighting profile a recognizable fixture layout", () => {
    const profiles = [
      "spotlight",
      "prism",
      "window",
      "caustic",
      "botanical",
      "astral",
      "motes",
    ] as const;
    const rigs = profiles.map((profile) => resolveLyricFilmStageRig(profile, 48271));
    const fixtureLayouts = rigs.map((rig) => rig.geometry);
    const lightLayouts = rigs.map((rig) =>
      rig.lights.map(({ kind, x1, y1, x2, y2 }) => [kind, x1, y1, x2, y2].join(":")).join("|")
    );

    expect(new Set(fixtureLayouts).size).toBe(profiles.length);
    expect(new Set(lightLayouts).size).toBe(profiles.length);
  });

  it("keeps the lyric band dim and returns a deterministic local light field", () => {
    const profiles = [
      "spotlight",
      "prism",
      "window",
      "caustic",
      "botanical",
      "astral",
      "motes",
    ] as const;
    const lyricPositions = [
      [0.42, 0.31],
      [0.5, 0.43],
      [0.58, 0.5],
      [0.42, 0.57],
      [0.58, 0.69],
    ] as const;
    const maxLyricBandLight = Math.max(
      ...profiles.flatMap((profile) => {
        const profileFrame = resolveLyricFilmStageFrame(makeInput({ profile, seed: 48271 }));
        return lyricPositions.map(([x, y]) => sampleLyricFilmIllumination(profileFrame, x, y));
      })
    );
    const frame = resolveLyricFilmStageFrame(makeInput({ profile: "window", seed: 48271 }));
    const center = sampleLyricFilmIllumination(frame, 0.5, 0.5);
    const repeated = sampleLyricFilmIllumination(frame, 0.5, 0.5);
    const floorLight = sampleLyricFilmIllumination(frame, 0.82, 0.86);

    expect(center).toBe(repeated);
    expect(center).toBeGreaterThanOrEqual(0);
    expect(center).toBeLessThanOrEqual(0.3);
    expect(maxLyricBandLight).toBeLessThanOrEqual(0.3);
    expect(floorLight).toBeGreaterThan(center + 0.15);
    expect(floorLight).toBeLessThanOrEqual(1);
    expect(sampleLyricFilmIllumination(frame, Number.NaN, 0.5)).toBe(0);
  });
});
