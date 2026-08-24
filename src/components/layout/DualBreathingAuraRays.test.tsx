import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DualBreathingAuraRays } from "./DualBreathingAuraRays";

describe("DualBreathingAuraRays", () => {
  it("renders dual breathing aura ray elements properly", () => {
    const html = renderToStaticMarkup(
      <DualBreathingAuraRays
        primary="#9333ea"
        secondary="#3b82f6"
        accent="#ec4899"
        isPlaying={false}
      />
    );

    expect(html).toContain("pointer-events-none");
    expect(html).toContain("aria-hidden=\"true\"");
    expect(html).toContain("radial-gradient");
  });

  it("applies dynamic colors to the radial gradient styles", () => {
    const html = renderToStaticMarkup(
      <DualBreathingAuraRays
        primary="rgb(255, 100, 50)"
        secondary="rgb(50, 200, 255)"
        accent="rgb(255, 200, 0)"
        isPlaying={true}
      />
    );

    expect(html).toContain("rgb(255, 100, 50)");
    expect(html).toContain("rgb(50, 200, 255)");
  });
});
