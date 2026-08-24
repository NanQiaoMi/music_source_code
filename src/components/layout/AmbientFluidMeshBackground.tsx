"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import { useAudioStore } from "@/store/audioStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { extractColorsFromImage, defaultColors, ThemeColors } from "@/utils/colorExtractor";
import { DualBreathingAuraRays } from "./DualBreathingAuraRays";

const DEFAULT_COVER = "/default-cover.svg";

export const AmbientFluidMeshBackground: React.FC = () => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const selectedSong = usePlaylistStore((state) => state.selectedSong);
  const songs = usePlaylistStore((state) => state.songs);
  const recentPlayed = usePlaylistStore((state) => state.recentPlayed);

  // 焦点歌曲：优先选取当前选中的歌曲，其次是正在播放的歌曲，最后是曲库首曲
  const activeSong = useMemo(() => {
    if (selectedSong) return selectedSong;
    if (currentSong) return currentSong;
    if (songs.length > 0) return songs[0];
    if (recentPlayed.length > 0) return recentPlayed[0];
    return null;
  }, [selectedSong, currentSong, songs, recentPlayed]);

  const coverUrl = activeSong?.cover || DEFAULT_COVER;

  const [colors, setColors] = useState<ThemeColors>(defaultColors);
  const [activeCover, setActiveCover] = useState<string>(DEFAULT_COVER);
  const [prevCover, setPrevCover] = useState<string>(DEFAULT_COVER);
  const [isCrossfading, setIsCrossfading] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 150ms 终点吸附智能防抖色彩与封面提取
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
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [coverUrl, activeCover]);

  const { primary, secondary, accent, surface, background } = colors;

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0 select-none bg-[#070709]">
      {/* ─── 1. 沉浸式超大高斯弥散底层 (Crossfading Dynamic Album Glass) ─── */}
      <div className="absolute inset-0 overflow-hidden opacity-25 scale-105 filter blur-[40px] transform-gpu">
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

      {/* ─── 2. 多中心非对称流体光斑漫游 (4-Orb Fluid Dynamic Mesh) ─── */}
      <div
        className={`absolute inset-0 w-full h-full overflow-hidden transition-transform duration-1000 ease-out ${
          isPlaying ? "scale-[1.03]" : "scale-100"
        }`}
      >
        {/* 光斑 1: 左上高位光团 (Primary Color, 26s 漫游) */}
        <div
          className="animate-orb-1 absolute -top-[15%] -left-[10%] w-[680px] h-[680px] rounded-full mix-blend-screen opacity-35 filter blur-[40px] transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            background: `radial-gradient(circle, ${primary} 0%, rgba(0,0,0,0) 70%)`,
          }}
        />

        {/* 光斑 2: 右上高位主色 (Secondary Color, 22s 漫游) */}
        <div
          className="animate-orb-2 absolute -top-[10%] -right-[10%] w-[640px] h-[640px] rounded-full mix-blend-screen opacity-30 filter blur-[40px] transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            background: `radial-gradient(circle, ${secondary} 0%, rgba(0,0,0,0) 70%)`,
          }}
        />

        {/* 光斑 3: 右下与黑胶后方深邃光团 (Accent Color, 28s 漫游) */}
        <div
          className="animate-orb-3 absolute -bottom-[20%] right-[15%] w-[820px] h-[820px] rounded-full mix-blend-screen opacity-28 filter blur-[40px] transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            background: `radial-gradient(circle, ${accent} 0%, rgba(0,0,0,0) 70%)`,
          }}
        />

        {/* 光斑 4: 左下深底氛围光 (Surface / Complementary Color, 20s 漫游) */}
        <div
          className="animate-orb-4 absolute -bottom-[15%] -left-[15%] w-[720px] h-[720px] rounded-full mix-blend-screen opacity-25 filter blur-[40px] transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            background: `radial-gradient(circle, ${surface} 0%, rgba(0,0,0,0) 70%)`,
          }}
        />
      </div>

      {/* ─── 2.5 优雅非对称双弧微光呼吸轨 (Dual Subtle Breathing Aura Rays) ─── */}
      <DualBreathingAuraRays
        primary={primary}
        secondary={secondary}
        accent={accent}
        isPlaying={isPlaying}
      />

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

      {/* ─── 4. 屏幕四周极光琉璃微溢光 (1.5% Prismatic Screen Bleed) ─── */}
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

      {/* ─── 5. Apple Studio 级微粒胶片噪点 (2.5% Film Grain Texture) ─── */}
      <div
        className="absolute inset-0 opacity-[0.028] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: "url('/noise.svg')",
          backgroundRepeat: "repeat",
        }}
      />
    </div>
  );
};
