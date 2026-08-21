"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCachedAudio,
  getCacheStats,
  saveCachedAudio,
  deleteCachedAudio,
  clearAllNetworkCache,
  updateLastPlayed,
  createBlobUrlFromCache,
  makeCacheKey,
  CachedNetworkAudio,
} from "@/services/networkAudioCache";
import { Song } from "@/types/song";

export type CacheStatus = "idle" | "caching" | "cached" | "error";

export interface NetworkCacheStats {
  count: number;
  totalSizeMB: number;
}

// ---------- Module-level singletons (survive hook remounts) ----------

/** Currently in-progress download tasks keyed by cacheKey */
const cachingTasks = new Map<string, boolean>();

/** In-memory fast-lookup for already-cached songs (avoids repeated IDB reads) */
const cachedStatusMap = new Map<string, boolean>();

// ---------- Standalone functions (usable outside the hook) ----------

/**
 * Fast synchronous check against in-memory cache map.
 * Returns true if we already know the song is cached.
 */
export function isCachedSync(songId: string, source: string): boolean {
  return cachedStatusMap.get(makeCacheKey(songId, source)) === true;
}

/**
 * Async check — queries IndexedDB metadata only (no fileData load).
 * Updates in-memory map as a side effect.
 */
export async function checkIsCached(songId: string, source: string): Promise<boolean> {
  const key = makeCacheKey(songId, source);
  if (cachedStatusMap.has(key)) return cachedStatusMap.get(key)!;
  try {
    const cached = await getCachedAudio(songId, source);
    const result = cached !== null;
    cachedStatusMap.set(key, result);
    return result;
  } catch {
    return false;
  }
}

/**
 * Retrieves cached audio and returns a Blob URL for direct playback.
 * Also updates LRU timestamp.
 * Returns null if not cached.
 */
export async function getOrCreateBlobUrl(
  songId: string,
  source: string
): Promise<string | null> {
  try {
    const cached = await getCachedAudio(songId, source);
    if (!cached) return null;
    const url = createBlobUrlFromCache(cached);
    if (!url) return null;
    // Update LRU (fire-and-forget)
    updateLastPlayed(makeCacheKey(songId, source)).catch(() => {});
    return url;
  } catch {
    return null;
  }
}

/**
 * Triggers a background download-and-cache task for a network song.
 * - Deduplication: will not start if a task for this cacheKey is already running.
 * - Non-blocking: always returns immediately; errors are swallowed.
 * - audioUrl must be the full URL (including the proxy prefix if needed).
 */
export async function triggerBackgroundCache(song: Song, audioUrl: string): Promise<void> {
  if (!song?.id || !audioUrl) return;

  const key = makeCacheKey(song.id, song.source);

  // Skip if already cached or currently downloading
  if (cachedStatusMap.get(key) === true) return;
  if (cachingTasks.get(key) === true) return;

  // Double-check IDB before downloading
  const alreadyCached = await checkIsCached(song.id, song.source);
  if (alreadyCached) return;

  cachingTasks.set(key, true);

  try {
    const response = await fetch(audioUrl, {
      headers: {
        // Fetch the full file, not a range
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      console.warn(`[NetworkAudioCache] Background cache fetch failed (${response.status}) for:`, song.title);
      cachingTasks.delete(key);
      return;
    }

    const contentType =
      response.headers.get("content-type") || "audio/mpeg";
    const fileData = await response.arrayBuffer();

    if (!fileData || fileData.byteLength === 0) {
      console.warn("[NetworkAudioCache] Empty audio data, skipping cache for:", song.title);
      cachingTasks.delete(key);
      return;
    }

    const currentLiveSong = typeof window !== "undefined" ? (window as any).__VIBE_CURRENT_SONG__ || song : song;
    const lyricsToSave = song.lyrics || currentLiveSong?.lyrics || "";
    const translationLyricsToSave = song.translationLyrics || currentLiveSong?.translationLyrics || "";
    const coverToSave = (song.cover && song.cover !== "/default-cover.svg") ? song.cover : currentLiveSong?.cover;

    const cached: CachedNetworkAudio = {
      cacheKey: key,
      songId: song.id,
      source: song.source,
      title: song.title,
      artist: song.artist,
      album: song.album,
      cover: coverToSave || song.cover,
      lyrics: lyricsToSave,
      translationLyrics: translationLyricsToSave,
      duration: song.duration ?? 0,
      fileData,
      fileType: contentType.split(";")[0].trim(),
      originalUrl: audioUrl,
      cachedAt: Date.now(),
      lastPlayedAt: Date.now(),
      fileSize: fileData.byteLength,
    };

    await saveCachedAudio(cached);
    cachedStatusMap.set(key, true);

    const sizeMB = (fileData.byteLength / 1024 / 1024).toFixed(1);
    console.info(`[NetworkAudioCache] ✅ Cached "${song.title}" (${sizeMB} MB)`);
  } catch (e) {
    console.warn("[NetworkAudioCache] Background cache error for:", song.title, e);
  } finally {
    cachingTasks.delete(key);
  }
}

// ---------- React Hook ----------

export function useNetworkAudioCache() {
  const [stats, setStats] = useState<NetworkCacheStats>({ count: 0, totalSizeMB: 0 });

  const refreshStats = useCallback(async () => {
    try {
      const raw = await getCacheStats();
      setStats({
        count: raw.count,
        totalSizeMB: Math.round((raw.totalSizeBytes / 1024 / 1024) * 10) / 10,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const isCached = useCallback((songId: string, source: string): boolean => {
    return isCachedSync(songId, source);
  }, []);

  const getCacheStatus = useCallback(
    (songId: string, source: string): CacheStatus => {
      const key = makeCacheKey(songId, source);
      if (cachingTasks.get(key) === true) return "caching";
      if (cachedStatusMap.get(key) === true) return "cached";
      return "idle";
    },
    []
  );

  const deleteSongCache = useCallback(
    async (songId: string, source: string) => {
      const key = makeCacheKey(songId, source);
      await deleteCachedAudio(key);
      cachedStatusMap.delete(key);
      await refreshStats();
    },
    [refreshStats]
  );

  const clearAllCache = useCallback(async () => {
    await clearAllNetworkCache();
    cachedStatusMap.clear();
    cachingTasks.clear();
    await refreshStats();
  }, [refreshStats]);

  return {
    stats,
    isCached,
    getCacheStatus,
    deleteSongCache,
    clearAllCache,
    refreshStats,
    /** Expose for components that need to check async */
    checkIsCached,
    /** Expose for components that want to manually trigger caching */
    triggerBackgroundCache,
  };
}
