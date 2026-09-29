import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSourceConfigStore } from "./sourceConfigStore";

describe("sourceConfigStore", () => {
  beforeEach(() => {
    useSourceConfigStore.getState().resetToDefaults();
  });

  it("initializes with 7 default sources", () => {
    const { sources } = useSourceConfigStore.getState();
    expect(sources.netease).toBeDefined();
    expect(sources.qq).toBeDefined();
    expect(sources.kugou).toBeDefined();
    expect(sources.kuwo).toBeDefined();
    expect(sources.qishui).toBeDefined();
    expect(sources.local).toBeDefined();
    expect(sources.lx_custom).toBeDefined();
    expect(sources.netease.enabled).toBe(true);
  });

  it("toggles source enabled status", () => {
    const store = useSourceConfigStore.getState();
    expect(store.sources.qq.enabled).toBe(true);

    store.toggleSource("qq");
    expect(useSourceConfigStore.getState().sources.qq.enabled).toBe(false);

    store.toggleSource("qq");
    expect(useSourceConfigStore.getState().sources.qq.enabled).toBe(true);
  });

  it("applies preset schemes properly", () => {
    const store = useSourceConfigStore.getState();
    store.applyPreset("pure_local_master");

    const state = useSourceConfigStore.getState();
    expect(state.activePreset).toBe("pure_local_master");
    expect(state.sources.local.enabled).toBe(true);
    expect(state.sources.netease.enabled).toBe(false);
    expect(state.sources.qq.enabled).toBe(false);
  });

  it("adds, updates and removes LX custom scripts", () => {
    const store = useSourceConfigStore.getState();
    const id = store.addLXScript({
      name: "Test Custom Source",
      author: "Tester",
      version: "1.0.0",
      description: "A test script",
      scriptUrl: "https://example.com/source.js",
      enabled: true,
      supportedActions: ["search", "songUrl"],
    });

    expect(useSourceConfigStore.getState().lxScripts.some((s) => s.id === id)).toBe(true);

    store.updateLXScript(id, { name: "Updated Source Name" });
    expect(useSourceConfigStore.getState().lxScripts.find((s) => s.id === id)?.name).toBe(
      "Updated Source Name"
    );

    store.removeLXScript(id);
    expect(useSourceConfigStore.getState().lxScripts.some((s) => s.id === id)).toBe(false);
  });

  it("exports and imports configuration JSON correctly", () => {
    const store = useSourceConfigStore.getState();
    store.setSourceQuality("kuwo", "hires");

    const exported = store.exportConfigJson();
    expect(typeof exported).toBe("string");
    expect(exported).toContain("kuwo");

    store.resetToDefaults();
    expect(useSourceConfigStore.getState().sources.kuwo.qualityPreference).toBe("auto");

    const success = store.importConfigJson(exported);
    expect(success).toBe(true);
    expect(useSourceConfigStore.getState().sources.kuwo.qualityPreference).toBe("hires");
  });

  it("surfaces a failed builtin sync instead of swallowing it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(useSourceConfigStore.getState().syncBuiltinDesktopSources()).rejects.toThrow(
      /500/
    );
    vi.unstubAllGlobals();
  });

  it("surfaces a malformed builtin payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ sources: "nope" }) })
    );
    await expect(useSourceConfigStore.getState().syncBuiltinDesktopSources()).rejects.toThrow();
    vi.unstubAllGlobals();
  });

  it("surfaces a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(useSourceConfigStore.getState().syncBuiltinDesktopSources()).rejects.toThrow(
      "network down"
    );
    vi.unstubAllGlobals();
  });
});
