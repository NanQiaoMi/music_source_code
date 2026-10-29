// S6-12d: non-store lyrics/cover types and the pure LRC codec live here so
// lyricsCoverStore.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The store re-exports every type below, so its public surface is unchanged.

export interface LyricLine {
  id: string;
  time: number;
  text: string;
  translation?: string;
}

export interface LyricData {
  id: string;
  songId: string;
  title: string;
  artist: string;
  lines: LyricLine[];
  isLRC: boolean;
  source: "embedded" | "file" | "manual" | string;
  lastModified: number;
}

export interface CoverData {
  id: string;
  songId: string;
  imageData: string;
  source: "embedded" | "file" | "manual" | string;
  lastModified: number;
  format: "jpg" | "png" | "webp" | string;
}

export function parseLRC(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  const lrcLines = lrcText.split("\n");

  for (const line of lrcLines) {
    let match;

    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const milliseconds = parseInt(match[3].padEnd(3, "0"));
      const time = minutes * 60 + seconds + milliseconds / 1000;

      const textStart = match.index + match[0].length;
      const text = line.slice(textStart).trim();

      if (text) {
        lines.push({
          id: `${Date.now()}-${Math.random()}`,
          time,
          text,
        });
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

export function generateLRC(lyric: LyricData): string {
  let lrc = "";

  if (lyric.title) {
    lrc += `[ti:${lyric.title}]\n`;
  }
  if (lyric.artist) {
    lrc += `[ar:${lyric.artist}]\n`;
  }

  for (const line of lyric.lines) {
    const minutes = Math.floor(line.time / 60);
    const seconds = Math.floor(line.time % 60);
    const milliseconds = Math.floor((line.time % 1) * 100);
    const timeTag = `[${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}]`;
    lrc += `${timeTag}${line.text}\n`;
  }

  return lrc;
}
