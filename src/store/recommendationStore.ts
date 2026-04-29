import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "./audioStore";

interface PlayRecord {
  songId: string;
  title: string;
  artist: string;
  playCount: number;
  lastPlayed: number;
  genres?: string[];
}

interface RecommendationState {
  playHistory: PlayRecord[];
  recommendations: Song[];
  isLoading: boolean;

  recordPlay: (song: Song) => void;
  getRecommendations: () => Song[];
  clearPlayHistory: () => void;
  getFavoriteArtists: () => { artist: string; playCount: number }[];
}

export const useRecommendationStore = create<RecommendationState>()(
  persist(
    (set, get) => ({
      playHistory: [],
      recommendations: [],
      isLoading: false,

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
        const { playHistory } = get();
        if (playHistory.length === 0) return [];

        const favoriteArtists = get().getFavoriteArtists();
        const recommendations: Song[] = [];

        favoriteArtists.slice(0, 3).forEach(({ artist }) => {
          const artistSongs = [
            { title: `${artist} - 推荐歌曲 1`, artist, album: "推荐专辑" },
            { title: `${artist} - 推荐歌曲 2`, artist, album: "精选集" },
          ];

          artistSongs.forEach((song, index) => {
            recommendations.push({
              id: `rec-${artist}-${index}`,
              title: song.title,
              artist: song.artist,
              album: song.album,
              duration: 240,
              cover: "/default-cover.svg",
              source: "recommendation",
            });
          });
        });

        return recommendations;
      },

      clearPlayHistory: () => set({ playHistory: [] }),

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
