"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useAudioStore } from "@/store/audioStore";
import { usePlaybackClock } from "@/hooks/usePlaybackClock";
import { analyserHub } from "@/lib/audio/AnalyserHub";
import { useFloatingDebugStore } from "@/store/floatingDebugStore";
import { cancelRaf, requestRaf } from "@/lib/perf/rafScheduler";
import { featureFlags } from "@/lib/perf/featureFlags";
import { visualRuntime, type VisualFrameHandle } from "@/runtime/visualRuntime";
import { useFloatingActive } from "@/hooks/useFloatingActive";

export interface FloatingWaveformGlowProps {
  /** Optional audio element override */
  audioElement?: HTMLAudioElement | null;
  /** Optional custom class name */
  className?: string;
  /** Fixed or flexible height (px) */
  height?: number;
  /** Custom base glow color string (default: cyan/fuchsia neon gradient) */
  glowColor?: string;
  /** Enable click and drag seek interactions (default: true) */
  interactive?: boolean;
  /** Callback fired during or after seek */
  onSeek?: (time: number) => void;
  /** Magnifying lens radius around playhead (default: 14px) */
  magnifyingRadius?: number;
  /** Specular highlight color */
  highlightColor?: string;
  /** 外部门控（视图/沉浸式）：false 时停止环境波形循环，默认 true 保持旧行为。 */
  active?: boolean;
}

function formatTooltipTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const FloatingWaveformGlow: React.FC<FloatingWaveformGlowProps> = ({
  audioElement: _audioElement,
  className = "",
  height = 56,
  glowColor: _glowColor,
  interactive = true,
  onSeek,
  magnifyingRadius = 14,
  highlightColor = "#FFFFFF",
  active = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  // S5-3：flag on 时环境波形挂在 visualRuntime 上，随全仓共享帧派发。
  // S2-3：帧数据改由 AnalyserHub 共享缓冲提供，不再自持 Uint8Array。
  const subscriptionRef = useRef<VisualFrameHandle | null>(null);
  const idlePhaseRef = useRef<number>(0);
  // 标签页可见性 + 视口可见性 + 外部门控
  const floatingActive = useFloatingActive({ active, targetRef: containerRef });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
  );

  const isPlaying = usePlaybackClock((state) => state.isPlaying);
  const currentTime = usePlaybackClock((state) => state.currentTime);
  const duration = usePlaybackClock((state) => state.duration);
  const seekTo = useAudioStore((state) => state.seekTo);

  const magnifyPower = useFloatingDebugStore((state) => state.magnifyPower);
  const glowIntensity = useFloatingDebugStore((state) => state.glowIntensity);

  const [hoverState, setHoverState] = useState<{
    isHovered: boolean;
    x: number;
    previewTime: number;
    // 已夹取好边界的提示气泡位置：渲染期不能读 ref，所以在这里算好
    tooltipLeft: number;
  }>({ isHovered: false, x: 0, previewTime: 0, tooltipLeft: 20 });

  const isSeekingRef = useRef(false);

  // Audio rendering animation loop
  const draw = useCallback(
    function draw(_time?: number, _runtimeDeltaMs?: number) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 以画布元素自身的渲染尺寸为准。容器一旦出现 padding/border，容器尺寸就会大于画布的
      // 内容盒，后备存储随之偏大而生出纵向压扁（FloatingSpectrumGlow 就踩过这个坑）
      const width = canvas.clientWidth || container.clientWidth || 320;
      const canvasHeight = canvas.clientHeight || height || container.clientHeight || 56;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const backingWidth = Math.round(width * dpr);
      const backingHeight = Math.round(canvasHeight * dpr);

      // 取整后再比较：dpr 为小数时 canvas.width 会被截断，否则每帧都会重设后备存储并清空画布
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, canvasHeight);

      const analyser = analyserHub.getAnalyser();
      const hasLiveAudio = isPlaying && analyser;

      // 共享波形缓冲由 AnalyserHub 复用，避免每帧分配新的 Uint8Array
      const dataArray = analyserHub.getTimeDomainData();
      const bufferLength = dataArray.length;

      const progressRatio = duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : 0;
      const playheadX = progressRatio * width;
      const centerY = canvasHeight * 0.52;
      const maxAmplitude = canvasHeight * 0.42 * glowIntensity;

      idlePhaseRef.current += isPlaying ? 0.04 : 0.015;
      const phase = idlePhaseRef.current;

      // Build the dynamic points array
      const sampleCount = Math.min(width, 180);
      const pointsTop: { x: number; y: number; amp: number }[] = [];
      const pointsBottom: { x: number; y: number; amp: number }[] = [];

      for (let i = 0; i <= sampleCount; i++) {
        const x = (i / sampleCount) * width;
        let rawAmp = 0;

        if (hasLiveAudio) {
          const dataIndex = Math.floor((i / sampleCount) * (bufferLength - 1));
          const byteVal = dataArray[dataIndex];
          // Centered around 128 (0 to 1)
          const normalized = (byteVal - 128) / 128.0;
          rawAmp = Math.abs(normalized);
        } else {
          // Organic idle harmonic wave
          const w1 = Math.sin(i * 0.08 + phase) * 0.35;
          const w2 = Math.sin(i * 0.16 - phase * 1.5) * 0.2;
          const w3 = Math.cos(i * 0.04 + phase * 0.7) * 0.15;
          rawAmp = Math.max(0.05, Math.abs(w1 + w2 + w3));
        }

        // Magnifying lens effect around playhead within magnifyingRadius (approx 12-16px)
        const distToPlayhead = Math.abs(x - playheadX);
        let lensFactor = 0;
        if (distToPlayhead < magnifyingRadius) {
          // Cosine bell curve with peak at dist=0
          lensFactor = Math.cos((distToPlayhead / magnifyingRadius) * (Math.PI / 2));
        }

        const amplified = rawAmp * (1 + (magnifyPower || 2.4) * lensFactor);
        const yOffset = Math.max(2, amplified * maxAmplitude);

        pointsTop.push({ x, y: centerY - yOffset, amp: amplified });
        pointsBottom.push({ x, y: centerY + yOffset * 0.65, amp: amplified });
      }

      // 1. Draw glowing background filled area (monochrome glass fill)
      const bgGradient = ctx.createLinearGradient(0, 0, width, 0);
      bgGradient.addColorStop(0, "rgba(255, 255, 255, 0.05)");
      bgGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.08)");
      bgGradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");

      ctx.beginPath();
      ctx.moveTo(pointsTop[0].x, pointsTop[0].y);
      for (let i = 1; i < pointsTop.length; i++) {
        const prev = pointsTop[i - 1];
        const curr = pointsTop[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      for (let i = pointsBottom.length - 1; i >= 0; i--) {
        ctx.lineTo(pointsBottom[i].x, pointsBottom[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = bgGradient;
      ctx.fill();

      // 2. Draw Top Waveform with Liquid Glass White Glow Path
      const strokeGradient = ctx.createLinearGradient(0, 0, width, 0);
      strokeGradient.addColorStop(0, "rgba(255, 255, 255, 0.75)");
      strokeGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.95)");
      strokeGradient.addColorStop(1, "rgba(255, 255, 255, 0.75)");

      ctx.save();
      ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
      ctx.shadowBlur = 8 * glowIntensity;
      ctx.strokeStyle = strokeGradient;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(pointsTop[0].x, pointsTop[0].y);
      for (let i = 1; i < pointsTop.length; i++) {
        const prev = pointsTop[i - 1];
        const curr = pointsTop[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      ctx.stroke();
      ctx.restore();

      // 3. Draw Bottom Mirrored Waveform with subtle translucent white
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pointsBottom[0].x, pointsBottom[0].y);
      for (let i = 1; i < pointsBottom.length; i++) {
        const prev = pointsBottom[i - 1];
        const curr = pointsBottom[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      ctx.stroke();
      ctx.restore();

      // 4. Draw Center Guideline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // 5. Draw Realtime Playhead Probe & Liquid Glass Lens Flare Highlight
      if (playheadX >= 0 && playheadX <= width) {
        // Find apex point at playhead
        const sampleIndex = Math.min(
          Math.floor((playheadX / width) * sampleCount),
          pointsTop.length - 1
        );
        const apexPoint = pointsTop[sampleIndex] || { x: playheadX, y: centerY - 10 };

        // Playhead vertical luminous probe line (pure white)
        const probeGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        probeGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        probeGradient.addColorStop(0.2, "rgba(255, 255, 255, 0.6)");
        probeGradient.addColorStop(0.5, "rgba(255, 255, 255, 1)");
        probeGradient.addColorStop(0.8, "rgba(255, 255, 255, 0.6)");
        probeGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.save();
        ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
        ctx.shadowBlur = 10 * glowIntensity;
        ctx.strokeStyle = probeGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 2);
        ctx.lineTo(playheadX, canvasHeight - 2);
        ctx.stroke();
        ctx.restore();

        // Specular lens flare halo at the magnified curve apex
        ctx.save();
        const flareRadius = 14 * glowIntensity;
        const flareGrad = ctx.createRadialGradient(
          playheadX,
          apexPoint.y,
          0,
          playheadX,
          apexPoint.y,
          flareRadius
        );
        flareGrad.addColorStop(0, highlightColor);
        flareGrad.addColorStop(0.35, "rgba(255, 255, 255, 0.8)");
        flareGrad.addColorStop(0.7, "rgba(255, 255, 255, 0.25)");
        flareGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

        flareGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(playheadX, apexPoint.y, flareRadius, 0, Math.PI * 2);
        ctx.fill();

        // Luminous Core Pip
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "#38BDF8";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(playheadX, apexPoint.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 6. Draw Hover Ghost Cursor if active
      if (hoverState.isHovered && !isSeekingRef.current && interactive) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hoverState.x, 4);
        ctx.lineTo(hoverState.x, canvasHeight - 4);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      // 减动效只画一帧静帧；flag on 时续排交给 runtime，否则旧路径自行 requestRaf。
      if (prefersReducedMotion) {
        subscriptionRef.current?.stop();
        subscriptionRef.current = null;
      } else if (!featureFlags.visualRuntime) {
        animFrameRef.current = requestRaf(draw);
      }
    },
    [
      currentTime,
      duration,
      glowIntensity,
      height,
      highlightColor,
      hoverState.isHovered,
      hoverState.x,
      interactive,
      isPlaying,
      magnifyPower,
      magnifyingRadius,
      prefersReducedMotion,
    ]
  );

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query?.addEventListener) return;
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  // 环境波形是空闲时唯一保留的循环：仅在活跃（标签页可见 + 视口内 + 视图门控）时运行，
  // 隐藏/离开视口/切走视图立即取消；恢复可见重新排帧，减动效则只画静帧。
  useEffect(() => {
    if (!floatingActive) return;
    if (featureFlags.visualRuntime) {
      subscriptionRef.current = visualRuntime.subscribe("floating-waveform", draw);
    } else {
      animFrameRef.current = requestRaf(draw);
    }
    return () => {
      subscriptionRef.current?.stop();
      subscriptionRef.current = null;
      if (animFrameRef.current) {
        cancelRaf(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [draw, floatingActive]);

  // Mouse & Touch Seek handlers
  const handleSeekFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container || !duration) return;

      const rect = container.getBoundingClientRect();
      const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = clampedX / rect.width;
      const targetTime = ratio * duration;

      seekTo(targetTime);
      onSeek?.(targetTime);
    },
    [duration, onSeek, seekTo]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();

    isSeekingRef.current = true;
    handleSeekFromClientX(e.clientX);

    const onPointerMove = (moveEv: PointerEvent) => {
      handleSeekFromClientX(moveEv.clientX);
    };

    const onPointerUp = (upEv: PointerEvent) => {
      isSeekingRef.current = false;
      handleSeekFromClientX(upEv.clientX);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const previewTime = duration > 0 ? (x / rect.width) * duration : 0;

    setHoverState({
      isHovered: true,
      x,
      previewTime,
      tooltipLeft: Math.max(20, Math.min(x, rect.width - 20)),
    });
  };

  const handleMouseLeave = () => {
    setHoverState((prev) => ({ ...prev, isHovered: false }));
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none group ${interactive ? "cursor-pointer" : ""} ${className}`}
      style={{ height, touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="w-full h-full block rounded-xl" />

      {/* Hover preview time pill badge */}
      {hoverState.isHovered && interactive && (
        <div
          className="absolute -top-7 -translate-x-1/2 pointer-events-none px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-cyan-500/30 text-[10px] font-mono text-cyan-200 shadow-lg transition-transform"
          style={{ left: hoverState.tooltipLeft }}
        >
          {formatTooltipTime(hoverState.previewTime)}
        </div>
      )}
    </div>
  );
};
