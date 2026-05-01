import { create } from "zustand";
import { persist } from "zustand/middleware";
import { saveSongEmotions, loadSongEmotions } from "@/services/metadataStorage";
import { EmotionPoint, EmotionCoordinate } from "@/types/emotion";

interface EmotionState {
  // Current playing song's interactive coordinates (e.g., from the radar)
  realtimeCoordinates: { x: number; y: number } | null;
  
  // All songs' emotion coordinates mapping (Source of Truth)
  emotionMap: Record<string, EmotionCoordinate>;
  
  // Flattened points for visualization
  points: EmotionPoint[];
  
  // Global/Ambient emotion state
  globalEmotion: EmotionCoordinate | null;
  
  // Selection and Path state
  selectedIds: string[];
  viewMode: "matrix" | "heatmap";
  isLassoActive: boolean;
  isCurveActive: boolean;
  lassoPath: { x: number; y: number }[];
  curvePath: { x: number; y: number }[];
  
  // Actions
  updateRealtimeCoordinates: (x: number, y: number) => void;
  saveSongEmotion: (songId: string, x: number, y: number) => void;
  setEmotionMap: (map: Record<string, EmotionCoordinate>) => void;
  initializeEmotions: () => Promise<void>;
  initializePoints: (songs: any[]) => void;
  
  setViewMode: (mode: "matrix" | "heatmap") => void;
  setLassoActive: (active: boolean) => void;
  setCurveActive: (active: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  setLassoPath: (path: { x: number; y: number }[]) => void;
  setCurvePath: (path: { x: number; y: number }[]) => void;
  setGlobalEmotion: (emotion: EmotionCoordinate) => void;
  
  calculateDistance: (id1: string, id2: string) => number;
  clearSelection: () => void;
}

// Simple debounce helper
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Debounced disk save function
const debouncedSave = debounce(async (emotions: Record<string, EmotionCoordinate>) => {
  await saveSongEmotions(emotions);
}, 1000);

export const useEmotionStore = create<EmotionState>()(
  persist(
    (set, get) => ({
      realtimeCoordinates: null,
      emotionMap: {},
      points: [],
      globalEmotion: { x: 0, y: 0 },
      selectedIds: [],
      viewMode: "matrix",
      isLassoActive: false,
      isCurveActive: false,
      lassoPath: [],
      curvePath: [],

      updateRealtimeCoordinates: (x, y) => {
        set({ realtimeCoordinates: { x, y } });
      },

      saveSongEmotion: (songId, x, y) => {
        const newMap = {
          ...get().emotionMap,
          [songId]: { x, y },
        };
        
        set({ 
          emotionMap: newMap,
          realtimeCoordinates: { x, y }
        });

        // Trigger debounced save to disk
        debouncedSave(newMap);
        
        // Update points if they exist
        const { points } = get();
        if (points.length > 0) {
          const updatedPoints = points.map(p => p.id === songId ? { ...p, x, y, isTagged: true } : p);
          // Re-sort to ensure the newly tagged song moves to the front for visualization
          updatedPoints.sort((a, b) => (b.isTagged ? 1 : 0) - (a.isTagged ? 1 : 0));
          set({ points: updatedPoints });
        }
        
        // Trigger smart playlist linkage (Async to prevent freezing)
        setTimeout(() => {
          try {
            const { useSmartPlaylistStore } = require("./smartPlaylistStore");
            const { usePlaylistStore } = require("./playlistStore");
            const allSongs = usePlaylistStore.getState().songs;
            useSmartPlaylistStore.getState().generateAllPlaylists(allSongs);
          } catch (e) {
            console.warn("Could not trigger smart playlist generation:", e);
          }
        }, 0);
      },

      setEmotionMap: (map) => {
        set({ emotionMap: map });
      },

      initializeEmotions: async () => {
        const savedEmotions = await loadSongEmotions();
        set({ emotionMap: savedEmotions });
      },

      initializePoints: (songs) => {
        const { emotionMap } = get();
        const newPoints = songs.map((song) => {
          let coords = emotionMap[song.id];
          if (!coords) {
            let hash = 0;
            for (let i = 0; i < song.id.length; i++) {
              hash = Math.imul(31, hash) + song.id.charCodeAt(i) | 0;
            }
            const randX = ((Math.abs(hash) % 1000) / 500) - 1;
            const randY = ((Math.abs(hash * 13) % 1000) / 500) - 1;
            coords = { x: randX, y: randY };
          }
          return {
            id: song.id,
            title: song.title || "Unknown Title",
            artist: song.artist || "Unknown Artist",
            x: coords.x,
            y: coords.y,
            isTagged: !!emotionMap[song.id]
          };
        }).sort((a, b) => (b.isTagged ? 1 : 0) - (a.isTagged ? 1 : 0));
        
        // Build a cache for O(1) lookups during crossfades
        const pointCache = new Map(newPoints.map(p => [p.id, { x: p.x, y: p.y }]));
        (get() as any)._pointCache = pointCache;
        
        set({ points: newPoints });
      },

      setViewMode: (viewMode) => set({ viewMode }),

      setLassoActive: (isLassoActive) =>
        set({ isLassoActive, isCurveActive: isLassoActive ? false : get().isCurveActive }),

      setCurveActive: (isCurveActive) =>
        set({ isCurveActive, isLassoActive: isCurveActive ? false : get().isLassoActive }),

      setSelectedIds: (selectedIds) => set({ selectedIds }),

      setLassoPath: (lassoPath) => set({ lassoPath }),

      setCurvePath: (curvePath) => set({ curvePath }),

      setGlobalEmotion: (globalEmotion) => set({ globalEmotion }),
          
      calculateDistance: (id1, id2) => {
        const { emotionMap, points } = get();
        const cache = (get() as any)._pointCache;
        
        // Fast O(1) lookup
        const p1 = emotionMap[id1] || (cache?.get(id1)) || points.find(p => p.id === id1);
        const p2 = emotionMap[id2] || (cache?.get(id2)) || points.find(p => p.id === id2);
        
        if (!p1 || !p2) return 0;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
      },

      clearSelection: () => set({ selectedIds: [], lassoPath: [], curvePath: [] }),
    }),
    {
      name: "vibe-emotion-store-v2",
      partialize: (state) => ({ 
        emotionMap: state.emotionMap,
        points: state.points 
      }),
    }
  )
);
