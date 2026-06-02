"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Clock, Music2, Smile, X } from "lucide-react";
import { buildJournalSongRows } from "@/lib/journal/listeningJournal";
import { usePlaylistStore } from "@/store/playlistStore";
import { useListeningJournalStore } from "@/store/listeningJournalStore";

interface JournalDayPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JournalDayPanel({ isOpen, onClose }: JournalDayPanelProps) {
  const { selectedDate, days, eventsByDate, appendNote } = useListeningJournalStore();
  const songs = usePlaylistStore((state) => state.songs);
  const [statusMessage, setStatusMessage] = useState("按回车或点击其他区域保存笔记。");
  const dayEvents = eventsByDate[selectedDate];
  const day = days[selectedDate] || {
    date: selectedDate,
    totalMinutes: 0,
    topSongIds: [],
    dominantMood: null,
  };
  const topSongs = useMemo(
    () => buildJournalSongRows(day.topSongIds.slice(0, 5), songs, dayEvents || []),
    [day.topSongIds, songs, dayEvents]
  );

  const saveNote = (value: string) => {
    appendNote(selectedDate, value.trim());
    setStatusMessage(`Saved note for ${selectedDate}`);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/92 shadow-2xl backdrop-blur-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">日记详情</h2>
              <p className="text-sm text-white/50">{selectedDate}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="关闭日记详情"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            <Metric
              icon={<Clock className="h-4 w-4" />}
              label="分钟"
              value={String(day.totalMinutes)}
            />
            <Metric
              icon={<Music2 className="h-4 w-4" />}
              label="热门歌曲"
              value={String(topSongs.length)}
            />
            <Metric
              icon={<Smile className="h-4 w-4" />}
              label="心情"
              value={day.dominantMood || "无"}
            />
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h3 className="mb-3 text-sm font-medium text-white">热门歌曲</h3>
            {topSongs.length === 0 ? (
              <p className="text-sm text-white/45">今日暂无听歌记录。</p>
            ) : (
              <div className="space-y-2">
                {topSongs.map((song, index) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs text-white/55">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white/80">
                        {song.title}
                      </span>
                      <span className="block truncate text-xs text-white/45">
                        {song.artist}
                        {song.album ? ` - ${song.album}` : ""}
                      </span>
                    </span>
                    {song.missing && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/45">
                        Missing
                      </span>
                    )}
                    <span className="shrink-0 text-right text-[11px] text-cyan-100/65">
                      <span className="block">{song.playCount} 次</span>
                      <span className="block text-white/35">{song.totalMinutes} 分钟</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <label className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <span className="mb-2 block text-sm font-medium text-white">一句话笔记</span>
            <input
              key={selectedDate}
              defaultValue={day.note || ""}
              onBlur={(event) => saveNote(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveNote(event.currentTarget.value);
                }
              }}
              maxLength={120}
              placeholder="这一天的听歌感受如何？"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/50"
            />
            <span role="status" aria-live="polite" className="mt-2 block text-xs text-cyan-200/70">
              {statusMessage}
            </span>
          </label>
        </main>
      </motion.div>
    </motion.div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-white/45">
        {icon}
        {label}
      </div>
      <div className="truncate text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
