// S6-12n: pure types, defaults and preset tables moved to ./visualSettings/* so this store
// stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  BUILT_IN_THEME_PRESETS,
  defaultVisualSettings,
  type Theme,
  type ThemeColors,
  type ThemeConfig,
  type ThemePreset,
  type VisualSettings,
} from "./visualSettings/helpers";
import { DEFAULT_THEMES } from "./visualSettings/themePresets";

export type { Theme, ThemeColors, ThemeConfig, ThemePreset, VisualSettings };
export { BUILT_IN_THEME_PRESETS, DEFAULT_THEMES, defaultVisualSettings };

interface VisualSettingsState extends VisualSettings {
  setBlurIntensity: (value: number) => void;
  setShadowDepth: (value: number) => void;
  setAnimationSpeed: (value: number) => void;
  setPerspectiveIntensity: (value: number) => void;
  setVisualMode: (mode: "light" | "heavy" | "minimal") => void;
  setVisualSettings: (settings: Partial<VisualSettings>) => void;
  resetSettings: () => void;

  setCurrentTheme: (theme: ThemePreset) => void;
  getCurrentTheme: () => Theme;
  setCustomTheme: (colors: ThemeColors) => void;
  resetCustomTheme: () => void;

  setBackgroundImage: (image: string | undefined) => void;
  setBackgroundBlur: (blur: number) => void;
  setBackgroundOpacity: (opacity: number) => void;

  setFollowSystemTheme: (enabled: boolean) => void;
  setAutoDayNight: (enabled: boolean) => void;

  getAllThemes: () => Theme[];

  customThemes: ThemeConfig[];
  exportCurrentTheme: (name: string) => string;
  importTheme: (jsonString: string) => boolean;
  applyTheme: (theme: ThemeConfig) => void;
  deleteCustomTheme: (themeName: string) => void;
  getBuiltInThemes: () => ThemeConfig[];
}

export const useVisualSettingsStore = create<VisualSettingsState>()(
  persist(
    (set, get) => ({
      ...defaultVisualSettings,

      setBlurIntensity: (value) => set({ blurIntensity: value }),
      setShadowDepth: (value) => set({ shadowDepth: value }),
      setAnimationSpeed: (value) => set({ animationSpeed: value }),
      setPerspectiveIntensity: (value) => set({ perspectiveIntensity: value }),
      setVisualMode: (mode) => set({ visualMode: mode }),
      setVisualSettings: (settings) => set((state) => ({ ...state, ...settings })),
      resetSettings: () => set(defaultVisualSettings),

      setCurrentTheme: (theme) => set({ currentTheme: theme }),

      getCurrentTheme: () => {
        const { currentTheme, customTheme } = get();
        if (currentTheme === "custom" && customTheme) {
          return {
            id: "custom",
            name: "自定义",
            nameEn: "Custom",
            colors: customTheme,
            isDark: false,
          };
        }
        return DEFAULT_THEMES.find((t) => t.id === currentTheme) || DEFAULT_THEMES[1];
      },

      setCustomTheme: (colors) => set({ customTheme: colors, currentTheme: "custom" }),
      resetCustomTheme: () => set({ customTheme: undefined, currentTheme: "dark" }),

      setBackgroundImage: (image) => set({ backgroundImage: image }),
      setBackgroundBlur: (blur) => set({ backgroundBlur: Math.max(0, Math.min(50, blur)) }),
      setBackgroundOpacity: (opacity) =>
        set({ backgroundOpacity: Math.max(0, Math.min(1, opacity)) }),

      setFollowSystemTheme: (enabled) => set({ followSystemTheme: enabled }),
      setAutoDayNight: (enabled) => set({ autoDayNight: enabled }),

      getAllThemes: () => DEFAULT_THEMES,

      customThemes: [],

      exportCurrentTheme: (name: string) => {
        const state = get();
        const currentTheme = state.getCurrentTheme();
        const config: ThemeConfig = {
          name,
          version: "1.0",
          colors: {
            primary: currentTheme.colors.primary,
            secondary: currentTheme.colors.secondary,
            accent: currentTheme.colors.accent,
            background: currentTheme.colors.background,
            surface: currentTheme.colors.surface,
            text: currentTheme.colors.text,
          },
          glassOpacity: 0.3,
          blurIntensity: state.blurIntensity,
        };
        const existing = get().customThemes.findIndex((t) => t.name === name);
        if (existing >= 0) {
          const updated = [...get().customThemes];
          updated[existing] = config;
          set({ customThemes: updated });
        } else {
          set({ customThemes: [...get().customThemes, config] });
        }
        return JSON.stringify(config, null, 2);
      },

      importTheme: (jsonString: string) => {
        try {
          const parsed = JSON.parse(jsonString);
          if (!parsed.colors || !parsed.name) return false;
          const colors = parsed.colors;
          const requiredKeys = ["primary", "secondary", "accent", "background", "surface", "text"];
          for (const key of requiredKeys) {
            if (typeof colors[key] !== "string") return false;
          }
          get().setCustomTheme(colors as ThemeColors);
          return true;
        } catch {
          return false;
        }
      },

      applyTheme: (theme: ThemeConfig) => {
        get().setCustomTheme(theme.colors as ThemeColors);
      },

      deleteCustomTheme: (themeName: string) => {
        set({
          customThemes: get().customThemes.filter((t) => t.name !== themeName),
        });
      },

      getBuiltInThemes: () => BUILT_IN_THEME_PRESETS,
    }),
    {
      skipHydration: true,
      name: "visual-settings-v4",
      partialize: (state) => ({
        blurIntensity: state.blurIntensity,
        shadowDepth: state.shadowDepth,
        animationSpeed: state.animationSpeed,
        perspectiveIntensity: state.perspectiveIntensity,
        visualMode: state.visualMode,
        currentTheme: state.currentTheme,
        customTheme: state.customTheme,
        backgroundImage: state.backgroundImage,
        backgroundBlur: state.backgroundBlur,
        backgroundOpacity: state.backgroundOpacity,
        followSystemTheme: state.followSystemTheme,
        autoDayNight: state.autoDayNight,
        customThemes: state.customThemes,
      }),
    }
  )
);
