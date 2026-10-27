import { describe, expect, it } from "vitest";
import { HANDWRITTEN_PALETTES, resolveHandwrittenPalette } from "./handwrittenPalette";

describe("handwritten palette", () => {
  it("保留五套视觉可区分的纸色", () => {
    expect(HANDWRITTEN_PALETTES).toHaveLength(5);
    expect(new Set(HANDWRITTEN_PALETTES.map(({ name }) => name)).size).toBe(5);
    expect(HANDWRITTEN_PALETTES[4]?.dark).toBe(true);
    expect(HANDWRITTEN_PALETTES.slice(0, 4).every(({ dark }) => !dark)).toBe(true);
  });

  it("主调色是低饱和暖米纸，而不是冷灰白", () => {
    const color = resolveHandwrittenPalette(0).paperBase;
    const channels = color
      .slice(1)
      .match(/.{2}/g)
      ?.map((channel) => Number.parseInt(channel, 16));

    expect(channels).toHaveLength(3);
    const [red, , blue] = channels!;
    // 暖纸：红通道高于蓝通道，差值控制在低饱和区间，仍保持亮纸而非米黄滤镜。
    expect(red! - blue!).toBeGreaterThanOrEqual(8);
    expect(red! - blue!).toBeLessThanOrEqual(24);
    expect(Math.min(...channels!)).toBeGreaterThanOrEqual(220);
  });
});
