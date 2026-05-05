"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { AppleDateTime } from "@/components/widgets/AppleDateTime";
import { MusicCardStack } from "@/components/player/MusicCardStack";
import { HeaderToolbar } from "./HeaderToolbar";

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 1,
  bounce: 0
};

/**
 * HomeView - The main library and homepage view.
 * 
 * Contains the date/time display, header toolbar, and music card stack.
 * Extracted from page.tsx to keep the layout manageable.
 */
export function HomeView() {
  const { currentView } = useUIStore();

  return (
    <>
      {/* Apple Style Date Time Display - Central Homepage Position */}
      <AnimatePresence>
        {currentView === "home" && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            transition={APPLE_SPRING_CONFIG}
            style={{
              zIndex: 10,
              top: "15%",
              left: "50%",
              position: "absolute",
            }}
            className="flex items-center justify-center scale-110 pointer-events-none"
          >
            <AppleDateTime />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Home View - GPU Optimized */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{
          opacity: currentView === "home" ? 1 : 0,
          x: currentView === "home" ? 0 : -60,
          scale: currentView === "home" ? 1 : 0.94,
        }}
        transition={APPLE_SPRING_CONFIG}
        style={{
          pointerEvents: currentView === "home" ? "auto" : "none",
          visibility: currentView === "home" ? "visible" : "hidden",
          willChange: "transform, opacity",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      >
        <HeaderToolbar />

        {/* Music Cards - Performance optimized */}
        <div
          className="absolute inset-0 pt-32"
          style={{
            opacity: currentView === "home" ? 1 : 0,
            transform:
              currentView === "home" ? "translateY(0) scale(1)" : "translateY(30px) scale(0.97)",
            transition: "opacity 0.35s ease, transform 0.35s ease",
            transitionDelay: currentView === "home" ? "0.06s" : "0s",
            willChange: "transform, opacity",
          }}
        >
          <MusicCardStack />
        </div>
      </motion.div>
    </>
  );
}
