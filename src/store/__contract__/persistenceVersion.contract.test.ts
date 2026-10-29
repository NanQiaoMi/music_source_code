// S6-11 persistence-version contract: 4 of the 43 persist configs declare a zustand version
// today. The 39 unversioned owners are an explicit ratchet: adding (or dropping)
// version/migrate must update this table, otherwise the v0->v1 fixture migration plan stays
// impossible (no migrate hook runs without a declared version).
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_REGISTRY, getStorageEntryByKeyOrOwner } from "@/lib/storage/storageRegistry";
import { STORE_BINDINGS } from "./storeBindings";

interface PersistOptions {
  name?: string;
  version?: number;
  migrate?: unknown;
}
interface VersionedStore {
  getState: () => Record<string, unknown>;
  persist: { getOptions: () => PersistOptions; rehydrate: () => Promise<void> | void };
}
const bindings = STORE_BINDINGS as unknown as Record<string, VersionedStore>;

/** Declared versions with their migration evidence. */
const DECLARED_VERSIONS = {
  aiStore: { version: 1, hasMigrate: true }, // AI_STORE_VERSION + normalizePersistedAIState
  eqStore: { version: 2, hasMigrate: true }, // S6-5 v2: legacy audio-store-v4 EQ fields
  gestureSettingsStore: { version: 1, hasMigrate: false }, // sanitize/merge handles old shape
  uiStore: { version: 2, hasMigrate: false }, // v2 partialize, unknown legacy keys dropped
} as const;
const UNWIRED_VERSIONS = STORAGE_REGISTRY.filter(
  (entry) => !(entry.owner in DECLARED_VERSIONS)
).map((entry) => entry.owner);

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("persistence version contract (S6-11)", () => {
  it("documents the 4 declared versions and ratchets the other 39", () => {
    expect(UNWIRED_VERSIONS).toHaveLength(39);
    expect(new Set([...Object.keys(DECLARED_VERSIONS), ...UNWIRED_VERSIONS]).size).toBe(
      STORAGE_REGISTRY.length
    );
    const versioned = Object.keys(bindings).filter(
      (owner) => (bindings[owner].persist.getOptions().version ?? 0) > 0
    );
    expect(versioned.sort()).toEqual(Object.keys(DECLARED_VERSIONS).sort());

    for (const [owner, expected] of Object.entries(DECLARED_VERSIONS)) {
      const options = bindings[owner].persist.getOptions();
      expect(options.name).toBe(getStorageEntryByKeyOrOwner(owner)?.key);
      expect(options.version).toBe(expected.version);
      expect(getStorageEntryByKeyOrOwner(owner)?.version).toBe(expected.version);
      expect(typeof options.migrate === "function").toBe(expected.hasMigrate);
    }
    for (const owner of UNWIRED_VERSIONS) {
      const options = bindings[owner].persist.getOptions();
      const entry = getStorageEntryByKeyOrOwner(owner);
      expect(options.name).toBe(entry?.key);
      expect(options.version ?? 0).toBe(0);
      expect(options.migrate).toBeUndefined();
      // Registry version is the target only; the persist config has not opted in yet.
      expect(entry?.version).toBe(1);
    }
  });

  it("runs the declared 0 -> 1 migration for the only store that has one", async () => {
    const key = "mimi-ai-store";
    const legacyConfig = {
      id: "cfg-legacy",
      name: "Legacy relay",
      baseUrl: "https://api.example.com/v1",
      apiKey: "legacy-key",
      model: "gpt-4.1",
      status: "online",
    };
    localStorage.setItem(
      key,
      JSON.stringify({
        state: { configs: [legacyConfig], activeConfigId: "cfg-legacy", isEnabled: false },
        version: 0,
      })
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await bindings.aiStore.persist.rehydrate();

    const state = bindings.aiStore.getState();
    expect(state.configs).toEqual([legacyConfig]);
    expect(state.activeConfigId).toBe("cfg-legacy");
    expect(state.isEnabled).toBe(false);
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("couldn't be migrated since no migrate function was provided")
    );
    // Migration rewrites the envelope, so the next load reads version 1 directly.
    expect(JSON.parse(localStorage.getItem(key) ?? "{}")).toMatchObject({ version: 1 });
  });
});
