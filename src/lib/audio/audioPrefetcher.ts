/**
 * MimiMusic Audio Stream Prefetcher
 *
 * Pre-resolves and preheats next-track audio streams in the background
 * to eliminate track switching latency and enable zero-delay (< 10ms) playback.
 */

import { MultiSourceResolver } from "@/services/MultiSourceResolver";
import { Song } from "@/types/song";
import { patchQueueSongAudio } from "@/store/actions/queueActions";
import { TtlLruCache, type TtlLruCacheStats } from "@/lib/cache/TtlLruCache";
import { throwIfAborted, isAbortError } from "@/lib/playback/requestCoordinator";

export interface PrefetchOptions {
  signal?: AbortSignal;
}

interface CachedAudioSource {
  url: string;
  source: string;
  quality: string;
}

class AudioPrefetcher {
  private static instance: AudioPrefetcher;
  private prefetchCache = new TtlLruCache<string, CachedAudioSource>({
    maxEntries: 20,
    maxAgeMs: 25 * 60_000, // temporary stream URLs stay valid for 25 minutes
  });
  private preheatedAudioElements = new Map<string, HTMLAudioElement>();
  private activePrefetchId: string | null = null;

  public static getInstance(): AudioPrefetcher {
    if (!AudioPrefetcher.instance) {
      AudioPrefetcher.instance = new AudioPrefetcher();
    }
    return AudioPrefetcher.instance;
  }

  /**
   * Pre-fetches the given song's audio URL and preheats the initial buffer.
   */
  public async prefetchSong(song: Song, options: PrefetchOptions = {}): Promise<string | null> {
    if (!song || !song.id) return null;

    // 1. If song already has a valid non-blob URL, preheat directly
    if (
      song.audioUrl &&
      !song.audioUrl.startsWith("blob:") &&
      !song.audioUrl.startsWith("stored://")
    ) {
      this.preheatAudio(song.id, song.audioUrl);
      return song.audioUrl;
    }

    // 2. Check if recently cached in memory
    const cached = this.prefetchCache.get(song.id);
    if (cached) {
      this.preheatAudio(song.id, cached.url);
      return cached.url;
    }

    // Avoid duplicated concurrent prefetches for the same song
    if (this.activePrefetchId === song.id) {
      return null;
    }

    this.activePrefetchId = song.id;

    try {
      throwIfAborted(options.signal);
      const resolver = MultiSourceResolver.getInstance();
      const resolved = await resolver.resolvePlayableAudio(
        {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          source: song.source,
        },
        { signal: options.signal }
      );

      throwIfAborted(options.signal);
      if (resolved && resolved.url) {
        this.prefetchCache.set(song.id, {
          url: resolved.url,
          source: resolved.source,
          quality: resolved.quality,
        });

        // Update queueStore with resolved audioUrl for instant switch
        patchQueueSongAudio(song.id, { audioUrl: resolved.url, source: resolved.source });

        // Preheat HTML5 audio element
        this.preheatAudio(song.id, resolved.url);
        return resolved.url;
      }
    } catch (error) {
      // abort 是预期路径（换歌/新请求取代），静默退出且不打 warn
      if (isAbortError(error)) return null;
      // Background prefetch failed silently without disturbing foreground playback
      console.warn(`[AudioPrefetcher] Silent prefetch failed for "${song.title}":`, error);
    } finally {
      if (this.activePrefetchId === song.id) {
        this.activePrefetchId = null;
      }
    }

    return null;
  }

  /**
   * Preheats initial audio buffer using a detached Audio element
   */
  private preheatAudio(songId: string, url: string): void {
    if (
      typeof window === "undefined" ||
      !url ||
      url.startsWith("blob:") ||
      url.startsWith("stored://")
    ) {
      return;
    }

    try {
      // Clean up previous preheated element for this song
      if (this.preheatedAudioElements.has(songId)) {
        const oldAudio = this.preheatedAudioElements.get(songId);
        oldAudio?.removeAttribute("src");
        oldAudio?.load();
        this.preheatedAudioElements.delete(songId);
      }

      // Keep only up to 2 preheated elements to conserve memory
      if (this.preheatedAudioElements.size >= 2) {
        const firstKey = this.preheatedAudioElements.keys().next().value;
        if (firstKey) {
          const oldAudio = this.preheatedAudioElements.get(firstKey);
          oldAudio?.removeAttribute("src");
          oldAudio?.load();
          this.preheatedAudioElements.delete(firstKey);
        }
      }

      const preheatAudio = new Audio();
      preheatAudio.preload = "auto";
      preheatAudio.volume = 0;
      preheatAudio.muted = true;
      preheatAudio.src = url;
      // Pre-connect and pre-buffer initial segment
      preheatAudio.load();

      this.preheatedAudioElements.set(songId, preheatAudio);
    } catch {
      // Ignore preheat errors on restrictive environments
    }
  }

  /** 只读预取缓存指标（容量 + 命中率），供调试与 dev 探针聚合。 */
  public getPrefetchCacheStats(): TtlLruCacheStats & { size: number } {
    return { ...this.prefetchCache.stats(), size: this.prefetchCache.size() };
  }

  /**
   * Cleans up expired caches and memory
   */
  public pruneCache(): void {
    this.prefetchCache.prune();
  }
}

export const audioPrefetcher = AudioPrefetcher.getInstance();
