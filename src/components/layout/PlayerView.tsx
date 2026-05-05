"use client";

import React from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { Player3D } from "@/components/player/Player3D";

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 1,
  bounce: 0
};

/**
 * PlayerView - The immersive 3D player view.
 * 
 * Extracted from page.tsx to isolate player-specific layout and animation.
 */
export function PlayerView() {
  const { currentView } = useUIStore();

  return (
    <motion.div
      className="absolute inset-0"
      initial={false}
      animate={{
        opacity: currentView === "player" ? 1 : 0,
        x: currentView === "player" ? 0 : 60,
        scale: currentView === "player" ? 1 : 0.94,
      }}
      transition={APPLE_SPRING_CONFIG}
      style={{
        pointerEvents: currentView === "player" ? "auto" : "none",
        visibility: currentView === "player" ? "visible" : "hidden",
        willChange: "transform, opacity",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    >
      <Player3D />
    </motion.div>
  );
}
