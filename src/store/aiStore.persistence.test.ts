import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORE_KEY = "mimi-ai-store";
const PERSISTED_CONFIG = {
  id: "cfg-legacy",
  name: "Legacy relay",
  baseUrl: "https://api.example.com/v1",
  apiKey: "legacy-key",
  model: "gpt-4.1",
  status: "online" as const,
  lastTested: 1710000000000,
};

async function loadAIStore() {
  vi.resetModules();
  return import("./aiStore");
}

describe("aiStore persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("migrates a previous persisted version without losing AI configs", async () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        state: {
          configs: [PERSISTED_CONFIG],
          activeConfigId: "cfg-legacy",
          isEnabled: false,
        },
        version: 1,
      })
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { useAIStore } = await loadAIStore();
    await useAIStore.persist.rehydrate();

    expect(useAIStore.getState().configs).toEqual([PERSISTED_CONFIG]);
    expect(useAIStore.getState().activeConfigId).toBe("cfg-legacy");
    expect(useAIStore.getState().isEnabled).toBe(false);
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("couldn't be migrated since no migrate function was provided")
    );
    expect(JSON.parse(localStorage.getItem(STORE_KEY)!)).toMatchObject({ version: 1 });
  });

  it("migrates pre-versioned state to the current storage version", async () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        state: {
          configs: [PERSISTED_CONFIG],
          activeConfigId: "cfg-legacy",
          isEnabled: false,
        },
        version: 0,
      })
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { useAIStore } = await loadAIStore();
    await useAIStore.persist.rehydrate();

    expect(useAIStore.getState().configs).toEqual([PERSISTED_CONFIG]);
    expect(useAIStore.getState().activeConfigId).toBe("cfg-legacy");
    expect(useAIStore.getState().isEnabled).toBe(false);
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("couldn't be migrated since no migrate function was provided")
    );
    expect(JSON.parse(localStorage.getItem(STORE_KEY)!)).toMatchObject({ version: 1 });
  });

  it("does not downgrade a future persisted version or overwrite its storage", async () => {
    const futureStorageValue = JSON.stringify({
      state: {
        configs: [PERSISTED_CONFIG],
        activeConfigId: "cfg-legacy",
        isEnabled: false,
      },
      version: 99,
    });
    localStorage.setItem(STORE_KEY, futureStorageValue);

    const { useAIStore } = await loadAIStore();
    await useAIStore.persist.rehydrate();

    expect(useAIStore.getState().configs).toEqual([]);
    expect(localStorage.getItem(STORE_KEY)).toBe(futureStorageValue);
  });

  it("does not overwrite malformed persisted state", async () => {
    const malformedStorageValue = JSON.stringify({
      state: {
        configs: "not-an-array",
        activeConfigId: "cfg-legacy",
        isEnabled: false,
      },
      version: 0,
    });
    localStorage.setItem(STORE_KEY, malformedStorageValue);

    const { useAIStore } = await loadAIStore();
    await useAIStore.persist.rehydrate();

    expect(useAIStore.getState().configs).toEqual([]);
    expect(localStorage.getItem(STORE_KEY)).toBe(malformedStorageValue);
  });
});
