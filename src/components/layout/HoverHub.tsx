/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { PanelName } from "@/store/uiStore";

export interface HubItem {
  id: PanelName | string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  desc?: string;
  badge?: string;
}

interface HoverHubProps {
  label: string;
  mainIcon: React.ReactNode;
  items: HubItem[];
  accentColor?: string;
}

// Apple-style spring physics
const HUB_TRANSITION = {
  type: "spring" as const,
  stiffness: 350,
  damping: 28,
  mass: 0.8,
};

const CONTAINER_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    y: 6,
    scale: 0.97,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...HUB_TRANSITION,
      staggerChildren: 0.02,
      delayChildren: 0.01,
    },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.98,
    transition: {
      duration: 0.12,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, x: -4 },
  visible: {
    opacity: 1,
    x: 0,
    transition: HUB_TRANSITION,
  },
};

export const HoverHub: React.FC<HoverHubProps> = ({
  label,
  mainIcon,
  items,
  accentColor = "rgba(255, 255, 255, 0.4)",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  return (
    <div className="relative flex-shrink-0" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        className="h-9 px-3 rounded-xl flex items-center gap-2 transition-all duration-300 group relative whitespace-nowrap flex-shrink-0 select-none text-left"
        style={{
          background: isOpen ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
          border: isOpen ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(255, 255, 255, 0.05)",
          color: isOpen ? "#ffffff" : "rgba(255, 255, 255, 0.75)",
        }}
      >
        <motion.div
          animate={{ scale: isOpen ? 1.08 : 1 }}
          transition={HUB_TRANSITION}
          className="relative flex items-center justify-center shrink-0"
        >
          {mainIcon}
          {isOpen && (
            <motion.div
              layoutId={`hub-glow-${label}`}
              className="absolute inset-0 blur-lg rounded-full -z-10 opacity-50"
              style={{ background: accentColor }}
              initial={{ scale: 0 }}
              animate={{ scale: 1.4 }}
            />
          )}
        </motion.div>

        <span className="text-[13px] font-medium tracking-tight whitespace-nowrap flex-shrink-0 group-hover:text-white transition-colors">
          {label}
        </span>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={HUB_TRANSITION}
          className="opacity-40 group-hover:opacity-80 shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={CONTAINER_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute left-0 top-full mt-2 w-[256px] bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden z-[9999] select-none font-sans"
            style={{
              willChange: "transform, opacity",
              transformOrigin: "top left",
            }}
          >
            <div className="p-2 space-y-0.5">
              {items.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  variants={ITEM_VARIANTS}
                  whileHover={{ x: 4, backgroundColor: "rgba(255, 255, 255, 0.08)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    item.action();
                    setIsOpen(false);
                  }}
                  className="w-full group flex items-start gap-3 p-2.5 rounded-xl transition-all text-left"
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-white/[0.06] group-hover:bg-white/15 transition-all text-white/80 group-hover:text-white shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[13px] font-medium text-white tracking-tight truncate group-hover:text-white transition-colors">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/10 text-white/70">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.desc && (
                      <p className="text-[11px] text-[#86868b] leading-tight mt-0.5 truncate group-hover:text-white/60 transition-colors">
                        {item.desc}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            <div
              className="h-[1px] w-full opacity-30"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
