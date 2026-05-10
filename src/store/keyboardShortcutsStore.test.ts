import { beforeEach, describe, expect, it } from "vitest";
import { useKeyboardShortcutsStore } from "./keyboardShortcutsStore";

const initialState = useKeyboardShortcutsStore.getInitialState();

describe("keyboardShortcutsStore", () => {
  beforeEach(() => {
    useKeyboardShortcutsStore.setState(initialState, true);
    localStorage.clear();
  });

  it("returns default bindings when no override exists", () => {
    const binding = useKeyboardShortcutsStore.getState().getBinding("play-pause");

    expect(binding).toEqual(["Space"]);
  });

  it("returns overridden bindings after setBinding", () => {
    const result = useKeyboardShortcutsStore.getState().setBinding("play-pause", ["Ctrl+Space"]);

    expect(result).toEqual({ success: true, conflicts: [] });
    expect(useKeyboardShortcutsStore.getState().getBinding("play-pause")).toEqual(["Ctrl+Space"]);
    expect(useKeyboardShortcutsStore.getState().overrides).toEqual([
      { id: "play-pause", keys: ["Ctrl+Space"] },
    ]);
  });

  it("reports conflicts when another shortcut already uses the same keys", () => {
    const result = useKeyboardShortcutsStore.getState().setBinding("play-pause", ["ArrowLeft"]);

    expect(result.success).toBe(false);
    expect(result.conflicts).toEqual(["快退 5秒"]);
    expect(useKeyboardShortcutsStore.getState().getBinding("play-pause")).toEqual(["ArrowLeft"]);
  });

  it("removes one override with resetBinding", () => {
    const store = useKeyboardShortcutsStore.getState();
    store.setBinding("play-pause", ["Ctrl+Space"]);
    store.setBinding("vol-up", ["Ctrl+ArrowUp"]);

    useKeyboardShortcutsStore.getState().resetBinding("play-pause");

    expect(useKeyboardShortcutsStore.getState().getBinding("play-pause")).toEqual(["Space"]);
    expect(useKeyboardShortcutsStore.getState().getBinding("vol-up")).toEqual(["Ctrl+ArrowUp"]);
    expect(useKeyboardShortcutsStore.getState().overrides).toEqual([
      { id: "vol-up", keys: ["Ctrl+ArrowUp"] },
    ]);
  });

  it("clears all overrides with resetAll", () => {
    const store = useKeyboardShortcutsStore.getState();
    store.setBinding("play-pause", ["Ctrl+Space"]);
    store.setBinding("vol-up", ["Ctrl+ArrowUp"]);

    useKeyboardShortcutsStore.getState().resetAll();

    expect(useKeyboardShortcutsStore.getState().overrides).toEqual([]);
    expect(useKeyboardShortcutsStore.getState().getBinding("play-pause")).toEqual(["Space"]);
    expect(useKeyboardShortcutsStore.getState().getBinding("vol-up")).toEqual(["ArrowUp"]);
  });

  it("tracks recording state from setIsRecording", () => {
    const store = useKeyboardShortcutsStore.getState();
    store.setIsRecording("play-pause");

    expect(useKeyboardShortcutsStore.getState().isRecording).toBe(true);
    expect(useKeyboardShortcutsStore.getState().recordingId).toBe("play-pause");

    useKeyboardShortcutsStore.getState().setIsRecording(null);

    expect(useKeyboardShortcutsStore.getState().isRecording).toBe(false);
    expect(useKeyboardShortcutsStore.getState().recordingId).toBeNull();
  });

  it("returns the full default binding catalog from getAllBindings", () => {
    useKeyboardShortcutsStore.getState().setBinding("play-pause", ["Ctrl+Space"]);

    const bindings = useKeyboardShortcutsStore.getState().getAllBindings();

    expect(bindings).toBe(useKeyboardShortcutsStore.getState().defaults);
    expect(bindings).toContainEqual(
      expect.objectContaining({ id: "play-pause", keys: ["Space"], label: "播放/暂停" })
    );
  });
});
