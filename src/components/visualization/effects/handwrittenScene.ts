/**
 * 手书歌词 MV 的「分镜底稿」：每个镜头把字写在纸面哪里、倾斜多少、
 * 页边配哪几笔涂鸦、哪些字被重点标注、镜头怎么缓慢推近。
 *
 * 这些结果只由歌曲身份、镜头 seed 和文本决定：同一音乐时刻无论重绘、
 * 暂停、seek 还是切歌回来，都要得到同一版式，否则手写 MV 会「跳字」。
 * 因此全部使用哈希派生的稳定随机数，不依赖 Math.random。
 */

import type { LyricFilmProfile, LyricFilmShotKind } from "./lyricFilmProgram";

export type HandwrittenLayoutKind =
  | "center"
  | "left"
  | "right"
  | "low"
  | "high"
  | "stagger"
  | "diagonal"
  | "postcard"
  | "margin";

export type HandwrittenDoodleKind =
  | "sun"
  | "cloud"
  | "star"
  | "spark"
  | "note"
  | "heart"
  | "leaf"
  | "sprig"
  | "arrow"
  | "wave"
  | "tape"
  | "paperclip"
  | "flower"
  | "dots"
  | "moon"
  | "wheat"
  | "ripple"
  | "rays"
  | "window"
  | "postageStamp"
  | "paperplane"
  | "coffeeRing"
  | "rain"
  | "mountain"
  | "radio"
  | "cassette"
  | "starCluster"
  | "ribbon"
  | "bracket"
  | "quote";

export type HandwrittenColorRole = "ink" | "pencil" | "accent" | "highlight";

export interface HandwrittenDoodleSpec {
  kind: HandwrittenDoodleKind;
  /** 视口归一化坐标（0–1），指涂鸦的锚点中心 */
  x: number;
  y: number;
  /** 相对 min(视口宽, 视口高) 的缩放系数 */
  scale: number;
  rotation: number;
  /** 镜头开始后多久开始画（秒） */
  delay: number;
  /** 画完需要多久（秒） */
  duration: number;
  color: HandwrittenColorRole;
  /** 画在文字后面还是前面，用于制造轻微遮挡与景深 */
  layer: "back" | "front";
  flip: boolean;
}

export interface HandwrittenIllustrationSpec {
  kind: HandwrittenDoodleKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: HandwrittenColorRole;
  delay: number;
  duration: number;
  layer: "back";
  flip: boolean;
}

export type HandwrittenDecorationKind =
  | "tape"
  | "paperclip"
  | "postageStamp"
  | "fold"
  | "seal"
  | "scrap"
  | "polaroid";

export interface HandwrittenDecorationSpec {
  kind: HandwrittenDecorationKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flip: boolean;
  /** 印章文字（仅 seal 使用） */
  label?: string;
  /** 杂物上的手写小字（scrap / polaroid 用） */
  caption?: string;
}

/** 页边小字：日期、页码、天气、批注。真实手账靠这些"非歌词信息"获得生活感。 */
export type HandwrittenNoteKind = "date" | "page" | "caption" | "symbol";

export interface HandwrittenNoteSpec {
  kind: HandwrittenNoteKind;
  /** 视口归一化坐标，指文字块中心 */
  x: number;
  y: number;
  text: string;
  /** 相对主句字号的倍率（很小，0.14–0.22） */
  scale: number;
  rotation: number;
  /** 用墨还是铅笔 */
  tone: "ink" | "pencil";
}

export interface HandwrittenEmphasisSpec {
  /** 主句排版单元起始索引 */
  unitIndex: number;
  /** 一起被标注的单元数量（2–3 个，标一词而不是单个标点） */
  unitCount: number;
  style: "underline" | "circle" | "highlight";
  tone: "warm" | "seal";
}

export interface HandwrittenCameraSpec {
  startZoom: number;
  endZoom: number;
  driftX: number;
  driftY: number;
  rotation: number;
  direction: number;
}

export interface HandwrittenSceneConfig {
  seed: string;
  layout: HandwrittenLayoutKind;
  /** 主句文字块中心（归一化） */
  anchorX: number;
  anchorY: number;
  /** 主句最大宽度占视口比例 */
  maxWidthRatio: number;
  /** 主句整体倾斜（弧度），模仿手写时的自然斜度 */
  tilt: number;
  /** 行间距相对主句字号的倍率 */
  rowGapRatio: number;
  /** 主句字号相对设置字号的倍率 */
  activeScale: number;
  /** 每行额外横向错位（占视口比例，可正可负） */
  rowShift: number;
  /** 行的对齐方式 */
  rowAlign: "center" | "left" | "right";
  /** 光源位置（归一化） */
  lightX: number;
  lightY: number;
  /** 纸面整体的极轻微旋转 */
  paperRotation: number;
  /** 墨色密度（0.85–1.05），制造字迹浓淡变化 */
  inkDensity: number;
  doodles: HandwrittenDoodleSpec[];
  /** 大幅铅笔线稿，给留白一侧提供主体 */
  illustrations: HandwrittenIllustrationSpec[];
  /** 贴在纸页上的实物装饰：胶带、回形针、邮票、折角、小印章、纸片、拍立得 */
  decorations: HandwrittenDecorationSpec[];
  /** 页边小字（日期 / 页码 / 批注 / 符号） */
  notes: HandwrittenNoteSpec[];
  emphasis: HandwrittenEmphasisSpec | null;
  /** 片尾排版变体 */
  creditsVariant: "signature" | "postcard" | "vertical";
  camera: HandwrittenCameraSpec;
}

export interface HandwrittenCameraFrame {
  zoom: number;
  x: number;
  y: number;
  rotation: number;
}

const PROFILE_ILLUSTRATIONS: Record<LyricFilmProfile, readonly HandwrittenDoodleKind[]> = {
  spotlight: ["sprig", "paperplane", "window", "wheat", "leaf"],
  prism: ["moon", "cloud", "paperplane", "ripple", "window"],
  window: ["window", "rain", "cloud", "paperplane", "leaf"],
  caustic: ["ripple", "leaf", "paperplane", "sprig", "rain"],
  botanical: ["wheat", "sprig", "flower", "leaf", "mountain"],
  astral: ["moon", "cloud", "paperplane", "leaf", "sprig"],
  motes: ["ripple", "sun", "cloud", "paperplane", "leaf"],
};

/**
 * 语义配图：歌词里出现"可画的具体物"时，优先把它画在页边，
 * 让插画与这一句有关，而不是纯按 profile 轮换。
 * 只是软匹配（命中才替换），命中多个时按规则顺序取第一个，保证确定性。
 */
const SEMANTIC_ILLUSTRATION_RULES: ReadonlyArray<{
  pattern: RegExp;
  kinds: readonly HandwrittenDoodleKind[];
}> = [
  { pattern: /纸飞机|飞机|翅膀|飞|风/u, kinds: ["paperplane"] },
  { pattern: /雨|泪|哭|湿|淋/u, kinds: ["rain"] },
  { pattern: /家|回|城堡|窗|门|归/u, kinds: ["window"] },
  { pattern: /阳光|晴|太阳|笑|温暖|夏/u, kinds: ["sun"] },
  { pattern: /梦|星|夜|月光|月亮|银河|光/u, kinds: ["moon"] },
  { pattern: /稻|麦|田|乡/u, kinds: ["wheat"] },
  { pattern: /落叶|树叶|树|叶|枝/u, kinds: ["leaf"] },
  { pattern: /草|花|野|林/u, kinds: ["sprig", "flower"] },
  { pattern: /山|峰|坡/u, kinds: ["mountain"] },
  { pattern: /海|河|流|水|波|浪|潮/u, kinds: ["ripple"] },
  { pattern: /云|天空|远|飘/u, kinds: ["cloud"] },
];

/** 从句子文本推测插画主题；没有具体意象时返回 null，由 profile 池决定。 */
export function resolveSemanticIllustrationKind(
  text: string,
  seed: string | number
): HandwrittenDoodleKind | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const rule = SEMANTIC_ILLUSTRATION_RULES.find(({ pattern }) => pattern.test(trimmed));
  if (!rule) return null;
  if (rule.kinds.length === 1) return rule.kinds[0]!;
  return pickStable(rule.kinds, seed, `semantic-${rule.kinds.join("-")}`);
}

/** 语义插画的配套笔触：纸飞机配速度线，雨配落滴，月亮配闪点，窗配窗台线。 */
export type HandwrittenIllustrationAccent = "speed" | "drops" | "sparkle" | "sill";

export function resolveIllustrationAccent(
  kind: HandwrittenDoodleKind
): HandwrittenIllustrationAccent | null {
  switch (kind) {
    case "paperplane":
      return "speed";
    case "rain":
      return "drops";
    case "moon":
      return "sparkle";
    case "window":
      return "sill";
    default:
      return null;
  }
}

const LAYOUT_MAX_WIDTH: Record<HandwrittenLayoutKind, number> = {
  center: 0.74,
  left: 0.64,
  right: 0.64,
  low: 0.7,
  high: 0.74,
  stagger: 0.68,
  diagonal: 0.7,
  postcard: 0.58,
  margin: 0.5,
};

const LAYOUT_TILT: Record<HandwrittenLayoutKind, number> = {
  center: 0.002,
  left: 0.004,
  right: -0.004,
  low: 0.003,
  high: -0.003,
  stagger: 0.004,
  diagonal: 0.005,
  postcard: 0.003,
  margin: -0.004,
};

/** FNV-1a；与其它歌词模块保持同一套哈希，方便跨模块比较 seed。 */
export function hashHandwrittenSeed(value: string | number): number {
  const text = String(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 稳定随机数，范围 [0, 1)。 */
export function stableRandom(seed: string | number, salt: string): number {
  return hashHandwrittenSeed(`${String(seed)}|${salt}`) / 0x100000000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function pickStable<T>(options: readonly T[], seed: string | number, salt: string): T {
  const index = Math.floor(stableRandom(seed, salt) * options.length) % options.length;
  return options[index]!;
}

function resolveEmphasis(
  units: readonly string[],
  seed: string | number
): HandwrittenEmphasisSpec | null {
  if (units.length === 0) return null;

  const preferred = units
    .map((text, index) => ({ text: text.replace(/\s+/gu, ""), index }))
    .filter((item) => item.text.length > 0);
  if (preferred.length === 0) return null;

  // 优先标注内容完整的词/字组；标注 2–3 个连续单元，让它像圈住一个词。
  const substantial = preferred.filter((item) => item.text.length >= 2);
  const pool = substantial.length > 0 ? substantial : preferred;
  const maxStart = Math.max(0, units.length - 2);
  const candidates = pool.filter((item) => item.index <= maxStart);
  const target =
    candidates[
      Math.floor(stableRandom(seed, "emphasis-unit") * candidates.length) % candidates.length
    ] ?? pool[0]!;
  const countRoll = stableRandom(seed, "emphasis-count");
  const unitCount = Math.min(countRoll < 0.5 ? 2 : 3, Math.max(1, units.length - target.index));
  const roll = stableRandom(seed, "emphasis-style");
  const style = roll < 0.42 ? "underline" : roll < 0.72 ? "highlight" : "circle";
  const tone = stableRandom(seed, "emphasis-tone") < 0.7 ? "warm" : "seal";

  return { unitIndex: target.index, unitCount, style, tone };
}

/** 大幅线稿放在文字相反的一侧，像手账页面另一边随手画下的插画。 */
function resolveIllustrations(
  profile: LyricFilmProfile,
  shotKind: LyricFilmShotKind,
  seed: string | number,
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  reducedMotion: boolean
): HandwrittenIllustrationSpec[] {
  const pool = PROFILE_ILLUSTRATIONS[profile] ?? PROFILE_ILLUSTRATIONS.spotlight;
  const kind = pickStable(pool, seed, "illustration-kind");
  const isTall = height / Math.max(1, width) > 1.3;
  const isInstrumental = shotKind === "instrumental";
  const onLeft = anchorX > 0.5;
  const baseX = isTall || isInstrumental ? 0.5 : onLeft ? 0.2 : 0.8;
  const baseY = isTall
    ? 0.29
    : isInstrumental
      ? 0.43
      : clamp(anchorY + (stableRandom(seed, "ill-y") - 0.5) * 0.12, 0.24, 0.78);
  const scale = isTall
    ? 4.55 + stableRandom(seed, "ill-scale") * 0.35
    : isInstrumental
      ? 3.55 + stableRandom(seed, "ill-scale") * 0.5
      : 2.15 + stableRandom(seed, "ill-scale") * 0.4;

  return [
    {
      kind,
      x: baseX,
      y: baseY,
      scale,
      rotation: (stableRandom(seed, "ill-rot") - 0.5) * (isTall ? 0.03 : 0.075),
      color: "pencil",
      delay: reducedMotion ? 0 : 0.2,
      duration: reducedMotion ? 0.001 : 1.45,
      layer: "back",
      flip: onLeft,
    },
  ];
}

/** 每页的实物装饰：胶带压住文字块上沿或纸边，再按概率配一件页边实物。 */
function resolveDecorations(
  shotKind: LyricFilmShotKind,
  seed: string | number,
  anchorX: number,
  anchorY: number,
  isTall: boolean
): HandwrittenDecorationSpec[] {
  if (shotKind === "instrumental") return [];
  const decorations: HandwrittenDecorationSpec[] = [];
  const tapeSide = stableRandom(seed, "tape-side") > 0.5 ? 1 : -1;
  // 竖屏文字块较高，胶带压字会盖住上一行/未来行，固定在页边更干净。
  const tapeOnText = !isTall && shotKind === "lyrics" && stableRandom(seed, "tape-on-text") < 0.62;
  decorations.push({
    kind: "tape",
    x: tapeOnText
      ? clamp(anchorX + tapeSide * (0.16 + stableRandom(seed, "tape-x") * 0.06), 0.14, 0.86)
      : stableRandom(seed, "tape-edge") > 0.5
        ? 0.84
        : 0.16,
    y: tapeOnText
      ? clamp(anchorY - (0.1 + stableRandom(seed, "tape-y") * 0.035), 0.1, 0.82)
      : 0.055,
    scale: 0.32 + stableRandom(seed, "tape-scale") * 0.14,
    rotation: (stableRandom(seed, "tape-rot") - 0.5) * 0.22,
    flip: tapeSide > 0,
  });

  if (stableRandom(seed, "second-object") < 0.58) {
    const roll = stableRandom(seed, "object-kind");
    const awayX = anchorX < 0.5 ? 0.12 : 0.88;
    const captionPool = ["10.20", "夜航手记", "第 3 次听", "慢一点", "晴", "雨停之后", "循环播放"];
    if (roll < 0.36) {
      decorations.push({
        kind: "seal",
        x: awayX,
        y: 0.84 + stableRandom(seed, "seal-y") * 0.05,
        scale: 0.42 + stableRandom(seed, "seal-scale") * 0.12,
        rotation: -0.06 + stableRandom(seed, "seal-rot") * 0.1,
        flip: false,
        label: pickStable(["温光", "手书", "夜航", "浮字", "稻香"], seed, "seal-label"),
      });
    } else if (roll < 0.62) {
      decorations.push({
        kind: "scrap",
        x: awayX === 0.12 ? 0.14 : 0.86,
        y: 0.62 + stableRandom(seed, "scrap-y") * 0.12,
        scale: 0.95 + stableRandom(seed, "scrap-scale") * 0.25,
        rotation: (stableRandom(seed, "scrap-rot") - 0.5) * 0.26,
        flip: false,
        caption: pickStable(captionPool, seed, "scrap-caption"),
      });
    } else if (roll < 0.86) {
      decorations.push({
        kind: "polaroid",
        x: awayX === 0.12 ? 0.14 : 0.86,
        y: 0.68 + stableRandom(seed, "pol-y") * 0.1,
        scale: 0.95 + stableRandom(seed, "pol-scale") * 0.22,
        rotation: (stableRandom(seed, "pol-rot") - 0.5) * 0.22,
        flip: false,
        caption: pickStable(captionPool, seed, "pol-caption"),
      });
    } else if (roll < 0.95) {
      decorations.push({
        kind: "scrap",
        x: awayX === 0.12 ? 0.86 : 0.14,
        y: 0.24 + stableRandom(seed, "scrap2-y") * 0.08,
        scale: 0.85 + stableRandom(seed, "scrap2-scale") * 0.2,
        rotation: (stableRandom(seed, "scrap2-rot") - 0.5) * 0.24,
        flip: false,
        caption: pickStable(captionPool, seed, "scrap2-caption"),
      });
    } else {
      decorations.push({
        kind: "paperclip",
        x: awayX === 0.12 ? 0.055 : 0.945,
        y: 0.18 + stableRandom(seed, "clip-y") * 0.1,
        scale: 0.5 + stableRandom(seed, "clip-scale") * 0.16,
        rotation: 0.3,
        flip: false,
      });
    }
  }

  return decorations;
}

/** 页边小字：日期 / 页码 / 批注。它们不是歌词，而是"这页纸被人用过"的证据。 */
function resolveNotes(
  shotKind: LyricFilmShotKind,
  seed: string | number,
  anchorX: number,
  anchorY: number,
  width: number,
  height: number
): HandwrittenNoteSpec[] {
  const month = String(1 + Math.floor(stableRandom(seed, "note-month") * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(stableRandom(seed, "note-day") * 28)).padStart(2, "0");
  const portrait = height > width;
  const notes: HandwrittenNoteSpec[] = [
    {
      kind: "date",
      x: portrait ? 0.8 : 0.87 + stableRandom(seed, "note-date-x") * 0.03,
      y: 0.075 + stableRandom(seed, "note-date-y") * 0.02,
      text: `2026.${month}.${day}`,
      scale: 0.14 + stableRandom(seed, "note-date-scale") * 0.03,
      rotation: (stableRandom(seed, "note-date-rot") - 0.5) * 0.06,
      tone: "pencil",
    },
    {
      kind: "page",
      x: portrait ? 0.8 : 0.9,
      y: 0.945,
      text: `${String(2 + Math.floor(stableRandom(seed, "note-page") * 48)).padStart(2, "0")}`,
      scale: 0.12 + stableRandom(seed, "note-page-scale") * 0.02,
      rotation: 0,
      tone: "pencil",
    },
  ];

  if (shotKind === "lyrics" && stableRandom(seed, "note-caption-on") < 0.55) {
    const captionPool = ["夜航手记", "第 3 次听", "慢一点", "雨停之后", "循环播放", "听完再走"];
    const onLeft = anchorX > 0.5;
    notes.push({
      kind: "caption",
      x: clamp(anchorX + (onLeft ? 0.28 : -0.28), 0.14, 0.86),
      y: clamp(anchorY + (stableRandom(seed, "note-cap-y") - 0.5) * 0.3, 0.2, 0.82),
      text: pickStable(captionPool, seed, "note-caption"),
      scale: 0.16 + stableRandom(seed, "note-cap-scale") * 0.03,
      rotation: (stableRandom(seed, "note-cap-rot") - 0.5) * 0.12,
      tone: stableRandom(seed, "note-cap-tone") < 0.7 ? "pencil" : "ink",
    });
  } else if (shotKind !== "lyrics" && shotKind !== "intro" && shotKind !== "outro") {
    notes.push({
      kind: "symbol",
      x: 0.12 + stableRandom(seed, "note-sym-x") * 0.04,
      y: 0.86,
      text: pickStable(["♪", "☾", "✎", "→"], seed, "note-symbol"),
      scale: 0.2 + stableRandom(seed, "note-sym-scale") * 0.03,
      rotation: (stableRandom(seed, "note-sym-rot") - 0.5) * 0.12,
      tone: "pencil",
    });
  }

  return notes;
}

function resolveLayout(
  shotKind: LyricFilmShotKind,
  seed: string | number,
  width: number,
  height: number
): HandwrittenLayoutKind {
  if (height / Math.max(1, width) > 1.3) return "postcard";
  if (shotKind === "intro" || shotKind === "outro") return "postcard";
  if (shotKind === "instrumental") return "center";
  if (shotKind === "interlude") return pickStable(["left", "right"] as const, seed, "layout");
  return pickStable(["left", "right", "postcard"] as const, seed, "layout");
}

function rowArrangement(layout: HandwrittenLayoutKind): {
  rowShift: number;
  rowAlign: "center" | "left" | "right";
} {
  switch (layout) {
    case "stagger":
      return { rowShift: 0.024, rowAlign: "center" };
    case "diagonal":
      return { rowShift: 0.03, rowAlign: "left" };
    case "postcard":
      return { rowShift: 0.018, rowAlign: "left" };
    case "margin":
      return { rowShift: 0, rowAlign: "left" };
    case "left":
      return { rowShift: 0.014, rowAlign: "left" };
    case "right":
      return { rowShift: 0.014, rowAlign: "right" };
    default:
      return { rowShift: 0.006, rowAlign: "center" };
  }
}

/**
 * 解析一个镜头的版式。`units` 是主句排版后的文字单元，用于决定重点标注对象。
 */
export function resolveHandwrittenScene(input: {
  seed: string | number;
  profile: LyricFilmProfile;
  shotKind: LyricFilmShotKind;
  width: number;
  height: number;
  units: readonly string[];
  reducedMotion: boolean;
}): HandwrittenSceneConfig {
  const safeWidth = Number.isFinite(input.width) && input.width > 0 ? input.width : 1;
  const safeHeight = Number.isFinite(input.height) && input.height > 0 ? input.height : 1;
  const seed = String(input.seed);
  const isTall = safeHeight / safeWidth > 1.3;
  const layout = resolveLayout(input.shotKind, seed, safeWidth, safeHeight);
  const arrangement = isTall
    ? { rowShift: 0, rowAlign: "center" as const }
    : rowArrangement(layout);
  const anchorX =
    isTall || input.shotKind === "instrumental"
      ? 0.5
      : layout === "left" || layout === "postcard"
        ? 0.37
        : 0.63;
  const anchorY = isTall
    ? 0.62
    : input.shotKind === "instrumental"
      ? 0.44
      : input.shotKind === "intro" || input.shotKind === "outro"
        ? 0.48
        : 0.51;
  const maxWidthRatio = isTall
    ? 0.82
    : input.shotKind === "instrumental"
      ? 0.78
      : LAYOUT_MAX_WIDTH[layout];

  return {
    seed,
    layout,
    anchorX,
    anchorY,
    maxWidthRatio,
    tilt: input.reducedMotion ? 0 : LAYOUT_TILT[layout],
    rowGapRatio: 1.3,
    rowShift: arrangement.rowShift,
    rowAlign: arrangement.rowAlign,
    activeScale: 1.01 + stableRandom(seed, "active-scale") * 0.025,
    inkDensity: 0.97 + stableRandom(seed, "ink-density") * 0.06,
    lightX: layout === "right" ? 0.82 : 0.18,
    lightY: 0.16,
    paperRotation: input.reducedMotion ? 0 : (stableRandom(seed, "paper-rotate") - 0.5) * 0.0015,
    doodles: [],
    illustrations: resolveIllustrations(
      input.profile,
      input.shotKind,
      seed,
      anchorX,
      anchorY,
      safeWidth,
      safeHeight,
      input.reducedMotion
    ),
    decorations: resolveDecorations(input.shotKind, seed, anchorX, anchorY, isTall),
    notes: resolveNotes(input.shotKind, seed, anchorX, anchorY, safeWidth, safeHeight),
    emphasis: input.shotKind === "lyrics" ? resolveEmphasis(input.units, seed) : null,
    creditsVariant: pickStable(
      ["signature", "postcard", "vertical"] as const,
      seed,
      "credits-variant"
    ),
    camera: {
      startZoom: 1.001 + stableRandom(seed, "zoom-start") * 0.002,
      endZoom: 1.012 + stableRandom(seed, "zoom-end") * 0.006,
      driftX: input.reducedMotion ? 0 : 0.35 + stableRandom(seed, "drift-x") * 0.55,
      driftY: input.reducedMotion ? 0 : 0.3 + stableRandom(seed, "drift-y") * 0.45,
      rotation: input.reducedMotion ? 0 : (stableRandom(seed, "camera-rt") - 0.5) * 0.0009,
      direction: stableRandom(seed, "camera-dir") > 0.5 ? 1 : -1,
    },
  };
}

function easeInOutSine(value: number): number {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

/** 平滑的一维 value noise，用于替代正弦叠加的手持感。 */
function valueNoise(time: number, seed: string, salt: string): number {
  const t = time;
  const i = Math.floor(t);
  const f = t - i;
  const a = stableRandom(seed, `${salt}-${i}`) * 2 - 1;
  const b = stableRandom(seed, `${salt}-${i + 1}`) * 2 - 1;
  const smooth = f * f * (3 - 2 * f);
  return a + (b - a) * smooth;
}

/**
 * 镜头帧：音乐时间决定唯一结果。
 * 用两层 value noise 代替纯正弦，得到不循环的手持漂移；镜头内持续缓动，
 * 不在末段停死。
 */
export function resolveHandwrittenCameraFrame(
  scene: HandwrittenSceneConfig,
  musicTime: number,
  shotStartTime: number,
  shotEndTime: number,
  reducedMotion: boolean,
  motionSpeed: number
): HandwrittenCameraFrame {
  if (reducedMotion) {
    return { zoom: 1, x: 0, y: 0, rotation: 0 };
  }

  const duration = Math.max(0.001, shotEndTime - shotStartTime);
  const progress = clamp((musicTime - shotStartTime) / duration, 0, 1);
  const entry = easeInOutSine(clamp(progress / 0.16, 0, 1));
  const exit = easeInOutSine(clamp((1 - progress) / 0.12, 0, 1));
  const envelope = Math.min(entry, exit);
  const speed = clamp(motionSpeed, 0.15, 2.5);
  const time = musicTime * speed * 0.55;
  const phase = stableRandom(scene.seed, "camera-phase") * 100;

  const driftX =
    (valueNoise(time * 0.32 + phase, scene.seed, "cam-x-a") * 0.7 +
      valueNoise(time * 0.93 + phase * 1.3, scene.seed, "cam-x-b") * 0.3) *
    scene.camera.driftX;
  const driftY =
    (valueNoise(time * 0.27 + phase * 0.7, scene.seed, "cam-y-a") * 0.7 +
      valueNoise(time * 0.81 + phase * 0.4, scene.seed, "cam-y-b") * 0.3) *
    scene.camera.driftY;
  const zoomProgress = easeInOutSine(progress);
  const zoom =
    scene.camera.startZoom + (scene.camera.endZoom - scene.camera.startZoom) * zoomProgress;
  const rotation =
    valueNoise(time * 0.4 + phase * 1.7, scene.seed, "cam-rot") * scene.camera.rotation;

  const microEntry = 1 - entry;
  return {
    zoom: zoom - microEntry * 0.006,
    x: driftX * (0.4 + envelope * 0.6),
    y: driftY * (0.4 + envelope * 0.6),
    rotation: rotation * (0.3 + envelope * 0.7),
  };
}

/** 涂鸦的落笔进度：延迟开始、持续时间内画完，结果稳定可复现。 */
export function resolveDoodleProgress(
  doodle: HandwrittenDoodleSpec,
  musicTime: number,
  shotStartTime: number
): number {
  if (doodle.duration <= 0.0001) return musicTime >= shotStartTime + doodle.delay ? 1 : 0;
  const elapsed = musicTime - shotStartTime - doodle.delay;
  return clamp(elapsed / doodle.duration, 0, 1);
}
