// S6-12j: store-free audio-effect types, defaults and pure helpers live here so
// audioEffectsStore.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The store re-exports the public effect types and EFFECT_SCENES, so its public surface is unchanged.

import type { EffectPreset } from "@/lib/audio/effectsPresets";

export type AudioEffectType =
  | "autoPan"
  | "reverb"
  | "stereoWidener"
  | "nightcore"
  | "vaporwave"
  | "cassette"
  | "tremolo"
  | "underwater"
  | "vinyl"
  | "bitcrusher"
  | "talkie"
  | "megaBass"
  | "asmr"
  | "phaser"
  | "vocalRemove"
  | "cyberpunkDistortion"
  | "loFiPhone";

export interface AudioEffect {
  id: AudioEffectType;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  intensity: number;
}

export interface LegacyEffectPreset {
  id: string;
  name: string;
  icon: string;
  effects: Partial<Record<AudioEffectType, { enabled: boolean; intensity: number }>>;
  xy?: { x: number; y: number };
}

export interface EffectScene {
  id: string;
  nameZh: string;
  icon: string;
  gradient: string;
  description: string;
  effects: Partial<Record<AudioEffectType, { enabled: boolean; intensity: number }>>;
  xy: { x: number; y: number };
}

export interface MorphState {
  from: EffectPreset;
  to: EffectPreset;
  t: number;
  durationMs: number;
}

export const EFFECT_SCENES: EffectScene[] = [
  {
    id: "late-night-radio",
    nameZh: "Late Night Radio",
    icon: "LN",
    gradient: "from-indigo-600 to-purple-800",
    description: "Warm lo-fi texture for quiet listening.",
    effects: {
      loFiPhone: { enabled: true, intensity: 0.6 },
      reverb: { enabled: true, intensity: 0.3 },
      vinyl: { enabled: true, intensity: 0.4 },
    },
    xy: { x: 0.3, y: 0.7 },
  },
  {
    id: "space-walk",
    nameZh: "Space Walk",
    icon: "SP",
    gradient: "from-cyan-500 to-blue-700",
    description: "Wide reverb and spatial movement.",
    effects: {
      reverb: { enabled: true, intensity: 0.8 },
      stereoWidener: { enabled: true, intensity: 0.7 },
      autoPan: { enabled: true, intensity: 0.3 },
      phaser: { enabled: true, intensity: 0.4 },
    },
    xy: { x: 0.8, y: 0.8 },
  },
  {
    id: "concert-hall",
    nameZh: "Concert Hall",
    icon: "CH",
    gradient: "from-pink-500 to-red-600",
    description: "Large-room presence with reinforced low end.",
    effects: {
      reverb: { enabled: true, intensity: 0.7 },
      megaBass: { enabled: true, intensity: 0.6 },
      stereoWidener: { enabled: true, intensity: 0.5 },
    },
    xy: { x: 0.6, y: 0.9 },
  },
];

export const DEFAULT_EFFECTS: Record<AudioEffectType, AudioEffect> = {
  autoPan: {
    id: "autoPan",
    name: "Auto Pan",
    category: "Spatial",
    description: "Moves the sound field around the listener.",
    enabled: false,
    intensity: 0.5,
  },
  reverb: {
    id: "reverb",
    name: "Reverb",
    category: "Spatial",
    description: "Adds room depth and tail.",
    enabled: false,
    intensity: 0.4,
  },
  stereoWidener: {
    id: "stereoWidener",
    name: "Stereo Widener",
    category: "Spatial",
    description: "Expands perceived stereo width.",
    enabled: false,
    intensity: 0.5,
  },
  nightcore: {
    id: "nightcore",
    name: "Nightcore",
    category: "Time",
    description: "Bright, accelerated playback color.",
    enabled: false,
    intensity: 1,
  },
  vaporwave: {
    id: "vaporwave",
    name: "Vaporwave",
    category: "Time",
    description: "Slower and warmer playback color.",
    enabled: false,
    intensity: 0.8,
  },
  cassette: {
    id: "cassette",
    name: "Cassette",
    category: "Time",
    description: "Tape wobble and softened tone.",
    enabled: false,
    intensity: 0.4,
  },
  tremolo: {
    id: "tremolo",
    name: "Tremolo",
    category: "Time",
    description: "Rhythmic volume modulation.",
    enabled: false,
    intensity: 0.5,
  },
  underwater: {
    id: "underwater",
    name: "Underwater",
    category: "Texture",
    description: "Damped, submerged filtering.",
    enabled: false,
    intensity: 0.7,
  },
  vinyl: {
    id: "vinyl",
    name: "Vinyl",
    category: "Texture",
    description: "Vintage record texture.",
    enabled: false,
    intensity: 0.6,
  },
  bitcrusher: {
    id: "bitcrusher",
    name: "Bitcrusher",
    category: "Texture",
    description: "Low-resolution digital grit.",
    enabled: false,
    intensity: 0.5,
  },
  talkie: {
    id: "talkie",
    name: "Talkie",
    category: "Texture",
    description: "Narrow radio-style bandwidth.",
    enabled: false,
    intensity: 0.6,
  },
  megaBass: {
    id: "megaBass",
    name: "Mega Bass",
    category: "Texture",
    description: "Boosts low-end pressure.",
    enabled: false,
    intensity: 0.5,
  },
  asmr: {
    id: "asmr",
    name: "ASMR",
    category: "Texture",
    description: "Highlights fine high-frequency detail.",
    enabled: false,
    intensity: 0.6,
  },
  phaser: {
    id: "phaser",
    name: "Phaser",
    category: "Texture",
    description: "Sweeping phase movement.",
    enabled: false,
    intensity: 0.5,
  },
  vocalRemove: {
    id: "vocalRemove",
    name: "Vocal Remove",
    category: "Texture",
    description: "Reduces centered vocal content.",
    enabled: false,
    intensity: 0.8,
  },
  cyberpunkDistortion: {
    id: "cyberpunkDistortion",
    name: "Cyberpunk Distortion",
    category: "Time",
    description: "Aggressive digital edge.",
    enabled: false,
    intensity: 0.7,
  },
  loFiPhone: {
    id: "loFiPhone",
    name: "Lo-Fi Phone",
    category: "Texture",
    description: "Limited-bandwidth phone tone.",
    enabled: false,
    intensity: 0.8,
  },
};
export interface AudioEffectsState {
  effects: Record<AudioEffectType, AudioEffect>;
  isEnabled: boolean;
  activeScene: string | null;
  xyX: number;
  xyY: number;
  savedPresets: LegacyEffectPreset[];
  presets: EffectPreset[];
  activePresetId: string | null;
  lastPresetId: string | null;
  morphState: MorphState | null;
  isMorphing: boolean;
  lfoEnabled: boolean;
  lfoSpeed: number;
  lfoDepth: number;

  toggleEffect: (effectId: AudioEffectType) => void;
  setEffectIntensity: (effectId: AudioEffectType, intensity: number) => void;
  commitEffectIntensity: (effectId: AudioEffectType) => void;
  setIsEnabled: (enabled: boolean) => void;
  resetAllEffects: () => void;
  applyScene: (sceneId: string) => void;
  clearScene: () => void;
  randomize: () => void;
  shuffleIntensity: () => void;
  setXY: (x: number, y: number) => void;
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  morphToScene: (sceneId: string, duration?: number) => void;
  morphTo: (toId: string, durationMs?: number) => void;
  setMorphT: (t: number) => void;
  toggleLFO: () => void;
  setLFOSpeed: (speed: number) => void;
  setLFODepth: (depth: number) => void;
}

export function cloneDefaultEffects(): Record<AudioEffectType, AudioEffect> {
  return Object.fromEntries(
    Object.entries(DEFAULT_EFFECTS).map(([id, effect]) => [id, { ...effect }])
  ) as Record<AudioEffectType, AudioEffect>;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function presetToEffectConfig(
  preset: EffectPreset
): Partial<Record<AudioEffectType, { enabled: boolean; intensity: number }>> {
  return {
    reverb: { enabled: preset.reverb > 0.01, intensity: preset.reverb },
    stereoWidener: {
      enabled: Math.abs(preset.stereoWidth - 1) > 0.02,
      intensity: clamp01(preset.stereoWidth / 2),
    },
    megaBass: {
      enabled: preset.eq.slice(0, 3).some((gain) => gain > 2),
      intensity: clamp01(preset.eq[0] / 12),
    },
  };
}

export function createLegacyPreset(
  name: string,
  effects: Record<AudioEffectType, AudioEffect>,
  xyX: number,
  xyY: number
) {
  return {
    id: `preset-${Date.now()}`,
    name,
    icon: "*",
    effects: Object.fromEntries(
      Object.entries(effects)
        .filter(([, effect]) => effect.enabled)
        .map(([id, effect]) => [id, { enabled: effect.enabled, intensity: effect.intensity }])
    ) as LegacyEffectPreset["effects"],
    xy: { x: xyX, y: xyY },
  };
}
