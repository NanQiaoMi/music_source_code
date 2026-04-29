"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

export interface VisualizerConfig {
  enabled: boolean;
  position: "top" | "bottom" | "center";
  size: number;
  opacity: number;
  colorScheme: "gradient" | "mono" | "spectrum";
  primaryColor: string;
  secondaryColor: string;
  barCount: number;
  barSpacing: number;
  barWidth: number;
  barHeight: number;
  animationSpeed: number;
  smoothing: number;
}

export const defaultVisualizerConfig: VisualizerConfig = {
  enabled: true,
  position: "top",
  size: 100,
  opacity: 0.7,
  colorScheme: "gradient",
  primaryColor: "#FFFFFF",
  secondaryColor: "#8B5CF6",
  barCount: 64,
  barSpacing: 2,
  barWidth: 4,
  barHeight: 100,
  animationSpeed: 1,
  smoothing: 0.8,
};

interface AppleMusicVisualizerProps {
  config: VisualizerConfig;
}

export const AppleMusicVisualizer: React.FC<AppleMusicVisualizerProps> = ({ config }) => {
  const { audioElement } = useAudioPlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const prevDataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!config.enabled) return;
    if (!audioElement) return;

    let audioContext = audioContextRef.current;
    let analyser = analyserRef.current;
    let source = sourceRef.current;

    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source = audioContext.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      sourceRef.current = source;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyser || !canvas) return;

      const width = canvas.width;
      const height = canvas.height;

      analyser.getByteFrequencyData(dataArray);

      let processedData = new Uint8Array(bufferLength);
      if (prevDataRef.current) {
        for (let i = 0; i < bufferLength; i++) {
          processedData[i] = Math.round(
            prevDataRef.current[i] * config.smoothing + dataArray[i] * (1 - config.smoothing)
          );
        }
      } else {
        processedData = dataArray;
      }
      prevDataRef.current = processedData;

      ctx.clearRect(0, 0, width, height);

      const barCount = config.barCount;
      const barWidth = config.barWidth;
      const barSpacing = config.barSpacing;
      const totalWidth = barCount * (barWidth + barSpacing) - barSpacing;
      const startX = (width - totalWidth) / 2;
      const maxBarHeight = config.barHeight;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const value = processedData[dataIndex] || 0;
        const barHeight = (value / 255) * maxBarHeight;

        const x = startX + i * (barWidth + barSpacing);
        const y = (height - barHeight) / 2;

        switch (config.colorScheme) {
          case "mono":
            ctx.fillStyle = config.primaryColor;
            break;
          case "spectrum":
            const hue = (i / barCount) * 360;
            ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${config.opacity})`;
            break;
          case "gradient":
          default:
            const gradient = ctx.createLinearGradient(x, y + barHeight, x, y);
            gradient.addColorStop(0, config.secondaryColor);
            gradient.addColorStop(1, config.primaryColor);
            ctx.fillStyle = gradient;
            break;
        }

        ctx.globalAlpha = config.opacity;
        ctx.beginPath();

        const radius = barWidth / 2;
        ctx.moveTo(x + radius, y + barHeight);
        ctx.lineTo(x + barWidth - radius, y + barHeight);
        ctx.quadraticCurveTo(x + barWidth, y + barHeight, x + barWidth, y + barHeight - radius);
        ctx.lineTo(x + barWidth, y + radius);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth - radius, y);
        ctx.lineTo(x + radius, y);
        ctx.quadraticCurveTo(x, y, x, y + radius);
        ctx.lineTo(x, y + barHeight - radius);
        ctx.quadraticCurveTo(x, y + barHeight, x + radius, y + barHeight);
        ctx.closePath();
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [config, audioElement]);

  const positionClass = React.useMemo(() => {
    switch (config.position) {
      case "top":
        return "top-0";
      case "bottom":
        return "bottom-0";
      case "center":
      default:
        return "top-1/2 -translate-y-1/2";
    }
  }, [config.position]);

  const size = config.size;
  const canvasSize = Math.max(320, size * 4);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className={`fixed left-1/2 -translate-x-1/2 ${positionClass} pointer-events-none z-[60]`}
      style={{
        width: `${size}%`,
        maxWidth: "800px",
      }}
    >
      <div className="relative w-full h-48">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={200}
          className="w-full h-full"
          style={{
            filter: "blur(0.5px)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 70%)",
          }}
        />
      </div>
    </motion.div>
  );
};
