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
import { getLargeIllustrationStrokes } from "./handwrittenIllustration";
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
  /** 大尺幅插画：沿笔画撒少量炭笔颗粒，避免"矢量描边"感 */
  grain?: boolean;
  /** 颗粒尺寸的逆缩放：大插画经 ctx.scale 后颗粒不应变成粗黑点 */
  grainScale?: number;
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
  /** 水彩/排线用的闭合轮廓路径缓存（同一几何只构建一次） */
  contourPaths?: Map<number, Path2D>;
  /** 铅笔排线路径缓存（把所有排线合成一个 Path2D，每帧 1–2 次 stroke） */
  hatchPaths?: { main: Path2D; cross?: Path2D };
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

/**
 * 笔触骨架的两种形态：
 * - smooth：Catmull-Rom 平滑 + 法线抖动，适合叶/云/花这类有机形状；
 * - sharp：线性细分 + 法线抖动，角点保持准确，适合窗框/纸飞机/山脊这类
 *   几何形状——旧版对矩形也做平滑，结果窗被"磨"成了圆角八边形。
 */
type RoughMode = "smooth" | "sharp";

/** 用锐角笔触绘制的几何涂鸦：窗框、纸飞机、山脊、收音机等"直线器物"。 */
const SHARP_CORNER_KINDS: ReadonlySet<HandwrittenDoodleKind> = new Set([
  "window",
  "paperplane",
  "mountain",
  "radio",
  "cassette",
]);

/** 把折线细分并沿法线抖动，得到手绘感的点列。 */
function roughen(
  points: readonly Point[],
  seed: string,
  amount: number,
  subdivide = 3,
  mode: RoughMode = "smooth"
): Point[] {
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
      if (mode === "sharp") {
        // 角点原样保留（step===0），段内的点只沿法线轻微抖动，
        // 因此矩形仍是矩形、山脊仍是尖角，只多一点手绘的"不直"。
        if (step === 0) {
          result.push({ x: from.x, y: from.y });
          continue;
        }
        const wobble = (stableRandom(seed, `wobble-${index}-${step}`) - 0.5) * amount * 2;
        result.push({
          x: from.x + dx * t + normalX * wobble,
          y: from.y + dy * t + normalY * wobble,
        });
        continue;
      }
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
  strokeWidth: number,
  sharpStrokes?: readonly boolean[]
): GeometrySet {
  let set = geometryCache.get(owner);
  if (!set) {
    set = new Map();
    geometryCache.set(owner, set);
  }
  // 锐角模式是逐笔的：窗框/窗棂/花盆这类少点的"器物线"走直线，
  // 同一个大插画里的叶片、茎、山弧仍走平滑曲线，避免叶子被削成多边形。
  const modeKey = sharpStrokes ? sharpStrokes.map((sharp) => (sharp ? "1" : "0")).join("") : "-";
  const key = `${unit}:${strokeWidth}:${seed}:${roughness}:${rawStrokes.length}:${modeKey}`;
  const cached = set.get(key);
  if (cached) {
    set.delete(key);
    set.set(key, cached);
    return cached;
  }

  const strokes: CachedStroke[] = rawStrokes.map((raw, index) => {
    const mode: RoughMode = sharpStrokes?.[index] ? "sharp" : "smooth";
    const variant0 = roughen(raw, `${seed}:0:${index}`, roughness, 3, mode);
    const variant1 = roughen(raw, `${seed}:1:${index}`, roughness, 3, mode);
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
  const completionAt = (index: number) =>
    clamp(progress * (1 + stagger) - (index / strokes.length) * stagger, 0, 1);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let index = 0; index < strokes.length; index += 1) {
    const stroke = strokes[index]!;
    const localProgress = completionAt(index);
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

  if (style.grain && quality < 2 && progress > 0.35) {
    // 沿笔画撒少量暗色颗粒：铅笔/炭笔在纸纤维上留下的断续笔痕。
    ctx.save();
    ctx.fillStyle = withAlpha(style.color, style.alpha * 0.5);
    const grainScale = Math.max(1, style.grainScale ?? 1);
    const grainBudget = Math.min(12, strokes.length * 2);
    for (let index = 0; index < grainBudget; index += 1) {
      const strokeIndex = Math.floor(
        stableRandom(`${style.color}:g`, `s${index}`) * strokes.length
      );
      if (completionAt(strokeIndex) < 0.999) continue;
      const stroke = strokes[strokeIndex];
      if (!stroke) continue;
      const points = stroke.variant0;
      if (points.length === 0) continue;
      const point =
        points[Math.floor(stableRandom(`${style.color}:g`, `p${index}`) * points.length)]!;
      const radius = (0.45 + stableRandom(`${style.color}:g`, `r${index}`) * 0.8) / grainScale;
      const spreadX =
        ((stableRandom(`${style.color}:g`, `x${index}`) - 0.5) * unit * 0.02) / grainScale;
      const spreadY =
        ((stableRandom(`${style.color}:g`, `y${index}`) - 0.5) * unit * 0.02) / grainScale;
      ctx.beginPath();
      ctx.arc(point.x * unit + spreadX, point.y * unit + spreadY, radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
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

/**
 * 大幅插画的"水彩铺底"：只在闭合轮廓内填一层极淡色，
 * 让铅笔稿不再只是空线框（叶子、云、窗、花、月亮等）。
 */
const ILLUSTRATION_WASH: Partial<
  Record<
    HandwrittenDoodleKind,
    {
      role: HandwrittenColorRole;
      alpha: number;
      stroke: number;
      /** 可选：在内层轮廓里再铺一层更淡的"透光"色（窗玻璃、月晕） */
      innerStroke?: number;
      innerAlpha?: number;
      innerRole?: HandwrittenColorRole;
    }
  >
> = {
  leaf: { role: "highlight", alpha: 0.12, stroke: 0 },
  cloud: { role: "highlight", alpha: 0.1, stroke: 0 },
  flower: { role: "accent", alpha: 0.1, stroke: 0 },
  moon: { role: "highlight", alpha: 0.12, stroke: 0 },
  window: {
    role: "highlight",
    alpha: 0.05,
    stroke: 0,
    innerStroke: 1,
    innerAlpha: 0.06,
    innerRole: "highlight",
  },
  mountain: { role: "highlight", alpha: 0.08, stroke: 0 },
  sun: { role: "highlight", alpha: 0.1, stroke: 0 },
  heart: { role: "accent", alpha: 0.1, stroke: 0 },
};

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

/**
 * 铅笔排线（明暗）：大幅插画如果只有轮廓线，会像"图标/线框"；
 * 真实速写会用一组平行短线在背光侧压出体积。这里按 kind 给一个
 * 「闭合裁剪轮廓 + 排线角度 + 光向」，在轮廓内、背光侧排 8–26 根短线，
 * 透明度沿光向从 0 渐变到目标值——不需要逐像素渐变，成本固定。
 */
interface IllustrationHatch {
  /** 用于裁剪的闭合轮廓（geometry.strokes 下标；0 通常是主轮廓） */
  clipStroke: number;
  /** 排线方向（弧度，0 = 水平线） */
  angle: number;
  /** 相邻排线间距（局部单位坐标） */
  spacing: number;
  /** 背光侧最深处的墨色透明度 */
  alpha: number;
  /** 光的来向（弧度）：排线沿该方向渐隐到 0 */
  lightAngle: number;
  /** 排线颜色（pencil = 铅笔灰） */
  role: HandwrittenColorRole;
  /** 暗部再叠一层反向交叉排线（铅笔速写里压重的方法） */
  cross?: { angle: number; alphaFactor: number; spacingFactor: number };
}

const ILLUSTRATION_HATCH: Partial<Record<HandwrittenDoodleKind, IllustrationHatch>> = {
  leaf: {
    clipStroke: 0,
    angle: -0.62,
    spacing: 0.062,
    alpha: 0.2,
    lightAngle: 2.28,
    role: "pencil",
    cross: { angle: 1.05, alphaFactor: 0.55, spacingFactor: 1.5 },
  },
  cloud: {
    clipStroke: 0,
    angle: -0.1,
    spacing: 0.078,
    alpha: 0.13,
    lightAngle: 2.72,
    role: "pencil",
  },
  flower: {
    clipStroke: 0,
    angle: -0.8,
    spacing: 0.07,
    alpha: 0.16,
    lightAngle: 2.36,
    role: "pencil",
  },
  moon: {
    clipStroke: 0,
    angle: 0.18,
    spacing: 0.068,
    alpha: 0.15,
    lightAngle: 2.6,
    role: "pencil",
  },

  window: {
    clipStroke: 0,
    angle: Math.PI / 2,
    spacing: 0.125,
    alpha: 0.07,
    lightAngle: 2.5,
    role: "pencil",
  },
  mountain: {
    clipStroke: 0,
    angle: -0.92,
    spacing: 0.06,
    alpha: 0.21,
    lightAngle: 2.05,
    role: "pencil",
    cross: { angle: 0.42, alphaFactor: 0.5, spacingFactor: 1.6 },
  },
  paperplane: {
    clipStroke: 0,
    angle: -0.32,
    spacing: 0.062,
    alpha: 0.17,
    lightAngle: 2.22,
    role: "pencil",
    cross: { angle: 0.86, alphaFactor: 0.45, spacingFactor: 1.7 },
  },
  heart: {
    clipStroke: 0,
    angle: -0.72,
    spacing: 0.066,
    alpha: 0.13,
    lightAngle: 2.4,
    role: "accent",
  },
};

/** 把点列转成闭合 Path2D（水彩/排线的裁剪轮廓）。 */
function buildContourPath(points: readonly Point[], unit: number): Path2D | null {
  if (typeof Path2D === "undefined" || points.length < 3) return null;
  const path = new Path2D();
  path.moveTo(points[0]!.x * unit, points[0]!.y * unit);
  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index]!.x * unit, points[index]!.y * unit);
  }
  path.closePath();
  return path;
}

/** 取（并缓存）某根笔画转成的闭合轮廓路径。 */
function getContourPath(geometry: GeometrySet, strokeIndex: number, unit: number): Path2D | null {
  const points = geometry.strokes[strokeIndex]?.variant0;
  if (!points || points.length < 3) return null;
  let cache = geometry.contourPaths;
  if (!cache) {
    cache = new Map();
    geometry.contourPaths = cache;
  }
  const cached = cache.get(strokeIndex);
  if (cached) return cached;
  const path = buildContourPath(points, unit);
  if (path) cache.set(strokeIndex, path);
  return path;
}

/** 闭合轮廓的包围盒（局部单位坐标）。 */
function contourBounds(points: readonly Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * 在闭合轮廓内按光向排线，给插画加"铅笔压出来的暗部"。
 * 只在形状基本画完（visible >= 0.72）后出现，避免出笔阶段出现漂浮排线。
 */
/** 构建（并缓存）排线路径：所有排线合成一个 Path2D，每帧只 stroke 1–2 次。 */
function getHatchPaths(
  geometry: GeometrySet,
  spec: HandwrittenDoodleSpec,
  unit: number,
  config: IllustrationHatch
): { main: Path2D; soft?: Path2D; cross?: Path2D } | null {
  if (geometry.hatchPaths) return geometry.hatchPaths;
  const stroke = geometry.strokes[config.clipStroke];
  if (!stroke || stroke.variant0.length < 3) return null;
  const points = stroke.variant0;
  const bounds = contourBounds(points);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  const diagonal = Math.hypot(spanX, spanY) / 2;
  if (diagonal < 0.18) return null;
  if (typeof Path2D === "undefined") return null;

  /**
   * 一组排线，分成两条路径：主路径（~70% 的线）与轻路径（~30% 的线）。
   * 轻路径用更低透明度二次描一遍，让排线深浅不齐，不再像"梳齿/刮痕"。
   * 每条线的间距、端点、弓形都带独立抖动。
   */
  const buildLines = (
    angle: number,
    step: number,
    count: number,
    wobbleScale: number,
    salt: string
  ): { strong: Path2D; soft: Path2D } => {
    const strong = new Path2D();
    const soft = new Path2D();
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const perpX = -dirY;
    const perpY = dirX;
    const halfSpan = diagonal + step;
    const wobbleAmount = step * 0.22 * wobbleScale;
    for (let index = 0; index <= count; index += 1) {
      const path = stableRandom(`${spec.kind}:${salt}`, `w${index}`) < 0.3 ? soft : strong;
      // 线距也抖：±30% 间距，避免均匀梳齿感。
      const offsetJitter = (stableRandom(`${spec.kind}:${salt}`, `j${index}`) - 0.5) * step * 0.6;
      const offset = -halfSpan + (index / count) * halfSpan * 2 + offsetJitter;
      const ox = centerX + perpX * offset;
      const oy = centerY + perpY * offset;
      const wobbleA = (stableRandom(`${spec.kind}:${salt}`, `a${index}`) - 0.5) * wobbleAmount * 2;
      const wobbleB = (stableRandom(`${spec.kind}:${salt}`, `b${index}`) - 0.5) * wobbleAmount * 2;
      // 每根排线中间带一点弓形/弯曲，避免"尺子画的平行线"。
      const bow = (stableRandom(`${spec.kind}:${salt}`, `m${index}`) - 0.5) * step * 1.2;
      path.moveTo(
        (ox - dirX * halfSpan + perpX * wobbleA) * unit,
        (oy - dirY * halfSpan + perpY * wobbleA) * unit
      );
      path.quadraticCurveTo(
        (ox + perpX * bow) * unit,
        (oy + perpY * bow) * unit,
        (ox + dirX * halfSpan + perpX * wobbleB) * unit,
        (oy + dirY * halfSpan + perpY * wobbleB) * unit
      );
    }
    return { strong, soft };
  };

  const step = Math.max(0.032, config.spacing);
  const halfSpan = diagonal + step;
  const lineCount = Math.min(26, Math.max(6, Math.round((halfSpan * 2) / step)));
  const mainLines = buildLines(config.angle, step, lineCount, 1, "hatch");
  let cross: Path2D | undefined;
  if (config.cross) {
    const crossStep = Math.max(0.05, step * config.cross.spacingFactor);
    const crossCount = Math.min(22, Math.max(5, Math.round((halfSpan * 2) / crossStep)));
    const crossLines = buildLines(config.cross.angle, crossStep, crossCount, 0.7, "cross");
    cross = crossLines.strong;
  }
  const result: { main: Path2D; soft?: Path2D; cross?: Path2D } = {
    main: mainLines.strong,
    soft: mainLines.soft,
    ...(cross ? { cross } : {}),
  };
  geometry.hatchPaths = result;
  return result;
}

/**
 * 在闭合轮廓内按光向排线，给插画加"铅笔压出来的暗部"。
 * 只在形状基本画完（visible >= 0.72）后出现，避免出笔阶段出现漂浮排线；
 * 排线路径按几何缓存，每帧成本 = 1 次 clip + 2–3 次 stroke（主/轻/交叉）。
 */
function drawIllustrationHatching(
  ctx: CanvasRenderingContext2D,
  palette: HandwrittenPalette,
  geometry: GeometrySet,
  unit: number,
  spec: HandwrittenDoodleSpec,
  visible: number,
  lineWidth: number
): void {
  const config = ILLUSTRATION_HATCH[spec.kind];
  if (!config) return;
  const clipPath = getContourPath(geometry, config.clipStroke, unit);
  const stroke = geometry.strokes[config.clipStroke];
  if (!clipPath || !stroke) return;
  const bounds = contourBounds(stroke.variant0);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2;
  const ramp = clamp((visible - 0.72) / 0.28, 0, 1);
  const alpha = config.alpha * ramp * (palette.dark ? 0.76 : 1);
  if (alpha <= 0.004) return;
  const paths = getHatchPaths(geometry, spec, unit, config);
  if (!paths) return;

  const color = roleColor(palette, config.role);
  const lightX = Math.cos(config.lightAngle);
  const lightY = Math.sin(config.lightAngle);
  const buildGradient = (finalAlpha: number, floor: number): CanvasGradient => {
    const gradient = ctx.createLinearGradient(
      (centerX - lightX * diagonal) * unit,
      (centerY - lightY * diagonal) * unit,
      (centerX + lightX * diagonal) * unit,
      (centerY + lightY * diagonal) * unit
    );
    gradient.addColorStop(0, withAlpha(color, 0));
    gradient.addColorStop(floor, withAlpha(color, floor < 0.5 ? 0 : finalAlpha * 0.1));
    gradient.addColorStop(Math.min(0.98, floor + 0.32), withAlpha(color, finalAlpha * 0.52));
    gradient.addColorStop(1, withAlpha(color, finalAlpha));
    return gradient;
  };

  ctx.save();
  ctx.clip(clipPath);
  ctx.lineCap = "round";
  ctx.strokeStyle = buildGradient(alpha, 0.28);
  ctx.lineWidth = Math.max(0.35, lineWidth * 0.52);
  ctx.stroke(paths.main);
  if (paths.soft) {
    ctx.strokeStyle = buildGradient(alpha * 0.55, 0.34);
    ctx.lineWidth = Math.max(0.32, lineWidth * 0.44);
    ctx.stroke(paths.soft);
  }
  if (paths.cross && config.cross) {
    ctx.strokeStyle = buildGradient(alpha * config.cross.alphaFactor, 0.62);
    ctx.lineWidth = Math.max(0.32, lineWidth * 0.44);
    ctx.stroke(paths.cross);
  }
  ctx.restore();
}

/**
 * 水彩铺底升级：不再是"一层均匀色块"，而是
 * 底色 + 1–2 团更浓的沉积 + 轮廓内侧一圈"水痕"（水彩干后的深边），
 * 仍是固定几笔填充，成本与旧版同量级。
 */
function drawIllustrationWash(
  ctx: CanvasRenderingContext2D,
  palette: HandwrittenPalette,
  geometry: GeometrySet,
  unit: number,
  spec: HandwrittenDoodleSpec,
  visible: number,
  wash: {
    role: HandwrittenColorRole;
    alpha: number;
    stroke: number;
    innerStroke?: number;
    innerAlpha?: number;
    innerRole?: HandwrittenColorRole;
  },
  lineWidth: number
): void {
  const strokeIndex = Math.min(wash.stroke, geometry.strokes.length - 1);
  const stroke = geometry.strokes[strokeIndex];
  const points = stroke?.variant0;
  if (!points || points.length < 3) return;
  // 轮廓路径按几何缓存，避免每帧新建 Path2D。
  const contour = getContourPath(geometry, strokeIndex, unit);
  if (!contour) return;
  const bounds = contourBounds(points);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const spanX = Math.max(0.001, bounds.maxX - bounds.minX);
  const spanY = Math.max(0.001, bounds.maxY - bounds.minY);
  const color = roleColor(palette, wash.role);

  ctx.save();
  // 1) 底色
  ctx.globalAlpha = visible * wash.alpha;
  ctx.fillStyle = color;
  ctx.fill(contour);

  // 2) 沉积：2 团更浓的色，位置/大小由 kind + 固定 seed 决定，打破均匀块面。
  ctx.clip(contour);
  for (let index = 0; index < 2; index += 1) {
    const cx = centerX + (stableRandom(`${spec.kind}:wash`, `x${index}`) - 0.5) * spanX * 0.42;
    const cy = centerY + (stableRandom(`${spec.kind}:wash`, `y${index}`) - 0.5) * spanY * 0.42;
    const radius =
      Math.max(spanX, spanY) * (0.22 + stableRandom(`${spec.kind}:wash`, `r${index}`) * 0.2);
    ctx.globalAlpha = visible * wash.alpha * (0.4 + index * 0.12);
    ctx.beginPath();
    const steps = 12;
    for (let stepIndex = 0; stepIndex <= steps; stepIndex += 1) {
      const angle = (stepIndex / steps) * TAU;
      const wobble = 0.78 + stableRandom(`${spec.kind}:wash`, `w${index}-${stepIndex}`) * 0.36;
      const px = cx + Math.cos(angle) * radius * wobble * 1.1;
      const py = cy + Math.sin(angle) * radius * wobble * 0.9;
      if (stepIndex === 0) ctx.moveTo(px * unit, py * unit);
      else ctx.lineTo(px * unit, py * unit);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3) 水痕：轮廓内侧一圈更深的边，模拟水彩干燥后颜料在边缘堆积。
  ctx.save();
  ctx.globalAlpha = visible * Math.min(0.34, wash.alpha * 1.7);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, lineWidth * 0.5);
  ctx.stroke(contour);
  ctx.restore();

  // 4) 内层透光（可选）：窗玻璃 / 月晕这类"形状内部还有一层光"的插画，
  //    在第二个轮廓里再铺一层更淡的暖色，让窗看起来有光进来，而不是空框。
  if (wash.innerStroke !== undefined && wash.innerAlpha !== undefined) {
    const innerIndex = Math.min(wash.innerStroke, geometry.strokes.length - 1);
    const innerContour = getContourPath(geometry, innerIndex, unit);
    if (innerContour) {
      ctx.save();
      ctx.globalAlpha = visible * wash.innerAlpha * (wash.innerRole ? 1 : 0.8);
      ctx.fillStyle = roleColor(palette, wash.innerRole ?? wash.role);
      ctx.fill(innerContour);
      ctx.restore();
    }
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
        // 云的体积线：内部两道起伏 + 下方短雨线，避免只是一个轮廓。
        [
          { x: -0.58, y: 0.2 },
          { x: -0.22, y: 0.1 },
          { x: 0.16, y: 0.14 },
        ],
        [
          { x: 0.28, y: 0.18 },
          { x: 0.56, y: 0.1 },
        ],
        [
          { x: -0.46, y: 0.54 },
          { x: -0.52, y: 0.7 },
        ],
        [
          { x: 0.0, y: 0.54 },
          { x: 0.05, y: 0.7 },
        ],
        [
          { x: 0.44, y: 0.52 },
          { x: 0.5, y: 0.66 },
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
        // 主叶脉（略弯）+ 三对侧脉 + 叶柄，让它像速写而不是一枚图标。
        [
          { x: -0.74, y: 0.34 },
          { x: -0.3, y: 0.08 },
          { x: 0.2, y: -0.16 },
          { x: 0.62, y: -0.33 },
        ],
        [
          { x: -0.5, y: -0.02 },
          { x: -0.64, y: -0.3 },
        ],
        [
          { x: -0.42, y: 0.02 },
          { x: -0.4, y: 0.3 },
        ],
        [
          { x: -0.1, y: -0.2 },
          { x: -0.2, y: -0.42 },
        ],
        [
          { x: -0.02, y: -0.16 },
          { x: 0.06, y: 0.1 },
        ],
        [
          { x: 0.28, y: -0.27 },
          { x: 0.3, y: -0.44 },
        ],
        [
          { x: 0.34, y: -0.22 },
          { x: 0.46, y: -0.02 },
        ],
        [
          { x: -0.86, y: 0.38 },
          { x: -1.0, y: 0.52 },
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
    case "ripple": {
      // 水纹：三条压扁的同心弧 + 两道反光短线，避免三条完整圆弧读成"碗"。
      const ring = (radiusX: number, radiusY: number, from: number, to: number) =>
        circlePoints(1, 22, from, to).map((point) => ({
          x: point.x * radiusX,
          y: point.y * radiusY,
        }));
      return [
        ring(0.92, 0.3, Math.PI * 0.04, Math.PI * 1.04),
        ring(0.64, 0.21, Math.PI * 0.1, Math.PI * 1.1),
        ring(0.38, 0.13, Math.PI * 0.18, Math.PI * 1.02),
        [
          { x: -0.14, y: -0.02 },
          { x: 0.22, y: 0.03 },
        ],
        [
          { x: -0.04, y: 0.14 },
          { x: 0.16, y: 0.17 },
        ],
      ];
    }
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
        // 窗框双线：外框与内框错开一点，像用笔描过两遍；竖长比例更像窗。
        [
          { x: -0.5, y: -0.92 },
          { x: 0.5, y: -0.9 },
          { x: 0.52, y: 0.7 },
          { x: -0.52, y: 0.72 },
          { x: -0.5, y: -0.92 },
        ],
        [
          { x: -0.42, y: -0.84 },
          { x: 0.42, y: -0.82 },
          { x: 0.44, y: 0.62 },
          { x: -0.44, y: 0.64 },
          { x: -0.42, y: -0.84 },
        ],
        // 一横一竖的窗棂
        [
          { x: 0.0, y: -0.84 },
          { x: 0.0, y: 0.64 },
        ],
        [
          { x: -0.44, y: -0.12 },
          { x: 0.44, y: -0.1 },
        ],
        // 窗台：一道压线 + 一道外挑的边
        [
          { x: -0.66, y: 0.72 },
          { x: 0.66, y: 0.7 },
        ],
        [
          { x: -0.62, y: 0.84 },
          { x: 0.62, y: 0.82 },
        ],
        // 窗台小盆栽：花盆 + 两片叶
        [
          { x: -0.24, y: 0.72 },
          { x: -0.19, y: 0.92 },
          { x: 0.03, y: 0.93 },
          { x: 0.08, y: 0.72 },
        ],
        [
          { x: -0.08, y: 0.72 },
          { x: -0.16, y: 0.56 },
          { x: -0.28, y: 0.5 },
        ],
        [
          { x: -0.08, y: 0.72 },
          { x: 0.01, y: 0.54 },
          { x: 0.12, y: 0.5 },
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
    case "rain": {
      const drops: Point[][] = Array.from({ length: 8 }, (_, index) => {
        const x = -0.82 + index * 0.23;
        const startY = -0.82 + (index % 3) * 0.1;
        const length = 0.5 + (index % 2) * 0.22;
        return [
          { x, y: startY },
          { x: x - 0.16, y: startY + length },
        ];
      });
      // 底部一小段积水弧，让"雨"不是一排斜线。
      drops.push([
        { x: -0.72, y: 0.64 },
        { x: -0.1, y: 0.72 },
        { x: 0.6, y: 0.6 },
      ]);
      return drops;
    }
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
    ctx.scale(0.92 + pop * 0.08, 0.92 + pop * 0.08);

    // 撕口：两端各一段不规则锯齿，上下边也有轻微起伏——不是一块圆角矩形。
    const buildTapePath = (): Path2D => {
      const path = new Path2D();
      const segments = 6;
      const edgeJitter = (seed: string) => (stableRandom("tape-edge", seed) - 0.5) * unit * 0.028;
      for (let index = 0; index <= segments; index += 1) {
        const x = -tapeWidth / 2 + (tapeWidth * index) / segments;
        const y = -tapeHeight / 2 + edgeJitter(`top${index}`);
        if (index === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      const endSteps = 4;
      for (let index = 1; index <= endSteps; index += 1) {
        const y = -tapeHeight / 2 + (tapeHeight * index) / endSteps;
        const bite = stableRandom("tape-edge", `r${index}`) * unit * 0.09;
        path.lineTo(tapeWidth / 2 - bite, y);
      }
      for (let index = 0; index <= segments; index += 1) {
        const x = tapeWidth / 2 - (tapeWidth * index) / segments;
        const y = tapeHeight / 2 + edgeJitter(`bottom${index}`);
        path.lineTo(x, y);
      }
      for (let index = 1; index <= endSteps; index += 1) {
        const y = tapeHeight / 2 - (tapeHeight * index) / endSteps;
        const bite = stableRandom("tape-edge", `l${index}`) * unit * 0.09;
        path.lineTo(-tapeWidth / 2 + bite, y);
      }
      path.closePath();
      return path;
    };
    const tape = buildTapePath();

    // 投影：胶带是贴在纸上的，会挡住一点纸的光。
    ctx.save();
    ctx.globalAlpha = alpha * 0.16;
    ctx.translate(unit * 0.035, unit * 0.09);
    ctx.fillStyle = palette.shadow;
    ctx.fill(tape);
    ctx.restore();

    // 主体：略透的和纸，上亮下暗（受光方向与纸面一致）；
    // 强调色的胶带略偏朱红，普通胶带是暖金的半透明和纸。
    const tapeTone = role === "accent" ? palette.highlightLine : palette.highlight;
    const tapeFill = ctx.createLinearGradient(0, -tapeHeight / 2, 0, tapeHeight / 2);
    tapeFill.addColorStop(0, withAlpha(tapeTone, 0.95));
    tapeFill.addColorStop(0.55, withAlpha(tapeTone, 0.8));
    tapeFill.addColorStop(1, withAlpha(tapeTone, 0.68));
    ctx.globalAlpha = alpha * 0.82;
    ctx.fillStyle = tapeFill;
    ctx.fill(tape);

    // 和纸纹理：斜向细纹 + 一道纵向褶痕（亮/暗成对），让它有"纸"的厚度。
    ctx.save();
    ctx.clip(tape);
    ctx.strokeStyle = withAlpha(palette.paperLight, 0.75);
    ctx.lineWidth = Math.max(0.7, unit * 0.011);
    ctx.globalAlpha = alpha * 0.28;
    for (let index = -5; index <= 5; index += 1) {
      const offset = index * unit * 0.1;
      ctx.beginPath();
      ctx.moveTo(-tapeWidth * 0.6 + offset, -tapeHeight);
      ctx.lineTo(tapeWidth * 0.2 + offset, tapeHeight);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.3;
    ctx.strokeStyle = withAlpha(palette.paperLight, 0.85);
    ctx.lineWidth = Math.max(0.8, unit * 0.016);
    ctx.beginPath();
    ctx.moveTo(tapeWidth * 0.18, -tapeHeight * 0.55);
    ctx.lineTo(tapeWidth * 0.26, tapeHeight * 0.55);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.2;
    ctx.strokeStyle = palette.shadow;
    ctx.lineWidth = Math.max(0.6, unit * 0.012);
    ctx.beginPath();
    ctx.moveTo(tapeWidth * 0.28, -tapeHeight * 0.55);
    ctx.lineTo(tapeWidth * 0.36, tapeHeight * 0.55);
    ctx.stroke();
    ctx.restore();

    // 边缘：外圈压暗 + 内侧受光亮边，贴纸感。
    ctx.globalAlpha = alpha * 0.42;
    ctx.strokeStyle = withAlpha(palette.paperDeep, 0.55);
    ctx.lineWidth = Math.max(0.8, unit * 0.012);
    ctx.stroke(tape);
    ctx.globalAlpha = alpha * 0.2;
    ctx.strokeStyle = withAlpha(palette.paperLight, 0.6);
    ctx.lineWidth = Math.max(0.5, unit * 0.008);
    ctx.save();
    ctx.translate(-unit * 0.012, -unit * 0.012);
    ctx.stroke(tape);
    ctx.restore();
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
    for (let index = 0; index < 7; index += 1) {
      const t = -half + ((index + 0.5) * size) / 7;
      for (const [holeX, holeY] of [
        [t, -half],
        [t, half],
        [-half, t],
        [half, t],
      ] as const) {
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

  const isLargeIllustration = specScale >= 1.2;
  const desiredWidth = Math.max(2.4, unit * (isLargeIllustration ? 0.056 : 0.042));
  const lineWidth = desiredWidth / specScale;
  // 手抖幅度在「单位形状空间」里（形状半径约 1），与画面尺寸/缩放无关，
  // 否则大插画的抖动会被 unit*scale 放大成乱线。
  const roughness =
    spec.kind === "window"
      ? 0.009 + stableRandom(spec.kind, "roughness") * 0.006
      : spec.kind === "wheat" || spec.kind === "ripple"
        ? 0.012 + stableRandom(spec.kind, "roughness") * 0.009
        : 0.026 + stableRandom(spec.kind, "roughness") * 0.018;
  // 大幅插画优先使用独立维护的几何（handwrittenIllustration），其余仍走涂鸦几何。
  const rawStrokes =
    (isLargeIllustration ? getLargeIllustrationStrokes(spec.kind) : null) ??
    doodleStrokes(spec.kind);
  if (rawStrokes.length === 0) {
    ctx.restore();
    return;
  }

  // 几何器物类：点数少（≤8）的骨架线按"直尺画的折线"处理，保留角点；
  // 点多的有机形状（叶片、云朵、山弧）仍平滑，避免被削成多边形。
  const sharpStrokes = SHARP_CORNER_KINDS.has(spec.kind)
    ? rawStrokes.map((points) => points.length <= 8)
    : undefined;
  const geometry = getGeometry(
    spec,
    rawStrokes,
    unit,
    `${spec.kind}:${spec.x.toFixed(3)}:${spec.y.toFixed(3)}`,
    roughness,
    lineWidth,
    sharpStrokes
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

  const wash = isLargeIllustration ? ILLUSTRATION_WASH[spec.kind] : undefined;
  if (wash) {
    drawIllustrationWash(ctx, palette, geometry, unit, spec, visible, wash, lineWidth);
    ctx.globalAlpha = 1;
  }

  // 铅笔排线：水彩之后、正式勾线之前铺背光侧暗部，让线稿有体积（弱机档跳过）。
  if (isLargeIllustration && quality < 2) {
    drawIllustrationHatching(ctx, palette, geometry, unit, spec, visible, lineWidth);
  }

  // 铅笔速写的"第二遍找形"：主轮廓下方偏移 1–2px 再画一遍，
  // 形成真实手绘的双线/重描感；低画质档跳过。
  // 只重描前 8 笔（主轮廓/窗框/山脊这类长线）——内部碎笔远看本来只有一笔，
  // 全量重描只是白付一遍大面积 path 填充。
  if (isLargeIllustration && quality < 2 && visible > 0.3) {
    const underDx = (stableRandom(`${spec.kind}:under`, "dx") - 0.5) * 3.2;
    const underDy = (stableRandom(`${spec.kind}:under`, "dy") - 0.5) * 2.6;
    const underCount = Math.min(6, geometry.strokes.length);
    ctx.save();
    ctx.translate(underDx / specScale, underDy / specScale);
    ctx.globalAlpha = visible * 0.26;
    ctx.fillStyle = roleColor(palette, spec.color);
    for (let index = 0; index < underCount; index += 1) {
      const stroke = geometry.strokes[index];
      const path = stroke?.inkPath1 ?? stroke?.inkPath0;
      if (path) ctx.fill(path);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = 1;
  drawStrokeSet(
    ctx,
    geometry,
    visible,
    {
      color: roleColor(palette, spec.color),
      width: lineWidth,
      alpha: roleAlpha(spec.color) * 0.9,
      grain: isLargeIllustration,
      grainScale: specScale,
    },
    options,
    quality >= 2 ? 0 : boilVariant
  );

  // 笔刷质感：大幅插画补「干笔飞白」——纸色笔触打断墨色，形成断墨与毛边。
  // 飞白数量按笔画长度分配，长笔画（窗框 / 云轮廓 / 麦秆）才有连续干笔；
  // 短笔画不打断墨，避免雨滴、叶脉被切成两截；弱机档整段跳过。
  if (isLargeIllustration && quality < 2) {
    const strokeCount = geometry.strokes.length;
    ctx.save();
    ctx.fillStyle = palette.paperLight;
    for (let strokeIndex = 0; strokeIndex < strokeCount; strokeIndex += 1) {
      const stroke = geometry.strokes[strokeIndex];
      if (!stroke || stroke.variant0.length < 2 || stroke.length < 0.9) continue;
      const completion = clamp(visible * 1.45 - (strokeIndex / strokeCount) * 0.45, 0, 1);
      if (completion < 0.999) continue;
      // 飞白预算按笔画长度分配，单笔最多 12 个（旧版 18），保留断墨但不堆填充。
      const notchCount = Math.min(8, Math.max(2, Math.round(stroke.length * 1.7)));
      for (let slot = 0; slot < notchCount; slot += 1) {
        const salt = `${strokeIndex}:${slot}`;
        const pointIndex = Math.floor(
          stableRandom(`${spec.kind}:dry`, `p${salt}`) * (stroke.variant0.length - 1)
        );
        const from = stroke.variant0[pointIndex]!;
        const to = stroke.variant0[pointIndex + 1]!;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const along = stableRandom(`${spec.kind}:dry`, `t${salt}`);
        const x = (from.x + (to.x - from.x) * along) * unit;
        const y = (from.y + (to.y - from.y) * along) * unit;
        const normalX = -Math.sin(angle);
        const normalY = Math.cos(angle);
        const edge = stableRandom(`${spec.kind}:dry`, `e${salt}`) < 0.45;
        const sign = stableRandom(`${spec.kind}:dry`, `d${salt}`) < 0.5 ? -1 : 1;
        // 毛边落在笔道边缘外侧，断墨落在笔道中间。
        const across = edge
          ? sign * lineWidth * (0.45 + stableRandom(`${spec.kind}:dry`, `a${salt}`) * 0.35)
          : (stableRandom(`${spec.kind}:dry`, `a${salt}`) - 0.5) * lineWidth * 0.5;
        const length = lineWidth * (0.7 + stableRandom(`${spec.kind}:dry`, `l${salt}`) * 1.4);
        const thickness = lineWidth * (0.18 + stableRandom(`${spec.kind}:dry`, `w${salt}`) * 0.22);
        // 飞白是"笔毛在纸纹上断墨"，不是白色橡皮点：透明度压到 ~0.4，
        // 用纸底（paperBase）而不是受光纸色，远看只让笔道边缘发毛。
        ctx.fillStyle = edge ? palette.paperBase : palette.paperLight;
        ctx.globalAlpha = edge ? 0.42 : 0.34;
        ctx.save();
        ctx.translate(x + normalX * across, y + normalY * across);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, length, thickness, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    // 收笔干痕：在笔画的收笔处压一小段纸色细痕，像抬笔时笔毛蹭过。
    ctx.fillStyle = palette.paperBase;
    ctx.globalAlpha = 0.55;
    for (let strokeIndex = 0; strokeIndex < Math.min(4, strokeCount); strokeIndex += 1) {
      const stroke = geometry.strokes[strokeIndex];
      if (!stroke || stroke.variant0.length < 2 || stroke.length < 0.9) continue;
      const completion = clamp(visible * 1.45 - (strokeIndex / strokeCount) * 0.45, 0, 1);
      if (completion < 0.999) continue;
      const points = stroke.variant0;
      const last = points[points.length - 1]!;
      const prev = points[points.length - 2]!;
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      ctx.save();
      ctx.translate(last.x * unit, last.y * unit);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(
        -lineWidth * 0.7,
        0,
        lineWidth * (1.2 + stableRandom(`${spec.kind}:dry`, `tl${strokeIndex}`) * 1.1),
        lineWidth * 0.28,
        0,
        0,
        TAU
      );
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
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
  const strokes: Array<{ y: number; width: number; alpha: number; color: string }> = [
    { y: bandY - unit * 0.12, width: unit * 0.36, alpha: 0.15, color: palette.highlight },
    { y: bandY + unit * 0.1, width: unit * 0.3, alpha: 0.12, color: palette.highlight },
    { y: bandY - unit * 0.01, width: unit * 0.2, alpha: 0.07, color: palette.highlightLine },
  ];
  for (const stroke of strokes) {
    ctx.globalAlpha = stroke.alpha * visible;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(-halfWidth, stroke.y + unit * 0.02);
    ctx.quadraticCurveTo(
      -halfWidth * 0.3,
      stroke.y - unit * 0.035,
      halfWidth * 0.88,
      stroke.y + unit * 0.015
    );
    ctx.quadraticCurveTo(
      halfWidth + unit * 0.03,
      stroke.y + unit * 0.02,
      halfWidth,
      stroke.y - unit * 0.015
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
