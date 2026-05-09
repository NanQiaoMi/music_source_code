"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { useAudioStore } from "@/store/audioStore";
import { extractColorsFromImage, ThemeColors, defaultColors } from "@/utils/colorExtractor";

interface FluidBlob {
  id: number;
  size: number;
  initialX: number;
  initialY: number;
  color: string;
  blur: number;
  animationDuration: number;
  animationDelay: number;
  blendMode: GlobalCompositeOperation;
  rotateRange: number;
}

const PRIME_DURATIONS = [23, 29, 31, 37, 41];

const generateFluidBlobs = (colors: ThemeColors): FluidBlob[] => {
  const colorArray = [colors.primary, colors.secondary, colors.accent, colors.complementary];

  const blendModes: GlobalCompositeOperation[] = [
    "screen",
    "color-dodge",
    "lighten",
    "hard-light",
    "soft-light",
  ];

  return Array.from({ length: 5 }, (_, i) => {
    const baseColor = colorArray[i % colorArray.length];
    const boostedColor = boostVibrantColor(baseColor);

    return {
      id: i,
      size: 60 + Math.random() * 60,
      initialX: -20 + i * 30,
      initialY: -30 + i * 25,
      color: boostedColor,
      blur: 120 + Math.random() * 40,
      animationDuration: PRIME_DURATIONS[i % PRIME_DURATIONS.length],
      animationDelay: i * 1.7,
      blendMode: blendModes[i % blendModes.length],
      rotateRange: 0 + i * 45,
    };
  });
};

function boostVibrantColor(colorStr: string): string {
  const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return colorStr;

  const [, r, g, b] = match.map(Number);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h = 0,
    s = 0,
    l = (max + min) / 2 / 255;

  if (max !== min) {
    const d = (max - min) / 255;
    s = l > 0.5 ? d / (2 - max / 255 - min / 255) : d / (max / 255 + min / 255);

    switch (max) {
      case r:
        h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / (max - min) + 2) / 6;
        break;
      case b:
        h = ((r - g) / (max - min) + 4) / 6;
        break;
    }
  }

  s = Math.min(1, s * 1.5 + 0.2);
  l = Math.max(0.5, Math.min(0.75, l * 1.2));

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

  const newR = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const newG = Math.round(hue2rgb(p, q, h) * 255);
  const newB = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `rgb(${Math.min(255, newR)}, ${Math.min(255, newG)}, ${Math.min(255, newB)})`;
}

const FluidBlobComponent: React.FC<{
  blob: FluidBlob;
  isActive: boolean;
}> = ({ blob, isActive }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isActive) return null;

  return (
    <motion.div
      className={`absolute rounded-full pointer-events-none will-change-transform mix-blend-${blob.blendMode}`}
      style={{
        width: `${blob.size}vw`,
        height: `${blob.size}vw`,
        left: `${blob.initialX}%`,
        top: `${blob.initialY}%`,
        backgroundColor: blob.color,
        filter: `blur(${blob.blur}px)`,
        willChange: "transform, filter",
      }}
      animate={{
        x: ["-15%", "25%", "-15%"],
        y: ["-10%", "15%", "-10%"],
        scale: [1, 1.3, 0.9, 1],
        rotate: [0, blob.rotateRange, 0],
      }}
      transition={{
        duration: blob.animationDuration,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
        delay: blob.animationDelay,
        times: [0, 0.25, 0.5, 0.75, 1],
      }}
    />
  );
};

export const Background: React.FC = () => {
  const themeColors = useUIStore((state) => state.themeColors);
  const isDynamicTheme = useUIStore((state) => state.isDynamicTheme);
  const currentSong = useAudioStore((state) => state.currentSong);
  const [extractedColors, setExtractedColors] = useState<ThemeColors | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isDynamicTheme && currentSong?.cover) {
      extractColorsFromImage(currentSong.cover)
        .then((colors) => {
          setExtractedColors(colors);
          setIsActive(true);
        })
        .catch(() => {
          setExtractedColors(defaultColors);
          setIsActive(true);
        });
    } else {
      setExtractedColors(themeColors);
      setIsActive(true);
    }
  }, [currentSong?.cover, isDynamicTheme, themeColors]);

  const displayColors = extractedColors || themeColors;

  const blobs = useMemo(() => generateFluidBlobs(displayColors), [displayColors]);

  return (
    <div className="fixed inset-0 -z-50 overflow-hidden bg-[#0a0a0c]">
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% 0%, ${displayColors.background} 0%, transparent 70%),
            radial-gradient(ellipse 100% 60% at 80% 100%, ${displayColors.surface} 0%, transparent 60%),
            radial-gradient(ellipse 80% 50% at 0% 80%, rgba(0,0,0,0.4) 0%, transparent 50%)
          `,
          opacity: 0.7,
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />

      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle 800px at 20% 20%, ${displayColors.primary} 0%, transparent 70%),
            radial-gradient(circle 600px at 80% 30%, ${displayColors.secondary} 0%, transparent 60%),
            radial-gradient(circle 500px at 50% 70%, ${displayColors.accent} 0%, transparent 50%),
            radial-gradient(circle 400px at 10% 80%, ${displayColors.complementary} 0%, transparent 50%)
          `,
          opacity: 0.12,
          filter: "blur(100px)",
          mixBlendMode: "screen",
          willChange: "opacity",
          contain: "strict",
        }}
      />

      {blobs.map((blob) => (
        <FluidBlobComponent key={blob.id} blob={blob} isActive={isActive} />
      ))}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 150% 80% at 50% -30%, rgba(255,255,255,0.05) 0%, transparent 50%)",
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 100% 50% at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 60%)",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.018] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};
