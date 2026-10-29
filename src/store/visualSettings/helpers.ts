// S6-12n: store-free visual-settings types, defaults and built-in theme presets live here
// so visualSettingsStore.ts stays inside the 400-line store budget
// (scripts/check-store-budgets.mjs). The store re-exports every public type and table below,
// so its public surface is unchanged.
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
