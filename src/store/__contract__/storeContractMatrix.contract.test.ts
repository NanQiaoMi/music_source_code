// S6-11 persisted-store contract matrix: one generated row per registry entry, asserting the entry
// (a) resolves to a live store with the persist API, (b) writes under that key/version, (c) survives a
// setItem -> getItem roundtrip of its partialized subset, (d) appears exactly once in the hydration
// plan, and (e) persists no volatile field. contractHelpers swaps in a Map-backed Storage.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildHydrationPlan } from "@/lib/bootstrapStores";
import {
  STORAGE_KEYS,
  STORAGE_REGISTRY,
  getStorageEntryByKeyOrOwner,
  type StorageEntry,
} from "@/lib/storage/storageRegistry";
import {
  forbiddenFieldsFor,
  installMemoryLocalStorage,
  persistedShape,
  type MemoryStorageBackend,
} from "./contractHelpers";
import { STORE_BINDINGS } from "./storeBindings";

type StoreOwner = keyof typeof STORE_BINDINGS;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Options = {
  readonly name: string;
  readonly version?: number;
  readonly storage?: StorageLike;
  readonly partialize?: (state: never) => unknown;
};
type PersistedStore = {
  getState: () => Record<string, unknown>;
  setState: (partial: Record<string, unknown>) => void;
  persist: { getOptions: () => Options; rehydrate: () => unknown };
};

const bindings = STORE_BINDINGS as unknown as Record<StoreOwner, PersistedStore>;
const MATRIX: ReadonlyArray<{ entry: StorageEntry; owner: StoreOwner }> = STORAGE_REGISTRY.map(
  (entry) => ({ entry, owner: entry.owner as StoreOwner })
);
const HYDRATION_PLAN = buildHydrationPlan();
/** Persist configs declaring `version`; S6-2 version/migrate wiring for the other 39 is pending. */
const VERSIONED_OWNERS = ["aiStore", "eqStore", "gestureSettingsStore", "uiStore"];
/** Known gaps: unpartialized stores that still persist a runtime flag (S6-2 whole-store backlog). */
const VOLATILE_FIELD_EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {
  knowledgeStore: ["isLoading"],
  recommendationStore: ["isLoading"],
};

let memory: MemoryStorageBackend;
let restoreLocalStorage: () => void;
beforeAll(() => {
  ({ memory, restore: restoreLocalStorage } = installMemoryLocalStorage());
});
afterAll(() => restoreLocalStorage());

describe("persisted store contract matrix (S6-11)", () => {
  it("generates one row per registry entry, covers it, and ratchets known gaps", () => {
    expect(STORAGE_REGISTRY).toHaveLength(43);
    expect(MATRIX).toHaveLength(STORAGE_REGISTRY.length);
    expect(Object.keys(bindings).sort()).toEqual(MATRIX.map((row) => row.owner).sort());
    expect(HYDRATION_PLAN).toHaveLength(STORAGE_REGISTRY.length);
    expect(new Set(HYDRATION_PLAN.map((step) => step.owner)).size).toBe(STORAGE_REGISTRY.length);
    const versioned = MATRIX.filter(
      ({ owner }) => (bindings[owner].persist.getOptions().version ?? 0) > 0
    ).map(({ owner }) => owner);
    expect(versioned.sort()).toEqual([...VERSIONED_OWNERS].sort());
    expect(Object.keys(VOLATILE_FIELD_EXCEPTIONS).sort()).toEqual([
      "knowledgeStore",
      "recommendationStore",
    ]);
  });

  for (const { entry, owner } of MATRIX) {
    it(owner + " -> " + entry.key + " satisfies the persisted-store contract", async () => {
      const store = bindings[owner];

      // (a) registry entry resolves to a live store with a persist API.
      expect(store, "no live store bound for " + owner).toBeTruthy();
      const api = [
        store.getState,
        store.setState,
        store.persist.getOptions,
        store.persist.rehydrate,
      ];
      for (const member of api) expect(typeof member).toBe("function");
      const state = store.getState();
      const options = store.persist.getOptions();
      for (const method of ["getItem", "setItem", "removeItem"] as const) {
        expect(typeof options.storage?.[method], "storage." + method).toBe("function");
      }

      // (b) persisted key/version match the registry.
      expect(options.name).toBe(entry.key);
      expect(getStorageEntryByKeyOrOwner(owner)?.key).toBe(entry.key);
      const version = options.version ?? 0;
      if (version > 0) {
        expect(version).toBe(entry.version);
      } else {
        // Unversioned configs keep the registry planning version until S6-2 wires version/migrate.
        expect(entry.version).toBe(1);
      }

      // (c) setItem -> getItem roundtrip preserves the partialized state subset.
      const subset = options.partialize ? options.partialize(state as never) : state;
      const expected = persistedShape(subset);
      expect(Object.keys(expected as Record<string, unknown>).length).toBeGreaterThan(0);
      const writesBefore = memory.writes.length;
      store.setState({});
      const write = memory.writes.slice(writesBefore).find((item) => item.key === entry.key);
      expect(write, owner + " did not persist " + entry.key).toBeTruthy();
      const envelope = JSON.parse(write!.value) as { state: unknown; version?: number };
      expect(envelope.version ?? 0).toBe(version);
      const readBack = (await options.storage!.getItem(entry.key)) as { state: unknown } | null;
      expect(readBack, "getItem(" + entry.key + ") was empty after the write").not.toBeNull();
      expect(persistedShape(readBack!.state)).toEqual(expected);

      // (d) the hydration plan contains the store exactly once.
      expect(HYDRATION_PLAN.filter((step) => step.owner === owner)).toHaveLength(1);

      // (e) no runtime-only or plan-forbidden volatile field is persisted.
      const exceptions = VOLATILE_FIELD_EXCEPTIONS[owner] ?? [];
      for (const field of forbiddenFieldsFor(entry)) {
        if (exceptions.includes(field)) continue;
        expect(envelope.state, entry.key + " persisted volatile field " + field).not.toHaveProperty(
          field
        );
      }
    });
  }

  it("keeps every write on a registered key (mock storage isolation)", () => {
    const writtenKeys = [...new Set(memory.writes.map((item) => item.key))];
    expect(writtenKeys.filter((key) => !STORAGE_KEYS.has(key))).toEqual([]);
  });
});
