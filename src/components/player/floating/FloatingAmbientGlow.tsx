"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useEmotionStore } from "@/store/emotionStore";

export interface FloatingAmbientGlowProps {
  /** Optional container class name */
  className?: string;
  /** Border radius class, e.g. "rounded-full" or "rounded-[28px]" */
  rounded?: string;
  /** Whether to enable the perimeter border beam effect */
  borderBeam?: boolean;
  /** Beam size in pixels/percentage */
  beamSize?: number;
  /** Glow intensity multiplier (0 to 2, default 1.0) */
  intensity?: number;
  /** Glow spread blur in px (default 48) */
  glowSpread?: number;
  /** Custom fallback colors [primary, secondary, accent] */
  fallbackColors?: [string, string, string];
  /** Optional nested children */
  children?: React.ReactNode;
}

const DEFAULT_GRADIENT_PALETTES: Record<string, [string, string, string]> = {
  default: ["rgba(168, 85, 247, 0.65)", "rgba(59, 130, 246, 0.6)", "rgba(236, 72, 153, 0.55)"],
  warmJoy: ["rgba(249, 115, 22, 0.7)", "rgba(236, 72, 153, 0.65)", "rgba(234, 179, 8, 0.6)"],
  calmSerene: ["rgba(6, 182, 212, 0.65)", "rgba(59, 130, 246, 0.6)", "rgba(16, 185, 129, 0.55)"],
  melancholy: ["rgba(99, 102, 241, 0.7)", "rgba(139, 92, 246, 0.65)", "rgba(51, 65, 85, 0.6)"],
  energetic: ["rgba(239, 68, 68, 0.75)", "rgba(245, 158, 11, 0.7)", "rgba(217, 70, 239, 0.65)"],
};

export const FloatingAmbientGlow: React.FC<FloatingAmbientGlowProps> = ({
  className = "",
  rounded = "rounded-[28px]",
  borderBeam = true,
  beamSize: _beamSize = 140,
  intensity = 1.0,
  glowSpread = 48,
  fallbackColors,
  children,
}) => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentSong = useAudioStore((state) => state.currentSong);

  // Emotion store coordinates
  const realtimeCoordinates = useEmotionStore((state) => state.realtimeCoordinates);
  const globalEmotion = useEmotionStore((state) => state.globalEmotion);
  const emotionMap = useEmotionStore((state) => state.emotionMap);

  // Derived valence (-1 to 1) and arousal (-1 to 1)
  const currentEmotion = useMemo(() => {
    if (realtimeCoordinates) {
      return { x: realtimeCoordinates.x, y: realtimeCoordinates.y };
    }
    if (currentSong?.id && emotionMap[currentSong.id]) {
      return { x: emotionMap[currentSong.id].x, y: emotionMap[currentSong.id].y };
    }
    if (globalEmotion) {
      return { x: globalEmotion.x, y: globalEmotion.y };
    }
    return { x: 0.2, y: 0.3 };
  }, [realtimeCoordinates, currentSong?.id, emotionMap, globalEmotion]);

  // Color extraction from cover art
  const [extractedColors, setExtractedColors] = useState<[string, string, string] | null>(null);

  useEffect(() => {
    if (!currentSong?.cover || typeof window === "undefined") {
      setExtractedColors(null);
      return;
    }

    let isMounted = true;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = currentSong.cover;

    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;

        let r1 = 0, g1 = 0, b1 = 0, count1 = 0;
        let r2 = 0, g2 = 0, b2 = 0, count2 = 0;
        let r3 = 0, g3 = 0, b3 = 0, count3 = 0;

        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;

          // Bucket pixels into quadrants for color variation
          const index = (i / 16) % 3;
          if (index === 0) {
            r1 += r; g1 += g; b1 += b; count1++;
          } else if (index === 1) {
            r2 += r; g2 += g; b2 += b; count2++;
          } else {
            r3 += r; g3 += g; b3 += b; count3++;
          }
        }

        const c1 = count1 > 0 ? `rgba(${Math.round(r1 / count1)}, ${Math.round(g1 / count1)}, ${Math.round(b1 / count1)}, 0.65)` : DEFAULT_GRADIENT_PALETTES.default[0];
        const c2 = count2 > 0 ? `rgba(${Math.round(r2 / count2)}, ${Math.round(g2 / count2)}, ${Math.round(b2 / count2)}, 0.6)` : DEFAULT_GRADIENT_PALETTES.default[1];
        const c3 = count3 > 0 ? `rgba(${Math.round(r3 / count3)}, ${Math.round(g3 / count3)}, ${Math.round(b3 / count3)}, 0.55)` : DEFAULT_GRADIENT_PALETTES.default[2];

        setExtractedColors([c1, c2, c3]);
      } catch {
        setExtractedColors(null);
      }
    };

    img.onerror = () => {
      if (isMounted) setExtractedColors(null);
    };

    return () => {
      isMounted = false;
    };
  }, [currentSong?.cover]);

  // Dynamic colors combined with emotion valence shift
  const activePalette = useMemo<[string, string, string]>(() => {
    if (fallbackColors) return fallbackColors;
    if (extractedColors) return extractedColors;

    const { x, y } = currentEmotion;
    if (x > 0.3 && y > 0.2) return DEFAULT_GRADIENT_PALETTES.warmJoy;
    if (x > 0.2 && y <= 0.2) return DEFAULT_GRADIENT_PALETTES.calmSerene;
    if (x <= -0.1 && y <= 0.1) return DEFAULT_GRADIENT_PALETTES.melancholy;
    if (y > 0.4) return DEFAULT_GRADIENT_PALETTES.energetic;
    return DEFAULT_GRADIENT_PALETTES.default;
  }, [fallbackColors, extractedColors, currentEmotion]);

  // Calculate dynamic breathing parameters based on arousal
  const arousal = currentEmotion.y; // -1 to 1
  const breathingDuration = isPlaying ? Math.max(2.5, 4.5 - (arousal + 1) * 0.8) : 6.5;
  const glowOpacity = Math.min(0.55, (0.28 + (arousal + 1) * 0.1) * intensity);

  return (
    <div className={`relative pointer-events-none ${className}`}>
      {/* 1. Multi-Layer Radial Mesh Gradient Diffuse Glow */}
      <motion.div
        className={`absolute -inset-4 ${rounded} -z-20 overflow-visible`}
        style={{
          filter: `blur(${glowSpread}px)`,
          transform: "translate3d(0,0,0)",
          willChange: "transform, opacity",
        }}
        animate={{
          scale: isPlaying ? [0.96, 1.06, 0.96] : [0.98, 1.02, 0.98],
          opacity: isPlaying
            ? [glowOpacity * 0.75, glowOpacity * 1.15, glowOpacity * 0.75]
            : [glowOpacity * 0.45, glowOpacity * 0.65, glowOpacity * 0.45],
        }}
        transition={{
          repeat: Infinity,
          duration: breathingDuration,
          ease: "easeInOut",
        }}
      >
        {/* Blob 1 - Top Left Primary */}
        <div
          className="absolute -top-[25%] -left-[20%] w-[140%] h-[140%] rounded-full mix-blend-screen opacity-70"
          style={{
            background: `radial-gradient(ellipse at 30% 30%, ${activePalette[0]} 0%, transparent 65%)`,
          }}
        />

        {/* Blob 2 - Bottom Right Secondary */}
        <div
          className="absolute -bottom-[25%] -right-[20%] w-[130%] h-[130%] rounded-full mix-blend-screen opacity-65"
          style={{
            background: `radial-gradient(ellipse at 70% 70%, ${activePalette[1]} 0%, transparent 65%)`,
          }}
        />

        {/* Blob 3 - Center Accent */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] rounded-full mix-blend-screen"
          style={{
            background: `radial-gradient(circle at center, ${activePalette[2]} 0%, transparent 60%)`,
            opacity: isPlaying ? 0.6 : 0.25,
          }}
        />
      </motion.div>

      {/* 2. Hardware Accelerated Border-Beam Fluid Perimeter */}
      {borderBeam && (
        <div
          className={`absolute inset-0 ${rounded} -z-10 p-[1.5px] pointer-events-none overflow-hidden`}
          style={{
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        >
          <motion.div
            className="absolute inset-[-100%] rounded-full"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, transparent 280deg, ${activePalette[0]} 320deg, rgba(255,255,255,0.95) 345deg, ${activePalette[2]} 360deg)`,
              transform: "translate3d(0, 0, 0)",
              willChange: "transform",
              opacity: isPlaying ? 0.85 : 0.35,
            }}
            animate={borderBeam ? { rotate: [0, 360] } : undefined}
            transition={{
              repeat: Infinity,
              duration: isPlaying ? 4.5 : 8.5,
              ease: "linear",
            }}
          />
        </div>
      )}

      {/* 3. Subtle Inner Ambient Light Shimmer */}
      <div
        className={`absolute inset-0 ${rounded} -z-10 pointer-events-none bg-gradient-to-b from-white/[0.08] via-transparent to-black/[0.2]`}
      />

      {children}
    </div>
  );
};

