import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Song } from "@/types/song";
import {
  DEFAULT_LIBRARY_STATS,
  DEFAULT_RENAME_RULES,
  DEFAULT_SCAN_FILTERS,
  calculateQualityScore,
  generateDuplicateKey,
  type DuplicateGroup,
  type DuplicateSong,
  type FolderMonitor,
  type LibraryStats,
  type RenameRule,
  type ScanFilter,
} from "./libraryManager/helpers";

export type {
  DuplicateGroup,
  DuplicateSong,
  FolderMonitor,
  LibraryStats,
  RenameRule,
  ScanFilter,
} from "./libraryManager/helpers";

interface LibraryManagerState {
  duplicateGroups: DuplicateGroup[];
  isScanningDuplicates: boolean;
  duplicateScanProgress: number;

  renameRules: RenameRule[];
  selectedRenameRule: string;

  scanFilters: ScanFilter;
  folderMonitors: FolderMonitor[];
  isWatchingFolders: boolean;

  libraryStats: LibraryStats;
  lastStatsUpdate: number;

  findDuplicates: (songs: Song[]) => Promise<void>;
  markDuplicateForDeletion: (groupId: string, songId: string) => void;
  keepDuplicate: (groupId: string, songId: string) => void;
  deleteSelectedDuplicates: () => Promise<void>;

  addRenameRule: (rule: RenameRule) => void;
  updateRenameRule: (id: string, rule: Partial<RenameRule>) => void;
  deleteRenameRule: (id: string) => void;
  setSelectedRenameRule: (id: string) => void;

  setScanFilters: (filters: Partial<ScanFilter>) => void;

  addFolderMonitor: (monitor: FolderMonitor) => void;
  updateFolderMonitor: (id: string, monitor: Partial<FolderMonitor>) => void;
  deleteFolderMonitor: (id: string) => void;
  toggleFolderMonitor: (id: string) => void;
  setIsWatchingFolders: (watching: boolean) => void;

  updateLibraryStats: (songs: Song[]) => void;
  clearLibraryStats: () => void;

  clearDuplicateResults: () => void;
}

export const useLibraryManagerStore = create<LibraryManagerState>()(
  persist(
    (set, get) => ({
      duplicateGroups: [],
      isScanningDuplicates: false,
      duplicateScanProgress: 0,

      renameRules: DEFAULT_RENAME_RULES,
      selectedRenameRule: "artist-title",

      scanFilters: DEFAULT_SCAN_FILTERS,
      folderMonitors: [],
      isWatchingFolders: false,

      libraryStats: DEFAULT_LIBRARY_STATS,
      lastStatsUpdate: 0,

      findDuplicates: async (songs: Song[]) => {
        set({ isScanningDuplicates: true, duplicateScanProgress: 0 });

        const groupsMap = new Map<string, DuplicateSong[]>();

        for (let i = 0; i < songs.length; i++) {
          const song = songs[i];
          const key = generateDuplicateKey(song);

          const duplicateSong: DuplicateSong = {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            fileSize: song.fileSize ?? 0,
            bitrate: song.bitRate,
            format: song.format,
            qualityScore: 0,
            isRecommended: false,
          };

          if (!groupsMap.has(key)) {
            groupsMap.set(key, []);
          }
          groupsMap.get(key)!.push(duplicateSong);

          const progress = Math.round(((i + 1) / songs.length) * 100);
          set({ duplicateScanProgress: progress });

          await new Promise((resolve) => setTimeout(resolve, 1));
        }

        const duplicateGroups: DuplicateGroup[] = [];
        let duplicatesCount = 0;

        for (const [key, groupSongs] of groupsMap) {
          if (groupSongs.length > 1) {
            const songsWithQuality = groupSongs.map((song) => ({
              ...song,
              qualityScore: calculateQualityScore(song),
            }));

            songsWithQuality.sort((a, b) => b.qualityScore - a.qualityScore);
            songsWithQuality[0].isRecommended = true;

            duplicateGroups.push({
              groupId: key,
              songs: songsWithQuality,
              recommendedSongId: songsWithQuality[0].id,
            });

            duplicatesCount += groupSongs.length - 1;
          }
        }

        set({
          duplicateGroups,
          isScanningDuplicates: false,
          libraryStats: { ...get().libraryStats, duplicatesCount },
        });
      },

      markDuplicateForDeletion: (groupId: string, songId: string) => {
        set((state) => ({
          duplicateGroups: state.duplicateGroups.map((group) => {
            if (group.groupId === groupId) {
              return {
                ...group,
                songs: group.songs.map((song) =>
                  song.id === songId ? { ...song, isRecommended: false } : song
                ),
              };
            }
            return group;
          }),
        }));
      },

      keepDuplicate: (groupId: string, songId: string) => {
        set((state) => ({
          duplicateGroups: state.duplicateGroups.map((group) => {
            if (group.groupId === groupId) {
              return {
                ...group,
                songs: group.songs.map((song) => ({
                  ...song,
                  isRecommended: song.id === songId,
                })),
                recommendedSongId: songId,
              };
            }
            return group;
          }),
        }));
      },

      deleteSelectedDuplicates: async () => {
        const { duplicateGroups } = get();
        const songsToDelete: string[] = [];

        for (const group of duplicateGroups) {
          for (const song of group.songs) {
            if (!song.isRecommended) {
              songsToDelete.push(song.id);
            }
          }
        }

        set((state) => ({
          duplicateGroups: state.duplicateGroups
            .map((group) => ({
              ...group,
              songs: group.songs.filter((song) => song.isRecommended),
            }))
            .filter((group) => group.songs.length > 0),
        }));
      },

      addRenameRule: (rule) => {
        set((state) => ({
          renameRules: [...state.renameRules, rule],
        }));
      },

      updateRenameRule: (id, updates) => {
        set((state) => ({
          renameRules: state.renameRules.map((rule) =>
            rule.id === id ? { ...rule, ...updates } : rule
          ),
        }));
      },

      deleteRenameRule: (id) => {
        set((state) => ({
          renameRules: state.renameRules.filter((rule) => rule.id !== id),
          selectedRenameRule:
            state.selectedRenameRule === id
              ? state.renameRules[0]?.id || ""
              : state.selectedRenameRule,
        }));
      },

      setSelectedRenameRule: (id) => {
        set({ selectedRenameRule: id });
      },

      setScanFilters: (filters) => {
        set((state) => ({
          scanFilters: { ...state.scanFilters, ...filters },
        }));
      },

      addFolderMonitor: (monitor) => {
        set((state) => ({
          folderMonitors: [...state.folderMonitors, monitor],
        }));
      },

      updateFolderMonitor: (id, updates) => {
        set((state) => ({
          folderMonitors: state.folderMonitors.map((monitor) =>
            monitor.id === id ? { ...monitor, ...updates } : monitor
          ),
        }));
      },

      deleteFolderMonitor: (id) => {
        set((state) => ({
          folderMonitors: state.folderMonitors.filter((monitor) => monitor.id !== id),
        }));
      },

      toggleFolderMonitor: (id) => {
        set((state) => ({
          folderMonitors: state.folderMonitors.map((monitor) =>
            monitor.id === id ? { ...monitor, isEnabled: !monitor.isEnabled } : monitor
          ),
        }));
      },

      setIsWatchingFolders: (watching) => {
        set({ isWatchingFolders: watching });
      },

      updateLibraryStats: (songs) => {
        const artists = new Set<string>();
        const albums = new Set<string>();
        let totalDuration = 0;
        let totalFileSize = 0;

        for (const song of songs) {
          artists.add(song.artist.trim().toLowerCase());
          if (song.album) albums.add(song.album.trim().toLowerCase());
          totalDuration += song.duration;
          totalFileSize += song.fileSize ?? 0;
        }

        set({
          libraryStats: {
            totalSongs: songs.length,
            totalDuration,
            totalFileSize,
            artistsCount: artists.size,
            albumsCount: albums.size,
            duplicatesCount: get().libraryStats.duplicatesCount,
          },
          lastStatsUpdate: Date.now(),
        });
      },

      clearLibraryStats: () => {
        set({ libraryStats: DEFAULT_LIBRARY_STATS, lastStatsUpdate: 0 });
      },

      clearDuplicateResults: () => {
        set({ duplicateGroups: [], duplicateScanProgress: 0 });
      },
    }),
    {
      skipHydration: true,
      name: "library-manager-store-v4",
      partialize: (state) => ({
        renameRules: state.renameRules,
        selectedRenameRule: state.selectedRenameRule,
        scanFilters: state.scanFilters,
        folderMonitors: state.folderMonitors,
      }),
    }
  )
);
