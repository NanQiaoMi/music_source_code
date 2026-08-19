"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useFloatingDebugStore,
} from "@/store/floatingDebugStore";
import type { FloatingPlayerState } from "./useFloatingDragPhysics";
import {
  Sliders,
  X,
  RotateCcw,
  Sparkles,
  Activity,
  Gauge,
  Maximize,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

export interface FloatingDebugHUDProps {
  /** Controlled open state (if omitted, uses store state) */
  isOpen?: boolean;
  /** Close callback */
  onClose?: () => void;
  /** Callback to force switch floating player state */
  onStateChange?: (state: FloatingPlayerState) => void;
  /** Current state of the floating player */
  currentState?: FloatingPlayerState;
  /** Custom class name */
  className?: string;
}

export const FloatingDebugHUD: React.FC<FloatingDebugHUDProps> = ({
  isOpen: controlledIsOpen,
  onClose,
  onStateChange,
  currentState = "pill",
  className = "",
}) => {
  const storeIsOpen = useFloatingDebugStore((state) => state.isHUDOpen);
  const toggleHUD = useFloatingDebugStore((state) => state.toggleHUD);
  const setIsHUDOpen = useFloatingDebugStore((state) => state.setIsHUDOpen);

  const stiffness = useFloatingDebugStore((state) => state.stiffness);
  const damping = useFloatingDebugStore((state) => state.damping);
  const mass = useFloatingDebugStore((state) => state.mass);
  const glowIntensity = useFloatingDebugStore((state) => state.glowIntensity);
  const magnifyPower = useFloatingDebugStore((state) => state.magnifyPower);
  const resetDefaults = useFloatingDebugStore((state) => state.resetDefaults);

  const setStiffness = useFloatingDebugStore((state) => state.setStiffness);
  const setDamping = useFloatingDebugStore((state) => state.setDamping);
  const setMass = useFloatingDebugStore((state) => state.setMass);
  const setGlowIntensity = useFloatingDebugStore((state) => state.setGlowIntensity);
  const setMagnifyPower = useFloatingDebugStore((state) => state.setMagnifyPower);

  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : storeIsOpen;

  // Real-time FPS telemetry calculation
  const [fps, setFps] = useState<number>(60);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    let animId: number;

    const measureFps = (now: number) => {
      frameCountRef.current++;
      if (now - lastTimeRef.current >= 500) {
        const measured = Math.round(
          (frameCountRef.current * 1000) / (now - lastTimeRef.current)
        );
        setFps(measured);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      animId = requestAnimationFrame(measureFps);
    };

    animId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Global keyboard shortcut: Shift + D toggles HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        if (!["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
          e.preventDefault();
          toggleHUD();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleHUD]);

  const handleClose = () => {
    onClose?.();
    setIsHUDOpen(false);
  };

  return (
    <>
      {/* 1. Floating Mini Trigger Pill (when closed) */}
      {!isVisible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsHUDOpen(true)}
          className="fixed bottom-4 right-4 z-[99998] p-2.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-cyan-500/30 text-cyan-300 shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:border-cyan-400 hover:text-cyan-200 transition-all flex items-center gap-1.5 text-xs font-mono group"
          title="打开动效调试工具 (Shift + D)"
        >
          <Sliders className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
          <span className="hidden sm:inline text-[11px] font-semibold tracking-wider">HUD</span>
        </motion.button>
      )}

      {/* 2. Expanded Debug HUD Modal */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className={`fixed bottom-6 right-6 z-[99998] w-80 max-w-[92vw] select-none rounded-3xl bg-black/80 backdrop-blur-[48px] border border-cyan-500/30 shadow-[0_24px_64px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.15)] p-4 flex flex-col gap-3.5 text-white ${className}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase">
                    Motion Physics HUD
                  </h4>
                  <p className="text-[9px] text-white/40 font-mono">Shift + D 快捷开关</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Reset button */}
                <button
                  type="button"
                  onClick={resetDefaults}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
                  title="恢复默认配置"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                {/* Close button */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
                  title="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Telemetry Bar (FPS & State) */}
            <div className="grid grid-cols-2 gap-2 bg-white/[0.04] p-2 rounded-2xl border border-white/[0.06] text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-white/50 text-[10px]">FPS:</span>
                <span
                  className={`font-bold tabular-nums text-[11px] ${
                    fps >= 55
                      ? "text-emerald-400"
                      : fps >= 38
                        ? "text-amber-400"
                        : "text-rose-400"
                  }`}
                >
                  {fps}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-white/50 text-[10px]">STATE:</span>
                <span className="text-[10px] font-bold text-cyan-300 uppercase truncate">
                  {currentState}
                </span>
              </div>
            </div>

            {/* 1. Spring Physics Controls */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                <Zap className="w-3 h-3" />
                <span>Spring Physics (弹簧物理)</span>
              </div>

              {/* Stiffness Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-white/60">Stiffness (刚度)</span>
                  <span className="text-cyan-300 font-bold tabular-nums">{stiffness}</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="800"
                  step="10"
                  value={stiffness}
                  onChange={(e) => setStiffness(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Damping Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-white/60">Damping (阻尼)</span>
                  <span className="text-cyan-300 font-bold tabular-nums">{damping}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="2"
                  value={damping}
                  onChange={(e) => setDamping(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Mass Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-white/60">Mass (质量)</span>
                  <span className="text-cyan-300 font-bold tabular-nums">{mass.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.1"
                  value={mass}
                  onChange={(e) => setMass(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* 2. Visualizer & Glow Controls */}
            <div className="flex flex-col gap-2.5 border-t border-white/[0.08] pt-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-fuchsia-400 uppercase tracking-wider font-semibold">
                <Sparkles className="w-3 h-3" />
                <span>Visualizer & Glow (光晕与波形)</span>
              </div>

              {/* Glow Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-white/60">Glow Intensity (光晕强度)</span>
                  <span className="text-fuchsia-300 font-bold tabular-nums">
                    {glowIntensity.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.1"
                  value={glowIntensity}
                  onChange={(e) => setGlowIntensity(Number(e.target.value))}
                  className="w-full accent-fuchsia-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Waveform Magnifying Power */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-white/60">Lens Magnify (12px放大凸镜)</span>
                  <span className="text-fuchsia-300 font-bold tabular-nums">
                    {magnifyPower.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="5.0"
                  step="0.2"
                  value={magnifyPower}
                  onChange={(e) => setMagnifyPower(Number(e.target.value))}
                  className="w-full accent-fuchsia-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* 3. Force State Switcher */}
            {onStateChange && (
              <div className="flex flex-col gap-1.5 border-t border-white/[0.08] pt-2.5">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
                  Force State (强制切换形态)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onStateChange("pill")}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-mono font-medium transition-all flex items-center justify-center gap-1 border ${
                      currentState === "pill"
                        ? "bg-cyan-500/25 border-cyan-400/40 text-cyan-200 shadow-sm"
                        : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    <Minimize2 className="w-3 h-3" />
                    <span>Pill 胶囊</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onStateChange("expanded")}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-mono font-medium transition-all flex items-center justify-center gap-1 border ${
                      currentState === "expanded"
                        ? "bg-fuchsia-500/25 border-fuchsia-400/40 text-fuchsia-200 shadow-sm"
                        : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    <Maximize className="w-3 h-3" />
                    <span>Expanded 展开</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onStateChange("dock-left")}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-mono font-medium transition-all flex items-center justify-center gap-1 border ${
                      currentState === "dock-left"
                        ? "bg-indigo-500/25 border-indigo-400/40 text-indigo-200 shadow-sm"
                        : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>Dock Left 左侧</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onStateChange("dock-right")}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-mono font-medium transition-all flex items-center justify-center gap-1 border ${
                      currentState === "dock-right"
                        ? "bg-indigo-500/25 border-indigo-400/40 text-indigo-200 shadow-sm"
                        : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    <ChevronRight className="w-3 h-3" />
                    <span>Dock Right 右侧</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
