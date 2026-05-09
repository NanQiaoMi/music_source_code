import { create } from "zustand";
import { TotemKeyword, extractKeywords } from "@/utils/resonanceKeywords";
import { LyricLine } from "@/services/lyricsSearchService";

interface TotemState {
  allKeywords: TotemKeyword[];
  activeKeywords: TotemKeyword[];
  preloadedTextures: Record<string, ImageBitmap>;

  initializeForSong: (lyrics: LyricLine[]) => void;
  updateActiveKeywords: (currentTime: number) => void;
  addPreloadedTexture: (id: string, texture: ImageBitmap) => void;
  clear: () => void;
}

export const useTotemStore = create<TotemState>((set, get) => ({
  allKeywords: [],
  activeKeywords: [],
  preloadedTextures: {},

  initializeForSong: (lyrics) => {
    const keywords = extractKeywords(lyrics);
    set({
      allKeywords: keywords,
      activeKeywords: [],
      preloadedTextures: {},
    });
  },

  updateActiveKeywords: (currentTime) => {
    const { allKeywords } = get();

    // A keyword is "active" if it's within its window [startTime - 3s, startTime + duration]
    // The "burst" happens at startTime.
    const active = allKeywords.filter(
      (kw) => currentTime >= kw.startTime - 3 && currentTime <= kw.startTime + kw.duration
    );

    set({ activeKeywords: active });
  },

  addPreloadedTexture: (id, texture) => {
    set((state) => ({
      preloadedTextures: {
        ...state.preloadedTextures,
        [id]: texture,
      },
    }));
  },

  clear: () => set({ allKeywords: [], activeKeywords: [], preloadedTextures: {} }),
}));
