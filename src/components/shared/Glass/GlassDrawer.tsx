"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  },
  transition: {
    spring: { type: "spring" as const, damping: 28, stiffness: 280 },
  },
};

type DrawerHeight = "auto" | "half" | "full";

interface GlassDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: DrawerHeight;
  className?: string;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
}

const heightStyles: Record<DrawerHeight, string> = {
  auto: "max-h-[80vh]",
  half: "h-[50vh]",
  full: "h-[90vh]",
};

export function GlassDrawer({
  isOpen,
  onClose,
  title,
  children,
  height = "auto",
  className = "",
  headerRight,
  footer,
}: GlassDrawerProps) {
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

          {/* Drawer */}
          <motion.div
            className={`
              fixed bottom-0 left-0 right-0 z-50
              ${heightStyles[height]}
              ${apple.panel.bg} ${apple.panel.blur} ${apple.panel.saturate}
              ${apple.panel.border}
              flex flex-col
              ${className}
            `}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.23, 1, 0.32, 1],
            }}
            style={{
              borderRadius: "12px 12px 0 0",
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
            }}
          >
            {/* Drag handle — Apple style */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-9 h-[5px] rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 pt-2 pb-3">
              {title && (
                <h2 className="text-[17px] font-semibold text-white tracking-[-0.01em]">{title}</h2>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {headerRight}
                <button
                  onClick={onClose}
                  className="w-[30px] h-[30px] rounded-full bg-white/[0.12] hover:bg-white/[0.20] flex items-center justify-center transition-colors duration-150"
                  aria-label="关闭"
                >
                  <svg
                    className="w-[14px] h-[14px]"
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
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">{children}</div>

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
