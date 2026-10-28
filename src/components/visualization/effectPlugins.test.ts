import { describe, expect, it } from "vitest";
import { featureFlags } from "@/lib/perf/featureFlags";
import { NebulaFieldPlugin } from "./effects/nebulaFieldPlugin";
import { SpatialMeshPlugin } from "./effects/spatialMeshPlugin";
import { effectRegistry, resolveEffectPlugin } from "./effectPlugins";

describe("effect plugin dispatch (S5-4)", () => {
  it("registers the two migrated pilot effects", () => {
    expect(effectRegistry.ids()).toEqual(["spatialMesh", "nebulaField"]);
  });

  it("selects the pilot plugin by effect id", () => {
    expect(resolveEffectPlugin("spatialMesh", true)).toBeInstanceOf(SpatialMeshPlugin);
    expect(resolveEffectPlugin("nebulaField", true)).toBeInstanceOf(NebulaFieldPlugin);
  });

  it("returns null for effects that still live in the legacy switch", () => {
    expect(resolveEffectPlugin("auroraWave", true)).toBeNull();
    expect(resolveEffectPlugin("cinematicLyricDrift", true)).toBeNull();
  });

  it("returns null for every effect when the flag is off", () => {
    expect(resolveEffectPlugin("spatialMesh", false)).toBeNull();
    expect(resolveEffectPlugin("nebulaField", false)).toBeNull();
  });

  it("follows featureFlags.effectPlugins by default", () => {
    const flags = featureFlags as { effectPlugins: boolean };
    const previous = flags.effectPlugins;
    try {
      flags.effectPlugins = true;
      expect(resolveEffectPlugin("spatialMesh")).toBeInstanceOf(SpatialMeshPlugin);
      flags.effectPlugins = false;
      expect(resolveEffectPlugin("spatialMesh")).toBeNull();
    } finally {
      flags.effectPlugins = previous;
    }
  });
});
