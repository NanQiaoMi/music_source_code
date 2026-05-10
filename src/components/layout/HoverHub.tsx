"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useUIStore, PanelName } from "@/store/uiStore";

interface HubItem {
  id: PanelName | string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  desc?: string;
}

interface HoverHubProps {
  label: string;
  mainIcon: React.ReactNode;
  items: HubItem[];
  accentColor?: string;
}

// Apple-style spring configuration
const HUB_TRANSITION = {
  duration: 0.3,
  ease: [0.23, 1, 0.32, 1] as const,
};

const CONTAINER_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...HUB_TRANSITION,
      staggerChildren: 0.03,
      delayChildren: 0.01,
    },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: {
      duration: 0.15,
        ease: [0.16, 1, 0.3, 1],
      },
    },
};

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 5 },
  visible: {
    opacity: 1,
    y: 0,
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
    }, 200);
  };

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className="h-10 px-3 rounded-lg flex items-center gap-2 transition-all duration-500 group relative"
        style={{
          background: isOpen ? "rgba(255, 255, 255, 0.1)" : "transparent",
          color: isOpen ? "#fff" : "var(--theme-text-secondary)",
        }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 5 : 0, scale: isOpen ? 1.1 : 1 }}
          className="relative flex items-center justify-center"
        >
          {mainIcon}
          {isOpen && (
            <motion.div
              layoutId={`hub-glow-${label}`}
              className="absolute inset-0 blur-xl rounded-full -z-10 opacity-40"
              style={{ background: accentColor }}
              initial={{ scale: 0 }}
              animate={{ scale: 1.5 }}
            />
          )}
        </motion.div>
        <span className="text-[13px] font-medium tracking-tight opacity-80 group-hover:opacity-100 transition-opacity">
          {label}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={HUB_TRANSITION}>
          <ChevronDown className="w-3.5 h-3.5 opacity-20" />
        </motion.div>

        {isOpen && (
          <motion.div
            layoutId={`hub-underline-${label}`}
            className="absolute bottom-1 left-3 right-3 h-[2px] rounded-full"
            style={{ background: accentColor }}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={CONTAINER_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute left-0 top-full mt-2 w-64 bg-black/70 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden z-[9999]"
            style={{
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
              transformOrigin: "top left",
            }}
          >
            <div className="p-2.5 space-y-0.5">
              {items.map((item) => (
                <motion.button
                  key={item.id}
                  variants={ITEM_VARIANTS}
                  whileHover={{ x: 4, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    item.action();
                    setIsOpen(false);
                  }}
                  className="w-full group flex items-start gap-3.5 p-2.5 rounded-xl transition-all text-left"
                >
                  <div className="mt-0.5 p-2 rounded-lg bg-white/5 group-hover:bg-white/10 group-hover:scale-110 transition-all text-white/40 group-hover:text-white">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                      {item.label}
                    </div>
                    {item.desc && (
                      <div className="text-[10px] text-white/20 leading-relaxed mt-0.5">
                        {item.desc}
                      </div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              className="h-[1px] w-full origin-left opacity-30"
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
