"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { useWaveformStore } from "@/store/waveformStore";
import { getAudioAnalyser } from "@/hooks/useAudioPlayer";

interface WaveformVisualizationProps {
  songId?: string;
  audioElement?: HTMLAudioElement | null;
  className?: string;
}

export const WaveformVisualization: React.FC<WaveformVisualizationProps> = ({
  songId,
  audioElement,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  const {
    isGenerating,
    generationProgress,
    showPeaks,
    waveformColor,
    backgroundColor,
  } = useWaveformStore();

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

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const analyser = getAudioAnalyser();

    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = container.getBoundingClientRect();
    
    // 只有在尺寸变化时才重置 canvas 大小
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (!analyser) {
      animationRef.current = requestAnimationFrame(drawWaveform);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.strokeStyle = waveformColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    if (audioElement) {
      const currentTime = audioElement.currentTime || 0;
      const duration = audioElement.duration || 1;
      const playheadX = (currentTime / duration) * width;

      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    animationRef.current = requestAnimationFrame(drawWaveform);
  }, [audioElement, waveformColor, backgroundColor, showPeaks, isReady]);

  useEffect(() => {
    if (isReady) {
      animationRef.current = requestAnimationFrame(drawWaveform);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReady, drawWaveform]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" style={{ touchAction: "none" }} />

      {isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white/40 text-sm">生成波形中... {generationProgress}%</div>
        </div>
      )}

      {!isReady && !isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white/40 text-sm">等待音频加载...</div>
        </div>
      )}
    </div>
  );
};