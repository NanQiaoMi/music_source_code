"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useQueueStore } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { formatTime } from "@/utils/formatTime";

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ isOpen, onClose }) => {
  const { queue, currentIndex, removeFromQueue, clearQueue, reorderQueue, setCurrentIndex } =
    useQueueStore();
  const currentSong = useAudioStore(state => state.currentSong);
  const setCurrentSong = useAudioStore(state => state.setCurrentSong);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handlePlayFromQueue = (index: number) => {
    setCurrentIndex(index);
    const song = queue[index];
    if (song) {
      setCurrentSong(song);
      setIsPlaying(true);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    reorderQueue(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

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
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-96 bg-white/10 backdrop-blur-2xl border-l border-white/20 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-white text-lg font-semibold">播放队列</h2>
              <div className="flex items-center gap-2">
                {queue.length > 0 && (
                  <button
                    onClick={clearQueue}
                    className="text-white/60 hover:text-white text-sm px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                  >
                    清空
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
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
            </div>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-0">
              {queue.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 opacity-30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 6h16M4 10h16M4 14h16M4 18h16"
                    />
                  </svg>
                  <p>播放队列为空</p>
                </div>
              ) : (
                queue.map((song, index) => (
                  <motion.div
                    key={song.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${index === currentIndex
                        ? "bg-white/20 ring-1 ring-white/30"
                        : "bg-white/5 hover:bg-white/10"
                      } ${draggedIndex === index ? "opacity-50" : ""}`}
                    onClick={() => handlePlayFromQueue(index)}
                  >
                    {/* Drag Handle */}
                    <div className="text-white/20 cursor-grab active:cursor-grabbing">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 5h2v2H9V5zm0 4h2v2H9V9zm0 4h2v2H9v-2zm0 4h2v2H9v-2zM5 5h2v2H5V5zm0 4h2v2H5V9zm0 4h2v2H5v-2zm0 4h2v2H5v-2z" />
                      </svg>
                    </div>

                    {/* Cover */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <Image src={song.cover} alt={song.title} fill className="object-cover" />
                      {index === currentIndex && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="flex gap-0.5">
                            <motion.div
                              animate={{ height: [4, 12, 4] }}
                              transition={{ repeat: Infinity, duration: 0.5 }}
                              className="w-1 bg-white rounded-full"
                            />
                            <motion.div
                              animate={{ height: [8, 16, 8] }}
                              transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }}
                              className="w-1 bg-white rounded-full"
                            />
                            <motion.div
                              animate={{ height: [6, 14, 6] }}
                              transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }}
                              className="w-1 bg-white rounded-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-sm font-medium truncate ${index === currentIndex ? "text-white" : "text-white/80"}`}
                      >
                        {song.title}
                      </h4>
                      <p className="text-white/50 text-xs truncate">{song.artist}</p>
                    </div>

                    {/* Duration */}
                    <span className="text-white/40 text-xs">{formatTime(song.duration)}</span>

                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(index);
                      }}
                      className="text-white/30 hover:text-red-400 transition-colors p-1"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10">
              <p className="text-white/40 text-sm text-center">共 {queue.length} 首歌曲</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
