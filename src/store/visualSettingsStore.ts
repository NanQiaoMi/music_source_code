import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreset =
  | "light"
  | "dark"
  | "oled"
  | "minimal-white"
  | "minimal-dark"
  | "aurora"
  | "sunset"
  | "ocean"
  | "forest"
  | "sunrise"
  | "midnight"
  | "candy"
  | "neon"
  | "pastel"
  | "coffee"
  | "lavender"
  | "autumn"
  | "winter"
  | "spring"
  | "summer"
  | "custom";

export interface ThemeConfig {
  name: string;
  version: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  glassOpacity?: number;
  blurIntensity?: number;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
}

export interface Theme {
  id: ThemePreset;
  name: string;
  nameEn: string;
  colors: ThemeColors;
  isDark: boolean;
}

export const DEFAULT_THEMES: Theme[] = [
  {
    id: "light",
    name: "浅色",
    nameEn: "Light",
    colors: {
      primary: "#6366f1",
      secondary: "#8b5cf6",
      accent: "#ec4899",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#1e293b",
      textSecondary: "#64748b",
      border: "#e2e8f0",
    },
    isDark: false,
  },
  {
    id: "dark",
    name: "深色",
    nameEn: "Dark",
    colors: {
      primary: "#818cf8",
      secondary: "#a78bfa",
      accent: "#f472b6",
      background: "#0f172a",
      surface: "#1e293b",
      text: "#f1f5f9",
      textSecondary: "#94a3b8",
      border: "#334155",
    },
    isDark: true,
  },
  {
    id: "oled",
    name: "OLED纯黑",
    nameEn: "OLED Black",
    colors: {
      primary: "#818cf8",
      secondary: "#a78bfa",
      accent: "#f472b6",
      background: "#000000",
      surface: "#000000",
      text: "#ffffff",
      textSecondary: "#a1a1aa",
      border: "#27272a",
    },
    isDark: true,
  },
  {
    id: "minimal-white",
    name: "极简白",
    nameEn: "Minimal White",
    colors: {
      primary: "#171717",
      secondary: "#525252",
      accent: "#a3a3a3",
      background: "#ffffff",
      surface: "#ffffff",
      text: "#171717",
      textSecondary: "#737373",
      border: "#e5e5e5",
    },
    isDark: false,
  },
  {
    id: "minimal-dark",
    name: "极简黑",
    nameEn: "Minimal Dark",
    colors: {
      primary: "#ffffff",
      secondary: "#a1a1aa",
      accent: "#71717a",
      background: "#09090b",
      surface: "#18181b",
      text: "#fafafa",
      textSecondary: "#a1a1aa",
      border: "#27272a",
    },
    isDark: true,
  },
  {
    id: "aurora",
    name: "极光",
    nameEn: "Aurora",
    colors: {
      primary: "#10b981",
      secondary: "#06b6d4",
      accent: "#8b5cf6",
      background: "#020617",
      surface: "#0f172a",
      text: "#e0f2fe",
      textSecondary: "#7dd3fc",
      border: "#1e3a8a",
    },
    isDark: true,
  },
  {
    id: "sunset",
    name: "日落",
    nameEn: "Sunset",
    colors: {
      primary: "#f97316",
      secondary: "#ef4444",
      accent: "#fbbf24",
      background: "#1c1917",
      surface: "#292524",
      text: "#fef3c7",
      textSecondary: "#fdba74",
      border: "#78350f",
    },
    isDark: true,
  },
  {
    id: "ocean",
    name: "海洋",
    nameEn: "Ocean",
    colors: {
      primary: "#0ea5e9",
      secondary: "#06b6d4",
      accent: "#14b8a6",
      background: "#0c4a6e",
      surface: "#075985",
      text: "#e0f2fe",
      textSecondary: "#7dd3fc",
      border: "#0369a1",
    },
    isDark: true,
  },
  {
    id: "forest",
    name: "森林",
    nameEn: "Forest",
    colors: {
      primary: "#22c55e",
      secondary: "#84cc16",
      accent: "#16a34a",
      background: "#052e16",
      surface: "#14532d",
      text: "#dcfce7",
      textSecondary: "#86efac",
      border: "#166534",
    },
    isDark: true,
  },
  {
    id: "sunrise",
    name: "日出",
    nameEn: "Sunrise",
    colors: {
      primary: "#f59e0b",
      secondary: "#fb923c",
      accent: "#fbbf24",
      background: "#fffbeb",
      surface: "#fef3c7",
      text: "#78350f",
      textSecondary: "#a16207",
      border: "#fde68a",
    },
    isDark: false,
  },
  {
    id: "midnight",
    name: "午夜",
    nameEn: "Midnight",
    colors: {
      primary: "#6366f1",
      secondary: "#8b5cf6",
      accent: "#ec4899",
      background: "#020617",
      surface: "#0f172a",
      text: "#e0e7ff",
      textSecondary: "#a5b4fc",
      border: "#3730a3",
    },
    isDark: true,
  },
  {
    id: "candy",
    name: "糖果",
    nameEn: "Candy",
    colors: {
      primary: "#ec4899",
      secondary: "#f472b6",
      accent: "#f97316",
      background: "#fdf2f8",
      surface: "#fce7f3",
      text: "#831843",
      textSecondary: "#be185d",
      border: "#fbcfe8",
    },
    isDark: false,
  },
  {
    id: "neon",
    name: "霓虹",
    nameEn: "Neon",
    colors: {
      primary: "#22d3ee",
      secondary: "#a855f7",
      accent: "#22c55e",
      background: "#030014",
      surface: "#0f0a1f",
      text: "#e0f2fe",
      textSecondary: "#a5f3fc",
      border: "#1e1b4b",
    },
    isDark: true,
  },
  {
    id: "pastel",
    name: "粉彩",
    nameEn: "Pastel",
    colors: {
      primary: "#f472b6",
      secondary: "#a78bfa",
      accent: "#60a5fa",
      background: "#fef7ff",
      surface: "#fdf4ff",
      text: "#581c87",
      textSecondary: "#7c3aed",
      border: "#f5d0fe",
    },
    isDark: false,
  },
  {
    id: "coffee",
    name: "咖啡",
    nameEn: "Coffee",
    colors: {
      primary: "#a16207",
      secondary: "#d97706",
      accent: "#ea580c",
      background: "#fef3c7",
      surface: "#fde68a",
      text: "#451a03",
      textSecondary: "#78350f",
      border: "#fcd34d",
    },
    isDark: false,
  },
  {
    id: "lavender",
    name: "薰衣草",
    nameEn: "Lavender",
    colors: {
      primary: "#8b5cf6",
      secondary: "#a78bfa",
      accent: "#c084fc",
      background: "#faf5ff",
      surface: "#f3e8ff",
      text: "#581c87",
      textSecondary: "#7c3aed",
      border: "#e9d5ff",
    },
    isDark: false,
  },
  {
    id: "autumn",
    name: "秋日",
    nameEn: "Autumn",
    colors: {
      primary: "#ea580c",
      secondary: "#dc2626",
      accent: "#ca8a04",
      background: "#fff7ed",
      surface: "#ffedd5",
      text: "#7c2d12",
      textSecondary: "#c2410c",
      border: "#fed7aa",
    },
    isDark: false,
  },
  {
    id: "winter",
    name: "冬日",
    nameEn: "Winter",
    colors: {
      primary: "#0ea5e9",
      secondary: "#06b6d4",
      accent: "#22d3ee",
      background: "#f0f9ff",
      surface: "#e0f2fe",
      text: "#0c4a6e",
      textSecondary: "#0369a1",
      border: "#bae6fd",
    },
    isDark: false,
  },
  {
    id: "spring",
    name: "春日",
    nameEn: "Spring",
    colors: {
      primary: "#22c55e",
      secondary: "#84cc16",
      accent: "#4ade80",
      background: "#f0fdf4",
      surface: "#dcfce7",
      text: "#14532d",
      textSecondary: "#166534",
      border: "#bbf7d0",
    },
    isDark: false,
  },
  {
    id: "summer",
    name: "夏日",
    nameEn: "Summer",
    colors: {
      primary: "#f59e0b",
      secondary: "#f97316",
      accent: "#facc15",
      background: "#fffbeb",
      surface: "#fef3c7",
      text: "#78350f",
      textSecondary: "#a16207",
      border: "#fde68a",
    },
    isDark: false,
  },
];

export const BUILT_IN_THEME_PRESETS: ThemeConfig[] = [
  {
    name: "极光紫",
    version: "1.0",
    colors: {
      primary: "oklch(60% 0.25 300)",
      secondary: "oklch(50% 0.2 280)",
      accent: "oklch(65% 0.25 0)",
      background: "oklch(0% 0.005 240)",
      surface: "oklch(15% 0.01 240)",
      text: "oklch(100% 0.005 240)",
    },
    glassOpacity: 0.3,
    blurIntensity: 20,
  },
  {
    name: "赛博蓝",
    version: "1.0",
    colors: {
      primary: "oklch(55% 0.2 240)",
      secondary: "oklch(45% 0.18 220)",
      accent: "oklch(70% 0.15 180)",
      background: "oklch(0% 0.005 220)",
      surface: "oklch(12% 0.01 230)",
      text: "oklch(100% 0.005 220)",
    },
    glassOpacity: 0.25,
    blurIntensity: 25,
  },
  {
    name: "霓虹粉",
    version: "1.0",
    colors: {
      primary: "oklch(65% 0.3 350)",
      secondary: "oklch(55% 0.25 330)",
      accent: "oklch(75% 0.25 60)",
      background: "oklch(0% 0.005 350)",
      surface: "oklch(12% 0.01 350)",
      text: "oklch(100% 0.005 350)",
    },
    glassOpacity: 0.3,
    blurIntensity: 22,
  },
  {
    name: "暗夜金",
    version: "1.0",
    colors: {
      primary: "oklch(65% 0.18 80)",
      secondary: "oklch(55% 0.15 70)",
      accent: "oklch(75% 0.2 50)",
      background: "oklch(0% 0.005 60)",
      surface: "oklch(14% 0.01 60)",
      text: "oklch(100% 0.005 60)",
    },
    glassOpacity: 0.2,
    blurIntensity: 18,
  },
  {
    name: "翡翠绿",
    version: "1.0",
    colors: {
      primary: "oklch(60% 0.2 160)",
      secondary: "oklch(50% 0.18 150)",
      accent: "oklch(70% 0.2 140)",
      background: "oklch(0% 0.005 160)",
      surface: "oklch(13% 0.01 160)",
      text: "oklch(100% 0.005 160)",
    },
    glassOpacity: 0.25,
    blurIntensity: 20,
  },
];

export interface VisualSettings {
  blurIntensity: number;
  shadowDepth: number;
  animationSpeed: number;
  perspectiveIntensity: number;
  visualMode: "light" | "heavy" | "minimal";
  currentTheme: ThemePreset;
  customTheme?: ThemeColors;
  backgroundImage?: string;
  backgroundBlur: number;
  backgroundOpacity: number;
  followSystemTheme: boolean;
  autoDayNight: boolean;
}

export const defaultVisualSettings: VisualSettings = {
  blurIntensity: 20,
  shadowDepth: 15,
  animationSpeed: 1.0,
  perspectiveIntensity: 800,
  visualMode: "light",
  currentTheme: "dark",
  customTheme: undefined,
  backgroundImage: undefined,
  backgroundBlur: 20,
  backgroundOpacity: 0.8,
  followSystemTheme: false,
  autoDayNight: false,
};

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
