import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TOAST_DURATION, MAX_TOASTS, useToastStore } from "./toastStore";

const initialToastState = useToastStore.getState();

describe("toastStore (S6-6a)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState(initialToastState, true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("adds a toast with the legacy id shape, fields and defaults", () => {
    vi.spyOn(Date, "now").mockReturnValue(12345);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    useToastStore.getState().showToast("Saved", "success", 5000);

    const [toast] = useToastStore.getState().toasts;
    expect(toast).toMatchObject({ message: "Saved", type: "success", duration: 5000 });
    expect(toast.id).toMatch(/^toast-12345-[a-z0-9]{9}$/);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("keeps the pre-split defaults (type=info, duration=3000)", () => {
    useToastStore.getState().showToast("Default");

    expect(useToastStore.getState().toasts[0]).toMatchObject({
      message: "Default",
      type: "info",
      duration: DEFAULT_TOAST_DURATION,
    });
    expect(DEFAULT_TOAST_DURATION).toBe(3000);
  });

  it("gives every queued toast a unique id", () => {
    const randoms = [0.111111, 0.222222, 0.333333];
    let index = 0;
    vi.spyOn(Math, "random").mockImplementation(() => randoms[index++] ?? 0.5);

    for (let i = 0; i < randoms.length; i += 1) useToastStore.getState().showToast("dup");

    const ids = useToastStore.getState().toasts.map((toast) => toast.id);
    expect(ids).toHaveLength(randoms.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("dismisses by id through dismissToast and the removeToast alias", () => {
    const store = useToastStore.getState();
    store.showToast("first");
    store.showToast("second");

    const [first, second] = useToastStore.getState().toasts;
    useToastStore.getState().dismissToast(first.id);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(["second"]);

    useToastStore.getState().removeToast("missing-id");
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().removeToast(second.id);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("caps the queue at MAX_TOASTS by dropping the oldest toast", () => {
    for (let i = 0; i < MAX_TOASTS + 2; i += 1) useToastStore.getState().showToast("t" + i);

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(MAX_TOASTS);
    expect(toasts.map((toast) => toast.message)).toEqual(["t2", "t3", "t4", "t5", "t6"]);
  });

  it("auto-dismisses only after the toast duration elapses", () => {
    useToastStore.getState().showToast("Auto hide", "info", 3000);

    vi.advanceTimersByTime(2999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("keeps duration<=0 toasts until they are dismissed", () => {
    useToastStore.getState().showToast("Sticky", "warning", 0);

    vi.advanceTimersByTime(60_000);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: "Sticky", type: "warning", duration: 0 });

    useToastStore.getState().dismissToast(toasts[0].id);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("carries the achievement variant payload without changing legacy toast shape", () => {
    useToastStore.getState().showToast("成就", "success", 4000, {
      variant: "achievement",
      achievement: { id: "a1", name: "初听", description: "播放第一首歌", icon: "🎵" },
    });
    useToastStore.getState().showToast("Legacy");

    const [achievementToast, legacyToast] = useToastStore.getState().toasts;
    expect(achievementToast).toMatchObject({
      variant: "achievement",
      achievement: { id: "a1", name: "初听" },
    });
    // 旧调用不新增键，消息对象形状与拆前一致。
    expect("variant" in legacyToast).toBe(false);
    expect("achievement" in legacyToast).toBe(false);

    vi.advanceTimersByTime(3000);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(["成就"]);
    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("is transient: no persist middleware and no storage write", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    useToastStore.getState().showToast("Transient", "info", 1000);

    expect("persist" in useToastStore).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem("toast-store-v1")).toBeNull();
  });

  it("clears the whole queue", () => {
    useToastStore.getState().showToast("a");
    useToastStore.getState().showToast("b");

    useToastStore.getState().clearToasts();
    expect(useToastStore.getState().toasts).toEqual([]);
  });
});
