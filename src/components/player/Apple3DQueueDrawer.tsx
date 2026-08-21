/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ListMusic } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useQueueStore } from "@/store/queueStore";

export function Apple3DQueueDrawer() {
  const { panels, openPanel, closePanel, togglePanel } = useUIStore();
  const isOpen = Boolean(panels.queue || panels.shelf3D);

  const { queue } = useQueueStore();
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Velocity and Dwell State Tracking
  const lastMousePosRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Responsive screen check
  useEffect(() => {
    const checkScreen = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const handleToggle = useCallback(() => {
    togglePanel("queue");
  }, [togglePanel]);

  // Global Keyboard Shortcuts (Esc to close, Q / Cmd+L to toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in form inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closePanel("queue");
        closePanel("shelf3D");
      } else if (e.key === "q" || e.key === "Q") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleToggle();
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        handleToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleToggle, closePanel]);

  // High-precision anti-accidental edge sensor
  const handleHandleMouseEnter = () => {
    setIsHandleHovered(true);
  };

  const handleHandleMouseLeave = () => {
    setIsHandleHovered(false);
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  };

  const handleHandleMouseMove = (e: React.MouseEvent) => {
    const now = performance.now();
    const prev = lastMousePosRef.current;
    const dt = Math.max(1, now - prev.time);
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    const velocity = Math.hypot(dx, dy) / dt;

    lastMousePosRef.current = { x: e.clientX, y: e.clientY, time: now };

    // Strict physical exclude zones: top 0-90px (window buttons), bottom 0-80px (player bar)
    if (e.clientY < 90 || e.clientY > window.innerHeight - 80) {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      return;
    }

    // Velocity Gate: If moving fast (> 0.35px/ms), cancel dwell trigger
    if (velocity > 0.35) {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      return;
    }

    // Start 400ms deliberate dwell timer
    if (!dwellTimerRef.current && !isOpen) {
      dwellTimerRef.current = setTimeout(() => {
        openPanel("queue");
        dwellTimerRef.current = null;
      }, 400);
    }
  };

  return (
    <>
      {/* ─── Apple-Style Right Edge Smart Handle (Desktop only) ─── */}
      {isDesktop && !isOpen && (
        <div
          onMouseEnter={handleHandleMouseEnter}
          onMouseLeave={handleHandleMouseLeave}
          onMouseMove={handleHandleMouseMove}
          onClick={handleToggle}
          className="fixed top-1/2 -translate-y-1/2 right-0 z-40 h-36 flex items-center justify-end pointer-events-auto cursor-pointer select-none group"
          title="点击或停驻呼出播放列表 (快捷键 Q / ⌘L)"
        >
          {/* Subtle micro-glow translucent pill */}
          <motion.div
            animate={{
              width: isHandleHovered ? 40 : 5,
              height: isHandleHovered ? 120 : 64,
              opacity: isHandleHovered ? 1 : 0.45,
              x: 0,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={`rounded-l-2xl border-y border-l flex items-center justify-center overflow-hidden transition-colors ${
              isHandleHovered
                ? "bg-black/80 backdrop-blur-2xl border-white/20 shadow-[0_0_24px_rgba(41,151,255,0.4)]"
                : "bg-white/20 border-white/10 hover:bg-white/30"
            }`}
          >
            {isHandleHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-1.5 text-white/90"
              >
                <ListMusic className="w-4 h-4 text-[#2997ff]" />
                <span className="text-[10px] font-mono font-bold leading-none text-white/80">
                  {queue.length}
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
