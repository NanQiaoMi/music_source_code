/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Box } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

export function Apple3DQueueDrawer() {
  const { panels, openPanel, closePanel, togglePanel } = useUIStore();
  const isOpen = Boolean(panels.shelf3D);

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
    togglePanel("shelf3D");
  }, [togglePanel]);

  // Global Keyboard Shortcut (Esc to close)
  // 开关本面板的 Q / ⌘L 已交由中枢绑定表统一处理（keyboardShortcutsStore 的 toggle-queue），
  // 这里原先也监听同样的按键去切换同一个面板，两个处理器互相抵消，已移除。
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
        closePanel("shelf3D");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePanel]);

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
        openPanel("shelf3D");
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
          title="点击或停驻呼出 3D 空间唱片架 (快捷键 Q / ⌘L)"
        >
          {/* Subtle micro-glow translucent pill */}
          <motion.div
            animate={{
              width: isHandleHovered ? 44 : 5,
              height: isHandleHovered ? 120 : 64,
              opacity: isHandleHovered ? 1 : 0.45,
              x: 0,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={`rounded-l-2xl border-y border-l flex items-center justify-center overflow-hidden transition-colors ${
              isHandleHovered
                ? "bg-black/85 backdrop-blur-2xl border-cyan-400/40 shadow-[0_0_28px_rgba(6,182,212,0.5)]"
                : "bg-white/20 border-white/10 hover:bg-white/30"
            }`}
          >
            {isHandleHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-1.5 text-white/90"
              >
                <Box className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="text-[9px] font-mono font-bold leading-none text-cyan-200">
                  3D
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
