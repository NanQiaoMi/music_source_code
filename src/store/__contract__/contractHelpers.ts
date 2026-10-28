// Helpers for the S6-11 persisted-store matrix. installMemoryLocalStorage() routes all Storage calls into
// a Map-backed backend; Storage.prototype is patched because zustand resolves instances at import time.
import type { StorageEntry } from "@/lib/storage/storageRegistry";

export class MemoryStorageBackend {
  readonly data = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.writes.push({ key, value: String(value) });
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** localStorage + sessionStorage + instances captured at import time share one backend. */
export function installMemoryLocalStorage(): { memory: MemoryStorageBackend; restore: () => void } {
  const memory = new MemoryStorageBackend();
  const proto = Storage.prototype;
  const originals = {
    getItem: proto.getItem,
    setItem: proto.setItem,
    removeItem: proto.removeItem,
  };
  proto.getItem = (key) => memory.getItem(key);
  proto.setItem = (key, value) => memory.setItem(key, value);
  proto.removeItem = (key) => memory.removeItem(key);
  return { memory, restore: () => Object.assign(proto, originals) };
}

/**
 * Project persisted state onto what a JSON-backed localStorage keeps: actions/undefined drop, Date
 * becomes ISO, Map/Set survive only when the store's codec rebuilds them on read. Both roundtrip
 * sides use this, so codecs are not masked while real serialization loss still fails.
 */
export function persistedShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => persistedShape(item) ?? null);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) return new Map([...value].map(([k, v]) => [k, persistedShape(v)]));
  if (value instanceof Set) return new Set([...value].map((item) => persistedShape(item)));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, persistedShape(item)] as const)
        .filter(([, item]) => item !== undefined)
    );
  }
  return typeof value === "function" || typeof value === "symbol" ? undefined : value;
}

/** Runtime-only fields that must never reach localStorage, whichever store owns them. */
const RUNTIME_ONLY_FIELDS = [
  "isPlaying",
  "isLoading",
  "isHydrated",
  "hasHydrated",
  "isProcessing",
  "isSessionLoading",
  "isTransitioning",
];

/** Plan-mandated exclusions beyond the runtime list: S6-3 makes audioStore the progress authority. */
const PLAN_FORBIDDEN_FIELDS: Readonly<Record<string, readonly string[]>> = {
  playerStore: ["currentTime", "duration"],
};

export function forbiddenFieldsFor(entry: StorageEntry): readonly string[] {
  return [...RUNTIME_ONLY_FIELDS, ...(PLAN_FORBIDDEN_FIELDS[entry.owner] ?? [])];
}
