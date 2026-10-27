import { describe, expect, it } from "vitest";
import { compileLyricFilmProgram } from "./lyricFilmProgram";
import { resolveLyricFilmLyricRows } from "./lyricFilmLyrics";
import * as handwrittenMotion from "./handwrittenMotion";
import {
  blendHandwrittenCamera,
  resolveHandwrittenReducedMotionShot,
  resolveHandwrittenRevealOpacity,
  resolveHandwrittenRowMode,
  resolveHandwrittenSnapshotTime,
  resolveHandwrittenTranslationTime,
  resolveHandwrittenTransitionFrame,
} from "./handwrittenMotion";
import { parseTimedLyrics } from "./lyricTimeline";

const newMotionHelpers = handwrittenMotion as typeof handwrittenMotion & {
  buildHandwrittenSnapshotRenderKey?: (
    baseKey: string,
    pixelRatio: number,
    translationLyricsText: string
  ) => string;
  canFitHandwrittenVerticalColumn?: (
    height: number,
    unitCount: number,
    reservedBottomSpace: number,
    minimumFontSize?: number
  ) => boolean;
  shouldRenderHandwrittenOutgoingLive?: (musicTime: number, contentReadyTime: number) => boolean;
  resolveHandwrittenReducedMotionReveal?: (
    reducedMotion: boolean,
    mode: "past" | "active" | "future"
  ) => number | undefined;
};

describe("handwritten transition timing", () => {
  it("retains visible outgoing ink before the incoming LRC can begin", () => {
    const frame = resolveHandwrittenTransitionFrame(10, 12, 11.6);
    expect(frame.outgoingAlpha).toBeGreaterThan(0.08);
  });
  it("keeps the outgoing and incoming pages readable in separate phases", () => {
    const start = resolveHandwrittenTransitionFrame(10, 12, 10);
    const lift = resolveHandwrittenTransitionFrame(10, 12, 10.96);
    const arrival = resolveHandwrittenTransitionFrame(10, 12, 11.8);
    const end = resolveHandwrittenTransitionFrame(10, 12, 12);

    expect(start.outgoingAlpha).toBe(1);
    expect(start.incomingAlpha).toBe(0);
    expect(lift.outgoingAlpha).toBeGreaterThan(0.15);
    expect(lift.incomingAlpha).toBeGreaterThan(0.1);
    expect(lift.pageLift).toBeGreaterThan(0.8);
    expect(lift.outgoingProgress).toBeGreaterThan(0.5);
    expect(lift.incomingProgress).toBeGreaterThan(0.1);
    expect(arrival.incomingAlpha).toBeGreaterThan(0.5);
    expect(end.outgoingAlpha).toBe(0);
    expect(end.incomingAlpha).toBe(1);
    expect(end.pageLift).toBe(0);
  });

  it("uses the transition boundary as the deterministic outgoing snapshot time", () => {
    const seekOrder = [11.8, 10.1, 11.2, 10.9];
    const forward = seekOrder.map((time) => resolveHandwrittenTransitionFrame(10, 12, time));
    const reverse = [...seekOrder]
      .reverse()
      .map((time) => resolveHandwrittenTransitionFrame(10, 12, time))
      .reverse();

    expect(reverse).toEqual(forward);
    expect(forward.every((frame) => frame.snapshotTime === 10)).toBe(true);
  });

  it("waits for the outgoing lyric's final timed unit, bounded by the page turn", () => {
    expect(resolveHandwrittenSnapshotTime(10, 12, 11.4)).toBe(11.4);
    expect(resolveHandwrittenSnapshotTime(10, 12, 9)).toBe(10);
    expect(resolveHandwrittenSnapshotTime(10, 12, 15)).toBe(12);
  });

  it("passes the ready lyric time through to the transition frame snapshot", () => {
    const frame = resolveHandwrittenTransitionFrame(10, 12, 10.6, 11.4);
    expect(frame.snapshotTime).toBe(11.4);
  });

  it("keeps the outgoing page live until its last LRC unit is ready", () => {
    const program = compileLyricFilmProgram(
      parseTimedLyrics(
        "[00:00.00]A long phrase finishes exactly at the page turn\n[00:12.00]Next line"
      ),
      "transition-live-outgoing",
      18
    );
    const outgoing = program.shots.find(
      (shot) => shot.kind === "lyrics" && shot.transitionOut !== null
    );
    expect(outgoing).toBeDefined();

    const shot = outgoing!;
    const transition = shot.transitionOut!;
    const rows = resolveLyricFilmLyricRows(program, shot, transition.startTime).filter((row) =>
      shot.lineGroupIndices.includes(row.groupIndex)
    );
    const readyTime = Math.max(...rows.map((row) => row.revealEndTime));
    const canonicalTime = resolveHandwrittenSnapshotTime(
      transition.startTime,
      transition.endTime,
      readyTime
    );

    expect(canonicalTime).toBeGreaterThan(transition.startTime);
    const shouldRenderLive = newMotionHelpers.shouldRenderHandwrittenOutgoingLive;
    expect(shouldRenderLive).toBeTypeOf("function");
    if (!shouldRenderLive) return;

    expect(shouldRenderLive(transition.startTime, canonicalTime)).toBe(true);
    expect(shouldRenderLive(canonicalTime - 0.001, canonicalTime)).toBe(true);
    expect(shouldRenderLive(canonicalTime, canonicalTime)).toBe(false);
  });

  it("invalidates the outgoing render cache when translation or DPR changes", () => {
    const keyBuilder = newMotionHelpers.buildHandwrittenSnapshotRenderKey;
    expect(keyBuilder).toBeTypeOf("function");
    if (!keyBuilder) return;

    const original = keyBuilder("shot-pair|time", 1, "旧译文");
    expect(keyBuilder("shot-pair|time", 1, "新译文")).not.toBe(original);
    expect(keyBuilder("shot-pair|time", 2, "旧译文")).not.toBe(original);
  });

  it("keeps translation lookup just inside the outgoing shot end", () => {
    expect(resolveHandwrittenTranslationTime(12, 12, true)).toBe(11.999);
    expect(resolveHandwrittenTranslationTime(11.5, 12, true)).toBe(11.5);
    expect(resolveHandwrittenTranslationTime(12, 12, false)).toBe(12);
  });

  it("clamps malformed and out-of-range transition times safely", () => {
    const zeroDurationBefore = resolveHandwrittenTransitionFrame(8, 8, 7);
    const zeroDurationAfter = resolveHandwrittenTransitionFrame(8, 8, 9);
    expect(zeroDurationBefore.outgoingAlpha).toBe(1);
    expect(zeroDurationAfter.incomingAlpha).toBe(1);
    const before = resolveHandwrittenTransitionFrame(10, 12, -50);
    const after = resolveHandwrittenTransitionFrame(10, 12, 50);
    expect(before.outgoingAlpha).toBe(1);
    expect(before.incomingAlpha).toBe(0);
    expect(after.outgoingAlpha).toBe(0);
    expect(after.incomingAlpha).toBe(1);
  });
});

describe("vertical handwritten layout bounds", () => {
  it("falls back to horizontal layout when readable type and translation cannot fit", () => {
    const canFit = newMotionHelpers.canFitHandwrittenVerticalColumn;
    expect(canFit).toBeTypeOf("function");
    if (!canFit) return;

    expect(canFit(180, 8, 62)).toBe(false);
    expect(canFit(180, 8, 0)).toBe(false);
    expect(canFit(844, 8, 62)).toBe(true);
  });

  it("keeps an early short CJK vertical candidate hidden until its LRC start in reduced motion", () => {
    const program = compileLyricFilmProgram(
      parseTimedLyrics("[00:03.00]短句\n[00:08.00]下一页"),
      "early-vertical-reduced",
      16
    );
    const shot = program.shots.find((candidate) => candidate.kind === "lyrics");
    expect(shot).toBeDefined();
    const row = resolveLyricFilmLyricRows(program, shot!, 0).find(
      (candidate) => candidate.text === "短句"
    );
    expect(row).toBeDefined();
    expect([...row!.text].length).toBeGreaterThanOrEqual(2);
    expect([...row!.text].length).toBeLessThanOrEqual(8);

    const revealForMode = newMotionHelpers.resolveHandwrittenReducedMotionReveal;
    expect(revealForMode).toBeTypeOf("function");
    if (!revealForMode) return;

    const beforeStart = resolveHandwrittenRowMode(
      0,
      row!.startTime,
      program.lineGroups[row!.groupIndex]!.start
    );
    const atStart = resolveHandwrittenRowMode(
      3,
      row!.startTime,
      program.lineGroups[row!.groupIndex]!.start
    );
    expect(beforeStart).toBe("future");
    expect(revealForMode(true, beforeStart)).toBe(0);
    expect(atStart).toBe("active");
    expect(revealForMode(true, atStart)).toBe(1);
  });
});

describe("handwritten camera handoff", () => {
  it("matches both shot cameras exactly at the transition boundaries", () => {
    const outgoing = { zoom: 1.008, x: -0.4, y: 0.22, rotation: -0.001 };
    const incoming = { zoom: 1.019, x: 0.55, y: -0.31, rotation: 0.0012 };

    expect(blendHandwrittenCamera(outgoing, incoming, 0)).toEqual(outgoing);
    expect(blendHandwrittenCamera(outgoing, incoming, 1)).toEqual(incoming);
    const midpoint = blendHandwrittenCamera(outgoing, incoming, 0.5);
    expect(midpoint.zoom).toBeCloseTo((outgoing.zoom + incoming.zoom) / 2);
    expect(midpoint.x).toBeCloseTo((outgoing.x + incoming.x) / 2);
    expect(midpoint.y).toBeCloseTo((outgoing.y + incoming.y) / 2);
    expect(midpoint.rotation).toBeCloseTo((outgoing.rotation + incoming.rotation) / 2);
  });
});

describe("reduced-motion handwritten shot selection", () => {
  it("keeps one complete page at a shot boundary and through a transition midpoint", () => {
    const outgoing = { id: "lyrics", startTime: 0 };
    const incoming = { id: "interlude", startTime: 14 };

    expect(resolveHandwrittenReducedMotionShot(outgoing, incoming, 0).id).toBe("lyrics");
    expect(resolveHandwrittenReducedMotionShot(outgoing, incoming, 12).id).toBe("lyrics");
    expect(resolveHandwrittenReducedMotionShot(outgoing, incoming, 14).id).toBe("interlude");
    expect(resolveHandwrittenReducedMotionShot(outgoing, incoming, 15).id).toBe("interlude");
  });

  it("shows the full lyric at its exact LRC start instead of fading to a blank page", () => {
    expect(resolveHandwrittenRevealOpacity(true, 0)).toBe(1);
    expect(resolveHandwrittenRevealOpacity(true, -0.2)).toBe(1);
    expect(resolveHandwrittenRevealOpacity(false, 0)).toBe(0);
    expect(resolveHandwrittenRevealOpacity(false, 0.24)).toBe(1);
  });
});
