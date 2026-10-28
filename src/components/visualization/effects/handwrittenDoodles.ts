/**
 * 手书画面的笔触系统：页边涂鸦、大幅线稿、重点标注、胶带、印章。
 *
 * 动画手感：
 * - 每笔用 easeOutCubic 生长，笔与笔之间错开，不再所有线一起匀速变长；
 * - 落笔期间每 100ms 换一组手抖点（boiling line），画完后静止；
 * - 画完的笔触直接描缓存的 Path2D，不再逐帧重建折线，避免 GC 与卡顿。
 */

import type {
  HandwrittenColorRole,
  HandwrittenDoodleKind,
  HandwrittenDoodleSpec,
} from "./handwrittenScene";
import { stableRandom } from "./handwrittenScene";
import type { HandwrittenPalette } from "./handwrittenPalette";
import { withAlpha } from "./handwrittenPalette";

interface Point {
  x: number;
  y: number;
}

export interface StrokeStyle {
  color: string;
  width: number;
  alpha: number;
}

export interface DoodleOptions {
  ctx: CanvasRenderingContext2D;
  palette: HandwrittenPalette;
  width: number;
  height: number;
  /** 相对 min(视口宽, 视口高) 的笔触基准长度 */
  unit: number;
  progress: number;
  reducedMotion: boolean;
  /** 用于 boiling line 的绝对时间；不传则使用静态笔触 */
  timeMs?: number;
  /** 0 最高画质，1 弱机档，2 极弱档 */
  quality?: number;
}

const TAU = Math.PI * 2;

/** S5-7：荧光笔三道笔触的常量（offset/width 相对字号，colorRole 决定取色）。 */
const HIGHLIGHT_STROKES = [
  { offset: -0.12, width: 0.36, alpha: 0.15, colorRole: "highlight" },
  { offset: 0.1, width: 0.3, alpha: 0.12, colorRole: "highlight" },
  { offset: -0.01, width: 0.2, alpha: 0.07, colorRole: "line" },
] as const;

/** S5-7：涂鸦描边样式复用同一块暂存对象（drawStrokeSet 只在同步绘制中读取）。 */
const doodleStrokeStyle: StrokeStyle = { color: "#000", width: 1, alpha: 1 };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function easeOutCubic(value: number): number {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

function easeOutBack(value: number): number {
  const t = clamp(value, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function easeInOutSine(value: number): number {
  return -(Math.cos(Math.PI * clamp(value, 0, 1)) - 1) / 2;
}

interface CachedStroke {
  variant0: Point[];
  variant1: Point[];
  length: number;
  inkPath0: Path2D | null;
  inkPath1: Path2D | null;
  ghostInkPath0: Path2D | null;
  ghostInkPath1: Path2D | null;
}

interface GeometrySet {
  unit: number;
  strokes: CachedStroke[];
  totalLength: number;
}

/**
 * 几何缓存：以涂鸦/插画 spec 对象为 key（场景按镜头与尺寸缓存，对象身份稳定），
 * 每种 unit 尺寸只计算一次手抖点列与 Path2D。落笔阶段复用点列做局部描边。
 */
const geometryCache = new WeakMap<object, Map<string, GeometrySet>>();
const MAX_GEOMETRY_VARIANTS_PER_DOODLE = 8;

/** Bake a pressure profile into the outline so the finished stroke has tapered ends. */
function buildInkRibbonPath(
  points: readonly Point[],
  unit: number,
  width: number,
  seed: string
): Path2D | null {
  if (typeof Path2D === "undefined" || points.length < 2 || width <= 0) return null;
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    distances.push(distances[index - 1]! + Math.hypot(to.x - from.x, to.y - from.y));
  }
  const totalLength = distances[distances.length - 1]!;
  if (totalLength <= 0.0001) return null;
  const isClosed =
    Math.hypot(
      points[0]!.x - points[points.length - 1]!.x,
      points[0]!.y - points[points.length - 1]!.y
    ) < 0.0001;

  const left: Point[] = [];
  const right: Point[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)]!;
    const next = points[Math.min(points.length - 1, index + 1)]!;
    const tangentLength = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
    const normalX = -(next.y - previous.y) / tangentLength;
    const normalY = (next.x - previous.x) / tangentLength;
    const position = distances[index]! / totalLength;
    const startTaper = isClosed ? 1 : Math.sqrt(clamp(position / 0.1, 0, 1));
    const endTaper = isClosed ? 1 : Math.sqrt(clamp((1 - position) / 0.16, 0, 1));
    const pressure = 0.84 + stableRandom(seed, `pressure-${index}`) * 0.32;
    const halfWidth = (width * 0.5 * Math.min(startTaper, endTaper) * pressure) / unit;
    const point = points[index]!;
    left.push({ x: point.x + normalX * halfWidth, y: point.y + normalY * halfWidth });
    right.push({ x: point.x - normalX * halfWidth, y: point.y - normalY * halfWidth });
  }

  const path = new Path2D();
  path.moveTo(left[0]!.x * unit, left[0]!.y * unit);
  for (let index = 1; index < left.length; index += 1) {
    path.lineTo(left[index]!.x * unit, left[index]!.y * unit);
  }
  for (let index = right.length - 1; index >= 0; index -= 1) {
    path.lineTo(right[index]!.x * unit, right[index]!.y * unit);
  }
  path.closePath();
  return path;
}

/** 把折线细分并沿法线抖动，得到手绘感的点列。 */
function roughen(points: readonly Point[], seed: string, amount: number, subdivide = 3): Point[] {
  if (points.length < 2) return [...points];
  const result: Point[] = [];
  const isClosed =
    Math.hypot(
      points[0]!.x - points[points.length - 1]!.x,
      points[0]!.y - points[points.length - 1]!.y
    ) < 0.0001;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    const before = index > 0 ? points[index - 1]! : isClosed ? points[points.length - 2]! : from;
    const after = index + 2 < points.length ? points[index + 2]! : isClosed ? points[1]! : to;

    for (let step = 0; step < subdivide; step += 1) {
      const t = step / subdivide;
      const t2 = t * t;
      const t3 = t2 * t;
      const smooth = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const wobble = (stableRandom(seed, `wobble-${index}-${step}`) - 0.5) * amount * 2;
      result.push({
        x: smooth(before.x, from.x, to.x, after.x) + normalX * wobble,
        y: smooth(before.y, from.y, to.y, after.y) + normalY * wobble,
      });
    }
  }
  result.push(points[points.length - 1]!);
  if (isClosed && result.length > 1) result[result.length - 1] = result[0]!;
  return result;
}

function strokeLength(points: readonly Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.y - points[index - 1]!.y
    );
  }
  return total;
}

function getGeometry(
  owner: object,
  rawStrokes: readonly Point[][],
  unit: number,
  seed: string,
  roughness: number,
  strokeWidth: number
): GeometrySet {
  let set = geometryCache.get(owner);
  if (!set) {
    set = new Map();
    geometryCache.set(owner, set);
  }
  const key = `${unit}:${strokeWidth}:${seed}:${roughness}:${rawStrokes.length}`;
  const cached = set.get(key);
  if (cached) {
    set.delete(key);
    set.set(key, cached);
    return cached;
  }

  const strokes: CachedStroke[] = rawStrokes.map((raw, index) => {
    const variant0 = roughen(raw, `${seed}:0:${index}`, roughness);
    const variant1 = roughen(raw, `${seed}:1:${index}`, roughness);
    const pressure = 0.82 + stableRandom(`${seed}:${index}`, "stroke-pressure") * 0.36;
    const strokePressureWidth = strokeWidth * pressure;
    const variant0Path = buildInkRibbonPath(
      variant0,
      unit,
      strokePressureWidth,
      `${seed}:0:${index}`
    );
    const variant1Path = buildInkRibbonPath(
      variant1,
      unit,
      strokePressureWidth,
      `${seed}:1:${index}`
    );
    const ghost0 = buildInkRibbonPath(
      variant0,
      unit,
      strokePressureWidth * 1.12,
      `${seed}:ghost:0:${index}`
    );
    const ghost1 = buildInkRibbonPath(
      variant1,
      unit,
      strokePressureWidth * 1.12,
      `${seed}:ghost:1:${index}`
    );
    return {
      variant0,
      variant1,
      length: strokeLength(variant0),
      inkPath0: variant0Path,
      inkPath1: variant1Path,
      ghostInkPath0: ghost0,
      ghostInkPath1: ghost1,
    };
  });

  const geometry: GeometrySet = {
    unit,
    strokes,
    totalLength: strokes.reduce((sum, stroke) => sum + Math.max(0.001, stroke.length), 0),
  };
  while (set.size >= MAX_GEOMETRY_VARIANTS_PER_DOODLE) {
    const oldestKey = set.keys().next().value;
    if (oldestKey === undefined) break;
    set.delete(oldestKey);
  }
  set.set(key, geometry);
  return geometry;
}

/** 按进度描一段缓存点列，只画到预算长度。 */
function strokePartial(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  unit: number,
  progress: number
): void {
  if (points.length < 2 || progress <= 0) return;
  const total = strokeLength(points);
  let budget = total * progress;

  ctx.beginPath();
  ctx.moveTo(points[0]!.x * unit, points[0]!.y * unit);
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const segment = Math.hypot(to.x - from.x, to.y - from.y) * unit;
    if (budget >= segment) {
      ctx.lineTo(to.x * unit, to.y * unit);
      budget -= segment;
    } else {
      const t = segment <= 0.0001 ? 1 : budget / segment;
      ctx.lineTo((from.x + (to.x - from.x) * t) * unit, (from.y + (to.y - from.y) * t) * unit);
      break;
    }
  }
  ctx.stroke();
}

/**
 * 一组笔画按进度绘制：每笔错开起笔、easeOutCubic 生长；画完后走 Path2D 快路径。
 */
function drawStrokeSet(
  ctx: CanvasRenderingContext2D,
  geometry: GeometrySet,
  progress: number,
  style: StrokeStyle,
  options: DoodleOptions,
  variant: 0 | 1
): void {
  const strokes = geometry.strokes;
  if (strokes.length === 0 || progress <= 0) return;
  const quality = options.quality ?? 0;
  const stagger = 0.45;
  const unit = geometry.unit;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let index = 0; index < strokes.length; index += 1) {
    const stroke = strokes[index]!;
    const localProgress = clamp(
      progress * (1 + stagger) - (index / strokes.length) * stagger,
      0,
      1
    );
    if (localProgress <= 0) continue;
    const eased = easeOutCubic(localProgress);
    // 笔压：同一张涂鸦里每根线宽在 0.72–1.22 倍之间变化，而不是整齐的 2px 等宽线。
    const pressure = 0.72 + stableRandom(`${style.color}:${index}`, "w") * 0.5;
    const width = style.width * pressure;

    if (eased >= 0.999) {
      const path = variant === 0 ? stroke.inkPath0 : stroke.inkPath1;
      const ghostPath = variant === 0 ? stroke.ghostInkPath0 : stroke.ghostInkPath1;
      if (path) {
        if (quality < 2) {
          // 只留一圈很轻的边缘湿润感，主轮廓保持清晰。
          ctx.fillStyle = withAlpha(style.color, style.alpha * 0.12);
          ctx.fill(ghostPath ?? path);
        }
        ctx.fillStyle = withAlpha(style.color, style.alpha);
        ctx.fill(path);
        continue;
      }
    }

    const points = variant === 0 ? stroke.variant0 : stroke.variant1;
    if (quality < 2) {
      ctx.strokeStyle = withAlpha(style.color, style.alpha * 0.12);
      ctx.lineWidth = Math.max(0.7, width * 1.12);
      strokePartial(ctx, points, unit, eased);
    }
    ctx.strokeStyle = withAlpha(style.color, style.alpha);
    ctx.lineWidth = width;
    strokePartial(ctx, points, unit, eased);
  }

  ctx.restore();
}

function roleColor(palette: HandwrittenPalette, role: HandwrittenColorRole): string {
  switch (role) {
    case "pencil":
      return palette.pencil;
    case "accent":
      return palette.accent;
    case "highlight":
      return palette.highlightLine;
    default:
      return palette.ink;
  }
}

function roleAlpha(role: HandwrittenColorRole): number {
  switch (role) {
    case "pencil":
      return 0.7;
    case "highlight":
      return 0.85;
    default:
      return 0.82;
  }
}

function circlePoints(radius: number, count = 26, from = 0, to = TAU): Point[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / count;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

function heartPoints(): Point[] {
  const points: Point[] = [];
  for (let index = 0; index <= 36; index += 1) {
    const t = (index / 36) * TAU;
    const x = (16 * Math.sin(t) ** 3) / 17;
    const y =
      -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
    points.push({ x, y });
  }
  return points;
}

/** Pointed, bowed leaf outline; the renderer smooths these guides into a soft ink contour. */
function leafOutline(base: Point, tip: Point, halfWidth: number): Point[] {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const contour: Array<[number, number]> = [
    [0, 0],
    [0.16, 0.22],
    [0.38, 0.62],
    [0.66, 0.94],
    [0.88, 0.52],
    [1, 0],
    [0.82, -0.42],
    [0.56, -0.78],
    [0.31, -0.58],
    [0.12, -0.16],
    [0, 0],
  ];
  return contour.map(([along, across]) => ({
    x: base.x + dx * along + normalX * halfWidth * across,
    y: base.y + dy * along + normalY * halfWidth * across,
  }));
}

/** 各类涂鸦的原始折线（局部单位坐标，±1 左右）。 */
function doodleStrokes(kind: HandwrittenDoodleKind): Point[][] {
  switch (kind) {
    case "sun": {
      const rays: Point[][] = [];
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * TAU + 0.2;
        const long = index % 2 === 0;
        rays.push([
          { x: Math.cos(angle) * 0.68, y: Math.sin(angle) * 0.68 },
          { x: Math.cos(angle) * (long ? 0.98 : 0.88), y: Math.sin(angle) * (long ? 0.98 : 0.88) },
        ]);
      }
      return [circlePoints(0.46, 20), ...rays];
    }
    case "cloud":
      return [
        [
          { x: -1, y: 0.16 },
          { x: -0.82, y: -0.04 },
          { x: -0.6, y: -0.16 },
          { x: -0.46, y: -0.36 },
          { x: -0.24, y: -0.46 },
          { x: -0.02, y: -0.36 },
          { x: 0.08, y: -0.16 },
          { x: 0.32, y: -0.24 },
          { x: 0.5, y: -0.12 },
          { x: 0.62, y: 0.06 },
          { x: 0.84, y: 0.08 },
          { x: 0.96, y: 0.22 },
          { x: 0.74, y: 0.32 },
          { x: 0.3, y: 0.34 },
          { x: -0.2, y: 0.32 },
          { x: -0.66, y: 0.3 },
          { x: -1, y: 0.16 },
        ],
        [
          { x: -0.74, y: 0.38 },
          { x: 0.7, y: 0.38 },
        ],
      ];
    case "star":
      return [
        [
          { x: 0, y: -1 },
          { x: 0.19, y: -0.17 },
          { x: 1, y: 0 },
          { x: 0.19, y: 0.17 },
          { x: 0, y: 1 },
          { x: -0.19, y: 0.17 },
          { x: -1, y: 0 },
          { x: -0.19, y: -0.17 },
          { x: 0, y: -1 },
        ],
      ];
    case "spark":
      return [
        [
          { x: -0.14, y: 0 },
          { x: 0.14, y: 0 },
        ],
        [
          { x: 0, y: -0.14 },
          { x: 0, y: 0.14 },
        ],
        [
          { x: -0.4, y: -0.36 },
          { x: -0.22, y: -0.2 },
        ],
        [
          { x: 0.4, y: 0.36 },
          { x: 0.22, y: 0.2 },
        ],
        [
          { x: -0.34, y: 0.3 },
          { x: -0.24, y: 0.22 },
        ],
      ];
    case "note": {
      const head = circlePoints(0.17, 16).map((point) => ({
        x: point.x - 0.42,
        y: point.y + 0.54,
      }));
      return [
        head,
        [
          { x: -0.26, y: 0.5 },
          { x: -0.24, y: -0.62 },
        ],
        [
          { x: -0.24, y: -0.62 },
          { x: 0.02, y: -0.44 },
          { x: 0.2, y: -0.2 },
          { x: 0.16, y: 0.02 },
        ],
      ];
    }
    case "heart":
      return [heartPoints()];
    case "leaf":
      return [
        [
          { x: -0.88, y: 0.36 },
          { x: -0.5, y: -0.1 },
          { x: -0.05, y: -0.4 },
          { x: 0.42, y: -0.46 },
          { x: 0.74, y: -0.3 },
          { x: 0.78, y: -0.02 },
          { x: 0.42, y: 0.24 },
          { x: -0.12, y: 0.42 },
          { x: -0.6, y: 0.42 },
          { x: -0.88, y: 0.36 },
        ],
        [
          { x: -0.74, y: 0.34 },
          { x: 0.6, y: -0.32 },
        ],
      ];
    case "sprig":
      return [
        [
          { x: -0.68, y: 0.92 },
          { x: -0.4, y: 0.42 },
          { x: -0.18, y: -0.16 },
          { x: -0.12, y: -0.92 },
        ],
        leafOutline({ x: -0.46, y: 0.36 }, { x: -0.91, y: 0.08 }, 0.11),
        leafOutline({ x: -0.33, y: 0.08 }, { x: -0.79, y: -0.3 }, 0.105),
        leafOutline({ x: -0.21, y: -0.26 }, { x: -0.61, y: -0.69 }, 0.1),
        leafOutline({ x: -0.36, y: 0.43 }, { x: 0.08, y: 0.66 }, 0.095),
        leafOutline({ x: -0.19, y: -0.48 }, { x: 0.25, y: -0.75 }, 0.085),
      ];
    case "arrow":
      return [
        [
          { x: -1, y: 0.06 },
          { x: -0.5, y: -0.12 },
          { x: 0.1, y: -0.04 },
          { x: 0.62, y: 0.1 },
          { x: 0.94, y: 0.14 },
        ],
        [
          { x: 0.94, y: 0.14 },
          { x: 0.66, y: -0.14 },
        ],
        [
          { x: 0.94, y: 0.14 },
          { x: 0.7, y: 0.36 },
        ],
      ];
    case "wave":
      return [
        Array.from({ length: 21 }, (_, index) => {
          const t = index / 20;
          return { x: -1 + t * 2, y: Math.sin(t * TAU * 1.55) * 0.26 + (t - 0.5) * 0.08 };
        }),
      ];
    case "paperclip":
      return [
        [
          { x: -0.2, y: -0.98 },
          { x: 0.14, y: -0.94 },
          { x: 0.26, y: -0.7 },
          { x: 0.28, y: -0.2 },
          { x: 0.22, y: 0.38 },
          { x: 0.12, y: 0.8 },
          { x: -0.06, y: 0.92 },
          { x: -0.22, y: 0.78 },
          { x: -0.28, y: 0.36 },
          { x: -0.26, y: -0.18 },
          { x: -0.18, y: -0.6 },
          { x: -0.04, y: -0.78 },
          { x: 0.1, y: -0.66 },
        ],
      ];
    case "flower": {
      const petals: Point[][] = [];
      for (let index = 0; index < 5; index += 1) {
        const angle = (index / 5) * TAU - Math.PI / 2;
        const cx = Math.cos(angle) * 0.32;
        const cy = Math.sin(angle) * 0.32;
        petals.push(circlePoints(0.26, 12).map((point) => ({ x: point.x + cx, y: point.y + cy })));
      }
      return [
        ...petals,
        circlePoints(0.11, 10),
        [
          { x: 0, y: 0.62 },
          { x: 0.1, y: 1.04 },
        ],
      ];
    }
    case "dots":
      return [
        [
          { x: -0.62, y: 0.3 },
          { x: -0.44, y: 0.22 },
        ],
        [
          { x: 0.02, y: -0.14 },
          { x: 0.18, y: -0.22 },
        ],
        [
          { x: 0.48, y: 0.28 },
          { x: 0.64, y: 0.18 },
        ],
      ];
    case "moon": {
      const crescent: Point[] = [];
      for (let index = 0; index <= 30; index += 1) {
        const angle = -Math.PI * 0.62 + (index / 30) * Math.PI * 1.24;
        crescent.push({ x: Math.cos(angle) * 0.9, y: Math.sin(angle) * 0.9 });
      }
      for (let index = 24; index >= 0; index -= 1) {
        const angle = -Math.PI * 0.5 + (index / 24) * Math.PI;
        crescent.push({ x: 0.35 + Math.cos(angle) * 0.62, y: Math.sin(angle) * 0.72 });
      }
      const stars: Point[][] = [];
      for (let index = 0; index < 4; index += 1) {
        const sx = 0.55 + (index % 2) * 0.4;
        const sy = -0.7 + Math.floor(index / 2) * 0.5;
        stars.push([
          { x: sx - 0.05, y: sy },
          { x: sx + 0.05, y: sy + 0.01 },
        ]);
        stars.push([
          { x: sx, y: sy - 0.05 },
          { x: sx, y: sy + 0.05 },
        ]);
      }
      return [[...crescent], ...stars];
    }
    case "wheat": {
      const stalks: Point[][] = [
        [
          { x: -0.1, y: 1 },
          { x: -0.04, y: 0.2 },
          { x: 0, y: -0.55 },
        ],
      ];
      for (let index = 0; index < 6; index += 1) {
        const y = -0.48 + index * 0.23;
        const lean = ((index % 3) - 1) * 0.025;
        stalks.push(
          leafOutline(
            { x: -0.025, y: y + 0.025 },
            { x: -0.31 + lean, y: y - 0.18 - (index % 2) * 0.025 },
            0.052 + (index % 2) * 0.006
          ),
          leafOutline(
            { x: 0.018, y: y + 0.075 },
            { x: 0.29 + lean * 0.6, y: y - 0.11 + (index % 2) * 0.035 },
            0.05 + (index % 3) * 0.004
          )
        );
      }
      return stalks;
    }
    case "ripple":
      return [
        circlePoints(0.9, 22, Math.PI * 0.08, Math.PI * 1.06),
        circlePoints(0.65, 18, Math.PI * 0.02, Math.PI * 0.98),
        circlePoints(0.4, 14, Math.PI * -0.02, Math.PI * 0.96),
      ];
    case "rays": {
      const rays: Point[][] = [];
      for (let index = 0; index < 5; index += 1) {
        const spread = index - 2;
        rays.push([
          { x: -0.7 + spread * 0.14, y: 0.92 },
          { x: 0.12 + spread * 0.24, y: 0.1 + spread * 0.06 },
          { x: 0.6 + spread * 0.32, y: -0.66 + spread * 0.1 },
        ]);
      }
      rays.push([
        { x: 0.32, y: 0.34 },
        { x: 0.62, y: 0.22 },
      ]);
      rays.push([
        { x: 0.46, y: -0.02 },
        { x: 0.74, y: -0.16 },
      ]);
      return rays;
    }
    case "window":
      return [
        [
          { x: -0.82, y: -0.92 },
          { x: 0.7, y: -0.9 },
          { x: 0.72, y: 0.84 },
          { x: -0.8, y: 0.86 },
          { x: -0.82, y: -0.92 },
        ],
        [
          { x: -0.82, y: -0.02 },
          { x: 0.71, y: 0 },
        ],
        [
          { x: -0.06, y: -0.9 },
          { x: -0.05, y: 0.85 },
        ],
        [
          { x: -0.92, y: 0.86 },
          { x: 0.82, y: 0.84 },
          { x: 0.78, y: 0.96 },
          { x: -0.88, y: 0.98 },
          { x: -0.92, y: 0.86 },
        ],
        // 两侧窗帘：上端收拢，下端微微飘起
        [
          { x: -0.78, y: -0.88 },
          { x: -0.62, y: -0.54 },
          { x: -0.7, y: -0.2 },
          { x: -0.58, y: 0.16 },
          { x: -0.68, y: 0.42 },
        ],
        [
          { x: -0.64, y: -0.88 },
          { x: -0.5, y: -0.56 },
          { x: -0.56, y: -0.24 },
          { x: -0.46, y: 0.1 },
        ],
        [
          { x: 0.66, y: -0.86 },
          { x: 0.5, y: -0.52 },
          { x: 0.58, y: -0.18 },
          { x: 0.46, y: 0.18 },
          { x: 0.56, y: 0.44 },
        ],
        [
          { x: 0.52, y: -0.86 },
          { x: 0.38, y: -0.58 },
          { x: 0.44, y: -0.26 },
          { x: 0.34, y: 0.06 },
        ],
        // 窗台上的小盆栽
        [
          { x: -0.3, y: 0.9 },
          { x: -0.24, y: 1.1 },
          { x: 0.1, y: 1.1 },
          { x: 0.16, y: 0.9 },
          { x: -0.3, y: 0.9 },
        ],
        [
          { x: -0.08, y: 0.9 },
          { x: -0.18, y: 0.66 },
          { x: -0.3, y: 0.58 },
        ],
        [
          { x: -0.06, y: 0.9 },
          { x: 0.02, y: 0.6 },
          { x: 0.14, y: 0.56 },
        ],
        [
          { x: -0.07, y: 0.88 },
          { x: 0.18, y: 0.7 },
          { x: 0.26, y: 0.62 },
        ],
        // 斜穿窗格的光线
        [
          { x: -0.5, y: -0.72 },
          { x: 0.16, y: 0.52 },
        ],
        [
          { x: -0.26, y: -0.78 },
          { x: 0.36, y: 0.44 },
        ],
      ];
    case "paperplane":
      return [
        [
          { x: -0.95, y: 0.1 },
          { x: 0.92, y: -0.6 },
          { x: 0.12, y: 0.82 },
          { x: -0.15, y: 0.16 },
          { x: -0.95, y: 0.1 },
        ],
        [
          { x: -0.15, y: 0.16 },
          { x: 0.92, y: -0.6 },
        ],
        [
          { x: -0.5, y: 0.52 },
          { x: -0.78, y: 0.92 },
          { x: -0.52, y: 0.66 },
        ],
      ];
    case "coffeeRing":
      return [
        circlePoints(0.82, 30).map((point) => ({ x: point.x, y: point.y * 0.9 })),
        circlePoints(0.6, 26, 0.4, 1.9).map((point) => ({ x: point.x, y: point.y * 0.9 })),
      ];
    case "rain":
      return Array.from({ length: 5 }, (_, index) => {
        const x = -0.7 + index * 0.34;
        return [
          { x, y: -0.8 },
          { x: x - 0.16, y: -0.2 },
        ];
      });
    case "mountain":
      return [
        [
          { x: -1, y: 0.5 },
          { x: -0.45, y: -0.2 },
          { x: -0.2, y: 0.06 },
          { x: 0.1, y: -0.58 },
          { x: 0.5, y: 0.02 },
          { x: 0.78, y: -0.24 },
          { x: 1, y: 0.5 },
        ],
        [
          { x: -0.45, y: -0.2 },
          { x: -0.25, y: -0.02 },
        ],
        [
          { x: 0.1, y: -0.58 },
          { x: 0.32, y: -0.28 },
        ],
      ];
    case "radio":
      return [
        [
          { x: -0.8, y: -0.5 },
          { x: 0.8, y: -0.5 },
          { x: 0.8, y: 0.6 },
          { x: -0.8, y: 0.6 },
          { x: -0.8, y: -0.5 },
        ],
        circlePoints(0.26, 14, 0, TAU).map((point) => ({ x: point.x - 0.32, y: point.y + 0.18 })),
        [
          { x: 0.2, y: -0.18 },
          { x: 0.64, y: -0.18 },
        ],
        [
          { x: 0.2, y: 0.04 },
          { x: 0.64, y: 0.04 },
        ],
        [
          { x: 0.2, y: 0.26 },
          { x: 0.64, y: 0.26 },
        ],
        [
          { x: -0.5, y: -0.5 },
          { x: -0.2, y: -1 },
        ],
      ];
    case "cassette":
      return [
        [
          { x: -0.9, y: -0.55 },
          { x: 0.9, y: -0.55 },
          { x: 0.9, y: 0.55 },
          { x: -0.9, y: 0.55 },
          { x: -0.9, y: -0.55 },
        ],
        circlePoints(0.24, 16).map((point) => ({ x: point.x - 0.3, y: point.y })),
        circlePoints(0.24, 16).map((point) => ({ x: point.x + 0.3, y: point.y })),
        [
          { x: -0.25, y: 0.4 },
          { x: 0.25, y: 0.4 },
          { x: 0.18, y: 0.62 },
          { x: -0.18, y: 0.62 },
          { x: -0.25, y: 0.4 },
        ],
      ];
    case "starCluster": {
      const stars: Point[][] = [];
      const positions = [
        { x: -0.6, y: 0.4 },
        { x: -0.2, y: -0.5 },
        { x: 0.3, y: 0.2 },
        { x: 0.65, y: -0.35 },
      ];
      for (const position of positions) {
        stars.push([
          { x: position.x - 0.14, y: position.y },
          { x: position.x + 0.14, y: position.y },
        ]);
        stars.push([
          { x: position.x, y: position.y - 0.14 },
          { x: position.x, y: position.y + 0.14 },
        ]);
      }
      return stars;
    }
    case "ribbon":
      return [
        // 两条平行的飘带曲线 + 收尾，像一个手绘小缎带
        Array.from({ length: 17 }, (_, index) => {
          const t = index / 16;
          return { x: -0.92 + t * 1.7, y: Math.sin(t * TAU * 1.15) * 0.24 - 0.1 };
        }),
        Array.from({ length: 17 }, (_, index) => {
          const t = index / 16;
          return { x: -0.92 + t * 1.7, y: Math.sin(t * TAU * 1.15) * 0.24 + 0.16 };
        }),
        [
          { x: 0.78, y: 0.28 },
          { x: 0.92, y: 0.02 },
          { x: 0.74, y: -0.2 },
        ],
      ];
    case "bracket":
      return [
        [
          { x: 0.6, y: -0.9 },
          { x: -0.4, y: -0.7 },
          { x: -0.5, y: 0.7 },
          { x: 0.55, y: 0.92 },
        ],
        [
          { x: 0.9, y: -0.5 },
          { x: 0.2, y: -0.3 },
          { x: 0.15, y: 0.35 },
          { x: 0.85, y: 0.6 },
        ],
      ];
    case "quote":
      return [
        // 左引号：一个小钩，向下拖出笔尾
        [
          { x: -0.68, y: -0.52 },
          { x: -0.44, y: -0.6 },
          { x: -0.3, y: -0.42 },
          { x: -0.34, y: -0.2 },
          { x: -0.5, y: -0.08 },
          { x: -0.62, y: -0.16 },
        ],
        [
          { x: -0.5, y: -0.08 },
          { x: -0.56, y: 0.22 },
        ],
        // 右引号
        [
          { x: 0.02, y: -0.52 },
          { x: 0.26, y: -0.6 },
          { x: 0.4, y: -0.42 },
          { x: 0.36, y: -0.2 },
          { x: 0.2, y: -0.08 },
          { x: 0.08, y: -0.16 },
        ],
        [
          { x: 0.2, y: -0.08 },
          { x: 0.14, y: 0.22 },
        ],
      ];
    case "tape":
    default:
      return [];
  }
}

const FILLED_KINDS: ReadonlySet<HandwrittenDoodleKind> = new Set(["tape", "postageStamp"]);

/** 填充类涂鸦（胶带、邮票）：淡入 + 轻微回弹，不做逐笔生长。 */
function drawFilledDoodle(
  ctx: CanvasRenderingContext2D,
  palette: HandwrittenPalette,
  kind: HandwrittenDoodleKind,
  unit: number,
  role: HandwrittenColorRole,
  progress: number
): void {
  const pop = easeOutBack(progress);
  const alpha = smoothstep(Math.min(1, progress * 1.6));
  ctx.save();
  ctx.globalAlpha = alpha;
  if (kind === "tape") {
    const tapeWidth = unit * 2.4;
    const tapeHeight = unit * 0.72;
    const zig = unit * 0.12;
    ctx.scale(0.92 + pop * 0.08, 0.92 + pop * 0.08);

    // 和纸胶带：主体是不透明米色/彩色半透纸，不再是"看不见的黄色淡块"。
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillStyle = role === "highlight" ? withAlpha(palette.highlight, 0.9) : palette.highlight;
    ctx.beginPath();
    ctx.moveTo(-tapeWidth / 2, -tapeHeight / 2);
    ctx.lineTo(tapeWidth / 2 - zig, -tapeHeight / 2 + unit * 0.02);
    ctx.lineTo(tapeWidth / 2, -unit * 0.04);
    ctx.lineTo(tapeWidth / 2 - zig * 0.6, tapeHeight / 2);
    ctx.lineTo(-tapeWidth / 2, tapeHeight / 2 - unit * 0.02);
    ctx.lineTo(-tapeWidth / 2 + zig * 0.5, 0);
    ctx.closePath();
    ctx.fill();

    // 胶带上的纤维条纹与边缘反光，让它看起来像实物而不是色块。
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = alpha * 0.22;
    ctx.strokeStyle = withAlpha(palette.paperLight, 0.9);
    ctx.lineWidth = Math.max(0.8, unit * 0.012);
    for (let index = -3; index <= 3; index += 1) {
      const offset = (index / 3) * tapeHeight * 0.44;
      ctx.beginPath();
      ctx.moveTo(-tapeWidth * 0.52, offset + unit * 0.008);
      ctx.lineTo(tapeWidth * 0.52, offset - unit * 0.008);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = withAlpha(palette.shadow, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-tapeWidth / 2, -tapeHeight / 2 + unit * 0.005);
    ctx.lineTo(tapeWidth / 2 - zig, -tapeHeight / 2 + unit * 0.02);
    ctx.stroke();
    ctx.restore();

    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = withAlpha(palette.paperDeep, 0.45);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-tapeWidth / 2, tapeHeight / 2 - unit * 0.01);
    ctx.lineTo(tapeWidth / 2 - zig * 0.6, tapeHeight / 2);
    ctx.stroke();
  } else {
    // 邮票：纸片 + 齿孔 + 内框 + 手绘风景（太阳/山/地平线）+ 面值短线
    const size = unit * 1.15;
    const half = size / 2;
    ctx.scale(0.9 + pop * 0.1, 0.9 + pop * 0.1);
    ctx.rotate(-0.04);

    ctx.fillStyle = withAlpha(palette.paperLight, 0.82);
    ctx.strokeStyle = withAlpha(palette.paperDeep, 0.65);
    ctx.lineWidth = Math.max(1, unit * 0.012);
    ctx.beginPath();
    ctx.rect(-half, -half, size, size);
    ctx.fill();
    ctx.stroke();

    // 齿孔：四边各打一排纸色圆点，让方框看起来像能撕下来的邮票
    ctx.fillStyle = withAlpha(palette.paperBase, 0.92);
    const holeRadius = size * 0.026;
    // S5-7：四边齿孔改为四次显式 arc（旧实现每行 7 次循环各新建 4 个坐标数组）。
    for (let index = 0; index < 7; index += 1) {
      const t = -half + ((index + 0.5) * size) / 7;
      for (let side = 0; side < 4; side += 1) {
        const holeX = side < 2 ? t : side === 2 ? -half : half;
        const holeY = side === 0 ? -half : side === 1 ? half : t;
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeRadius, 0, TAU);
        ctx.fill();
      }
    }

    const inset = size * 0.11;
    ctx.strokeStyle = withAlpha(palette.accent, 0.6);
    ctx.lineWidth = Math.max(1, unit * 0.014);
    ctx.strokeRect(-half + inset, -half + inset, size - inset * 2, size - inset * 2);

    // 邮票里的"内容"：手写小字 + 邮戳取消线，而不是通用图片占位符图标
    ctx.save();
    ctx.beginPath();
    ctx.rect(-half + inset * 1.4, -half + inset * 1.4, size - inset * 2.8, size - inset * 2.8);
    ctx.clip();
    ctx.strokeStyle = withAlpha(palette.inkSoft, 0.8);
    ctx.lineWidth = Math.max(0.9, unit * 0.014);
    ctx.lineCap = "round";
    // 三行手写小字：起伏短笔画，远看像一封短信
    for (let line = 0; line < 3; line += 1) {
      const lineY = -size * 0.18 + line * size * 0.16;
      ctx.beginPath();
      const segments = 4 - line;
      for (let segment = 0; segment < segments; segment += 1) {
        const startX = -size * 0.3 + segment * size * 0.16;
        const wobble = stableRandom("stamp", `stamp-line-${line}-${segment}`) * size * 0.035;
        if (segment === 0) ctx.moveTo(startX, lineY + wobble);
        else ctx.lineTo(startX, lineY + wobble);
      }
      ctx.stroke();
    }
    // 邮戳：两圈同心弧 + 数条取消线
    ctx.strokeStyle = withAlpha(palette.seal, 0.55);
    ctx.lineWidth = Math.max(0.9, unit * 0.012);
    ctx.beginPath();
    ctx.arc(size * 0.17, -size * 0.16, size * 0.14, 0.4, Math.PI * 1.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.17, -size * 0.16, size * 0.1, 0.5, Math.PI * 1.6);
    ctx.stroke();
    for (let index = 0; index < 3; index += 1) {
      ctx.beginPath();
      ctx.moveTo(size * 0.02, size * (0.1 + index * 0.06));
      ctx.lineTo(size * 0.34, size * (0.04 + index * 0.06));
      ctx.stroke();
    }
    ctx.restore();

    // 面值短线
    ctx.strokeStyle = withAlpha(palette.accent, 0.45);
    ctx.lineWidth = Math.max(0.8, unit * 0.01);
    for (let index = 0; index < 2; index += 1) {
      const lineY = half - inset * 0.7 + index * unit * 0.028;
      ctx.beginPath();
      ctx.moveTo(-half + inset * 0.9, lineY);
      ctx.lineTo(-half + inset * 1.6, lineY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 绘制一张页边涂鸦；填充类淡入，线条类按落笔进度生长。 */
export function drawHandwrittenDoodle(spec: HandwrittenDoodleSpec, options: DoodleOptions): void {
  const { ctx, palette, width, height } = options;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(spec.x) ||
    !Number.isFinite(spec.y) ||
    !Number.isFinite(spec.rotation) ||
    !Number.isFinite(spec.scale)
  ) {
    return;
  }
  const unit = Number.isFinite(options.unit) ? clamp(options.unit, 1, 512) : 64;
  const specScale = clamp(spec.scale, 0.2, 8);
  const visible = Number.isFinite(options.progress) ? clamp(options.progress, 0, 1) : 0;
  if (visible <= 0) return;
  const quality = options.quality ?? 0;

  ctx.save();
  ctx.translate(width * spec.x, height * spec.y);
  ctx.rotate(spec.rotation);
  ctx.scale(spec.flip ? -specScale : specScale, specScale);

  if (FILLED_KINDS.has(spec.kind)) {
    drawFilledDoodle(ctx, palette, spec.kind, unit, spec.color, visible);
    ctx.restore();
    return;
  }

  const desiredWidth = Math.max(2.2, unit * 0.036);
  const lineWidth = desiredWidth / specScale;
  // 手抖幅度在「单位形状空间」里（形状半径约 1），与画面尺寸/缩放无关，
  // 否则大插画的抖动会被 unit*scale 放大成乱线。
  const roughness =
    spec.kind === "wheat"
      ? 0.012 + stableRandom(spec.kind, "roughness") * 0.01
      : 0.026 + stableRandom(spec.kind, "roughness") * 0.018;
  const rawStrokes = doodleStrokes(spec.kind);
  if (rawStrokes.length === 0) {
    ctx.restore();
    return;
  }

  const geometry = getGeometry(
    spec,
    rawStrokes,
    unit,
    `${spec.kind}:${spec.x.toFixed(3)}:${spec.y.toFixed(3)}`,
    roughness,
    lineWidth
  );
  const boilVariant: 0 | 1 =
    visible < 1 &&
    !options.reducedMotion &&
    options.timeMs !== undefined &&
    Math.floor(options.timeMs / 100) % 2 === 1
      ? 1
      : 0;

  if (spec.kind === "dots") {
    // 点状装饰用实心点，不描线
    const dotSize = unit * 0.04;
    const dotAlpha = visible * roleAlpha(spec.color);
    ctx.globalAlpha = dotAlpha;
    ctx.fillStyle = roleColor(palette, spec.color);
    geometry.strokes.forEach((stroke) => {
      const point = stroke.variant0[0];
      if (!point) return;
      ctx.beginPath();
      ctx.arc(point.x * unit, point.y * unit, dotSize, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  ctx.globalAlpha = 1;
  // S5-7：样式对象复用同一块暂存对象（drawStrokeSet 只读，同步绘制）。
  doodleStrokeStyle.color = roleColor(palette, spec.color);
  doodleStrokeStyle.width = lineWidth;
  doodleStrokeStyle.alpha = roleAlpha(spec.color) * 0.9;
  drawStrokeSet(ctx, geometry, visible, doodleStrokeStyle, options, quality >= 2 ? 0 : boilVariant);
  ctx.restore();
}

export interface EmphasisBox {
  /** 文字单元左上角 */
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  rotation: number;
}

/** 荧光笔底色：先于文字绘制，模拟在字上涂一道水彩。 */
export function drawHandwrittenHighlight(
  ctx: CanvasRenderingContext2D,
  palette: HandwrittenPalette,
  box: EmphasisBox,
  progress: number
): void {
  const visible = easeInOutSine(smoothstep(progress));
  if (visible <= 0) return;
  const centerX = box.x + box.width * 0.5;
  const halfWidth = (box.width * 0.5 + box.fontSize * 0.14) * visible;
  const bandY = box.fontSize * 0.05;
  const unit = box.fontSize;

  ctx.save();
  ctx.translate(centerX, box.y);
  ctx.rotate(box.rotation - 0.01);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 荧光笔 = 2–3 道半透明、圆头、略带起伏的粗笔画叠加，而不是一个矩形色块；
  // 笔迹只覆盖字的中下部（基线到 x-height），上下边缘自然变淡。
  // S5-7：三道笔触的常量表提到模块级，逐帧只算坐标，不再新建数组 + 3 个对象。
  for (let index = 0; index < HIGHLIGHT_STROKES.length; index += 1) {
    const stroke = HIGHLIGHT_STROKES[index]!;
    const strokeY = bandY + unit * stroke.offset;
    ctx.globalAlpha = stroke.alpha * visible;
    ctx.strokeStyle = stroke.colorRole === "line" ? palette.highlightLine : palette.highlight;
    ctx.lineWidth = unit * stroke.width;
    ctx.beginPath();
    ctx.moveTo(-halfWidth, strokeY + unit * 0.02);
    ctx.quadraticCurveTo(
      -halfWidth * 0.3,
      strokeY - unit * 0.035,
      halfWidth * 0.88,
      strokeY + unit * 0.015
    );
    ctx.quadraticCurveTo(
      halfWidth + unit * 0.03,
      strokeY + unit * 0.02,
      halfWidth,
      strokeY - unit * 0.015
    );
    ctx.stroke();
  }

  // 端头的圆点笔头 + 一小块更浓的收笔，让两端不平齐。
  ctx.globalAlpha = 0.18 * visible;
  ctx.fillStyle = palette.highlightLine;
  ctx.beginPath();
  ctx.ellipse(halfWidth * 0.96, bandY + unit * 0.02, unit * 0.045, unit * 0.12, -0.12, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.12 * visible;
  ctx.beginPath();
  ctx.ellipse(-halfWidth * 0.99, bandY - unit * 0.08, unit * 0.035, unit * 0.1, 0.14, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 重点标注：下划线 / 圈画。绘制在文字之后，带落笔回弹。 */
export function drawHandwrittenAnnotation(
  ctx: CanvasRenderingContext2D,
  palette: HandwrittenPalette,
  style: "underline" | "circle",
  box: EmphasisBox,
  progress: number,
  seed: string,
  annotationColor?: string
): void {
  const reveal = clamp(progress, 0, 1);
  if (reveal <= 0) return;
  const visible = style === "circle" ? clamp(easeOutBack(reveal), 0, 1.08) : easeOutCubic(reveal);
  const color = annotationColor ?? palette.accent;

  ctx.save();
  ctx.translate(box.x + box.width * 0.5, box.y);
  ctx.rotate(box.rotation);
  const unit = box.fontSize;

  if (style === "underline") {
    const half = box.width * 0.5 + unit * 0.14;
    const y = box.height * 0.58;
    const strokes: Point[][] = [
      [
        { x: -half, y: y + unit * 0.03 },
        { x: -half * 0.45, y: y - unit * 0.015 },
        { x: 0.12 * half, y: y + unit * 0.02 },
        { x: half * 0.64, y: y - unit * 0.012 },
        { x: half, y: y - unit * 0.04 },
      ],
      [
        { x: -half * 0.86, y: y + unit * 0.13 },
        { x: half * 0.72, y: y + unit * 0.1 },
      ],
    ];
    const lengths = strokes.map((stroke) => strokeLength(stroke));
    const totalLength = lengths.reduce((sum, length) => sum + length, 0);
    let budget = totalLength * visible;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let index = 0; index < strokes.length; index += 1) {
      const sideStroke = strokes[index]!;
      const strokeLen = Math.max(0.001, lengths[index]!);
      const local = clamp(budget / strokeLen, 0, 1);
      if (local <= 0) break;
      const widthBase = Math.max(1.8, unit * (index === 0 ? 0.032 : 0.022));
      ctx.strokeStyle = withAlpha(color, index === 0 ? 0.84 : 0.46);
      ctx.lineWidth = widthBase;
      strokePartial(ctx, sideStroke, 1, local);
      budget -= strokeLen;
    }
  } else {
    const radiusX = (box.width * 0.5 + unit * 0.3) * visible;
    const radiusY = unit * 0.56 * visible;
    ctx.strokeStyle = withAlpha(color, 0.8);
    ctx.lineWidth = Math.max(1.7, unit * 0.028);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let index = 0; index <= 34; index += 1) {
      const angle = (index / 30) * TAU * 1.07 - 0.5;
      const x = Math.cos(angle) * radiusX;
      const y = Math.sin(angle) * radiusY;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

export interface SealOptions {
  ctx: CanvasRenderingContext2D;
  palette: HandwrittenPalette;
  fontFamily: string;
  x: number;
  y: number;
  size: number;
  text: string;
  progress: number;
  rotation: number;
  quality?: number;
}

/** 红色印章：盖下的瞬间带一点弹性与飞白。 */
export function drawHandwrittenSeal(options: SealOptions): void {
  const { ctx, palette, x, y, size, text, progress, rotation, fontFamily } = options;
  if (progress <= 0) return;
  const eased = easeOutBack(clamp(progress, 0, 1));
  const scale = 0.68 + eased * 0.34;
  const alpha = clamp(progress * 2.4, 0, 1);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  const half = size * 0.5;
  const radius = size * 0.11;
  ctx.fillStyle = withAlpha(palette.seal, 0.92);
  ctx.beginPath();
  ctx.roundRect(-half, -half, size, size, radius);
  ctx.fill();

  ctx.strokeStyle = withAlpha(palette.seal, 0.6);
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.beginPath();
  ctx.roundRect(-half + 1, -half + 1, size - 2, size - 2, radius * 0.9);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(palette.paperLight, 0.5);
  ctx.lineWidth = Math.max(0.8, size * 0.018);
  ctx.beginPath();
  ctx.roundRect(-half + size * 0.09, -half + size * 0.09, size * 0.82, size * 0.82, radius * 0.7);
  ctx.stroke();

  // 缺墨：真实印章边缘会有 15–30% 的空白与毛边，不是完美红方块。
  ctx.globalCompositeOperation = "destination-out";
  for (let index = 0; index < 26; index += 1) {
    const chipAngle = stableRandom(text, `chip-angle-${index}`) * Math.PI * 2;
    const chipDistance = size * (0.36 + stableRandom(text, `chip-dist-${index}`) * 0.16);
    const chipRadius = size * (0.012 + stableRandom(text, `chip-size-${index}`) * 0.03);
    ctx.globalAlpha = 0.35 + stableRandom(text, `chip-alpha-${index}`) * 0.45;
    ctx.beginPath();
    ctx.arc(
      Math.cos(chipAngle) * chipDistance,
      Math.sin(chipAngle) * chipDistance,
      chipRadius,
      0,
      TAU
    );
    ctx.fill();
  }
  // 内部也散布少量缺墨点，避免红色块太"实"。
  for (let index = 0; index < 10; index += 1) {
    const dotX = (stableRandom(text, `void-x-${index}`) - 0.5) * size * 0.72;
    const dotY = (stableRandom(text, `void-y-${index}`) - 0.5) * size * 0.72;
    const dotRadius = size * (0.008 + stableRandom(text, `void-r-${index}`) * 0.018);
    ctx.globalAlpha = 0.2 + stableRandom(text, `void-a-${index}`) * 0.35;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;

  const label = Array.from(text.trim()).slice(0, 2).join("");
  if (label) {
    ctx.fillStyle = withAlpha(palette.paperLight, 0.9);
    ctx.font = `700 ${size * (label.length > 1 ? 0.34 : 0.44)}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, size * 0.03);
  }

  if ((options.quality ?? 0) < 2) {
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = withAlpha(palette.paperBase, 0.8);
    for (let index = 0; index < 7; index += 1) {
      const dotX = (stableRandom(text, `seal-x-${index}`) - 0.5) * size * 0.8;
      const dotY = (stableRandom(text, `seal-y-${index}`) - 0.5) * size * 0.8;
      const dotRadius = size * (0.008 + stableRandom(text, `seal-r-${index}`) * 0.016);
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = withAlpha(palette.seal, 0.72);
    for (let index = 0; index < 8; index += 1) {
      const angle = stableRandom(text, `spray-a-${index}`) * TAU;
      const distance = size * (0.55 + stableRandom(text, `spray-d-${index}`) * 0.45);
      const dotRadius = size * (0.006 + stableRandom(text, `spray-r-${index}`) * 0.014);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, dotRadius, 0, TAU);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
