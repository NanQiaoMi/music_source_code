"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Song } from "@/types/song";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import {
  generateDailyRecommendationGroups,
  getDailyRecommendationMode,
  AVAILABLE_RECOMMENDATION_MODES,
  type DailyRecommendationGroup,
  type DailyRecommendationMode,
} from "@/utils/recommendationLogic";
import { useAudioStore } from "@/store/audioStore";
import { useRecommendationStore } from "@/store/recommendationStore";
import { useEmotionStore } from "@/store/emotionStore";
import { collectRecommendationInputs } from "@/lib/recommendation/inputs";

export interface DailyRecommendation {
  songIds: string[];
  generatedAt: number;
  lastUpdated: string;
}

const RECOMMENDATION_KEY = "daily_recommendation";

export const useDailyRecommendation = () => {
  const { songs } = usePlaylistStore();
  const { history } = useQueueStore();
  const { listeningStats } = useStatsAchievementsStore();
  const [recommendationSongIds, setRecommendationSongIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getToday = useCallback((): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const loadRecommendationFromStorage = useCallback((): string[] | null => {
    if (typeof window === "undefined") return null;

    try {
      const data = localStorage.getItem(RECOMMENDATION_KEY);
      if (!data) return null;

      const parsed = JSON.parse(data);
      const today = getToday();

      if (parsed.songs && !parsed.songIds) {
        console.warn("Clearing old large daily recommendation format");
        localStorage.removeItem(RECOMMENDATION_KEY);
        return null;
      }

      if (parsed.lastUpdated === today && Array.isArray(parsed.songIds)) {
        return parsed.songIds;
      }
      return null;
    } catch (error) {
      console.error("Failed to load recommendation:", error);
      localStorage.removeItem(RECOMMENDATION_KEY);
      return null;
    }
  }, [getToday]);

  const saveRecommendationToStorage = useCallback(
    (songIds: string[]) => {
      if (typeof window === "undefined") return;

      try {
        const dataToSave: DailyRecommendation = {
          songIds,
          generatedAt: Date.now(),
          lastUpdated: getToday(),
        };
        localStorage.setItem(RECOMMENDATION_KEY, JSON.stringify(dataToSave));
      } catch (error) {
        console.error("Failed to save recommendation:", error);
      }
    },
    [getToday]
  );

  const getTopArtists = useCallback((): { artist: string; playCount: number }[] => {
    const artistCounts = new Map<string, number>();

    history.forEach((song) => {
      if (song.artist) {
        artistCounts.set(song.artist, (artistCounts.get(song.artist) || 0) + 1);
      }
    });

    listeningStats.topArtists?.forEach((item) => {
      if (item.artist) {
        artistCounts.set(item.artist, (artistCounts.get(item.artist) || 0) + item.playCount);
      }
    });

    return Array.from(artistCounts.entries())
      .map(([artist, playCount]) => ({ artist, playCount }))
      .sort((a, b) => b.playCount - a.playCount);
  }, [history, listeningStats]);

  const [recommendationGroups, setRecommendationGroups] = useState<DailyRecommendationGroup[]>([]);
  const [customMode, setCustomMode] = useState<DailyRecommendationMode | null>(null);
  const [recommendationMode, setRecommendationMode] = useState<DailyRecommendationMode | null>(
    null
  );

  const generateRecommendationInternal = useCallback(
    (customMode?: DailyRecommendationMode): string[] => {
      if (songs.length === 0) return [];

      const { negativeFeedback } = useRecommendationStore.getState();
      const negSongIds = new Set(negativeFeedback.map((f) => f.songId));
      const negArtists = new Set(
        negativeFeedback.filter((f) => f.artist).map((f) => f.artist?.toLowerCase().trim())
      );
      const negGenres = new Set(
        negativeFeedback.filter((f) => f.genre).map((f) => f.genre?.toLowerCase().trim())
      );

      const filteredSongs = songs.filter((s) => {
        if (negSongIds.has(s.id)) return false;
        if (s.artist && negArtists.has(s.artist.toLowerCase().trim())) return false;
        if (s.genre && negGenres.has(s.genre.toLowerCase().trim())) return false;
        return true;
      });
      const sourceSongs = filteredSongs.length > 0 ? filteredSongs : songs;

      const topArtists = getTopArtists()
        .slice(0, 5)
        .map((a) => a.artist);
      const topGenres = (listeningStats.genreDistribution || []).slice(0, 5).map((g) => g.genre);
      const recentSongs = history.slice(0, 20).map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration,
        cover: s.cover,
        source: "local" as const,
      }));
      const playCounts = new Map(
        (listeningStats.topSongs || []).map((item) => [item.song.id, item.playCount])
      );

      const songsWithCount = sourceSongs.map((song) => ({
        ...song,
        playCount: playCounts.get(song.id) || 0,
        lastPlayedAt: history.find((h) => h.id === song.id) ? Date.now() : undefined,
        addedAt: song.addedAt,
      }));

      const activeMode = customMode || getDailyRecommendationMode();
      const favorites = useFavoritesStore.getState().favorites || [];
      const favoriteSongIds = new Set<string>(favorites.map((f: Song) => f.id));

    const context = {
      recentSongs,
      topArtists,
      topGenres,
      skippedSongIds: new Set<string>(),
      favoriteSongIds,
      mode: activeMode,
    };
    const result = generateDailyRecommendationGroups(songsWithCount, context, activeMode, 6);

    useRecommendationStore.getState().refreshRecommendations(
      collectRecommendationInputs({
        getPlaylists: usePlaylistStore.getState,
        getEmotionTags: useEmotionStore.getState,
        getHistory: useQueueStore.getState,
      }).songs,
      context
    );

    setRecommendationGroups(result.groups);
    setRecommendationMode(result.mode);
    return result.orderedSongs.map((s) => s.id);
  }, [songs, getTopArtists, history, listeningStats, customMode]);

  const recommendation = useMemo(() => {
    const songMap = new Map(songs.map((song) => [song.id, song]));
    return recommendationSongIds
      .map((id) => songMap.get(id))
      .filter((song): song is Song => song !== undefined);
  }, [recommendationSongIds, songs]);

  const loadRecommendation = useCallback(() => {
    setIsLoading(true);

    // Auto-clean stale recommendation cache (not from today)
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(RECOMMENDATION_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        const today = getToday();
        if (parsed.lastUpdated && parsed.lastUpdated !== today) {
          localStorage.removeItem(RECOMMENDATION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(RECOMMENDATION_KEY);
    }

    const cached = loadRecommendationFromStorage();

    if (cached && cached.length > 0) {
      const songIdSet = new Set(songs.map((s) => s.id));
      const validCached = cached.filter((id) => songIdSet.has(id));
      if (validCached.length > 0) {
        setRecommendationSongIds(validCached);
        setIsLoading(false);
        return;
      }
    }

    const newSongIds = generateRecommendationInternal();
    saveRecommendationToStorage(newSongIds);
    setRecommendationSongIds(newSongIds);
    setIsLoading(false);
  }, [
    loadRecommendationFromStorage,
    generateRecommendationInternal,
    saveRecommendationToStorage,
    songs,
    getToday,
  ]);

  const refreshRecommendation = useCallback(() => {
    setIsLoading(true);

    if (typeof window !== "undefined") {
      localStorage.removeItem(RECOMMENDATION_KEY);
    }

    setRecommendationSongIds([]);

    setTimeout(() => {
      const newSongIds = generateRecommendationInternal();
      saveRecommendationToStorage(newSongIds);
      setRecommendationSongIds(newSongIds);
      setIsLoading(false);
    }, 200);
  }, [saveRecommendationToStorage, generateRecommendationInternal]);

  useEffect(() => {
    queueMicrotask(loadRecommendation);
  }, [loadRecommendation]);

  useEffect(() => {
    if (songs.length > 0 && recommendationSongIds.length === 0) {
      loadRecommendation();
    }
  }, [songs.length, recommendationSongIds.length, loadRecommendation]);

  const playAll = useCallback(
    (startIndex: number = 0) => {
      if (!recommendation || recommendation.length === 0) return;

      const audioStore = useAudioStore.getState();
      audioStore.playQueue(recommendation, startIndex);
    },
    [recommendation]
  );

  const switchMode = useCallback(
    (newMode: DailyRecommendationMode) => {
      setCustomMode(newMode);
      if (typeof window !== "undefined") {
        localStorage.removeItem(RECOMMENDATION_KEY);
      }
      setIsLoading(true);
      setTimeout(() => {
        const newSongIds = generateRecommendationInternal();
        saveRecommendationToStorage(newSongIds);
        setRecommendationSongIds(newSongIds);
        setIsLoading(false);
      }, 100);
    },
    [generateRecommendationInternal, saveRecommendationToStorage]
  );

  return {
    recommendation,
    isLoading,
    refreshRecommendation,
    switchMode,
    playAll,
    hasRecommendation: recommendation && recommendation.length > 0,
    recommendationGroups,
    recommendationMode,
    availableModes: AVAILABLE_RECOMMENDATION_MODES,
  };
};
