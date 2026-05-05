"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "filled";
  size?: "sm" | "md" | "lg" | "xl" | "icon";
  rounded?: "full" | "lg" | "md";
  pressed?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  onClick,
  className = "",
  disabled = false,
  variant = "primary",
  size = "md",
  rounded = "full",
  pressed = false,
}) => {
  const baseClasses = `
    relative overflow-hidden
    backdrop-blur-[20px] saturate-[180%]
    border
    transition-all duration-300 ease-out
    flex items-center justify-center
    font-medium
    select-none
    focus:outline-none
    disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
  `;

  const variantClasses = {
    primary: `
      bg-white/10 border-white/[0.08]
      hover:bg-white/20 hover:border-white/[0.15] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]
      active:scale-[0.92] active:opacity-70
      text-white
    `,
    secondary: `
      bg-white/[0.03] border-white/[0.05]
      hover:bg-white/[0.08] hover:border-white/[0.1] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)]
      active:scale-[0.92] active:opacity-70
      text-white/80
    `,
    ghost: `
      bg-transparent border-transparent
      hover:bg-white/[0.08] hover:text-white
      active:scale-[0.95] active:opacity-70
      text-white/60
    `,
    filled: `
      bg-white border-white
      hover:shadow-[0_8px_32px_rgba(255,255,255,0.2)]
      active:scale-[0.92] active:opacity-90
      text-black
    `,
  };

  const sizeClasses = {
    sm: "px-4 py-1.5 text-xs gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-7 py-3.5 text-base gap-2.5",
    xl: "px-9 py-4 text-lg gap-3",
    icon: "w-9 h-9",
  };

  const roundedClasses = {
    full: "rounded-full",
    lg: "rounded-2xl",
    md: "rounded-xl",
  };

  const buttonContent = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${roundedClasses[rounded]}
        ${className}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.1] via-transparent to-black/[0.05] pointer-events-none" />
      <div className="relative z-10 flex items-center gap-2">
        {children}
      </div>
    </button>
  );

  if (pressed || (variant === "primary" && !disabled)) {
    return (
      <motion.div
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1 }}
        transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {buttonContent}
      </motion.div>
    );
  }

  return buttonContent;
};