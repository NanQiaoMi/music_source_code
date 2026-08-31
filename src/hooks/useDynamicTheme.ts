import { useEffect, useCallback, useRef } from "react";
import { useUIStore } from "@/store/uiStore";
import { useAudioStore } from "@/store/audioStore";
import {
  extractColorsFromImage,
  ThemeColors,
  defaultColors,
  lightModeColors,
} from "@/utils/colorExtractor";

const TRANSITION_DURATION = 1000;

function purifyDullColor(colorStr: string): string {
  const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return colorStr;

  const [, r, g, b] = match.map(Number);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  if (brightness < 60) {
    const boost = Math.min(2.5, 140 / Math.max(1, brightness));
    return `rgb(${Math.min(255, Math.round(r * boost))}, ${Math.min(255, Math.round(g * boost))}, ${Math.min(255, Math.round(b * boost))})`;
  }

  return colorStr;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h, s, l };
}

function boostVibrantColors(colors: ThemeColors): ThemeColors {
  const boostSaturation = (
    colorStr: string,
    saturationBoost: number = 1.5,
    lightnessBoost: number = 1.2
  ): string => {
    const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return colorStr;

    const [, r, g, b] = match.map(Number);
    const { h, s, l } = rgbToHsl(r, g, b);

    const newS = Math.min(1, s * saturationBoost + 0.15);
    const newL = Math.max(0.45, Math.min(0.72, l * lightnessBoost));

    const { r: newR, g: newG, b: newB } = hslToRgb(h, newS, newL);
    return `rgb(${newR}, ${newG}, ${newB})`;
  };

  const boostDarkColor = (colorStr: string): string => {
    const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return colorStr;

    const [, r, g, b] = match.map(Number);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    if (brightness < 80) {
      const boost = 130 / Math.max(1, brightness);
      return `rgb(${Math.min(255, Math.round(r * boost))}, ${Math.min(255, Math.round(g * boost))}, ${Math.min(255, Math.round(b * boost))})`;
    }

    return colorStr;
  };

  return {
    primary: purifyDullColor(boostSaturation(colors.primary, 1.6, 1.25)),
    secondary: purifyDullColor(boostSaturation(colors.secondary, 1.5, 1.2)),
    accent: purifyDullColor(boostSaturation(colors.accent, 1.55, 1.22)),
    complementary: purifyDullColor(boostSaturation(colors.complementary, 1.45, 1.18)),
    background: boostDarkColor(colors.background),
    surface: boostDarkColor(colors.surface),
    gradient: colors.gradient.map((c, i) =>
      purifyDullColor(boostSaturation(c, i === 0 ? 1.6 : i === 1 ? 1.5 : 1.55, 1.2))
    ),
    text: colors.text,
    textMuted: colors.textMuted,
  };
}

export function useDynamicTheme() {
  const { themeColors, isDynamicTheme, setThemeColors, themeMode } = useUIStore();
  const currentSong = useAudioStore((state) => state.currentSong);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentColorsRef = useRef<ThemeColors>(defaultColors);

  const applyThemeColors = useCallback(
    (toColors: ThemeColors) => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;

      root.style.setProperty("--theme-primary", toColors.primary);
      root.style.setProperty("--theme-secondary", toColors.secondary);
      root.style.setProperty("--theme-accent", toColors.accent);
      root.style.setProperty("--theme-complementary", toColors.complementary);
      root.style.setProperty("--theme-background", toColors.background);
      root.style.setProperty("--theme-surface", toColors.surface);
      root.style.setProperty("--theme-text", toColors.text);
      root.style.setProperty("--theme-text-muted", toColors.textMuted);
      root.style.setProperty(
        "--theme-gradient",
        `linear-gradient(135deg, ${toColors.primary}, ${toColors.secondary}, ${toColors.accent})`
      );

      setThemeColors(toColors);
      currentColorsRef.current = toColors;
    },
    [setThemeColors]
  );

  const extractThemeColors = useCallback(
    async (imageUrl: string | undefined) => {
      if (!isDynamicTheme || !imageUrl) {
        return;
      }

      try {
        const colors = await extractColorsFromImage(imageUrl);
        const vibrantColors = boostVibrantColors(colors);
        applyThemeColors(vibrantColors);
      } catch (error) {
        console.error("Failed to extract theme colors:", error);
        applyThemeColors(defaultColors);
      }
    },
    [applyThemeColors, isDynamicTheme]
  );

  useEffect(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    // 350ms 防抖，在切歌动画就绪后才提取色彩，杜绝切歌瞬间的主线程竞争
    transitionTimeoutRef.current = setTimeout(() => {
      extractThemeColors(currentSong?.cover);
    }, 350);

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [currentSong?.cover, extractThemeColors]);

  useEffect(() => {
    const root = document.documentElement;

    const applyThemeMode = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark");
        root.classList.remove("light");
        root.style.setProperty("--theme-bg-primary", "#000000");
        root.style.setProperty("--theme-bg-secondary", "#121212");
        root.style.setProperty("--theme-bg-tertiary", "#1c1c1e");
        root.style.setProperty("--theme-bg-elevated", "#2c2c2e");
        root.style.setProperty("--theme-text-primary", "#ffffff");
        root.style.setProperty("--theme-text-secondary", "rgba(255,255,255,0.6)");
        root.style.setProperty("--theme-glass-bg", "rgba(28,28,30,0.7)");
        root.style.setProperty("--theme-glass-border", "rgba(255,255,255,0.1)");
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
        root.style.setProperty("--theme-bg-primary", "#f5f5f7");
        root.style.setProperty("--theme-bg-secondary", "#ffffff");
        root.style.setProperty("--theme-bg-tertiary", "#f2f2f7");
        root.style.setProperty("--theme-bg-elevated", "#ffffff");
        root.style.setProperty("--theme-text-primary", "#1c1c1e");
        root.style.setProperty("--theme-text-secondary", "rgba(28,28,30,0.6)");
        root.style.setProperty("--theme-glass-bg", "rgba(255,255,255,0.7)");
        root.style.setProperty("--theme-glass-border", "rgba(0,0,0,0.1)");
      }
    };

    if (themeMode === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        applyThemeMode(mediaQuery.matches);
      };
      handleChange();
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      applyThemeMode(themeMode === "dark");
    }
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--theme-transition-duration", `${TRANSITION_DURATION}ms`);

    root.style.setProperty("--theme-primary", defaultColors.primary);
    const isDark =
      themeMode === "dark" ||
      (themeMode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const defaultTheme = isDark ? defaultColors : lightModeColors;

    root.style.setProperty("--theme-secondary", defaultTheme.secondary);
    root.style.setProperty("--theme-accent", defaultTheme.accent);
    root.style.setProperty(
      "--theme-complementary",
      defaultTheme.complementary || "rgb(72, 236, 153)"
    );
    root.style.setProperty("--theme-background", defaultTheme.background);
    root.style.setProperty("--theme-surface", defaultTheme.surface);
    root.style.setProperty("--theme-text", defaultTheme.text);
    root.style.setProperty("--theme-text-muted", defaultTheme.textMuted);
    root.style.setProperty(
      "--theme-gradient",
      `linear-gradient(135deg, ${defaultTheme.gradient.join(", ")})`
    );
  }, [themeMode]);

  return {
    themeColors,
    isDynamicTheme,
    themeMode,
    extractThemeColors,
    transitionDuration: TRANSITION_DURATION,
  };
}

export function useCSSVariables() {
  const { themeColors } = useUIStore();

  return {
    "--theme-primary": themeColors.primary,
    "--theme-secondary": themeColors.secondary,
    "--theme-accent": themeColors.accent,
    "--theme-background": themeColors.background,
    "--theme-surface": themeColors.surface,
    "--theme-text": themeColors.text,
    "--theme-text-muted": themeColors.textMuted,
    "--theme-gradient":
      themeColors.gradient.length >= 2
        ? `linear-gradient(135deg, ${themeColors.gradient.join(", ")})`
        : themeColors.primary,
  } as React.CSSProperties;
}
