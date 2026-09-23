"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useAudioStore } from "@/store/audioStore";
import { getAudioAnalyser } from "@/hooks/useAudioPlayer";
import { useFloatingDebugStore } from "@/store/floatingDebugStore";

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
  /** Fallback idle animation when paused (default: true) */
  enableIdlePulse?: boolean;
}

export const FloatingSpectrumGlow: React.FC<FloatingSpectrumGlowProps> = ({
  audioElement: _audioElement,
  className = "",
  height = 56,
  barCount = 32,
  colorTheme: _colorTheme = "plasma",
  enableIdlePulse: _enableIdlePulse = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const isRunningRef = useRef<boolean>(false);

  // Audio frequency buffer
  const freqDataRef = useRef<Uint8Array | null>(null);

  // Peak hold and gravity decay physics state
  const peaksRef = useRef<Float32Array>(new Float32Array(barCount));
  const peakHoldTimersRef = useRef<Int32Array>(new Int32Array(barCount));
  const peakFallSpeedsRef = useRef<Float32Array>(new Float32Array(barCount));
  const smoothedBarsRef = useRef<Float32Array>(new Float32Array(barCount));

  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentSong = useAudioStore((state) => state.currentSong);
  const glowIntensity = useFloatingDebugStore((state) => state.glowIntensity);

  // Update arrays if barCount changes
  useEffect(() => {
    peaksRef.current = new Float32Array(barCount);
    peakHoldTimersRef.current = new Int32Array(barCount);
    peakFallSpeedsRef.current = new Float32Array(barCount);
    smoothedBarsRef.current = new Float32Array(barCount);
  }, [barCount]);

  // Main Render Loop with Peak Hold & Gravity Decay
  const renderFrame = useCallback(() => {
    if (!isRunningRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 以画布元素自身的渲染尺寸为准：容器的 padding 与 border 不计入画布的内容盒，
    // 用容器尺寸取后备存储会比画布实际占位更高，画面被纵向压扁（圆点变扁椭圆）
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

    const analyser = getAudioAnalyser();
    const hasLiveAudio = isPlaying && analyser && !!currentSong;

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
    const time = Date.now() * 0.003;

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
      } else if (isPlaying) {
        // Subtle simulated rhythmic dance if playing without analyser hook
        const wave = Math.sin(time + i * 0.25) * 0.35 + Math.cos(time * 1.5 - i * 0.15) * 0.25;
        rawNormalized = Math.max(0.08, Math.min(Math.abs(wave), 0.7));
      } else {
        // Paused state: slowly decay to 0
        rawNormalized = 0;
      }

      // Smooth temporal interpolation
      const smoothFactor = 0.35;
      smoothedBars[i] = smoothedBars[i] + (rawNormalized - smoothedBars[i]) * smoothFactor;
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

    // 智能休眠判断: 如果未播放且信号已全部衰减至 0，则停止 RAF
    if (!isPlaying && !hasActiveSignal) {
      isRunningRef.current = false;
      animFrameRef.current = null;
      return;
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [barCount, currentSong, glowIntensity, height, isPlaying]);

  // Start loop helper
  const startLoop = useCallback(() => {
    if (!isRunningRef.current && isVisibleRef.current) {
      isRunningRef.current = true;
      animFrameRef.current = requestAnimationFrame(renderFrame);
    }
  }, [renderFrame]);

  // Stop loop helper
  const stopLoop = useCallback(() => {
    isRunningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // React to playback state changes
  useEffect(() => {
    if (isPlaying && isVisibleRef.current) {
      startLoop();
    }
  }, [isPlaying, startLoop]);

  // Smart Visibility & IntersectionObserver for Energy Saving (智能休眠)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          isVisibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting && isPlaying) {
            startLoop();
          } else if (!entry.isIntersecting) {
            stopLoop();
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(container);
    }

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.hidden) {
        isVisibleRef.current = false;
        stopLoop();
      } else {
        isVisibleRef.current = true;
        if (isPlaying) {
          startLoop();
        }
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // Initial check
    startLoop();

    return () => {
      if (observer) {
        observer.disconnect();
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      stopLoop();
    };
  }, [isPlaying, startLoop, stopLoop]);

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-xl bg-black/30 backdrop-blur-md p-1 border border-white/[0.06] ${className}`}
      style={{ height, touchAction: "none" }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
