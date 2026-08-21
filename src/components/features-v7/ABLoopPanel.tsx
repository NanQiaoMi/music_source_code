"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Repeat, Trash2, X } from "lucide-react";
import { useABLoopStore } from "@/store/abLoopStore";

interface ABLoopPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentTime: number;
  duration: number;
  seekTo: (time: number) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ABLoopPanel({ isOpen, onClose, currentTime, seekTo }: ABLoopPanelProps) {
  const {
    isEnabled,
    pointA,
    pointB,
    isSettingPointA,
    isSettingPointB,
    loopCount,
    toggleLoop,
    setPointA,
    setPointB,
    clearPointA,
    clearPointB,
    clearBothPoints,
    startSettingPointA,
    startSettingPointB,
    stopSettingPoint,
  } = useABLoopStore();

  const canLoop = pointA !== null && pointB !== null && pointA < pointB;

  const handleSetCurrentAsA = () => {
    setPointA(currentTime);
  };

  const handleSetCurrentAsB = () => {
    setPointB(currentTime);
  };

  const handleJumpToA = () => {
    if (pointA !== null) {
      seekTo(pointA);
    }
  };

  const handleJumpToB = () => {
    if (pointB !== null) {
      seekTo(pointB);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        transition={{ duration: 0.3 }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/20 bg-black/95 backdrop-blur-2xl"
      >
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Repeat className="h-6 w-6 text-pink-400" />
              <h2 className="text-xl font-bold text-white">A-B Loop</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-all hover:bg-white/20"
              aria-label="Close A-B loop panel"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={toggleLoop}
                disabled={!canLoop}
                className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold transition-all ${
                  isEnabled
                    ? "bg-pink-500 text-white shadow-lg shadow-pink-500/30"
                    : canLoop
                      ? "bg-white/20 text-white hover:bg-white/30"
                      : "cursor-not-allowed bg-white/5 text-white/40"
                }`}
              >
                <Repeat className="h-5 w-5" />
                {isEnabled ? "Looping" : "Enable loop"}
              </button>
              {isEnabled && (
                <div className="text-center text-sm text-white/60">
                  Looped <span className="font-bold text-pink-400">{loopCount}</span> times
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-white/60">Point A</span>
                  {pointA !== null && (
                    <button
                      onClick={clearPointA}
                      className="rounded p-1 transition-colors hover:bg-white/10"
                      aria-label="Clear point A"
                    >
                      <Trash2 className="h-4 w-4 text-white/40" />
                    </button>
                  )}
                </div>
                <div className="mb-3 text-2xl font-bold text-white">
                  {pointA !== null ? formatTime(pointA) : "--:--"}
                </div>
                <div className="space-y-2">
                  <button
                    onClick={isSettingPointA ? stopSettingPoint : startSettingPointA}
                    className={`w-full rounded-lg py-2 text-sm font-medium transition-all ${
                      isSettingPointA
                        ? "bg-pink-500 text-white"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {isSettingPointA ? "Cancel marker" : "Mark start"}
                  </button>
                  <button
                    onClick={handleSetCurrentAsA}
                    className="w-full rounded-lg bg-white/10 py-2 text-sm font-medium text-white transition-all hover:bg-white/20"
                  >
                    Use current position
                  </button>
                  {pointA !== null && (
                    <button
                      onClick={handleJumpToA}
                      className="w-full rounded-lg bg-white/5 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10"
                    >
                      Jump to A
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-white/60">Point B</span>
                  {pointB !== null && (
                    <button
                      onClick={clearPointB}
                      className="rounded p-1 transition-colors hover:bg-white/10"
                      aria-label="Clear point B"
                    >
                      <Trash2 className="h-4 w-4 text-white/40" />
                    </button>
                  )}
                </div>
                <div className="mb-3 text-2xl font-bold text-white">
                  {pointB !== null ? formatTime(pointB) : "--:--"}
                </div>
                <div className="space-y-2">
                  <button
                    onClick={isSettingPointB ? stopSettingPoint : startSettingPointB}
                    className={`w-full rounded-lg py-2 text-sm font-medium transition-all ${
                      isSettingPointB
                        ? "bg-pink-500 text-white"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {isSettingPointB ? "Cancel marker" : "Mark end"}
                  </button>
                  <button
                    onClick={handleSetCurrentAsB}
                    className="w-full rounded-lg bg-white/10 py-2 text-sm font-medium text-white transition-all hover:bg-white/20"
                  >
                    Use current position
                  </button>
                  {pointB !== null && (
                    <button
                      onClick={handleJumpToB}
                      className="w-full rounded-lg bg-white/5 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10"
                    >
                      Jump to B
                    </button>
                  )}
                </div>
              </div>
            </div>

            {(pointA !== null || pointB !== null) && (
              <button
                onClick={clearBothPoints}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white/5 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/10"
              >
                <Trash2 className="h-4 w-4" />
                Clear all markers
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
