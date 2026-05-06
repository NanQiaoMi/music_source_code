"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

// Apple-style design tokens
const apple = {
  panel: {
    bg: "bg-black/60",
    blur: "backdrop-blur-[40px]",
    saturate: "saturate-[180%]",
    border: "border border-white/[0.08]",
  },
  close: {
    bg: "bg-white/[0.12]",
    bgHover: "hover:bg-white/[0.20]",
    size: "w-[30px] h-[30px]",
    iconSize: "w-[14px] h-[14px]",
  },
  transition: {
    spring: { type: "spring" as const, damping: 28, stiffness: 280 },
  },
};

type PanelPosition = "right" | "left";
type PanelSize = "sm" | "md" | "lg";

interface GlassPanelProps {
  position?: PanelPosition;
  size?: PanelSize;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Extra actions shown next to the close button (e.g. Clear button) */
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeStyles: Record<PanelSize, string> = {
  sm: "w-[320px]",
  md: "w-[400px]",
  lg: "w-[520px]",
};

export function GlassPanel({
  position = "right",
  size = "md",
  isOpen,
  onClose,
  title,
  children,
  className = "",
  headerRight,
  footer,
}: GlassPanelProps) {
  const isRight = position === "right";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className={`
              fixed top-0 bottom-0 z-50
              ${isRight ? "right-0" : "left-0"}
              ${sizeStyles[size]}
              ${apple.panel.bg} ${apple.panel.blur} ${apple.panel.saturate}
              ${apple.panel.border}
              flex flex-col
              ${className}
            `}
            initial={{ x: isRight ? "100%" : "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isRight ? "100%" : "-100%", opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.23, 1, 0.32, 1]
            }}
            style={{
              borderRadius: isRight ? "12px 0 0 12px" : "0 12px 12px 0",
              willChange: "transform, opacity",
              backfaceVisibility: "hidden"
            }}
          >
            {/* Header — Apple style: title centered, close button absolute right */}
            <div className="relative flex items-center justify-between px-5 pt-5 pb-3">
              {title && (
                <h2 className="text-[17px] font-semibold text-white tracking-[-0.01em]">
                  {title}
                </h2>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {headerRight}
                <button
                  onClick={onClose}
                  className={`
                    ${apple.close.size} rounded-full
                    ${apple.close.bg} ${apple.close.bgHover}
                    flex items-center justify-center
                    transition-colors duration-150
                  `}
                  aria-label="关闭"
                >
                  <svg
                    className={apple.close.iconSize}
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="white"
                    strokeWidth={2}
                    strokeLinecap="round"
                  >
                    <line x1="2" y1="2" x2="12" y2="12" />
                    <line x1="12" y1="2" x2="2" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-white/[0.08] mx-5" />

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <>
                <div className="h-px bg-white/[0.08] mx-5" />
                <div className="px-5 py-3">{footer}</div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
