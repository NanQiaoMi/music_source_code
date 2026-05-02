"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useQueueStore, HistorySong } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { formatTime } from "@/utils/formatTime";
import { Song } from "@/store/playlistStore";
import { GlassDrawer } from "@/components/shared/Glass";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose }) => {
  const { history, clearHistory, addToQueue } = useQueueStore();
  const setCurrentSong = useAudioStore(state => state.setCurrentSong);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistorySong[]> = {};
    history.forEach((song) => {
      const date = new Date(song.playedAt);
      const dateKey = date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(song);
    });
    return groups;
  }, [history]);

  const dates = Object.keys(groupedHistory).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const handlePlay = (song: HistorySong) => {
    setCurrentSong({ ...song, cover: song.cover || "/default-cover.jpg" });
    setIsPlaying(true);
  };

  const handleAddToQueue = (song: HistorySong) => {
    addToQueue({ ...song, cover: song.cover || "/default-cover.jpg" });
  };

  const handleReplayAll = (dateKey: string) => {
    const songs = groupedHistory[dateKey];
    if (songs?.length > 0) {
      setCurrentSong({ ...songs[0], cover: songs[0].cover || "/default-cover.jpg" });
      setIsPlaying(true);
      songs.slice(1).forEach((song) => handleAddToQueue(song));
    }
  };

  return (
    <GlassDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="播放历史"
      height="half"
      headerRight={
        history.length > 0 ? (
          <button
            onClick={clearHistory}
            className="text-white/50 hover:text-white text-[13px] transition-colors"
          >
            清空
          </button>
        ) : undefined
      }
    >
      {/* Date Filter */}
      {dates.length > 0 && (
        <div className="flex gap-1.5 px-5 py-3 overflow-x-auto">
          <button
            onClick={() => setSelectedDate(null)}
            className={`px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap transition-colors ${
              selectedDate === null ? "bg-white/[0.15] text-white" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10]"
            }`}
          >
            全部
          </button>
          {dates.map((date) => (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap transition-colors ${
                selectedDate === date ? "bg-white/[0.15] text-white" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10]"
              }`}
            >
              {date}
            </button>
          ))}
        </div>
      )}

      {/* History List */}
      <div className="px-5 py-2">
        {history.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <svg className="w-14 h-14 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[13px]">暂无播放历史</p>
          </div>
        ) : (
          <div className="space-y-5">
            {(selectedDate ? [selectedDate] : dates).map((date) => (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white/40 text-[12px] font-medium">{date}</h3>
                  <button
                    onClick={() => handleReplayAll(date)}
                    className="text-white/30 hover:text-white/60 text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                    </svg>
                    重播
                  </button>
                </div>
                <div className="space-y-0.5">
                  {groupedHistory[date]?.map((song, index) => (
                    <motion.div
                      key={`${song.id}-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.06] transition-colors group"
                    >
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                        <Image src={song.cover || "/default-cover.jpg"} alt={song.title} fill className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white/80 text-[13px] font-medium truncate">{song.title}</h4>
                        <p className="text-white/35 text-[11px] truncate">{song.artist}</p>
                      </div>
                      <span className="text-white/25 text-[11px] tabular-nums">{formatTime(song.duration)}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handlePlay(song)} className="p-1.5 text-white/40 hover:text-white rounded-full transition-colors" title="播放">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </button>
                        <button onClick={() => handleAddToQueue(song)} className="p-1.5 text-white/40 hover:text-white rounded-full transition-colors" title="添加到队列">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
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
    </GlassDrawer>
  );
};
