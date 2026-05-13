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
  description: string;
  config: Partial<PosterConfig>;
}

export interface PosterQualityCheck {
  id: "cover" | "lyrics" | "resolution" | "lyric-density" | "contrast";
  label: string;
  detail: string;
  passed: boolean;
  severity: "info" | "warning";
}

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
  { name: "Square 1:1", value: 1 },
  { name: "Feed 4:5", value: 0.8 },
  { name: "Story 9:16", value: 0.5625 },
  { name: "Portrait 3:4", value: 0.75 },
];

export const POSTER_RESOLUTION_PRESETS = [
  { pixelRatio: 1, label: "Standard" },
  { pixelRatio: 2, label: "HD" },
  { pixelRatio: 3, label: "Ultra" },
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
    description: "Vertical social poster with balanced cover, lyric, and QR.",
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
    description: "Compact 4:5 layout for feed sharing.",
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
    description: "Quiet quote card with larger lyric and fewer lines.",
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
    description: "Album-art led poster for high-impact cover sharing.",
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

export function applyPosterPreset(config: PosterConfig, presetId: PosterPreset["id"]): PosterConfig {
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
      detail: hasCover ? "Cover art is available." : "Missing cover art; fallback artwork will export.",
      passed: hasCover,
      severity: "warning",
    },
    {
      id: "lyrics",
      label: "Lyrics",
      detail:
        lyricLineCount > 0
          ? `${lyricLineCount} lyric line${lyricLineCount === 1 ? "" : "s"} selected.`
          : "No lyric line selected; poster will rely on song metadata.",
      passed: lyricLineCount > 0,
      severity: "info",
    },
    {
      id: "resolution",
      label: "Resolution",
      detail: resolution >= 2 ? "Export resolution is ready for sharing." : "Use HD or Ultra for crisper text.",
      passed: resolution >= 2,
      severity: "warning",
    },
    {
      id: "lyric-density",
      label: "Lyric density",
      detail:
        config.maxLyricLines <= 5
          ? "Lyric density is easy to scan."
          : "Too many lyric lines can crowd small posters.",
      passed: config.maxLyricLines <= 5,
      severity: "warning",
    },
    {
      id: "contrast",
      label: "Contrast",
      detail:
        config.textEffect === "none" && config.template !== "minimal"
          ? "Consider shadow or glow for busy artwork."
          : "Text treatment should remain readable.",
      passed: config.textEffect !== "none" || config.template === "minimal",
      severity: "info",
    },
  ];
}

export function createPosterFileName(title: string, template: PosterTemplate): string {
  const safeTitle = title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^-|-$/g, "");

  return `${safeTitle || "poster"} - ${template} - poster.png`;
}
