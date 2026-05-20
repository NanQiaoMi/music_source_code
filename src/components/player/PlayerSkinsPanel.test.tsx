import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalGetContext = HTMLCanvasElement.prototype.getContext;

function createCanvasContextStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    canvas,
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    set fillStyle(_value: string | CanvasGradient) {},
    set strokeStyle(_value: string | CanvasGradient) {},
    set globalAlpha(_value: number) {},
    set lineWidth(_value: number) {},
  } as unknown as CanvasRenderingContext2D;
}

function installCanvasContextStub() {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(function (this: HTMLCanvasElement, contextId: string) {
      return contextId === "2d" ? createCanvasContextStub(this) : null;
    }) as HTMLCanvasElement["getContext"],
  });
}

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
  installCanvasContextStub();
  for (const property of [
    "--theme-primary",
    "--theme-secondary",
    "--theme-accent",
    "--theme-background",
  ]) {
    document.documentElement.style.removeProperty(property);
  }
  const { usePlayerSkinStore } = await import("@/store/playerSkinStore");
  usePlayerSkinStore.setState({ activeBaseSkinId: "default", activeHaloId: "aurora" });
});

afterEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: originalGetContext,
  });
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

  it("stores the selected base player skin when a built-in skin is clicked", async () => {
    const { PlayerSkinsPanel } = await import("./PlayerSkinsPanel");
    const { usePlayerSkinStore } = await import("@/store/playerSkinStore");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PlayerSkinsPanel isOpen={true} onClose={() => undefined} />);
    });

    const oceanButton = container.querySelector("[data-player-skin-id=ocean]");

    expect(oceanButton).not.toBeNull();

    await act(async () => {
      oceanButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(usePlayerSkinStore.getState().activeBaseSkinId).toBe("ocean");

    await act(async () => {
      root.unmount();
    });
  });

  it("applies the persisted base player skin when the panel mounts", async () => {
    const { PlayerSkinsPanel } = await import("./PlayerSkinsPanel");
    const { usePlayerSkinStore } = await import("@/store/playerSkinStore");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    usePlayerSkinStore.setState({ activeBaseSkinId: "ocean" });

    await act(async () => {
      root.render(<PlayerSkinsPanel isOpen={true} onClose={() => undefined} />);
    });

    expect(document.documentElement.style.getPropertyValue("--theme-primary")).toBe(
      "rgb(14, 165, 233)"
    );

    await act(async () => {
      root.unmount();
    });
  });
});
