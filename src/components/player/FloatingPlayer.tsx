"use client";

import React, { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import {
  useFloatingDragPhysics,
  FloatingPillState,
  FloatingExpandedState,
  FloatingDockState,
  FloatingDebugHUD,
} from "./floating";

export interface FloatingPlayerProps {
  className?: string;
  defaultState?: "pill" | "expanded";
  showDebugHud?: boolean;
}

export const FloatingPlayer: React.FC<FloatingPlayerProps> = ({
  className = "",
  defaultState = "pill",
  showDebugHud = true,
}) => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const volume = useAudioStore((state) => state.volume);
  const setVolume = useAudioStore((state) => state.setVolume);
  const toggleMute = useAudioStore((state) => state.toggleMute);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);

  const {
    position,
    playerState,
    setPlayerState,
    isDragging,
    dragHandlers,
    isDocked,
  } = useFloatingDragPhysics({
    initialState: defaultState,
    initialPosition: { x: 24, y: 260 },
  });

  // Global Keyboard Shortcuts for Floating Player
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Space: Play/Pause (only if body is active target)
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      }

      // Arrow keys (when Shift is pressed to prevent conflict with page scroll)
      if (e.shiftKey) {
        if (e.code === "ArrowLeft") {
          e.preventDefault();
          const targetTime = Math.max(0, currentTime - 5);
          useAudioStore.getState().seekTo(targetTime);
        } else if (e.code === "ArrowRight") {
          e.preventDefault();
          const targetTime = Math.min(duration || 100, currentTime + 5);
          useAudioStore.getState().seekTo(targetTime);
        } else if (e.code === "ArrowUp") {
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
        } else if (e.code === "ArrowDown") {
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
        }
      }

      // 'M' or 'm' key for toggle mute
      if (e.key === "m" || e.key === "M") {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          toggleMute();
        }
      }
    },
    [isPlaying, setIsPlaying, currentTime, duration, volume, setVolume, toggleMute]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // If no song is loaded, render null
  if (!currentSong) {
    return null;
  }

  return (
    <>
      <motion.aside
        aria-label="悬浮音乐播放器"
        className={`fixed z-[99999] select-none ${className}`}
        style={{
          left: position.x,
          top: position.y,
          touchAction: "none",
          willChange: isDragging ? "left, top, transform" : "auto",
        }}
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 12 }}
        transition={{
          type: "spring",
          stiffness: 380,
          damping: 28,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDocked ? (
            <FloatingDockState
              key="dock"
              side={playerState === "dock-left" ? "dock-left" : "dock-right"}
              onRestore={(target = "pill") => setPlayerState(target)}
              dragHandlers={dragHandlers}
            />
          ) : playerState === "expanded" ? (
            <FloatingExpandedState
              key="expanded"
              onCollapse={() => setPlayerState("pill")}
              dragHandlers={dragHandlers}
            />
          ) : (
            <FloatingPillState
              key="pill"
              onExpand={() => setPlayerState("expanded")}
              dragHandlers={dragHandlers}
            />
          )}
        </AnimatePresence>
      </motion.aside>

      {/* Real-time Dynamic Spring/Glow Tuning HUD */}
      {showDebugHud && (
        <FloatingDebugHUD
          currentState={playerState}
          onStateChange={(nextState) => setPlayerState(nextState)}
        />
      )}
    </>
  );
};

export default FloatingPlayer;
