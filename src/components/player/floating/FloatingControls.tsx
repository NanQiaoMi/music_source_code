"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useAudioStore, type LoopMode } from "@/store/audioStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import {
  Heart,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Disc3,
} from "lucide-react";

const DEFAULT_COVER_SRC = "/default-cover.svg";

// ---------------------------------------------------------------------------
// 1. Play/Pause Morphing SVG Button (Smooth Bezier Path Morphing)
// ---------------------------------------------------------------------------

export interface MorphingPlayPauseButtonProps {
  isPlaying: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * High-precision dual-path morphing between Play (Triangle) and Pause (Dual Bars).
 * Both paths use identical command counts (M, L, L, L, Z) for smooth spring interpolation.
 */
const PLAY_PATH_LEFT = "M 7 4.5 L 14 8.8 L 14 15.2 L 7 19.5 Z";
const PAUSE_PATH_LEFT = "M 6 4.5 L 10 4.5 L 10 19.5 L 6 19.5 Z";

const PLAY_PATH_RIGHT = "M 14 8.8 L 19 12 L 19 12 L 14 15.2 Z";
const PAUSE_PATH_RIGHT = "M 14 4.5 L 18 4.5 L 18 19.5 L 14 19.5 Z";

export const MorphingPlayPauseButton: React.FC<MorphingPlayPauseButtonProps> = ({
  isPlaying,
  onToggle,
  disabled = false,
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-9 h-9",
    md: "w-11 h-11",
    lg: "w-14 h-14",
  }[size];

  const svgSize = size === "sm" ? 18 : size === "md" ? 22 : 28;

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      disabled={disabled}
      aria-label={isPlaying ? "暂停播放" : "开始播放"}
      className={`control-interactive relative ${sizeClasses} rounded-full bg-white text-black flex items-center justify-center shadow-[0_8px_24px_rgba(255,255,255,0.25),inset_0_1px_1px_rgba(255,255,255,0.9)] active:shadow-inner disabled:opacity-40 disabled:cursor-not-allowed select-none group ${className}`}
      whileHover={{ scale: 1.08, transition: { type: "spring", stiffness: 450, damping: 20 } }}
      whileTap={{ scale: 0.91, transition: { type: "spring", stiffness: 500, damping: 25 } }}
    >
      {/* Specular sheen ring */}
      <span className="absolute inset-0 rounded-full ring-1 ring-white/50 pointer-events-none" />

      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-black ml-0.5 pointer-events-none"
      >
        {/* Left half morph path */}
        <motion.path
          d={isPlaying ? PAUSE_PATH_LEFT : PLAY_PATH_LEFT}
          fill="currentColor"
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 24,
            mass: 0.7,
          }}
        />

        {/* Right half morph path */}
        <motion.path
          d={isPlaying ? PAUSE_PATH_RIGHT : PLAY_PATH_RIGHT}
          fill="currentColor"
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 24,
            mass: 0.7,
          }}
        />
      </svg>
    </motion.button>
  );
};

// ---------------------------------------------------------------------------
// 2. Vinyl Record with Braking Physics & Specular Sheen
// ---------------------------------------------------------------------------

export interface VinylRecordProps {
  coverUrl?: string;
  title?: string;
  isPlaying: boolean;
  size?: number;
  className?: string;
  onClick?: () => void;
  showGrooves?: boolean;
}

export const VinylRecord: React.FC<VinylRecordProps> = ({
  coverUrl,
  title = "Now Playing",
  isPlaying,
  size = 48,
  className = "",
  onClick,
  showGrooves = true,
}) => {
  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const discElementRef = useRef<HTMLDivElement | null>(null);

  // Target rotation speed: ~0.85 degrees per frame at 60fps
  const TARGET_SPEED = 0.85;

  useAnimationFrame(() => {
    if (isPlaying) {
      // Smooth acceleration to target speed
      velocityRef.current += (TARGET_SPEED - velocityRef.current) * 0.05;
    } else {
      // Physical inertia braking curve (exponential friction decay)
      velocityRef.current *= 0.948;
      if (velocityRef.current < 0.002) {
        velocityRef.current = 0;
      }
    }

    if (velocityRef.current > 0) {
      rotationRef.current = (rotationRef.current + velocityRef.current) % 360;
      if (discElementRef.current) {
        discElementRef.current.style.transform = `rotate(${rotationRef.current}deg) translateZ(0)`;
      }
    }
  });

  const centerLabelSize = Math.round(size * 0.46);

  return (
    <div
      className={`relative flex-shrink-0 cursor-pointer select-none ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      title={title}
    >
      {/* Vinyl Disc Outer Body */}
      <div
        ref={discElementRef}
        className="w-full h-full rounded-full bg-[#0e0e11] relative overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.12)] flex items-center justify-center"
        style={{ willChange: "transform" }}
      >
        {/* Micro Concentric Vinyl Grooves */}
        {showGrooves && (
          <div className="absolute inset-0 rounded-full pointer-events-none opacity-40">
            <div className="absolute inset-[6%] rounded-full border border-white/10" />
            <div className="absolute inset-[13%] rounded-full border border-white/[0.08]" />
            <div className="absolute inset-[20%] rounded-full border border-white/10" />
            <div className="absolute inset-[27%] rounded-full border border-white/[0.06]" />
            <div className="absolute inset-[34%] rounded-full border border-white/[0.08]" />
          </div>
        )}

        {/* Specular Light Reflection Sweep (Conic highlight) */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none mix-blend-screen opacity-50"
          style={{
            background:
              "conic-gradient(from 45deg, rgba(255,255,255,0.22) 0deg, transparent 40deg, rgba(255,255,255,0.06) 180deg, transparent 220deg, rgba(255,255,255,0.22) 360deg)",
          }}
        />

        {/* Center Label / Album Cover */}
        <div
          className="relative rounded-full overflow-hidden shadow-inner ring-1 ring-black/80"
          style={{ width: centerLabelSize, height: centerLabelSize }}
        >
          <Image
            src={coverUrl || DEFAULT_COVER_SRC}
            alt={title}
            fill
            className="object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = DEFAULT_COVER_SRC;
            }}
            unoptimized
          />
          {/* Subtle album vignette */}
          <div className="absolute inset-0 rounded-full bg-black/10 ring-1 ring-inset ring-white/20 pointer-events-none" />

          {/* Center Spindle Center Hole */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-zinc-950 ring-1 ring-white/30" />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. Red Heart Favorite Button with Particle Heart Burst
// ---------------------------------------------------------------------------

interface HeartParticle {
  id: number;
  x: number;
  y: number;
  scale: number;
  color: string;
  rotation: number;
}

export interface HeartFavoriteButtonProps {
  className?: string;
  size?: number;
}

export const HeartFavoriteButton: React.FC<HeartFavoriteButtonProps> = ({
  className = "",
  size = 18,
}) => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const isFavorite = useFavoritesStore((state) =>
    currentSong ? state.isFavorite(currentSong.id) : false
  );
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  const [particles, setParticles] = useState<HeartParticle[]>([]);
  const [isPopActive, setIsPopActive] = useState(false);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentSong) return;

      const nextFavState = !isFavorite;
      toggleFavorite(currentSong);
      setIsPopActive(true);
      setTimeout(() => setIsPopActive(false), 500);

      // Trigger particle heart burst only when liking
      if (nextFavState) {
        const particleCount = 10;
        const colors = [
          "#f43f5e",
          "#ec4899",
          "#fb7185",
          "#fda4af",
          "#fde047",
          "#c084fc",
        ];
        const newParticles: HeartParticle[] = Array.from({ length: particleCount }).map(
          (_, i) => {
            const angle = (i / particleCount) * (Math.PI * 2) + (Math.random() * 0.4 - 0.2);
            const distance = 24 + Math.random() * 20;
            return {
              id: Date.now() + i,
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              scale: 0.6 + Math.random() * 0.7,
              color: colors[i % colors.length],
              rotation: Math.random() * 360,
            };
          }
        );

        setParticles(newParticles);
        setTimeout(() => setParticles([]), 700);
      }
    },
    [currentSong, isFavorite, toggleFavorite]
  );

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Particle Heart Burst Explosion */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute pointer-events-none z-30"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{
              x: p.x,
              y: p.y,
              opacity: [1, 0.9, 0],
              scale: [0, p.scale, 0],
              rotate: p.rotation,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill={p.color}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </motion.span>
        ))}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleToggle}
        disabled={!currentSong}
        aria-label={isFavorite ? "取消喜欢" : "喜欢这首歌"}
        className="control-interactive relative p-2 rounded-full text-white/60 hover:text-white transition-colors select-none focus:outline-none"
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        animate={
          isPopActive
            ? {
                scale: [1, 0.72, 1.42, 0.92, 1.12, 1],
                transition: { duration: 0.48, ease: "easeOut" },
              }
            : {}
        }
      >
        <Heart
          style={{ width: size, height: size }}
          className={`transition-colors duration-200 ${
            isFavorite
              ? "fill-rose-500 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]"
              : "text-white/60 hover:text-white"
          }`}
        />
      </motion.button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Jelly Elastic Feedback Button (Squash & Stretch)
// ---------------------------------------------------------------------------

export interface JellyButtonProps {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  nudgeDirection?: "left" | "right" | "none";
  className?: string;
  children: React.ReactNode;
}

export const JellyButton: React.FC<JellyButtonProps> = ({
  onClick,
  disabled = false,
  ariaLabel,
  nudgeDirection = "none",
  className = "",
  children,
}) => {
  const [isJelly, setIsJelly] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsJelly(true);
    setTimeout(() => setIsJelly(false), 400);
    onClick();
  };

  const nudgeX = nudgeDirection === "left" ? -4 : nudgeDirection === "right" ? 4 : 0;

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`control-interactive p-2 rounded-full text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed select-none focus:outline-none ${className}`}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.88 }}
      animate={
        isJelly
          ? {
              scaleX: [1, 0.78, 1.22, 0.92, 1.06, 1],
              scaleY: [1, 1.24, 0.82, 1.08, 0.96, 1],
              x: [0, nudgeX, 0],
              transition: { duration: 0.42, ease: "easeOut" },
            }
          : { scaleX: 1, scaleY: 1, x: 0 }
      }
    >
      {children}
    </motion.button>
  );
};

// ---------------------------------------------------------------------------
// 5. Unified Full Floating Controls Strip
// ---------------------------------------------------------------------------

export interface FloatingControlsProps {
  className?: string;
  compact?: boolean;
  showShuffleAndLoop?: boolean;
  showFavorite?: boolean;
}

const LOOP_SEQUENCE: LoopMode[] = ["none", "all", "single", "shuffle"];

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  className = "",
  compact = false,
  showShuffleAndLoop = false,
  showFavorite = true,
}) => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const isLoading = useAudioStore((state) => state.isLoading);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const togglePlay = () => setIsPlaying(!isPlaying);
  const prevSong = useAudioStore((state) => state.prevSong);
  const nextSong = useAudioStore((state) => state.nextSong);
  const loopMode = useAudioStore((state) => state.loopMode);
  const setLoopMode = useAudioStore((state) => state.setLoopMode);

  const [isLoopFlipping, setIsLoopFlipping] = useState(false);
  const [isShuffleWobble, setIsShuffleWobble] = useState(false);

  const handleLoopToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoopFlipping(true);
    setTimeout(() => setIsLoopFlipping(false), 450);

    const currentIndex = LOOP_SEQUENCE.indexOf(loopMode);
    const nextIndex = (Math.max(currentIndex, 0) + 1) % LOOP_SEQUENCE.length;
    setLoopMode(LOOP_SEQUENCE[nextIndex]);
  };

  const handleShuffleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsShuffleWobble(true);
    setTimeout(() => setIsShuffleWobble(false), 450);

    if (loopMode === "shuffle") {
      setLoopMode("all");
    } else {
      setLoopMode("shuffle");
    }
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* 1. Loop Mode Toggle (Optional in compact) */}
      {showShuffleAndLoop && (
        <motion.button
          type="button"
          onClick={handleLoopToggle}
          aria-label={`切换循环模式: 当前 ${loopMode}`}
          className={`control-interactive p-2 rounded-full transition-colors ${
            loopMode === "all" || loopMode === "single"
              ? "text-cyan-400 bg-cyan-400/10"
              : "text-white/50 hover:text-white hover:bg-white/[0.08]"
          }`}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.88 }}
          animate={isLoopFlipping ? { rotate: [0, 180, 360], scale: [1, 1.25, 1] } : {}}
          transition={{ duration: 0.45 }}
        >
          {loopMode === "single" ? (
            <Repeat1 className="w-4 h-4" />
          ) : (
            <Repeat className="w-4 h-4" />
          )}
        </motion.button>
      )}

      {/* 2. Previous Song (Jelly nudge left) */}
      <JellyButton
        onClick={prevSong}
        disabled={isLoading}
        ariaLabel="上一首"
        nudgeDirection="left"
      >
        <SkipBack className={compact ? "w-4 h-4" : "w-5 h-5"} />
      </JellyButton>

      {/* 3. Morphing Play/Pause Button */}
      <MorphingPlayPauseButton
        isPlaying={isPlaying}
        onToggle={togglePlay}
        disabled={isLoading}
        size={compact ? "sm" : "md"}
      />

      {/* 4. Next Song (Jelly nudge right) */}
      <JellyButton
        onClick={nextSong}
        disabled={isLoading}
        ariaLabel="下一首"
        nudgeDirection="right"
      >
        <SkipForward className={compact ? "w-4 h-4" : "w-5 h-5"} />
      </JellyButton>

      {/* 5. Shuffle Toggle (Optional in compact) */}
      {showShuffleAndLoop && (
        <motion.button
          type="button"
          onClick={handleShuffleToggle}
          aria-label="随机播放"
          className={`control-interactive p-2 rounded-full transition-colors ${
            loopMode === "shuffle"
              ? "text-fuchsia-400 bg-fuchsia-400/10"
              : "text-white/50 hover:text-white hover:bg-white/[0.08]"
          }`}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.88 }}
          animate={
            isShuffleWobble
              ? { rotate: [-16, 16, -8, 8, 0], scale: [1, 1.2, 0.95, 1] }
              : {}
          }
          transition={{ duration: 0.45 }}
        >
          <Shuffle className="w-4 h-4" />
        </motion.button>
      )}

      {/* 6. Heart Favorite Button */}
      {showFavorite && <HeartFavoriteButton size={compact ? 16 : 18} />}
    </div>
  );
};
