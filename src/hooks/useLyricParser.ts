import { useState, useEffect, useMemo, useCallback } from "react";

export interface LyricLine {
  time: number;
  text: string;
}

export const useLyricParser = (lrcContent?: string) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);

  const parseLRC = useCallback((lrc: string): LyricLine[] => {
    if (!lrc || typeof lrc !== "string") return [];

    const lines = lrc.split(/\r?\n/);
    const result: LyricLine[] = [];

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

            result.push({ time, text });
          });
        }
      }
    });

    // Remove duplicates and sort by time
    const uniqueLyrics = result.filter(
      (lyric, index, self) =>
        index === self.findIndex((l) => l.time === lyric.time && l.text === lyric.text)
    );

    return uniqueLyrics.sort((a, b) => a.time - b.time);
  }, []);

  useEffect(() => {
    if (lrcContent) {
      const parsed = parseLRC(lrcContent);
      setLyrics(parsed);
    } else {
      setLyrics([]);
    }
  }, [lrcContent, parseLRC]);

  const getCurrentLyricIndex = useCallback(
    (currentTime: number): number => {
      if (lyrics.length === 0) return -1;

      // Binary search for better performance
      let left = 0;
      let right = lyrics.length - 1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (lyrics[mid].time <= currentTime) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      return right;
    },
    [lyrics]
  );

  const getCurrentLyric = useCallback(
    (currentTime: number): { current: LyricLine | null; index: number } => {
      const index = getCurrentLyricIndex(currentTime);
      return {
        current: index >= 0 ? lyrics[index] : null,
        index,
      };
    },
    [getCurrentLyricIndex, lyrics]
  );

  const getLyricsAround = useCallback(
    (currentTime: number, range: number = 2): LyricLine[] => {
      const index = getCurrentLyricIndex(currentTime);
      if (index < 0) return lyrics.slice(0, Math.min(range * 2 + 1, lyrics.length));

      const start = Math.max(0, index - range);
      const end = Math.min(lyrics.length, index + range + 1);
      return lyrics.slice(start, end);
    },
    [getCurrentLyricIndex, lyrics]
  );

  return {
    lyrics,
    getCurrentLyricIndex,
    getCurrentLyric,
    getLyricsAround,
    parseLRC,
    hasLyrics: lyrics.length > 0,
  };
};
