"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { usePlaybackClock } from "@/hooks/usePlaybackClock";
import { usePlayerStore } from "@/store/playerStore";
import { getAudioAnalyser } from "@/hooks/useAudioPlayer";
import { useFloatingDebugStore } from "@/store/floatingDebugStore";
import { smoothAudioValue } from "@/lib/audio/audioMotionSmoothing";
import { cancelRaf, requestRaf } from "@/lib/perf/rafScheduler";
import { featureFlags } from "@/lib/perf/featureFlags";
import { visualRuntime, type VisualFrameHandle } from "@/runtime/visualRuntime";
import { useFloatingActive } from "@/hooks/useFloatingActive";

export interface FloatingSpectrumGlowProps {
  /** Optional audio element */
  audioElement?: HTMLAudioElement | null;
  /** Optional custom class name */
  className?: string;
  /** Fixed or flexible height (px, default: 56) */
  height?: number;
  /** Number of spectrum bars (default: 32) */
  barCount?: number;
  /** Color theme palette */
  colorTheme?: "plasma" | "cyan-magenta" | "aurora";
  /** Render as a transparent analyzer layer over an existing surface. */
  overlay?: boolean;
  /** 外部门控（视图/沉浸式）：false 时停止排帧，默认 true 保持旧行为。 */
  active?: boolean;
}

export const FloatingSpectrumGlow: React.FC<FloatingSpectrumGlowProps> = ({
  audioElement: _audioElement,
  className = "",
  height = 56,
  barCount = 32,
  colorTheme: _colorTheme = "plasma",
  overlay = false,
  active = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  // S5-3：flag on 时只保留这条 runtime 订阅，不再自建 rafScheduler 链。
  const subscriptionRef = useRef<VisualFrameHandle | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const reducedMotionRef = useRef(false);
  const lastFrameAtRef = useRef(0);
  // 标签页可见性 + 视口可见性 + 外部门控合成的门控信号
  const floatingActive = useFloatingActive({ active, targetRef: containerRef });

  // Audio frequency buffer
  const freqDataRef = useRef<Uint8Array | null>(null);

  // Peak hold and gravity decay physics state
  const peaksRef = useRef<Float32Array>(new Float32Array(barCount));
  const peakHoldTimersRef = useRef<Int32Array>(new Int32Array(barCount));
  const peakFallSpeedsRef = useRef<Float32Array>(new Float32Array(barCount));
  const smoothedBarsRef = useRef<Float32Array>(new Float32Array(barCount));

  const isPlaying = usePlaybackClock((state) => state.isPlaying);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const glowIntensity = useFloatingDebugStore((state) => state.glowIntensity);

  // Update arrays if barCount changes
  useEffect(() => {
    peaksRef.current = new Float32Array(barCount);
    peakHoldTimersRef.current = new Int32Array(barCount);
    peakFallSpeedsRef.current = new Float32Array(barCount);
    smoothedBarsRef.current = new Float32Array(barCount);
  }, [barCount]);

  // Main Render Loop with Peak Hold & Gravity Decay
  const renderFrame = useCallback(
    function renderFrame(_time?: number, runtimeDeltaMs?: number) {
      if (!isRunningRef.current) return;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (typeof ctx.createLinearGradient !== "function") {
        // Partial canvas contexts (for example jsdom or constrained webviews)
        // cannot render the spectrum; stop cleanly instead of leaking RAF errors.
        isRunningRef.current = false;
        animFrameRef.current = null;
        return;
      }

      // 以画布元素自身的渲染尺寸为准：容器的 padding 与 border 不计入画布的内容盒，
      // 用容器尺寸取后备存储会比画布实际占位更高，画面被纵向压扁（圆点变扁椭圆）
      const width = canvas.clientWidth || container.clientWidth || 320;
      const canvasHeight = canvas.clientHeight || height || container.clientHeight || 56;
      const frameTime = typeof performance !== "undefined" ? performance.now() : Date.now();
      const deltaMs =
        runtimeDeltaMs ??
        (lastFrameAtRef.current
          ? Math.max(1, Math.min(64, frameTime - lastFrameAtRef.current))
          : 16);
      lastFrameAtRef.current = frameTime;
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

      const analyser = getAudioAnalyser();
      const hasLiveAudio =
        isPlaying && analyser && analyser.context.state === "running" && !!currentSong;

      const bufferLength = analyser ? analyser.frequencyBinCount : 512;
      if (!freqDataRef.current || freqDataRef.current.length !== bufferLength) {
        freqDataRef.current = new Uint8Array(bufferLength);
      }

      const freqData = freqDataRef.current;
      if (hasLiveAudio) {
        analyser.getByteFrequencyData(freqData as Uint8Array<ArrayBuffer>);
      }

      const peaks = peaksRef.current;
      const peakHoldTimers = peakHoldTimersRef.current;
      const peakFallSpeeds = peakFallSpeedsRef.current;
      const smoothedBars = smoothedBarsRef.current;

      const availableWidth = width;
      const totalBars = barCount;
      const barGap = Math.max(2, Math.min(4, availableWidth / (totalBars * 4)));
      const totalGap = (totalBars - 1) * barGap;
      const barWidth = Math.max(2, (availableWidth - totalGap) / totalBars);
      const maxBarHeight = canvasHeight * 0.88;

      let hasActiveSignal = false;
      // 1. Prepare Liquid Glass Monochrome White Gradient
      const barGradient = ctx.createLinearGradient(0, canvasHeight, 0, canvasHeight - maxBarHeight);
      barGradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
      barGradient.addColorStop(0.4, "rgba(255, 255, 255, 0.5)");
      barGradient.addColorStop(0.8, "rgba(255, 255, 255, 0.85)");
      barGradient.addColorStop(1, "rgba(255, 255, 255, 1.0)");

      for (let i = 0; i < totalBars; i++) {
        let rawNormalized = 0;

        if (hasLiveAudio) {
          // Logarithmic / perceptual frequency bin mapping (gives weight to 40Hz - 4kHz musical frequencies)
          const logIndex = Math.floor(Math.pow(i / totalBars, 1.6) * (bufferLength * 0.65));
          const clampedIndex = Math.max(0, Math.min(logIndex, bufferLength - 1));
          const byteVal = freqData[clampedIndex] || 0;

          // Mild high-frequency boost for visual balance
          const trebleBoost = 1 + (i / totalBars) * 0.45;
          rawNormalized = Math.min((byteVal / 255) * trebleBoost, 1);
        } else {
          // Paused, suspended, or unavailable analysers decay to a quiet static state.
          rawNormalized = 0;
        }

        // Time-based attack/release smoothing remains consistent if frame cadence changes.
        smoothedBars[i] = smoothAudioValue(smoothedBars[i], rawNormalized, deltaMs);
        const currentHeight = Math.max(2, smoothedBars[i] * maxBarHeight);

        if (currentHeight > 3) {
          hasActiveSignal = true;
        }

        // Peak Hold & Gravity Decay logic
        if (currentHeight >= peaks[i]) {
          peaks[i] = currentHeight;
          peakHoldTimers[i] = 16; // Hold at apex for 16 frames (~260ms)
          peakFallSpeeds[i] = 0;
        } else {
          if (peakHoldTimers[i] > 0) {
            peakHoldTimers[i] -= 1;
          } else {
            // Accelerate falling velocity
            peakFallSpeeds[i] += 0.35; // Gravity acceleration
            peaks[i] = Math.max(currentHeight, peaks[i] - peakFallSpeeds[i]);
          }
        }

        if (peaks[i] > 4) {
          hasActiveSignal = true;
        }

        const x = i * (barWidth + barGap);
        const y = canvasHeight - currentHeight;

        // Draw Main Spectrum Bar with Liquid Glass Rounded Top
        ctx.save();
        ctx.fillStyle = barGradient;
        ctx.shadowColor = "rgba(255, 255, 255, 0.35)";
        ctx.shadowBlur = 6 * glowIntensity;

        const radius = Math.min(barWidth / 2, 3);
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, barWidth, currentHeight, [radius, radius, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, currentHeight);
        }
        ctx.fill();
        ctx.restore();

        // Draw Peak Hold Floating Luminous Cap
        const peakY = Math.max(2, canvasHeight - peaks[i]);
        if (peakY < canvasHeight - 3) {
          ctx.save();
          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
          ctx.shadowBlur = 6 * glowIntensity;

          ctx.beginPath();
          const peakHeight = 2;
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(x, peakY - peakHeight, barWidth, peakHeight, 1);
          } else {
            ctx.rect(x, peakY - peakHeight, barWidth, peakHeight);
          }
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();

      // Stop sampling when playback/analyser is inactive or reduced motion is requested.
      if (reducedMotionRef.current || ((!isPlaying || !hasLiveAudio) && !hasActiveSignal)) {
        isRunningRef.current = false;
        animFrameRef.current = null;
        subscriptionRef.current?.stop();
        subscriptionRef.current = null;
        return;
      }

      // flag on 时续排由 runtime 负责；旧路径每条链自己 requestRaf。
      if (!featureFlags.visualRuntime) {
        animFrameRef.current = requestRaf(renderFrame);
      }
    },
    [barCount, currentSong, glowIntensity, height, isPlaying]
  );

  // Start loop helper
  const startLoop = useCallback(() => {
    if (!isRunningRef.current) {
      isRunningRef.current = true;
      lastFrameAtRef.current = 0;
      if (featureFlags.visualRuntime) {
        subscriptionRef.current = visualRuntime.subscribe("floating-spectrum", renderFrame);
      } else {
        animFrameRef.current = requestRaf(renderFrame);
      }
    }
  }, [renderFrame]);

  // Stop loop helper
  const stopLoop = useCallback(() => {
    isRunningRef.current = false;
    subscriptionRef.current?.stop();
    subscriptionRef.current = null;
    if (animFrameRef.current) {
      cancelRaf(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Restart with the newest song/playback closure so a long-lived RAF cannot retain old metadata.
  // 门控：隐藏标签页/离开视口/外部 inactive 时立即停表；恢复可见时播放中重开循环，
  // 暂停时只补一帧静帧（renderFrame 在无音频信号时自行停表，不留常驻循环）。
  useEffect(() => {
    if (!floatingActive || !currentSong) return;
    startLoop();
    return stopLoop;
  }, [currentSong, isPlaying, floatingActive, startLoop, stopLoop]);

  // Reduced motion: stop sampling when the user asks for less motion.
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = reducedMotionQuery?.matches === true;
    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      stopLoop();
      if (floatingActive && currentSong) startLoop();
    };
    reducedMotionQuery?.addEventListener?.("change", handleReducedMotionChange);
    return () => {
      reducedMotionQuery?.removeEventListener?.("change", handleReducedMotionChange);
      stopLoop();
    };
  }, [currentSong, floatingActive, startLoop, stopLoop]);

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-xl bg-black/30 backdrop-blur-md p-1 border border-white/[0.06] ${className}`}
      style={
        overlay
          ? {
              height,
              touchAction: "none",
              background: "transparent",
              border: 0,
              padding: 0,
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
            }
          : { height, touchAction: "none" }
      }
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
