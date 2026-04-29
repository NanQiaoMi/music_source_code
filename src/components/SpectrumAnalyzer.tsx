"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { useSpectrumStore } from "@/store/spectrumStore";
import { getAudioAnalyser, getAudioContext } from "@/hooks/useAudioPlayer";

interface SpectrumAnalyzerProps {
  audioElement?: HTMLAudioElement | null;
  className?: string;
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  audioElement,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  const {
    isSpectrumEnabled,
    barColor,
    backgroundColor,
    gridColor,
  } = useSpectrumStore();

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

  const drawSpectrum = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const analyser = getAudioAnalyser();

    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (!analyser) {
      animationRef.current = requestAnimationFrame(drawSpectrum);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    for (let i = 0; i < 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const barWidth = width / Math.min(bufferLength, 128);
    const numBars = Math.min(bufferLength, 128);

    ctx.fillStyle = barColor;

    for (let i = 0; i < numBars; i++) {
      const value = dataArray[i];
      const percent = value / 255;
      const barHeight = percent * height;

      const x = (i / numBars) * width;
      ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
    }

    animationRef.current = requestAnimationFrame(drawSpectrum);
  }, [isSpectrumEnabled, barColor, backgroundColor, gridColor, isReady]);

  useEffect(() => {
    if (isSpectrumEnabled && isReady) {
      animationRef.current = requestAnimationFrame(drawSpectrum);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSpectrumEnabled, isReady, drawSpectrum]);

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