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
// 预解码最长等待：宁可稍晚一点开始淡入，也不要被一张慢图卡住
const PREDECODE_TIMEOUT_MS = 400;

// 光斑的径向渐隐改用遮罩实现。CSS 无法对 background-image 做过渡，
// 直接写 radial-gradient 会让换色瞬间跳变；纯色 background-color 才能被 transition-colors 平滑插值
const ORB_MASK = "radial-gradient(circle, #000 0%, transparent 70%)";

// 把位图预先解码进缓存。img 换了 src 之后要等解码完成才会绘制，
// 未解码时那一层是空白的——而切换瞬间旧封面层正完全可见，于是画面会"闪一下"。
// 先解码好，元素拿到 src 就能立刻绘制。解码失败（跨域、格式不支持）不阻塞切换。
function ensureDecoded(url: string): Promise<void> {
  if (!url || typeof window === "undefined") return Promise.resolve();

  return new Promise<void>((resolve) => {
    const img = new window.Image();
    img.src = url;

    if (typeof img.decode === "function") {
      img.decode().then(resolve, resolve);
      return;
    }

    if (img.complete) {
      resolve();
      return;
    }

    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

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
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 封面立即开始交叉淡入：先解码，再换层。两步都很便宜，不该被防抖推迟——
  // 防抖会让背景比卡片晚 250ms 才开始变，观感上就是"先卡一下、再硬切"。
  //
  // 收尾计时器放在 ref 里、不走 effect 的清理：setActiveCover 会让本 effect 重跑，
  // 若把计时器交给清理函数，刚排定就被清掉，isCrossfading 会永远停在 true、旧图层不再卸载。
  useEffect(() => {
    if (coverUrl === activeCover) return;

    let cancelled = false;

    void (async () => {
      await Promise.race([
        ensureDecoded(coverUrl),
        new Promise((resolve) => setTimeout(resolve, PREDECODE_TIMEOUT_MS)),
      ]);
      if (cancelled) return;

      setPrevCover(activeCover);
      setActiveCover(coverUrl);
      setIsCrossfading(true);

      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setIsCrossfading(false);
        fadeTimerRef.current = null;
      }, COVER_FADE_MS);
    })();

    return () => {
      cancelled = true;
    };
  }, [coverUrl, activeCover]);

  // 卸载时清掉挂起的收尾计时器
  useEffect(
    () => () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    },
    []
  );

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
        {/* 旧封面垫在下方，等新封面淡完再卸载 */}
        {isCrossfading && prevCover && (
          <div className="absolute inset-0">
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

        {/* 当前封面：key 变化时重新挂载，让淡入动画每张都重放一遍 */}
        {activeCover && (
          <div
            key={activeCover}
            className="absolute inset-0"
            style={{ animation: `ambient-cover-fade-in ${COVER_FADE_MS}ms ease-out both` }}
          >
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
