"use client";

import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 1,
  bounce: 0
};

interface GlassSliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  showThumb?: boolean;
  thumbSize?: "sm" | "md" | "lg";
  variant?: "default" | "gradient";
  gradientColors?: string;
  disabled?: boolean;
}

const THUMB_SIZES = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

export const GlassSlider: React.FC<GlassSliderProps> = ({
  value,
  min = 0,
  max = 100,
  onChange,
  className = "",
  trackClassName = "",
  fillClassName = "",
  showThumb = true,
  thumbSize = "md",
  variant = "default",
  gradientColors = "from-white/90 via-white/70 to-white/50",
  disabled = false,
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const percentage = ((value - min) / (max - min)) * 100;

  const updateValue = useCallback(
    (clientX: number) => {
      if (!sliderRef.current || disabled) return;

      const rect = sliderRef.current.getBoundingClientRect();
      let newPercentage = ((clientX - rect.left) / rect.width) * 100;
      newPercentage = Math.max(0, Math.min(100, newPercentage));

      const newValue = min + (newPercentage / 100) * (max - min);
      onChange(newValue);
    },
    [min, max, onChange, disabled]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    updateValue(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    updateValue(e.touches[0].clientX);
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    setIsHovering(false);
    setIsDragging(false);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updateValue(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        updateValue(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, updateValue]);

  return (
    <div
      ref={sliderRef}
      className={`
        relative w-full h-2.5
        cursor-pointer select-none
        group
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`
          absolute inset-0
          bg-white/[0.08] rounded-full
          backdrop-blur-sm
          transition-all duration-200
          ${trackClassName}
        `}
      />

      <motion.div
        className={`
          absolute left-0 top-0 bottom-0
          rounded-full
          ${variant === "gradient" ? `bg-gradient-to-r ${gradientColors}` : "bg-white/70"}
          shadow-[0_0_12px_rgba(255,255,255,0.3)]
          transition-all duration-100
          ${fillClassName}
        `}
        style={{ width: `${percentage}%` }}
        transition={APPLE_SPRING_CONFIG}
      />

      <AnimatePresence>
        {showThumb && !disabled && (
          <motion.div
            className={`
              absolute top-1/2 -translate-y-1/2
              ${THUMB_SIZES[thumbSize]}
              bg-white rounded-full
              shadow-[0_2px_8px_rgba(0,0,0,0.3),0_0_20px_rgba(255,255,255,0.2)]
              pointer-events-none
            `}
            style={{
              left: `calc(${percentage}% - ${
                thumbSize === "sm" ? "6px" : thumbSize === "md" ? "8px" : "10px"
              })`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: isDragging || isHovering ? 1 : 0,
              opacity: isDragging || isHovering ? 1 : 0,
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={APPLE_SPRING_CONFIG}
          />
        )}
      </AnimatePresence>
    </div>
  );
};