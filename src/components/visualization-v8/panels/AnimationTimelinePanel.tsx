"use client";

import React, { useState } from "react";
import { useAnimationStore } from "@/store/animationStore";
import { DEFAULT_ANIMATION_PRESETS } from "@/lib/visualization/animationTypes";
import { Play, Pause, SkipBack, SkipForward, Zap, Music, Clock, Layers } from "lucide-react";

interface AnimationTimelinePanelProps {
  onClose: () => void;
}

export function AnimationTimelinePanel({ onClose }: AnimationTimelinePanelProps) {
  const {
    syncMode,
    timelineDuration,
    currentTime,
    isPlaying,
    playbackSpeed,
    setSyncMode,
    setCurrentTime,
    setIsPlaying,
    setPlaybackSpeed,
    applyPreset,
    reset
  } = useAnimationStore();

  const [showPresets, setShowPresets] = useState(false);

  const syncModeLabels: Record<string, string> = {
    audio: "音频同步",
    timeline: "时间轴",
    mixed: "混合"
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80">
      <div className="bg-gray-900 border-t border-white/20 w-full max-h-[60vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              动画时间轴
            </h2>
            
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
              {(["audio", "timeline", "mixed"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSyncMode(mode)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    syncMode === mode
                      ? "bg-pink-500 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {mode === "audio" && <Music className="w-4 h-4 inline mr-1" />}
                  {mode === "timeline" && <Clock className="w-4 h-4 inline mr-1" />}
                  {mode === "mixed" && <Zap className="w-4 h-4 inline mr-1" />}
                  {syncModeLabels[mode]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                showPresets
                  ? "bg-pink-500 text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Layers className="w-4 h-4" />
              动画预设
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentTime(0)}
                  className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-3 bg-pink-500 hover:bg-pink-600 rounded-full text-white transition-all"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <button
                  onClick={() => setCurrentTime(timelineDuration)}
                  className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-white/60">
                <span className="font-mono text-sm">{formatTime(currentTime)}</span>
                <span>/</span>
                <span className="font-mono text-sm">{formatTime(timelineDuration)}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-white/40 text-sm">速度:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </div>
            </div>

            <div className="flex-1 flex items-center px-4">
              <div className="flex-1 h-8 bg-white/5 rounded-full relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-pink-500/30"
                  style={{ width: `${(currentTime / timelineDuration) * 100}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={timelineDuration}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-pink-500 rounded-full shadow-lg -ml-2"
                  style={{ left: `${(currentTime / timelineDuration) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {showPresets && (
            <div className="w-64 border-l border-white/10 overflow-y-auto min-h-0">
              <div className="p-4">
                <h3 className="text-sm font-medium text-white/80 mb-3">动画预设</h3>
                <div className="space-y-2">
                  {DEFAULT_ANIMATION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        applyPreset(preset);
                        setShowPresets(false);
                      }}
                      className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all"
                    >
                      <div className="font-medium text-white text-sm mb-1">
                        {preset.name}
                      </div>
                      <div className="text-white/40 text-xs">
                        {preset.description}
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <span className="px-2 py-0.5 bg-pink-500/20 text-pink-300 text-xs rounded">
                          {syncModeLabels[preset.syncMode]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={reset}
                  className="w-full mt-4 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-sm transition-all"
                >
                  重置
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
