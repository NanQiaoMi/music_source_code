import { describe, it, expect, beforeEach } from "vitest";
import * as Effects from "./index";
import { initAllEffects } from "./initEffects";

describe("V8 Effects Registry", () => {
  beforeEach(() => {
    Effects.effectsRegistry.length = 0;
  });

  it("should register all 26 effects", () => {
    initAllEffects();
    expect(Effects.effectsRegistry.length).toBeGreaterThanOrEqual(26);
  });

  it("each registered effect should have id, name, and category", () => {
    initAllEffects();
    for (const effect of Effects.effectsRegistry) {
      expect(effect.id).toBeDefined();
      expect(typeof effect.id).toBe("string");
      expect(effect.name).toBeDefined();
      expect(typeof effect.name).toBe("string");
      expect(effect.category).toBeDefined();
    }
  });

  it("should register specific spectrum effects", () => {
    initAllEffects();
    const ids = Effects.effectsRegistry.map((e) => e.id);
    expect(ids).toContain("spectrum-modern");
    expect(ids).toContain("ring-spectrum-v8");
    expect(ids).toContain("spectrum-waterfall-v8");
    expect(ids).toContain("spectrum-spiral");
  });

  it("should register specific particle effects", () => {
    initAllEffects();
    const ids = Effects.effectsRegistry.map((e) => e.id);
    expect(ids).toContain("particle-burst");
    expect(ids).toContain("particle-explosion-v8");
    expect(ids).toContain("particle-gravity-v8");
    expect(ids).toContain("particle-grid-v8");
    expect(ids).toContain("particle-trail");
    expect(ids).toContain("particle-ambient-dust");
    expect(ids).toContain("particle-flow-field");
    expect(ids).toContain("particle-vortex-v8");
  });

  it("should have no duplicate IDs", () => {
    initAllEffects();
    const ids = Effects.effectsRegistry.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});