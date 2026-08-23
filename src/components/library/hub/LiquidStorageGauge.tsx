"use client";

import React, { useEffect, useRef } from "react";
import { formatStorageBytes } from "@/store/useStorageAnalyticsStore";

interface LiquidStorageGaugeProps {
  usedBytes: number;
  quotaBytes: number;
  usagePercent: number;
  className?: string;
}

export const LiquidStorageGauge: React.FC<LiquidStorageGaugeProps> = ({
  usedBytes,
  quotaBytes,
  usagePercent,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let step = 0;
    const targetFill = Math.max(0.08, Math.min(0.98, usagePercent / 100));
    let currentFill = 0.05;
    let isMounted = true;

    const render = () => {
      if (!isMounted) return;
      if (!canvas.offsetParent) {
        animRef.current = requestAnimationFrame(render);
        return;
      }
      step += 0.035;
      currentFill += (targetFill - currentFill) * 0.04;

      const width = canvas.width;
      const height = canvas.height;
      const radius = width / 2 - 8;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw outer glowing boundary circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Outer ambient glow ring
      const ringGrad = ctx.createLinearGradient(0, 0, width, height);
      ringGrad.addColorStop(0, "rgba(59, 130, 246, 0.35)");
      ringGrad.addColorStop(0.5, "rgba(147, 51, 234, 0.25)");
      ringGrad.addColorStop(1, "rgba(236, 72, 153, 0.35)");
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Clip inside circle for liquid wave
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
      ctx.clip();

      // Dark obsidian liquid background
      ctx.fillStyle = "rgba(10, 12, 22, 0.75)";
      ctx.fillRect(0, 0, width, height);

      // Water wave calculation
      const waveHeight = 6;
      const baseWaterY = height - (height * currentFill);

      // Back wave (Subtle purple)
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 2) {
        const y = baseWaterY + Math.sin(x * 0.035 + step * 0.8) * (waveHeight * 0.8) - 2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      const backGrad = ctx.createLinearGradient(0, baseWaterY, 0, height);
      backGrad.addColorStop(0, "rgba(147, 51, 234, 0.45)");
      backGrad.addColorStop(1, "rgba(79, 70, 229, 0.85)");
      ctx.fillStyle = backGrad;
      ctx.fill();

      // Front wave (Vibrant Cyan / Blue)
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 2) {
        const y = baseWaterY + Math.cos(x * 0.032 - step) * waveHeight;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      const frontGrad = ctx.createLinearGradient(0, baseWaterY - 10, 0, height);
      frontGrad.addColorStop(0, "rgba(56, 189, 248, 0.75)");
      frontGrad.addColorStop(0.5, "rgba(59, 130, 246, 0.85)");
      frontGrad.addColorStop(1, "rgba(30, 58, 138, 0.95)");
      ctx.fillStyle = frontGrad;
      ctx.fill();

      // Surface specular foam line
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const y = baseWaterY + Math.cos(x * 0.032 - step) * waveHeight;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Floating light bubbles
      const bubbleCount = 4;
      for (let b = 0; b < bubbleCount; b++) {
        const bx = centerX + Math.sin(step + b * 2) * (radius * 0.45);
        const by = baseWaterY + 15 + ((step * 18 + b * 22) % Math.max(10, height - baseWaterY - 10));
        ctx.beginPath();
        ctx.arc(bx, by, 1.5 + (b % 2), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fill();
      }

      ctx.restore();

      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [usagePercent]);

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <div className="relative w-44 h-44 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={176}
          height={176}
          className="w-full h-full drop-shadow-[0_12px_32px_rgba(59,130,246,0.3)]"
        />

        {/* Center overlay percentage typography */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
          <span className="text-[28px] font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] font-mono leading-none">
            {usagePercent < 0.1 ? "< 0.1" : usagePercent.toFixed(1)}%
          </span>
          <span className="text-[10px] tracking-wider uppercase font-semibold text-cyan-200/80 drop-shadow mt-1">
            已用配额
          </span>
        </div>
      </div>

      {/* Storage Capacity Subtitle */}
      <div className="mt-2.5 text-center">
        <div className="text-xs font-semibold text-white/90 font-mono">
          {formatStorageBytes(usedBytes)} / {formatStorageBytes(quotaBytes)}
        </div>
        <div className="text-[10px] text-white/40 mt-0.5">
          本地 IndexedDB & 离线沙盒空间
        </div>
      </div>
    </div>
  );
};
