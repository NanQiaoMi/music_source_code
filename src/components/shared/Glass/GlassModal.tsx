"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const apple = {
  modal: {
    bg: "bg-black/70",
    blur: "backdrop-blur-[50px]",
    saturate: "saturate-[180%]",
    border: "border border-white/[0.10]",
  },
  transition: {
    fast: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

type ModalWidth = "sm" | "md" | "lg";

interface GlassModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  width?: ModalWidth;
  className?: string;
  footer?: React.ReactNode;
}

const widthStyles: Record<ModalWidth, string> = {
  sm: "max-w-[360px]",
  md: "max-w-[480px]",
  lg: "max-w-[640px]",
};

export function GlassModal({
  isOpen,
  onClose,
  title,
  children,
  width = "md",
  className = "",
  footer,
}: GlassModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
            <motion.div
              className={`
                ${widthStyles[width]} w-full pointer-events-auto
                ${apple.modal.bg} ${apple.modal.blur} ${apple.modal.saturate}
                ${apple.modal.border}
                flex flex-col overflow-hidden
                ${className}
              `}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: [0.23, 1, 0.32, 1]
              }}
              style={{ 
                borderRadius: "14px",
                willChange: "transform, opacity",
                backfaceVisibility: "hidden"
              }}
            >
              {/* Header */}
              {(title || onClose) && (
                <>
                  <div className="relative flex items-center justify-between px-5 pt-5 pb-3">
                    {title && (
                      <h2 className="text-[17px] font-semibold text-white tracking-[-0.01em]">
                        {title}
                      </h2>
                    )}
                    {onClose && (
                      <button
                        onClick={onClose}
                        className="w-[30px] h-[30px] rounded-full bg-white/[0.12] hover:bg-white/[0.20] flex items-center justify-center transition-colors duration-150 ml-auto"
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
                    )}
                  </div>
                  <div className="h-px bg-white/[0.08] mx-5" />
                </>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 overscroll-contain">
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
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
