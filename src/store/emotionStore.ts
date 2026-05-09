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
  taggingStatus: {
    current: number;
    total: number;
    currentTitle: string;
    isStopping?: boolean;
  } | null;
  _isStopRequested: boolean;
  _abortController: AbortController | null;

  findSimilar: (songId: string, maxResults?: number) => EmotionPoint[];
  getQuadrantStats: () => { q1: number; q2: number; q3: number; q4: number; untagged: number };
  getSelectionAnalytics: () => {
    avgEnergy: number;
    avgValence: number;
    dominantQuadrant: string;
    spread: number;
  };

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
          realtimeCoordinates: { x: clampedX, y: clampedY },
        });

        debouncedSave(newMap);

        const { points } = get();
        if (points.length > 0) {
          const updatedPoints = points.map((p) =>
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
          const newPoints = songs
            .map((song) => {
              let coords = emotionMap[song.id];
              if (!coords) {
                let hash = 0;
                for (let i = 0; i < song.id.length; i++) {
                  hash = (Math.imul(31, hash) + song.id.charCodeAt(i)) | 0;
                }
                const randX = (Math.abs(hash) % 1000) / 500 - 1;
                const randY = (Math.abs(hash * 13) % 1000) / 500 - 1;
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
                isTagged: !!emotionMap[song.id],
              };
            })
            .sort((a, b) => (b.isTagged ? 1 : 0) - (a.isTagged ? 1 : 0));

          const pointCache = new Map(newPoints.map((p) => [p.id, { x: p.x, y: p.y }]));
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
          marqueeRect: null,
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
          .filter(
            (p) => p.title.toLowerCase().includes(lower) || p.artist.toLowerCase().includes(lower)
          )
          .map((p) => p.id);
        set({ searchQuery: query, searchResults: results });
      },

      setIsDragging: (isDragging) => set({ isDragging }),

      setDragPointId: (dragPointId) => set({ dragPointId }),

      autoTagSong: async (songId, signal) => {
        try {
          const { usePlaylistStore } = require("./playlistStore");
          const { useAIStore } = require("./aiStore");
          const aiStore = useAIStore.getState();
          if (!aiStore.isEnabled) return;
          const config = aiStore.configs.find((c: any) => c.id === aiStore.activeConfigId);
          const { songs } = usePlaylistStore.getState();
          const song = songs.find((s: any) => s.id === songId);

          if (!song || !config || !config.apiKey) {
            console.error("Missing song, config or API key", { song, config });
            const { toast } = require("@/components/shared/GlassToast");
            if (!config || !config.apiKey) toast.warning("未配置有效的 AI 接口");
            return;
          }

          const prompt = `你是一位资深的音乐考古学家与情感计算专家。
          请为这首音乐作品生成精确且【空间分布均衡】的情感坐标。
          
          作品信息：
          - 标题：${song.title}
          - 艺术家：${song.artist}
          
          坐标轴定义：
          1. Valence (v): [-1.0 到 1.0] 情感正向度。
          2. Energy (e): [-1.0 到 1.0] 物理能量强度。
          
          分布策略（追求自然均衡）：
          - 全空间利用：请务必利用好从中心 (0,0) 到角落 (1,1) 的所有空间。
          - 拒绝堆积：不要只给中间值，也不要只给极端值。
          - 情感匹配：如果歌曲情感平和、中立，请将其放在中心区域；如果情感强烈，请大胆推向边缘。
          - 视觉平衡：你的目标是让数千首歌在星图上形成一个自然的、充满活力的散点图，而不是一个实心的球或一个空心的环。
          
          输出 JSON 格式：{"v": float, "e": float, "d": string(12字以内描述)}`;

          const baseUrl = config.baseUrl.replace(/\/$/, "");
          const url = baseUrl.endsWith("/v1")
            ? `${baseUrl}/chat/completions`
            : `${baseUrl}/v1/chat/completions`;

          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.7,
              max_tokens: 200,
              response_format: { type: "json_object" },
            }),
            signal,
          });

          if (!response.ok) throw new Error(`API Error: ${response.status}`);

          const data = await response.json();
          let rawContent = data.choices[0].message.content.trim();

          try {
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found");

            // 2. 自然分布：直接使用 AI 产出的数值，保持其原始的情感比例
            // 不再进行强制对比度拉伸，以允许中间区域自然存在点位
            let v = Number(result.v ?? result.valence ?? 0);
            let e = Number(result.e ?? result.energy ?? 0);

            if (isNaN(v)) v = 0;
            if (isNaN(e)) e = 0;
            const d = String(result.d ?? result.description ?? "AI 暂无描述");

            const { points } = get();

            // 3. 智能避让：略微增加避让间距，防止点位看起来“堆在一起”
            const minDistance = 0.08;
            let iteration = 0;
            const idHash = songId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
            let angle = (idHash % 360) * (Math.PI / 180);

            while (iteration < 20) {
              const tooClose = points.some(
                (p) =>
                  p.id !== songId &&
                  p.isTagged &&
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

            get().saveSongEmotion(songId, v, e, d);
          } catch (parseError) {
            if ((parseError as any).name === "AbortError") return;
            console.warn("Parse Failed:", rawContent);
          }
        } catch (error) {
          if ((error as any).name === "AbortError") return;
          console.error("Auto-tagging failed:", error);
        }
      },

      autoTagBatch: async (songIds) => {
        const { useAIStore } = require("./aiStore");
        if (!useAIStore.getState().isEnabled) return;

        const { usePlaylistStore } = require("./playlistStore");
        const { songs } = usePlaylistStore.getState();
        const abortController = new AbortController();
        set({
          taggingStatus: { current: 0, total: songIds.length, currentTitle: "" },
          _isStopRequested: false,
          _abortController: abortController,
        });

        const CONCURRENCY = 3;
        let index = 0;
        let finished = 0;

        const runWorker = async () => {
          while (index < songIds.length && !get()._isStopRequested) {
            const currentIndex = index++;
            const songId = songIds[currentIndex];
            const { songs } = usePlaylistStore.getState();
            const song = songs.find((s: any) => s.id === songId);

            if (!song) {
              finished++;
              continue;
            }

            console.log(
              `[Batch Tagging] Processing ${currentIndex + 1}/${songIds.length}: ${song.title}`
            );
            set({
              taggingStatus: {
                ...get().taggingStatus!,
                currentTitle: song.title,
                current: finished,
              },
            });

            try {
              await get().autoTagSong(songId, abortController.signal);
            } catch (error) {
              console.error(`[Batch Tagging] Error tagging ${song.title}:`, error);
            } finally {
              finished++;
              set({ taggingStatus: { ...get().taggingStatus!, current: finished } });
            }
          }
        };

        const workers = Array.from({ length: Math.min(CONCURRENCY, songIds.length) }, () =>
          runWorker()
        );
        await Promise.all(workers);

        if (get()._isStopRequested) {
          set({ taggingStatus: { ...get().taggingStatus!, isStopping: true } });
          await new Promise((r) => setTimeout(r, 1000));
        }

        set({ taggingStatus: null });
      },

      findSimilar: (songId, maxResults = 10) => {
        const { points } = get();
        const target = points.find((p) => p.id === songId);
        if (!target) return [];

        return points
          .filter((p) => p.id !== songId)
          .map((p) => ({
            ...p,
            distance: Math.sqrt((p.x - target.x) ** 2 + (p.y - target.y) ** 2),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, maxResults)
          .map(({ distance, ...p }) => p);
      },

      getQuadrantStats: () => {
        const { points } = get();
        const stats = { q1: 0, q2: 0, q3: 0, q4: 0, untagged: 0 };
        points.forEach((p) => {
          if (!p.isTagged) {
            stats.untagged++;
            return;
          }
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
        const selected = points.filter((p) => selectedIds.includes(p.id));
        if (selected.length === 0) {
          return { avgEnergy: 0, avgValence: 0, dominantQuadrant: "-", spread: 0 };
        }
        const avgX = selected.reduce((s, p) => s + p.x, 0) / selected.length;
        const avgY = selected.reduce((s, p) => s + p.y, 0) / selected.length;
        const variance =
          selected.reduce((s, p) => s + (p.x - avgX) ** 2 + (p.y - avgY) ** 2, 0) / selected.length;
        const q = getQuadrant(avgX, avgY);
        return {
          avgEnergy: Math.round(avgY * 50 + 50),
          avgValence: Math.round(avgX * 50 + 50),
          dominantQuadrant: QUADRANT_LABELS[q] || q,
          spread: Math.round(Math.sqrt(variance) * 100),
        };
      },

      calculateDistance: (id1, id2) => {
        const { emotionMap, points } = get();
        const cache = (get() as any)._pointCache;

        const p1 = emotionMap[id1] || cache?.get(id1) || points.find((p) => p.id === id1);
        const p2 = emotionMap[id2] || cache?.get(id2) || points.find((p) => p.id === id2);

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
        brushRadius: state.brushRadius,
      }),
    }
  )
);
