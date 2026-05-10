"use client";

import React, { useMemo } from "react";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { GlassCard } from "@/components/shared/Glass/GlassCard";

const StatsVisuals = () => {
  const stats = useStatsAchievementsStore();

  const playTimeStats = useMemo(
    () =>
      stats.getPlayTimeStats?.() ?? {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        allTime: 0,
      },
    [stats]
  );

  const topSongs = useMemo(() => stats.getTopPlayedSongs?.(10) ?? [], [stats]);
  const topArtists = useMemo(() => stats.getTopArtists?.(10) ?? [], [stats]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-6 p-4">
      <GlassCard className="p-4">
        <h3 className="text-lg font-semibold mb-3">播放时长统计</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm opacity-60">今日</p>
            <p className="text-xl font-bold">{formatTime(playTimeStats.today)}</p>
          </div>
          <div>
            <p className="text-sm opacity-60">本周</p>
            <p className="text-xl font-bold">{formatTime(playTimeStats.thisWeek)}</p>
          </div>
          <div>
            <p className="text-sm opacity-60">本月</p>
            <p className="text-xl font-bold">{formatTime(playTimeStats.thisMonth)}</p>
          </div>
          <div>
            <p className="text-sm opacity-60">总计</p>
            <p className="text-xl font-bold">{formatTime(playTimeStats.allTime)}</p>
          </div>
        </div>
      </GlassCard>

      {topSongs.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-lg font-semibold mb-3">最常播放歌曲 Top 10</h3>
          <div className="space-y-2">
            {topSongs.map((song, i) => (
              <div key={song.songId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-40 w-6">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {song.title}
                    </p>
                    <p className="text-xs opacity-50">{song.artist}</p>
                  </div>
                </div>
                <span className="text-xs opacity-40">{song.playCount}次</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {topArtists.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-lg font-semibold mb-3">最常播放歌手 Top 10</h3>
          <div className="space-y-2">
            {topArtists.map((artist, i) => (
              <div key={artist.artist} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-40 w-6">{i + 1}</span>
                  <span className="text-sm">{artist.artist}</span>
                </div>
                <span className="text-xs opacity-40">{artist.playCount}次</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default StatsVisuals;