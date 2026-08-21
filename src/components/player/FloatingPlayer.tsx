/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useCallback, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { FloatingCompactControlsState } from "./floating/FloatingCompactControlsState";

export interface FloatingPlayerProps {
  className?: string;
}

export const FloatingPlayer: React.FC<FloatingPlayerProps> = ({
  className = "",
}) => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const volume = useAudioStore((state) => state.volume);
  const setVolume = useAudioStore((state) => state.setVolume);
  const toggleMute = useAudioStore((state) => state.toggleMute);
  const setCurrentView = useUIStore((state) => state.setCurrentView);

  // 物理拖拽坐标管理 (默认停留在左侧中段舒适区 left: 28, top: 280)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 28, y: 280 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const elementStartPosRef = useRef<{ x: number; y: number }>({ x: 28, y: 280 });

  const handlePointerDown = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartPosRef.current = { x: clientX, y: clientY };
    elementStartPosRef.current = { ...position };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const curX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const curY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const dx = curX - dragStartPosRef.current.x;
      const dy = curY - dragStartPosRef.current.y;

      // 限制在屏幕可视范围内
      const maxX = typeof window !== "undefined" ? window.innerWidth - 380 : 800;
      const maxY = typeof window !== "undefined" ? window.innerHeight - 70 : 600;

      const newX = Math.max(12, Math.min(maxX, elementStartPosRef.current.x + dx));
      const newY = Math.max(12, Math.min(maxY, elementStartPosRef.current.y + dy));

      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: true });
    window.addEventListener("touchend", handlePointerUp);
  }, [position]);

  const dragHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button, a, input, .control-interactive")) return;
      handlePointerDown(e.clientX, e.clientY);
    },
    onTouchStart: (e: React.TouchEvent) => {
      if ((e.target as HTMLElement).closest("button, a, input, .control-interactive")) return;
      if (e.touches.length > 0) {
        handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
  };

  // 全局快捷键
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.shiftKey) {
        const { currentTime: curTime, duration: totalDur } = useAudioStore.getState();
        if (e.code === "ArrowLeft") {
          e.preventDefault();
          useAudioStore.getState().seekTo(Math.max(0, curTime - 5));
        } else if (e.code === "ArrowRight") {
          e.preventDefault();
          useAudioStore.getState().seekTo(Math.min(totalDur || 100, curTime + 5));
        } else if (e.code === "ArrowUp") {
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
        } else if (e.code === "ArrowDown") {
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
        }
      }

      if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        toggleMute();
      }
    },
    [volume, setVolume, toggleMute]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!currentSong) return null;

  return (
    <motion.aside
      aria-label="悬浮音乐播放器"
      className={`fixed z-[99999] select-none ${className}`}
      style={{
        left: position.x,
        top: position.y,
        touchAction: "none",
        willChange: isDragging ? "left, top" : "auto",
      }}
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 12 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      {/* 唯一常驻 360px 单例胶囊控制器 (彻底杜绝多实例重叠) */}
      <FloatingCompactControlsState
        onExpandFull={() => setCurrentView("player")}
        onCollapseToMini={() => {}}
        dragHandlers={dragHandlers}
      />
    </motion.aside>
  );
};

export default FloatingPlayer;
