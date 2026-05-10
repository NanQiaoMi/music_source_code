"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { useProfessionalModeStore } from "@/store/professionalModeStore";
import { useAudioElementRef } from "@/context/AudioElementContext";
import { WaveformVisualization } from "@/components/audio/WaveformVisualization";
import { SpectrumAnalyzer } from "@/components/audio/SpectrumAnalyzer";
import { Award, ChevronUp, Volume2, VolumeX, Disc3, Repeat, Repeat1, Shuffle } from "lucide-react";

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface FloatingPlayerProps {
  className?: string;
}

const DEFAULT_COVER_SRC = "/default-cover.svg";

export const FloatingPlayer: React.FC<FloatingPlayerProps> = () => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const currentSong = useAudioStore((state) => state.currentSong);
  const isLoading = useAudioStore((state) => state.isLoading);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const prevSong = useAudioStore((state) => state.prevSong);
  const nextSong = useAudioStore((state) => state.nextSong);
  const setVolume = useAudioStore((state) => state.setVolume);
  const toggleMute = useAudioStore((state) => state.toggleMute);
  const loopMode = useAudioStore((state) => state.loopMode);
  const setLoopMode = useAudioStore((state) => state.setLoopMode);

  const { setCurrentView } = useUIStore();
  const { isFeatureEnabled } = useProfessionalModeStore();
  const audioElementRef = useAudioElementRef();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 300 });
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 24, y: 300 });
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const padding = 16;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const playerWidth = 360;
      const playerHeight = isExpanded ? 480 : 72;

      return {
        x: Math.max(padding, Math.min(x, windowWidth - playerWidth - padding)),
        y: Math.max(padding, Math.min(y, windowHeight - playerHeight - padding)),
      };
    },
    [isExpanded]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".drag-handle")) return;

    e.preventDefault();
    e.stopPropagation();

    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".drag-handle")) return;

    const touch = e.touches[0];
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      x: touch.clientX - positionRef.current.x,
      y: touch.clientY - positionRef.current.y,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    e.preventDefault();

    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;

    const clamped = clampPosition(newX, newY);
    setPosition(clamped);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDraggingRef.current) return;

    const touch = e.touches[0];
    const newX = touch.clientX - dragStartRef.current.x;
    const newY = touch.clientY - dragStartRef.current.y;

    const clamped = clampPosition(newX, newY);
    setPosition(clamped);
  };

  const handleDragEnd = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove, { passive: false });
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleDragEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded, clampPosition]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!duration) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * duration;
      useAudioStore.getState().seekTo(newTime);
    },
    [duration]
  );

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      setVolume(parseFloat(e.target.value));
    },
    [setVolume]
  );

  if (!currentSong) return null;

  const progressPercent =
    duration > 0 && !isNaN(currentTime) && !isNaN(duration) ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="fixed z-[99999]"
      style={{
        left: position.x,
        top: position.y,
        touchAction: "none",
      }}
    >
      <div
        className="relative bg-black/40 backdrop-blur-[64px] backdrop-saturate-[200%] rounded-[28px] border border-white/[0.08] shadow-[0_32px_64px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden"
        style={{
          width: isExpanded ? 360 : "auto",
          minWidth: isExpanded ? 360 : 320,
        }}
        onMouseEnter={() => setIsHoveringControls(true)}
        onMouseLeave={() => setIsHoveringControls(false)}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-black/[0.12] pointer-events-none" />

        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/[0.25] to-transparent" />

        <div
          className="drag-handle absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing z-20"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
            <div
              className="w-8 h-1 rounded-full bg-white/35"
              style={{ width: isHoveringControls ? 32 : 24 }}
            />
          </div>
        </div>

        <div className="relative pt-8">
          <div className="flex items-center gap-3 px-4 pb-3">
            <div
              className="relative w-14 h-14 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg bg-black/40">
                <div className={`absolute inset-0 ${isPlaying ? "animate-spin-slow" : ""}`}>
                  <Image
                    src={currentSong.cover || DEFAULT_COVER_SRC}
                    alt={currentSong.title}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/default-cover.svg";
                    }}
                    unoptimized
                  />
                </div>

                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.15]" />

                {isFeatureEnabled("hi-res-indicator") && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold flex items-center gap-0.5 backdrop-blur-sm">
                      <Award className="w-3 h-3" />
                      <span>Hi-Res</span>
                    </div>
                  </div>
                )}
              </div>

              {isPlaying && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10">
                  <Disc3 className="w-5 h-5 text-white/90" />
                </div>
              )}
            </div>

            <div
              className="flex-1 min-w-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              <h4 className="text-white font-semibold text-sm truncate tracking-tight">
                {currentSong.title}
              </h4>
              <p className="text-white/[0.55] text-xs truncate mt-0.5">{currentSong.artist}</p>
            </div>

            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={prevSong}
                className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/[0.08]"
                disabled={isLoading}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              <button
                onClick={() => !isLoading && setIsPlaying(!isPlaying)}
                disabled={isLoading}
                className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-xl transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <div
                    className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                    style={{
                      animation: "spin 1s linear infinite",
                    }}
                  />
                ) : isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                onClick={nextSong}
                className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/[0.08]"
                disabled={isLoading}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="overflow-hidden">
              <div className="px-4 pb-3 space-y-3">
                <div className="h-px bg-white/[0.08]" />

                {isFeatureEnabled("waveform") && (
                  <div className="overflow-hidden rounded-lg">
                    <WaveformVisualization
                      songId={currentSong?.id}
                      audioElement={audioElementRef.current}
                      className="h-14 bg-black/40 rounded-lg"
                    />
                  </div>
                )}

                {isFeatureEnabled("spectrum") && (
                  <div className="overflow-hidden rounded-lg">
                    <SpectrumAnalyzer
                      audioElement={audioElementRef.current}
                      className="h-14 bg-black/40 rounded-lg"
                    />
                  </div>
                )}

                <div
                  className="relative h-1 bg-white/[0.08] rounded-full overflow-hidden cursor-pointer group"
                  onClick={handleProgressClick}
                >
                  <div
                    className="absolute top-0 left-0 h-full bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-lg transition-opacity"
                    style={{ left: `calc(${progressPercent}% - 6px)` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-white/[0.35] text-[10px] font-medium tabular-nums">
                    {formatTime(currentTime)}
                  </span>
                  <span className="text-white/[0.35] text-[10px] font-medium tabular-nums">
                    {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className="text-white/[0.45] hover:text-white transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 relative h-1 bg-white/[0.08] rounded-full overflow-hidden">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="absolute top-0 left-0 h-full bg-white/60 rounded-full pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                      style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                    />
                  </div>

                  <span className="text-white/[0.35] text-[10px] tabular-nums">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>

                <div className="flex items-center justify-center gap-6 pt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (loopMode === "shuffle") {
                        setLoopMode("all");
                      } else {
                        setLoopMode("shuffle");
                      }
                    }}
                    className={`transition-all ${
                      loopMode === "shuffle" ? "text-white" : "text-white/40 hover:text-white/60"
                    }`}
                    title="随机播放"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const modes: ("none" | "all" | "single")[] = ["none", "all", "single"];
                      const currentIndex = modes.indexOf(loopMode as any);
                      const nextIndex = (currentIndex + 1) % modes.length;
                      setLoopMode(modes[nextIndex]);
                    }}
                    className={`transition-all ${
                      loopMode === "all" || loopMode === "single"
                        ? "text-white"
                        : "text-white/40 hover:text-white/60"
                    }`}
                    title={
                      loopMode === "single"
                        ? "单曲循环"
                        : loopMode === "all"
                          ? "列表循环"
                          : "顺序播放"
                    }
                  >
                    {loopMode === "single" ? (
                      <Repeat1 className="w-4 h-4" />
                    ) : (
                      <Repeat className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView("player");
                  }}
                  className="w-full py-2.5 bg-white/[0.06] text-white/[0.75] text-xs rounded-xl transition-all flex items-center justify-center gap-2 font-medium hover:bg-white/[0.12]"
                >
                  <ChevronUp className="w-4 h-4" />
                  展开沉浸播放器
                </button>
              </div>
            </div>
          )}
        </div>

        {isHoveringControls && !isExpanded && (
          <div className="absolute -top-10 right-2 px-2 py-1 bg-black/80 backdrop-blur-md rounded-lg text-white/[0.55] text-[10px] pointer-events-none">
            点击展开
          </div>
        )}
      </div>
    </div>
  );
};
