export type PosterTemplate =
  | "apple"
  | "spotify"
  | "vinyl"
  | "minimal"
  | "cassette"
  | "gradient"
  | "aura"
  | "cyberpunk";

export interface PosterConfig {
  template: PosterTemplate;
  coverScale: number;
  coverYOffset: number;
  coverRadius: number;
  titleSize: number;
  titleYOffset: number;
  artistOpacity: number;
  lyricSize: number;
  blurIntensity: number;
  noiseOpacity: number;
  overlayDepth: number;
  aspectRatio: number;
  showWaveform: boolean;
  showQRCode: boolean;
  primaryColor: string;
  lyricAlignment: "left" | "center" | "right";
  lineSpacing: number;
  maxLyricLines: number;
  lyricColor: string;
  lyricFont: "sans" | "serif" | "mono" | "cursive";
  textEffect: "none" | "shadow" | "glow" | "neon" | "stroke";
}

export interface PosterPreset {
  id: "story" | "feed" | "lyric-focus" | "cover-focus";
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  config: Partial<PosterConfig>;
}

export interface PosterQualityCheck {
  id: "cover" | "lyrics" | "resolution" | "lyric-density" | "contrast";
  label: string;
  labelZh: string;
  detail: string;
  detailZh: string;
  passed: boolean;
  severity: "info" | "warning";
}

export interface PosterTemplateMeta {
  id: PosterTemplate;
  name: string;
  nameZh: string;
  icon: string;
  gradient: string;
  description: string;
  descriptionZh: string;
  supportsThemeColor: boolean;
}

export const POSTER_TEMPLATE_META: PosterTemplateMeta[] = [
  {
    id: "apple",
    name: "Apple Glass",
    nameZh: "苹果玻璃",
    icon: "apple",
    gradient: "from-blue-500 to-purple-500",
    description: "Frosted glass with blurred cover backdrop.",
    descriptionZh: "磨砂玻璃与封面背景虚化。",
    supportsThemeColor: false,
  },
  {
    id: "spotify",
    name: "Spotify Vibrant",
    nameZh: "Spotify 活力",
    icon: "music",
    gradient: "from-green-400 to-emerald-600",
    description: "Bold gradient with cover at bottom-right.",
    descriptionZh: "高饱和渐变与右下角封面。",
    supportsThemeColor: true,
  },
  {
    id: "gradient",
    name: "Starry Gradient",
    nameZh: "星空渐变",
    icon: "stars",
    gradient: "from-purple-600 to-blue-900",
    description: "Deep gradient sky with floating cover art.",
    descriptionZh: "深色渐变星空与悬浮封面。",
    supportsThemeColor: true,
  },
  {
    id: "vinyl",
    name: "Classic Vinyl",
    nameZh: "经典黑胶",
    icon: "disc",
    gradient: "from-[#d5cebc] to-[#c2ba9e]",
    description: "Warm vinyl record with cream paper texture.",
    descriptionZh: "温暖黑胶唱片与纸张纹理。",
    supportsThemeColor: true,
  },
  {
    id: "cassette",
    name: "Retro Cassette",
    nameZh: "复古磁带",
    icon: "cassette",
    gradient: "from-gray-700 to-gray-900",
    description: "Nostalgic cassette tape with reels and sticker.",
    descriptionZh: "怀旧磁带、卷轴与贴纸元素。",
    supportsThemeColor: true,
  },
  {
    id: "minimal",
    name: "Minimal White",
    nameZh: "极简白",
    icon: "sparkle",
    gradient: "from-gray-100 to-gray-300",
    description: "Clean white canvas with large cover art.",
    descriptionZh: "干净白底与大幅封面。",
    supportsThemeColor: false,
  },
  {
    id: "aura",
    name: "Dreamy Aura",
    nameZh: "梦幻光晕",
    icon: "sparkle",
    gradient: "from-violet-500 to-fuchsia-500",
    description: "Luminous shapes with soft glow.",
    descriptionZh: "发光形状与柔和光晕。",
    supportsThemeColor: true,
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    nameZh: "赛博朋克",
    icon: "grid",
    gradient: "from-cyan-500 to-yellow-500",
    description: "Neon-lit digital grid with glitch accents.",
    descriptionZh: "霓虹数字网格与故障装饰。",
    supportsThemeColor: true,
  },
];

export const DEFAULT_POSTER_CONFIG: PosterConfig = {
  template: "apple",
  coverScale: 1.05,
  coverYOffset: 0,
  coverRadius: 0.15,
  titleSize: 1.0,
  titleYOffset: 0,
  artistOpacity: 0.7,
  lyricSize: 1.0,
  blurIntensity: 1.2,
  noiseOpacity: 0.2,
  overlayDepth: 0.4,
  aspectRatio: 0.5625,
  showWaveform: true,
  showQRCode: true,
  primaryColor: "#fa2d48",
  lyricAlignment: "center",
  lineSpacing: 1.5,
  maxLyricLines: 5,
  lyricColor: "rgba(255,255,255,0.9)",
  lyricFont: "sans",
  textEffect: "shadow",
};

export const POSTER_ASPECT_RATIO_PRESETS = [
  { name: "1:1 Square", nameZh: "1:1 方形", value: 1 },
  { name: "4:5 Feed", nameZh: "4:5 信息流", value: 0.8 },
  { name: "9:16 Story", nameZh: "9:16 故事", value: 0.5625 },
  { name: "3:4 Portrait", nameZh: "3:4 竖版", value: 0.75 },
];

export const POSTER_RESOLUTION_PRESETS = [
  { pixelRatio: 1, label: "Standard", labelZh: "标准" },
  { pixelRatio: 2, label: "HD", labelZh: "高清" },
  { pixelRatio: 3, label: "Ultra", labelZh: "超清" },
];

export const POSTER_THEME_COLORS = [
  "#fa2d48",
  "#1DB954",
  "#0a84ff",
  "#bf5af2",
  "#ff9f0a",
  "#1c1c1e",
  "#F5F5dc",
  "#8B4513",
];

export const POSTER_QUICK_PRESETS: PosterPreset[] = [
  {
    id: "story",
    name: "Story",
    nameZh: "动态",
    description: "Vertical social poster with balanced cover, lyric, and QR.",
    descriptionZh: "竖版社交海报，平衡封面、歌词与二维码。",
    config: {
      template: "apple",
      aspectRatio: 0.5625,
      coverScale: 1.05,
      lyricSize: 1,
      maxLyricLines: 5,
      showQRCode: true,
      showWaveform: true,
    },
  },
  {
    id: "feed",
    name: "Feed",
    nameZh: "信息流",
    description: "Compact 4:5 layout for feed sharing.",
    descriptionZh: "适合信息流分享的紧凑 4:5 布局。",
    config: {
      template: "spotify",
      aspectRatio: 0.8,
      coverScale: 0.95,
      lyricSize: 0.9,
      maxLyricLines: 4,
      showQRCode: true,
      showWaveform: true,
    },
  },
  {
    id: "lyric-focus",
    name: "Lyric",
    nameZh: "歌词",
    description: "Quiet quote card with larger lyric and fewer lines.",
    descriptionZh: "更大的歌词与更少行数，适合引用卡片。",
    config: {
      template: "minimal",
      aspectRatio: 1,
      coverScale: 0.72,
      titleSize: 0.9,
      lyricSize: 1.35,
      maxLyricLines: 3,
      lineSpacing: 1.7,
      lyricAlignment: "left",
      showQRCode: false,
      showWaveform: false,
      textEffect: "none",
    },
  },
  {
    id: "cover-focus",
    name: "Cover",
    nameZh: "封面",
    description: "Album-art led poster for high-impact cover sharing.",
    descriptionZh: "突出专辑封面的高冲击分享海报。",
    config: {
      template: "gradient",
      aspectRatio: 0.75,
      coverScale: 1.35,
      coverRadius: 0.25,
      titleSize: 1.15,
      lyricSize: 0.8,
      maxLyricLines: 2,
      showQRCode: false,
      showWaveform: true,
      textEffect: "glow",
    },
  },
];

export function applyPosterPreset(
  config: PosterConfig,
  presetId: PosterPreset["id"]
): PosterConfig {
  const preset = POSTER_QUICK_PRESETS.find((item) => item.id === presetId);
  return preset ? { ...config, ...preset.config } : config;
}

export function getPosterExportMeta(config: PosterConfig, resolution: number, renderWidth = 800) {
  const width = Math.round(renderWidth * resolution);
  const height = Math.round((renderWidth / config.aspectRatio) * resolution);
  const megapixels = Number(((width * height) / 1_000_000).toFixed(2));

  return {
    width,
    height,
    megapixels,
    label: `${width} x ${height}`,
  };
}

export function getPosterQualityChecks({
  config,
  resolution,
  lyricLineCount,
  hasCover,
}: {
  config: PosterConfig;
  resolution: number;
  lyricLineCount: number;
  hasCover: boolean;
}): PosterQualityCheck[] {
  return [
    {
      id: "cover",
      label: "Cover",
      labelZh: "封面",
      detail: hasCover
        ? "Cover art is available."
        : "Missing cover art; fallback artwork will export.",
      detailZh: hasCover
        ? "Cover art is available."
        : "Missing cover art; fallback artwork will export.",
      passed: hasCover,
      severity: "warning",
    },
    {
      id: "lyrics",
      label: "Lyrics",
      labelZh: "歌词",
      detail:
        lyricLineCount > 0
          ? `${lyricLineCount} lyric line${lyricLineCount === 1 ? "" : "s"} selected.`
          : "No lyric line selected; poster will rely on song metadata.",
      detailZh:
        lyricLineCount > 0
          ? `已选择 ${lyricLineCount} 行歌词。`
          : "未选择歌词，海报将仅使用歌曲信息。",
      passed: lyricLineCount > 0,
      severity: "info",
    },
    {
      id: "resolution",
      label: "Resolution",
      labelZh: "分辨率",
      detail:
        resolution >= 2
          ? "Export resolution is ready for sharing."
          : "Use HD or Ultra for crisper text.",
      detailZh:
        resolution >= 2
          ? "Export resolution is ready for sharing."
          : "Use HD or Ultra for crisper text.",
      passed: resolution >= 2,
      severity: "warning",
    },
    {
      id: "lyric-density",
      label: "Lyric density",
      labelZh: "歌词密度",
      detail:
        config.maxLyricLines <= 5
          ? "Lyric density is easy to scan."
          : "Too many lyric lines can crowd small posters.",
      detailZh:
        config.maxLyricLines <= 5
          ? "Lyric density is easy to scan."
          : "Too many lyric lines can crowd small posters.",
      passed: config.maxLyricLines <= 5,
      severity: "warning",
    },
    {
      id: "contrast",
      label: "Contrast",
      labelZh: "对比度",
      detail:
        config.textEffect === "none" && config.template !== "minimal"
          ? "Consider shadow or glow for busy artwork."
          : "Text treatment should remain readable.",
      detailZh:
        config.textEffect === "none" && config.template !== "minimal"
          ? "Consider shadow or glow for busy artwork."
          : "Text treatment should remain readable.",
      passed: config.textEffect !== "none" || config.template === "minimal",
      severity: "info",
    },
  ];
}

export function getTemplateMeta(id: PosterTemplate): PosterTemplateMeta {
  return POSTER_TEMPLATE_META.find((t) => t.id === id) ?? POSTER_TEMPLATE_META[0];
}

export function createPosterFileName(title: string, template: PosterTemplate): string {
  const safeTitle = Array.from(title)
    .map((char) => ('<>:"/\\|?*'.includes(char) || char.charCodeAt(0) < 32 ? "-" : char))
    .join("")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^-|-$/g, "");

  return `${safeTitle || "poster"} - ${template} - poster.png`;
}
