import { describe, expect, it, vi } from "vitest";
import type { EffectPlugin } from "@/runtime/effectPlugin";
import { createEffectRegistry } from "@/runtime/effectRegistry";
import type { VisualizationEffect } from "@/store/visualizationStore";

function createFakePlugin(id: VisualizationEffect) {
  return {
    id,
    init: vi.fn(),
    resize: vi.fn(),
    draw: vi.fn(),
    dispose: vi.fn(),
  } satisfies EffectPlugin;
}

describe("EffectRegistry (S5-4a)", () => {
  it("caches plugin instances by id", () => {
    const registry = createEffectRegistry();
    const factory = vi.fn(() => createFakePlugin("spatialMesh"));
    registry.register("spatialMesh", factory);

    const first = registry.get("spatialMesh");
    const second = registry.get("spatialMesh");

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(registry.has("spatialMesh")).toBe(true);
    expect(registry.getLoadedEffects()).toEqual(["spatialMesh"]);
  });

  it("rejects duplicate registration for the same id", () => {
    const registry = createEffectRegistry();
    registry.register("spatialMesh", () => createFakePlugin("spatialMesh"));

    expect(() => registry.register("spatialMesh", () => createFakePlugin("spatialMesh"))).toThrow(
      /duplicate registration/
    );
    expect(registry.ids()).toEqual(["spatialMesh"]);
  });

  it("returns null for ids that were never registered", () => {
    const registry = createEffectRegistry();

    expect(registry.get("auroraWave")).toBeNull();
    expect(registry.has("auroraWave")).toBe(false);
    expect(registry.getLoadedEffects()).toEqual([]);
  });

  it("keeps at most capacity instances and disposes the least recently used", () => {
    const registry = createEffectRegistry(2);
    const spatial = createFakePlugin("spatialMesh");
    const nebula = createFakePlugin("nebulaField");
    const aurora = createFakePlugin("auroraWave");
    registry.register("spatialMesh", () => spatial);
    registry.register("nebulaField", () => nebula);
    registry.register("auroraWave", () => aurora);

    registry.get("spatialMesh");
    registry.get("nebulaField");
    registry.get("spatialMesh"); // 刷新 spatialMesh 的最近使用位置
    registry.get("auroraWave"); // 淘汰最久未用的 nebulaField

    expect(nebula.dispose).toHaveBeenCalledTimes(1);
    expect(spatial.dispose).not.toHaveBeenCalled();
    expect(registry.getLoadedEffects()).toEqual(["spatialMesh", "auroraWave"]);

    registry.get("nebulaField"); // 重新创建并淘汰 spatialMesh
    expect(spatial.dispose).toHaveBeenCalledTimes(1);
    expect(registry.getLoadedEffects()).toEqual(["auroraWave", "nebulaField"]);
  });

  it("release disposes the instance and forgets it", () => {
    const registry = createEffectRegistry();
    const plugin = createFakePlugin("spatialMesh");
    const factory = vi.fn(() => plugin);
    registry.register("spatialMesh", factory);
    registry.get("spatialMesh");

    registry.release("spatialMesh");

    expect(plugin.dispose).toHaveBeenCalledTimes(1);
    expect(registry.getLoadedEffects()).toEqual([]);

    registry.get("spatialMesh");
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("disposeAll disposes every cached instance", () => {
    const registry = createEffectRegistry(3);
    const spatial = createFakePlugin("spatialMesh");
    const nebula = createFakePlugin("nebulaField");
    registry.register("spatialMesh", () => spatial);
    registry.register("nebulaField", () => nebula);
    registry.get("spatialMesh");
    registry.get("nebulaField");

    registry.disposeAll();

    expect(spatial.dispose).toHaveBeenCalledTimes(1);
    expect(nebula.dispose).toHaveBeenCalledTimes(1);
    expect(registry.getLoadedEffects()).toEqual([]);
  });
});
