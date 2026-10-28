import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "./uiStore";
import { validateShortcutMap } from "@/hooks/useKeyboardShortcuts";

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

  it("registers the listening journal panel", () => {
    const store = useUIStore.getState();

    expect(store.panels.listeningJournal).toBe(false);

    store.openPanel("listeningJournal");
    expect(useUIStore.getState().isPanelOpen("listeningJournal")).toBe(true);

    useUIStore.getState().closePanel("listeningJournal");
    expect(useUIStore.getState().isPanelOpen("listeningJournal")).toBe(false);
  });

  it("registers the smart mix session panel", () => {
    const store = useUIStore.getState();

    expect(store.panels.smartMixSession).toBe(false);

    store.openPanel("smartMixSession");
    expect(useUIStore.getState().isPanelOpen("smartMixSession")).toBe(true);
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

    expect(Object.values(useUIStore.getState().panels).every((isOpen) => isOpen === false)).toBe(
      true
    );
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

  it("closes fullscreen lyrics before opening a fullscreen tool panel", () => {
    const store = useUIStore.getState();

    store.setIsFullscreenLyrics(true);
    store.openPanel("formatConverter");

    expect(useUIStore.getState().isFullscreenLyrics).toBe(false);
    expect(useUIStore.getState().panels.formatConverter).toBe(true);
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

  // S6-6a：toast 用例已迁到 toastStore.test.ts / uiStore.facade.test.ts。

  it("toggles theme between dark and light", () => {
    const store = useUIStore.getState();

    expect(store.themeMode).toBe("dark");

    store.toggleTheme();
    expect(useUIStore.getState().themeMode).toBe("light");

    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().themeMode).toBe("dark");
  });

  it("rejects duplicate shortcut assignments", () => {
    const result = validateShortcutMap({
      playPause: "Space",
      openSearch: "Space",
    });

    expect(result.valid).toBe(false);
    expect(result.conflicts).toEqual([["playPause", "openSearch"]]);
  });
});
