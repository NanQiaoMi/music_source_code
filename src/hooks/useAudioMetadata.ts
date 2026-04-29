// Hook for audio metadata extraction with caching
// Provides easy access to metadata extraction and caching functionality

import { useCallback, useState } from "react";
import {
  extractAudioMetadata,
  batchExtractMetadata,
  AudioMetadata,
  MetadataExtractionResult,
  isSupportedAudioFile,
  metadataToSong,
} from "@/services/audioMetadata";
import {
  saveMetadataToCache,
  getMetadataFromCache,
  hasMetadataInCache,
  deleteMetadataFromCache,
  getCacheStats,
  clearAllMetadataCache,
} from "@/services/metadataStorage";

export interface UseAudioMetadataOptions {
  enableCache?: boolean;
  onProgress?: (current: number, total: number) => void;
  onError?: (error: string) => void;
}

export interface UseAudioMetadataReturn {
  // State
  isExtracting: boolean;
  progress: { current: number; total: number };
  lastResult?: MetadataExtractionResult;

  // Single file operations
  extractMetadata: (file: File, useCache?: boolean) => Promise<MetadataExtractionResult>;
  extractAndCache: (file: File) => Promise<MetadataExtractionResult>;

  // Batch operations
  extractBatch: (files: File[], useCache?: boolean) => Promise<MetadataExtractionResult[]>;

  // Cache operations
  isCached: (file: File) => Promise<boolean>;
  deleteFromCache: (id: string) => Promise<void>;
  getCacheInfo: () => Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry: number;
    newestEntry: number;
  }>;
  clearCache: () => Promise<void>;

  // Utilities
  checkSupported: (file: File) => boolean;
  convertToSong: (
    metadata: AudioMetadata,
    audioUrl: string,
    coverUrl?: string
  ) => {
    id: string;
    title: string;
    artist: string;
    album: string;
    cover: string;
    audioUrl: string;
    lyrics?: string;
    duration: number;
    source: "local";
  };
}

export function useAudioMetadata(options: UseAudioMetadataOptions = {}): UseAudioMetadataReturn {
  const { enableCache = true, onProgress, onError } = options;

  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lastResult, setLastResult] = useState<MetadataExtractionResult | undefined>();

  /**
   * Extract metadata from a single file
   */
  const extractMetadata = useCallback(
    async (file: File, useCache: boolean = enableCache): Promise<MetadataExtractionResult> => {
      setIsExtracting(true);

      try {
        // Check cache first if enabled
        if (useCache) {
          const cached = await getMetadataFromCache(file);
          if (cached) {
            const result: MetadataExtractionResult = {
              success: true,
              metadata: cached,
            };
            setLastResult(result);
            setIsExtracting(false);
            return result;
          }
        }

        // Extract metadata from file
        const result = await extractAudioMetadata(file);
        setLastResult(result);

        if (!result.success && onError) {
          onError(result.error || "未知错误");
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        if (onError) onError(errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsExtracting(false);
      }
    },
    [enableCache, onError]
  );

  /**
   * Extract metadata and save to cache
   */
  const extractAndCache = useCallback(
    async (file: File): Promise<MetadataExtractionResult> => {
      const result = await extractMetadata(file, false);

      if (result.success && result.metadata) {
        try {
          await saveMetadataToCache(result.metadata, file);
        } catch (error) {
          console.error("Error saving to cache:", error);
        }
      }

      return result;
    },
    [extractMetadata]
  );

  /**
   * Extract metadata from multiple files
   */
  const extractBatch = useCallback(
    async (files: File[], useCache: boolean = enableCache): Promise<MetadataExtractionResult[]> => {
      setIsExtracting(true);
      setProgress({ current: 0, total: files.length });

      const results: MetadataExtractionResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length });

        let result: MetadataExtractionResult;

        // Check cache first if enabled
        if (useCache) {
          const cached = await getMetadataFromCache(file);
          if (cached) {
            result = { success: true, metadata: cached };
          } else {
            result = await extractAudioMetadata(file);
            // Save to cache if successful
            if (result.success && result.metadata) {
              await saveMetadataToCache(result.metadata, file).catch(console.error);
            }
          }
        } else {
          result = await extractAudioMetadata(file);
        }

        results.push(result);

        if (!result.success && onError) {
          onError(result.error || `处理文件失败: ${file.name}`);
        }

        if (onProgress) {
          onProgress(i + 1, files.length);
        }
      }

      setIsExtracting(false);
      return results;
    },
    [enableCache, onProgress, onError]
  );

  /**
   * Check if file metadata is cached
   */
  const isCached = useCallback(async (file: File): Promise<boolean> => {
    return hasMetadataInCache(file);
  }, []);

  /**
   * Delete metadata from cache
   */
  const deleteFromCache = useCallback(async (id: string): Promise<void> => {
    await deleteMetadataFromCache(id);
  }, []);

  /**
   * Get cache statistics
   */
  const getCacheInfo = useCallback(async () => {
    return getCacheStats();
  }, []);

  /**
   * Clear all cached metadata
   */
  const clearCache = useCallback(async (): Promise<void> => {
    await clearAllMetadataCache();
  }, []);

  /**
   * Check if file is supported
   */
  const checkSupported = useCallback((file: File): boolean => {
    return isSupportedAudioFile(file);
  }, []);

  /**
   * Convert metadata to Song format
   */
  const convertToSong = useCallback(
    (
      metadata: AudioMetadata,
      audioUrl: string,
      coverUrl?: string
    ): {
      id: string;
      title: string;
      artist: string;
      album: string;
      cover: string;
      audioUrl: string;
      lyrics?: string;
      duration: number;
      source: "local";
    } => {
      return metadataToSong(metadata, audioUrl, coverUrl);
    },
    []
  );

  return {
    // State
    isExtracting,
    progress,
    lastResult,

    // Operations
    extractMetadata,
    extractAndCache,
    extractBatch,

    // Cache operations
    isCached,
    deleteFromCache,
    getCacheInfo,
    clearCache,

    // Utilities
    checkSupported,
    convertToSong,
  };
}

export default useAudioMetadata;
