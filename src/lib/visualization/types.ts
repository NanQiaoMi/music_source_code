import type { VisualizationAudioSnapshot } from "./audioSnapshot";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";

export type EffectCategory = "particles" | "geometry" | "spectrum" | "physics" | "space" | "shapes";

export type ParameterMode = "basic" | "professional" | "expert";

export type ParameterType = "number" | "color" | "boolean" | "select" | "vector2" | "vector3";

// V8 effect implementations currently perform numeric/string operations directly on params.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EffectParameterValue = any;
export type EffectParameterMap = Record<string, EffectParameterValue>;
export type EffectParameterSet = Record<string, EffectParameterMap>;

export interface EffectAnimationKeyframe {
  time: number;
  parameters: EffectParameterMap;
}

export type RenderEngine = "canvas" | "webgl" | "auto";

// Private runtime buckets are intentionally loose until each effect declares its own state.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EffectRuntimeState = Record<string, any>;

export interface EffectParameterDefinition {
  id: string;
  name: string;
  type: ParameterType;
  mode: ParameterMode;
  min?: number;
  max?: number;
  step?: number;
  default: EffectParameterValue;
  options?: { label: string; value: EffectParameterValue }[];
  audioDriven?: {
    enabled: boolean;
    band: "bass" | "mid" | "treble" | "full";
    multiplier: number;
  };
}

export interface AudioData {
  frequencyData: Uint8Array;
  waveformData: Uint8Array;
  bass: number;
  mid: number;
  treble: number;
  full: number;
  isBeat: boolean;
  bpm: number;
}

export interface RenderContext {
  canvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;
  scene?: Scene;
  camera?: PerspectiveCamera;
  renderer?: WebGLRenderer;
  width: number;
  height: number;
  deltaTime: number;
  time: number;
  audioSnapshot?: VisualizationAudioSnapshot;
  private?: EffectRuntimeState;
}

export interface EffectPlugin {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  thumbnail?: string;
  preferredEngine: RenderEngine;
  parameters: EffectParameterDefinition[];
  private?: EffectRuntimeState;
  init: (ctx: RenderContext) => void;
  render: (ctx: RenderContext, audioData: AudioData, params: EffectParameterMap) => void;
  resize: (width: number, height: number) => void;
  destroy: (ctx?: RenderContext) => void;
}

export interface TransformParams {
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
}

export type PerformanceLevel = "low" | "medium" | "high" | "ultra";

export interface PerformanceConfig {
  level: PerformanceLevel;
  targetFPS: number;
  maxParticles: number;
  postProcessing: boolean;
  webglQuality: "low" | "medium" | "high" | "ultra";
}

export interface EffectPreset {
  id: string;
  name: string;
  description?: string;
  effectId: string;
  thumbnail?: string;
  tags: string[];
  author?: string;
  createdAt: number;
  updatedAt: number;
  isSystem: boolean;
  isFavorite: boolean;
  parameters: EffectParameterMap;
  audioDrivenConfig?: Record<string, EffectParameterValue>;
  animationKeyframes?: EffectAnimationKeyframe[];
}
