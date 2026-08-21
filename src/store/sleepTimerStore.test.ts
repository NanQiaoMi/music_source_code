import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeSleepMinutes, useSleepTimerStore } from "./sleepTimerStore";

describe("sleepTimerStore", () => {
  beforeEach(() => {
    const intervalId = useSleepTimerStore.getState().intervalId;
    if (intervalId) clearInterval(intervalId);
    useSleepTimerStore.setState({
      minutes: null,
      remainingSeconds: 0,
      isActive: false,
      endTime: null,
      intervalId: null,
    });
    vi.useRealTimers();
  });

  it("normalizes command minutes to a positive integer", () => {
    expect(normalizeSleepMinutes(30)).toBe(30);
    expect(normalizeSleepMinutes(0)).toBe(1);
    expect(normalizeSleepMinutes(2.4)).toBe(2);
    expect(normalizeSleepMinutes(Number.NaN)).toBeNull();
    expect(normalizeSleepMinutes(null)).toBeNull();
  });

  it("sets a timer from command minutes", () => {
    useSleepTimerStore.getState().setTimer(37);

    const state = useSleepTimerStore.getState();
    expect(state.minutes).toBe(37);
    expect(state.remainingSeconds).toBe(37 * 60);
    expect(state.isActive).toBe(false);
  });

  it("clears an existing timer", () => {
    useSleepTimerStore.getState().setTimer(30);
    useSleepTimerStore.getState().setTimer(null);

    const state = useSleepTimerStore.getState();
    expect(state.minutes).toBeNull();
    expect(state.remainingSeconds).toBe(0);
    expect(state.isActive).toBe(false);
  });

  it("starts and cancels active timers", () => {
    vi.useFakeTimers();
    useSleepTimerStore.getState().setTimer(1);
    useSleepTimerStore.getState().startTimer();

    expect(useSleepTimerStore.getState().isActive).toBe(true);
    expect(useSleepTimerStore.getState().endTime).toBeTypeOf("number");

    useSleepTimerStore.getState().cancelTimer();

    expect(useSleepTimerStore.getState().minutes).toBeNull();
    expect(useSleepTimerStore.getState().remainingSeconds).toBe(0);
    expect(useSleepTimerStore.getState().isActive).toBe(false);
    vi.useRealTimers();
  });
});
