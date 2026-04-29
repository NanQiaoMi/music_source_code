"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

const DEFAULT_COLORS: ThemeColors = {
  primary: "rgba(0, 0, 0, 0.9)",
  secondary: "rgba(20, 20, 30, 0.8)",
  accent: "rgba(100, 100, 120, 0.6)",
};

export const useAlbumTheme = (coverUrl?: string) => {
  const [themeColors, setThemeColors] = useState<ThemeColors>(DEFAULT_COLORS);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const extractColors = useCallback((url: string) => {
    return new Promise<ThemeColors>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          resolve(DEFAULT_COLORS);
          return;
        }

        const size = 50;
        canvas.width = size;
        canvas.height = size;

        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        const colorCounts = new Map<string, number>();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 128) continue;

          const key = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`;
          colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
        }

        const sortedColors = Array.from(colorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        if (sortedColors.length >= 3) {
          const parseColor = (colorStr: string) => {
            const [r, g, b] = colorStr.split(",").map(Number);
            return { r, g, b };
          };

          const primaryColor = parseColor(sortedColors[0][0]);
          const secondaryColor = parseColor(sortedColors[1][0]);
          const accentColor = parseColor(sortedColors[2][0]);

          const darken = (c: { r: number; g: number; b: number }, factor: number) => ({
            r: Math.round(c.r * factor),
            g: Math.round(c.g * factor),
            b: Math.round(c.b * factor),
          });

          const darkPrimary = darken(primaryColor, 0.3);
          const darkSecondary = darken(secondaryColor, 0.4);
          const darkAccent = darken(accentColor, 0.5);

          resolve({
            primary: `rgba(${darkPrimary.r}, ${darkPrimary.g}, ${darkPrimary.b}, 0.95)`,
            secondary: `rgba(${darkSecondary.r}, ${darkSecondary.g}, ${darkSecondary.b}, 0.85)`,
            accent: `rgba(${darkAccent.r}, ${darkAccent.g}, ${darkAccent.b}, 0.7)`,
          });
        } else {
          resolve(DEFAULT_COLORS);
        }
      };

      img.onerror = () => {
        resolve(DEFAULT_COLORS);
      };

      img.src = url;
    });
  }, []);

  useEffect(() => {
    if (!coverUrl) {
      setThemeColors(DEFAULT_COLORS);
      return;
    }

    const loadColors = async () => {
      setIsLoading(true);
      try {
        const colors = await extractColors(coverUrl);
        setThemeColors(colors);
      } catch (error) {
        console.error("Failed to extract colors:", error);
        setThemeColors(DEFAULT_COLORS);
      } finally {
        setIsLoading(false);
      }
    };

    loadColors();
  }, [coverUrl, extractColors]);

  return {
    themeColors,
    isLoading,
  };
};
