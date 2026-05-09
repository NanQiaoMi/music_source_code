"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGestureStore } from "@/store/gestureStore";
import { useAudioStore } from "@/store/audioStore";
import { formatTime } from "@/utils/formatTime";

export const GestureFeedback: React.FC = () => {
  const {
    showVolumePanel,
    volumePanelValue,
    showSpeedPanel,
    speedPanelValue,
    showModeToast,
    modeToastMessage,
    showHeartAnimation,
    showSeekPreview,
    seekPreviewTime,
    seekPreviewLyric,
  } = useGestureStore();

  const currentSong = useAudioStore((state) => state.currentSong);

  return (
    <>
      {/* Volume Panel - Right side glassmorphism */}
      <AnimatePresence>
        {showVolumePanel && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.2 }}
            className="fixed right-8 top-1/2 -translate-y-1/2 z-50"
          >
            <div className="bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 p-4 shadow-2xl">
              <div className="flex flex-col items-center gap-3">
                {/* Volume Icon */}
                <div className="text-white/80">
                  {volumePanelValue === 0 ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  ) : volumePanelValue < 0.5 ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  )}
                </div>

                {/* Volume Bar */}
                <div className="w-2 h-32 bg-white/10 rounded-full overflow-hidden relative">
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white/40 to-white/80 rounded-full"
                    initial={{ height: 0 }}
                    animate={{ height: `${volumePanelValue * 100}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>

                {/* Volume Value */}
                <span className="text-white font-semibold text-sm">
                  {Math.round(volumePanelValue * 100)}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speed Panel - Center glassmorphism */}
      <AnimatePresence>
        {showSpeedPanel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 px-8 py-6 shadow-2xl">
              <div className="flex flex-col items-center gap-2">
                <span className="text-white/60 text-xs uppercase tracking-wider">播放速度</span>
                <span className="text-white text-3xl font-bold">{speedPanelValue.toFixed(1)}x</span>
                <div className="flex gap-1 mt-2">
                  {[0.5, 1, 1.5, 2].map((speed) => (
                    <div
                      key={speed}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        Math.abs(speedPanelValue - speed) < 0.3 ? "bg-white" : "bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode Toast - Top center */}
      <AnimatePresence>
        {showModeToast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.2 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-white/10 backdrop-blur-2xl rounded-full border border-white/20 px-6 py-3 shadow-2xl flex items-center gap-3">
              <svg
                className="w-5 h-5 text-white/80"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="text-white font-medium">{modeToastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Heart Animation */}
      <AnimatePresence>
        {showHeartAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.5 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <svg
              className="w-24 h-24 text-pink-500"
              fill="currentColor"
              viewBox="0 0 24 24"
              style={{
                filter: "drop-shadow(0 0 20px rgba(236, 72, 153, 0.8))",
              }}
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seek Preview */}
      <AnimatePresence>
        {showSeekPreview && currentSong && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 px-6 py-4 shadow-2xl">
              <div className="flex flex-col items-center gap-2">
                <span className="text-white text-2xl font-bold">{formatTime(seekPreviewTime)}</span>
                {seekPreviewLyric && (
                  <span className="text-white/60 text-sm max-w-xs text-center truncate">
                    {seekPreviewLyric}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
