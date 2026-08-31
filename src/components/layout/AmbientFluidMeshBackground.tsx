/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import { useAudioStore } from "@/store/audioStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { extractColorsFromImage, defaultColors, ThemeColors } from "@/utils/colorExtractor";

const DEFAULT_COVER = "/default-cover.svg";

export const AmbientFluidMeshBackground: React.FC = () => {
  const currentCover = useAudioStore((state) => state.currentSong?.cover);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const selectedCover = usePlaylistStore((state) => state.selectedSong?.cover);

  const coverUrl = selectedCover || currentCover || DEFAULT_COVER;

  const [colors, setColors] = useState<ThemeColors>(defaultColors);
  const [activeCover, setActiveCover] = useState<string>(DEFAULT_COVER);
  const [prevCover, setPrevCover] = useState<string>(DEFAULT_COVER);
  const [isCrossfading, setIsCrossfading] = useState<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 400ms 终点吸附智能防抖色彩与封面提取（等切歌弹簧与焦点完全就绪后再进行平滑过渡）
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (coverUrl !== activeCover) {
        setPrevCover(activeCover);
        setActiveCover(coverUrl);
        setIsCrossfading(true);
        setTimeout(() => setIsCrossfading(false), 1200);
      }

      if (coverUrl && coverUrl !== DEFAULT_COVER) {
        const extracted = await extractColorsFromImage(coverUrl);
        setColors(extracted);
      } else {
        setColors(defaultColors);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [coverUrl, activeCover]);

  const { primary, secondary, accent, surface } = colors;

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0 select-none bg-[#070709]">
      {/* ─── 1. 沉浸式超大弥散底层 (Crossfading Dynamic Album Glass) ─── */}
      <div className="absolute inset-0 overflow-hidden opacity-30 scale-105 blur-[60px] transform-gpu">
        {/* 旧封面渐隐层 */}
        {isCrossfading && prevCover && (
          <div className="absolute inset-0 transition-opacity duration-[1200ms] ease-out opacity-0">
            <Image
              src={prevCover}
              alt="ambient-prev"
              fill
              sizes="100vw"
              priority={false}
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* 当前封面渐现层 */}
        {activeCover && (
          <div className="absolute inset-0 transition-opacity duration-[1200ms] ease-out opacity-100">
            <Image
              src={activeCover}
              alt="ambient-curr"
              fill
              sizes="100vw"
              priority={false}
              className="object-cover"
              unoptimized
            />
          </div>
        )}
      </div>

      {/* ─── 2. 硬件加速极简流体光斑漫游 (4-Orb Fluid Dynamic Mesh) ─── */}
      <div
        className={`absolute inset-0 w-full h-full overflow-hidden blur-[40px] transition-transform duration-1000 ease-out transform-gpu ${
          isPlaying ? "scale-[1.02]" : "scale-100"
        }`}
      >
        {/* 光斑 1: 左上高位光团 (Primary Color) */}
        <div
          className="animate-orb-1 absolute -top-[15%] -left-[10%] w-[600px] h-[600px] rounded-full opacity-30 transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            background: `radial-gradient(circle, ${primary} 0%, transparent 70%)`,
            willChange: "transform",
          }}
        />

        {/* 光斑 2: 右上高位主色 (Secondary Color) */}
        <div
          className="animate-orb-2 absolute -top-[10%] -right-[10%] w-[560px] h-[560px] rounded-full opacity-25 transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            background: `radial-gradient(circle, ${secondary} 0%, transparent 70%)`,
            willChange: "transform",
          }}
        />

        {/* 光斑 3: 右下与黑胶后方深邃光团 (Accent Color) */}
        <div
          className="animate-orb-3 absolute -bottom-[20%] right-[15%] w-[700px] h-[700px] rounded-full opacity-25 transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
            willChange: "transform",
          }}
        />

        {/* 光斑 4: 左下深底氛围光 (Surface Color) */}
        <div
          className="animate-orb-4 absolute -bottom-[15%] -left-[15%] w-[620px] h-[620px] rounded-full opacity-20 transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            background: `radial-gradient(circle, ${surface} 0%, transparent 70%)`,
            willChange: "transform",
          }}
        />
      </div>

      {/* ─── 3. Apple 级高奢暗调暗角与对比度护盾 (Dark Vignette Shield) ─── */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 85% at 50% 48%, rgba(7,7,9,0.38) 0%, rgba(7,7,9,0.78) 60%, rgba(5,5,7,0.95) 100%),
            linear-gradient(to bottom, rgba(7,7,9,0.55) 0%, rgba(7,7,9,0.15) 30%, rgba(7,7,9,0.15) 70%, rgba(5,5,7,0.85) 100%)
          `,
        }}
      />

      {/* ─── 4. 屏幕四周极光琉璃微溢光 ─── */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-[1200ms] ease-out"
        style={{
          boxShadow: `
            inset 0 0 140px 10px rgba(0,0,0,0.85),
            inset 0 0 32px 1px ${primary}18,
            inset 0 0 16px 1px ${secondary}12
          `,
        }}
      />
    </div>
  );
};
