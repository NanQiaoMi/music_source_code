/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
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
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => (typeof prop === "string" ? prop : "div"),
    }
  ),
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock("@/store/visualSettingsStore", () => {
  const state = {
    customThemes: [],
    exportCurrentTheme: vi.fn(() => "{}"),
    importTheme: vi.fn(() => true),
    applyTheme: vi.fn(),
    deleteCustomTheme: vi.fn(),
    getBuiltInThemes: vi.fn(() => []),
  };
  return {
    useVisualSettingsStore: (selector: (input: typeof state) => unknown) => selector(state),
  };
});

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
  // S6-7：主题 owner 是 themeStore，跨用例重置避免残留调色板污染断言。
  const { defaultThemeState, useThemeStore } = await import("@/store/themeStore");
  useThemeStore.setState(defaultThemeState);
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

    // S6-7：面板只写 themeStore（owner），CSS 变量由 useThemeVars 单点派生。
    const { useThemeStore } = await import("@/store/themeStore");
    expect(useThemeStore.getState().themeColors.primary).toBe("rgb(14, 165, 233)");

    await act(async () => {
      root.unmount();
    });
  });
});
