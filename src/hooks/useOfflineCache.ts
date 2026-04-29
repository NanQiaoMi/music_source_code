"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaylistStore } from "@/store/playlistStore";
import { Song } from "@/store/audioStore";
import {
  getStoredMusic,
  saveMusicFile,
  deleteStoredMusic,
  getAllStoredMusic,
  StoredMusic,
} from "@/services/localMusicStorage";

const CACHE_STATUS_KEY = "offline_cache_status";

export interface CacheStatus {
  songId: string;
  cached: boolean;
  cachedAt?: number;
  size?: number;
}

export interface OfflineCacheStats {
  totalCached: number;
  totalSize: number;
  cachedSongs: string[];
}

export const useOfflineCache = () => {
  const { songs, updateSong } = usePlaylistStore();
  const [cacheStatus, setCacheStatus] = useState<Record<string, CacheStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCaching, setIsCaching] = useState<string | null>(null);

  useEffect(() => {
    loadCacheStatus();
  }, []);

  const loadCacheStatus = useCallback(async () => {
    try {
      const stored = localStorage.getItem(CACHE_STATUS_KEY);
      if (stored) {
        setCacheStatus(JSON.parse(stored));
      }

      const storedMusic = await getAllStoredMusic();
      const newStatus: Record<string, CacheStatus> = { ...cacheStatus };

      storedMusic.forEach((music) => {
        newStatus[music.id] = {
          songId: music.id,
          cached: true,
          cachedAt: music.addedAt,
          size: music.fileData.byteLength,
        };
      });

      setCacheStatus(newStatus);
    } catch (error) {
      console.error("Error loading cache status:", error);
    }
  }, [cacheStatus]);

  const saveCacheStatus = useCallback((status: Record<string, CacheStatus>) => {
    try {
      localStorage.setItem(CACHE_STATUS_KEY, JSON.stringify(status));
    } catch (error) {
      console.error("Error saving cache status:", error);
    }
  }, []);

  const cacheSong = useCallback(
    async (song: Song): Promise<boolean> => {
      if (!song.audioUrl || song.audioUrl.startsWith("stored://")) {
        return false;
      }

      setIsCaching(song.id);

      try {
        const response = await fetch(song.audioUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch audio");
        }

        const arrayBuffer = await response.arrayBuffer();

        const storedMusic: StoredMusic = {
          id: song.id,
          fileData: arrayBuffer,
          fileType: response.headers.get("Content-Type") || "audio/mpeg",
          fileName: `${song.title} - ${song.artist}.mp3`,
          title: song.title,
          artist: song.artist,
          album: song.album || "",
          duration: song.duration,
          coverData: song.cover,
          lyrics: song.lyrics,
          addedAt: Date.now(),
        };

        await saveMusicFile(storedMusic);

        const newStatus: Record<string, CacheStatus> = {
          ...cacheStatus,
          [song.id]: {
            songId: song.id,
            cached: true,
            cachedAt: Date.now(),
            size: arrayBuffer.byteLength,
          },
        };

        setCacheStatus(newStatus);
        saveCacheStatus(newStatus);

        return true;
      } catch (error) {
        console.error("Error caching song:", error);
        return false;
      } finally {
        setIsCaching(null);
      }
    },
    [cacheStatus, saveCacheStatus]
  );

  const removeCachedSong = useCallback(
    async (songId: string): Promise<boolean> => {
      try {
        await deleteStoredMusic(songId);

        const newStatus = { ...cacheStatus };
        delete newStatus[songId];

        setCacheStatus(newStatus);
        saveCacheStatus(newStatus);

        return true;
      } catch (error) {
        console.error("Error removing cached song:", error);
        return false;
      }
    },
    [cacheStatus, saveCacheStatus]
  );

  const isSongCached = useCallback(
    (songId: string): boolean => {
      return cacheStatus[songId]?.cached || false;
    },
    [cacheStatus]
  );

  const getCacheStats = useCallback((): OfflineCacheStats => {
    const cachedSongs: string[] = [];
    let totalSize = 0;

    Object.values(cacheStatus).forEach((status) => {
      if (status.cached) {
        cachedSongs.push(status.songId);
        totalSize += status.size || 0;
      }
    });

    return {
      totalCached: cachedSongs.length,
      totalSize,
      cachedSongs,
    };
  }, [cacheStatus]);

  const formatSize = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }, []);

  const clearAllCache = useCallback(async (): Promise<boolean> => {
    try {
      const storedMusic = await getAllStoredMusic();
      for (const music of storedMusic) {
        await deleteStoredMusic(music.id);
      }

      setCacheStatus({});
      saveCacheStatus({});

      return true;
    } catch (error) {
      console.error("Error clearing cache:", error);
      return false;
    }
  }, [saveCacheStatus]);

  const cacheAllSongs = useCallback(async (): Promise<{ success: number; failed: number }> => {
    setIsLoading(true);
    let success = 0;
    let failed = 0;

    const songsToCache = songs.filter(
      (song) => song.audioUrl && !song.audioUrl.startsWith("stored://") && !isSongCached(song.id)
    );

    for (const song of songsToCache) {
      const result = await cacheSong(song);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    setIsLoading(false);

    return { success, failed };
  }, [songs, cacheSong, isSongCached]);

  return {
    cacheStatus,
    isLoading,
    isCaching,
    cacheSong,
    removeCachedSong,
    isSongCached,
    getCacheStats,
    formatSize,
    clearAllCache,
    cacheAllSongs,
    loadCacheStatus,
  };
};
