import { useEffect, useCallback, useRef } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { useThemeStore } from "@/store/themeStore";
import { THEME_TRANSITION_DURATION_MS, useThemeVars } from "@/hooks/useThemeVars";
import { extractColorsFromImage, ThemeColors, defaultColors } from "@/utils/colorExtractor";

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
  const themeColors = useThemeStore((state) => state.themeColors);
  const isDynamicTheme = useThemeStore((state) => state.isDynamicTheme);
  const setThemeColors = useThemeStore((state) => state.setThemeColors);
  const themeMode = useThemeStore((state) => state.themeMode);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // S6-7: html class 与 --theme-* CSS 变量只在 useThemeVars 里写入（唯一写入方）。
  useThemeVars();

  const applyColors = useCallback(
    (toColors: ThemeColors) => {
      // 唯一状态写入：themeStore。uiStore 的 themeColors 只是 ui-store-v2 的持久化投影。
      setThemeColors(toColors);
    },
    [setThemeColors]
  );

  const extractThemeColors = useCallback(
    async (imageUrl: string | undefined) => {
      if (!isDynamicTheme || !imageUrl) {
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 350ms 防抖：等切歌 3D 物理弹簧运动完全就绪后再执行，绝不抢占动画关键帧的第一毫秒 CPU
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const colors = await extractColorsFromImage(imageUrl);
          applyColors(boostVibrantColors(colors));
        } catch (error) {
          console.error("Failed to extract theme colors:", error);
          applyColors(defaultColors);
        }
      }, 350);
    },
    [applyColors, isDynamicTheme]
  );

  useEffect(() => {
    extractThemeColors(currentSong?.cover);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentSong?.cover, extractThemeColors]);

  return {
    themeColors,
    isDynamicTheme,
    themeMode,
    extractThemeColors,
    transitionDuration: THEME_TRANSITION_DURATION_MS,
  };
}
