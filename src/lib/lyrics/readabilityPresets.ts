export type LyricReadabilityPresetId = "cinema" | "reading" | "karaoke";

export interface LyricReadabilityPreset {
  id: LyricReadabilityPresetId;
  name: string;
  description: string;
  fontSize: number;
  lineHeight: number;
  weight: number;
  contrast: number;
  glow: number;
  showTranslation: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeReadabilityPreset(preset: LyricReadabilityPreset): LyricReadabilityPreset {
  return {
    ...preset,
    fontSize: clamp(preset.fontSize, 12, 24),
    lineHeight: clamp(preset.lineHeight, 1, 2),
    weight: clamp(preset.weight, 300, 900),
    contrast: clamp(preset.contrast, 0, 1),
    glow: clamp(preset.glow, 0, 50),
  };
}

export const LYRIC_READABILITY_PRESETS: LyricReadabilityPreset[] = [
  normalizeReadabilityPreset({
    id: "cinema",
    name: "Cinema",
    description: "Large lead line, dim background lyrics, soft glow.",
    fontSize: 22,
    lineHeight: 1.6,
    weight: 800,
    contrast: 0.28,
    glow: 28,
    showTranslation: false,
  }),
  normalizeReadabilityPreset({
    id: "reading",
    name: "Reading",
    description: "Balanced size and spacing for longer reading sessions.",
    fontSize: 18,
    lineHeight: 1.7,
    weight: 650,
    contrast: 0.48,
    glow: 8,
    showTranslation: true,
  }),
  normalizeReadabilityPreset({
    id: "karaoke",
    name: "Karaoke",
    description: "Bright current line and visible translation.",
    fontSize: 20,
    lineHeight: 1.5,
    weight: 900,
    contrast: 0.35,
    glow: 24,
    showTranslation: true,
  }),
];

export function serializeReadabilityPreset(preset: LyricReadabilityPreset): string {
  return JSON.stringify(normalizeReadabilityPreset(preset));
}
