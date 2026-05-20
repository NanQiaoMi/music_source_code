import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EffectPlugin, ParameterMode, RenderEngine } from "@/lib/visualization/types";

type VisualizationEffectV8 = string;

interface EffectSettingsV8 {
  [effectId: string]: Record<string, any>;
}

interface VisualizationV8State {
  currentEffect: VisualizationEffectV8;
  currentEngine: RenderEngine;
  parameterMode: ParameterMode;
  effectSettings: EffectSettingsV8;
  effects: EffectPlugin[];
  favoriteEffects: string[];
  isFullscreen: boolean;

  setCurrentEffect: (effect: VisualizationEffectV8) => void;
  setCurrentEngine: (engine: RenderEngine) => void;
  setParameterMode: (mode: ParameterMode) => void;
  updateEffectSettings: (effectId: string, settings: Record<string, any>) => void;
  resetEffectSettings: (effectId: string) => void;
  registerEffect: (effect: EffectPlugin) => void;
  toggleFavoriteEffect: (effectId: string) => void;
  toggleFullscreen: () => void;
}

export const useVisualizationV8Store = create<VisualizationV8State>()(
  persist(
    (set, _get) => ({
      currentEffect: "spectrum",
      currentEngine: "canvas",
      parameterMode: "basic",
      effectSettings: {},
      effects: [],
      favoriteEffects: [],
      isFullscreen: false,

      setCurrentEffect: (effect) => set({ currentEffect: effect }),

      setCurrentEngine: (engine) => set({ currentEngine: engine }),

      setParameterMode: (mode) => set({ parameterMode: mode }),

      updateEffectSettings: (effectId, settings) =>
        set((state) => ({
          effectSettings: {
            ...state.effectSettings,
            [effectId]: {
              ...state.effectSettings[effectId],
              ...settings,
            },
          },
        })),

      resetEffectSettings: (effectId) =>
        set((state) => {
          const effect = state.effects.find((item) => item.id === effectId);
          if (!effect) return state;

          return {
            effectSettings: {
              ...state.effectSettings,
              [effectId]: effect.parameters.reduce(
                (acc, param) => ({
                  ...acc,
                  [param.id]: param.default,
                }),
                {}
              ),
            },
          };
        }),

      registerEffect: (effect) =>
        set((state) => {
          if (!state.effects.find((e) => e.id === effect.id)) {
            return {
              effects: [...state.effects, effect],
              effectSettings: {
                ...state.effectSettings,
                [effect.id]: effect.parameters.reduce(
                  (acc, param) => ({
                    ...acc,
                    [param.id]: param.default,
                  }),
                  {}
                ),
              },
            };
          }
          return state;
        }),

      toggleFavoriteEffect: (effectId) =>
        set((state) => {
          const isFavorite = state.favoriteEffects.includes(effectId);
          return {
            favoriteEffects: isFavorite
              ? state.favoriteEffects.filter((id) => id !== effectId)
              : [effectId, ...state.favoriteEffects].slice(0, 12),
          };
        }),

      toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
    }),
    {
      name: "visualization-v8-store",
      partialize: (state) => ({
        currentEffect: state.currentEffect,
        currentEngine: state.currentEngine,
        parameterMode: state.parameterMode,
        effectSettings: state.effectSettings,
        favoriteEffects: state.favoriteEffects,
      }),
    }
  )
);
