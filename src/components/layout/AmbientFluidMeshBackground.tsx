/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useAudioStore } from "@/store/audioStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { extractColorsFromImage, defaultColors, ThemeColors } from "@/utils/colorExtractor";

const DEFAULT_COVER = "/default-cover.svg";

// 封面淡入时长与取色防抖：两者相差太大时，配色会在图片还没淡完时就开始变
const COVER_FADE_MS = 1200;
const COLOR_EXTRACT_DEBOUNCE_MS = 250;

// 光斑的径向渐隐改用遮罩实现。CSS 无法对 background-image 做过渡，
// 直接写 radial-gradient 会让换色瞬间跳变；纯色 background-color 才能被 transition-colors 平滑插值
const ORB_MASK = "radial-gradient(circle, #000 0%, transparent 70%)";

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

  // 只保留最近两张封面，每张各自拥有独立的 <img> 元素，src 永不改写。
  // 新封面是"新挂载一个元素做淡入"，旧封面那个元素自始至终没被动过、位图也一直都在，
  // 所以不会出现"元素还在但位图未就绪"的空白帧 —— 那正是切歌时闪一下的来源。
  // 也因此不需要预先解码等待：淡入立刻开始，新图加载好就在旧封面之上浮现。
  const [coverStack, setCoverStack] = useState<string[]>([DEFAULT_COVER]);
  const topCover = coverStack[coverStack.length - 1];

  // 封面切换立即执行，不该被防抖推迟——防抖会让背景比卡片晚 250ms 才开始变。
  // 置位放在微任务里而不是 effect 同步体内：既避免级联渲染，延迟也只有 ~1ms。
  useEffect(() => {
    if (coverUrl === topCover) return;

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setCoverStack((prev) => [...prev, coverUrl].slice(-2));
    });

    return () => {
      cancelled = true;
    };
  }, [coverUrl, topCover]);

  // 取色要采样像素、开销大，仍然防抖：快速连切卡片时不必每张都算
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!coverUrl || coverUrl === DEFAULT_COVER) {
        if (!cancelled) setColors(defaultColors);
        return;
      }

      const extracted = await extractColorsFromImage(coverUrl);
      if (!cancelled) setColors(extracted);
    }, COLOR_EXTRACT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coverUrl]);

  const { primary, secondary, accent, surface } = colors;

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0 select-none bg-[#070709]">
      {/* ─── 1. 沉浸式超大弥散底层 (Crossfading Dynamic Album Glass) ─── */}
      <div className="absolute inset-0 overflow-hidden opacity-30 scale-105 blur-[60px] transform-gpu">
        {coverStack.map((cover, i) => (
          <div
            key={cover}
            className="absolute inset-0"
            style={{ animation: `ambient-cover-fade-in ${COVER_FADE_MS}ms ease-out both` }}
          >
            <Image
              src={cover}
              alt={i === coverStack.length - 1 ? "ambient-curr" : "ambient-prev"}
              fill
              sizes="100vw"
              priority={false}
              className="object-cover"
              unoptimized
            />
          </div>
        ))}
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
            backgroundColor: primary,
            maskImage: ORB_MASK,
            WebkitMaskImage: ORB_MASK,
            willChange: "transform",
          }}
        />

        {/* 光斑 2: 右上高位主色 (Secondary Color) */}
        <div
          className="animate-orb-2 absolute -top-[10%] -right-[10%] w-[560px] h-[560px] rounded-full opacity-25 transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            backgroundColor: secondary,
            maskImage: ORB_MASK,
            WebkitMaskImage: ORB_MASK,
            willChange: "transform",
          }}
        />

        {/* 光斑 3: 右下与黑胶后方深邃光团 (Accent Color) */}
        <div
          className="animate-orb-3 absolute -bottom-[20%] right-[15%] w-[700px] h-[700px] rounded-full opacity-25 transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            backgroundColor: accent,
            maskImage: ORB_MASK,
            WebkitMaskImage: ORB_MASK,
            willChange: "transform",
          }}
        />

        {/* 光斑 4: 左下深底氛围光 (Surface Color) */}
        <div
          className="animate-orb-4 absolute -bottom-[15%] -left-[15%] w-[620px] h-[620px] rounded-full opacity-20 transform-gpu transition-colors duration-[1200ms] ease-out"
          style={{
            backgroundColor: surface,
            maskImage: ORB_MASK,
            WebkitMaskImage: ORB_MASK,
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
      {/* 过渡的是 boxShadow，用 transition-shadow（transition-colors 不含 box-shadow） */}
      <div
        className="absolute inset-0 pointer-events-none transition-shadow duration-[1200ms] ease-out"
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
