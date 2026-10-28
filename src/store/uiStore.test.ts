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

  // S6-6b：panel 开合/互斥用例已迁到 panelStore.test.ts；兼容转发器与持久化格式见
  // uiStore.facade.test.ts。

  it("manages keyboard shortcut modal flags", () => {
    const store = useUIStore.getState();

    store.setIsKeyboardShortcutsOpen(true);
    expect(useUIStore.getState().isKeyboardShortcutsOpen).toBe(true);

    store.setIsKeyboardShortcutsOpen(false);
    expect(useUIStore.getState().isKeyboardShortcutsOpen).toBe(false);

    store.showKeyboardShortcuts();
    expect(useUIStore.getState().isKeyboardShortcutsOpen).toBe(true);
  });

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
