import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BUILT_IN_EFFECT_PRESETS,
  EffectPreset,
  getBuiltInEffectPreset,
  morph,
} from "@/lib/audio/effectsPresets";
import { getAudioEffectsManager } from "@/lib/audio/AudioEffectsManager";

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

const DEFAULT_EFFECTS: Record<AudioEffectType, AudioEffect> = {
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

interface AudioEffectsState {
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

function cloneDefaultEffects(): Record<AudioEffectType, AudioEffect> {
  return Object.fromEntries(
    Object.entries(DEFAULT_EFFECTS).map(([id, effect]) => [id, { ...effect }])
  ) as Record<AudioEffectType, AudioEffect>;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function applyEffectConfig(
  base: Record<AudioEffectType, AudioEffect>,
  config: Partial<Record<AudioEffectType, { enabled: boolean; intensity: number }>>
): Record<AudioEffectType, AudioEffect> {
  const next = cloneDefaultEffects();
  const manager = getAudioEffectsManager();

  for (const id of Object.keys(next) as AudioEffectType[]) {
    const effectConfig = config[id];
    const enabled = effectConfig?.enabled ?? false;
    const intensity = clamp01(effectConfig?.intensity ?? base[id].intensity);
    next[id] = { ...next[id], enabled, intensity };
    manager.setEffectEnabled(id, enabled);
    manager.setEffectIntensity(id, intensity);
  }

  return next;
}

function presetToEffectConfig(
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

function createLegacyPreset(
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

export const useAudioEffectsStore = create<AudioEffectsState>()(
  persist(
    (set, get) => ({
      effects: cloneDefaultEffects(),
      isEnabled: true,
      activeScene: null,
      xyX: 0.5,
      xyY: 0.5,
      savedPresets: [],
      presets: BUILT_IN_EFFECT_PRESETS,
      activePresetId: null,
      lastPresetId: null,
      morphState: null,
      isMorphing: false,
      lfoEnabled: false,
      lfoSpeed: 0.5,
      lfoDepth: 0.3,

      toggleEffect: (effectId) => {
        const enabled = !get().effects[effectId].enabled;
        getAudioEffectsManager().setEffectEnabled(effectId, enabled);
        set((state) => ({
          effects: {
            ...state.effects,
            [effectId]: { ...state.effects[effectId], enabled },
          },
          activePresetId: null,
        }));
      },

      setEffectIntensity: (effectId, intensity) => {
        const nextIntensity = clamp01(intensity);
        getAudioEffectsManager().setEffectIntensity(effectId, nextIntensity);
        set((state) => ({
          effects: {
            ...state.effects,
            [effectId]: { ...state.effects[effectId], intensity: nextIntensity },
          },
          activePresetId: null,
        }));
      },

      setIsEnabled: (enabled) => {
        if (!enabled) getAudioEffectsManager().reset();
        set({ isEnabled: enabled });
      },

      resetAllEffects: () => {
        getAudioEffectsManager().reset();
        set({
          effects: cloneDefaultEffects(),
          activeScene: null,
          activePresetId: null,
          morphState: null,
          isMorphing: false,
        });
      },

      applyScene: (sceneId) => {
        const scene = EFFECT_SCENES.find((item) => item.id === sceneId);
        if (!scene) return;
        set((state) => ({
          effects: applyEffectConfig(state.effects, scene.effects),
          activeScene: scene.id,
          xyX: scene.xy.x,
          xyY: scene.xy.y,
          activePresetId: null,
        }));
      },

      clearScene: () => {
        getAudioEffectsManager().reset();
        set({ activeScene: null, xyX: 0.5, xyY: 0.5, effects: cloneDefaultEffects() });
      },

      randomize: () => {
        const ids = Object.keys(DEFAULT_EFFECTS) as AudioEffectType[];
        const picked = ids.sort(() => Math.random() - 0.5).slice(0, 3);
        const config = Object.fromEntries(
          picked.map((id) => [id, { enabled: true, intensity: 0.25 + Math.random() * 0.65 }])
        ) as Partial<Record<AudioEffectType, { enabled: boolean; intensity: number }>>;
        set((state) => ({
          effects: applyEffectConfig(state.effects, config),
          activeScene: null,
          activePresetId: null,
          xyX: Math.random(),
          xyY: Math.random(),
        }));
      },

      shuffleIntensity: () => {
        const manager = getAudioEffectsManager();
        set((state) => {
          const next = { ...state.effects };
          for (const id of Object.keys(next) as AudioEffectType[]) {
            if (!next[id].enabled) continue;
            const intensity = 0.2 + Math.random() * 0.7;
            next[id] = { ...next[id], intensity };
            manager.setEffectIntensity(id, intensity);
          }
          return { effects: next, activePresetId: null };
        });
      },

      setXY: (x, y) => {
        const nx = clamp01(x);
        const ny = clamp01(y);
        const manager = getAudioEffectsManager();
        const effects = get().effects;
        if (effects.stereoWidener.enabled) manager.setEffectIntensity("stereoWidener", nx);
        if (effects.reverb.enabled) manager.setEffectIntensity("reverb", ny);
        set({ xyX: nx, xyY: ny });
      },

      savePreset: (name) => {
        set((state) => ({
          savedPresets: [
            ...state.savedPresets,
            createLegacyPreset(name, state.effects, state.xyX, state.xyY),
          ],
        }));
      },

      loadPreset: (presetId) => {
        const preset = get().savedPresets.find((item) => item.id === presetId);
        if (!preset) return;
        set((state) => ({
          effects: applyEffectConfig(state.effects, preset.effects),
          activeScene: null,
          xyX: preset.xy?.x ?? 0.5,
          xyY: preset.xy?.y ?? 0.5,
          activePresetId: null,
        }));
      },

      deletePreset: (presetId) => {
        set((state) => ({
          savedPresets: state.savedPresets.filter((preset) => preset.id !== presetId),
        }));
      },

      morphToScene: (sceneId) => {
        get().applyScene(sceneId);
      },

      morphTo: (toId, durationMs = 800) => {
        const to = getBuiltInEffectPreset(toId);
        if (!to) return;
        const activePresetId = get().activePresetId;
        const from = activePresetId
          ? (getBuiltInEffectPreset(activePresetId) ?? BUILT_IN_EFFECT_PRESETS[0])
          : BUILT_IN_EFFECT_PRESETS[0];
        const nextPreset = morph(from, to, 1);
        set((state) => ({
          effects: applyEffectConfig(state.effects, presetToEffectConfig(nextPreset)),
          activePresetId: to.id,
          lastPresetId: to.id,
          morphState: { from, to, t: 1, durationMs },
          activeScene: null,
          isMorphing: false,
        }));
      },

      setMorphT: (t) => {
        const morphState = get().morphState;
        if (!morphState) return;
        const nextT = clamp01(t);
        const nextPreset = morph(morphState.from, morphState.to, nextT);
        set((state) => ({
          effects: applyEffectConfig(state.effects, presetToEffectConfig(nextPreset)),
          morphState: { ...morphState, t: nextT },
          activePresetId: nextT === 1 ? morphState.to.id : null,
          lastPresetId: nextT === 1 ? morphState.to.id : state.lastPresetId,
        }));
      },

      toggleLFO: () => set((state) => ({ lfoEnabled: !state.lfoEnabled })),
      setLFOSpeed: (speed) => set({ lfoSpeed: Math.max(0.1, Math.min(2, speed)) }),
      setLFODepth: (depth) => set({ lfoDepth: clamp01(depth) }),
    }),
    {
      name: "audio-effects-store-v2",
      partialize: (state) => ({
        savedPresets: state.savedPresets,
        lastPresetId: state.lastPresetId,
        lfoSpeed: state.lfoSpeed,
        lfoDepth: state.lfoDepth,
      }),
      merge: (persisted, current) => {
        const value = persisted as Partial<AudioEffectsState>;
        const lastPresetId = value.lastPresetId;
        return {
          ...current,
          savedPresets: value.savedPresets ?? current.savedPresets,
          lastPresetId: getBuiltInEffectPreset(lastPresetId ?? "") ? (lastPresetId ?? null) : null,
          activePresetId: getBuiltInEffectPreset(lastPresetId ?? "")
            ? (lastPresetId ?? null)
            : null,
          lfoSpeed: value.lfoSpeed ?? current.lfoSpeed,
          lfoDepth: value.lfoDepth ?? current.lfoDepth,
        };
      },
    }
  )
);
