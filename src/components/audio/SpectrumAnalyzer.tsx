"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSpectrumStore } from "@/store/spectrumStore";
import { getAudioAnalyser } from "@/hooks/useAudioPlayer";
import { AudioEngine } from "@/lib/audio/AudioEngine";

interface SpectrumAnalyzerProps {
  audioElement?: HTMLAudioElement | null;
  className?: string;
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  audioElement: _audioElement,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const [isReady, setIsReady] = useState(false);

  const { isSpectrumEnabled, barColor, backgroundColor, gridColor } = useSpectrumStore();

  useEffect(() => {
    const checkReady = () => {
      const analyser = getAudioAnalyser();
      if (analyser) {
        setIsReady(true);
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  }, []);

  useEffect(() => {
    if (!isSpectrumEnabled || !isReady) return;

    function drawSpectrum() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const analyser = getAudioAnalyser();

      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 以画布自身的渲染盒为准：容器一旦有 padding/border，容器尺寸就大于画布的内容盒，
      // 后备存储与显示比例不符会让画面被压扁
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // 尺寸为 0 时跳过绘制，避免生成退化的后备存储
      if (width <= 0 || height <= 0) {
        animationRef.current = requestAnimationFrame(drawSpectrum);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const backingWidth = Math.round(width * dpr);
      const backingHeight = Math.round(height * dpr);

      // 原来每帧无条件重设后备存储（等于每帧清空画布）；改为仅在变化时重设，
      // 并在取整后比较，否则 dpr 为小数时 canvas.width 被截断导致判定永远成立
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      // 变换每帧重设一遍：画布一旦被重设，之前设过的 scale 就丢了
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      if (!analyser) {
        animationRef.current = requestAnimationFrame(drawSpectrum);
        return;
      }

      const engine = AudioEngine.getInstance();
      const frequencyBinCount = engine.frequencyBinCount;

      // Use a persistent array to avoid allocations
      if (!dataArrayRef.current || dataArrayRef.current.length !== frequencyBinCount) {
        dataArrayRef.current = new Uint8Array(frequencyBinCount);
      }

      const dataArray = dataArrayRef.current;
      engine.getByteFrequencyData(dataArray);

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      for (let i = 0; i < 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const barWidth = width / Math.min(frequencyBinCount, 128);
      const numBars = Math.min(frequencyBinCount, 128);

      ctx.fillStyle = barColor;

      for (let i = 0; i < numBars; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = percent * height;

        const x = (i / numBars) * width;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
      }

      animationRef.current = requestAnimationFrame(drawSpectrum);
    }

    animationRef.current = requestAnimationFrame(drawSpectrum);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [backgroundColor, barColor, gridColor, isReady, isSpectrumEnabled]);

  if (!isSpectrumEnabled) {
    return (
      <div className={`relative ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white/40 text-sm">频谱分析仪已关闭</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" style={{ touchAction: "none" }} />

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white/40 text-sm">正在初始化音频...</div>
        </div>
      )}
    </div>
  );
};
