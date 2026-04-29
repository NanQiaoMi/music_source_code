"use client";

import { useEffect, useCallback } from "react";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore, HistorySong } from "@/store/queueStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";

export const useMusicLibrarySync = () => {
  const { songs } = usePlaylistStore();
  const { history, clearHistory } = useQueueStore();
  const { listeningStats, resetStats } = useStatsAchievementsStore();

  const syncQueueHistory = useCallback(() => {
    if (songs.length === 0) return;

    const validSongIds = new Set(songs.map((s) => s.id));

    const validHistory = history.filter((h: HistorySong) => validSongIds.has(h.id));

    if (validHistory.length !== history.length) {
      console.log(`🧹 清理播放历史: ${history.length} -> ${validHistory.length}`);
      useQueueStore.setState({ history: validHistory });
    }
  }, [songs, history]);

  const syncTopSongs = useCallback(() => {
    if (songs.length === 0) return;

    const validSongIds = new Set(songs.map((s) => s.id));

    const validTopSongs = listeningStats.topSongs.filter((item) => {
      return item.song && validSongIds.has(item.song.id);
    });

    if (validTopSongs.length !== listeningStats.topSongs.length) {
      console.log(`🧹 清理听歌排行: ${listeningStats.topSongs.length} -> ${validTopSongs.length}`);
      useStatsAchievementsStore.setState((state) => ({
        listeningStats: {
          ...state.listeningStats,
          topSongs: validTopSongs,
        },
      }));
    }
  }, [songs, listeningStats.topSongs]);

  const syncTopArtists = useCallback(() => {
    if (songs.length === 0) return;

    const validArtistNames = new Set(songs.map((s) => s.artist));

    const validTopArtists = listeningStats.topArtists.filter((item) =>
      validArtistNames.has(item.artist)
    );

    if (validTopArtists.length !== listeningStats.topArtists.length) {
      console.log(
        `🧹 清理歌手排行: ${listeningStats.topArtists.length} -> ${validTopArtists.length}`
      );
      useStatsAchievementsStore.setState((state) => ({
        listeningStats: {
          ...state.listeningStats,
          topArtists: validTopArtists,
        },
      }));
    }
  }, [songs, listeningStats.topArtists]);

  const syncTopAlbums = useCallback(() => {
    if (songs.length === 0) return;

    const validAlbumNames = new Set(songs.filter((s) => s.album).map((s) => s.album!));

    const validTopAlbums = listeningStats.topAlbums.filter((item) =>
      validAlbumNames.has(item.album)
    );

    if (validTopAlbums.length !== listeningStats.topAlbums.length) {
      console.log(
        `🧹 清理专辑排行: ${listeningStats.topAlbums.length} -> ${validTopAlbums.length}`
      );
      useStatsAchievementsStore.setState((state) => ({
        listeningStats: {
          ...state.listeningStats,
          topAlbums: validTopAlbums,
        },
      }));
    }
  }, [songs, listeningStats.topAlbums]);

  const syncDailyPlayData = useCallback(() => {
    if (songs.length === 0) return;

    const validSongIds = new Set(songs.map((s) => s.id));

    const newDailyPlayData = listeningStats.dailyPlayData.map((dayData) => {
      return dayData;
    });

    if (newDailyPlayData.length !== listeningStats.dailyPlayData.length) {
      console.log(
        `🧹 清理每日数据: ${listeningStats.dailyPlayData.length} -> ${newDailyPlayData.length}`
      );
      useStatsAchievementsStore.setState((state) => ({
        listeningStats: {
          ...state.listeningStats,
          dailyPlayData: newDailyPlayData,
        },
      }));
    }
  }, [songs, listeningStats.dailyPlayData]);

  const syncAllData = useCallback(() => {
    console.log("🔄 开始同步音乐库数据...");

    syncQueueHistory();
    syncTopSongs();
    syncTopArtists();
    syncTopAlbums();
    syncDailyPlayData();

    console.log("✅ 音乐库数据同步完成");
  }, [syncQueueHistory, syncTopSongs, syncTopArtists, syncTopAlbums, syncDailyPlayData]);

  const clearAllStatsData = useCallback(() => {
    console.log("🗑️ 清空所有统计数据...");
    clearHistory();
    resetStats();
    console.log("✅ 统计数据已清空");
  }, [clearHistory, resetStats]);

  const hasInvalidDataFn = useCallback(() => {
    if (songs.length === 0) return false;

    const validSongIds = new Set(songs.map((s) => s.id));
    const hasInvalidHistory = history.some((h: HistorySong) => !validSongIds.has(h.id));
    const hasInvalidTopSongs = listeningStats.topSongs.some(
      (item) => !item.song || !validSongIds.has(item.song.id)
    );
    const hasInvalidTopArtists = listeningStats.topArtists.some(
      (item) => !songs.some((s) => s.artist === item.artist)
    );

    return hasInvalidHistory || hasInvalidTopSongs || hasInvalidTopArtists;
  }, [songs, history, listeningStats.topSongs, listeningStats.topArtists]);

  return {
    syncAllData,
    syncQueueHistory,
    syncTopSongs,
    syncTopArtists,
    syncTopAlbums,
    clearAllStatsData,
    hasInvalidData: hasInvalidDataFn,
  };
};
