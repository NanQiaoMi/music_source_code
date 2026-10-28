// S6-6a uiStore facade: toast 事实的唯一 owner 是 toastStore，uiStore 只保留
// deprecated 转发器（78 处既有调用点不改），且不再持有 toasts 状态。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStore } from "./toastStore";
import { useUIStore } from "./uiStore";

const initialUIState = useUIStore.getInitialState();
const initialToastState = useToastStore.getState();

describe("uiStore toast facade (S6-6a)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUIStore.setState(initialUIState, true);
    useToastStore.setState(initialToastState, true);
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
