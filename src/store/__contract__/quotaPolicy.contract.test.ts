// S6-11 quota-policy contract: when localStorage is full, createSafeStorage must degrade
// observably (mimi:storage-degraded), keep the last good payload instead of clearing it, and
// fall back to its in-memory copy without throwing. uiStore is mocked so the throttled toast
// cannot write to storage and contaminate the counters.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_DEGRADED_EVENT, type StorageDegradedDetail } from "@/lib/storage/degradedNotifier";
import { createSafeStorage } from "@/lib/storage/safeStorage";

vi.mock("@/store/uiStore", () => ({
  useUIStore: { getState: () => ({ showToast: () => undefined }) },
}));

const KEY = "ui-store-v2";
const quotaError = () => new DOMException("Storage quota exceeded", "QuotaExceededError");
let events: StorageDegradedDetail[];
let listener: (event: Event) => void;

beforeEach(() => {
  localStorage.clear();
  events = [];
  listener = (event) => events.push((event as CustomEvent<StorageDegradedDetail>).detail);
  window.addEventListener(STORAGE_DEGRADED_EVENT, listener);
});
afterEach(() => {
  window.removeEventListener(STORAGE_DEGRADED_EVENT, listener);
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("quota policy contract (S6-11)", () => {
  it("emits storage-degraded and keeps the last good value on a full quota", () => {
    const previous = JSON.stringify({ state: { themeMode: "dark" }, version: 2 });
    localStorage.setItem(KEY, previous);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError();
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = createSafeStorage(KEY);
    const next = JSON.stringify({ state: { themeMode: "light" }, version: 2 });

    expect(() => storage.setItem(KEY, next)).not.toThrow();

    expect(setItem).toHaveBeenCalledTimes(2); // initial attempt + retry after compaction
    expect(localStorage.getItem(KEY)).toBe(previous);
    expect(storage.getItem(KEY)).toBe(previous);
    expect(events).toEqual([{ key: KEY, reason: "quota" }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("key=" + KEY));
  });

  it("serves the in-memory copy when the key never reached disk", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError();
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = createSafeStorage(KEY);
    const payload = JSON.stringify({ state: { themeMode: "light" }, version: 2 });

    expect(() => storage.setItem(KEY, payload)).not.toThrow();

    expect(storage.getItem(KEY)).toBe(payload);
    expect(events).toHaveLength(1);
  });

  it("does not report degradation when the retry succeeds", () => {
    const nativeSetItem = Storage.prototype.setItem;
    let calls = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
      calls += 1;
      if (calls === 1) throw quotaError();
      nativeSetItem.call(window.localStorage, key, value);
    });
    const storage = createSafeStorage(KEY);

    expect(() => storage.setItem(KEY, "payload")).not.toThrow();

    expect(calls).toBe(2);
    expect(events).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe("payload");
    expect(storage.getItem(KEY)).toBe("payload");
  });
});
