/**
 * S6-10a：service 层命令式 store 入口。
 *
 * - services 不依赖 React，也不再直接调用 store 的 getState()；一次性读快照 / 触发 action
 *   统一收敛到本文件，service 只 import 这里的函数。
 * - 每次调用现取 getState，不缓存快照（水合/持久化后不会读到过期状态）。
 * - 只做薄适配，不承载跨 store 编排；组件/hooks 仍走 selector 与各自 store action。
 * - 单独成文件的另一原因：既有 store 文件受 S6-12 行数棘轮（shrink-only）约束。
 */
import type { Song } from "@/types/song";
import { useFavoritesStore } from "@/store/favoritesStore";
import { generateHealthReport, useLibraryHealthStore } from "@/store/libraryHealthStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { usePlayerStore, type LoopMode } from "@/store/playerStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { useSleepTimerStore } from "@/store/sleepTimerStore";
import { useVisualizationStore, type VisualizationEffect } from "@/store/visualizationStore";

// ---- playerStore ----
export const getPlayerLoopMode = (): LoopMode => usePlayerStore.getState().loopMode;

export const setPlayerLoopMode = (mode: LoopMode): void =>
  usePlayerStore.getState().setLoopMode(mode);

// ---- favoritesStore ----
export const isFavoriteSong = (songId: string): boolean =>
  useFavoritesStore.getState().isFavorite(songId);

export const addFavoriteSong = (song: Song): void =>
  useFavoritesStore.getState().addToFavorites(song);

export const removeFavoriteSong = (songId: string): void =>
  useFavoritesStore.getState().removeFromFavorites(songId);

export const toggleFavoriteSong = (song: Song): void =>
  useFavoritesStore.getState().toggleFavorite(song);

// ---- queueStore ----
export const clearPlaybackQueue = (): void => useQueueStore.getState().clearQueue();

export const appendSongToQueue = (song: Song): void => useQueueStore.getState().addToQueue(song);

export const insertSongNext = (song: Song): void => useQueueStore.getState().addToNext(song);

/** 曲库清理：同时移除队列与历史中的目标曲目，返回队列实际移除的条目数。 */
export function removeSongsFromQueue(songIds: Iterable<string>): number {
  const ids = new Set(songIds);
  const { queue, history } = useQueueStore.getState();
  const nextQueue = queue.filter((song) => !ids.has(song.id));
  const nextHistory = (history || []).filter((song) => !ids.has(song.id));
  useQueueStore.setState({ queue: nextQueue, history: nextHistory });
  return queue.length - nextQueue.length;
}

// ---- playlistStore ----
export const getPlaylistSongsSnapshot = (): Song[] => usePlaylistStore.getState().songs;

/** 曲库清理：批量移除并同步 filtered/recent/selected，返回剩余曲目数。 */
export function removeSongsFromPlaylist(songIds: Iterable<string>): number {
  const ids = new Set(songIds);
  const state = usePlaylistStore.getState();
  const songs = state.songs.filter((song) => !ids.has(song.id));
  const selectedSongIds = new Set(Array.from(state.selectedSongIds).filter((id) => !ids.has(id)));
  usePlaylistStore.setState({
    songs,
    filteredSongs: state.filteredSongs.filter((song) => !ids.has(song.id)),
    recentPlayed: state.recentPlayed.filter((song) => !ids.has(song.id)),
    selectedSongIds,
    selectedSong: state.selectedSong && ids.has(state.selectedSong.id) ? null : state.selectedSong,
  });
  return songs.length;
}

// ---- libraryHealthStore ----
export function refreshHealthReport(songs: Song[]): void {
  useLibraryHealthStore.getState().setHealthReport(generateHealthReport(songs));
}

// ---- visualizationStore ----
export const setVisualizationEffect = (effect: VisualizationEffect): void =>
  useVisualizationStore.getState().setCurrentEffect(effect);

// ---- sleepTimerStore ----
export function startSleepTimer(minutes: number): void {
  const timer = useSleepTimerStore.getState();
  timer.setTimer(minutes);
  timer.startTimer();
}

export const cancelSleepTimer = (): void => useSleepTimerStore.getState().cancelTimer();

// ---- useOfflineDownloadStore ----
export const enqueueSongDownload = (song: Song, quality?: string): Promise<void> =>
  useOfflineDownloadStore.getState().addDownload(song, quality);
