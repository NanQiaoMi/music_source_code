/**
 * 「温光浮字」手书 MV 的纸面与光：一张摊在暗色桌面上的暖色信纸，
 * 有纸牙 / 纤维 / 纸屑、多尺度吸水晕染、极淡压痕与橡皮痕、折痕、撕纸毛边和投影；
 * 阳光从一角斜照进来，空气里有浮尘，最后叠上胶片颗粒与暗角。
 *
 * 纸面材质分四步烘焙进同一张缓存画布：底色渐变 → 大 / 中 / 小三个尺度的吸水斑驳
 * → 纸牙 + 纤维 + 纸屑微颗粒 → 极淡压痕与橡皮痕；每帧仍然只有一次 drawImage。
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

/** 纸面纤维密度：每 1920 CSS 宽的根数（远看仍是干净暖纸，近看能看清纤维走向）。 */
const PAPER_FIBER_BASE_COUNT = 620;
/** 纸牙噪声贴图的基准边长（CSS px）；按 dpr 生成贴图，保证一颗噪声恰好 1 设备像素。 */
const PAPER_TOOTH_TILE_CSS = 256;
/** 纸牙/云状斑驳共用的小噪声贴图缓存，灰度贴图与调色板无关。 */
const paperNoiseTileCache = new Map<string, HTMLCanvasElement>();
const MAX_PAPER_NOISE_TILES = 10;

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

function smoothNoiseStep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * 纸牙噪声贴图：粗网格随机值做双线性平滑，再叠一层逐像素高频抖动，
 * 得到「纸浆团 + 砂粒」的有机颗粒。网格按模运算取样，四边可无缝平铺；
 * 同一 seed / 尺寸 / 颗粒度结果完全一致（只用 mulberry32，不用 Math.random）。
 */
function getPaperNoiseTile(
  pixelSize: number,
  cells: number,
  fineJitter: number,
  meanBias: number,
  warmth: number,
  seed: string
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const size = Math.max(16, Math.round(pixelSize));
  const cellCount = Math.max(2, Math.round(cells));
  const jitter = clamp(fineJitter, 0, 1);
  const bias = clamp(meanBias, -0.5, 0.5);
  // 暖色偏置：R 提、G 微提、B 压，让 soft-light 的明暗两端都往暖侧走，
  // 避免中性灰噪声把暖纸"洗"出冷灰绿斑块（三通道偏移和≈0，亮度基本不变）。
  const warmShift = clamp(warmth, 0, 1) * 7;
  const key = `${seed}:${size}:${cellCount}:${jitter.toFixed(2)}:${bias.toFixed(2)}:${warmShift.toFixed(1)}`;
  const cached = paperNoiseTileCache.get(key);
  if (cached) {
    // 命中后挪到队尾，保持最近使用优先。
    paperNoiseTileCache.delete(key);
    paperNoiseTileCache.set(key, cached);
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const random = createRandom(hashHandwrittenSeed(seed));
  const grid = new Float32Array(cellCount * cellCount);
  for (let index = 0; index < grid.length; index += 1) grid[index] = random();
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const step = cellCount / size;
  for (let y = 0; y < size; y += 1) {
    const gridY = y * step;
    const cellY = Math.floor(gridY);
    const rowTop = (cellY % cellCount) * cellCount;
    const rowBottom = ((cellY + 1) % cellCount) * cellCount;
    const blendY = smoothNoiseStep(gridY - cellY);
    for (let x = 0; x < size; x += 1) {
      const gridX = x * step;
      const cellX = Math.floor(gridX);
      const left = cellX % cellCount;
      const right = (cellX + 1) % cellCount;
      const blendX = smoothNoiseStep(gridX - cellX);
      const top = grid[rowTop + left]! * (1 - blendX) + grid[rowTop + right]! * blendX;
      const bottom = grid[rowBottom + left]! * (1 - blendX) + grid[rowBottom + right]! * blendX;
      const smooth = top * (1 - blendY) + bottom * blendY;
      const value = clamp(0.5 + bias + (smooth - 0.5) * 0.62 + (random() - 0.5) * jitter, 0, 1);
      const base = value * 255;
      const offset = (y * size + x) * 4;
      data[offset] = clamp(Math.round(base + warmShift), 0, 255);
      data[offset + 1] = clamp(Math.round(base + warmShift * 0.1), 0, 255);
      data[offset + 2] = clamp(Math.round(base - warmShift), 0, 255);
      data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  if (paperNoiseTileCache.size >= MAX_PAPER_NOISE_TILES) {
    const oldestKey = paperNoiseTileCache.keys().next().value;
    if (oldestKey !== undefined) paperNoiseTileCache.delete(oldestKey);
  }
  paperNoiseTileCache.set(key, canvas);
  return canvas;
}

/**
 * 把噪声贴图平铺到纸面范围：贴图按 dpr 生成，绘制尺寸取 tilePixels / pixelRatio，
 * 使一颗噪声恰好落在 1 设备像素上。起点对齐设备像素栅格，相邻贴图之间不会出现
 * 亚像素缝；两张不同 seed 的贴图按棋盘交替，避免 256px 平铺周期被看出来。
 */
function tileNoiseOverPage(
  ctx: CanvasRenderingContext2D,
  tiles: readonly [HTMLCanvasElement, HTMLCanvasElement],
  pixelRatio: number,
  pageX: number,
  pageY: number,
  pageWidth: number,
  pageHeight: number,
  alpha: number,
  composite: GlobalCompositeOperation
): void {
  if (typeof document === "undefined" || alpha <= 0) return;
  if (pageWidth <= 0 || pageHeight <= 0) return;
  const tilePixels = tiles[0].width;
  if (!Number.isFinite(tilePixels) || tilePixels <= 0) return;
  const tileCss = tilePixels / Math.max(Number.EPSILON, pixelRatio);
  if (!Number.isFinite(tileCss) || tileCss <= 0) return;

  const startX = Math.floor(pageX * pixelRatio) / pixelRatio;
  const startY = Math.floor(pageY * pixelRatio) / pixelRatio;
  const firstColumn = Math.floor((pageX - startX) / tileCss) - 1;
  const firstRow = Math.floor((pageY - startY) / tileCss) - 1;
  const columnCount = Math.ceil(pageWidth / tileCss) + 2;
  const rowCount = Math.ceil(pageHeight / tileCss) + 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = composite;
  for (let row = firstRow; row < firstRow + rowCount; row += 1) {
    const y = startY + row * tileCss;
    if (y > pageY + pageHeight) break;
    if (y + tileCss < pageY) continue;
    for (let column = firstColumn; column < firstColumn + columnCount; column += 1) {
      const x = startX + column * tileCss;
      if (x > pageX + pageWidth) break;
      if (x + tileCss < pageX) continue;
      ctx.drawImage((row + column) % 2 === 0 ? tiles[0] : tiles[1], x, y, tileCss, tileCss);
    }
  }
  ctx.restore();
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

  // 5c. 中尺度絮团：在大晕染（10–36% 画面）和纤维之间补一层 2–7% 的软斑，
  //     让"吸水不均"不是几个大圆斑 + 平滑底，而是多尺度叠出来的纸浆感。
  for (let index = 0; index < 24; index += 1) {
    const cx = pageX + random() * pageWidth;
    const cy = pageY + random() * pageHeight;
    const radius = maxDim * (0.018 + random() * 0.052);
    const light = index % 2 === 0;
    const tone = light ? palette.paperLight : palette.fiber;
    const blob = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    blob.addColorStop(0, withAlpha(tone, (light ? 0.0088 : 0.0064) + random() * 0.0072));
    blob.addColorStop(1, withAlpha(tone, 0));
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      radius * (1 + random() * 0.3),
      radius * (0.68 + random() * 0.32),
      random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // 5d. 云状斑驳：把平滑值噪声拉伸成两层不同尺度的"吸水云团"，用 soft-light 只改明度、
  //     不改色相（不会把中性纸重新染回米黄），叠在底色上像纸浆的厚薄。
  const cloudTile = getPaperNoiseTile(160, 9, 0.16, 0.03, 0.85, "paper-cloud");
  if (cloudTile) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    // 大尺度明暗最容易读成"脏斑"，强度比 pass4 收 25%，只保留纸浆厚薄的呼吸感。
    ctx.globalAlpha = 0.3;
    ctx.drawImage(cloudTile, pageX, pageY, pageWidth, pageHeight);
    ctx.globalAlpha = 0.2;
    ctx.drawImage(
      cloudTile,
      pageX - pageWidth * 0.07,
      pageY - pageHeight * 0.05,
      pageWidth * 0.62,
      pageHeight * 0.68
    );
    ctx.restore();
  }

  // 5e. 纸牙：1 设备像素级的极细颗粒（网格噪声 + 高频抖动），放大 2–3 倍才好看清；
  //     远看只是"这张纸有颗粒"，不会变成噪点。两张不同 seed 的贴图棋盘交替，避免平铺周期。
  const toothPixels = Math.max(64, Math.round(PAPER_TOOTH_TILE_CSS * pixelRatio));
  const toothTileA = getPaperNoiseTile(toothPixels, 96, 0.36, 0.045, 0.9, "paper-tooth-a");
  const toothTileB = getPaperNoiseTile(toothPixels, 96, 0.36, 0.045, 0.9, "paper-tooth-b");
  if (toothTileA && toothTileB) {
    tileNoiseOverPage(
      ctx,
      [toothTileA, toothTileB],
      pixelRatio,
      pageX,
      pageY,
      pageWidth,
      pageHeight,
      0.44,
      "soft-light"
    );
  }

  // 6. 纸纤维：短线段，方向偏水平，细而淡，远看是纸的质地而不是划痕。
  //    密度拉到 R8 要求的 ≥600 根/1920，但单根对比度压得很低；长纤维只占约 9%。
  ctx.lineCap = "round";
  const fiberCount = Math.round(PAPER_FIBER_BASE_COUNT * (w / 1920));
  for (let index = 0; index < fiberCount; index += 1) {
    const x = pageX + random() * pageWidth;
    const y = pageY + random() * pageHeight;
    const longFiber = index % 11 === 0;
    const length = longFiber ? 9 + random() * 15 : 2 + random() * 7.5;
    const angle = (random() - 0.5) * 0.46 + (index % 17 === 0 ? Math.PI / 2 : 0);
    const light = index % 5 === 0;
    const alpha = 0.1 + random() * 0.2;
    ctx.strokeStyle = withAlpha(light ? palette.paperLight : palette.fiber, alpha);
    ctx.globalAlpha = 0.48 + random() * 0.38;
    ctx.lineWidth = longFiber ? 0.5 + random() * 0.36 : 0.3 + random() * 0.34;
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (index % 7 === 0) {
      // 少数纤维带一点自然弯曲，避免整面纸都是直短线像划痕。
      const bend = (random() - 0.5) * length * 0.55;
      ctx.quadraticCurveTo(
        x + Math.cos(angle) * length * 0.5 - Math.sin(angle) * bend,
        y + Math.sin(angle) * length * 0.5 + Math.cos(angle) * bend,
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length
      );
    } else {
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 7. 微颗粒：纸面本身的细砂（暗点为主、少量亮点），密度提高但单点 alpha 仍然很低。
  const speckCount = Math.round(520 * (w / 1920));
  for (let index = 0; index < speckCount; index += 1) {
    const x = pageX + random() * pageWidth;
    const y = pageY + random() * pageHeight;
    const radius = 0.16 + random() * 0.5;
    const light = index % 4 === 0;
    ctx.fillStyle = withAlpha(light ? palette.paperLight : palette.fiber, 0.1 + random() * 0.24);
    ctx.globalAlpha = 0.5 + random() * 0.42;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 7b. 纸屑：几十片 1–2px 的不规则小碎片，只有放大看才知道是"纸有毛边"。
  const flakeCount = Math.round(30 * (w / 1920));
  for (let index = 0; index < flakeCount; index += 1) {
    const x = pageX + random() * pageWidth;
    const y = pageY + random() * pageHeight;
    const radius = 0.7 + random() * 1.5;
    const vertices = 3 + Math.floor(random() * 3);
    ctx.fillStyle = withAlpha(
      index % 3 === 0 ? palette.paperLight : palette.fiber,
      0.05 + random() * 0.1
    );
    ctx.beginPath();
    for (let vertex = 0; vertex < vertices; vertex += 1) {
      const angle = (vertex / vertices) * Math.PI * 2 + random() * 0.6;
      const reach = radius * (0.55 + random() * 0.7);
      const px = x + Math.cos(angle) * reach;
      const py = y + Math.sin(angle) * reach;
      if (vertex === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 8. 深色纸屑：少量暗点，避免整张纸过于均匀。
  for (let index = 0; index < 30; index += 1) {
    const x = pageX + random() * pageWidth;
    const y = pageY + random() * pageHeight;
    ctx.fillStyle = withAlpha(palette.shadow, 0.018 + random() * 0.03);
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      0.45 + random() * 1.05,
      0.35 + random() * 0.8,
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

  // 10b. 压痕：像回形针/指甲从纸背压出来的极淡凹线，中段最深、两端淡出；
  //      暗线下方错开 1px 补一条更淡的亮边，模拟纸面被压凹后的受光。
  const dentStartX = pageX + pageWidth * 0.11;
  const dentStartY = pageY + pageHeight * 0.79;
  const dentEndX = pageX + pageWidth * 0.26;
  const dentEndY = pageY + pageHeight * 0.775;
  const dentControlX = (dentStartX + dentEndX) / 2;
  const dentControlY = (dentStartY + dentEndY) / 2 - pageHeight * 0.013;
  const dentShade = ctx.createLinearGradient(dentStartX, dentStartY, dentEndX, dentEndY);
  dentShade.addColorStop(0, withAlpha(palette.shadow, 0));
  dentShade.addColorStop(0.28, withAlpha(palette.shadow, 0.016));
  dentShade.addColorStop(0.62, withAlpha(palette.shadow, 0.024));
  dentShade.addColorStop(1, withAlpha(palette.shadow, 0));
  const dentLight = ctx.createLinearGradient(dentStartX, dentStartY, dentEndX, dentEndY);
  dentLight.addColorStop(0, withAlpha(palette.paperLight, 0));
  dentLight.addColorStop(0.3, withAlpha(palette.paperLight, 0.06));
  dentLight.addColorStop(0.68, withAlpha(palette.paperLight, 0.045));
  dentLight.addColorStop(1, withAlpha(palette.paperLight, 0));
  ctx.lineCap = "round";
  ctx.strokeStyle = dentShade;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dentStartX, dentStartY);
  ctx.quadraticCurveTo(dentControlX, dentControlY, dentEndX, dentEndY);
  ctx.stroke();
  ctx.strokeStyle = dentLight;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(dentStartX + 0.6, dentStartY + 1.1);
  ctx.quadraticCurveTo(dentControlX + 0.6, dentControlY + 1.1, dentEndX + 0.6, dentEndY + 1.1);
  ctx.stroke();

  // 10c. 橡皮浅痕：擦过又没擦干净的一块极淡亮斑，边缘带一点点蹭脏；
  //      右下角的留白里放一处，近看有"被人用铅笔写过又擦掉"的痕迹。
  const eraserX = pageX + pageWidth * 0.845;
  const eraserY = pageY + pageHeight * 0.86;
  const eraserRadius = maxDim * (0.04 + random() * 0.014);
  ctx.save();
  ctx.translate(eraserX, eraserY);
  ctx.rotate(-0.42 + random() * 0.5);
  ctx.scale(1.36, 0.8);
  const eraserSmudge = ctx.createRadialGradient(0, 0, 0, 0, 0, eraserRadius);
  eraserSmudge.addColorStop(0, withAlpha(palette.paperLight, 0.05));
  eraserSmudge.addColorStop(0.62, withAlpha(palette.paperLight, 0.024));
  eraserSmudge.addColorStop(0.9, withAlpha(palette.shadow, 0.012));
  eraserSmudge.addColorStop(1, withAlpha(palette.shadow, 0));
  ctx.fillStyle = eraserSmudge;
  ctx.beginPath();
  const eraserSteps = 16;
  for (let step = 0; step <= eraserSteps; step += 1) {
    const angle = (step / eraserSteps) * Math.PI * 2;
    const wobble = 0.78 + random() * 0.34;
    const px = Math.cos(angle) * eraserRadius * wobble;
    const py = Math.sin(angle) * eraserRadius * (0.8 + random() * 0.3);
    if (step === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // 橡皮蹭出来的几道平行浅痕，方向与亮斑长轴一致。
  ctx.strokeStyle = withAlpha(palette.paperLight, 0.045);
  ctx.lineWidth = 1.4;
  for (let index = 0; index < 3; index += 1) {
    const offsetY = (index - 1) * eraserRadius * 0.34;
    const reach = eraserRadius * (0.62 + random() * 0.24);
    ctx.beginPath();
    ctx.moveTo(-reach, offsetY);
    ctx.quadraticCurveTo(0, offsetY + eraserRadius * 0.06, reach, offsetY);
    ctx.stroke();
  }
  ctx.restore();

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

/**
 * 纸牙覆盖层参数：在屏幕空间把极淡的静态纸纹叠到已经画好的纸面 + 文字 + 插画上，
 * 让矢量字与铅笔线也带上同一张纸的颗粒（墨被纸吃进去的感觉）。
 */
export interface PaperToothOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  palette: HandwrittenPalette;
  paletteIndex: number;
  /** 0–1 叠加强度；0 关闭，建议 0.6（内部映射到 overlay alpha≈0.072）。 */
  strength: number;
  /** 0 最高画质，1 弱机档（强度减半），2 极弱档（跳过） */
  quality?: number;
  /** 默认 "baked"（预烘覆盖层 + 每帧 1 次 drawImage）；"pattern" 为每帧 1 次 pattern fillRect 的旧方案。 */
  mode?: PaperToothMode;
  /**
   * baked 模式的烘焙分辨率比例（相对 CSS 像素），默认 0.5。烘焙画布按
   * ceil(width*scale) × ceil(height*scale) 生成，每帧 drawImage 拉伸到全屏；
   * 比例越低每帧贴图越便宜（0.5 约为全分辨率的 1/4），颗粒也会略微变软。
   */
  resolutionScale?: number;
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

/** 纸牙覆盖层方案：baked = 预烘整屏覆盖层每帧 1 次 drawImage；pattern = 每帧 1 次 pattern fillRect。 */
export type PaperToothMode = "baked" | "pattern";

/**
 * 预烘覆盖层缓存：整屏噪声画布，每帧只做一次 drawImage。
 * 缓存 key 只含视口 + 被预算压过的分辨率 —— strength / quality / 调色板都映射到每帧的
 * globalAlpha，换强度不需要重新烘焙，缓存预算也不会被设置面板的滑动条打爆。
 */
interface PaperToothLayerEntry {
  canvas: HTMLCanvasElement;
  key: string;
  pixelCount: number;
}

const paperToothLayerCache = new Map<string, PaperToothLayerEntry>();
const MAX_PAPER_TOOTH_LAYERS = 2;
/** 覆盖层像素预算：1080p@dpr1 约 8.3MB，dpr2 / 4K 由预算自动降到合适分辨率。 */
const MAX_PAPER_TOOTH_LAYER_PIXELS = 6_000_000;
/**
 * baked 覆盖层的默认烘焙分辨率比例。0.5 时 1080p 只烘 ~0.52M 像素（每帧贴图开销
 * 约为全分辨率的 1/4，headless 实测 0.48ms → 0.31ms），颗粒略软，正好压住"近看灰绿颗粒感"。
 */
const DEFAULT_PAPER_TOOTH_RESOLUTION = 0.5;
let paperToothLayerPixels = 0;

/** 图案方案缓存：按画布上下文 + 设备像素比缓存，每帧只复用不新建。 */
interface PaperToothPatternEntry {
  pattern: CanvasPattern;
  pixelRatio: number;
}

const paperToothPatternCache = new WeakMap<CanvasRenderingContext2D, PaperToothPatternEntry>();

/**
 * 取（或烘焙）覆盖层图案：噪声瓦片按 dpr 生成，再用 CanvasPattern.setTransform 缩回
 * 1 设备像素 = 1 噪声像素；旧浏览器不支持图案变换时退回 CSS 像素级颗粒。
 */
function getPaperToothPattern(
  ctx: CanvasRenderingContext2D,
  pixelRatio: number
): CanvasPattern | null {
  const cached = paperToothPatternCache.get(ctx);
  if (cached && cached.pixelRatio === pixelRatio) return cached.pattern;

  const tilePixels = Math.max(64, Math.round(PAPER_TOOTH_TILE_CSS * pixelRatio));
  const tile = getPaperNoiseTile(tilePixels, 96, 0.42, 0, 0.6, "paper-tooth-overlay");
  if (!tile) return null;
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return null;

  if (typeof pattern.setTransform === "function" && typeof DOMMatrix !== "undefined") {
    try {
      pattern.setTransform(new DOMMatrix([1 / pixelRatio, 0, 0, 1 / pixelRatio, 0, 0]));
    } catch {
      // 图案变换不可用时保持默认比例（颗粒略粗），不影响绘制。
    }
  }

  paperToothPatternCache.set(ctx, { pattern, pixelRatio });
  return pattern;
}

/** 烘焙整屏纸牙覆盖层：噪声瓦片按 1 层像素 = 1 噪声像素铺满，颜色保持中性灰。 */
function buildPaperToothLayer(
  width: number,
  height: number,
  layerRatio: number
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil(width * layerRatio));
  canvas.height = Math.max(2, Math.ceil(height * layerRatio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // 瓦片随烘焙分辨率一起缩小：1 层像素 = 1 噪声像素，dropped 到全屏时整体等比变软。
  const tilePixels = Math.max(48, Math.round(PAPER_TOOTH_TILE_CSS * layerRatio));
  const tileA = getPaperNoiseTile(tilePixels, 96, 0.42, 0, 0.6, "paper-tooth-overlay-a");
  const tileB = getPaperNoiseTile(tilePixels, 96, 0.42, 0, 0.6, "paper-tooth-overlay-b");
  if (!tileA || !tileB) return null;
  // 覆盖层画布不做 ctx.scale：这里的 1 用户单位就是 1 层像素，所以 pixelRatio 传 1。
  tileNoiseOverPage(ctx, [tileA, tileB], 1, 0, 0, canvas.width, canvas.height, 1, "source-over");
  return canvas;
}

function getPaperToothLayer(
  width: number,
  height: number,
  resolutionScale: number
): PaperToothLayerEntry | null {
  const layerRatio = pixelRatioForBudget(
    width,
    height,
    resolutionScale,
    MAX_PAPER_TOOTH_LAYER_PIXELS
  );
  if (!(layerRatio > 0)) return null;
  const layerWidth = Math.max(2, Math.ceil(width * layerRatio));
  const layerHeight = Math.max(2, Math.ceil(height * layerRatio));
  // 缓存 key 带烘焙分辨率，换 resolutionScale / 视口尺寸都会重新烘焙。
  const key = `${layerWidth}x${layerHeight}:${Math.round(layerRatio * 1000)}`;
  const cached = paperToothLayerCache.get(key);
  if (cached) {
    // 命中即刷新 LRU 顺序，避免常用分辨率被另一个视口挤掉。
    paperToothLayerCache.delete(key);
    paperToothLayerCache.set(key, cached);
    return cached;
  }

  const canvas = buildPaperToothLayer(width, height, layerRatio);
  if (!canvas) return null;
  const entry: PaperToothLayerEntry = {
    canvas,
    key,
    pixelCount: canvas.width * canvas.height,
  };
  while (
    paperToothLayerCache.size > 0 &&
    (paperToothLayerCache.size >= MAX_PAPER_TOOTH_LAYERS ||
      paperToothLayerPixels + entry.pixelCount > MAX_PAPER_TOOTH_LAYER_PIXELS)
  ) {
    const oldestKey = paperToothLayerCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = paperToothLayerCache.get(oldestKey);
    if (oldest) paperToothLayerPixels -= oldest.pixelCount;
    paperToothLayerCache.delete(oldestKey);
  }
  paperToothLayerCache.set(key, entry);
  paperToothLayerPixels += entry.pixelCount;
  return entry;
}

/**
 * 纸牙覆盖层：在屏幕空间用 overlay 合成铺一层极淡的静态纸纹，让文字 / 插画 / 纸面
 * 共用同一套颗粒（矢量字放大后不再"干净得像贴纸"）。默认走 baked：覆盖层按
 * resolutionScale（默认 0.5）预烘成一张画布，每帧只有 1 次 drawImage（headless 实测
 * 0.31ms，全分辨率 0.48ms，pattern fillRect ≈4.6ms）；传 mode="pattern" 可退回每帧 1 次 pattern fillRect。
 * quality ≥ 2 跳过、quality = 1 强度减半。
 */
export function drawHandwrittenPaperTooth(options: PaperToothOptions): void {
  if (typeof document === "undefined") return;
  if (!Number.isFinite(options.width) || !Number.isFinite(options.height)) return;
  if (options.width < 1 || options.height < 1) return;
  const quality = options.quality ?? 0;
  if (quality >= 2) return;
  const strength = finiteClamp(options.strength, 0, 1, 0);
  if (strength <= 0.01) return;

  const { ctx, palette } = options;
  const safeWidth = Math.min(options.width, 8192);
  const safeHeight = Math.min(options.height, 8192);
  const pixelRatio = finiteClamp(ctx.canvas.width / safeWidth, 1, 3, 1);

  // 深色纸上的颗粒需要略强一点才读得出来，但仍锁在"只由纸面调色板决定"的范围内。
  const qualityScale = quality === 1 ? 0.55 : 1;
  const paletteScale = palette.dark ? 1.18 : 1;
  const alpha = clamp(strength * 0.12 * qualityScale * paletteScale, 0, 0.16);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = alpha;
  if ((options.mode ?? "baked") === "pattern") {
    const pattern = getPaperToothPattern(ctx, pixelRatio);
    if (!pattern) {
      ctx.restore();
      return;
    }
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, safeWidth, safeHeight);
  } else {
    const resolutionScale = finiteClamp(
      options.resolutionScale ?? DEFAULT_PAPER_TOOTH_RESOLUTION,
      0.2,
      1,
      DEFAULT_PAPER_TOOTH_RESOLUTION
    );
    const layer = getPaperToothLayer(safeWidth, safeHeight, resolutionScale);
    if (!layer) {
      ctx.restore();
      return;
    }
    ctx.drawImage(layer.canvas, 0, 0, safeWidth, safeHeight);
  }
  ctx.restore();
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
