"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListeningHistory } from "@/hooks/useListeningHistory";
import { useAudioStore } from "@/store/audioStore";
import { X, TrendingUp, Music, User, Clock, BarChart3 } from "lucide-react";

interface ListeningHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = "songs" | "artists";
type TimePeriod = "week" | "month";

export const ListeningHistory: React.FC<ListeningHistoryProps> = ({ isOpen, onClose }) => {
  const { getWeeklyRanking, getMonthlyRanking, getTopArtists } = useListeningHistory();
  const playQueue = useAudioStore(state => state.playQueue);

  const [viewMode, setViewMode] = useState<ViewMode>("songs");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("week");

  const songRanking = useMemo(() => {
    return timePeriod === "week" ? getWeeklyRanking() : getMonthlyRanking();
  }, [timePeriod, getWeeklyRanking, getMonthlyRanking]);

  const artistRanking = useMemo(() => {
    return getTopArtists(timePeriod);
  }, [timePeriod, getTopArtists]);

  const handlePlaySong = (song: any, index: number) => {
    const songs = songRanking.map((r) => r.song);
    playQueue(songs, index);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[80vh] bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-white/80" />
            <h2 className="text-white text-2xl font-semibold">听歌排行</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setViewMode("songs")}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-colors ${
              viewMode === "songs"
                ? "bg-white/10 text-white border-b-2 border-purple-500"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Music className="w-4 h-4" />
            歌曲排行
          </button>
          <button
            onClick={() => setViewMode("artists")}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-colors ${
              viewMode === "artists"
                ? "bg-white/10 text-white border-b-2 border-purple-500"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <User className="w-4 h-4" />
            歌手排行
          </button>
        </div>

        {/* Time Period Filter */}
        <div className="flex gap-2 p-4 border-b border-white/10">
          <button
            onClick={() => setTimePeriod("week")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timePeriod === "week"
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            本周
          </button>
          <button
            onClick={() => setTimePeriod("month")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timePeriod === "month"
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            本月
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
          <AnimatePresence mode="wait">
            {viewMode === "songs" ? (
              <motion.div
                key="songs"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-2"
              >
                {songRanking.length === 0 ? (
                  <div className="text-center py-12 text-white/40">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无听歌记录</p>
                    <p className="text-sm mt-1">开始播放音乐来积累你的听歌数据吧</p>
                  </div>
                ) : (
                  songRanking.map((record, index) => (
                    <motion.div
                      key={record.songId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handlePlaySong(record.song, index)}
                      className="flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors group"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0
                            ? "bg-yellow-500 text-yellow-900"
                            : index === 1
                              ? "bg-gray-400 text-gray-900"
                              : index === 2
                                ? "bg-amber-600 text-amber-100"
                                : "bg-white/10 text-white/60"
                        }`}
                      >
                        {index + 1}
                      </div>

                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                        <Music className="w-6 h-6 text-white/60" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">{record.song.title}</h4>
                        <p className="text-white/60 text-sm truncate">{record.song.artist}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-purple-400 font-medium">
                          {timePeriod === "week" ? record.weekPlayCount : record.monthPlayCount} 次
                        </div>
                        <div className="text-white/40 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(record.totalListenTime)}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div
                key="artists"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-2"
              >
                {artistRanking.length === 0 ? (
                  <div className="text-center py-12 text-white/40">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无歌手数据</p>
                    <p className="text-sm mt-1">开始播放音乐来积累你的听歌数据吧</p>
                  </div>
                ) : (
                  artistRanking.map((artist, index) => (
                    <motion.div
                      key={artist.artist}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0
                            ? "bg-yellow-500 text-yellow-900"
                            : index === 1
                              ? "bg-gray-400 text-gray-900"
                              : index === 2
                                ? "bg-amber-600 text-amber-100"
                                : "bg-white/10 text-white/60"
                        }`}
                      >
                        {index + 1}
                      </div>

                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                        <User className="w-6 h-6 text-white/60" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">{artist.artist}</h4>
                        <p className="text-white/60 text-sm">{artist.songs.size} 首歌</p>
                      </div>

                      <div className="text-right">
                        <div className="text-purple-400 font-medium">{artist.playCount} 次</div>
                        <div className="text-white/40 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(artist.totalListenTime)}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};
