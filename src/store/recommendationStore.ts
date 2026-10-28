import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "@/types/song";
import {
  RecommendationContext,
  ScoredRecommendation,
  RecommendationParams,
  SongWithPlayCount,
  generateExplainableRecommendations,
  generateRecommendations,
} from "@/utils/recommendationLogic";
import { RecommendationInputSnapshot } from "@/lib/recommendation/inputs";
import type { PersistCandidate } from "@/lib/storage/quotaPolicy";
import { writeWithPolicy } from "@/lib/storage/quotaPolicy";
import { reportStorageDegraded } from "@/lib/storage/degradedNotifier";

interface RecommendationEnvelope {
  state?: {
    playHistory?: unknown[];
    recommendations?: unknown[];
    negativeFeedback?: unknown[];
    dismissedSongIds?: unknown[];
    lastGeneratedAt?: number;
  };
  version?: number;
}

function cloneRecommendationEnvelope(value: unknown): RecommendationEnvelope {
  return JSON.parse(JSON.stringify(value)) as RecommendationEnvelope;
}

function buildRecommendationCandidates(value: unknown): PersistCandidate[] {
  const candidates: PersistCandidate[] = [
    { value: JSON.stringify(cloneRecommendationEnvelope(value)) },
  ];

  const withoutRecommendations = cloneRecommendationEnvelope(value);
  if (withoutRecommendations.state) withoutRecommendations.state.recommendations = [];
  candidates.push({
    value: JSON.stringify(withoutRecommendations),
    degradedTo: "history-trimmed",
  });

  const trimmed = cloneRecommendationEnvelope(value);
  if (trimmed.state) {
    trimmed.state.recommendations = [];
    trimmed.state.playHistory = Array.isArray(trimmed.state.playHistory)
      ? trimmed.state.playHistory.slice(-100)
      : [];
    trimmed.state.negativeFeedback = Array.isArray(trimmed.state.negativeFeedback)
      ? trimmed.state.negativeFeedback.slice(-50)
      : [];
    trimmed.state.dismissedSongIds = Array.isArray(trimmed.state.dismissedSongIds)
      ? trimmed.state.dismissedSongIds.slice(-50)
      : [];
  }
  candidates.push({ value: JSON.stringify(trimmed), degradedTo: "pruned" });

  const minimal = cloneRecommendationEnvelope(value);
  if (minimal.state) {
    minimal.state.recommendations = [];
    minimal.state.playHistory = [];
    minimal.state.negativeFeedback = [];
    minimal.state.dismissedSongIds = [];
  }
  candidates.push({ value: JSON.stringify(minimal), degradedTo: "index-only" });

  return candidates;
}

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

function getAddedAt(song: Song): number | undefined {
  return "addedAt" in song && typeof song.addedAt === "number" ? song.addedAt : undefined;
}

interface RecommendationState {
  playHistory: PlayRecord[];
  recommendations: ScoredRecommendation[];
  dismissedSongIds: string[];
  lastGeneratedAt: number;
  isLoading: boolean;
  negativeFeedback: NegativeFeedback[];

  recordPlay: (song: Song) => void;
  getRecommendations: (inputs?: RecommendationInputSnapshot) => Song[];
  refreshRecommendations: (songs: Song[], context: RecommendationContext) => void;
  dismissRecommendation: (songId: string) => void;
  clearDismissedRecommendations: () => void;
  clearPlayHistory: () => void;
  getFavoriteArtists: () => { artist: string; playCount: number }[];
  addNegativeFeedback: (song: Song) => void;
  clearNegativeFeedback: () => void;
}

function applyNegativeFeedbackFilter(
  songs: SongWithPlayCount[],
  feedback: NegativeFeedback[]
): SongWithPlayCount[] {
  const negativeArtists = new Set(
    feedback.filter((item) => item.artist).map((item) => item.artist)
  );
  const negativeGenres = new Set(feedback.filter((item) => item.genre).map((item) => item.genre));

  return songs.filter((song) => {
    if (negativeArtists.has(song.artist)) return false;
    if (song.genre && negativeGenres.has(song.genre)) return false;
    return true;
  });
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

          return { playHistory: updatedHistory.slice(-200) };
        });
      },

      getRecommendations: (inputs) => {
        const { playHistory, recommendations, negativeFeedback } = get();
        if (recommendations.length > 0) {
          return recommendations.map((recommendation) => recommendation.song);
        }

        if (playHistory.length === 0 || !inputs) return [];

        const historyMap = new Map<string, number>();
        playHistory.forEach((record) => historyMap.set(record.songId, record.playCount));

        const songsWithCount: SongWithPlayCount[] = inputs.songs.map((song) => ({
          ...song,
          playCount: historyMap.get(song.id) || 0,
          lastPlayedAt: playHistory.find((record) => record.songId === song.id)?.lastPlayed,
          addedAt: getAddedAt(song),
        }));

        const filtered = applyNegativeFeedbackFilter(songsWithCount, negativeFeedback);
        const emotion: RecommendationParams = inputs.emotion;
        const generated = generateRecommendations(
          filtered.length > 0 ? filtered : songsWithCount,
          { x: emotion.x, y: emotion.y },
          20
        );
        return generated.length > 0
          ? generated
          : (filtered.length > 0 ? filtered : songsWithCount).slice(0, 20);
      },

      refreshRecommendations: (songs, context) => {
        const { dismissedSongIds } = get();
        const historyMap = new Map<string, number>();
        get().playHistory.forEach((record) => historyMap.set(record.songId, record.playCount));

        const songsWithCount: SongWithPlayCount[] = songs.map((song) => ({
          ...song,
          playCount: historyMap.get(song.id) || song.playCount || 0,
          lastPlayedAt: get().playHistory.find((record) => record.songId === song.id)?.lastPlayed,
          addedAt: getAddedAt(song),
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
          const existing = state.negativeFeedback.find((item) => item.songId === song.id);
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
      skipHydration: true,
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
          const outcome = writeWithPolicy(buildRecommendationCandidates(value), (serialized) => {
            localStorage.setItem(name, serialized);
          });
          if (!outcome.ok) {
            reportStorageDegraded({ key: name, reason: outcome.reason });
            return;
          }
          if (outcome.degradedTo) {
            reportStorageDegraded({ key: name, reason: "quota", degradedTo: outcome.degradedTo });
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
