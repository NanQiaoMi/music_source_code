"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEQ: () => void;
  onOpenVisualSettings?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  onOpenEQ,
  onOpenVisualSettings,
}) => {
  const volume = useAudioStore(state => state.volume);
  const setVolume = useAudioStore(state => state.setVolume);
  const playbackRate = useAudioStore(state => state.playbackRate);
  const setPlaybackRate = useAudioStore(state => state.setPlaybackRate);
  const isMuted = useAudioStore(state => state.isMuted);
  const toggleMute = useAudioStore(state => state.toggleMute);
  const bassBoost = useAudioStore(state => state.bassBoost);
  const setBassBoost = useAudioStore(state => state.setBassBoost);
  const trebleBoost = useAudioStore(state => state.trebleBoost);
  const setTrebleBoost = useAudioStore(state => state.setTrebleBoost);
  const vocalEnhance = useAudioStore(state => state.vocalEnhance);
  const setVocalEnhance = useAudioStore(state => state.setVocalEnhance);
  const surroundSound = useAudioStore(state => state.surroundSound);
  const setSurroundSound = useAudioStore(state => state.setSurroundSound);
  const stereoEnhance = useAudioStore(state => state.stereoEnhance);
  const setStereoEnhance = useAudioStore(state => state.setStereoEnhance);

  const [fadeInOut, setFadeInOut] = useState(true);
  const [autoPause, setAutoPause] = useState(false);

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-white/10 backdrop-blur-2xl border-r border-white/20 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-white text-xl font-semibold">音频设置</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar min-h-0">
              {/* Volume Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium">音量</h3>
                  <button
                    onClick={toggleMute}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                        />
                      </svg>
                    ) : volume < 0.5 ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgba(255,255,255,0.6) ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
                    }}
                  />
                  <span className="text-white/60 text-sm w-12 text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Playback Speed */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">播放速度</h3>
                <div className="grid grid-cols-3 gap-2">
                  {speedOptions.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackRate(speed)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${playbackRate === speed
                          ? "bg-white/20 text-white"
                          : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
                {/* Custom Speed Slider */}
                <div className="pt-2">
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((playbackRate - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) ${((playbackRate - 0.5) / 1.5) * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between text-white/40 text-xs mt-1">
                    <span>0.5x</span>
                    <span className="text-white/60">{playbackRate.toFixed(1)}x</span>
                    <span>2.0x</span>
                  </div>
                </div>
              </div>

              {/* Audio Effects */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">音频效果</h3>

                {/* EQ Equalizer */}
                <button
                  onClick={onOpenEQ}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 hover:from-pink-500/20 hover:to-purple-500/20 border border-pink-500/20 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <span className="text-white/90 font-medium">10段专业均衡器 (EQ)</span>
                  </div>
                  <svg className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Advanced Audio Matrix */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-5 mt-4">
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    高级音效矩阵
                  </h4>

                  {[
                    { label: "震撼重低音", value: bassBoost, set: setBassBoost, color: "from-orange-500 to-red-500" },
                    { label: "清澈高音", value: trebleBoost, set: setTrebleBoost, color: "from-cyan-400 to-blue-500" },
                    { label: "人声凸显", value: vocalEnhance, set: setVocalEnhance, color: "from-pink-400 to-rose-500" },
                    { label: "3D 空间环绕", value: surroundSound, set: setSurroundSound, color: "from-purple-400 to-indigo-500" },
                    { label: "立体声展宽", value: stereoEnhance, set: setStereoEnhance, color: "from-emerald-400 to-teal-500" },
                  ].map((effect, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/70">{effect.label}</span>
                        <span className="text-white/40">{effect.value}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100" step="1"
                        value={effect.value}
                        onChange={(e) => effect.set(parseInt(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, rgba(255,255,255,0.8) ${effect.value}%, rgba(255,255,255,0.1) ${effect.value}%)`,
                        }}
                      />
                    </div>
                  ))}
                </div>



                {/* Fade In/Out */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-white/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <span className="text-white/80">淡入淡出</span>
                  </div>
                  <button
                    onClick={() => setFadeInOut(!fadeInOut)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${fadeInOut ? "bg-white/30" : "bg-white/10"
                      }`}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                      animate={{ left: fadeInOut ? "26px" : "2px" }}
                      transition={{ duration: 0.2 }}
                    />
                  </button>
                </div>

                {/* Auto Pause */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-white/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-white/80">播放完自动暂停</span>
                  </div>
                  <button
                    onClick={() => setAutoPause(!autoPause)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${autoPause ? "bg-white/30" : "bg-white/10"
                      }`}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                      animate={{ left: autoPause ? "26px" : "2px" }}
                      transition={{ duration: 0.2 }}
                    />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
