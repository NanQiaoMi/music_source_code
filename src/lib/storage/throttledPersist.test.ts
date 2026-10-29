import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";
import {
  createThrottledStorage,
  flushAllThrottledStorages,
  installFlushOnPageHide,
  ThrottledStateStorage,
} from "./throttledPersist";
import { createSafeStorage } from "./safeStorage";
import { STORAGE_DEGRADED_EVENT } from "./degradedNotifier";

interface RecordedWrite {
  name: string;
  value: string;
}

function createRecordingStorage(): { storage: StateStorage; writes: RecordedWrite[] } {
  const writes: RecordedWrite[] = [];
  const data = new Map<string, string>();
  const storage: StateStorage = {
    getItem: (name) => data.get(name) ?? null,
    setItem: (name, value) => {
      writes.push({ name, value });
      data.set(name, value);
    },
    removeItem: (name) => {
      data.delete(name);
    },
  };
  return { storage, writes };
}

const created: ThrottledStateStorage[] = [];
let removeLifecycleListeners: (() => void) | null = null;

function throttle(key: string, options: Parameters<typeof createThrottledStorage>[1] = {}) {
  const storage = createThrottledStorage(key, options);
  created.push(storage);
  return storage;
}

describe("throttledPersist", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (const storage of created.splice(0)) storage.dispose();
    removeLifecycleListeners?.();
    removeLifecycleListeners = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("writes the first value immediately and coalesces 10 rapid updates into one write", () => {
    const { storage, writes } = createRecordingStorage();
    const throttled = throttle("rapid-key", { minWriteIntervalMs: 2000, base: storage });

    for (let index = 0; index < 10; index += 1) {
      throttled.setItem("rapid-key", String(index));
    }

    // leading write only; the other 9 updates are pending inside the window
    expect(writes).toHaveLength(1);
    expect(writes[0].value).toBe("0");

    vi.advanceTimersByTime(1000);
    expect(writes).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(writes).toHaveLength(2);
    expect(writes[1].value).toBe("9");
  });

  it("keeps total writes <=1 per second for 10 store-style updates spread over 1s", () => {
    const { storage, writes } = createRecordingStorage();
    const throttled = throttle("steady-key", { minWriteIntervalMs: 2000, base: storage });

    for (let index = 0; index < 10; index += 1) {
      throttled.setItem("steady-key", String(index));
      vi.advanceTimersByTime(100);
    }

    expect(writes).toHaveLength(1);
  });

  it("flush writes the pending final value immediately and cancels the trailing timer", () => {
    const { storage, writes } = createRecordingStorage();
    const throttled = throttle("flush-key", { minWriteIntervalMs: 2000, base: storage });

    throttled.setItem("flush-key", "a");
    throttled.setItem("flush-key", "b");
    expect(throttled.hasPendingWrite()).toBe(true);
    // pending values are not readable: getItem keeps returning the last written value
    expect(throttled.getItem("flush-key")).toBe("a");

    throttled.flush();

    expect(throttled.hasPendingWrite()).toBe(false);
    expect(writes.map((write) => write.value)).toEqual(["a", "b"]);
    expect(throttled.getItem("flush-key")).toBe("b");

    vi.advanceTimersByTime(5000);
    expect(writes).toHaveLength(2);
  });

  it("flushAllThrottledStorages flushes every registered key", () => {
    const first = createRecordingStorage();
    const second = createRecordingStorage();
    const firstStorage = throttle("all-a", { minWriteIntervalMs: 2000, base: first.storage });
    const secondStorage = throttle("all-b", { minWriteIntervalMs: 2000, base: second.storage });

    firstStorage.setItem("all-a", "1");
    firstStorage.setItem("all-a", "2");
    secondStorage.setItem("all-b", "1");
    secondStorage.setItem("all-b", "2");

    flushAllThrottledStorages();

    expect(first.writes.map((write) => write.value)).toEqual(["1", "2"]);
    expect(second.writes.map((write) => write.value)).toEqual(["1", "2"]);
  });

  it("pagehide flushes directly through the default safe localStorage wrapper", () => {
    const throttled = throttle("pagehide-key", { minWriteIntervalMs: 2000 });

    throttled.setItem("pagehide-key", "first");
    throttled.setItem("pagehide-key", "last");
    expect(localStorage.getItem("pagehide-key")).toBe("first");

    removeLifecycleListeners = installFlushOnPageHide();
    window.dispatchEvent(new Event("pagehide"));

    expect(localStorage.getItem("pagehide-key")).toBe("last");
  });

  it("visibilitychange(hidden) flushes pending values", () => {
    const throttled = throttle("hidden-key", { minWriteIntervalMs: 2000 });
    throttled.setItem("hidden-key", "first");
    throttled.setItem("hidden-key", "last");

    removeLifecycleListeners = installFlushOnPageHide();
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "visibilityState"
    );
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    if (originalDescriptor) {
      Object.defineProperty(document, "visibilityState", originalDescriptor);
    }

    expect(localStorage.getItem("hidden-key")).toBe("last");
  });

  it("installFlushOnPageHide is idempotent", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const first = installFlushOnPageHide();
    const second = installFlushOnPageHide();
    removeLifecycleListeners = first;

    expect(second).toBe(first);
    expect(addSpy).toHaveBeenCalledTimes(2);
  });

  it("removeItem drops the pending value", () => {
    const { storage, writes } = createRecordingStorage();
    const throttled = throttle("remove-key", { minWriteIntervalMs: 2000, base: storage });

    throttled.setItem("remove-key", "a");
    throttled.setItem("remove-key", "pending");
    throttled.removeItem("remove-key");

    expect(throttled.hasPendingWrite()).toBe(false);
    expect(throttled.getItem("remove-key")).toBeNull();

    vi.advanceTimersByTime(5000);
    expect(writes.map((write) => write.value)).toEqual(["a"]);
  });

  it("keeps quota degradation from safeStorage (S1-3) when composed underneath", () => {
    const degraded = vi.fn();
    window.addEventListener(STORAGE_DEGRADED_EVENT, degraded);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    const throttled = throttle("degraded-key", {
      minWriteIntervalMs: 1000,
      base: createSafeStorage("degraded-key"),
    });

    expect(() => throttled.setItem("degraded-key", "payload")).not.toThrow();
    expect(() => throttled.flush()).not.toThrow();
    expect(degraded).toHaveBeenCalledTimes(1);
    expect((degraded.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      key: "degraded-key",
      reason: "quota",
    });
    // safeStorage keeps the last value in memory so a degraded session still hydrates.
    expect(throttled.getItem("degraded-key")).toBe("payload");

    window.removeEventListener(STORAGE_DEGRADED_EVENT, degraded);
  });
});
