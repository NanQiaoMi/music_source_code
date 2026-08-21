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
