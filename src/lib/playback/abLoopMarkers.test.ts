import { describe, expect, it } from "vitest";
import { buildABLoopMarkerLayout } from "./abLoopMarkers";

describe("buildABLoopMarkerLayout", () => {
  it("returns marker percentages for a valid loop range", () => {
    expect(
      buildABLoopMarkerLayout({
        isEnabled: true,
        pointA: 30,
        pointB: 90,
        duration: 120,
      })
    ).toEqual({
      pointAPercent: 25,
      pointBPercent: 75,
      rangeLeftPercent: 25,
      rangeWidthPercent: 50,
    });
  });

  it("does not render markers for disabled or invalid ranges", () => {
    expect(
      buildABLoopMarkerLayout({
        isEnabled: false,
        pointA: 30,
        pointB: 90,
        duration: 120,
      })
    ).toBeNull();
    expect(
      buildABLoopMarkerLayout({
        isEnabled: true,
        pointA: 90,
        pointB: 30,
        duration: 120,
      })
    ).toBeNull();
    expect(
      buildABLoopMarkerLayout({
        isEnabled: true,
        pointA: 30,
        pointB: 90,
        duration: 0,
      })
    ).toBeNull();
  });

  it("clamps out-of-range points to the playable duration", () => {
    expect(
      buildABLoopMarkerLayout({
        isEnabled: true,
        pointA: -10,
        pointB: 150,
        duration: 120,
      })
    ).toEqual({
      pointAPercent: 0,
      pointBPercent: 100,
      rangeLeftPercent: 0,
      rangeWidthPercent: 100,
    });
  });
});
