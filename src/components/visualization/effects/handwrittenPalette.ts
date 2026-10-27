/**
 * 「温光浮字」手书歌词 MV 的视觉底稿：纸张色调、墨色与手写字体栈。
 *
 * v2（2026-10-20 手书美学深化）：纸底改为中性浅色（L* 90–94、chroma ≤0.03），
 * 墨色加深、对比拉开；彩色只留给「贴上去的纸 / 墨 / 印章」。旧版的米黄底 +
 * 棕色暗角会被真实手账的视觉语言淘汰——那是复古滤镜，不是纸。
 *
 * 场景、纸张和墨迹模块都只从这里取色，避免各模块各写一套色值。
 */

export interface HandwrittenPalette {
  /** 设置面板里展示的调色名 */
  name: string;
  /** 纸面中间调 */
  paperBase: string;
  /** 受光处的纸色 */
  paperLight: string;
  /** 背光/边缘的纸色 */
  paperDeep: string;
  /** 纸纤维与杂点 */
  fiber: string;
  /** 主墨色（已写文字） */
  ink: string;
  /** 浅墨（辅助小字、译词） */
  inkSoft: string;
  /** 褪色墨（写过的旧句） */
  inkGhost: string;
  /** 铅笔辅助线 */
  pencil: string;
  /** 荧光笔/水彩底色 */
  highlight: string;
  /** 荧光笔的笔触边 */
  highlightLine: string;
  /** 彩色铅笔批注 / 水彩斑 */
  accent: string;
  /** 印章红 */
  seal: string;
  /** 阳光颜色 */
  lightWarm: string;
  /** 纸面阴影/暗角 */
  shadow: string;
  /** 页面外的桌面底色（暗角用） */
  desk: string;
  /** 深色纸（夜间模式） */
  dark: boolean;
}

export const HANDWRITTEN_PALETTES: readonly HandwrittenPalette[] = [
  {
    name: "暖阳米纸",
    paperBase: "#efefeb",
    paperLight: "#f8f8f4",
    paperDeep: "#d8d9d4",
    fiber: "rgba(78, 80, 77, 0.035)",
    ink: "#27292b",
    inkSoft: "rgba(39, 41, 43, 0.58)",
    inkGhost: "rgba(39, 41, 43, 0.3)",
    pencil: "rgba(73, 76, 78, 0.22)",
    highlight: "rgba(230, 176, 88, 0.34)",
    highlightLine: "rgba(206, 146, 58, 0.62)",
    accent: "rgba(176, 72, 48, 0.85)",
    seal: "#a93a2b",
    lightWarm: "#f7f4eb",
    shadow: "#626366",
    desk: "#2a2620",
    dark: false,
  },
  {
    name: "牛皮手帖",
    paperBase: "#e8dac2",
    paperLight: "#f5ebd8",
    paperDeep: "#cbb694",
    fiber: "rgba(96, 78, 54, 0.07)",
    ink: "#2a231b",
    inkSoft: "rgba(42, 35, 27, 0.58)",
    inkGhost: "rgba(42, 35, 27, 0.34)",
    pencil: "rgba(90, 74, 52, 0.28)",
    highlight: "rgba(214, 156, 74, 0.30)",
    highlightLine: "rgba(184, 118, 44, 0.62)",
    accent: "rgba(140, 86, 44, 0.85)",
    seal: "#9c3a26",
    lightWarm: "#ffe4b2",
    shadow: "#5f4b32",
    desk: "#271f16",
    dark: false,
  },
  {
    name: "青灰信纸",
    paperBase: "#e8edeb",
    paperLight: "#f5f9f7",
    paperDeep: "#ccd6d1",
    fiber: "rgba(76, 94, 90, 0.06)",
    ink: "#1f2a29",
    inkSoft: "rgba(31, 42, 41, 0.58)",
    inkGhost: "rgba(31, 42, 41, 0.32)",
    pencil: "rgba(66, 82, 80, 0.25)",
    highlight: "rgba(150, 196, 184, 0.26)",
    highlightLine: "rgba(84, 150, 136, 0.56)",
    accent: "rgba(46, 110, 124, 0.85)",
    seal: "#a54136",
    lightWarm: "#eef6f0",
    shadow: "#55655e",
    desk: "#1f2725",
    dark: false,
  },
  {
    name: "樱粉手账",
    paperBase: "#f5e9e4",
    paperLight: "#fdf6f1",
    paperDeep: "#e2cdc5",
    fiber: "rgba(110, 84, 84, 0.05)",
    ink: "#32272a",
    inkSoft: "rgba(50, 39, 42, 0.58)",
    inkGhost: "rgba(50, 39, 42, 0.32)",
    pencil: "rgba(96, 70, 74, 0.26)",
    highlight: "rgba(232, 150, 158, 0.28)",
    highlightLine: "rgba(198, 110, 122, 0.58)",
    accent: "rgba(176, 74, 92, 0.85)",
    seal: "#ab3b4c",
    lightWarm: "#fff0e6",
    shadow: "#7a5a58",
    desk: "#2a2224",
    dark: false,
  },
  {
    name: "夜航靛纸",
    paperBase: "#1d2533",
    paperLight: "#273244",
    paperDeep: "#10151e",
    fiber: "rgba(214, 206, 188, 0.05)",
    ink: "#f1e9d8",
    inkSoft: "rgba(241, 233, 216, 0.60)",
    inkGhost: "rgba(241, 233, 216, 0.34)",
    pencil: "rgba(228, 218, 198, 0.28)",
    highlight: "rgba(222, 168, 96, 0.24)",
    highlightLine: "rgba(228, 172, 92, 0.56)",
    accent: "rgba(206, 126, 94, 0.85)",
    seal: "#bd5648",
    lightWarm: "#ffd8a0",
    shadow: "#05080d",
    desk: "#06080c",
    dark: true,
  },
];

/**
 * 手写字体栈。Windows 自带 KaiTi / FangSong，macOS 自带 Kaiti SC / Xingkai SC；
 * 行楷放最前面，让装有华文行楷的机器更接近手书笔迹。所有栈都以衬线或系统手写体收尾，
 * 保证缺字时不会掉回无衬线正文字体。
 */
export const HANDWRITTEN_FONT_STACKS: readonly string[] = [
  `"STXingkai", "Xingkai SC", "华文行楷", "Kaiti SC", "STKaiti", "KaiTi", "楷体", "KaiTi_GB2312", "楷体_GB2312", "FangSong", "仿宋", serif`,
  `"Kaiti SC", "STKaiti", "KaiTi", "楷体", "KaiTi_GB2312", "楷体_GB2312", "Source Han Serif SC", "Songti SC", "SimSun", "宋体", serif`,
  `"FangSong", "仿宋", "FangSong_GB2312", "仿宋_GB2312", "STFangsong", "Songti SC", "SimSun", "宋体", serif`,
  `"YouYuan", "幼圆", "Hiragino Maru Gothic ProN", "Yu Gothic", "Microsoft YaHei", "PingFang SC", sans-serif`,
];

export const HANDWRITTEN_FONT_LABELS: readonly string[] = [
  "行楷手写",
  "楷书",
  "钢笔仿宋",
  "圆体手写",
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** 解析 #rgb / #rrggbb / rgb() / rgba()，用于在既有色值上叠加透明度。 */
function parseColor(color: string): [number, number, number] | null {
  const value = color.trim();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (hex) {
    const raw = hex[1]!;
    if (raw.length === 3) {
      const [red, green, blue] = raw;
      return [
        Number.parseInt(`${red}${red}`, 16),
        Number.parseInt(`${green}${green}`, 16),
        Number.parseInt(`${blue}${blue}`, 16),
      ];
    }
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  }

  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(value);
  if (!rgb) return null;
  return [
    clamp(Math.round(Number(rgb[1])), 0, 255),
    clamp(Math.round(Number(rgb[2])), 0, 255),
    clamp(Math.round(Number(rgb[3])), 0, 255),
  ];
}

/** 在色值上叠一层透明度；解析失败时原样返回，避免绘图中断。 */
export function withAlpha(color: string, alpha: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;
  const [red, green, blue] = parsed;
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

/** 把颜色向另一个颜色混合，ratio=0 返回原色，1 返回目标色；用于纸张/墨色的轻微色偏。 */
export function mixColors(color: string, target: string, ratio: number): string {
  const from = parseColor(color);
  const to = parseColor(target);
  if (!from || !to) return color;
  const t = clamp(ratio, 0, 1);
  const mix = from.map((channel, index) => Math.round(channel + (to[index]! - channel) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

/** 按索引取调色板，越界时夹取而不是回退到第一套（避免设置面板越界产生突变）。 */
export function resolveHandwrittenPalette(index: number): HandwrittenPalette {
  const safeIndex = Number.isFinite(index) ? Math.round(index) : 0;
  return HANDWRITTEN_PALETTES[clamp(safeIndex, 0, HANDWRITTEN_PALETTES.length - 1)]!;
}

/** 按索引取手写字体栈。 */
export function resolveHandwrittenFont(index: number): string {
  const safeIndex = Number.isFinite(index) ? Math.round(index) : 0;
  return HANDWRITTEN_FONT_STACKS[clamp(safeIndex, 0, HANDWRITTEN_FONT_STACKS.length - 1)]!;
}
