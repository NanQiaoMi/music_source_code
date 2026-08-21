import { Song } from "@/types/song";

export interface RecommendationInputSnapshot {
  songs: Song[];
  emotion: { x: number; y: number };
}

export interface RecommendationInputDeps {
  getPlaylists: () => { songs?: Song[] };
  getEmotionTags: () => { realtimeCoordinates?: { x: number; y: number } | null };
  getHistory?: () => unknown;
}

export function collectRecommendationInputs(
  deps: RecommendationInputDeps
): RecommendationInputSnapshot {
  const playlistState = deps.getPlaylists();
  const emotionState = deps.getEmotionTags();
  const emotion = emotionState.realtimeCoordinates ?? { x: 0, y: 0 };

  return {
    songs: playlistState.songs ?? [],
    emotion: { x: emotion.x, y: emotion.y },
  };
}
