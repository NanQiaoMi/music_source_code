import { create } from "zustand";

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

    const mockIssues: HealthIssue[] = [
      {
        id: "issue-1",
        type: "missing_metadata",
        songId: "song-1",
        title: "未知歌曲",
        artist: "未知艺术家",
        filePath: "D:/Music/song1.mp3",
        severity: "low",
        description: "缺少专辑信息",
        canAutoFix: true,
      },
      {
        id: "issue-2",
        type: "duplicate",
        songId: "song-2",
        title: "Sample Song",
        artist: "Sample Artist",
        filePath: "D:/Music/song2.mp3",
        severity: "medium",
        description: "发现 2 个重复文件",
        canAutoFix: true,
      },
      {
        id: "issue-3",
        type: "low_quality",
        songId: "song-3",
        title: "Low Quality Track",
        artist: "Artist",
        filePath: "D:/Music/song3.mp3",
        severity: "low",
        description: "比特率低于 192kbps",
        canAutoFix: false,
      },
    ];

    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      set({ progress: i });
    }

    set({
      isRunning: false,
      issues: mockIssues,
      lastCheckTime: Date.now(),
      totalSongsScanned: 150,
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
      selectedIssues: new Set(state.issues.map((i) => i.id)) })),

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

  clearIssues: () =>
    set({ issues: [], selectedIssues: new Set() }),

  dismissIssue: (issueId) =>
    set((state) => ({
      issues: state.issues.filter((i) => i.id !== issueId),
      selectedIssues: new Set([...state.selectedIssues].filter((id) => id !== issueId)),
    })),
}));

export { issueTypeNames };
