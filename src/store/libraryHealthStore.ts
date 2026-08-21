import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HealthIssueType, Song } from "@/types/song";

export type LibraryIssueSeverity = "critical" | "warning" | "info";
export type LibraryIssueAction = "remove" | "edit" | "rescan" | "ignore";

export interface HealthIssue {
  id: string;
  songId: string;
  type: HealthIssueType;
  severity: LibraryIssueSeverity;
  actions: LibraryIssueAction[];
  description: string;
  suggestion: string;
  detectedAt: number;
}

export interface HealthIssueGroup {
  type: HealthIssueType;
  severity: LibraryIssueSeverity;
  actions: LibraryIssueAction[];
  count: number;
  affectedSongIds: string[];
  issues: HealthIssue[];
}

export interface HealthReport {
  totalSongs: number;
  healthySongs: number;
  issuesCount: number;
  issues: HealthIssue[];
  issueGroups: Record<string, HealthIssueGroup>;
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
  ignoredIssueIds: string[];
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
  ignoreIssue: (issueId: string) => void;
  clearIssues: () => void;

  getIssuesByType: (type: HealthIssueType) => HealthIssue[];
  getIssuesBySeverity: (severity: LibraryIssueSeverity) => HealthIssue[];
  getIssueGroups: () => HealthIssueGroup[];
  exportHealthReport: () => string | null;
}

function createIssue(
  songId: string,
  type: HealthIssueType,
  severity: LibraryIssueSeverity,
  actions: LibraryIssueAction[],
  description: string,
  suggestion: string
): HealthIssue {
  return {
    id: `${type}-${songId}`,
    songId,
    type,
    severity,
    actions,
    description,
    suggestion,
    detectedAt: Date.now(),
  };
}

function buildIssueGroups(issues: HealthIssue[]): Record<string, HealthIssueGroup> {
  return issues.reduce<Record<string, HealthIssueGroup>>((groups, issue) => {
    const existing = groups[issue.type];
    if (!existing) {
      groups[issue.type] = {
        type: issue.type,
        severity: issue.severity,
        actions: issue.actions,
        count: 1,
        affectedSongIds: [issue.songId],
        issues: [issue],
      };
      return groups;
    }

    existing.count += 1;
    existing.affectedSongIds.push(issue.songId);
    existing.issues.push(issue);
    existing.actions = Array.from(new Set([...existing.actions, ...issue.actions]));
    return groups;
  }, {});
}

export const useLibraryHealthStore = create<LibraryHealthState>()(
  persist(
    (set, get) => ({
      lastScan: null,
      isScanning: false,
      scanProgress: 0,

      healthReport: null,
      ignoredIssueIds: [],
      autoScan: true,
      scanInterval: 7,

      setLastScan: (timestamp) => set({ lastScan: timestamp }),

      setScanning: (scanning) => set({ isScanning: scanning }),

      setScanProgress: (progress) => set({ scanProgress: Math.min(100, Math.max(0, progress)) }),

      setHealthReport: (report) => set({ healthReport: report, lastScan: report.generatedAt }),

      setAutoScan: (auto) => set({ autoScan: auto }),

      setScanInterval: (interval) => set({ scanInterval: Math.max(1, interval) }),

      addIssue: (issue) => {
        set((state) => {
          if (!state.healthReport) return state;

          const issues = [...state.healthReport.issues, issue];
          return {
            healthReport: {
              ...state.healthReport,
              issuesCount: issues.length,
              issues,
              issueGroups: buildIssueGroups(issues),
            },
          };
        });
      },

      removeIssue: (issueId) => {
        set((state) => {
          if (!state.healthReport) return state;

          const issues = state.healthReport.issues.filter((issue) => issue.id !== issueId);
          return {
            healthReport: {
              ...state.healthReport,
              issuesCount: issues.length,
              issues,
              issueGroups: buildIssueGroups(issues),
            },
          };
        });
      },

      ignoreIssue: (issueId) => {
        set((state) => ({
          ignoredIssueIds: Array.from(new Set([...state.ignoredIssueIds, issueId])),
        }));
        get().removeIssue(issueId);
      },

      clearIssues: () => {
        set((state) => {
          if (!state.healthReport) return state;

          return {
            healthReport: {
              ...state.healthReport,
              issuesCount: 0,
              issues: [],
              issueGroups: {},
            },
          };
        });
      },

      getIssuesByType: (type) => {
        return get().healthReport?.issues.filter((issue) => issue.type === type) || [];
      },

      getIssuesBySeverity: (severity) => {
        return get().healthReport?.issues.filter((issue) => issue.severity === severity) || [];
      },

      getIssueGroups: () => Object.values(get().healthReport?.issueGroups || {}),

      exportHealthReport: () => {
        const report = get().healthReport;
        return report ? JSON.stringify(report, null, 2) : null;
      },
    }),
    {
      name: "library-health-store-v5",
      partialize: (state) => ({
        lastScan: state.lastScan,
        autoScan: state.autoScan,
        scanInterval: state.scanInterval,
        ignoredIssueIds: state.ignoredIssueIds,
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

  const seenMetadata: Record<string, string[]> = {};

  songs.forEach((song) => {
    if (!song.audioUrl) {
      issues.push(
        createIssue(
          song.id,
          "missing_file",
          "critical",
          ["rescan", "remove"],
          "Audio source is missing",
          "Rescan the library or remove the broken song."
        )
      );
    }

    if (!song.title || !song.artist) {
      missingMetadata.push(song.id);
      issues.push(
        createIssue(
          song.id,
          "missing_metadata",
          "warning",
          ["edit", "ignore"],
          "Song title or artist is missing",
          "Edit the metadata before building playlists from this track."
        )
      );
    }

    if (!Number.isFinite(song.duration) || song.duration <= 0) {
      issues.push(
        createIssue(
          song.id,
          "low_quality",
          "warning",
          ["edit", "rescan", "ignore"],
          "Song duration is invalid",
          "Rescan the file or correct the metadata duration."
        )
      );
    }

    if (!song.cover || song.cover === "/default-cover.png") {
      missingCover.push(song.id);
      issues.push(
        createIssue(
          song.id,
          "missing_cover",
          "info",
          ["edit", "ignore"],
          "Cover image is missing",
          "Add a cover to make library browsing easier."
        )
      );
    } else if (song.cover.startsWith("data:image/") && song.cover.length > 1_000_000) {
      issues.push(
        createIssue(
          song.id,
          "oversized_cover",
          "warning",
          ["edit", "ignore"],
          "Embedded cover is oversized",
          "Replace the cover with a smaller image to reduce local storage usage."
        )
      );
    }

    if (!song.lyrics) {
      missingLyrics.push(song.id);
      issues.push(
        createIssue(
          song.id,
          "missing_lyrics",
          "info",
          ["edit", "ignore"],
          "Lyrics are missing",
          "Import LRC lyrics for better playback and visualization."
        )
      );
    }

    const duplicateKey = `${song.title || ""}::${song.artist || ""}`.trim().toLowerCase();
    if (!seenMetadata[duplicateKey]) {
      seenMetadata[duplicateKey] = [];
    }
    seenMetadata[duplicateKey].push(song.id);
  });

  Object.entries(seenMetadata).forEach(([key, songIds]) => {
    if (key === "::" || songIds.length <= 1) return;

    duplicates[key] = songIds;
    songIds.slice(1).forEach((songId) => {
      issues.push(
        createIssue(
          songId,
          "duplicate",
          "warning",
          ["remove", "ignore"],
          "Duplicate title and artist detected",
          "Review duplicate songs and remove extra copies."
        )
      );
    });
  });

  const affectedSongIds = new Set(issues.map((issue) => issue.songId));

  return {
    totalSongs: songs.length,
    healthySongs: Math.max(0, songs.length - affectedSongIds.size),
    issuesCount: issues.length,
    issues,
    issueGroups: buildIssueGroups(issues),
    duplicates,
    missingMetadata,
    missingCover,
    missingLyrics,
    generatedAt: Date.now(),
  };
}
