"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Clock, Music, TrendingUp, User, X } from "lucide-react";
import { useListeningHistory } from "@/hooks/useListeningHistory";
import { useAudioStore } from "@/store/audioStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { summarizeListeningStats } from "@/utils/listeningInsights";
import type { Song } from "@/types/song";

interface ListeningHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = "songs" | "artists";
type TimePeriod = "week" | "month";
type SongBoard = "hot" | "replay";

export const ListeningHistory: React.FC<ListeningHistoryProps> = ({ isOpen, onClose }) => {
  const { getWeeklyRanking, getMonthlyRanking, getTopArtists } = useListeningHistory();
  const playQueue = useAudioStore((state) => state.playQueue);
  const listeningStats = useStatsAchievementsStore((state) => state.listeningStats);

  const [viewMode, setViewMode] = useState<ViewMode>("songs");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("week");
  const [songBoard, setSongBoard] = useState<SongBoard>("hot");
  const summary = summarizeListeningStats(listeningStats);

  const songRanking = useMemo(() => {
    const ranking = timePeriod === "week" ? getWeeklyRanking() : getMonthlyRanking();
    if (songBoard === "replay") {
      return ranking
        .slice()
        .sort((a, b) => b.totalListenTime - a.totalListenTime || b.playCount - a.playCount);
    }
    return ranking;
  }, [timePeriod, songBoard, getWeeklyRanking, getMonthlyRanking]);

  const artistRanking = useMemo(() => getTopArtists(timePeriod), [timePeriod, getTopArtists]);

  const handlePlaySong = (_song: Song, index: number) => {
    playQueue(
      songRanking.map((record) => record.song),
      index
    );
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
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
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-white/80" />
            <h2 className="text-2xl font-semibold text-white">Listening Rankings</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close rankings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-white/10">
          <ModeButton active={viewMode === "songs"} onClick={() => setViewMode("songs")}>
            <Music className="h-4 w-4" /> Songs
          </ModeButton>
          <ModeButton active={viewMode === "artists"} onClick={() => setViewMode("artists")}>
            <User className="h-4 w-4" /> Artists
          </ModeButton>
        </div>

        <div className="space-y-3 border-b border-white/10 p-4">
          <div className="flex gap-2">
            <FilterButton active={timePeriod === "week"} onClick={() => setTimePeriod("week")}>
              This week
            </FilterButton>
            <FilterButton active={timePeriod === "month"} onClick={() => setTimePeriod("month")}>
              This month
            </FilterButton>
          </div>

          {viewMode === "songs" && (
            <div className="flex gap-2">
              <SubFilterButton active={songBoard === "hot"} onClick={() => setSongBoard("hot")}>
                Hot
              </SubFilterButton>
              <SubFilterButton
                active={songBoard === "replay"}
                onClick={() => setSongBoard("replay")}
              >
                Replay
              </SubFilterButton>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-white/35">
              Recent taste
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Your recent listening leans toward{" "}
              <span className="text-white">{summary.dominantPeriod}</span>. Top genres:{" "}
              <span className="text-white">
                {summary.dominantGenres.join(" / ") || "not enough data"}
              </span>
              . Overall activity is
              <span className="text-white">
                {summary.trend === "rising"
                  ? " rising"
                  : summary.trend === "cooling"
                    ? " cooling"
                    : " steady"}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
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
                  <EmptyState
                    icon={<BarChart3 className="mx-auto mb-3 h-12 w-12 opacity-50" />}
                    title="No listening records yet"
                    detail="Start playing music to build your rankings."
                  />
                ) : (
                  songRanking.map((record, index) => (
                    <motion.div
                      key={record.songId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handlePlaySong(record.song, index)}
                      className="group flex cursor-pointer items-center gap-4 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
                    >
                      <RankBadge index={index} />
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                        <Music className="h-6 w-6 text-white/60" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-medium text-white">{record.song.title}</h4>
                        <p className="truncate text-sm text-white/60">{record.song.artist}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-purple-400">
                          {timePeriod === "week" ? record.weekPlayCount : record.monthPlayCount}{" "}
                          plays
                        </div>
                        <div className="flex items-center gap-1 text-xs text-white/40">
                          <Clock className="h-3 w-3" />
                          {formatDuration(record.totalListenTime)}
                        </div>
                        <div className="mt-1 text-[11px] text-white/30">
                          {songBoard === "replay" ? "High replay" : "Recently popular"}
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
                  <EmptyState
                    icon={<User className="mx-auto mb-3 h-12 w-12 opacity-50" />}
                    title="No artist data yet"
                    detail="Play music to accumulate artist stats."
                  />
                ) : (
                  artistRanking.map((artist, index) => (
                    <motion.div
                      key={artist.artist}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
                    >
                      <RankBadge index={index} />
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                        <User className="h-6 w-6 text-white/60" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-medium text-white">{artist.artist}</h4>
                        <p className="text-sm text-white/60">{artist.songs.size} songs</p>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-purple-400">{artist.playCount} plays</div>
                        <div className="flex items-center gap-1 text-xs text-white/40">
                          <Clock className="h-3 w-3" />
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

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 transition-colors ${
        active
          ? "border-b-2 border-purple-500 bg-white/10 text-white"
          : "text-white/60 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-purple-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function SubFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-white/15 text-white" : "bg-white/5 text-white/55 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function RankBadge({ index }: { index: number }) {
  const className =
    index === 0
      ? "bg-yellow-500 text-yellow-900"
      : index === 1
        ? "bg-gray-400 text-gray-900"
        : index === 2
          ? "bg-amber-600 text-amber-100"
          : "bg-white/10 text-white/60";

  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${className}`}
    >
      {index + 1}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="py-12 text-center text-white/40">
      {icon}
      <p>{title}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
