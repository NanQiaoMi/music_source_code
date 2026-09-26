import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { extractColorsFromImage, clearColorCache, defaultColors } from "./colorExtractor";

const COVER_A = "https://cdn.example.com/cover-a.jpg";

/** 记录 Image 构造次数的桩：真正贵的是整图解码，构造次数即解码次数 */
class CountingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = "";
  naturalWidth = 100;
  naturalHeight = 100;
  width = 100;
  height = 100;
  private _src = "";

  constructor() {
    constructions += 1;
  }

  set src(value: string) {
    this._src = value;
    // 模拟图片异步加载完成
    setTimeout(() => this.onload?.(), 0);
  }

  get src() {
    return this._src;
  }
}

let constructions = 0;

beforeEach(() => {
  clearColorCache();
  constructions = 0;
  vi.stubGlobal("Image", CountingImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearColorCache();
});

describe("extractColorsFromImage 并发去重", () => {
  it("同一张封面被并发请求 5 次时只解码一次", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => extractColorsFromImage(COVER_A))
    );

    expect(constructions).toBe(1);
    expect(results).toHaveLength(5);
    // 5 个调用方拿到同一份结果
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
  });

  it("结果缓存命中后不再发起新的解码", async () => {
    await extractColorsFromImage(COVER_A);
    expect(constructions).toBe(1);

    constructions = 0;
    await extractColorsFromImage(COVER_A);
    expect(constructions).toBe(0);
  });

  it("clearColorCache 后会重新解码", async () => {
    await extractColorsFromImage(COVER_A);
    expect(constructions).toBe(1);

    clearColorCache();
    constructions = 0;
    await extractColorsFromImage(COVER_A);
    expect(constructions).toBe(1);
  });

  it("默认封面与伪协议直接返回默认色，不创建 Image", async () => {
    for (const url of ["", "/default-cover.svg", "stored://abc", "local://def", "   "]) {
      const colors = await extractColorsFromImage(url);
      expect(colors).toBe(defaultColors);
    }
    expect(constructions).toBe(0);
  });

  it("不同封面各自解码一次", async () => {
    await Promise.all([
      extractColorsFromImage(COVER_A),
      extractColorsFromImage("https://cdn.example.com/cover-b.jpg"),
    ]);
    expect(constructions).toBe(2);
  });
});
