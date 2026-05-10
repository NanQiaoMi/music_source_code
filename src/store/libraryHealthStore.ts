import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "@/types/song";

export type HealthIssueType =
  | "missing-metadata"
  | "missing-cover"
  | "missing-lyrics"
  | "corrupted-file"
  | "duplicate"
  | "low-quality"
  | "unknown-format";

export interface HealthIssue {
  id: string;
  songId: string;
  type: HealthIssueType;
  severity: "low" | "medium" | "high";
  description: string;
  suggestion: string;
  detectedAt: number;
}

export interface HealthReport {
  totalSongs: number;
  healthySongs: number;
  issuesCount: number;
  issues: HealthIssue[];
  duplicates: { [key: string]: string[] };
  missingMetadata: string[];
  missingCover: string[];
  missingLyrics: string[];
  generatedAt: number;
}

export interface LibraryHealthState {
  lastScan: number | null;
  isScanning: boolean;
  scanProgress: number;

  healthReport: HealthReport | null;
  autoScan: boolean;
  scanInterval: number;

  setLastScan: (timestamp: number) => void;
  setScanning: (scanning: boolean) => void;
  setScanProgress: (progress: number) => void;

  setHealthReport: (report: HealthReport) => void;
  setAutoScan: (auto: boolean) => void;
  setScanInterval: (interval: number) => void;

  addIssue: (issue: HealthIssue) => void;
  removeIssue: (issueId: string) => void;
  clearIssues: () => void;

  getIssuesByType: (type: HealthIssueType) => HealthIssue[];
  getIssuesBySeverity: (severity: "low" | "medium" | "high") => HealthIssue[];
}

export const useLibraryHealthStore = create<LibraryHealthState>()(
  persist(
    (set, get) => ({
      lastScan: null,
      isScanning: false,
      scanProgress: 0,

      healthReport: null,
      autoScan: true,
      scanInterval: 7,

      setLastScan: (timestamp) => {
        set({ lastScan: timestamp });
      },

      setScanning: (scanning) => {
        set({ isScanning: scanning });
      },

      setScanProgress: (progress) => {
        set({ scanProgress: Math.min(100, Math.max(0, progress)) });
      },

      setHealthReport: (report) => {
        set({ healthReport: report });
      },

      setAutoScan: (auto) => {
        set({ autoScan: auto });
      },

      setScanInterval: (interval) => {
        set({ scanInterval: Math.max(1, interval) });
      },

      addIssue: (issue) => {
        set((state) => {
          if (!state.healthReport) return state;

          return {
            healthReport: {
              ...state.healthReport,
              issuesCount: state.healthReport.issuesCount + 1,
              issues: [...state.healthReport.issues, issue],
            },
          };
        });
      },

      removeIssue: (issueId) => {
        set((state) => {
          if (!state.healthReport) return state;

          return {
            healthReport: {
              ...state.healthReport,
              issuesCount: state.healthReport.issuesCount - 1,
              issues: state.healthReport.issues.filter((i) => i.id !== issueId),
            },
          };
        });
      },

      clearIssues: () => {
        set((state) => {
          if (!state.healthReport) return state;

          return {
            healthReport: {
              ...state.healthReport,
              issuesCount: 0,
              issues: [],
            },
          };
        });
      },

      getIssuesByType: (type) => {
        return get().healthReport?.issues.filter((i) => i.type === type) || [];
      },

      getIssuesBySeverity: (severity) => {
        return get().healthReport?.issues.filter((i) => i.severity === severity) || [];
      },
    }),
    {
      name: "library-health-store-v5",
      partialize: (state) => ({
        lastScan: state.lastScan,
        autoScan: state.autoScan,
        scanInterval: state.scanInterval,
      }),
    }
  )
);

export function generateHealthReport(songs: Song[]): HealthReport {
  const issues: HealthIssue[] = [];
  const duplicates: { [key: string]: string[] } = {};
  const missingMetadata: string[] = [];
  const missingCover: string[] = [];
  const missingLyrics: string[] = [];

  const seenHashes: { [key: string]: string[] } = {};

  songs.forEach((song) => {
    const songIssues: HealthIssue[] = [];

    if (!song.title || !song.artist) {
      missingMetadata.push(song.id);
      songIssues.push({
        id: `missing-meta-${song.id}`,
        songId: song.id,
        type: "missing-metadata",
        severity: "medium",
        description: "歌曲缺少元数据（标题或艺术家）",
        suggestion: "使用批量元数据工具补全信息",
        detectedAt: Date.now(),
      });
    }

    if (!song.cover || song.cover === "/default-cover.png") {
      missingCover.push(song.id);
      songIssues.push({
        id: `missing-cover-${song.id}`,
        songId: song.id,
        type: "missing-cover",
        severity: "low",
        description: "歌曲缺少封面图片",
        suggestion: "使用歌词封面编辑器添加封面",
        detectedAt: Date.now(),
      });
    }

    if (!song.lyrics) {
      missingLyrics.push(song.id);
      songIssues.push({
        id: `missing-lyrics-${song.id}`,
        songId: song.id,
        type: "missing-lyrics",
        severity: "low",
        description: "歌曲缺少歌词",
        suggestion: "使用歌词编辑器添加歌词",
        detectedAt: Date.now(),
      });
    }

    const hash = `${song.title}-${song.artist}-${song.duration}`;
    if (!seenHashes[hash]) {
      seenHashes[hash] = [];
    }
    seenHashes[hash].push(song.id);

    issues.push(...songIssues);
  });

  Object.entries(seenHashes).forEach(([hash, songIds]) => {
    if (songIds.length > 1) {
      duplicates[hash] = songIds;
      songIds.forEach((songId, index) => {
        if (index > 0) {
          issues.push({
            id: `duplicate-${songId}`,
            songId,
            type: "duplicate",
            severity: "high",
            description: "发现重复歌曲",
            suggestion: "使用智能去重功能处理",
            detectedAt: Date.now(),
          });
        }
      });
    }
  });

  const healthySongs = songs.length - issues.length;

  return {
    totalSongs: songs.length,
    healthySongs: Math.max(0, healthySongs),
    issuesCount: issues.length,
    issues,
    duplicates,
    missingMetadata,
    missingCover,
    missingLyrics,
    generatedAt: Date.now(),
  };
}
