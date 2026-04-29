import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export interface LyricEditorState {
  lyrics: LyricData[];
  covers: CoverData[];
  currentLyric: LyricData | null;
  isEditing: boolean;
  editMode: "text" | "timeline";

  currentTime: number;
  playbackState: "playing" | "paused" | "stopped";

  loadLyric: (songId: string) => LyricData | null;
  saveLyric: (lyric: LyricData) => void;
  deleteLyric: (songId: string) => void;
  importLRC: (songId: string, lrcText: string) => LyricData;
  exportLRC: (songId: string) => string;
  setCurrentLyric: (lyric: LyricData | null) => void;
  setIsEditing: (editing: boolean) => void;
  setEditMode: (mode: "text" | "timeline") => void;

  addLyricLine: (line: LyricLine) => void;
  updateLyricLine: (lineId: string, updates: Partial<LyricLine>) => void;
  deleteLyricLine: (lineId: string) => void;
  setLyricLines: (lines: LyricLine[]) => void;

  loadCover: (songId: string) => CoverData | null;
  saveCover: (cover: CoverData) => void;
  deleteCover: (songId: string) => void;
  importCoverImage: (songId: string, imageData: string, format: string) => CoverData;
  cropCover: (
    songId: string,
    cropData: { x: number; y: number; width: number; height: number }
  ) => CoverData | null;
  resizeCover: (songId: string, targetSize: number) => CoverData | null;

  setCurrentTime: (time: number) => void;
  setPlaybackState: (state: "playing" | "paused" | "stopped") => void;
  getCurrentLyricLine: () => LyricLine | null;

  batchImportLyrics: (lyrics: LyricData[]) => void;
  batchImportCovers: (covers: CoverData[]) => void;
  exportAllLyrics: () => LyricData[];
  exportAllCovers: () => CoverData[];

  clearAll: () => void;
}

function parseLRC(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  const lrcLines = lrcText.split("\n");

  for (const line of lrcLines) {
    let match;
    let lastIndex = 0;

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

      lastIndex = match.index + match[0].length;
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

function generateLRC(lyric: LyricData): string {
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

export const useLyricsCoverStore = create<LyricEditorState>()(
  persist(
    (set, get) => ({
      lyrics: [],
      covers: [],
      currentLyric: null,
      isEditing: false,
      editMode: "text",

      currentTime: 0,
      playbackState: "stopped",

      loadLyric: (songId) => {
        const { lyrics } = get();
        return lyrics.find((l) => l.songId === songId) || null;
      },

      saveLyric: (lyric) => {
        set((state) => ({
          lyrics: state.lyrics
            .map((l) => (l.songId === lyric.songId ? lyric : l))
            .concat(state.lyrics.every((l) => l.songId !== lyric.songId) ? [lyric] : []),
        }));
      },

      deleteLyric: (songId) => {
        set((state) => ({
          lyrics: state.lyrics.filter((l) => l.songId !== songId),
        }));
      },

      importLRC: (songId, lrcText) => {
        const lines = parseLRC(lrcText);
        const lyric: LyricData = {
          id: songId,
          songId,
          title: "",
          artist: "",
          lines,
          isLRC: true,
          source: "file",
          lastModified: Date.now(),
        };
        get().saveLyric(lyric);
        return lyric;
      },

      exportLRC: (songId) => {
        const lyric = get().loadLyric(songId);
        if (!lyric) return "";
        return generateLRC(lyric);
      },

      setCurrentLyric: (lyric) => {
        set({ currentLyric: lyric });
      },

      setIsEditing: (editing) => {
        set({ isEditing: editing });
      },

      setEditMode: (mode) => {
        set({ editMode: mode });
      },

      addLyricLine: (line) => {
        set((state) => {
          if (!state.currentLyric) return state;
          const newLyric = {
            ...state.currentLyric,
            lines: [...state.currentLyric.lines, line].sort((a, b) => a.time - b.time),
          };
          return { currentLyric: newLyric };
        });
      },

      updateLyricLine: (lineId, updates) => {
        set((state) => {
          if (!state.currentLyric) return state;
          const newLyric = {
            ...state.currentLyric,
            lines: state.currentLyric.lines.map((line) =>
              line.id === lineId ? { ...line, ...updates } : line
            ),
          };
          return { currentLyric: newLyric };
        });
      },

      deleteLyricLine: (lineId) => {
        set((state) => {
          if (!state.currentLyric) return state;
          const newLyric = {
            ...state.currentLyric,
            lines: state.currentLyric.lines.filter((line) => line.id !== lineId),
          };
          return { currentLyric: newLyric };
        });
      },

      setLyricLines: (lines) => {
        set((state) => {
          if (!state.currentLyric) return state;
          return {
            currentLyric: {
              ...state.currentLyric,
              lines: lines.sort((a, b) => a.time - b.time),
            },
          };
        });
      },

      loadCover: (songId) => {
        const { covers } = get();
        return covers.find((c) => c.songId === songId) || null;
      },

      saveCover: (cover) => {
        set((state) => ({
          covers: state.covers
            .map((c) => (c.songId === cover.songId ? cover : c))
            .concat(state.covers.every((c) => c.songId !== cover.songId) ? [cover] : []),
        }));
      },

      deleteCover: (songId) => {
        set((state) => ({
          covers: state.covers.filter((c) => c.songId !== songId),
        }));
      },

      importCoverImage: (songId, imageData, format) => {
        const cover: CoverData = {
          id: songId,
          songId,
          imageData,
          source: "manual",
          lastModified: Date.now(),
          format,
        };
        get().saveCover(cover);
        return cover;
      },

      cropCover: (songId, cropData) => {
        return null;
      },

      resizeCover: (songId, targetSize) => {
        return null;
      },

      setCurrentTime: (time) => {
        set({ currentTime: time });
      },

      setPlaybackState: (state) => {
        set({ playbackState: state });
      },

      getCurrentLyricLine: () => {
        const { currentLyric, currentTime } = get();
        if (!currentLyric) return null;

        for (let i = currentLyric.lines.length - 1; i >= 0; i--) {
          if (currentLyric.lines[i].time <= currentTime) {
            return currentLyric.lines[i];
          }
        }

        return null;
      },

      batchImportLyrics: (lyrics) => {
        set((state) => ({
          lyrics: [...state.lyrics, ...lyrics].filter(
            (lyric, index, self) => index === self.findIndex((l) => l.songId === lyric.songId)
          ),
        }));
      },

      batchImportCovers: (covers) => {
        set((state) => ({
          covers: [...state.covers, ...covers].filter(
            (cover, index, self) => index === self.findIndex((c) => c.songId === cover.songId)
          ),
        }));
      },

      exportAllLyrics: () => {
        return get().lyrics;
      },

      exportAllCovers: () => {
        return get().covers;
      },

      clearAll: () => {
        set({ lyrics: [], covers: [], currentLyric: null });
      },
    }),
    {
      name: "lyrics-cover-store-v4",
      partialize: (state) => ({
        lyrics: state.lyrics,
        covers: state.covers,
      }),
    }
  )
);
