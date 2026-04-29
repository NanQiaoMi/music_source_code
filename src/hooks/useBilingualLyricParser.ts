import { useState, useEffect, useMemo, useCallback } from "react";

export interface BilingualLyricLine {
  time: number;
  original: string;
  translation?: string;
  transliteration?: string;
}

export interface BilingualLyrics {
  original: BilingualLyricLine[];
  translation: BilingualLyricLine[];
  transliteration: BilingualLyricLine[];
  merged: BilingualLyricLine[];
}

export const useBilingualLyricParser = (
  originalLrc?: string,
  translationLrc?: string,
  transliterationLrc?: string
) => {
  const [lyrics, setLyrics] = useState<BilingualLyrics>({
    original: [],
    translation: [],
    transliteration: [],
    merged: [],
  });

  const parseLRC = useCallback((lrc: string): BilingualLyricLine[] => {
    if (!lrc || typeof lrc !== "string") return [];

    const lines = lrc.split(/\r?\n/);
    const result: BilingualLyricLine[] = [];

    // Support multiple LRC time formats:
    // [mm:ss.xx] - standard format
    // [mm:ss.xxx] - millisecond format
    // [mm:ss] - no milliseconds
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Find all time tags in the line
      const matches = Array.from(trimmedLine.matchAll(timeRegex));

      if (matches.length > 0) {
        // Get the lyrics text (everything after the last time tag)
        const lastMatch = matches[matches.length - 1];
        const textStartIndex = lastMatch.index! + lastMatch[0].length;
        const text = trimmedLine.substring(textStartIndex).trim();

        if (text) {
          // Create a lyric entry for each time tag
          matches.forEach((match) => {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const msStr = match[3] || "0";
            // Pad milliseconds to 3 digits
            const milliseconds = parseInt(msStr.padEnd(3, "0").substring(0, 3), 10);

            const time = minutes * 60 + seconds + milliseconds / 1000;

            result.push({ time, original: text });
          });
        }
      }
    });

    // Remove duplicates and sort by time
    const uniqueLyrics = result.filter(
      (lyric, index, self) =>
        index === self.findIndex((l) => l.time === lyric.time && l.original === lyric.original)
    );

    return uniqueLyrics.sort((a, b) => a.time - b.time);
  }, []);

  // Merge lyrics from different sources by time
  const mergeLyrics = useCallback(
    (
      original: BilingualLyricLine[],
      translation: BilingualLyricLine[],
      transliteration: BilingualLyricLine[]
    ): BilingualLyricLine[] => {
      const merged = new Map<number, BilingualLyricLine>();

      // Add original lyrics
      original.forEach((line) => {
        merged.set(line.time, {
          time: line.time,
          original: line.original,
        });
      });

      // Merge translation
      translation.forEach((line) => {
        const existing = merged.get(line.time);
        if (existing) {
          existing.translation = line.original;
        } else {
          merged.set(line.time, {
            time: line.time,
            original: "",
            translation: line.original,
          });
        }
      });

      // Merge transliteration
      transliteration.forEach((line) => {
        const existing = merged.get(line.time);
        if (existing) {
          existing.transliteration = line.original;
        } else {
          merged.set(line.time, {
            time: line.time,
            original: "",
            transliteration: line.original,
          });
        }
      });

      // Convert to array and sort by time
      return Array.from(merged.values()).sort((a, b) => a.time - b.time);
    },
    []
  );

  useEffect(() => {
    const parsedOriginal = originalLrc ? parseLRC(originalLrc) : [];
    const parsedTranslation = translationLrc ? parseLRC(translationLrc) : [];
    const parsedTransliteration = transliterationLrc ? parseLRC(transliterationLrc) : [];

    const merged = mergeLyrics(parsedOriginal, parsedTranslation, parsedTransliteration);

    setLyrics({
      original: parsedOriginal,
      translation: parsedTranslation,
      transliteration: parsedTransliteration,
      merged,
    });
  }, [originalLrc, translationLrc, transliterationLrc, parseLRC, mergeLyrics]);

  const getCurrentLyricIndex = useCallback(
    (currentTime: number): number => {
      if (lyrics.merged.length === 0) return -1;

      // Binary search for better performance
      let left = 0;
      let right = lyrics.merged.length - 1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (lyrics.merged[mid].time <= currentTime) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      return right;
    },
    [lyrics.merged]
  );

  const getCurrentLyric = useCallback(
    (currentTime: number): { current: BilingualLyricLine | null; index: number } => {
      const index = getCurrentLyricIndex(currentTime);
      return {
        current: index >= 0 ? lyrics.merged[index] : null,
        index,
      };
    },
    [getCurrentLyricIndex, lyrics.merged]
  );

  const getLyricsAround = useCallback(
    (currentTime: number, range: number = 2): BilingualLyricLine[] => {
      const index = getCurrentLyricIndex(currentTime);
      if (index < 0) return lyrics.merged.slice(0, Math.min(range * 2 + 1, lyrics.merged.length));

      const start = Math.max(0, index - range);
      const end = Math.min(lyrics.merged.length, index + range + 1);
      return lyrics.merged.slice(start, end);
    },
    [getCurrentLyricIndex, lyrics.merged]
  );

  const hasTranslation = lyrics.translation.length > 0;
  const hasTransliteration = lyrics.transliteration.length > 0;
  const hasLyrics = lyrics.original.length > 0;

  return {
    lyrics,
    getCurrentLyricIndex,
    getCurrentLyric,
    getLyricsAround,
    hasTranslation,
    hasTransliteration,
    hasLyrics,
  };
};
