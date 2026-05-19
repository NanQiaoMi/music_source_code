import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
  },
}));

vi.mock("@/store/visualSettingsStore", () => ({
  useVisualSettingsStore: () => ({
    customThemes: [],
    exportCurrentTheme: vi.fn(() => "{}"),
    importTheme: vi.fn(() => true),
    applyTheme: vi.fn(),
    deleteCustomTheme: vi.fn(),
    getBuiltInThemes: vi.fn(() => []),
  }),
}));

describe("PlayerSkinsPanel", () => {
  it("renders the halo skin selector with the built-in halo pack", async () => {
    const { PlayerSkinsPanel } = await import("./PlayerSkinsPanel");

    const html = renderToStaticMarkup(<PlayerSkinsPanel isOpen={true} onClose={() => undefined} />);

    expect(html).toContain("Halo");
    expect(html).toContain("Aurora");
    expect(html).toContain("Vinyl");
    expect(html).toContain("Pulse");
    expect(html).toContain('aria-label="Aurora halo preview"');
    expect(html).toContain("<canvas");
  });
});
