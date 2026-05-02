"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Radar } from "lucide-react";
import { useEmotionStore } from "@/store/emotionStore";
import { useAudioStore } from "@/store/audioStore";
import { toast } from "@/components/GlassToast";

const DEBOUNCE_TIME = 500;
const RADAR_SIZE = 200;

const QUADRANT_GLOW = {
  Q1: "rgba(249, 115, 22, 0.6)",
  Q2: "rgba(139, 92, 246, 0.6)",
  Q3: "rgba(59, 130, 246, 0.6)",
  Q4: "rgba(34, 197, 94, 0.6)",
};

function getQuadrant(x: number, y: number): keyof typeof QUADRANT_GLOW {
  if (x >= 0 && y >= 0) return "Q1";
  if (x < 0 && y >= 0) return "Q2";
  if (x < 0 && y < 0) return "Q3";
  return "Q4";
}

export const GlassRadarWidget: React.FC = () => {
  const { globalEmotion, setGlobalEmotion, emotionMap, saveSongEmotion } = useEmotionStore();
  const currentSong = useAudioStore(state => state.currentSong);

  const currentEmotion = currentSong
    ? (emotionMap[currentSong.id] || { x: 0, y: 0 })
    : (globalEmotion || { x: 0, y: 0 });

  const [isExpanded, setIsExpanded] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const x = useMotionValue(currentEmotion.x * (RADAR_SIZE / 2));
  const y = useMotionValue(-currentEmotion.y * (RADAR_SIZE / 2));

  useEffect(() => {
    x.set(currentEmotion.x * (RADAR_SIZE / 2));
    y.set(-currentEmotion.y * (RADAR_SIZE / 2));
  }, [currentEmotion, x, y]);

  const glowColor = useTransform(
    [x, y],
    ([latestX, latestY]: any[]) => {
      const valX = latestX / (RADAR_SIZE / 2);
      const valY = -latestY / (RADAR_SIZE / 2);
      const q = getQuadrant(valX, valY);
      return QUADRANT_GLOW[q];
    }
  );

  const handleDragEnd = useCallback(() => {
    const finalX = x.get() / (RADAR_SIZE / 2);
    const finalY = -y.get() / (RADAR_SIZE / 2);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      if (currentSong) {
        saveSongEmotion(currentSong.id, finalX, finalY);
        const q = getQuadrant(finalX, finalY);
        const labels: Record<string, string> = { Q1: "高亢激昂", Q2: "悲伤阴暗", Q3: "平静低沉", Q4: "欢快明亮" };
        toast.success(`已标记为「${labels[q]}」区域`);
      } else {
        setGlobalEmotion({ x: finalX, y: finalY });
        toast.success("已更新全局情绪偏好");
      }
    }, DEBOUNCE_TIME);
  }, [x, y, currentSong, saveSongEmotion, setGlobalEmotion]);

  const currentQuadrant = getQuadrant(currentEmotion.x, currentEmotion.y);
  const quadrantLabels: Record<string, string> = { Q1: "高亢激昂", Q2: "悲伤阴暗", Q3: "平静低沉", Q4: "欢快明亮" };

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="fixed top-24 left-8 z-[70]"
      initial={{ x: 0, y: 0 }}
      whileDrag={{ cursor: "grabbing" }}
    >
      <motion.div
        layout
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl flex items-center justify-center cursor-pointer select-none"
        initial={{ width: 44, height: 44 }}
        animate={{
          width: isExpanded ? RADAR_SIZE + 40 : 44,
          height: isExpanded ? RADAR_SIZE + 40 : 44,
          borderRadius: isExpanded ? 32 : 16
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.div
              key="icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center justify-center"
            >
              <Radar className="w-5 h-5 text-white/70" />
            </motion.div>
          ) : (
            <motion.div
              key="radar"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full h-full flex items-center justify-center"
            >
              <motion.div
                className="absolute inset-0 pointer-events-none opacity-30 blur-3xl transition-colors duration-500"
                style={{ backgroundColor: glowColor }}
              />

              <div
                className="relative bg-white/5 border border-white/10 rounded-xl overflow-hidden"
                style={{ width: RADAR_SIZE, height: RADAR_SIZE }}
              >
                {/* Quadrant color hints */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-orange-500/[0.03]" />
                  <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-purple-500/[0.03]" />
                  <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-500/[0.03]" />
                  <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-green-500/[0.03]" />
                </div>

                {/* Grid Lines */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-px h-full bg-white/10" />
                  <div className="h-px w-full bg-white/10" />
                </div>

                {/* Labels */}
                <div className="absolute inset-0 p-2 pointer-events-none text-[8px] font-bold tracking-tighter flex flex-col justify-between items-center">
                  <span className="mt-1 text-orange-400/50">高亢激昂</span>
                  <div className="w-full flex justify-between items-center px-1">
                    <span className="text-purple-400/50">悲伤阴暗</span>
                    <span className="text-green-400/50">欢快明亮</span>
                  </div>
                  <span className="mb-1 text-blue-400/50">平静低沉</span>
                </div>

                {/* Draggable Point */}
                <motion.div
                  drag
                  dragConstraints={{
                    left: -RADAR_SIZE / 2,
                    right: RADAR_SIZE / 2,
                    top: -RADAR_SIZE / 2,
                    bottom: RADAR_SIZE / 2,
                  }}
                  dragElastic={0.15}
                  onDragEnd={handleDragEnd}
                  style={{ x, y }}
                  className="absolute top-1/2 left-1/2 -mt-[6px] -ml-[6px] z-10"
                >
                  <div className="relative w-3 h-3">
                    <div className="absolute inset-0 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                    <motion.div
                      className="absolute -inset-2 rounded-full border border-white/50"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full blur-[2px]"
                      style={{ backgroundColor: glowColor }}
                    />
                  </div>
                </motion.div>
              </div>

              {/* Title + Current Quadrant */}
              <div className="absolute top-2 left-0 right-0 text-center">
                <div className="text-[10px] text-white/50 font-medium">情绪偏好矩阵</div>
                {currentSong && (
                  <div className="text-[8px] mt-0.5 font-bold" style={{ color: QUADRANT_GLOW[currentQuadrant] }}>
                    {quadrantLabels[currentQuadrant]}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </motion.div>
    </motion.div>
  );
};
