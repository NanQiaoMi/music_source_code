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
  songId: _songId,
  audioElement,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const [isReady, setIsReady] = useState(false);

  const { isGenerating, generationProgress, waveformColor, backgroundColor } = useWaveformStore();

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

  const drawWaveform = useCallback(
    function drawWaveform() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const analyser = getAudioAnalyser();

      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 尺寸取画布自身的渲染盒：clientWidth/Height 不含祖先的 CSS 变换，
      // 而 getBoundingClientRect 会把 transform 算进去，布局动画期间量到的是缩放后的盒子
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // 尺寸为 0 时跳过绘制，避免生成退化的后备存储
      if (width <= 0 || height <= 0) {
        animationRef.current = requestAnimationFrame(drawWaveform);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const backingWidth = Math.round(width * dpr);
      const backingHeight = Math.round(height * dpr);

      // 只在真正变化时重设后备存储（重设会清空画布）；取整后再比较，
      // 否则 dpr 为小数时 canvas.width 被截断，判定永远成立而每帧重设
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      // 变换每帧都设一遍：画布一旦被重设，之前设过的 scale 就丢了
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      if (!analyser) {
        animationRef.current = requestAnimationFrame(drawWaveform);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      // 复用同一个缓冲，避免每帧分配一个新的 Uint8Array
      if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
        dataArrayRef.current = new Uint8Array(bufferLength);
      }
      const dataArray = dataArrayRef.current;
      analyser.getByteTimeDomainData(dataArray as Uint8Array<ArrayBuffer>);

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
    },
    [audioElement, waveformColor, backgroundColor]
  );

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
