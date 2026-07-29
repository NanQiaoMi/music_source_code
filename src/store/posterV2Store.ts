import { create } from "zustand";
import { PosterTemplate } from "@/utils/posterWorkshop";

export interface ElementTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  opacity: number;
  visible: boolean;
}

export const defaultTransform = (): ElementTransform => ({
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  angle: 0,
  opacity: 1,
  visible: true,
});

export interface PosterV2State {
  // Global Settings
  template: PosterTemplate;
  aspectRatio: number;
  primaryColor: string;
  blurIntensity: number;
  noiseOpacity: number;
  overlayDepth: number;

  // Global Lyrics Settings
  lyricColor: string;
  lyricFont: "sans" | "serif" | "mono" | "cursive";
  lyricAlignment: "left" | "center" | "right";
  textEffect: "none" | "shadow" | "glow" | "neon" | "stroke";
  lineSpacing: number;

  // Selected Lyrics (original text)
  selectedLyrics: string[];
  customLyricMode: boolean;
  customLyricText: string;

  // Elements Transforms
  coverTransform: ElementTransform;
  titleTransform: ElementTransform;
  artistTransform: ElementTransform;
  qrTransform: ElementTransform;
  brandTransform: ElementTransform;
  
  // Specific settings
  coverRadius: number;

  // Actions
  updateGlobal: (updates: Partial<Omit<PosterV2State, "updateGlobal" | "updateTransform" | "resetToTemplate">>) => void;
  updateTransform: (element: "cover" | "title" | "artist" | "qr" | "brand", updates: Partial<ElementTransform>) => void;
  resetToTemplate: (template: PosterTemplate) => void;
}

export const usePosterV2Store = create<PosterV2State>((set, get) => ({
  template: "apple",
  aspectRatio: 0.5625, // 9:16
  primaryColor: "#fa2d48",
  blurIntensity: 1.2,
  noiseOpacity: 0.2,
  overlayDepth: 0.4,
  
  lyricColor: "rgba(255,255,255,0.9)",
  lyricFont: "sans",
  lyricAlignment: "center",
  textEffect: "shadow",
  lineSpacing: 1.5,

  selectedLyrics: [],
  customLyricMode: false,
  customLyricText: "",

  coverTransform: defaultTransform(),
  titleTransform: defaultTransform(),
  artistTransform: defaultTransform(),
  qrTransform: defaultTransform(),
  brandTransform: defaultTransform(),

  coverRadius: 0.15,

  updateGlobal: (updates) => set((state) => ({ ...state, ...updates })),
  
  updateTransform: (element, updates) => set((state) => {
    const key = `${element}Transform` as keyof PosterV2State;
    return {
      [key]: {
        ...(state[key] as ElementTransform),
        ...updates
      }
    };
  }),

  resetToTemplate: (template) => {
    set({ template });
  }
}));
