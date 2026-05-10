"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlassToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function GlassToggle({
  checked,
  onChange,
  label,
  className = "",
  disabled = false,
}: GlassToggleProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`
        flex items-center gap-3
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      <motion.div
        className={`
          relative w-[44px] h-[26px] rounded-full
          transition-colors duration-200
          ${checked ? "bg-white/70" : "bg-white/[0.15]"}
        `}
        animate={{ backgroundColor: checked ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)" }}
      >
        <motion.div
          className="absolute top-[3px] left-[3px] w-[20px] h-[20px] bg-black rounded-full shadow-md"
          animate={{ x: checked ? 18 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </motion.div>
      {label && (
        <span className="text-white/80 text-sm">{label}</span>
      )}
    </button>
  );
}