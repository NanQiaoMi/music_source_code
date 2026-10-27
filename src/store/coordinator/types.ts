/**
 * @deprecated 2026-10-21: unwired coordinator shell (0 imports outside this directory).
 * Kept for one release per AGENTS.md "不要删除不确定的代码"; do not import.
 * Replaced by the S6 domain use-cases + typed events (src/domain, src/lib/events).
 * Reference: docs/nbl/plans/2026-10-21-arch-perf-execution/S6-state-architecture.md
 */
import type { Song } from "@/types/song";

export interface AudioCoordinator {
  playSong(song: Song): void;
  appendAndPlay(songs: Song[]): void;
  stopPlayback(): void;
}

export interface QueueCoordinator {
  insertNext(song: Song): void;
  clearQueue(): Song[];
  handleQueueEnd(): void;
}

export interface EmotionCoordinator {
  getRecommendationsByEmotion(coords: { x: number; y: number }): Song[];
  createSmartPlaylist(baseSong: Song): Song[];
}
