"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useQueueStore } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { formatTime } from "@/utils/formatTime";
import { GlassPanel } from "@/components/shared/Glass";

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ isOpen, onClose }) => {
  const { queue, currentIndex, removeFromQueue, clearQueue, reorderQueue, setCurrentIndex } =
    useQueueStore();
  const currentSong = useAudioStore((state) => state.currentSong);
  const setCurrentSong = useAudioStore((state) => state.setCurrentSong);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
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

  const headerRight =
    queue.length > 0 ? (
      <button
        onClick={clearQueue}
        className="text-white/60 hover:text-white text-[13px] px-3 py-1 rounded-full hover:bg-white/10 transition-colors"
      >
        清空
      </button>
    ) : undefined;

  return (
    <GlassPanel
      position="right"
      size="md"
      isOpen={isOpen}
      onClose={onClose}
      title="播放队列"
      headerRight={headerRight}
      footer={<p className="text-white/40 text-[13px] text-center">共 {queue.length} 首歌曲</p>}
    >
      <div className="p-3 space-y-1">
        {queue.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <svg
              className="w-14 h-14 mx-auto mb-3 opacity-40"
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
            <p className="text-[13px]">播放队列为空</p>
          </div>
        ) : (
          queue.map((song, index) => (
            <motion.div
              key={song.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                index === currentIndex ? "bg-white/[0.12]" : "hover:bg-white/[0.06]"
              } ${draggedIndex === index ? "opacity-40" : ""}`}
              onClick={() => handlePlayFromQueue(index)}
            >
              <div className="text-white/20 cursor-grab active:cursor-grabbing">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5h2v2H9V5zm0 4h2v2H9V9zm0 4h2v2H9v-2zm0 4h2v2H9v-2zM5 5h2v2H5V5zm0 4h2v2H5V9zm0 4h2v2H5v-2zm0 4h2v2H5v-2z" />
                </svg>
              </div>

              <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
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

              <div className="flex-1 min-w-0">
                <h4
                  className={`text-[13px] font-medium truncate ${index === currentIndex ? "text-white" : "text-white/80"}`}
                >
                  {song.title}
                </h4>
                <p className="text-white/40 text-[11px] truncate">{song.artist}</p>
              </div>

              <span className="text-white/30 text-[11px]">{formatTime(song.duration)}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromQueue(index);
                }}
                className="text-white/20 hover:text-red-400 transition-colors p-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </GlassPanel>
  );
};
