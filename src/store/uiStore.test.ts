import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "./uiStore";

const initialState = useUIStore.getInitialState();

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.setState(initialState, true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens and closes a panel", () => {
    const store = useUIStore.getState();
    store.openPanel("queue");

    expect(useUIStore.getState().isPanelOpen("queue")).toBe(true);

    useUIStore.getState().closePanel("queue");

    expect(useUIStore.getState().isPanelOpen("queue")).toBe(false);
  });

  it("toggles a panel on and off", () => {
    const store = useUIStore.getState();
    store.togglePanel("search");
    expect(useUIStore.getState().panels.search).toBe(true);

    useUIStore.getState().togglePanel("search");
    expect(useUIStore.getState().panels.search).toBe(false);
  });

  it("closes all panels", () => {
    const store = useUIStore.getState();
    store.openPanel("queue");
    store.openPanel("search");
    store.openPanel("playerSkins");

    useUIStore.getState().closeAllPanels();

    expect(Object.values(useUIStore.getState().panels).every((isOpen) => isOpen === false)).toBe(true);
  });

  it("keeps fullscreen panels mutually exclusive while preserving non-fullscreen panels", () => {
    const store = useUIStore.getState();
    store.openPanel("queue");
    store.openPanel("emotionMatrix");

    expect(useUIStore.getState().panels.queue).toBe(true);
    expect(useUIStore.getState().panels.emotionMatrix).toBe(true);

    useUIStore.getState().openPanel("share");

    expect(useUIStore.getState().panels.queue).toBe(true);
    expect(useUIStore.getState().panels.emotionMatrix).toBe(false);
    expect(useUIStore.getState().panels.share).toBe(true);
  });

  it("manages keyboard shortcut modal flags", () => {
    const store = useUIStore.getState();

    store.setIsKeyboardShortcutsOpen(true);
    expect(useUIStore.getState().isKeyboardShortcutsOpen).toBe(true);

    store.setIsKeyboardShortcutsOpen(false);
    expect(useUIStore.getState().isKeyboardShortcutsOpen).toBe(false);

    store.showKeyboardShortcuts();
    expect(useUIStore.getState().isKeyboardShortcutsOpen).toBe(true);
  });

  it("adds and removes toast messages deterministically", () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(12345);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const store = useUIStore.getState();
    store.showToast("Saved", "success", 5000);

    expect(useUIStore.getState().toasts).toHaveLength(1);
    expect(useUIStore.getState().toasts[0]).toMatchObject({
      message: "Saved",
      type: "success",
      duration: 5000,
    });

    const [{ id }] = useUIStore.getState().toasts;
    useUIStore.getState().removeToast(id);

    expect(useUIStore.getState().toasts).toEqual([]);
  });

  it("auto-removes toast messages after their duration", () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(67890);
    vi.spyOn(Math, "random").mockReturnValue(0.987654321);

    useUIStore.getState().showToast("Auto hide", "info", 3000);

    expect(useUIStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(2999);
    expect(useUIStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useUIStore.getState().toasts).toEqual([]);
  });

  it("toggles theme between dark and light", () => {
    const store = useUIStore.getState();

    expect(store.themeMode).toBe("dark");

    store.toggleTheme();
    expect(useUIStore.getState().themeMode).toBe("light");

    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().themeMode).toBe("dark");
  });
});
