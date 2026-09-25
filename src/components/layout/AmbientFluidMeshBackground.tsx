/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import { useAudioStore } from "@/store/audioStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { extractColorsFromImage, defaultColors, ThemeColors } from "@/utils/colorExtractor";

const DEFAULT_COVER = "/default-cover.svg";

// 封面淡入时长与取色防抖：两者相差太大时，配色会在图片还没淡完时就开始变
const COVER_FADE_MS = 1200;
const COLOR_EXTRACT_DEBOUNCE_MS = 250;
// 连续切换（快速连点卡片）的合并窗口：窗口内的中间封面会被跳过，只换最后一张。
// 取 220ms 是为了覆盖人连点卡片的节奏（约每秒 4-8 次）；间隔超过它的正常点选仍然立即生效。
const COVER_COALESCE_MS = 220;

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

  const lastChangeAtRef = useRef(0);
  const pendingSwapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 封面切换策略：正常点选立即换（跟手），连续快速切换则一路合并、等停下来再换最后一张。
  // 判据是"距上次点击"而不是"距上次应用"——否则连点时每隔一次仍会漏成一次立即切换。
  // 每换一次封面都要新建模糊图层并重算模糊，逐个换在连点时就是卡顿的来源。
  useEffect(() => {
    if (coverUrl === topCover) return;

    const apply = () => setCoverStack((prev) => [...prev, coverUrl].slice(-2));
    const now = Date.now();
    const isBurst = now - lastChangeAtRef.current < COVER_COALESCE_MS;
    lastChangeAtRef.current = now;

    if (!isBurst) {
      // 正常点选：立即应用，保证跟手
      void Promise.resolve().then(apply);
    } else {
      // 连点中：推迟到安静下来再换最后一张
      if (pendingSwapRef.current) clearTimeout(pendingSwapRef.current);
      pendingSwapRef.current = setTimeout(() => {
        pendingSwapRef.current = null;
        apply();
      }, COVER_COALESCE_MS);
    }

    return () => {
      if (pendingSwapRef.current) {
        clearTimeout(pendingSwapRef.current);
        pendingSwapRef.current = null;
      }
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
      {/* 先把封面放进一个小盒子模糊、再整体放大铺满屏幕：滤镜只需处理 240×135 的图层
          （约为全屏的 1/100 像素），模糊半径按同比例缩小（10px/240 ≈ 60px/1440），
          观感与全尺寸模糊一致。每次换封面这一层都要重算，是连点卡顿的大头。 */}
      <div className="absolute inset-0 overflow-hidden opacity-30 transform-gpu flex items-center justify-center">
        {/* 尺寸/模糊/缩放都用内联样式：Tailwind 的任意值类需要构建期扫描到才会生成，
            这里几处新类未必已进入样式表，写死数值更可靠 */}
        <div
          className="relative"
          style={{ width: 240, height: 135, filter: "blur(10px)", transform: "scale(16)" }}
        >
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
                sizes="240px"
                priority={false}
                className="object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>
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
    </div>
  );
};
