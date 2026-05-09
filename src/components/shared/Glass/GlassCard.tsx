"use client";

import React from "react";
import { motion } from "framer-motion";
import { glass } from "@/lib/tokens";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  blur?: number;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  hover?: boolean;
  hoverScale?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const ROUNDED_VALUES = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "2rem",
  full: "9999px",
};

export function GlassCard({
  children,
  className = "",
  blur = 24,
  rounded = "3xl",
  hover = true,
  hoverScale = 1.02,
  onClick,
  style,
}: GlassCardProps) {
  const Component = onClick || hover ? motion.div : "div";
  const motionProps = hover
    ? {
        whileHover: { scale: hoverScale },
        transition: {
          duration: 0.3,
          ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
        },
      }
    : {};

  return (
    <Component
      onClick={onClick}
      className={`
        relative overflow-hidden
        backdrop-blur-[24px] saturate-[180%]
        bg-white/[0.05] dark:bg-white/[0.04]
        border border-white/[0.12]
        ${hover ? "transition-all duration-300 ease-out hover:border-white/[0.15] hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]" : ""}
        ${onClick ? "cursor-pointer" : ""}
        shadow-[0_16px_40px_rgba(0,0,0,0.25)]
        ${className}
      `}
      style={
        {
          backdropFilter: `blur(${blur}px) saturate(180%)`,
          WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
          borderRadius: ROUNDED_VALUES[rounded] || rounded,
          ...style,
        } as React.CSSProperties
      }
      {...motionProps}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-black/[0.08] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
      {children}
    </Component>
  );
}
