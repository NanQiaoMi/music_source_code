// uiStore facade: toast（S6-6a）/ panel（S6-6b）事实的唯一 owner 分别是 toastStore /
// panelStore；uiStore 只保留 deprecated 转发器（既有调用点不改）与壳域/主题字段。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelStore } from "./panelStore";
import { useToastStore } from "./toastStore";
import { useUIStore } from "./uiStore";
import { useUiShellStore } from "./uiShellStore";
import { defaultThemeState, useThemeStore } from "./themeStore";

const initialUIState = useUIStore.getInitialState();
const initialToastState = useToastStore.getState();
const initialPanelState = usePanelStore.getInitialState();
const initialShellState = useUiShellStore.getInitialState();

describe("uiStore toast facade (S6-6a)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUIStore.setState(initialUIState, true);
    useUiShellStore.setState(initialShellState, true);
    useToastStore.setState(initialToastState, true);
    useThemeStore.setState(defaultThemeState);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the legacy showToast/removeToast API working through forwarders", () => {
    useUIStore.getState().showToast("Legacy", "success", 4321);

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      message: "Legacy",
      type: "success",
      duration: 4321,
    });

    const [{ id }] = useToastStore.getState().toasts;
    useUIStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("applies the same defaults as the pre-split uiStore", () => {
    useUIStore.getState().showToast("Default");

    expect(useToastStore.getState().toasts[0]).toMatchObject({
      message: "Default",
      type: "info",
      duration: 3000,
    });
  });

  it("keeps legacy auto-dismiss timers working", () => {
    useUIStore.getState().showToast("Auto", "info", 2000);

    vi.advanceTimersByTime(2000);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("no longer owns toast state (single owner = toastStore)", () => {
    expect("toasts" in useUIStore.getState()).toBe(false);
    expect(useUIStore.getState()).not.toHaveProperty("toasts");
  });

  it("keeps forwarder identities stable across unrelated uiStore updates", () => {
    const showToast = useUIStore.getState().showToast;
    const removeToast = useUIStore.getState().removeToast;

    useUIStore.getState().setCurrentView("player");

    expect(useUIStore.getState().showToast).toBe(showToast);
    expect(useUIStore.getState().removeToast).toBe(removeToast);
  });

  it("never persists toasts into ui-store-v2 (forwarders do not touch uiStore state)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useUIStore.getState().showToast("No write", "info", 1000);

    const uiWrites = setItem.mock.calls.filter(([key]) => key === "ui-store-v2");
    expect(uiWrites).toEqual([]);
  });
});

// ─── S6-6b: panel 域兼容转发 + 持久化格式 ───────────────────────────
describe("uiStore panel facade (S6-6b)", () => {
  beforeEach(() => {
    useUIStore.setState(initialUIState, true);
    usePanelStore.setState(initialPanelState, true);
    useUiShellStore.setState(initialShellState, true);
    useThemeStore.setState(defaultThemeState);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards the legacy panel actions to panelStore", () => {
    const ui = useUIStore.getState();

    ui.openPanel("queue");
    expect(usePanelStore.getState().panels.queue).toBe(true);

    ui.togglePanel("queue");
    expect(usePanelStore.getState().panels.queue).toBe(false);

    ui.openPanel("search");
    ui.closeAllPanels();
    expect(Object.values(usePanelStore.getState().panels).every((isOpen) => !isOpen)).toBe(true);

    ui.openPanel("share");
    expect(ui.isPanelOpen("share")).toBe(true);
  });

  it("no longer owns panel state (single owner = panelStore)", () => {
    expect("panels" in useUIStore.getState()).toBe(false);
    expect(useUIStore.getState()).not.toHaveProperty("panels");
  });

  it("keeps the shelf3D mirror and the fullscreen-lyrics side effect", () => {
    usePanelStore.getState().openPanel("shelf3D");
    expect(useUIStore.getState().isShelf3DOpen).toBe(true);

    usePanelStore.getState().closePanel("shelf3D");
    expect(useUIStore.getState().isShelf3DOpen).toBe(false);

    useUiShellStore.getState().setFullscreenLyrics(true);
    usePanelStore.getState().openPanel("formatConverter");
    expect(useUiShellStore.getState().fullscreenSurface).toBe("none");
  });

  it("keeps forwarder identities stable across unrelated uiStore updates", () => {
    const { openPanel, closePanel, closeAllPanels } = useUIStore.getState();

    useUIStore.getState().setCurrentView("player");

    expect(useUIStore.getState().openPanel).toBe(openPanel);
    expect(useUIStore.getState().closePanel).toBe(closePanel);
    expect(useUIStore.getState().closeAllPanels).toBe(closeAllPanels);
  });

  it("keeps the ui-store-v2 persistence format unchanged", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    // shelf3D 打开会驱动 isShelf3DOpen 镜像，因此这里会有一次 ui-store-v2 写入。
    usePanelStore.getState().openPanel("shelf3D");

    const uiWrites = setItem.mock.calls.filter(([key]) => key === "ui-store-v2");
    expect(uiWrites.length).toBeGreaterThan(0);
    const saved = JSON.parse(String(uiWrites[uiWrites.length - 1][1]));
    expect(saved.version).toBe(2);
    expect(Object.keys(saved.state).sort()).toEqual([
      "currentView",
      "isDynamicTheme",
      "themeColors",
      "themeMode",
    ]);
    expect(localStorage.getItem("ui-store-v2")).not.toContain("panels");
  });

  it("does not write ui-store-v2 for panel opens outside the persisted slice", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    usePanelStore.getState().openPanel("queue");

    expect(setItem.mock.calls.filter(([key]) => key === "ui-store-v2")).toEqual([]);
  });
});
// ─── S6-6c: 壳域兼容转发 + 持久化投影 ───────────────────────────────
describe("uiStore shell facade (S6-6c)", () => {
  beforeEach(() => {
    useUIStore.setState(initialUIState, true);
    usePanelStore.setState(initialPanelState, true);
    useUiShellStore.setState(initialShellState, true);
    useThemeStore.setState(defaultThemeState);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards the legacy shell actions to uiShellStore", () => {
    const ui = useUIStore.getState();

    ui.setCurrentView("player");
    ui.setIsTransitioning(true);
    ui.setIsNavMenuOpen(true);

    expect(useUiShellStore.getState()).toMatchObject({
      currentView: "player",
      isTransitioning: true,
      isNavMenuOpen: true,
    });
  });

  it("no longer owns transient shell state or fullscreen facts (single owners)", () => {
    for (const field of [
      "isTransitioning",
      "isNavMenuOpen",
      "isFullscreenLyrics",
      "isFullscreen",
      "fullscreenSurface",
    ]) {
      expect(field in useUIStore.getState()).toBe(false);
    }
    expect("restorePersistedView" in useUIStore.getState()).toBe(false);
    expect("fullscreenSurface" in useUiShellStore.getState()).toBe(true);
  });

  it("keeps currentView only as the ui-store-v2 persistence projection", () => {
    // owner 仍是 uiShellStore；uiStore 的 currentView 只是持久化投影。
    useUiShellStore.getState().setCurrentView("emotion");
    expect(useUIStore.getState().currentView).toBe("emotion");

    // 兼容旧调用：直接 setState 仍会驱动 owner。
    useUIStore.setState({ currentView: "home" });
    expect(useUiShellStore.getState().currentView).toBe("home");
  });

  it("keeps forwarder identities stable across unrelated uiStore updates", () => {
    const { setCurrentView, setIsTransitioning, setIsNavMenuOpen } = useUIStore.getState();

    useUIStore.getState().setThemeMode("light");

    expect(useUIStore.getState().setCurrentView).toBe(setCurrentView);
    expect(useUIStore.getState().setIsTransitioning).toBe(setIsTransitioning);
    expect(useUIStore.getState().setIsNavMenuOpen).toBe(setIsNavMenuOpen);
  });

  it("persists a shell view change with the unchanged payload shape", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useUIStore.getState().setCurrentView("player");

    const writes = setItem.mock.calls.filter(([key]) => key === "ui-store-v2");
    expect(writes).toHaveLength(1);
    const saved = JSON.parse(String(writes[0][1]));
    expect(saved.version).toBe(2);
    expect(Object.keys(saved.state).sort()).toEqual([
      "currentView",
      "isDynamicTheme",
      "themeColors",
      "themeMode",
    ]);
    expect(saved.state.currentView).toBe("player");
  });

  it("does not persist transient shell changes", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useUiShellStore.getState().setFullscreenSurface("panel");
    useUiShellStore.getState().setIsNavMenuOpen(true);
    useUiShellStore.getState().setIsTransitioning(true);

    expect(setItem.mock.calls.filter(([key]) => key === "ui-store-v2")).toEqual([]);
  });
});
