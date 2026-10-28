import { describe, expect, it } from "vitest";
import { resizeParticlePool, type EffectParticle } from "./particlePool";

describe("resizeParticlePool (S5-5)", () => {
  it("reuses every particle object across 100 resizes when capacity is sufficient", () => {
    const pool: EffectParticle[] = [];
    resizeParticlePool(pool, 1000);
    const objects = Array.from(pool);

    for (let i = 0; i < 100; i += 1) resizeParticlePool(pool, 1000);

    expect(pool).toHaveLength(1000);
    for (let i = 0; i < objects.length; i += 1) {
      expect(pool[i]).toBe(objects[i]);
    }
  });
  it("grows only when count exceeds capacity and truncates in place", () => {
    const pool: EffectParticle[] = [];
    resizeParticlePool(pool, 128);
    const first = pool[0];

    resizeParticlePool(pool, 256);
    expect(pool).toHaveLength(256);
    expect(pool[0]).toBe(first);

    resizeParticlePool(pool, 64);
    expect(pool).toHaveLength(64);
    expect(pool[0]).toBe(first);
  });
});
