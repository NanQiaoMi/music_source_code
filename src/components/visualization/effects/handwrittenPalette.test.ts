import { describe, expect, it } from "vitest";
import { HANDWRITTEN_PALETTES, resolveHandwrittenPalette } from "./handwrittenPalette";

describe("handwritten palette", () => {
  it("保留五套视觉可区分的纸色", () => {
    expect(HANDWRITTEN_PALETTES).toHaveLength(5);
    expect(new Set(HANDWRITTEN_PALETTES.map(({ name }) => name)).size).toBe(5);
    expect(HANDWRITTEN_PALETTES[4]?.dark).toBe(true);
    expect(HANDWRITTEN_PALETTES.slice(0, 4).every(({ dark }) => !dark)).toBe(true);
  });

  it("主调色的浅纸保持接近中性白而不是泛黄", () => {
    const color = resolveHandwrittenPalette(0).paperBase;
    const channels = color
      .slice(1)
      .match(/.{2}/g)
      ?.map((channel) => Number.parseInt(channel, 16));

    expect(channels).toHaveLength(3);
    expect(Math.max(...channels!) - Math.min(...channels!)).toBeLessThanOrEqual(8);
    expect(Math.min(...channels!)).toBeGreaterThanOrEqual(232);
  });
});
