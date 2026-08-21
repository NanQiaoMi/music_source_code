import { PosterTemplate } from "./posterWorkshop";
import { ElementTransform } from "@/store/posterV2Store";

export interface TemplateV2Preset {
  coverTransform: ElementTransform;
  titleTransform: ElementTransform;
  artistTransform: ElementTransform;
  qrTransform: ElementTransform;
  brandTransform: ElementTransform;
  aspectRatio: number;
  primaryColor: string;
  blurIntensity: number;
}

const defaultPresets: Record<PosterTemplate, TemplateV2Preset> = {
  apple: {
    coverTransform: { x: 100, y: 150, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true },
    titleTransform: { x: 100, y: 580, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true },
    artistTransform: { x: 100, y: 630, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.8, visible: true },
    qrTransform: { x: 450, y: 900, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.6, visible: true },
    brandTransform: { x: 50, y: 50, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.5, visible: true },
    aspectRatio: 0.5625, // 9:16
    primaryColor: "#000000",
    blurIntensity: 1.5,
  },
  spotify: {
    coverTransform: { x: 50, y: 300, scaleX: 1.5, scaleY: 1.5, angle: 0, opacity: 1, visible: true },
    titleTransform: { x: 50, y: 100, scaleX: 1.2, scaleY: 1.2, angle: 0, opacity: 1, visible: true },
    artistTransform: { x: 50, y: 150, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.8, visible: true },
    qrTransform: { x: 450, y: 900, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.6, visible: true },
    brandTransform: { x: 50, y: 900, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.5, visible: true },
    aspectRatio: 0.5625,
    primaryColor: "#1db954",
    blurIntensity: 0,
  },
  vinyl: {
    coverTransform: { x: 150, y: 200, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true },
    titleTransform: { x: 150, y: 700, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true },
    artistTransform: { x: 150, y: 750, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.8, visible: true },
    qrTransform: { x: 450, y: 900, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.6, visible: true },
    brandTransform: { x: 50, y: 50, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.5, visible: true },
    aspectRatio: 0.5625,
    primaryColor: "#222222",
    blurIntensity: 0.5,
  },
  minimal: {
    coverTransform: { x: 200, y: 200, scaleX: 0.8, scaleY: 0.8, angle: 0, opacity: 1, visible: true },
    titleTransform: { x: 200, y: 500, scaleX: 0.8, scaleY: 0.8, angle: 0, opacity: 1, visible: true },
    artistTransform: { x: 200, y: 530, scaleX: 0.8, scaleY: 0.8, angle: 0, opacity: 0.5, visible: true },
    qrTransform: { x: 450, y: 900, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.6, visible: true },
    brandTransform: { x: 50, y: 50, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.5, visible: true },
    aspectRatio: 0.5625,
    primaryColor: "#ffffff",
    blurIntensity: 0,
  },
  cassette: {
    coverTransform: { x: 100, y: 300, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true },
    titleTransform: { x: 100, y: 150, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true },
    artistTransform: { x: 100, y: 200, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.8, visible: true },
    qrTransform: { x: 450, y: 900, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.6, visible: true },
    brandTransform: { x: 50, y: 50, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.5, visible: true },
    aspectRatio: 0.5625,
    primaryColor: "#fcd34d",
    blurIntensity: 0.2,
  },
  gradient: {
    coverTransform: { x: 150, y: 250, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true },
    titleTransform: { x: 150, y: 650, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true },
    artistTransform: { x: 150, y: 700, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.8, visible: true },
    qrTransform: { x: 450, y: 900, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.6, visible: true },
    brandTransform: { x: 50, y: 50, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.5, visible: true },
    aspectRatio: 0.5625,
    primaryColor: "#a855f7",
    blurIntensity: 0,
  },
  aura: {
    coverTransform: { x: 150, y: 300, scaleX: 0.9, scaleY: 0.9, angle: 0, opacity: 1, visible: true },
    titleTransform: { x: 150, y: 100, scaleX: 1.1, scaleY: 1.1, angle: 0, opacity: 1, visible: true },
    artistTransform: { x: 150, y: 150, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.8, visible: true },
    qrTransform: { x: 450, y: 900, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.6, visible: true },
    brandTransform: { x: 50, y: 50, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.5, visible: true },
    aspectRatio: 0.5625,
    primaryColor: "#14b8a6",
    blurIntensity: 2,
  },
  cyberpunk: {
    coverTransform: { x: 100, y: 200, scaleX: 1.2, scaleY: 1.2, angle: 0, opacity: 1, visible: true },
    titleTransform: { x: 100, y: 750, scaleX: 1.5, scaleY: 1.5, angle: 0, opacity: 1, visible: true },
    artistTransform: { x: 100, y: 820, scaleX: 1.2, scaleY: 1.2, angle: 0, opacity: 0.8, visible: true },
    qrTransform: { x: 450, y: 900, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.6, visible: true },
    brandTransform: { x: 50, y: 50, scaleX: 1, scaleY: 1, angle: 0, opacity: 0.5, visible: true },
    aspectRatio: 0.5625,
    primaryColor: "#f43f5e",
    blurIntensity: 0,
  },
};

export const getTemplatePreset = (template: PosterTemplate): TemplateV2Preset => {
  return defaultPresets[template] || defaultPresets.apple;
};
