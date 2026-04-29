"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useABLoopStore } from "@/store/abLoopStore";
import { X, Repeat, Flag, Trash2 } from "lucide-react";

interface ABLoopPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentTime: number;
  duration: number;
  seekTo: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ABLoopPanel({
  isOpen,
  onClose,
  currentTime,
  duration,
  seekTo,
}: ABLoopPanelProps) {
  const {
    isEnabled,
    pointA,
    pointB,
    isSettingPointA,
    isSettingPointB,
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
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-black/95 backdrop-blur-2xl border border-white/20 rounded-3xl z-50"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Repeat className="w-6 h-6 text-pink-400" />
              <h2 className="text-xl font-bold text-white">A-B 循环</h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={toggleLoop}
                disabled={pointA === null || pointB === null || pointA >= pointB}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                  isEnabled
                    ? "bg-pink-500 text-white shadow-lg shadow-pink-500/30"
                    : pointA !== null && pointB !== null && pointA < pointB
                    ? "bg-white/20 text-white hover:bg-white/30"
                    : "bg-white/5 text-white/40 cursor-not-allowed"
                }`}
              >
                <Repeat className="w-5 h-5" />
                {isEnabled ? "循环中" : "启用循环"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/60">起点 A</span>
                  {pointA !== null && (
                    <button
                      onClick={clearPointA}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-white/40" />
                    </button>
                  )}
                </div>
                <div className="text-2xl font-bold text-white mb-3">
                  {pointA !== null ? formatTime(pointA) : "--:--"}
                </div>
                <div className="space-y-2">
                  <button
                    onClick={isSettingPointA ? stopSettingPoint : startSettingPointA}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                      isSettingPointA
                        ? "bg-pink-500 text-white"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {isSettingPointA ? "取消标记" : "标记起点"}
                  </button>
                  <button
                    onClick={handleSetCurrentAsA}
                    className="w-full py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
                  >
                    设为当前位置
                  </button>
                  {pointA !== null && (
                    <button
                      onClick={handleJumpToA}
                      className="w-full py-2 rounded-lg text-sm font-medium bg-white/5 text-white/80 hover:bg-white/10 transition-all"
                    >
                      跳转到 A
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/60">终点 B</span>
                  {pointB !== null && (
                    <button
                      onClick={clearPointB}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-white/40" />
                    </button>
                  )}
                </div>
                <div className="text-2xl font-bold text-white mb-3">
                  {pointB !== null ? formatTime(pointB) : "--:--"}
                </div>
                <div className="space-y-2">
                  <button
                    onClick={isSettingPointB ? stopSettingPoint : startSettingPointB}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                      isSettingPointB
                        ? "bg-pink-500 text-white"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {isSettingPointB ? "取消标记" : "标记终点"}
                  </button>
                  <button
                    onClick={handleSetCurrentAsB}
                    className="w-full py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
                  >
                    设为当前位置
                  </button>
                  {pointB !== null && (
                    <button
                      onClick={handleJumpToB}
                      className="w-full py-2 rounded-lg text-sm font-medium bg-white/5 text-white/80 hover:bg-white/10 transition-all"
                    >
                      跳转到 B
                    </button>
                  )}
                </div>
              </div>
            </div>

            {(pointA !== null || pointB !== null) && (
              <button
                onClick={clearBothPoints}
                className="w-full py-3 rounded-full bg-white/5 hover:bg-white/10 text-white/60 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                清除所有标记
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
