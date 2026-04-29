export type EffectCategory = 
  | "particles" 
  | "geometry" 
  | "spectrum" 
  | "physics" 
  | "space" 
  | "shapes";

export type ParameterMode = "basic" | "professional" | "expert";

export type ParameterType = 
  | "number" 
  | "color" 
  | "boolean" 
  | "select" 
  | "vector2" 
  | "vector3";

export type RenderEngine = "canvas" | "webgl" | "auto";

export interface EffectParameterDefinition {
  id: string;
  name: string;
  type: ParameterType;
  mode: ParameterMode;
  min?: number;
  max?: number;
  step?: number;
  default: any;
  options?: { label: string; value: any }[];
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
  scene?: any;
  camera?: any;
  renderer?: any;
  width: number;
  height: number;
  deltaTime: number;
  time: number;
  private?: Record<string, any>;
}

export interface EffectPlugin {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  thumbnail?: string;
  preferredEngine: RenderEngine;
  parameters: EffectParameterDefinition[];
  private?: Record<string, any>;
  init: (ctx: RenderContext) => void;
  render: (ctx: RenderContext, audioData: AudioData, params: Record<string, any>) => void;
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
  parameters: Record<string, any>;
  audioDrivenConfig?: Record<string, any>;
  animationKeyframes?: any[];
}