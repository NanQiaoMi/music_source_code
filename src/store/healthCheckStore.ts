import { create } from "zustand";
import { generateHealthReport } from "./libraryHealthStore";
import { usePlaylistStore } from "./playlistStore";

export type HealthIssueType =
  | "missing_file"
  | "corrupt_file"
  | "missing_metadata"
  | "duplicate"
  | "low_quality"
  | "unsupported_format";

export interface HealthIssue {
  id: string;
  type: HealthIssueType;
  songId: string;
  title: string;
  artist: string;
  filePath: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  canAutoFix: boolean;
}

interface HealthCheckState {
  isRunning: boolean;
  progress: number;
  issues: HealthIssue[];
  selectedIssues: Set<string>;
  lastCheckTime: number | null;
  totalSongsScanned: number;

  startCheck: () => void;
  stopCheck: () => void;
  selectIssue: (issueId: string) => void;
  selectAllIssues: () => void;
  deselectAllIssues: () => void;
  fixIssue: (issueId: string) => Promise<void>;
  fixSelectedIssues: () => Promise<void>;
  clearIssues: () => void;
  dismissIssue: (issueId: string) => void;
}

const issueTypeNames: Record<HealthIssueType, string> = {
  missing_file: "文件缺失",
  corrupt_file: "文件损坏",
  missing_metadata: "元数据缺失",
  duplicate: "重复文件",
  low_quality: "低质量",
  unsupported_format: "不支持格式",
};

export const useHealthCheckStore = create<HealthCheckState>((set, get) => ({
  isRunning: false,
  progress: 0,
  issues: [],
  selectedIssues: new Set(),
  lastCheckTime: null,
  totalSongsScanned: 0,

  startCheck: async () => {
    set({ isRunning: true, progress: 0, issues: [] });

    const songs = usePlaylistStore.getState().songs;

    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      set({ progress: i });
    }

    const report = generateHealthReport(songs);

    const typeMap: Record<string, HealthIssueType> = {
      "missing-metadata": "missing_metadata",
      "missing-cover": "missing_metadata",
      "missing-lyrics": "missing_metadata",
      "corrupted-file": "corrupt_file",
      duplicate: "duplicate",
      "low-quality": "low_quality",
      "unknown-format": "unsupported_format",
    };

    const songMap = new Map(songs.map((s) => [s.id, s]));

    const issues: HealthIssue[] = report.issues.map((issue) => {
      const song = songMap.get(issue.songId);
      return {
        id: `hc-${issue.id}`,
        type: typeMap[issue.type] || "missing_metadata",
        songId: issue.songId,
        title: song?.title || "未知歌曲",
        artist: song?.artist || "未知艺术家",
        filePath: issue.songId,
        severity:
          issue.severity === "high" ? "high" : issue.severity === "medium" ? "medium" : "low",
        description: issue.description,
        canAutoFix: true,
      };
    });

    set({
      isRunning: false,
      issues,
      lastCheckTime: Date.now(),
      totalSongsScanned: songs.length,
    });
  },

  stopCheck: () => set({ isRunning: false }),

  selectIssue: (issueId) =>
    set((state) => {
      const newSelected = new Set(state.selectedIssues);
      if (newSelected.has(issueId)) {
        newSelected.delete(issueId);
      } else {
        newSelected.add(issueId);
      }
      return { selectedIssues: newSelected };
    }),

  selectAllIssues: () =>
    set((state) => ({
      selectedIssues: new Set(state.issues.map((i) => i.id)),
    })),

  deselectAllIssues: () => set({ selectedIssues: new Set() }),

  fixIssue: async (issueId) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    set((state) => ({
      issues: state.issues.filter((i) => i.id !== issueId),
      selectedIssues: new Set([...state.selectedIssues].filter((id) => id !== issueId)),
    }));
  },

  fixSelectedIssues: async () => {
    const { selectedIssues } = get();
    for (const issueId of selectedIssues) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      set((state) => ({
        issues: state.issues.filter((i) => i.id !== issueId),
        selectedIssues: new Set([...state.selectedIssues].filter((id) => id !== issueId)),
      }));
    }
  },

  clearIssues: () => set({ issues: [], selectedIssues: new Set() }),

  dismissIssue: (issueId) =>
    set((state) => ({
      issues: state.issues.filter((i) => i.id !== issueId),
      selectedIssues: new Set([...state.selectedIssues].filter((id) => id !== issueId)),
    })),
}));

export { issueTypeNames };
