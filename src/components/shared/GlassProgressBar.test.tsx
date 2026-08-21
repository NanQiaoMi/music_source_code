import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GlassProgressBar, formatTime } from "./GlassProgressBar";

describe("formatTime utility", () => {
  it("formats standard seconds into mm:ss format", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(137)).toBe("2:17");
    expect(formatTime(3600)).toBe("60:00");
  });

  it("handles negative, NaN or non-finite values safely", () => {
    expect(formatTime(-10)).toBe("0:00");
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(Infinity)).toBe("0:00");
  });
});

describe("GlassProgressBar component", () => {
  it("renders elapsed time, duration and progress track correctly", () => {
    const html = renderToStaticMarkup(
      <GlassProgressBar
        currentTime={25}
        duration={100}
        onSeek={vi.fn()}
      />
    );

    expect(html).toContain("0:25");
    expect(html).toContain("1:40");
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain("width:25%");
  });

  it("renders AB loop markers when enabled", () => {
    const html = renderToStaticMarkup(
      <GlassProgressBar
        currentTime={30}
        duration={100}
        abLoopEnabled={true}
        pointA={20}
        pointB={60}
        onSeek={vi.fn()}
      />
    );

    expect(html).toContain(">A<");
    expect(html).toContain(">B<");
    expect(html).toContain("left:20%");
    expect(html).toContain("left:60%");
    expect(html).toContain("width:40%");
  });

  it("renders buffered ranges segments", () => {
    const html = renderToStaticMarkup(
      <GlassProgressBar
        currentTime={10}
        duration={100}
        bufferedRanges={[
          { start: 0, end: 40 },
          { start: 50, end: 80 },
        ]}
        onSeek={vi.fn()}
      />
    );

    expect(html).toContain("width:40%");
    expect(html).toContain("left:50%");
    expect(html).toContain("width:30%");
  });

  it("applies custom dynamic accent color correctly", () => {
    const html = renderToStaticMarkup(
      <GlassProgressBar
        currentTime={50}
        duration={100}
        accentColor="rgb(236, 72, 153)"
        onSeek={vi.fn()}
      />
    );

    expect(html).toContain("rgb(236, 72, 153)");
  });

  it("gracefully displays 0:00 when duration is unavailable", () => {
    const html = renderToStaticMarkup(
      <GlassProgressBar
        currentTime={0}
        duration={0}
        onSeek={vi.fn()}
      />
    );

    expect(html).toContain("0:00");
    expect(html).toContain("animate-pulse");
    expect(html).toContain("opacity-40 cursor-not-allowed");
  });
});
