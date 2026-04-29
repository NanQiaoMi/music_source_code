"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useAudioStore } from "@/store/audioStore";
import { Song } from "@/store/audioStore";

const sanitizeSongForStorage = (song: Song) => {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    cover: song.cover?.startsWith("data:image/") ? "" : song.cover,
  };
};

export interface ListeningRecord {
  songId: string;
  song: Song;
  playCount: number;
  totalListenTime: number;
  lastPlayedAt: number;
  weekPlayCount: number;
  monthPlayCount: number;
  lastWeekPlayedAt: number;
  lastMonthPlayedAt: number;
}

export interface ArtistStats {
  artist: string;
  playCount: number;
  totalListenTime: number;
  songs: Set<string>;
}

const STORAGE_KEY = "listening_history";
const ARTIST_STATS_KEY = "artist_stats";
const MAX_HISTORY_ITEMS = 500; // Limit history to prevent QuotaExceededError
const MAX_ARTIST_STATS = 100;

export const useListeningHistory = () => {
  const currentSong = useAudioStore(state => state.currentSong);
  const isPlaying = useAudioStore(state => state.isPlaying);

  const getHistoryFromStorage = useCallback((): Record<string, ListeningRecord> => {
    if (typeof window === "undefined") return {};

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Failed to load listening history:", error);
      return {};
    }
  }, []);

  const saveHistoryToStorage = useCallback((history: Record<string, ListeningRecord>) => {
    if (typeof window === "undefined") return;

    try {
      // Prune history if it exceeds the limit
      const entries = Object.entries(history);
      if (entries.length > MAX_HISTORY_ITEMS) {
        // Sort by lastPlayedAt and keep the most recent ones
        const prunedHistory = Object.fromEntries(
          entries
            .sort(([, a], [, b]) => b.lastPlayedAt - a.lastPlayedAt)
            .slice(0, MAX_HISTORY_ITEMS)
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedHistory));
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      }
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.warn("Storage quota exceeded, clearing oldest history entries...");
        // Emergency prune: keep only half
        const entries = Object.entries(history);
        const prunedHistory = Object.fromEntries(
          entries
            .sort(([, a], [, b]) => b.lastPlayedAt - a.lastPlayedAt)
            .slice(0, Math.floor(MAX_HISTORY_ITEMS / 2))
        );
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedHistory));
        } catch (e) {
          console.error("Critical storage failure:", e);
        }
      } else {
        console.error("Failed to save listening history:", error);
      }
    }
  }, []);

  const recordPlay = useCallback(
    (song: Song) => {
      if (!song || !song.id) return;

      const history = getHistoryFromStorage();
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

      if (history[song.id]) {
        const record = history[song.id];
        record.playCount += 1;
        record.lastPlayedAt = now;

        if (record.lastPlayedAt > oneWeekAgo) {
          record.weekPlayCount += 1;
        }
        if (record.lastPlayedAt > oneMonthAgo) {
          record.monthPlayCount += 1;
        }
      } else {
        history[song.id] = {
          songId: song.id,
          song: sanitizeSongForStorage(song),
          playCount: 1,
          totalListenTime: 0,
          lastPlayedAt: now,
          weekPlayCount: 1,
          monthPlayCount: 1,
          lastWeekPlayedAt: now,
          lastMonthPlayedAt: now,
        };
      }

      saveHistoryToStorage(history);
      updateArtistStats(song);
    },
    [getHistoryFromStorage, saveHistoryToStorage]
  );

  const updateListenTime = useCallback(
    (songId: string, duration: number) => {
      const history = getHistoryFromStorage();
      if (history[songId]) {
        history[songId].totalListenTime += duration;
        saveHistoryToStorage(history);
      }
    },
    [getHistoryFromStorage, saveHistoryToStorage]
  );

  const getWeeklyRanking = useCallback((): ListeningRecord[] => {
    const history = getHistoryFromStorage();
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return Object.values(history)
      .filter((record) => record.lastPlayedAt > oneWeekAgo)
      .sort((a, b) => b.weekPlayCount - a.weekPlayCount)
      .slice(0, 20);
  }, [getHistoryFromStorage]);

  const getMonthlyRanking = useCallback((): ListeningRecord[] => {
    const history = getHistoryFromStorage();
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return Object.values(history)
      .filter((record) => record.lastPlayedAt > oneMonthAgo)
      .sort((a, b) => b.monthPlayCount - a.monthPlayCount)
      .slice(0, 20);
  }, [getHistoryFromStorage]);

  const getArtistRanking = useCallback(
    (period: "week" | "month" = "week"): ArtistStats[] => {
      const history = getHistoryFromStorage();
      const artistMap = new Map<string, ArtistStats>();
      const cutoffTime =
        period === "week"
          ? Date.now() - 7 * 24 * 60 * 60 * 1000
          : Date.now() - 30 * 24 * 60 * 60 * 1000;

      Object.values(history)
        .filter((record) => record.lastPlayedAt > cutoffTime)
        .forEach((record) => {
          const artist = record.song.artist || "Unknown Artist";
          if (artistMap.has(artist)) {
            const stats = artistMap.get(artist)!;
            stats.playCount += period === "week" ? record.weekPlayCount : record.monthPlayCount;
            stats.totalListenTime += record.totalListenTime;
            stats.songs.add(record.songId);
          } else {
            artistMap.set(artist, {
              artist,
              playCount: period === "week" ? record.weekPlayCount : record.monthPlayCount,
              totalListenTime: record.totalListenTime,
              songs: new Set([record.songId]),
            });
          }
        });

      return Array.from(artistMap.values())
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 20);
    },
    [getHistoryFromStorage]
  );

  const getTopArtists = useCallback(
    (period: "week" | "month" = "week"): ArtistStats[] => {
      return getArtistRanking(period);
    },
    [getArtistRanking]
  );

  const getPlayCount = useCallback(
    (songId: string): number => {
      const history = getHistoryFromStorage();
      return history[songId]?.playCount || 0;
    },
    [getHistoryFromStorage]
  );

  const getLastPlayedAt = useCallback(
    (songId: string): number | null => {
      const history = getHistoryFromStorage();
      return history[songId]?.lastPlayedAt || null;
    },
    [getHistoryFromStorage]
  );

  const clearHistory = useCallback(() => {
    saveHistoryToStorage({});
  }, [saveHistoryToStorage]);

  const updateArtistStats = useCallback((song: Song) => {
    if (typeof window === "undefined") return;

    try {
      const data = localStorage.getItem(ARTIST_STATS_KEY);
      const stats = data ? JSON.parse(data) : {};
      const artist = song.artist || "Unknown Artist";

      if (!stats[artist]) {
        stats[artist] = {
          playCount: 0,
          totalListenTime: 0,
          songs: [],
        };
      }

      stats[artist].playCount += 1;
      if (!stats[artist].songs.includes(song.id)) {
        stats[artist].songs.push(song.id);
      }

      // Prune artist stats if needed
      let finalStats = stats;
      const artistEntries = Object.entries(stats);
      if (artistEntries.length > MAX_ARTIST_STATS) {
        finalStats = Object.fromEntries(
          artistEntries
            .sort(([, a]: any, [, b]: any) => b.playCount - a.playCount)
            .slice(0, MAX_ARTIST_STATS)
        );
      }

      localStorage.setItem(ARTIST_STATS_KEY, JSON.stringify(finalStats));
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        localStorage.removeItem(ARTIST_STATS_KEY); // Clear it if it's too big
      }
      console.error("Failed to update artist stats:", error);
    }
  }, []);

  useEffect(() => {
    if (currentSong && isPlaying) {
      const timeout = setTimeout(() => {
        recordPlay(currentSong);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [currentSong?.id, isPlaying, recordPlay]);

  return {
    recordPlay,
    updateListenTime,
    getWeeklyRanking,
    getMonthlyRanking,
    getTopArtists,
    getArtistRanking,
    getPlayCount,
    getLastPlayedAt,
    clearHistory,
  };
};
