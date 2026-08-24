"use client";

import React, { memo } from "react";

interface DualBreathingAuraRaysProps {
  primary?: string;
  secondary?: string;
  accent?: string;
  isPlaying?: boolean;
  className?: string;
}

export const DualBreathingAuraRays: React.FC<DualBreathingAuraRaysProps> = memo(
  ({
    primary = "#8b5cf6",
    secondary = "#3b82f6",
    accent = "#ec4899",
    isPlaying = false,
    className = "",
  }) => {
    return (
      <div
        className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none transform-gpu z-[1] ${className}`}
        aria-hidden="true"
      >
        {/* ─── 第一条：左上方轻倾流光弧 (100% GPU Composited CSS Keyframe) ─── */}
        <div
          className={`absolute -top-[10%] -left-[10%] w-[65vw] max-w-[880px] h-[280px] rounded-[100%] mix-blend-screen transform-gpu origin-top-left transition-colors duration-1000 ease-out ${
            isPlaying ? "animate-aura-ray-1" : "opacity-[0.05]"
          }`}
          style={{
            background: `radial-gradient(ellipse 60% 45% at 50% 50%, ${primary} 0%, ${accent} 40%, rgba(0,0,0,0) 75%)`,
            transform: "rotate(-22deg)",
            filter: "blur(40px)",
          }}
        />

        {/* ─── 第二条：右下方呼应流光弧 (100% GPU Composited CSS Keyframe) ─── */}
        <div
          className={`absolute -bottom-[10%] -right-[8%] w-[70vw] max-w-[950px] h-[300px] rounded-[100%] mix-blend-screen transform-gpu origin-bottom-right transition-colors duration-1000 ease-out ${
            isPlaying ? "animate-aura-ray-2" : "opacity-[0.04]"
          }`}
          style={{
            background: `radial-gradient(ellipse 65% 50% at 50% 50%, ${secondary} 0%, ${primary} 45%, rgba(0,0,0,0) 75%)`,
            transform: "rotate(24deg)",
            filter: "blur(45px)",
          }}
        />
      </div>
    );
  }
);

DualBreathingAuraRays.displayName = "DualBreathingAuraRays";
