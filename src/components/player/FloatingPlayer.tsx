"use client";

import React, { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import {
  useFloatingDragPhysics,
  FloatingMiniState,
  FloatingCompactControlsState,
  FloatingPillState,
  FloatingExpandedState,
  FloatingDockState,
  FloatingDebugHUD,
  type FloatingPlayerState,
} from "./floating";

export interface FloatingPlayerProps {
  className?: string;
  defaultState?: FloatingPlayerState;
  showDebugHud?: boolean;
  /** Inactivity timeout in ms to automatically collapse back to minimal state (default: 5000ms) */
  autoCollapseTimeout?: number;
}

export const FloatingPlayer: React.FC<FloatingPlayerProps> = ({
  className = "",
  defaultState = "mini",
  showDebugHud = true,
  autoCollapseTimeout = 5000,
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

  const [isHovered, setIsHovered] = React.useState(false);
  const idleTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Clear idle timer
  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // Reset idle timer when user is in compact or expanded state
  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    // Only auto-collapse if in compact or expanded mode and not hovered / dragging
    if (
      (playerState === "compact" || playerState === "expanded" || playerState === "pill") &&
      !isHovered &&
      !isDragging &&
      autoCollapseTimeout > 0
    ) {
      idleTimerRef.current = setTimeout(() => {
        setPlayerState("mini");
      }, autoCollapseTimeout);
    }
  }, [
    clearIdleTimer,
    playerState,
    isHovered,
    isDragging,
    autoCollapseTimeout,
    setPlayerState,
  ]);

  // Start or reset timer whenever state, hover, or dragging status changes
  useEffect(() => {
    resetIdleTimer();
    return () => clearIdleTimer();
  }, [resetIdleTimer, clearIdleTimer, playerState, isHovered, isDragging]);



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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseMove={resetIdleTimer}
        onClick={resetIdleTimer}
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
              onRestore={(target = "mini") => setPlayerState(target)}
              dragHandlers={dragHandlers}
            />
          ) : playerState === "expanded" ? (
            <FloatingExpandedState
              key="expanded"
              onCollapse={() => setPlayerState("mini")}
              dragHandlers={dragHandlers}
            />
          ) : playerState === "compact" ? (
            <FloatingCompactControlsState
              key="compact"
              onExpandFull={() => setPlayerState("expanded")}
              onCollapseToMini={() => setPlayerState("mini")}
              dragHandlers={dragHandlers}
            />
          ) : playerState === "pill" ? (
            <FloatingPillState
              key="pill"
              onExpand={() => setPlayerState("compact")}
              dragHandlers={dragHandlers}
            />
          ) : (
            <FloatingMiniState
              key="mini"
              onExpand={() => setPlayerState("compact")}
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
