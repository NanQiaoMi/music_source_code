import { beforeEach, describe, expect, it, vi } from "vitest";

const STORE_KEY = "player-skin-store-v1";

async function loadStore() {
  vi.resetModules();
  return import("./playerSkinStore");
}

describe("playerSkinStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("starts with the aurora halo skin", async () => {
    const { usePlayerSkinStore } = await loadStore();

    expect(usePlayerSkinStore.getState().activeHaloId).toBe("aurora");
  });

  it("persists a selected halo skin id", async () => {
    const { usePlayerSkinStore } = await loadStore();

    usePlayerSkinStore.getState().setActiveHaloId("vinyl");

    expect(usePlayerSkinStore.getState().activeHaloId).toBe("vinyl");
    expect(JSON.parse(localStorage.getItem(STORE_KEY)!).state.activeHaloId).toBe("vinyl");
  });

  it("falls back to aurora when persisted halo id is unknown", async () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ state: { activeHaloId: "missing" }, version: 0 })
    );

    const { usePlayerSkinStore } = await loadStore();
    await usePlayerSkinStore.persist.rehydrate();

    expect(usePlayerSkinStore.getState().activeHaloId).toBe("aurora");
  });
});
