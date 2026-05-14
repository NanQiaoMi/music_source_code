import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "@/types/song";
import {
  RecommendationContext,
  ScoredRecommendation,
  SongWithPlayCount,
  generateExplainableRecommendations,
  generateRecommendations,
} from "@/utils/recommendationLogic";
import { usePlaylistStore } from "./playlistStore";
import { useEmotionStore } from "./emotionStore";

interface PlayRecord {
  songId: string;
  title: string;
  artist: string;
  playCount: number;
  lastPlayed: number;
  genres?: string[];
}

interface NegativeFeedback {
  songId: string;
  artist?: string;
  genre?: string;
  createdAt: number;
}

interface RecommendationState {
  playHistory: PlayRecord[];
  recommendations: ScoredRecommendation[];
  dismissedSongIds: string[];
  lastGeneratedAt: number;
  isLoading: boolean;
  negativeFeedback: NegativeFeedback[];

  recordPlay: (song: Song) => void;
  getRecommendations: () => Song[];
  refreshRecommendations: (songs: Song[], context: RecommendationContext) => void;
  dismissRecommendation: (songId: string) => void;
  clearDismissedRecommendations: () => void;
  clearPlayHistory: () => void;
  getFavoriteArtists: () => { artist: string; playCount: number }[];
  addNegativeFeedback: (song: Song) => void;
  clearNegativeFeedback: () => void;
}

export const useRecommendationStore = create<RecommendationState>()(
  persist(
    (set, get) => ({
      playHistory: [],
      recommendations: [],
      dismissedSongIds: [],
      lastGeneratedAt: 0,
      isLoading: false,
      negativeFeedback: [],

      recordPlay: (song) => {
        set((state) => {
          const existingIndex = state.playHistory.findIndex((record) => record.songId === song.id);

          let updatedHistory: PlayRecord[];

          if (existingIndex >= 0) {
            updatedHistory = [...state.playHistory];
            updatedHistory[existingIndex] = {
              ...updatedHistory[existingIndex],
              playCount: updatedHistory[existingIndex].playCount + 1,
              lastPlayed: Date.now(),
            };
          } else {
            updatedHistory = [
              ...state.playHistory,
              {
                songId: song.id,
                title: song.title,
                artist: song.artist,
                playCount: 1,
                lastPlayed: Date.now(),
              },
            ];
          }

          const prunedHistory = updatedHistory.slice(-200);

          return { playHistory: prunedHistory };
        });
      },

      getRecommendations: () => {
        const { playHistory, recommendations } = get();
        if (recommendations.length > 0) {
          return recommendations.map((recommendation) => recommendation.song);
        }

        if (playHistory.length === 0) return [];

        const allSongs = usePlaylistStore.getState().songs;
        const emotion = useEmotionStore.getState().realtimeCoordinates || { x: 0, y: 0 };

        const historyMap = new Map<string, number>();
        playHistory.forEach((record) => {
          historyMap.set(record.songId, record.playCount);
        });

        const songsWithCount: SongWithPlayCount[] = allSongs.map((song) => ({
          ...song,
          playCount: historyMap.get(song.id) || 0,
          lastPlayedAt: playHistory.find((r) => r.songId === song.id)?.lastPlayed,
          addedAt: (song as any).addedAt,
        }));

        const { negativeFeedback } = get();
        const negArtists = new Set(negativeFeedback.filter((f) => f.artist).map((f) => f.artist!));
        const negGenres = new Set(negativeFeedback.filter((f) => f.genre).map((f) => f.genre!));
        const filtered = songsWithCount.filter((s) => {
          if (negArtists.has(s.artist)) return false;
          if (s.genre && negGenres.has(s.genre)) return false;
          return true;
        });
        return generateRecommendations(filtered.length > 0 ? filtered : songsWithCount, { x: emotion.x, y: emotion.y }, 20);
      },

      refreshRecommendations: (songs, context) => {
        const { dismissedSongIds } = get();
        const historyMap = new Map<string, number>();
        get().playHistory.forEach((record) => historyMap.set(record.songId, record.playCount));

        const songsWithCount: SongWithPlayCount[] = songs.map((song) => ({
          ...song,
          playCount: historyMap.get(song.id) || (song as SongWithPlayCount).playCount || 0,
          lastPlayedAt: get().playHistory.find((record) => record.songId === song.id)?.lastPlayed,
          addedAt: (song as SongWithPlayCount).addedAt,
        }));

        set({
          recommendations: generateExplainableRecommendations(
            songsWithCount,
            context,
            20,
            dismissedSongIds
          ),
          lastGeneratedAt: Date.now(),
        });
      },

      dismissRecommendation: (songId) =>
        set((state) => ({
          dismissedSongIds: state.dismissedSongIds.includes(songId)
            ? state.dismissedSongIds
            : [...state.dismissedSongIds, songId].slice(-100),
          recommendations: state.recommendations.filter((item) => item.song.id !== songId),
        })),

      clearDismissedRecommendations: () => set({ dismissedSongIds: [] }),

      clearPlayHistory: () => set({ playHistory: [] }),

      addNegativeFeedback: (song) => {
        set((state) => {
          const existing = state.negativeFeedback.find((f) => f.songId === song.id);
          if (existing) return state;
          const feedback: NegativeFeedback = {
            songId: song.id,
            artist: song.artist,
            genre: song.genre,
            createdAt: Date.now(),
          };
          return {
            negativeFeedback: [...state.negativeFeedback, feedback].slice(-200),
            recommendations: state.recommendations.filter((item) => item.song.id !== song.id),
          };
        });
      },
      clearNegativeFeedback: () => set({ negativeFeedback: [] }),
      getFavoriteArtists: () => {
        const { playHistory } = get();
        const artistCounts = new Map<string, number>();

        playHistory.forEach((record) => {
          const current = artistCounts.get(record.artist) || 0;
          artistCounts.set(record.artist, current + record.playCount);
        });

        return Array.from(artistCounts.entries())
          .map(([artist, playCount]) => ({ artist, playCount }))
          .sort((a, b) => b.playCount - a.playCount);
      },
    }),
    {
      name: "recommendation-storage",
      storage: {
        getItem: (name) => {
          try {
            const value = localStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (error) {
            if (error instanceof Error && error.name === "QuotaExceededError") {
              console.warn("Recommendation store quota exceeded, clearing play history...");
              try {
                const state = JSON.parse(JSON.stringify(value));
                if (state.state) {
                  // Aggressively clear history as it's not critical
                  state.state.playHistory = [];
                  state.state.recommendations = [];
                state.state.negativeFeedback = [];
                }
                localStorage.setItem(name, JSON.stringify(state));
              } catch (e) {
                console.error("Failed to save even empty recommendation store:", e);
              }
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
