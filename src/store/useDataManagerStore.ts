import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage, sanitizeSongForStorage } from "@/lib/storage/safeStorage";
import { Song } from "@/types/song";

export type HubTabKey =
  | "dashboard"
  | "lx_search"
  | "cloud"
  | "downloads"
  | "playlists"
  | "local"
  | "health_storage";

export type SearchSourceTab = "all" | "kuwo" | "kugou" | "qq" | "netease" | "migu" | "lx_custom";
export type SearchMode = "songs" | "playlists";
export type QualityFilter = "all" | "24bit" | "flac";
export type SortField = "index" | "title" | "artist" | "album" | "duration";
export type SortOrder = "asc" | "desc";

import { OnlinePlaylistResult } from "@/app/api/playlist/search/route";

export type { OnlinePlaylistResult };

interface DataManagerState {
  // Hub Tab state
  activeHubTab: HubTabKey;
  setActiveHubTab: (tab: HubTabKey) => void;

  // Search Tab state
  keyword: string;
  setKeyword: (keyword: string) => void;
  activeSourceTab: SearchSourceTab;
  setActiveSourceTab: (tab: SearchSourceTab) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  qualityFilter: QualityFilter;
  setQualityFilter: (filter: QualityFilter) => void;

  // Search Results
  songResults: Song[];
  setSongResults: (results: Song[]) => void;
  playlistResults: OnlinePlaylistResult[];
  setPlaylistResults: (results: OnlinePlaylistResult[]) => void;

  // Sorting & Configuration
  sortField: SortField;
  setSortField: (field: SortField) => void;
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  selectedScriptId: string;
  setSelectedScriptId: (id: string) => void;

  // Reset helper
  clearSearchState: () => void;
}

export const useDataManagerStore = create<DataManagerState>()(
  persist(
    (set) => ({
      activeHubTab: "dashboard",
      setActiveHubTab: (tab) => set({ activeHubTab: tab }),

      keyword: "周杰伦",
      setKeyword: (keyword) => set({ keyword }),
      activeSourceTab: "all",
      setActiveSourceTab: (tab) => set({ activeSourceTab: tab }),
      searchMode: "songs",
      setSearchMode: (mode) => set({ searchMode: mode }),
      qualityFilter: "all",
      setQualityFilter: (filter) => set({ qualityFilter: filter }),

      songResults: [],
      setSongResults: (results) => set({ songResults: results }),
      playlistResults: [],
      setPlaylistResults: (results) => set({ playlistResults: results }),

      sortField: "index",
      setSortField: (field) => set({ sortField: field }),
      sortOrder: "asc",
      setSortOrder: (order) => set({ sortOrder: order }),
      selectedScriptId: "exclusive_v5",
      setSelectedScriptId: (id) => set({ selectedScriptId: id }),

      clearSearchState: () =>
        set({
          keyword: "",
          songResults: [],
          playlistResults: [],
          activeSourceTab: "all",
        }),
    }),
    {
      name: "mimi_datamanager_hub_store_v1",
      storage: createJSONStorage(() => createSafeStorage("mimi_datamanager_hub_store_v1")),
      partialize: (state) => ({
        activeHubTab: state.activeHubTab,
        keyword: state.keyword,
        activeSourceTab: state.activeSourceTab,
        searchMode: state.searchMode,
        qualityFilter: state.qualityFilter,
        songResults: Array.isArray(state.songResults)
          ? state.songResults.slice(0, 100).map(sanitizeSongForStorage)
          : [],
        playlistResults: Array.isArray(state.playlistResults)
          ? state.playlistResults.slice(0, 30)
          : [],
        sortField: state.sortField,
        sortOrder: state.sortOrder,
        selectedScriptId: state.selectedScriptId,
      }),
    }
  )
);
