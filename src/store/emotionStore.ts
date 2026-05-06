import { create } from "zustand";
import { persist } from "zustand/middleware";
import { saveSongEmotions, loadSongEmotions } from "@/services/metadataStorage";
import { EmotionPoint, EmotionCoordinate } from "@/types/emotion";

interface EmotionState {
  realtimeCoordinates: { x: number; y: number } | null;
  emotionMap: Record<string, EmotionCoordinate>;
  points: EmotionPoint[];
  globalEmotion: EmotionCoordinate | null;

  selectedIds: string[];
  viewMode: "matrix" | "heatmap";
  selectionMode: "lasso" | "marquee" | "brush" | "none";
  lassoPath: { x: number; y: number }[];
  marqueeRect: { x1: number; y1: number; x2: number; y2: number } | null;
  brushRadius: number;

  hoveredPointId: string | null;
  searchQuery: string;
  searchResults: string[];
  isDragging: boolean;
  dragPointId: string | null;

  updateRealtimeCoordinates: (x: number, y: number) => void;
  saveSongEmotion: (songId: string, x: number, y: number, description?: string) => void;
  setEmotionMap: (map: Record<string, EmotionCoordinate>) => void;
  initializeEmotions: () => Promise<void>;
  initializePoints: (songs: any[]) => void;

  setViewMode: (mode: "matrix" | "heatmap") => void;
  setSelectionMode: (mode: "lasso" | "marquee" | "brush" | "none") => void;
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setLassoPath: (path: { x: number; y: number }[]) => void;
  setMarqueeRect: (rect: { x1: number; y1: number; x2: number; y2: number } | null) => void;
  setBrushRadius: (radius: number) => void;
  setGlobalEmotion: (emotion: EmotionCoordinate) => void;

  setHoveredPointId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setIsDragging: (dragging: boolean) => void;
  setDragPointId: (id: string | null) => void;
  
  autoTagSong: (songId: string, signal?: AbortSignal) => Promise<void>;
  autoTagBatch: (songIds: string[]) => Promise<void>;
  stopTagging: () => void;
  taggingStatus: { current: number; total: number; currentTitle: string; isStopping?: boolean } | null;
  _isStopRequested: boolean;
  _abortController: AbortController | null;

  findSimilar: (songId: string, maxResults?: number) => EmotionPoint[];
  getQuadrantStats: () => { q1: number; q2: number; q3: number; q4: number; untagged: number };
  getSelectionAnalytics: () => { avgEnergy: number; avgValence: number; dominantQuadrant: string; spread: number };

  calculateDistance: (id1: string, id2: string) => number;
  clearSelection: () => void;
}

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

const debouncedSave = debounce(async (emotions: Record<string, EmotionCoordinate>) => {
  await saveSongEmotions(emotions);
}, 1000);

function getQuadrant(x: number, y: number): string {
  if (x >= 0 && y >= 0) return "Q1";
  if (x < 0 && y >= 0) return "Q2";
  if (x < 0 && y < 0) return "Q3";
  return "Q4";
}

const QUADRANT_LABELS: Record<string, string> = {
  Q1: "高亢激昂",
  Q2: "悲伤阴暗",
  Q3: "平静低沉",
  Q4: "欢快明亮",
};

export const useEmotionStore = create<EmotionState>()(
  persist(
    (set, get) => ({
      realtimeCoordinates: null,
      emotionMap: {},
      points: [],
      globalEmotion: { x: 0, y: 0 },
      selectedIds: [],
      viewMode: "matrix",
      selectionMode: "none",
      lassoPath: [],
      marqueeRect: null,
      brushRadius: 40,
      hoveredPointId: null,
      searchQuery: "",
      searchResults: [],
      isDragging: false,
      dragPointId: null,
      taggingStatus: null,
      _isStopRequested: false,
      _abortController: null,
      
      stopTagging: () => {
        set({ _isStopRequested: true });
        const { _abortController } = get();
        if (_abortController) _abortController.abort();
      },

      updateRealtimeCoordinates: (x, y) => {
        set({ realtimeCoordinates: { x, y } });
      },

      saveSongEmotion: (songId, x, y, description) => {
        const clampedX = Math.max(-1, Math.min(1, x));
        const clampedY = Math.max(-1, Math.min(1, y));
        const newMap = {
          ...get().emotionMap,
          [songId]: { x: clampedX, y: clampedY, description },
        };
 
        set({
          emotionMap: newMap,
          realtimeCoordinates: { x: clampedX, y: clampedY }
        });
 
        debouncedSave(newMap);
 
        const { points } = get();
        if (points.length > 0) {
          const updatedPoints = points.map(p =>
            p.id === songId ? { ...p, x: clampedX, y: clampedY, description, isTagged: true } : p
          );
          updatedPoints.sort((a, b) => (b.isTagged ? 1 : 0) - (a.isTagged ? 1 : 0));
          set({ points: updatedPoints });
        }

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
        try {
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
              cover: song.cover,
              x: coords.x,
              y: coords.y,
              description: coords.description,
              isTagged: !!emotionMap[song.id]
            };
          }).sort((a, b) => (b.isTagged ? 1 : 0) - (a.isTagged ? 1 : 0));

          const pointCache = new Map(newPoints.map(p => [p.id, { x: p.x, y: p.y }]));
          (get() as any)._pointCache = pointCache;

          set({ points: newPoints });
        } catch (error) {
          console.error("Critical error in initializePoints:", error);
        }
      },

      setViewMode: (viewMode) => set({ viewMode }),

      setSelectionMode: (selectionMode) =>
        set({
          selectionMode,
          lassoPath: [],
          marqueeRect: null
        }),

      setSelectedIds: (ids) => {
        if (typeof ids === "function") {
          set({ selectedIds: ids(get().selectedIds) });
        } else {
          set({ selectedIds: ids });
        }
      },

      setLassoPath: (lassoPath) => set({ lassoPath }),

      setMarqueeRect: (marqueeRect) => set({ marqueeRect }),

      setBrushRadius: (brushRadius) => set({ brushRadius }),

      setGlobalEmotion: (globalEmotion) => set({ globalEmotion }),

      setHoveredPointId: (hoveredPointId) => set({ hoveredPointId }),

      setSearchQuery: (query) => {
        const { points } = get();
        if (!query.trim()) {
          set({ searchQuery: query, searchResults: [] });
          return;
        }
        const lower = query.toLowerCase();
        const results = points
          .filter(p =>
            p.title.toLowerCase().includes(lower) ||
            p.artist.toLowerCase().includes(lower)
          )
          .map(p => p.id);
        set({ searchQuery: query, searchResults: results });
      },

      setIsDragging: (isDragging) => set({ isDragging }),

      setDragPointId: (dragPointId) => set({ dragPointId }),
      
      autoTagSong: async (songId, signal) => {
        try {
          const { usePlaylistStore } = require("./playlistStore");
          const { useAIStore } = require("./aiStore");
          const aiStore = useAIStore.getState();
          const config = aiStore.configs.find(c => c.id === aiStore.activeConfigId);
          const { songs } = usePlaylistStore.getState();
          const song = songs.find(s => s.id === songId);
          
          if (!song || !config || !config.apiKey) {
            console.error("Missing song or API key");
            return;
          }

          const prompt = `Task: Objective Music Emotion Mapping.
          Title: ${song.title} | Artist: ${song.artist}
          
          Analyze the track based on its objective musical properties:
          - Valence: Emotional positivity (-1.0 to 1.0)
          - Energy: Intensity/Arousal (-1.0 to 1.0)
          - Description: A brief poetic mood summary.
          
          Requirement: Output JSON {"v", "e", "d"}. Be as precise and neutral as possible.`;

          const baseUrl = config.baseUrl.replace(/\/$/, "");
          const url = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.7,
              max_tokens: 200,
              response_format: { type: "json_object" }
            }),
            signal 
          });

          if (!response.ok) throw new Error(`API Error: ${response.status}`);
          
          const data = await response.json();
          let rawContent = data.choices[0].message.content.trim();
          
          try {
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found");
            
            const result = JSON.parse(jsonMatch[0]);
            
            // 1. 获取库均值，仅用于中心化校准
            const { points } = get();
            const taggedPoints = points.filter(p => p.isTagged);
            let biasV = 0, biasE = 0;
            if (taggedPoints.length > 10) {
              biasV = taggedPoints.reduce((acc, p) => acc + p.x, 0) / taggedPoints.length;
              biasE = taggedPoints.reduce((acc, p) => acc + p.y, 0) / taggedPoints.length;
            }

            // 2. 纯净坐标 (AI 原始值 - 库偏好)
            let v = Number(result.v ?? result.valence ?? 0) - biasV;
            let e = Number(result.e ?? result.energy ?? 0) - biasE;
            
            if (isNaN(v)) v = 0; if (isNaN(e)) e = 0;
            const d = String(result.d ?? result.description ?? "AI 暂无描述");

            // 3. 极简螺旋避让 (仅解决重叠)
            const minDistance = 0.05; 
            let iteration = 0;
            const idHash = songId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            let angle = (idHash % 360) * (Math.PI / 180);
            
            while (iteration < 20) {
              const tooClose = points.some(p => 
                p.id !== songId && p.isTagged && 
                Math.sqrt((p.x - v) ** 2 + (p.y - e) ** 2) < minDistance
              );
              if (!tooClose) break;
              v += Math.cos(angle) * 0.02;
              e += Math.sin(angle) * 0.02;
              angle += 2.4; 
              iteration++;
            }

            v = Math.max(-1, Math.min(1, v));
            e = Math.max(-1, Math.min(1, e));
            
            console.log(`[AI-Pure] ${song.title} -> v:${v.toFixed(3)}, e:${e.toFixed(3)}`);
            get().saveSongEmotion(songId, v, e, d);
          } catch (parseError) {
            if ((parseError as any).name === 'AbortError') return;
            console.warn("Parse Failed:", rawContent);
          }
        } catch (error) {
          if ((error as any).name === 'AbortError') {
            console.log("[AI-Abort] Request cancelled by user");
            return;
          }
          console.error("Auto-tagging failed:", error);
        }
      },

      autoTagBatch: async (songIds) => {
        const { songs } = require("./playlistStore").usePlaylistStore.getState();
        const abortController = new AbortController();
        set({ 
          taggingStatus: { current: 0, total: songIds.length, currentTitle: "" }, 
          _isStopRequested: false,
          _abortController: abortController 
        });

        const CONCURRENCY = 3; 
        let index = 0;
        let finished = 0;

        const runWorker = async () => {
          while (index < songIds.length && !get()._isStopRequested) {
            const currentIndex = index++;
            const songId = songIds[currentIndex];
            const song = songs.find((s: any) => s.id === songId);
            
            if (song) {
              set({ taggingStatus: { ...get().taggingStatus!, currentTitle: song.title } });
              try {
                await get().autoTagSong(songId, abortController.signal);
              } catch (e) {
                if ((e as any).name === 'AbortError') break;
                console.error(`Failed to tag ${song.title}:`, e);
              }
            }
            
            finished++;
            set({ taggingStatus: { ...get().taggingStatus!, current: finished } });
            
            // 并发时稍作停顿，避免请求过于密集
            await new Promise(r => setTimeout(r, 200));
          }
        };

        // 启动并发 Worker 池
        const workers = Array.from({ length: Math.min(CONCURRENCY, songIds.length) }, () => runWorker());
        await Promise.all(workers);

        if (get()._isStopRequested) {
          set({ taggingStatus: { ...get().taggingStatus!, isStopping: true } });
          await new Promise(r => setTimeout(r, 1000));
        }

        set({ taggingStatus: null });
      },

      findSimilar: (songId, maxResults = 10) => {
        const { points } = get();
        const target = points.find(p => p.id === songId);
        if (!target) return [];

        return points
          .filter(p => p.id !== songId)
          .map(p => ({
            ...p,
            distance: Math.sqrt((p.x - target.x) ** 2 + (p.y - target.y) ** 2)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, maxResults)
          .map(({ distance, ...p }) => p);
      },

      getQuadrantStats: () => {
        const { points } = get();
        const stats = { q1: 0, q2: 0, q3: 0, q4: 0, untagged: 0 };
        points.forEach(p => {
          if (!p.isTagged) { stats.untagged++; return; }
          const q = getQuadrant(p.x, p.y);
          if (q === "Q1") stats.q1++;
          else if (q === "Q2") stats.q2++;
          else if (q === "Q3") stats.q3++;
          else stats.q4++;
        });
        return stats;
      },

      getSelectionAnalytics: () => {
        const { points, selectedIds } = get();
        const selected = points.filter(p => selectedIds.includes(p.id));
        if (selected.length === 0) {
          return { avgEnergy: 0, avgValence: 0, dominantQuadrant: "-", spread: 0 };
        }
        const avgX = selected.reduce((s, p) => s + p.x, 0) / selected.length;
        const avgY = selected.reduce((s, p) => s + p.y, 0) / selected.length;
        const variance = selected.reduce((s, p) => s + (p.x - avgX) ** 2 + (p.y - avgY) ** 2, 0) / selected.length;
        const q = getQuadrant(avgX, avgY);
        return {
          avgEnergy: Math.round(avgY * 50 + 50),
          avgValence: Math.round(avgX * 50 + 50),
          dominantQuadrant: QUADRANT_LABELS[q] || q,
          spread: Math.round(Math.sqrt(variance) * 100)
        };
      },

      calculateDistance: (id1, id2) => {
        const { emotionMap, points } = get();
        const cache = (get() as any)._pointCache;

        const p1 = emotionMap[id1] || (cache?.get(id1)) || points.find(p => p.id === id1);
        const p2 = emotionMap[id2] || (cache?.get(id2)) || points.find(p => p.id === id2);

        if (!p1 || !p2) return 0;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
      },

      clearSelection: () => set({ selectedIds: [], lassoPath: [], marqueeRect: null }),
    }),
    {
      name: "vibe-emotion-store-v2",
      partialize: (state) => ({
        emotionMap: state.emotionMap,
        viewMode: state.viewMode,
        selectionMode: state.selectionMode,
        brushRadius: state.brushRadius
      }),
    }
  )
);
