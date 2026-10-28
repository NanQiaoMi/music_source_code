import { describe, expect, it } from "vitest";
import { getLargeIllustrationStrokes, type IllustrationPoint } from "./handwrittenIllustration";

/** 大插画 kind（与 handwrittenIllustration 内部集合一致）。 */
const LARGE_KINDS = [
  "window",
  "paperplane",
  "mountain",
  "sun",
  "cloud",
  "flower",
  "leaf",
  "moon",
  "wheat",
  "ripple",
  "rain",
] as const;

/** 带水彩铺底的 kind：首笔必须是闭合轮廓（水彩/排线都从这里取形）。 */
const WASH_KINDS = new Set(["window", "mountain", "sun", "cloud", "flower", "leaf", "moon"]);

const MAX_STROKES = 12;
const MAX_POINTS_PER_STROKE = 24;
const COORD_LIMIT = 1.02;

function isClosed(points: readonly IllustrationPoint[]): boolean {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9;
}

/** 鞋带公式求多边形面积（闭合轮廓的填充面积）。 */
function polygonArea(points: readonly IllustrationPoint[]): number {
  let sum = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    sum += from.x * to.y - to.x * from.y;
  }
  return Math.abs(sum) / 2;
}

function boundsOf(strokes: readonly (readonly IllustrationPoint[])[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
  }
  return { minX, maxX, minY, maxY };
}

/** 线段相交（只算"真穿过"，共享端点的相邻段不算，避免闭合折线误报）。 */
function segmentsCross(
  a1: IllustrationPoint,
  a2: IllustrationPoint,
  b1: IllustrationPoint,
  b2: IllustrationPoint
): boolean {
  const cross = (o: IllustrationPoint, p: IllustrationPoint, q: IllustrationPoint) =>
    (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);
  const eps = 1e-9;
  return d1 * d2 < -eps && d3 * d4 < -eps;
}

describe("handwrittenIllustration 大插画几何", () => {
  it("非大插画 / 未知 kind 返回 null（回落到小涂鸦几何）", () => {
    for (const kind of ["star", "heart", "sprig", "wave", "tape", "", "WINDOW", "window2"]) {
      expect(getLargeIllustrationStrokes(kind)).toBeNull();
    }
  });

  it("每个大插画 kind 都有非空几何，且折线数 / 点数 / 坐标都在约定范围内", () => {
    for (const kind of LARGE_KINDS) {
      const strokes = getLargeIllustrationStrokes(kind);
      expect(strokes, kind).not.toBeNull();
      const geometry = strokes!;
      expect(geometry.length, kind).toBeGreaterThan(0);
      expect(geometry.length, kind).toBeLessThanOrEqual(MAX_STROKES);

      let totalPoints = 0;
      for (const stroke of geometry) {
        expect(stroke.length, kind).toBeGreaterThanOrEqual(2);
        expect(stroke.length, kind).toBeLessThanOrEqual(MAX_POINTS_PER_STROKE);
        for (const point of stroke) {
          expect(Number.isFinite(point.x), kind).toBe(true);
          expect(Number.isFinite(point.y), kind).toBe(true);
          expect(Math.abs(point.x), kind).toBeLessThanOrEqual(COORD_LIMIT);
          expect(Math.abs(point.y), kind).toBeLessThanOrEqual(COORD_LIMIT);
        }
        // 不能有零长度的相邻点（渲染端要按法线算笔宽，零向量会出 NaN）。
        for (let index = 1; index < stroke.length; index += 1) {
          const from = stroke[index - 1]!;
          const to = stroke[index]!;
          expect(Math.hypot(to.x - from.x, to.y - from.y), kind).toBeGreaterThan(1e-6);
        }
        totalPoints += stroke.length;
      }
      // 几何是每帧查找的纯数据，总量控制在 140 点内，避免几何缓存开销失控。
      expect(totalPoints, kind).toBeLessThanOrEqual(140);
    }
  });

  it("带水彩铺底的 kind 首笔是闭合且有面积的轮廓", () => {
    for (const kind of WASH_KINDS) {
      const geometry = getLargeIllustrationStrokes(kind)!;
      const outline = geometry[0]!;
      expect(isClosed(outline), kind).toBe(true);
      expect(outline.length, kind).toBeGreaterThanOrEqual(4);
      expect(polygonArea(outline), kind).toBeGreaterThan(0.02);
    }
  });

  it("每根折线都不自交（非相邻线段不相穿）", () => {
    for (const kind of LARGE_KINDS) {
      const geometry = getLargeIllustrationStrokes(kind)!;
      for (const stroke of geometry) {
        const segmentCount = stroke.length - 1;
        for (let left = 0; left < segmentCount; left += 1) {
          for (let right = left + 1; right < segmentCount; right += 1) {
            // 相邻线段共享端点，闭合折线的首尾段也共享端点。
            const adjacent = right - left === 1;
            const wrap = left === 0 && right === segmentCount - 1;
            if (adjacent || wrap) continue;
            expect(
              segmentsCross(stroke[left]!, stroke[left + 1]!, stroke[right]!, stroke[right + 1]!),
              `${kind}: 第 ${left} / ${right} 段相交`
            ).toBe(false);
          }
        }
      }
    }
  });

  it("几何是确定性的：同一 kind 永远返回同一份形状", () => {
    for (const kind of LARGE_KINDS) {
      const first = getLargeIllustrationStrokes(kind);
      const second = getLargeIllustrationStrokes(kind);
      expect(second).toEqual(first);
    }
    expect(getLargeIllustrationStrokes("window")).not.toEqual(getLargeIllustrationStrokes("moon"));
  });

  it("关键形状可辨识：窗竖长、太阳有射线、月牙开口、山有多个峰", () => {
    // 只看窗框本身（stroke[0]）；窗台板比窗框宽，不能算进"竖长"比例。
    const windowFrame = boundsOf([getLargeIllustrationStrokes("window")![0]!]);
    const windowHeight = windowFrame.maxY - windowFrame.minY;
    const windowWidth = windowFrame.maxX - windowFrame.minX;
    expect(windowHeight).toBeGreaterThan(windowWidth * 1.25);

    // 叶：round13 缩到 0.88 后，bbox 应回到 1.6–1.8 x 0.7–0.85（比 Pass4 小 12%）。
    const leafBounds = boundsOf(getLargeIllustrationStrokes("leaf")!);
    expect(leafBounds.maxX - leafBounds.minX).toBeGreaterThan(1.55);
    expect(leafBounds.maxX - leafBounds.minX).toBeLessThan(1.8);
    expect(leafBounds.maxY - leafBounds.minY).toBeGreaterThan(0.65);
    expect(leafBounds.maxY - leafBounds.minY).toBeLessThan(0.85);

    const sunStrokes = getLargeIllustrationStrokes("sun")!;
    // 轮廓：点数 ≥12（渲染端逐笔锐角阈值 ≤8 会走直线，点太少太阳会被削成多边形），
    // 且半径随角度明显起伏，不是几何圆。
    const sunBody = sunStrokes[0]!;
    expect(sunBody.length).toBeGreaterThanOrEqual(12);
    const radii = sunBody.map((point) => Math.hypot(point.x, point.y));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.05);
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.15);

    // 射线：9–11 根（断笔会多占一根折线），角度/长短/收笔各不相同。
    const rayStrokes = sunStrokes.slice(1);
    expect(rayStrokes.length).toBeGreaterThanOrEqual(9);
    expect(rayStrokes.length).toBeLessThanOrEqual(11);
    const rayLengths = rayStrokes.map((stroke) =>
      Math.hypot(
        stroke[stroke.length - 1]!.x - stroke[0]!.x,
        stroke[stroke.length - 1]!.y - stroke[0]!.y
      )
    );
    expect(Math.max(...rayLengths) - Math.min(...rayLengths)).toBeGreaterThan(0.05);
    // 至少有一截明显短于其它射线（断笔的半截），避免画成一圈等分光芒。
    expect(Math.min(...rayLengths)).toBeLessThan(0.15);

    expect(isCrescentShape(getLargeIllustrationStrokes("moon")![0]!)).toBe(true);

    // 山：闭合山体 + 至少两处局部峰尖（斜率先升后降且幅度明显）。
    const mountain = getLargeIllustrationStrokes("mountain")![0]!;
    let peaks = 0;
    for (let index = 1; index < mountain.length - 1; index += 1) {
      const previous = mountain[index - 1]!;
      const current = mountain[index]!;
      const next = mountain[index + 1]!;
      if (current.y < previous.y - 0.05 && current.y < next.y - 0.05) peaks += 1;
    }
    expect(peaks).toBeGreaterThanOrEqual(2);
  });
});

/** 月牙的判据：闭合轮廓存在向内凹的开口，面积明显小于外接矩形的一半。 */
function isCrescentShape(outline: readonly IllustrationPoint[]): boolean {
  const { minX, maxX, minY, maxY } = boundsOf([outline]);
  const height = maxY - minY;
  const width = maxX - minX;
  if (height < 0.5 || width < 0.5) return false;
  const area = polygonArea(outline);
  // 月牙面积明显小于其外接矩形的一半（中间被内侧弧切掉）。
  return area < width * height * 0.5;
}
