// S6-6c: uiShellStore 是壳域（view/nav/transition/fullscreen）唯一 owner；uiStore 只保留
// currentView 的 ui-store-v2 持久化投影。
// S6-8a: 全屏事实收敛为一个 fullscreenSurface 枚举（none | lyrics | panel）。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelStore } from "./panelStore";
import { useUIStore } from "./uiStore";
import { useUiShellStore } from "./uiShellStore";

const initialShellState = useUiShellStore.getInitialState();
const initialPanelState = usePanelStore.getInitialState();
const initialUIState = useUIStore.getInitialState();
const uiStoreWrites = (setItem: { mock: { calls: unknown[][] } }) =>
  setItem.mock.calls.filter(([key]) => key === "ui-store-v2");
const surface = () => useUiShellStore.getState().fullscreenSurface;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useUiShellStore.setState(initialShellState, true);
  usePanelStore.setState(initialPanelState, true);
  useUIStore.setState(initialUIState, true);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as { electronAPI?: unknown }).electronAPI;
});

describe("uiShellStore view/navigation (S6-6c)", () => {
  it("defaults to the home view and switches views while closing the nav menu", () => {
    expect(useUiShellStore.getState().currentView).toBe("home");

    useUiShellStore.getState().setIsNavMenuOpen(true);
    useUiShellStore.getState().setCurrentView("player");

    expect(useUiShellStore.getState().currentView).toBe("player");
    expect(useUiShellStore.getState().isNavMenuOpen).toBe(false);
  });

  it("keeps transition and nav-menu flags in the shell owner", () => {
    useUiShellStore.getState().setIsTransitioning(true);
    expect(useUiShellStore.getState().isTransitioning).toBe(true);

    useUiShellStore.getState().setIsNavMenuOpen(true);
    expect(useUiShellStore.getState().isNavMenuOpen).toBe(true);
    useUiShellStore.getState().setIsNavMenuOpen(false);
    expect(useUiShellStore.getState().isNavMenuOpen).toBe(false);
  });

  it("toggles fullscreen lyrics and lets a fullscreen panel clear them", () => {
    useUiShellStore.getState().toggleFullscreenLyrics();
    expect(surface()).toBe("lyrics");

    usePanelStore.getState().openPanel("queue");
    expect(surface()).toBe("lyrics");

    usePanelStore.getState().openPanel("formatConverter");
    expect(surface()).toBe("none");
  });
});

describe("fullscreenSurface enum (S6-8a)", () => {
  it("transitions none -> lyrics -> none", () => {
    expect(surface()).toBe("none");
    useUiShellStore.getState().setFullscreenSurface("lyrics");
    expect(surface()).toBe("lyrics");
    useUiShellStore.getState().toggleFullscreenSurface("lyrics");
    expect(surface()).toBe("none");
  });

  it("transitions none -> panel -> none and is mutually exclusive with lyrics", () => {
    useUiShellStore.getState().toggleFullscreenSurface("panel");
    expect(surface()).toBe("panel");

    useUiShellStore.getState().setFullscreenSurface("lyrics");
    expect(surface()).toBe("lyrics");

    useUiShellStore.getState().setFullscreenSurface("panel");
    expect(surface()).toBe("panel");
  });

  it("closing lyrics never clears a full-window panel surface", () => {
    useUiShellStore.getState().setFullscreenSurface("panel");
    useUiShellStore.getState().setFullscreenLyrics(false);
    expect(surface()).toBe("panel");

    useUiShellStore.getState().setFullscreenLyrics(true);
    expect(surface()).toBe("lyrics");
    useUiShellStore.getState().setFullscreenLyrics(false);
    expect(surface()).toBe("none");
  });

  it("mirrors native fullscreen events without clobbering lyrics on exit", () => {
    useUiShellStore.getState().syncNativeFullscreen(true);
    expect(surface()).toBe("panel");

    useUiShellStore.getState().syncNativeFullscreen(false);
    expect(surface()).toBe("none");

    useUiShellStore.getState().setFullscreenSurface("lyrics");
    useUiShellStore.getState().syncNativeFullscreen(false);
    expect(surface()).toBe("lyrics");
  });

  it("does not notify subscribers for a no-op surface write", () => {
    const listener = vi.fn();
    const unsubscribe = useUiShellStore.subscribe(listener);

    useUiShellStore.getState().setFullscreenSurface("none");
    useUiShellStore.getState().syncNativeFullscreen(false);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });
});

describe("uiShellStore fullscreen action", () => {
  it("uses the Electron bridge when present", async () => {
    const toggleFullscreen = vi.fn().mockResolvedValue(true);
    (window as { electronAPI?: unknown }).electronAPI = { toggleFullscreen };

    await useUiShellStore.getState().toggleFullscreen();

    expect(toggleFullscreen).toHaveBeenCalledTimes(1);
    expect(surface()).toBe("panel");
  });

  it("falls back to the document fullscreen API", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });

    await useUiShellStore.getState().toggleFullscreen();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(surface()).toBe("panel");

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.documentElement,
    });
    await useUiShellStore.getState().toggleFullscreen();
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(surface()).toBe("none");
  });
});

describe("uiShellStore persistence projection (S6-6c)", () => {
  it("keeps the ui-store-v2 payload byte-compatible and persists the current view", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useUiShellStore.getState().setCurrentView("emotion");

    const writes = uiStoreWrites(setItem);
    expect(writes).toHaveLength(1);
    const saved = JSON.parse(String(writes[0][1]));
    expect(saved.version).toBe(2);
    expect(Object.keys(saved.state).sort()).toEqual([
      "currentView",
      "isDynamicTheme",
      "themeColors",
      "themeMode",
    ]);
    expect(saved.state.currentView).toBe("emotion");
    expect(useUIStore.getState().currentView).toBe("emotion");
  });

  it("never writes non-persisted shell fields to ui-store-v2", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const shell = useUiShellStore.getState();

    shell.setFullscreenSurface("panel");
    shell.setFullscreenSurface("lyrics");
    shell.setIsNavMenuOpen(true);
    shell.setIsTransitioning(true);

    expect(uiStoreWrites(setItem)).toEqual([]);
    expect(localStorage.getItem("ui-store-v2")).not.toContain("fullscreen");
  });

  it("does not write the legacy mimimusic_active_view channel any more", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useUiShellStore.getState().setCurrentView("visualization");

    expect(setItem.mock.calls.filter(([key]) => key === "mimimusic_active_view")).toEqual([]);
  });

  it("hydrates currentView from ui-store-v2 into the shell owner", async () => {
    localStorage.setItem(
      "ui-store-v2",
      JSON.stringify({
        state: {
          currentView: "visualization",
          themeMode: "light",
          isDynamicTheme: false,
          themeColors: { primary: "#111111" },
        },
        version: 2,
      })
    );

    await useUIStore.persist.rehydrate();

    expect(useUiShellStore.getState().currentView).toBe("visualization");
    expect(useUIStore.getState().themeMode).toBe("light");
    expect(useUIStore.getState().isDynamicTheme).toBe(false);
    expect(surface()).toBe("none");
  });

  it("is transient: the shell store exposes no persist middleware", () => {
    expect("persist" in useUiShellStore).toBe(false);
  });
});
