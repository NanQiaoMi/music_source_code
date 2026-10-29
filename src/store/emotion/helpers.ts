// S6-12i: store-free emotion types and pure helpers live here so
// emotionStore.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The store re-exports the public emotion entry points, so its public surface is unchanged.

import { saveSongEmotions } from "@/services/metadataStorage";
import type { EmotionCoordinate, EmotionPoint } from "@/types/emotion";
import type { Song } from "@/types/song";

export interface AIConfig {
  id: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface EmotionCallbacks {
  getSongs: () => Song[];
  getAIConfig: () => { isEnabled: boolean; config: AIConfig | null };
  onEmotionSaved: (songId: string) => void;
}

let emotionCallbacks: EmotionCallbacks = {
  getSongs: () => [],
  getAIConfig: () => ({ isEnabled: false, config: null }),
  onEmotionSaved: () => {},
};

export function setEmotionCallbacks(callbacks: Partial<EmotionCallbacks>) {
  emotionCallbacks = { ...emotionCallbacks, ...callbacks };
}

export function getEmotionCallbacks(): EmotionCallbacks {
  return emotionCallbacks;
}

export interface EmotionState {
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
  initializePoints: (songs: Song[]) => void;

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

export function debounce<TArgs extends unknown[]>(
  func: (...args: TArgs) => void | Promise<void>,
  wait: number
): (...args: TArgs) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: TArgs) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const debouncedSave = debounce(async (emotions: Record<string, EmotionCoordinate>) => {
  await saveSongEmotions(emotions);
}, 1000);

export function getQuadrant(x: number, y: number): string {
  if (x >= 0 && y >= 0) return "Q1";
  if (x < 0 && y >= 0) return "Q2";
  if (x < 0 && y < 0) return "Q3";
  return "Q4";
}

export const QUADRANT_LABELS: Record<string, string> = {
  Q1: "高能明亮",
  Q2: "悲伤阴暗",
  Q3: "平静低沉",
  Q4: "欢快明亮",
};

export function buildEmotionPoints(
  songs: Song[],
  emotionMap: Record<string, EmotionCoordinate>
): EmotionPoint[] {
  return songs
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
        tags: song.genre ? [song.genre] : undefined,
        x: coords.x,
        y: coords.y,
        description: coords.description,
        isTagged: !!emotionMap[song.id],
      };
    })
    .sort((a, b) => (b.isTagged ? 1 : 0) - (a.isTagged ? 1 : 0));
}

export function buildEmotionPrompt(song: Song): string {
  return `Analyze this song and return an emotion coordinate as JSON only.
Song: ${song.title}
Artist: ${song.artist}

Coordinate rules:
- v/valence: -1.0 to 1.0
- e/energy: -1.0 to 1.0
- d/description: concise label within 12 characters

Use the full coordinate space naturally and avoid clustering every song near the center.
Return format: {"v": number, "e": number, "d": string}`;
}
