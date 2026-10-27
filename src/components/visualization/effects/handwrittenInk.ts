/**
 * 手写墨迹渲染：把歌词排版结果画成「正在被写出来」的手写字。
 *
 * 动画手感：
 * - 每个字先有很淡的铅笔稿，再按 LRC 估算的字词时间从左到右被墨迹覆盖；
 * - 字与字之间加入确定性的「抬笔间隙」，书写节奏不再匀速；
 * - 书写中的字：斜向湿润边缘 + 笔尖湿墨 + 暖色字缘光（不用 shadowBlur）；
 * - 写完 0.2s 内做一次轻微沉降，墨色由湿转干；
 * - 所有动画由绝对音乐时间推导，暂停 / seek / 倍速下同一时刻完全一致。
 */

import type { HandwrittenPalette } from "./handwrittenPalette";
import { withAlpha } from "./handwrittenPalette";
import { stableRandom } from "./handwrittenScene";
import type { EmphasisBox } from "./handwrittenDoodles";
import { drawHandwrittenAnnotation, drawHandwrittenHighlight } from "./handwrittenDoodles";

export type HandwrittenInkMode = "active" | "past" | "future";

export interface InkGlyphInput {
  text: string;
  /** 字形左边缘（绝对 CSS px） */
  x: number;
  /** 字形垂直中心（绝对 CSS px） */
  y: number;
  /** 排版测量宽度 */
  width: number;
  fontSize: number;
  /** 该单元开始书写的时间（秒） */
  start: number;
  /** 该单元写完的时间（秒） */
  end: number;
  /** 稳定随机种子：决定每个字的轻微抖动与旋转 */
  seed: string;
  /** 直接指定书写进度（用于尾字幕等没有逐字时间的场合），0–1 */
  reveal?: number;
  /** 视觉放大（关键词 >1），参与焦点字放大，不改变排版宽度 */
  scaleBoost?: number;
}

export interface InkEmphasisSpec {
  /** 起始单元索引（同一行内的扁平索引） */
  unitIndex: number;
  /** 一起标注的单元数量 */
  unitCount: number;
  style: "underline" | "circle" | "highlight";
}

export interface InkLineOptions {
  ctx: CanvasRenderingContext2D;
  palette: HandwrittenPalette;
  fontFamily: string;
  musicTime: number;
  mode: HandwrittenInkMode;
  /** 整行透明度 */
  alpha: number;
  /** 整行倾斜（弧度），围绕行中心旋转 */
  tilt: number;
  centerX: number;
  centerY: number;
  /** 暖光强度 0–1.5 */
  glow: number;
  reducedMotion: boolean;
  emphasis: InkEmphasisSpec | null;
  /** 墨色覆盖（默认主墨色） */
  inkColor?: string;
  /** 重点标注颜色（默认 palette.accent，可为 palette.seal） */
  annotationColor?: string;
  /** 墨色密度倍率（0.85–1.1） */
  inkDensity?: number;
  /** 强调标注开始前额外等待的秒数 */
  annotationDelay?: number;
  /** 0 最高画质，1 弱机档，2 极弱档 */
  quality?: number;
  /** 设备像素比：决定字形 sprite 的烘焙清晰度 */
  pixelRatio?: number;
  /** 绝对时间（毫秒），用于写字缘光的呼吸 */
  timeMs?: number;
}

const WRITE_EASE_POWER = 0.86;
const TAU = Math.PI * 2;
const PEN_GAP_SECONDS = 0.045;
const SETTLE_SECONDS = 0.2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeScaleBoost(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? Math.min(value!, 2.5) : 1;
}

/** 单元书写进度：纯函数，便于测试时间边界。 */
export function resolveWritingProgress(start: number, end: number, musicTime: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(musicTime)) return 0;
  const duration = end - start;
  if (duration <= 0.0001) return musicTime >= end ? 1 : 0;
  const raw = clamp((musicTime - start) / duration, 0, 1);
  return Math.pow(raw, WRITE_EASE_POWER);
}

/** 抬笔间隙：只在单元之间有真实停顿，不改变整行结束时间。 */
function penGap(seed: string, index: number, duration: number): number {
  if (index === 0) return 0;
  const factor = stableRandom(seed, "pen-gap");
  return Math.min(PEN_GAP_SECONDS, Math.max(0.008, duration * 0.12)) * factor;
}

function glyphJitter(
  seed: string,
  fontSize: number
): { dx: number; dy: number; rotation: number; scale: number } {
  return {
    dx: (stableRandom(seed, "glyph-dx") - 0.5) * fontSize * 0.02,
    dy: (stableRandom(seed, "glyph-dy") - 0.5) * fontSize * 0.03,
    rotation: (stableRandom(seed, "glyph-rot") - 0.5) * 0.022,
    // Keep hand jitter inside the reserved advance cell; emphasis scaleBoost owns the expansion.
    scale: 0.94 + stableRandom(seed, "glyph-scale") * 0.06,
  };
}

/** 铅笔稿专用抖动：比墨迹更宽、更歪，避免"同字体低透明度复制"的幽灵感。 */
function pencilJitter(
  seed: string,
  fontSize: number
): { dx: number; dy: number; rotation: number; scaleX: number; scaleY: number } {
  return {
    dx: (stableRandom(seed, "pencil-dx") - 0.5) * fontSize * 0.05,
    dy: (stableRandom(seed, "pencil-dy") - 0.5) * fontSize * 0.045,
    rotation: (stableRandom(seed, "pencil-rot") - 0.5) * 0.045,
    scaleX: 1.02 + stableRandom(seed, "pencil-sx") * 0.05,
    scaleY: 1.0 + stableRandom(seed, "pencil-sy") * 0.04,
  };
}

type GlyphStyle = "ink" | "pencil";

interface GlyphSprite {
  canvas: HTMLCanvasElement;
  /** CSS 像素下的尺寸（drawImage 目标尺寸） */
  width: number;
  height: number;
  /** 离屏画布像素量，用于限制长期缓存的显存占用。 */
  pixelCount: number;
  key: string;
}

const glyphSpriteCache = new Map<string, GlyphSprite>();
const MAX_GLYPH_SPRITES = 520;
const MAX_GLYPH_CACHE_PIXELS = 18_000_000;
const MAX_GLYPH_SPRITE_PIXELS = 1_500_000;
const MAX_GLYPH_SPRITE_DIMENSION = 4096;
let glyphSpriteCachePixels = 0;

/**
 * 字形 sprite：每个字只烘焙一次，内含墨积、边缘渗墨、干笔飞白与三叠印笔压。
 * 之后每帧只 drawImage，比逐帧 fillText 更便宜，也更像"墨落在纸上"。
 *
 * 性能保护：超大字号（>120px）只按 1× 烘焙再缩放，避免单个字形占掉几 MB。
 */
function getGlyphSprite(
  text: string,
  fontSize: number,
  fontFamily: string,
  color: string,
  style: GlyphStyle,
  pixelRatio: number
): GlyphSprite | null {
  if (
    typeof document === "undefined" ||
    !Number.isFinite(fontSize) ||
    fontSize <= 0 ||
    fontSize > 512 ||
    !text
  ) {
    return null;
  }
  const safePixelRatio = Number.isFinite(pixelRatio) ? clamp(Math.round(pixelRatio), 1, 2) : 1;
  const spriteScale = fontSize > 120 ? 1 : safePixelRatio;
  // Baking uses the exact CSS font size below, so the key must preserve that exact input too.
  const key = `${style}|${text}|${fontSize}|${fontFamily}|${color}|${spriteScale}`;
  const cached = glyphSpriteCache.get(key);
  if (cached) {
    glyphSpriteCache.delete(key);
    glyphSpriteCache.set(key, cached);
    return cached;
  }

  const pad = Math.ceil(fontSize * 0.22);
  const measure = document.createElement("canvas");
  const measureCtx = measure.getContext("2d");
  if (!measureCtx) return null;
  measureCtx.font = `500 ${fontSize}px ${fontFamily}`;
  const measuredWidth = measureCtx.measureText(text).width;
  if (!Number.isFinite(measuredWidth) || measuredWidth <= 0 || measuredWidth > 1024) return null;
  const textWidth = Math.max(1, Math.ceil(measuredWidth));
  const width = Math.ceil(textWidth + pad * 2);
  const height = Math.ceil(fontSize * 1.42 + pad * 2);
  const pixelWidth = Math.max(2, Math.ceil(width * spriteScale));
  const pixelHeight = Math.max(2, Math.ceil(height * spriteScale));
  const pixelCount = pixelWidth * pixelHeight;
  if (
    pixelWidth > MAX_GLYPH_SPRITE_DIMENSION ||
    pixelHeight > MAX_GLYPH_SPRITE_DIMENSION ||
    pixelCount > MAX_GLYPH_SPRITE_PIXELS
  ) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(spriteScale, spriteScale);
  ctx.font = `500 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const centerX = width / 2;
  const centerY = height / 2;

  if (style === "ink") {
    // 1) 边缘渗墨：只在这一步用 shadowBlur（离屏一次性），运行时零阴影。
    ctx.save();
    ctx.shadowColor = withAlpha(color, 0.55);
    ctx.shadowBlur = Math.max(0.75, fontSize * 0.018);
    ctx.fillStyle = color;
    ctx.fillText(text, centerX, centerY);
    ctx.restore();

    // 2) 主笔 + 三叠印笔压（偏移、低透明度重描）。
    ctx.fillStyle = color;
    ctx.fillText(text, centerX, centerY);
    ctx.globalAlpha = 0.12;
    ctx.fillText(text, centerX + fontSize * 0.02, centerY + fontSize * 0.02);
    ctx.globalAlpha = 1;

    // 3) 墨积：随机加深的墨点，让字内部有浓淡而不是实心色块。
    ctx.globalCompositeOperation = "source-atop";
    for (let index = 0; index < 3; index += 1) {
      const poolX = centerX + (stableRandom(text, `pool-x-${index}`) - 0.5) * width * 0.78;
      const poolY = centerY + (stableRandom(text, `pool-y-${index}`) - 0.5) * fontSize * 0.9;
      const radius = fontSize * (0.015 + stableRandom(text, `pool-r-${index}`) * 0.035);
      const pool = ctx.createRadialGradient(poolX, poolY, 0, poolX, poolY, radius);
      pool.addColorStop(0, withAlpha(color, 0.24));
      pool.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.arc(poolX, poolY, radius, 0, TAU);
      ctx.fill();
    }

    // 4) 干笔飞白：在墨迹上"刮"出纸色小点与细线。
    ctx.globalCompositeOperation = "destination-out";
    for (let index = 0; index < 9; index += 1) {
      const spotX = centerX + (stableRandom(text, `dry-x-${index}`) - 0.5) * width * 0.86;
      const spotY = centerY + (stableRandom(text, `dry-y-${index}`) - 0.5) * fontSize * 1.0;
      const radius = fontSize * (0.006 + stableRandom(text, `dry-r-${index}`) * 0.018);
      ctx.globalAlpha = 0.07 + stableRandom(text, `dry-a-${index}`) * 0.14;
      ctx.beginPath();
      ctx.arc(spotX, spotY, radius, 0, TAU);
      ctx.fill();
    }
    ctx.lineCap = "round";
    for (let index = 0; index < 2; index += 1) {
      ctx.globalAlpha = 0.04 + stableRandom(text, `streak-a-${index}`) * 0.07;
      ctx.strokeStyle = "rgba(0, 0, 0, 1)";
      ctx.lineWidth = fontSize * (0.008 + stableRandom(text, `streak-w-${index}`) * 0.018);
      const startX = centerX + (stableRandom(text, `streak-x-${index}`) - 0.5) * width * 0.7;
      const startY = centerY + (stableRandom(text, `streak-y-${index}`) - 0.5) * fontSize * 0.8;
      const length = width * (0.12 + stableRandom(text, `streak-l-${index}`) * 0.22);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + length, startY + fontSize * 0.015);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  } else {
    // 铅笔稿：更淡、更松，用断续的擦除点做出"草稿"而不是复制一层墨字。
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.82;
    ctx.fillText(text, centerX, centerY);
    ctx.globalAlpha = 0.18;
    ctx.fillText(text, centerX + fontSize * 0.012, centerY - fontSize * 0.012);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-out";
    for (let index = 0; index < 12; index += 1) {
      const spotX = centerX + (stableRandom(text, `pencil-x-${index}`) - 0.5) * width * 0.94;
      const spotY = centerY + (stableRandom(text, `pencil-y-${index}`) - 0.5) * fontSize;
      const radius = fontSize * (0.008 + stableRandom(text, `pencil-r-${index}`) * 0.02);
      ctx.globalAlpha = 0.1 + stableRandom(text, `pencil-a-${index}`) * 0.18;
      ctx.beginPath();
      ctx.arc(spotX, spotY, radius, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  const sprite: GlyphSprite = { canvas, width, height, pixelCount, key };
  while (
    glyphSpriteCache.size >= MAX_GLYPH_SPRITES ||
    glyphSpriteCachePixels + pixelCount > MAX_GLYPH_CACHE_PIXELS
  ) {
    const oldestKey = glyphSpriteCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = glyphSpriteCache.get(oldestKey);
    if (oldest) glyphSpriteCachePixels -= oldest.pixelCount;
    glyphSpriteCache.delete(oldestKey);
  }
  glyphSpriteCache.set(key, sprite);
  glyphSpriteCachePixels += pixelCount;
  return sprite;
}

/**
 * 写一个字的墨迹层（不含铅笔稿）。`progress` < 1 时用不规则遮罩逐层揭开。
 */
function drawInkGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: InkGlyphInput,
  progress: number,
  options: InkLineOptions,
  index: number
): void {
  const { palette, fontFamily, musicTime, mode } = options;
  const quality = options.quality ?? 0;
  const fontSize = glyph.fontSize;
  if (
    !Number.isFinite(fontSize) ||
    fontSize <= 0 ||
    fontSize > 512 ||
    !Number.isFinite(glyph.x) ||
    !Number.isFinite(glyph.y) ||
    !Number.isFinite(glyph.width) ||
    glyph.width <= 0
  ) {
    return;
  }
  const jitter = glyphJitter(glyph.seed, fontSize);
  const inkColor = options.inkColor ?? palette.ink;
  const density = clamp(options.inkDensity ?? 1, 0.8, 1.15);
  const fullyWritten = progress >= 1;
  const isWriting = mode === "active" && progress > 0 && progress < 1;
  const finishedAge = musicTime - glyph.end;
  const justFinished = mode === "active" && fullyWritten && finishedAge >= 0 && finishedAge < 0.32;
  const settling = mode === "active" && finishedAge >= 0 && finishedAge < SETTLE_SECONDS;
  const settleScale = settling ? 1.012 - (finishedAge / SETTLE_SECONDS) * 0.012 : 1;
  const boost = safeScaleBoost(glyph.scaleBoost);

  ctx.save();
  ctx.translate(glyph.x + glyph.width * 0.5 + jitter.dx, glyph.y + jitter.dy);
  ctx.rotate(jitter.rotation);
  ctx.scale(jitter.scale * settleScale * boost, jitter.scale * settleScale * boost);
  ctx.font = `500 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (progress < 1) {
    // 书写遮罩：斜向湿润边缘 + 一点起伏，避免像扫描线一样直上直下。
    const halfWidth = glyph.width * 0.5;
    const halfHeight = fontSize * 0.86;
    const skew = stableRandom(glyph.seed, "mask-skew") * 0.18 - 0.09;
    const frontier = -halfWidth + glyph.width * progress + fontSize * 0.1;
    ctx.beginPath();
    ctx.moveTo(-halfWidth - fontSize * 0.2, -halfHeight);
    ctx.lineTo(frontier - fontSize * (0.06 + skew * 0.3), -halfHeight);
    ctx.quadraticCurveTo(
      frontier + fontSize * 0.06,
      -halfHeight * 0.35,
      frontier + fontSize * skew,
      0
    );
    ctx.quadraticCurveTo(
      frontier - fontSize * 0.03,
      halfHeight * 0.42,
      frontier - fontSize * (0.08 + skew * 0.2),
      halfHeight
    );
    ctx.lineTo(-halfWidth - fontSize * 0.2, halfHeight);
    ctx.closePath();
    ctx.clip();
  }

  // 字缘暖光：低透明度暖色重描（阴影模糊在 Canvas2D 上极慢）。
  if ((isWriting || justFinished) && quality < 2) {
    const glowAlpha = clamp(
      (isWriting ? 0.14 : 0.08) *
        clamp(options.glow, 0, 1.6) *
        options.alpha *
        (justFinished ? 1 - finishedAge / 0.32 : 1),
      0,
      0.18
    );
    if (glowAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = glowAlpha;
      ctx.fillStyle = palette.lightWarm;
      ctx.scale(1.03, 1.03);
      ctx.fillText(glyph.text, 0, 0);
      ctx.restore();
    }
  }

  // 主墨：直接贴烘焙好的字形 sprite（内含渗墨、墨积、飞白、三叠印笔压）。
  const inkVariation = 0.84 + stableRandom(glyph.seed, "ink-density") * 0.16;
  const sprite = getGlyphSprite(
    glyph.text,
    fontSize,
    fontFamily,
    inkColor,
    "ink",
    options.pixelRatio ?? 1
  );
  ctx.globalAlpha = clamp(options.alpha * inkVariation * density, 0, 1);
  if (sprite) {
    ctx.drawImage(
      sprite.canvas,
      -sprite.width * 0.5,
      -sprite.height * 0.5,
      sprite.width,
      sprite.height
    );
  } else {
    ctx.fillStyle = inkColor;
    ctx.fillText(glyph.text, 0, 0);
  }

  ctx.globalAlpha = 1;
  ctx.restore();

  // 笔尖：湿墨团 + 少量飞溅 + 暖色高光，只在正在写的那个字上出现。
  if (isWriting) {
    const tipX = glyph.x + glyph.width * progress + fontSize * 0.05;
    const tipY = glyph.y;
    ctx.save();
    ctx.globalAlpha = clamp(options.alpha * 0.9, 0, 1);
    ctx.fillStyle = inkColor;
    ctx.beginPath();
    ctx.ellipse(tipX, tipY + fontSize * 0.08, fontSize * 0.07, fontSize * 0.048, 0.4, 0, TAU);
    ctx.fill();
    if (quality < 1) {
      ctx.globalAlpha = clamp(options.alpha * 0.55, 0, 1);
      for (let dotIndex = 0; dotIndex < 3; dotIndex += 1) {
        const angle = stableRandom(glyph.seed, `splat-a-${index}-${dotIndex}`) * TAU;
        const distance = fontSize * (0.16 + stableRandom(glyph.seed, `splat-d-${dotIndex}`) * 0.22);
        ctx.beginPath();
        ctx.arc(
          tipX + Math.cos(angle) * distance,
          tipY + Math.sin(angle) * distance,
          fontSize * (0.012 + stableRandom(glyph.seed, `splat-r-${dotIndex}`) * 0.016),
          0,
          TAU
        );
        ctx.fill();
      }
    }
    ctx.globalAlpha = clamp(options.alpha * 0.7, 0, 1);
    ctx.fillStyle = withAlpha(palette.lightWarm, 0.9);
    ctx.beginPath();
    ctx.arc(tipX - fontSize * 0.02, tipY - fontSize * 0.12, fontSize * 0.025, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function buildEmphasisBox(
  glyphs: readonly InkGlyphInput[],
  start: number,
  end: number
): EmphasisBox {
  const first = glyphs[start]!;
  const last = glyphs[end]!;
  const firstScale = safeScaleBoost(first.scaleBoost);
  const lastScale = safeScaleBoost(last.scaleBoost);
  const left = first.x + (first.width - first.width * firstScale) * 0.5;
  const right = last.x + (last.width + last.width * lastScale) * 0.5;
  const height = Math.max(first.fontSize * firstScale, last.fontSize * lastScale);
  return {
    x: left,
    y: (first.y + last.y) * 0.5,
    width: right - left,
    height,
    fontSize: height,
    rotation: glyphJitter(first.seed, first.fontSize).rotation,
  };
}

function resolveEmphasisProgress(
  glyphs: readonly InkGlyphInput[],
  start: number,
  end: number,
  options: InkLineOptions
): number {
  const last = glyphs[end]!;
  const delay = options.annotationDelay ?? 0.16;
  const begin = last.end + delay;
  const duration = Math.max(0.34, last.fontSize * 0.012);
  return clamp((options.musicTime - begin) / duration, 0, 1);
}

/**
 * 画一整行手写字：铅笔稿 → 墨迹逐字揭晓 → 重点标注。
 */
export function drawHandwrittenInkLine(
  glyphs: readonly InkGlyphInput[],
  options: InkLineOptions
): void {
  if (glyphs.length === 0 || options.alpha <= 0.005) return;

  const { ctx, palette, fontFamily, musicTime, mode } = options;

  ctx.save();
  ctx.translate(options.centerX, options.centerY);
  ctx.rotate(options.tilt);
  ctx.translate(-options.centerX, -options.centerY);

  // 1. 铅笔辅助线：整句先打稿。旧句不画稿，避免页面越来越脏。
  //    正在写的句子稿要非常淡、且必须"变形"（更宽/更歪/断续），否则未写到的字
  //    会像「同字体低透明度复制」的幽灵列。
  if (mode !== "past") {
    const guideAlpha = mode === "future" ? 0.2 : 0.085;
    const pixelRatio = options.pixelRatio ?? 1;
    ctx.save();
    for (const glyph of glyphs) {
      const jitter = pencilJitter(glyph.seed, glyph.fontSize);
      const pencilSize = glyph.fontSize * 1.03;
      const sprite = getGlyphSprite(
        glyph.text,
        pencilSize,
        fontFamily,
        palette.pencil,
        "pencil",
        pixelRatio
      );
      const variation = 0.78 + stableRandom(glyph.seed, "pencil-alpha") * 0.42;
      ctx.save();
      ctx.globalAlpha = clamp(options.alpha * guideAlpha * variation, 0, 0.16);
      ctx.translate(
        glyph.x + glyph.width * 0.5 + jitter.dx,
        glyph.y + jitter.dy - glyph.fontSize * 0.01
      );
      ctx.rotate(jitter.rotation);
      ctx.scale(jitter.scaleX, jitter.scaleY);
      if (sprite) {
        ctx.drawImage(
          sprite.canvas,
          -sprite.width * 0.5,
          -sprite.height * 0.5,
          sprite.width,
          sprite.height
        );
      } else {
        ctx.font = `400 ${pencilSize}px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(glyph.text, 0, 0);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // 2. 重点标注覆盖的单元范围：整段词一起标注。
  const emphasis = options.emphasis;
  const startIndex =
    emphasis && emphasis.unitIndex >= 0 && emphasis.unitIndex < glyphs.length
      ? emphasis.unitIndex
      : -1;
  const endIndex =
    startIndex >= 0
      ? Math.min(glyphs.length - 1, startIndex + Math.max(0, emphasis?.unitCount ?? 1) - 1)
      : -1;
  const emphasisProgress =
    startIndex >= 0 ? resolveEmphasisProgress(glyphs, startIndex, endIndex, options) : 0;

  if (emphasis && startIndex >= 0 && emphasisProgress > 0 && emphasis.style === "highlight") {
    drawHandwrittenHighlight(
      ctx,
      palette,
      buildEmphasisBox(glyphs, startIndex, endIndex),
      emphasisProgress
    );
  }

  // 3. 墨迹：未写到的字保持铅笔灰，已写的字由墨迹覆盖。
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index]!;
    let progress: number;
    if (typeof glyph.reveal === "number") {
      progress = clamp(glyph.reveal, 0, 1);
    } else if (mode === "future") {
      progress = 0;
    } else if (mode === "past") {
      progress = 1;
    } else {
      const duration = Math.max(0.0001, glyph.end - glyph.start);
      const gap = options.reducedMotion ? 0 : penGap(glyph.seed, index, duration);
      progress = resolveWritingProgress(glyph.start + gap, glyph.end + gap, musicTime);
    }
    if (progress <= 0.001) continue;
    drawInkGlyph(ctx, glyph, progress, options, index);
  }

  // 4. 下划线 / 圈画：等整段词写完后落笔。
  if (emphasis && startIndex >= 0 && emphasisProgress > 0 && emphasis.style !== "highlight") {
    const annotationColor = options.annotationColor ?? palette.accent;
    drawHandwrittenAnnotation(
      ctx,
      palette,
      emphasis.style,
      buildEmphasisBox(glyphs, startIndex, endIndex),
      emphasisProgress,
      `${glyphs[startIndex]!.seed}:emphasis`,
      annotationColor
    );
  }

  ctx.restore();
}
