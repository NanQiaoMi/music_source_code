"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Song } from "@/store/audioStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { useAudioStore } from "@/store/audioStore";

export interface DailyRecommendation {
  songIds: string[];
  generatedAt: number;
  lastUpdated: string;
}

const RECOMMENDATION_KEY = "daily_recommendation";

class SeededRandom {
  private seed: number;

  constructor(seed: string | number) {
    if (typeof seed === "string") {
      this.seed = this.hashString(seed);
    } else {
      this.seed = seed;
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

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

  const getPlayCountForSong = useCallback(
    (songId: string): number => {
      const topSong = listeningStats.topSongs?.find((item) => item.song?.id === songId);
      return topSong?.playCount || 0;
    },
    [listeningStats]
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

  const generateRecommendationInternal = useCallback(
    (seed: string | number): string[] => {
      if (songs.length === 0) return [];

      const rng = new SeededRandom(seed);

      const top3Artists = getTopArtists().slice(0, 3);
      const playedSongIds = new Set(history.map((h) => h.id));
      const songPlayCounts = new Map<string, number>();

      songs.forEach((song) => {
        songPlayCounts.set(song.id, getPlayCountForSong(song.id));
      });

      const recommendations: Song[] = [];

      top3Artists.forEach(({ artist }) => {
        const artistSongs = songs.filter((s) => s.artist === artist);

        const underplayedSongs = artistSongs
          .filter((s) => (songPlayCounts.get(s.id) || 0) < 3)
          .sort((a, b) => (songPlayCounts.get(a.id) || 0) - (songPlayCounts.get(b.id) || 0));

        const selected = rng.shuffle(underplayedSongs).slice(0, 4);
        recommendations.push(...selected);
      });

      const otherArtistsSongs = songs.filter(
        (s) => !top3Artists.some((a) => a.artist === s.artist)
      );
      const underplayedOther = otherArtistsSongs.filter((s) => (songPlayCounts.get(s.id) || 0) < 2);

      const randomExploration = rng.shuffle(underplayedOther).slice(0, 5);
      recommendations.push(...randomExploration);

      if (recommendations.length < 15) {
        const remaining = 15 - recommendations.length;
        const remainingSongs = songs.filter((s) => !recommendations.some((r) => r.id === s.id));
        const randomRemaining = rng.shuffle(remainingSongs).slice(0, remaining);
        recommendations.push(...randomRemaining);
      }

      const finalRecommendations = rng.shuffle(recommendations).slice(0, 18);

      return finalRecommendations.map((s) => s.id);
    },
    [songs, getTopArtists, history, getPlayCountForSong]
  );

  const generateRecommendation = useCallback((): string[] => {
    return generateRecommendationInternal(getToday());
  }, [generateRecommendationInternal, getToday]);

  const generateRecommendationWithRandomSeed = useCallback((): string[] => {
    const randomSeed = Date.now().toString();
    return generateRecommendationInternal(randomSeed);
  }, [generateRecommendationInternal]);

  const recommendation = useMemo(() => {
    const songMap = new Map(songs.map((song) => [song.id, song]));
    return recommendationSongIds
      .map((id) => songMap.get(id))
      .filter((song): song is Song => song !== undefined);
  }, [recommendationSongIds, songs]);

  const loadRecommendation = useCallback(() => {
    setIsLoading(true);

    const cached = loadRecommendationFromStorage();

    if (cached && cached.length > 0) {
      setRecommendationSongIds(cached);
      setIsLoading(false);
      return;
    }

    const newSongIds = generateRecommendation();
    saveRecommendationToStorage(newSongIds);
    setRecommendationSongIds(newSongIds);
    setIsLoading(false);
  }, [loadRecommendationFromStorage, generateRecommendation, saveRecommendationToStorage]);

  const refreshRecommendation = useCallback(() => {
    setIsLoading(true);

    // 清除本地缓存
    if (typeof window !== "undefined") {
      localStorage.removeItem(RECOMMENDATION_KEY);
    }

    // 清除当前状态
    setRecommendationSongIds([]);

    // 使用临时随机种子确保不同的结果
    const forceRefresh = true;

    // 稍微延迟让UI更新
    setTimeout(() => {
      const newSongIds = generateRecommendationWithRandomSeed();
      saveRecommendationToStorage(newSongIds);
      setRecommendationSongIds(newSongIds);
      setIsLoading(false);
    }, 200);
  }, [saveRecommendationToStorage]);

  useEffect(() => {
    loadRecommendation();
  }, [loadRecommendation]);

  const playAll = useCallback(
    (startIndex: number = 0) => {
      if (!recommendation || recommendation.length === 0) return;

      const audioStore = useAudioStore.getState();
      audioStore.playQueue(recommendation, startIndex);
    },
    [recommendation]
  );

  return {
    recommendation,
    isLoading,
    refreshRecommendation,
    playAll,
    hasRecommendation: recommendation && recommendation.length > 0,
  };
};
