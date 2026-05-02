"use client";

import React from "react";
import { motion } from "framer-motion";
import { glass } from "@/lib/tokens";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  hoverScale?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function GlassCard({
  children,
  className = "",
  hover = true,
  hoverScale = 1.02,
  onClick,
  style,
}: GlassCardProps) {
  const Component = onClick || hover ? motion.div : "div";
  const motionProps = hover
    ? {
        whileHover: { scale: hoverScale },
        transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
      }
    : {};

  return (
    <Component
      onClick={onClick}
      className={`
        relative overflow-hidden
        ${glass.panel.blur} ${glass.panel.saturate}
        ${glass.panel.bg} ${glass.panel.border} ${glass.panel.radius}
        ${hover ? "transition-all duration-300 ease-out hover:border-white/[0.15] hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]" : ""}
        ${onClick ? "cursor-pointer" : ""}
        shadow-[0_16px_40px_rgba(0,0,0,0.25)]
        ${className}
      `}
      style={style}
      {...motionProps}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-black/[0.08] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
      {children}
    </Component>
  );
}
