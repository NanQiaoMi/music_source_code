import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ABLoopProgressMarkers } from "./ABLoopProgressMarkers";

describe("ABLoopProgressMarkers", () => {
  it("renders range and endpoint markers for a valid loop", () => {
    const html = renderToStaticMarkup(
      <ABLoopProgressMarkers isEnabled={true} pointA={15} pointB={45} duration={60} />
    );

    expect(html).toContain('data-ab-loop-range="true"');
    expect(html).toContain('data-ab-loop-marker="a"');
    expect(html).toContain('data-ab-loop-marker="b"');
    expect(html).toContain("left:25%");
    expect(html).toContain("width:50%");
    expect(html).toContain("left:75%");
  });

  it("renders nothing when the loop range is not usable", () => {
    const html = renderToStaticMarkup(
      <ABLoopProgressMarkers isEnabled={true} pointA={45} pointB={15} duration={60} />
    );

    expect(html).toBe("");
  });
});
