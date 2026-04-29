"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useQueueStore, HistorySong } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { formatTime } from "@/utils/formatTime";
import { Song } from "@/store/playlistStore";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose }) => {
  const { history, clearHistory, addToQueue } = useQueueStore();
  const setCurrentSong = useAudioStore(state => state.setCurrentSong);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Group history by date
  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistorySong[]> = {};

    history.forEach((song) => {
      const date = new Date(song.playedAt);
      const dateKey = date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(song);
    });

    return groups;
  }, [history]);

  const dates = Object.keys(groupedHistory).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const handlePlay = (song: HistorySong) => {
    const songWithCover: Song = {
      ...song,
      cover: song.cover || "/default-cover.jpg",
    };
    setCurrentSong(songWithCover);
    setIsPlaying(true);
  };

  const handleAddToQueue = (song: HistorySong) => {
    const songWithCover: Song = {
      ...song,
      cover: song.cover || "/default-cover.jpg",
    };
    addToQueue(songWithCover);
  };

  const handleReplayAll = (dateKey: string) => {
    const songs = groupedHistory[dateKey];
    if (songs && songs.length > 0) {
      const firstSong: Song = {
        ...songs[0],
        cover: songs[0].cover || "/default-cover.jpg",
      };
      setCurrentSong(firstSong);
      setIsPlaying(true);
      songs.slice(1).forEach((song) => handleAddToQueue(song));
    }
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
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 h-[70vh] bg-white/10 backdrop-blur-2xl border-t border-white/20 z-50 flex flex-col rounded-t-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-white text-xl font-semibold">播放历史</h2>
                <p className="text-white/50 text-sm mt-1">共 {history.length} 首歌曲</p>
              </div>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-white/60 hover:text-white text-sm px-4 py-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    清空历史
                  </button>
                )}
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
            </div>

            {/* Date Filter */}
            {dates.length > 0 && (
              <div className="flex gap-2 px-6 py-4 overflow-x-auto border-b border-white/10">
                <button
                  onClick={() => setSelectedDate(null)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                    selectedDate === null
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  全部
                </button>
                {dates.map((date) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                      selectedDate === date
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {date}
                  </button>
                ))}
              </div>
            )}

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
              {history.length === 0 ? (
                <div className="text-center py-16 text-white/40">
                  <svg
                    className="w-20 h-20 mx-auto mb-4 opacity-30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p>暂无播放历史</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(selectedDate ? [selectedDate] : dates).map((date) => (
                    <div key={date}>
                      {/* Date Header */}
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white/60 text-sm font-medium">{date}</h3>
                        <button
                          onClick={() => handleReplayAll(date)}
                          className="text-white/40 hover:text-white text-xs flex items-center gap-1 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                          </svg>
                          重播全部
                        </button>
                      </div>

                      {/* Songs */}
                      <div className="space-y-2">
                        {groupedHistory[date]?.map((song, index) => (
                          <motion.div
                            key={`${song.id}-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                          >
                            {/* Cover */}
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                              <Image
                                src={song.cover || "/default-cover.jpg"}
                                alt={song.title}
                                fill
                                className="object-cover"
                              />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-medium truncate">{song.title}</h4>
                              <p className="text-white/50 text-sm truncate">{song.artist}</p>
                            </div>

                            {/* Duration */}
                            <span className="text-white/40 text-sm">
                              {formatTime(song.duration)}
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handlePlay(song)}
                                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                title="播放"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleAddToQueue(song)}
                                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                title="添加到队列"
                              >
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
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
