"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Cpu, Zap, Monitor, Layers, Gauge } from "lucide-react";
import { usePerformanceV8Store, PerformanceLevel } from "@/store/performanceV8Store";

interface PerformanceMonitorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const PERFORMANCE_LEVELS: { level: PerformanceLevel; name: string; color: string }[] = [
  { level: "low", name: "低", color: "text-green-400" },
  { level: "medium", name: "中", color: "text-yellow-400" },
  { level: "high", name: "高", color: "text-orange-400" },
  { level: "ultra", name: "极致", color: "text-pink-400" },
];

export function PerformanceMonitorPanel({ isOpen, onClose }: PerformanceMonitorPanelProps) {
  const { config, fps, cpuUsage, memoryUsage, drawCalls, setPerformanceLevel } = usePerformanceV8Store();

  const getFPSColor = (fps: number): string => {
    if (fps >= 55) return "text-green-400";
    if (fps >= 30) return "text-yellow-400";
    return "text-red-400";
  };

  const getCPUColor = (usage: number): string => {
    if (usage < 50) return "text-green-400";
    if (usage < 80) return "text-yellow-400";
    return "text-red-400";
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-black/90 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 z-50"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-pink-400" />
            性能监控
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <Gauge className="w-3 h-3" />
              FPS
            </div>
            <div className={`text-2xl font-bold ${getFPSColor(fps)}`}>
              {fps}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <Cpu className="w-3 h-3" />
              CPU
            </div>
            <div className={`text-2xl font-bold ${getCPUColor(cpuUsage)}`}>
              {Math.round(cpuUsage)}%
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <Layers className="w-3 h-3" />
              绘制
            </div>
            <div className="text-2xl font-bold text-white">
              {drawCalls}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <Zap className="w-3 h-3" />
              内存
            </div>
            <div className="text-2xl font-bold text-white">
              {memoryUsage.toFixed(1)}MB
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60 flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              性能档位
            </span>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {PERFORMANCE_LEVELS.map(({ level, name, color }) => (
              <button
                key={level}
                onClick={() => setPerformanceLevel(level)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  config.level === level
                    ? `bg-white/20 border border-white/30 ${color}`
                    : "bg-white/5 text-white/40 hover:bg-white/10"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="text-xs text-white/40 space-y-1 pt-2 border-t border-white/10">
            <div>目标帧率: {config.targetFPS}fps</div>
            <div>最大粒子: {config.maxParticles.toLocaleString()}</div>
            <div>后处理: {config.postProcessing ? "开启" : "关闭"}</div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
