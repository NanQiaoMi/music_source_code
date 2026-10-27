/**
 * 「温光浮字」手书 MV 的纸面与光：一张摊在暗色桌面上的暖色信纸，
 * 有纸纤维、陈放晕染、折痕、撕纸毛边和投影；阳光从一角斜照进来，
 * 空气里有浮尘，最后叠上胶片颗粒与暗角。
 *
 * 性能约束（动画精修阶段的重点）：
 * - 纸面纹理只按「调色板 + 视口」生成一次并缓存；
 * - 暗角 / 桌面四边压暗是静态的，烘焙成一张屏幕覆盖层，每帧只贴一次；
 * - 阳光 / 背光 / 窗光是慢变量，画到半分辨率离屏画布，按 10–15fps 更新，
 *   每帧只做两次贴图（screen + multiply），不再每帧创建全屏渐变；
 * - 颗粒按 12fps 换帧，弱机档位直接关闭。
 */

import type { HandwrittenPalette } from "./handwrittenPalette";
import { withAlpha } from "./handwrittenPalette";
import type { HandwrittenCameraFrame, HandwrittenSceneConfig } from "./handwrittenScene";
import { hashHandwrittenSeed, stableRandom } from "./handwrittenScene";

interface PaperTextureEntry {
  canvas: HTMLCanvasElement;
  /** 纹理在 CSS 像素下的覆盖尺寸（drawImage 的目标尺寸） */
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  pixelCount: number;
}

const paperTextureCache = new Map<string, PaperTextureEntry>();
const MAX_PAPER_CACHE_ENTRIES = 2;
let paperTextureCachePixels = 0;

interface ScreenOverlayEntry {
  canvas: HTMLCanvasElement;
  key: string;
  pixelCount: number;
}

const screenOverlayCache = new Map<string, ScreenOverlayEntry>();
const MAX_OVERLAY_CACHE_ENTRIES = 3;
let screenOverlayCachePixels = 0;

interface LightLayerState {
  light: HTMLCanvasElement;
  shade: HTMLCanvasElement;
  key: string;
  lastTick: number;
  lastGlow: number;
  lastLightX: number;
  lastLightY: number;
}

let lightLayer: LightLayerState | null = null;

/** 纹理比视口大一圈，留给镜头推近和轻微旋转，不会露出空白边。 */
const PAPER_OVERSCAN = 1.12;
const MAX_PAPER_TEXTURE_PIXELS = 24_000_000;
const MAX_OVERLAY_PIXELS = 16_000_000;
/** 光层分辨率比例：半分辨率足够软，填充面积降到 1/4。 */
const LIGHT_LAYER_SCALE = 0.5;
const LIGHT_UPDATE_INTERVAL_MS = 90;

const GRAIN_TILE_SIZE = 192;
const GRAIN_TILE_FRAMES = 6;
const GRAIN_INTERVAL_MS = 84;
let grainTiles: HTMLCanvasElement[] | null = null;
const grainPatternCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern[]>();

const bokehSpriteCache = new Map<string, { warm: HTMLCanvasElement; dark: HTMLCanvasElement }>();
const MAX_BOKEH_SPRITE_PALETTES = 5;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteClamp(value: number, minimum: number, maximum: number, fallback: number): number {
  return Number.isFinite(value) ? clamp(value, minimum, maximum) : fallback;
}

function pixelRatioForBudget(
  width: number,
  height: number,
  requestedRatio: number,
  maxPixels: number
): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  let ratio = Math.min(requestedRatio, Math.sqrt(maxPixels / (width * height)));
  const pixelArea = (value: number) =>
    Math.max(2, Math.ceil(width * value)) * Math.max(2, Math.ceil(height * value));
  while (pixelArea(ratio) > maxPixels) ratio *= 0.99;
  return ratio;
}

/** mulberry32：纹理生成需要可复现的随机数，不用 Math.random。 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

interface Point {
  x: number;
  y: number;
}

/** 不规则纸边：沿矩形四边采样并法向抖动，得到撕纸/毛边的外轮廓。 */
function buildTornRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  random: () => number,
  jitter: number
): void {
  const step = 34;
  const points: Point[] = [];
  const pushEdge = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    normalX: number,
    normalY: number
  ) => {
    const length = Math.hypot(toX - fromX, toY - fromY);
    const count = Math.max(2, Math.round(length / step));
    for (let index = 0; index < count; index += 1) {
      const t = index / count;
      const offset = (random() - 0.5) * jitter * 2;
      points.push({
        x: fromX + (toX - fromX) * t + normalX * offset,
        y: fromY + (toY - fromY) * t + normalY * offset,
      });
    }
  };

  pushEdge(x, y, x + width, y, 0, 1);
  pushEdge(x + width, y, x + width, y + height, -1, 0);
  pushEdge(x + width, y + height, x, y + height, 0, -1);
  pushEdge(x, y + height, x, y, 1, 0);

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

function buildPaperTexture(
  palette: HandwrittenPalette,
  width: number,
  height: number,
  paletteIndex: number,
  dpr: number
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > 4096 ||
    height > 4096
  ) {
    return null;
  }

  const cssWidth = width * PAPER_OVERSCAN;
  const cssHeight = height * PAPER_OVERSCAN;
  const requestedPixelRatio = finiteClamp(dpr, Number.EPSILON, 3, 1);
  const pixelRatio = pixelRatioForBudget(
    cssWidth,
    cssHeight,
    requestedPixelRatio,
    MAX_PAPER_TEXTURE_PIXELS
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil(cssWidth * pixelRatio));
  canvas.height = Math.max(2, Math.ceil(cssHeight * pixelRatio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(pixelRatio, pixelRatio);

  const w = cssWidth;
  const h = cssHeight;
  const maxDim = Math.max(w, h);
  const random = createRandom(hashHandwrittenSeed(`${palette.name}:${paletteIndex}:paper:3`));

  // 1. 桌面：暗色木面/布面，让纸张有处可放，也给暗角提供底色。
  const desk = ctx.createLinearGradient(0, 0, w, h);
  desk.addColorStop(0, withAlpha(palette.desk, 1));
  desk.addColorStop(0.55, palette.desk);
  desk.addColorStop(1, withAlpha(palette.desk, 0.82));
  ctx.fillStyle = desk;
  ctx.fillRect(0, 0, w, h);
  for (let index = 0; index < 64; index += 1) {
    ctx.fillStyle = withAlpha(palette.shadow, 0.018 + random() * 0.025);
    ctx.beginPath();
    ctx.arc(random() * w, random() * h, 0.4 + random() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. 纸张范围与撕边轮廓。
  const marginX = Math.max(14, Math.round(w * 0.03));
  const marginY = Math.max(14, Math.round(h * 0.038));
  const pageX = marginX;
  const pageY = marginY;
  const pageWidth = w - marginX * 2;
  const pageHeight = h - marginY * 2;

  // 3. 纸页投影：先在纸路径外描几圈宽暗线，再把纸盖上去。
  ctx.save();
  ctx.translate(0, Math.max(7, pageHeight * 0.007));
  buildTornRectPath(
    ctx,
    pageX,
    pageY,
    pageWidth,
    pageHeight,
    createRandom(hashHandwrittenSeed("paper-shadow")),
    7
  );
  ctx.strokeStyle = withAlpha(palette.desk, 1);
  for (const [lineWidth, alpha] of [
    [Math.max(12, pageWidth * 0.012), 0.18],
    [Math.max(5, pageWidth * 0.005), 0.11],
    [Math.max(2, pageWidth * 0.002), 0.07],
  ] as const) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 4. 纸面底色：左上受光、右下背光。
  ctx.save();
  buildTornRectPath(ctx, pageX, pageY, pageWidth, pageHeight, random, 7);
  ctx.clip();
  const base = ctx.createLinearGradient(pageX, pageY, pageX + pageWidth, pageY + pageHeight);
  base.addColorStop(0, palette.paperLight);
  base.addColorStop(0.42, palette.paperBase);
  base.addColorStop(1, palette.paperDeep);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // 5. 大块晕染：纸张吸水不均、陈放泛黄（幅度压得很低，只做纸的"呼吸"）。
  for (let index = 0; index < 8; index += 1) {
    const cx = pageX + random() * pageWidth;
    const cy = pageY + random() * pageHeight;
    const radius = (0.1 + random() * 0.36) * maxDim;
    const tone = index % 3 === 0 ? palette.paperLight : palette.paperDeep;
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    bloom.addColorStop(0, withAlpha(tone, 0.012 + random() * 0.022));
    bloom.addColorStop(1, withAlpha(tone, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  // 5b. 水彩斑：真实手账的彩色来自"贴上去的水彩/荧光笔"，纸张本身要保持中性。
  //     只用 2 处极淡的强调色晕开，面积 <5% 画面，避免重新变成"满纸黄"。
  for (let index = 0; index < 2; index += 1) {
    const cx = pageX + pageWidth * (index === 0 ? 0.76 : 0.22) + (random() - 0.5) * pageWidth * 0.1;
    const cy =
      pageY + pageHeight * (index === 0 ? 0.28 : 0.68) + (random() - 0.5) * pageHeight * 0.1;
    const radius = maxDim * (0.05 + random() * 0.04);
    const wash = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
    wash.addColorStop(0, withAlpha(index === 0 ? palette.highlight : palette.accent, 0.03));
    wash.addColorStop(0.55, withAlpha(index === 0 ? palette.highlight : palette.accent, 0.012));
    wash.addColorStop(1, withAlpha(index === 0 ? palette.highlight : palette.accent, 0));
    ctx.fillStyle = wash;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((random() - 0.5) * 1.6);
    ctx.scale(1.35 + random() * 0.5, 0.72 + random() * 0.3);
    ctx.beginPath();
    const steps = 14;
    for (let step = 0; step <= steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const wobble = 0.82 + random() * 0.3;
      const px = Math.cos(angle) * radius * wobble;
      const py = Math.sin(angle) * radius * wobble;
      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 6. 纸纤维：短线段，方向偏水平，细而淡，远看是纸的质地而不是划痕。
  //    保留少量低对比细纤维，避免毛屑感抢过歌词。
  ctx.lineCap = "round";
  const fiberCount = Math.round(130 * (w / 1920));
  for (let index = 0; index < fiberCount; index += 1) {
    const x = pageX + random() * pageWidth;
    const y = pageY + random() * pageHeight;
    const length = 2 + random() * 8;
    const angle = (random() - 0.5) * 0.5 + (random() < 0.08 ? Math.PI / 2 : 0);
    ctx.strokeStyle = withAlpha(
      index % 5 === 0 ? palette.paperLight : palette.fiber,
      0.1 + random() * 0.18
    );
    ctx.globalAlpha = 0.38 + random() * 0.38;
    ctx.lineWidth = 0.32 + random() * 0.42;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 7. 细小杂点与纸屑。
  const speckCount = Math.round(300 * (w / 1920));
  for (let index = 0; index < speckCount; index += 1) {
    const x = pageX + random() * pageWidth;
    const y = pageY + random() * pageHeight;
    const radius = 0.24 + random() * 0.42;
    ctx.fillStyle = palette.fiber;
    ctx.globalAlpha = 0.15 + random() * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 8. 深色纸屑：少量暗点，避免整张纸过于均匀。
  for (let index = 0; index < 18; index += 1) {
    const x = pageX + random() * pageWidth;
    const y = pageY + random() * pageHeight;
    ctx.fillStyle = withAlpha(palette.shadow, 0.018 + random() * 0.025);
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      0.45 + random() * 0.9,
      0.35 + random() * 0.7,
      random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // 9. 茶渍/水痕：两处淡淡的环形印，增加手账感。
  for (let index = 0; index < 2; index += 1) {
    const cx = pageX + pageWidth * (index === 0 ? 0.78 : 0.24);
    const cy = pageY + pageHeight * (index === 0 ? 0.7 : 0.26);
    const radius = maxDim * (0.05 + random() * 0.05);
    const stain = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius);
    stain.addColorStop(0, withAlpha(palette.paperDeep, 0));
    stain.addColorStop(0.72, withAlpha(palette.paperDeep, 0.04));
    stain.addColorStop(0.9, withAlpha(palette.paperDeep, 0.065));
    stain.addColorStop(1, withAlpha(palette.paperDeep, 0));
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 1.12, radius * 0.92, random() * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 10. 折痕：带一条亮边模拟纸面折起的受光。
  const drawCrease = (x1: number, y1: number, x2: number, y2: number) => {
    const crease = ctx.createLinearGradient(x1, y1, x2, y2);
    crease.addColorStop(0, withAlpha(palette.shadow, 0));
    crease.addColorStop(0.45, withAlpha(palette.shadow, 0.014));
    crease.addColorStop(0.5, withAlpha(palette.shadow, 0.022));
    crease.addColorStop(0.55, withAlpha(palette.shadow, 0.014));
    crease.addColorStop(1, withAlpha(palette.shadow, 0));
    ctx.strokeStyle = crease;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.strokeStyle = withAlpha(palette.paperLight, 0.08);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(x1 + 2.4, y1 + 2.4);
    ctx.lineTo(x2 + 2.4, y2 + 2.4);
    ctx.stroke();
  };
  drawCrease(pageX + pageWidth * 0.64, pageY, pageX + pageWidth * 0.6, pageY + pageHeight);
  if (random() > 0.35) {
    drawCrease(pageX, pageY + pageHeight * 0.43, pageX + pageWidth, pageY + pageHeight * 0.465);
  }

  // 11. 纸边内侧压暗 + 毛边纤维。
  const innerShade = ctx.createRadialGradient(
    pageX + pageWidth * 0.5,
    pageY + pageHeight * 0.48,
    maxDim * 0.22,
    pageX + pageWidth * 0.5,
    pageY + pageHeight * 0.48,
    maxDim * 0.8
  );
  innerShade.addColorStop(0, withAlpha(palette.shadow, 0));
  innerShade.addColorStop(1, withAlpha(palette.shadow, palette.dark ? 0.08 : 0.045));
  ctx.fillStyle = innerShade;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 12. 纸页轮廓：外侧一条细暗边 + 内侧一条受光亮边 + 边缘纤维。
  ctx.save();
  buildTornRectPath(
    ctx,
    pageX,
    pageY,
    pageWidth,
    pageHeight,
    createRandom(hashHandwrittenSeed("paper-edge")),
    7
  );
  ctx.strokeStyle = withAlpha(palette.desk, 0.72);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = withAlpha(palette.paperLight, 0.3);
  ctx.lineWidth = 0.65;
  ctx.translate(-0.8, -0.6);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = withAlpha(palette.paperLight, 0.28);
  ctx.lineWidth = 0.55;
  for (let index = 0; index < 48; index += 1) {
    const fromTop = random() > 0.5;
    const x = pageX + random() * pageWidth;
    const y = fromTop ? pageY + random() * 6 : pageY + pageHeight - random() * 6;
    const length = 3 + random() * 9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 6, y + (fromTop ? length : -length));
    ctx.stroke();
  }

  return canvas;
}

function getPaperTexture(
  palette: HandwrittenPalette,
  paletteIndex: number,
  width: number,
  height: number,
  dpr: number
): PaperTextureEntry | null {
  const requestedPixelRatio = Math.round(finiteClamp(dpr, 1, 3, 1) * 10) / 10;
  const pixelRatio = pixelRatioForBudget(
    width * PAPER_OVERSCAN,
    height * PAPER_OVERSCAN,
    requestedPixelRatio,
    MAX_PAPER_TEXTURE_PIXELS
  );
  const key = `${paletteIndex}:${width}x${height}:${pixelRatio}`;
  const cached = paperTextureCache.get(key);
  if (cached) return cached;

  const canvas = buildPaperTexture(palette, width, height, paletteIndex, pixelRatio);
  if (!canvas) return null;

  const entry: PaperTextureEntry = {
    canvas,
    cssWidth: width * PAPER_OVERSCAN,
    cssHeight: height * PAPER_OVERSCAN,
    dpr: pixelRatio,
    pixelCount: canvas.width * canvas.height,
  };
  while (
    paperTextureCache.size > 0 &&
    (paperTextureCache.size >= MAX_PAPER_CACHE_ENTRIES ||
      paperTextureCachePixels + entry.pixelCount > MAX_PAPER_TEXTURE_PIXELS)
  ) {
    const oldestKey = paperTextureCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = paperTextureCache.get(oldestKey);
    if (oldest) paperTextureCachePixels -= oldest.pixelCount;
    paperTextureCache.delete(oldestKey);
  }
  paperTextureCache.set(key, entry);
  paperTextureCachePixels += entry.pixelCount;
  return entry;
}

/**
 * 静态屏幕覆盖层：纸边 + 四边线性压暗。这些每帧都一样，烘焙成一张画布，
 * 每帧只贴一次。真实手账的暗角来自纸边投影，而不是棕色径向渐变，
 * 所以这里去掉径向暗角，改用 ≥40px 的线性过渡，总强度 ≤0.18。
 */
function getScreenOverlay(
  palette: HandwrittenPalette,
  paletteIndex: number,
  width: number,
  height: number,
  vignette: number,
  quality: number,
  dpr: number
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
  const requestedPixelRatio = Math.round(finiteClamp(dpr, 1, 3, 1) * 10) / 10;
  const pixelRatio = pixelRatioForBudget(width, height, requestedPixelRatio, MAX_OVERLAY_PIXELS);
  const vignetteBucket = Math.round(finiteClamp(vignette, 0, 1, 0) * 20);
  const key = `${paletteIndex}:${width}x${height}:${vignetteBucket}:${quality}:${pixelRatio}`;
  const cached = screenOverlayCache.get(key);
  if (cached) return cached.canvas;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil(width * pixelRatio));
  canvas.height = Math.max(2, Math.ceil(height * pixelRatio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(pixelRatio, pixelRatio);

  // 轻微压暗只帮助收边，不让整张纸被棕色暗角染色。
  const strength = (vignetteBucket / 20) * 0.075;
  if (strength > 0.005) {
    const edgeX = Math.max(40, width * 0.052);
    const edgeY = Math.max(40, height * 0.056);
    const edgeAlpha = palette.dark ? strength * 1.25 : strength;

    const top = ctx.createLinearGradient(0, 0, 0, edgeY);
    top.addColorStop(0, withAlpha(palette.desk, edgeAlpha));
    top.addColorStop(1, withAlpha(palette.desk, 0));
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, edgeY);

    const bottom = ctx.createLinearGradient(0, height, 0, height - edgeY);
    bottom.addColorStop(0, withAlpha(palette.desk, edgeAlpha));
    bottom.addColorStop(1, withAlpha(palette.desk, 0));
    ctx.fillStyle = bottom;
    ctx.fillRect(0, height - edgeY, width, edgeY);

    const left = ctx.createLinearGradient(0, 0, edgeX, 0);
    left.addColorStop(0, withAlpha(palette.desk, edgeAlpha * 0.92));
    left.addColorStop(1, withAlpha(palette.desk, 0));
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, edgeX, height);

    const right = ctx.createLinearGradient(width, 0, width - edgeX, 0);
    right.addColorStop(0, withAlpha(palette.desk, edgeAlpha * 0.92));
    right.addColorStop(1, withAlpha(palette.desk, 0));
    ctx.fillStyle = right;
    ctx.fillRect(width - edgeX, 0, edgeX, height);
  }

  const entry: ScreenOverlayEntry = {
    canvas,
    key,
    pixelCount: canvas.width * canvas.height,
  };
  while (
    screenOverlayCache.size > 0 &&
    (screenOverlayCache.size >= MAX_OVERLAY_CACHE_ENTRIES ||
      screenOverlayCachePixels + entry.pixelCount > MAX_OVERLAY_PIXELS)
  ) {
    const oldestKey = screenOverlayCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = screenOverlayCache.get(oldestKey);
    if (oldest) screenOverlayCachePixels -= oldest.pixelCount;
    screenOverlayCache.delete(oldestKey);
  }
  screenOverlayCache.set(key, entry);
  screenOverlayCachePixels += entry.pixelCount;
  return canvas;
}

/**
 * 纸面与内容必须共用同一套镜头变换，否则文字会从纸上「滑出去」。
 * 表示画面固定在屏幕空间，只让纸与字一起被轻轻推近、微抖。
 */
export function applyHandwrittenCamera(
  ctx: CanvasRenderingContext2D,
  camera: HandwrittenCameraFrame,
  paperRotation: number,
  width: number,
  height: number
): void {
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(camera.rotation + paperRotation);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-width * 0.5 + camera.x, -height * 0.5 + camera.y);
}

export interface HandwrittenPaperOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  palette: HandwrittenPalette;
  paletteIndex: number;
  camera: HandwrittenCameraFrame;
  scene: HandwrittenSceneConfig;
  musicTime: number;
  shotStartTime: number;
  glowIntensity: number;
  grain: number;
  vignette: number;
  reducedMotion: boolean;
  motionSpeed: number;
  paused: boolean;
  /** 0 最高画质，1 弱机档，2 极弱档 */
  quality?: number;
}

/** 绘制纸面 + 光场。纸面跟随镜头；光与暗角在屏幕空间合成。 */
export function drawHandwrittenPaperSurface(options: HandwrittenPaperOptions): void {
  const safeWidth = finiteClamp(options.width, 1, 4096, 1);
  const safeHeight = finiteClamp(options.height, 1, 4096, 1);
  const safeOptions = {
    ...options,
    width: safeWidth,
    height: safeHeight,
    glowIntensity: finiteClamp(options.glowIntensity, 0, 1.6, 0),
    grain: finiteClamp(options.grain, 0, 1, 0),
    vignette: finiteClamp(options.vignette, 0, 1, 0),
  };
  const { ctx, width, height, palette, camera, scene } = safeOptions;
  const quality = options.quality ?? 0;
  const dpr = finiteClamp(ctx.canvas.width / Math.max(1, width), 1, 3, 1);
  const texture = getPaperTexture(palette, safeOptions.paletteIndex, width, height, dpr);

  ctx.save();
  applyHandwrittenCamera(ctx, camera, scene.paperRotation, width, height);
  if (texture) {
    const offsetX = (width - texture.cssWidth) / 2;
    const offsetY = (height - texture.cssHeight) / 2;
    ctx.drawImage(texture.canvas, offsetX, offsetY, texture.cssWidth, texture.cssHeight);
  } else {
    ctx.fillStyle = palette.paperBase;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();

  drawLightLayers(safeOptions, quality);
  const overlay = getScreenOverlay(
    palette,
    safeOptions.paletteIndex,
    width,
    height,
    safeOptions.vignette,
    quality,
    dpr
  );
  if (overlay) ctx.drawImage(overlay, 0, 0, width, height);
  drawFilmGrain(
    ctx,
    width,
    height,
    Number.isFinite(options.musicTime) ? options.musicTime * 1000 : 0,
    safeOptions.grain,
    safeOptions.reducedMotion,
    quality
  );
}

/**
 * 光层：半分辨率离屏画布 + 节流更新。
 * 阳光/窗光用 screen 合成，背光压暗用 multiply 合成，各贴一次。
 */
function drawLightLayers(options: HandwrittenPaperOptions, quality: number): void {
  const { ctx, width, height, palette, scene, reducedMotion, musicTime } = options;
  if (typeof document === "undefined") return;

  const glow = finiteClamp(options.glowIntensity, 0, 1.6, 0);
  if (glow <= 0.02) return;
  const safeMusicTime = Number.isFinite(musicTime) ? musicTime : 0;
  const time = safeMusicTime * finiteClamp(options.motionSpeed, 0.15, 2.5, 1);
  const interval = quality >= 2 ? 260 : quality === 1 ? 150 : LIGHT_UPDATE_INTERVAL_MS;
  const tick = Math.floor((safeMusicTime * 1000) / interval);
  const key = `${options.paletteIndex}:${width}x${height}`;
  const layerScale = quality >= 2 ? 0.36 : quality === 1 ? 0.44 : LIGHT_LAYER_SCALE;
  const layerWidth = Math.max(64, Math.round(width * layerScale));
  const layerHeight = Math.max(64, Math.round(height * layerScale));

  const lightX =
    width * clamp(scene.lightX + (reducedMotion ? 0 : Math.sin(time * 0.11) * 0.018), 0, 1);
  const lightY =
    height * clamp(scene.lightY + (reducedMotion ? 0 : Math.cos(time * 0.09) * 0.018), 0, 1);

  const needsRebuild =
    !lightLayer ||
    lightLayer.key !== key ||
    lightLayer.lastTick !== tick ||
    Math.abs(lightLayer.lastGlow - glow) > 0.02 ||
    Math.abs(lightLayer.lastLightX - lightX) > width * 0.004 ||
    Math.abs(lightLayer.lastLightY - lightY) > height * 0.004;

  if (needsRebuild) {
    const sameSize = lightLayer?.key === key && lightLayer.light.width === layerWidth;
    const light = sameSize ? lightLayer!.light : document.createElement("canvas");
    const shade = sameSize ? lightLayer!.shade : document.createElement("canvas");
    light.width = layerWidth;
    light.height = layerHeight;
    shade.width = layerWidth;
    shade.height = layerHeight;
    const lightCtx = light.getContext("2d");
    const shadeCtx = shade.getContext("2d");

    if (lightCtx && shadeCtx) {
      lightCtx.globalCompositeOperation = "source-over";
      lightCtx.clearRect(0, 0, layerWidth, layerHeight);
      shadeCtx.globalCompositeOperation = "source-over";
      shadeCtx.clearRect(0, 0, layerWidth, layerHeight);

      const scaleX = layerWidth / width;
      const scaleY = layerHeight / height;
      const lx = lightX * scaleX;
      const ly = lightY * scaleY;
      const radius = Math.max(layerWidth, layerHeight) * 0.44;

      const sun = lightCtx.createRadialGradient(lx, ly, 0, lx, ly, radius * 0.92);
      sun.addColorStop(0, withAlpha(palette.lightWarm, clamp(0.075 * glow, 0, 0.14)));
      sun.addColorStop(0.26, withAlpha(palette.lightWarm, clamp(0.035 * glow, 0, 0.07)));
      sun.addColorStop(1, withAlpha(palette.lightWarm, 0));
      lightCtx.fillStyle = sun;
      lightCtx.fillRect(0, 0, layerWidth, layerHeight);

      // 第二块偏移光斑：打破"完美圆形太阳"，让受光边缘不规则。
      const drift = reducedMotion ? 0 : Math.sin(time * 0.06) * radius * 0.08;
      const sun2 = lightCtx.createRadialGradient(
        lx + radius * 0.22 + drift,
        ly - radius * 0.16,
        0,
        lx + radius * 0.22 + drift,
        ly - radius * 0.16,
        radius * 0.5
      );
      sun2.addColorStop(0, withAlpha(palette.lightWarm, clamp(0.03 * glow, 0, 0.07)));
      sun2.addColorStop(1, withAlpha(palette.lightWarm, 0));
      lightCtx.fillStyle = sun2;
      lightCtx.fillRect(0, 0, layerWidth, layerHeight);

      const core = lightCtx.createRadialGradient(lx, ly, 0, lx, ly, radius * 0.3);
      core.addColorStop(0, withAlpha(palette.lightWarm, clamp(0.05 * glow, 0, 0.1)));
      core.addColorStop(1, withAlpha(palette.lightWarm, 0));
      lightCtx.save();
      lightCtx.translate(lx, ly);
      lightCtx.rotate(0.28);
      lightCtx.scale(1.22, 0.82);
      lightCtx.translate(-lx, -ly);
      lightCtx.fillStyle = core;
      lightCtx.fillRect(lx - radius, ly - radius, radius * 2, radius * 2);
      lightCtx.restore();

      lightCtx.save();
      lightCtx.translate(lx, ly);
      lightCtx.rotate(-0.42);
      lightCtx.scale(3.2, 0.34);
      const streak = lightCtx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.72);
      streak.addColorStop(0, withAlpha(palette.lightWarm, clamp(0.025 * glow, 0, 0.05)));
      streak.addColorStop(0.55, withAlpha(palette.lightWarm, clamp(0.01 * glow, 0, 0.025)));
      streak.addColorStop(1, withAlpha(palette.lightWarm, 0));
      lightCtx.fillStyle = streak;
      lightCtx.fillRect(-radius, -radius, radius * 2, radius * 2);
      lightCtx.restore();

      if (quality < 1) {
        for (let index = 0; index < 2; index += 1) {
          const shift = reducedMotion ? 0 : Math.sin(time * 0.07 + index * 2.1) * width * 0.02;
          lightCtx.save();
          lightCtx.translate(
            width * (0.3 + index * 0.24) * scaleX + shift * scaleX,
            height * 0.4 * scaleY
          );
          lightCtx.rotate(-0.34);
          const band = lightCtx.createLinearGradient(
            0,
            -height * 0.5 * scaleY,
            0,
            height * 0.5 * scaleY
          );
          band.addColorStop(0, withAlpha(palette.lightWarm, 0));
          band.addColorStop(0.5, withAlpha(palette.lightWarm, clamp(0.018 * glow, 0, 0.04)));
          band.addColorStop(1, withAlpha(palette.lightWarm, 0));
          lightCtx.fillStyle = band;
          lightCtx.fillRect(
            -width * 0.08 * scaleX,
            -height * 0.5 * scaleY,
            width * 0.16 * scaleX,
            height * scaleY
          );
          lightCtx.restore();
        }
      }

      const shadeX = (width - clamp(scene.lightX, 0.1, 0.9) * width) * scaleX;
      const shadeY = (height - clamp(scene.lightY, 0.1, 0.9) * height) * scaleY;
      const shadeRadius = radius * 1.35;
      const shadeGradient = shadeCtx.createRadialGradient(
        shadeX,
        shadeY,
        radius * 0.1,
        shadeX,
        shadeY,
        shadeRadius
      );
      shadeGradient.addColorStop(0, withAlpha(palette.shadow, 0.045));
      shadeGradient.addColorStop(0.55, withAlpha(palette.shadow, 0.02));
      shadeGradient.addColorStop(1, withAlpha(palette.shadow, 0));
      shadeCtx.fillStyle = shadeGradient;
      shadeCtx.fillRect(0, 0, layerWidth, layerHeight);

      lightLayer = {
        light,
        shade,
        key,
        lastTick: tick,
        lastGlow: glow,
        lastLightX: lightX,
        lastLightY: lightY,
      };
    }
  }

  if (!lightLayer) return;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = quality >= 2 ? 0.85 : 1;
  ctx.drawImage(lightLayer.light, 0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(lightLayer.shade, 0, 0, width, height);
  ctx.restore();
}

/** 浮尘：远处小颗粒 + 近景虚焦光斑，随镜头缓慢漂移。 */
export function drawHandwrittenDust(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: HandwrittenPalette,
  musicTime: number,
  motionSpeed: number,
  intensity: number,
  reducedMotion: boolean,
  paused: boolean,
  quality = 0
): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return;
  const glow = finiteClamp(intensity, 0, 1.6, 0);
  if (glow <= 0.05) return;
  const sprites = getBokehSprites(palette);
  if (!sprites) return;
  const time =
    reducedMotion || paused
      ? 0
      : finiteClamp(musicTime, 0, 1e9, 0) * finiteClamp(motionSpeed, 0.15, 2.5, 1);
  const maxDim = Math.max(width, height);
  const moteCount = quality >= 2 ? 4 : quality === 1 ? 8 : 14;
  const bokehCount = quality >= 2 ? 0 : quality === 1 ? 1 : 2;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let index = 0; index < moteCount; index += 1) {
    const seed = `mote-${index}`;
    const depth = 0.35 + stableRandom(seed, "depth") * 0.9;
    const baseX = stableRandom(seed, "x") * width;
    const baseY = stableRandom(seed, "y") * height;
    const drift = reducedMotion ? 0 : time * (6 + depth * 10);
    const x = baseX + Math.sin(time * 0.23 + index) * (8 + depth * 16) + drift * 0.35;
    const y = baseY - ((drift * 0.5 + depth * 180) % (height + 160)) + 80;
    const size = (1.4 + depth * 3.4) * (0.7 + glow * 0.4);
    const alpha =
      (0.035 + depth * 0.06) * glow * (0.75 + Math.sin(time * 0.9 + index * 1.7) * 0.25);
    if (alpha <= 0.01) continue;
    ctx.globalAlpha = clamp(alpha, 0, 0.12);
    ctx.drawImage(sprites.warm, x - size * 2, y - size * 2, size * 4, size * 4);
  }

  if (!reducedMotion) {
    for (let index = 0; index < bokehCount; index += 1) {
      const seed = `bokeh-${index}`;
      const x = stableRandom(seed, "x") * width + Math.sin(time * 0.07 + index) * 40;
      const y = stableRandom(seed, "y") * height + Math.cos(time * 0.05 + index) * 26;
      const size = maxDim * (0.05 + stableRandom(seed, "size") * 0.09);
      ctx.globalAlpha = 0.012 * glow;
      ctx.drawImage(sprites.warm, x - size, y - size, size * 2, size * 2);
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 转场用的暖光扫过；`progress` 0→1 表示光带从一侧扫到另一侧。 */
export function drawHandwrittenLightLeak(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: HandwrittenPalette,
  progress: number,
  strength: number
): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return;
  const clamped = finiteClamp(progress, 0, 1, 0);
  if (clamped <= 0 || clamped >= 1) return;
  const coverage = Math.sin(Math.PI * clamped) * finiteClamp(strength, 0, 1, 0);
  if (coverage <= 0.01) return;
  const x = width * (-0.25 + clamped * 1.5);
  const radius = Math.max(width, height) * 0.72;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(x, height * 0.42);
  ctx.rotate(-0.32);
  ctx.scale(1.7, 0.85);
  const leak = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  leak.addColorStop(0, withAlpha(palette.lightWarm, 0.12 * coverage));
  leak.addColorStop(0.45, withAlpha(palette.lightWarm, 0.04 * coverage));
  leak.addColorStop(1, withAlpha(palette.lightWarm, 0));
  ctx.fillStyle = leak;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function buildGrainTile(frameIndex: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const random = createRandom(hashHandwrittenSeed(`paper-grain:v1:${frameIndex}`));
    for (let index = 0; index < image.data.length; index += 4) {
      const value = Math.floor(random() * 255);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = Math.floor(random() * 12);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

function getGrainPatterns(ctx: CanvasRenderingContext2D): CanvasPattern[] | null {
  const cached = grainPatternCache.get(ctx);
  if (cached) return cached;

  if (!grainTiles) {
    const built: HTMLCanvasElement[] = [];
    for (let index = 0; index < GRAIN_TILE_FRAMES; index += 1) {
      const tile = buildGrainTile(index);
      if (!tile) return null;
      built.push(tile);
    }
    grainTiles = built;
  }

  const patterns = grainTiles.map((tile) => ctx.createPattern(tile, "repeat"));
  const valid = patterns.filter((pattern): pattern is CanvasPattern => pattern !== null);
  if (valid.length === 0) return null;
  grainPatternCache.set(ctx, valid);
  return valid;
}

function drawFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeMs: number,
  intensity: number,
  reducedMotion: boolean,
  quality: number
): void {
  if (intensity <= 0.01 || quality >= 2) return;
  const patterns = getGrainPatterns(ctx);
  if (!patterns?.length) return;

  const tick = Number.isFinite(timeMs) ? Math.floor(timeMs / GRAIN_INTERVAL_MS) : 0;
  const frame = reducedMotion ? 0 : ((tick % patterns.length) + patterns.length) % patterns.length;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = clamp(intensity * (quality === 1 ? 0.24 : 0.32), 0, 0.12);
  ctx.fillStyle = patterns[frame]!;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function buildBokehSprite(color: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.4, withAlpha(color, 0.45));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

function getBokehSprites(
  palette: HandwrittenPalette
): { warm: HTMLCanvasElement; dark: HTMLCanvasElement } | null {
  const key = `${palette.lightWarm}|${palette.shadow}`;
  const cached = bokehSpriteCache.get(key);
  if (cached) {
    bokehSpriteCache.delete(key);
    bokehSpriteCache.set(key, cached);
    return cached;
  }

  const warm = buildBokehSprite(palette.lightWarm);
  const dark = buildBokehSprite(palette.shadow);
  if (warm && dark) {
    const sprites = { warm, dark };
    if (bokehSpriteCache.size >= MAX_BOKEH_SPRITE_PALETTES) {
      const oldestKey = bokehSpriteCache.keys().next().value;
      if (oldestKey !== undefined) bokehSpriteCache.delete(oldestKey);
    }
    bokehSpriteCache.set(key, sprites);
    return sprites;
  }

  if (!warm || !dark) {
    return null;
  }
  return { warm, dark };
}
