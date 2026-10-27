import type { Song } from "@/types/song";
import type { PlaylistState } from "../playlistStore";

/**
 * playlistStore 字段 selector。
 * 消费方按需订阅单个切片，禁止再用无 selector 的 usePlaylistStore 解构整个 store：
 * 整店订阅会让任何字段（如 selectedSong / searchQuery）变化都触发重渲染。
 */
export const selectSongs = (state: PlaylistState): Song[] => state.songs;
export const selectSongCount = (state: PlaylistState): number => state.songs.length;
export const selectHasSongs = (state: PlaylistState): boolean => state.songs.length > 0;
export const selectSearchQuery = (state: PlaylistState): string => state.searchQuery;
export const selectFilteredSongs = (state: PlaylistState): Song[] => state.filteredSongs;
export const selectSelectedSongIds = (state: PlaylistState): Set<string> => state.selectedSongIds;

/**
 * 动作 selector。Zustand 中动作引用自创建后保持稳定，
 * 单独订阅不会因数据变化而触发重渲染。
 */
export const selectAddSong = (state: PlaylistState): PlaylistState["addSong"] => state.addSong;
export const selectRemoveSong = (state: PlaylistState): PlaylistState["removeSong"] =>
  state.removeSong;
export const selectUpdateSong = (state: PlaylistState): PlaylistState["updateSong"] =>
  state.updateSong;
export const selectSearchSongs = (state: PlaylistState): PlaylistState["searchSongs"] =>
  state.searchSongs;
export const selectClearFilters = (state: PlaylistState): PlaylistState["clearFilters"] =>
  state.clearFilters;
export const selectImportSongs = (state: PlaylistState): PlaylistState["importSongs"] =>
  state.importSongs;
export const selectExportSongs = (state: PlaylistState): PlaylistState["exportSongs"] =>
  state.exportSongs;
