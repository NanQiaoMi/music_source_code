import { describe, expect, it } from "vitest";
import { OneEuroFilter, createOneEuroFilter } from "../filters";

describe("OneEuroFilter", () => {
  it("首次采样直接透传", () => {
    const filter = createOneEuroFilter({ minCutoff: 1.4, beta: 0.02 });
    expect(filter.filter(0.42, 0)).toBe(0.42);
    expect(filter.value).toBe(0.42);
  });

  it("静止输入逐步收敛到目标值", () => {
    const filter = createOneEuroFilter({ minCutoff: 1.4, beta: 0.02 });
    let output = filter.filter(0, 0);
    expect(output).toBe(0);
    for (let index = 1; index <= 120; index += 1) {
      output = filter.filter(1, index * 16);
    }
    expect(output).toBeGreaterThan(0.99);
    expect(output).toBeLessThanOrEqual(1);
  });

  it("抑制静止抖动：输出幅度明显小于输入幅度", () => {
    const filter = createOneEuroFilter({ minCutoff: 0.6, beta: 0.01 });
    const outputs: number[] = [];
    for (let index = 0; index < 80; index += 1) {
      const input = index % 2 === 0 ? 0.3 : 0.7;
      outputs.push(filter.filter(input, index * 16));
    }
    const tail = outputs.slice(40);
    const range = Math.max(...tail) - Math.min(...tail);
    expect(range).toBeGreaterThan(0);
    expect(range).toBeLessThan(0.1);
  });

  it("beta 越大快速移动越跟手", () => {
    const lowBeta = createOneEuroFilter({ minCutoff: 1, beta: 0 });
    const highBeta = createOneEuroFilter({ minCutoff: 1, beta: 0.08 });
    let low = 0;
    let high = 0;
    for (let index = 0; index < 20; index += 1) {
      const target = index * 0.05;
      const time = index * 16;
      low = lowBeta.filter(target, time);
      high = highBeta.filter(target, time);
    }
    expect(high).toBeGreaterThan(low);
    expect(Number.isFinite(high)).toBe(true);
  });

  it("reset 后下一次采样重新透传", () => {
    const filter = createOneEuroFilter();
    filter.filter(0, 0);
    filter.filter(1, 16);
    filter.reset();
    expect(filter.filter(0.2, 500)).toBe(0.2);
  });

  it("非法值 / 乱序 / 重复时间戳返回有限值且不崩溃", () => {
    const filter = new OneEuroFilter({ minCutoff: 1.4 });
    filter.filter(0.5, 0);
    expect(Number.isFinite(filter.filter(Number.NaN, 16))).toBe(true);
    expect(Number.isFinite(filter.filter(0.6, Number.NaN))).toBe(true);
    expect(Number.isFinite(filter.filter(0.7, 5))).toBe(true);
    expect(Number.isFinite(filter.filter(0.8, 16))).toBe(true);
    expect(Number.isFinite(filter.filter(Number.POSITIVE_INFINITY, 32))).toBe(true);
    expect(Number.isFinite(filter.value)).toBe(true);
  });

  it("createOneEuroFilter 返回独立可复用实例", () => {
    const first = createOneEuroFilter();
    const second = createOneEuroFilter({ minCutoff: 2 });
    expect(first).toBeInstanceOf(OneEuroFilter);
    expect(second).toBeInstanceOf(OneEuroFilter);
    expect(first.filter(1, 0)).toBe(1);
    expect(second.filter(2, 0)).toBe(2);
    expect(first.value).toBe(1);
    expect(second.value).toBe(2);
  });
});
