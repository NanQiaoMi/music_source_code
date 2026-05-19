import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
  },
}));

describe("VisualSettingsPanel", () => {
  it("renders performance preset controls and their current budget", async () => {
    const { usePerformanceV8Store } = await import("@/store/performanceV8Store");
    const { VisualSettingsPanel } = await import("./VisualSettings");

    usePerformanceV8Store.getState().setPerformancePreset("balanced");

    const html = renderToStaticMarkup(
      <VisualSettingsPanel isOpen={true} onClose={() => undefined} />
    );

    expect(html).toContain("Performance presets");
    expect(html).toContain("Cinematic");
    expect(html).toContain("Balanced");
    expect(html).toContain("Battery");
    expect(html).toContain("Target FPS");
    expect(html).toContain("Particle budget");
  });
});
