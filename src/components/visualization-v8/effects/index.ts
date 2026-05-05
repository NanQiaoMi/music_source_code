"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

// 导入所有特效实现
import { SpectrumV8Effect } from "./SpectrumV8";
import { WaveformV8Effect } from "./WaveformV8";
import { ParticleNebulaV8 } from "./ParticleNebulaV8";
import { ResonanceTotemV8 } from "./ResonanceTotemV8";
import { AudioCrystalV8Effect } from "./AudioCrystalV8";
import { AudioLiquidV8Effect } from "./AudioLiquidV8";
import { AudioPaintingV8Effect } from "./AudioPaintingV8";
import { AudioSculptureV8Effect } from "./AudioSculptureV8";
import { FractalGeometryV8Effect } from "./FractalGeometryV8";
import { KaleidoscopeV8 } from "./KaleidoscopeV8";
import { ParticleFlowFieldV8 } from "./ParticleFlowFieldV8";
import { ParticleVortexV8Effect } from "./ParticleVortexV8";
import { SpaceGridV8Effect } from "./SpaceGridV8";
import { SpectrumSpiralV8 } from "./SpectrumSpiralV8";
import { StarFieldV8Effect } from "./StarFieldV8";
import { TunnelFlightV8Effect } from "./TunnelFlightV8";
import { VibrationGeometryV8Effect } from "./VibrationGeometryV8";

export {
  SpectrumV8Effect,
  WaveformV8Effect,
  ParticleNebulaV8,
  ResonanceTotemV8,
  AudioCrystalV8Effect,
  AudioLiquidV8Effect,
  AudioPaintingV8Effect,
  AudioSculptureV8Effect,
  FractalGeometryV8Effect,
  KaleidoscopeV8,
  ParticleFlowFieldV8,
  ParticleVortexV8Effect,
  SpaceGridV8Effect,
  SpectrumSpiralV8,
  StarFieldV8Effect,
  TunnelFlightV8Effect,
  VibrationGeometryV8Effect
};

export const effectsRegistry: EffectPlugin[] = [];

const TRANSFORM_PARAMS: EffectParameterDefinition[] = [
  {
    id: "positionX",
    name: "水平位置",
    type: "number",
    mode: "professional",
    min: -1,
    max: 1,
    step: 0.01,
    default: 0
  },
  {
    id: "positionY",
    name: "垂直位置",
    type: "number",
    mode: "professional",
    min: -1,
    max: 1,
    step: 0.01,
    default: 0
  },
  {
    id: "scale",
    name: "缩放",
    type: "number",
    mode: "professional",
    min: 0.1,
    max: 3,
    step: 0.05,
    default: 1
  },
  {
    id: "rotation",
    name: "旋转",
    type: "number",
    mode: "expert",
    min: 0,
    max: 360,
    step: 1,
    default: 0
  }
];

function addTransformParameters(effect: EffectPlugin): EffectPlugin {
  return {
    ...effect,
    parameters: [...effect.parameters, ...TRANSFORM_PARAMS]
  };
}

export function registerEffect(effect: EffectPlugin) {
  if (!effectsRegistry.find(e => e.id === effect.id)) {
    effectsRegistry.push(addTransformParameters(effect));
  }
}

export function getEffectById(id: string): EffectPlugin | undefined {
  return effectsRegistry.find(e => e.id === id);
}

export function getAllEffects(): EffectPlugin[] {
  return [...effectsRegistry];
}

export function getEffectsByCategory(category: string): EffectPlugin[] {
  return effectsRegistry.filter(e => e.category === category);
}
