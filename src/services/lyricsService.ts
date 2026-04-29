// Lyrics File Service
// Handles automatic detection and association of .lrc lyrics files with music files

export interface LyricsFileInfo {
  fileName: string;
  file: File;
  content: string;
}

export interface LyricsAssociation {
  audioFileName: string;
  lyricsFileName: string;
  lyricsContent: string;
}

/**
 * Check if file is a lyrics file (.lrc format)
 */
export function isLyricsFile(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "lrc";
}

/**
 * Get file name without extension
 */
function getFileNameWithoutExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

/**
 * Find matching lyrics file for an audio file
 * Looks for .lrc file with the same name (excluding extension)
 */
export function findMatchingLyricsFile(audioFile: File, lyricsFiles: File[]): File | undefined {
  const audioName = getFileNameWithoutExtension(audioFile.name).toLowerCase();

  // Look for exact match (case-insensitive)
  const exactMatch = lyricsFiles.find((lyricsFile) => {
    const lyricsName = getFileNameWithoutExtension(lyricsFile.name).toLowerCase();
    return lyricsName === audioName;
  });

  return exactMatch;
}

/**
 * Read lyrics file content
 */
export async function readLyricsFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content !== undefined) {
        resolve(content);
      } else {
        reject(new Error("Failed to read lyrics file"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Error reading lyrics file"));
    };

    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Parse LRC format lyrics
 * Returns array of { time: number (seconds), text: string }
 */
export function parseLRCLyrics(lrcContent: string): Array<{ time: number; text: string }> {
  if (!lrcContent || typeof lrcContent !== "string") return [];

  const lines = lrcContent.split(/\r?\n/);
  const lyrics: Array<{ time: number; text: string }> = [];

  // Support multiple LRC time formats:
  // [mm:ss.xx] - standard format
  // [mm:ss.xxx] - millisecond format
  // [mm:ss] - no milliseconds
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Find all time tags in the line
    const timeMatches = Array.from(trimmedLine.matchAll(timeRegex));

    if (timeMatches.length > 0) {
      // Get the lyrics text (everything after the last time tag)
      const lastMatch = timeMatches[timeMatches.length - 1];
      const textStartIndex = lastMatch.index! + lastMatch[0].length;
      const text = trimmedLine.substring(textStartIndex).trim();

      if (text) {
        // Create a lyric entry for each time tag
        for (const match of timeMatches) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const msStr = match[3] || "0";
          // Pad milliseconds to 3 digits
          const milliseconds = parseInt(msStr.padEnd(3, "0").substring(0, 3), 10);
          const time = minutes * 60 + seconds + milliseconds / 1000;

          lyrics.push({ time, text });
        }
      }
    }
  }

  // Remove duplicates and sort by time
  const uniqueLyrics = lyrics.filter(
    (lyric, index, self) =>
      index === self.findIndex((l) => l.time === lyric.time && l.text === lyric.text)
  );

  return uniqueLyrics.sort((a, b) => a.time - b.time);
}

/**
 * Batch process lyrics files and associate with audio files
 */
export async function associateLyricsWithAudioFiles(
  audioFiles: File[],
  allFiles: File[]
): Promise<Map<string, string>> {
  // Find all lyrics files
  const lyricsFiles = allFiles.filter(isLyricsFile);

  // Map to store associations: audio file name -> lyrics content
  const associations = new Map<string, string>();

  // If no lyrics files found, return empty map
  if (lyricsFiles.length === 0) {
    return associations;
  }

  // Try to find matching lyrics for each audio file
  for (const audioFile of audioFiles) {
    const matchingLyricsFile = findMatchingLyricsFile(audioFile, lyricsFiles);

    if (matchingLyricsFile) {
      try {
        const lyricsContent = await readLyricsFile(matchingLyricsFile);
        associations.set(audioFile.name, lyricsContent);
      } catch (error) {
        console.warn(`Failed to read lyrics file for ${audioFile.name}:`, error);
      }
    }
  }

  return associations;
}

/**
 * Get current lyric line based on playback time
 */
export function getCurrentLyric(
  lyrics: Array<{ time: number; text: string }>,
  currentTime: number
): { text: string; index: number; nextTime?: number } {
  if (lyrics.length === 0) {
    return { text: "", index: -1 };
  }

  // Find the current lyric line
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      return {
        text: lyrics[i].text,
        index: i,
        nextTime: i < lyrics.length - 1 ? lyrics[i + 1].time : undefined,
      };
    }
  }

  // Before first lyric
  return { text: "", index: -1, nextTime: lyrics[0]?.time };
}

/**
 * Format lyrics for display
 * Removes LRC tags and returns clean text
 */
export function formatLyricsForDisplay(lrcContent: string): string {
  const lines = lrcContent.split("\n");
  const formattedLines: string[] = [];

  const timeRegex = /\[\d{2}:\d{2}\.\d{2,3}\]/g;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Remove all time tags
    const text = trimmedLine.replace(timeRegex, "").trim();

    if (text) {
      formattedLines.push(text);
    }
  }

  return formattedLines.join("\n");
}

/**
 * Check if lyrics content is valid LRC format
 */
export function isValidLRCFormat(content: string): boolean {
  const timeRegex = /\[\d{2}:\d{2}\.\d{2,3}\]/;
  return timeRegex.test(content);
}

/**
 * Get lyrics statistics
 */
export function getLyricsStats(lyrics: Array<{ time: number; text: string }>): {
  totalLines: number;
  totalDuration: number;
  averageLineLength: number;
} {
  if (lyrics.length === 0) {
    return { totalLines: 0, totalDuration: 0, averageLineLength: 0 };
  }

  const totalLines = lyrics.length;
  const totalDuration = lyrics[lyrics.length - 1].time;
  const totalTextLength = lyrics.reduce((sum, line) => sum + line.text.length, 0);
  const averageLineLength = totalTextLength / totalLines;

  return {
    totalLines,
    totalDuration,
    averageLineLength: Math.round(averageLineLength),
  };
}
