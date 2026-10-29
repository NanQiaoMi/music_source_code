import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BUILT_IN_EFFECT_PRESETS, getBuiltInEffectPreset, morph } from "@/lib/audio/effectsPresets";
import { getAudioEffectsManager } from "@/lib/audio/AudioEffectsManager";
import {
  DEFAULT_EFFECTS,
  EFFECT_SCENES,
  clamp01,
  cloneDefaultEffects,
  createLegacyPreset,
  presetToEffectConfig,
} from "./audioEffects/helpers";
import type { AudioEffect, AudioEffectType, AudioEffectsState } from "./audioEffects/helpers";

export { EFFECT_SCENES } from "./audioEffects/helpers";
export type {
  AudioEffect,
  AudioEffectType,
  EffectScene,
  LegacyEffectPreset,
  MorphState,
} from "./audioEffects/helpers";
function applyEffectConfig(
  base: Record<AudioEffectType, AudioEffect>,
  config: Partial<Record<AudioEffectType, { enabled: boolean; intensity: number }>>
): Record<AudioEffectType, AudioEffect> {
  const next = cloneDefaultEffects();
  const manager = getAudioEffectsManager();
  for (const id of Object.keys(next) as AudioEffectType[]) {
    const enabled = config[id]?.enabled ?? false;
    const intensity = clamp01(config[id]?.intensity ?? base[id].intensity);
    next[id] = { ...next[id], enabled, intensity };
    manager.setEffectEnabled(id, enabled);
    manager.setEffectIntensity(id, intensity);
    manager.commitEffectIntensity(id);
  }
  return next;
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

      commitEffectIntensity: (effectId) => getAudioEffectsManager().commitEffectIntensity(effectId),

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
            manager.commitEffectIntensity(id);
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
      skipHydration: true,
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
