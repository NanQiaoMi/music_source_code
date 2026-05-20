import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(async () => {
  localStorage.clear();
  const { usePlayerSkinStore } = await import("@/store/playerSkinStore");
  usePlayerSkinStore.setState({ activeHaloId: "aurora" });
});

afterEach(() => {
  document.body.innerHTML = "";
});

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

  it("stores the selected halo skin when a halo option is clicked", async () => {
    const { PlayerSkinsPanel } = await import("./PlayerSkinsPanel");
    const { usePlayerSkinStore } = await import("@/store/playerSkinStore");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PlayerSkinsPanel isOpen={true} onClose={() => undefined} />);
    });

    const vinylButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Vinyl")
    );

    await act(async () => {
      vinylButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(usePlayerSkinStore.getState().activeHaloId).toBe("vinyl");

    await act(async () => {
      root.unmount();
    });
  });
});
