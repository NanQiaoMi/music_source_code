"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

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
