import { create } from "zustand";
import { getAudioEffectsManager } from "@/lib/audio/AudioEffectsManager";

export type AudioEffectType =
  // 环境空间类
  | "autoPan"
  | "reverb"
  | "stereoWidener"
  // 时域变换类
  | "nightcore"
  | "vaporwave"
  | "cassette"
  | "tremolo"
  // 音质质感类
  | "underwater"
  | "vinyl"
  | "bitcrusher"
  | "talkie"
  | "megaBass"
  | "asmr"
  | "phaser"
  | "vocalRemove"
  | "cyberpunkDistortion"
  | "loFiPhone";

export interface AudioEffect {
  id: AudioEffectType;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  intensity: number;
}

interface AudioEffectsState {
  effects: Record<AudioEffectType, AudioEffect>;
  isEnabled: boolean;

  toggleEffect: (effectId: AudioEffectType) => void;
  setEffectIntensity: (effectId: AudioEffectType, intensity: number) => void;
  setIsEnabled: (enabled: boolean) => void;
  resetAllEffects: () => void;
}

const defaultEffects: Record<AudioEffectType, AudioEffect> = {
  // 环境空间类
  autoPan: {
    id: "autoPan",
    name: "8D 环绕音",
    category: "环境空间",
    description: "模拟声源在头部周围 360 度匀速旋转",
    enabled: false,
    intensity: 0.5,
  },
  reverb: {
    id: "reverb",
    name: "演唱会现场",
    category: "环境空间",
    description: "赋予音乐极长的余响和宽广的空间纵深感",
    enabled: false,
    intensity: 0.4,
  },
  stereoWidener: {
    id: "stereoWidener",
    name: "多维拓宽",
    category: "环境空间",
    description: "让声场突破耳机物理极限，产生强烈空间包围感",
    enabled: false,
    intensity: 0.5,
  },

  // 时域变换类
  nightcore: {
    id: "nightcore",
    name: "夜核模式",
    category: "时域变换",
    description: "速度加快 1.25x，音调自然升高",
    enabled: false,
    intensity: 1.0,
  },
  vaporwave: {
    id: "vaporwave",
    name: "蒸汽波",
    category: "时域变换",
    description: "速度降至 0.8x，配合低通滤波和混响",
    enabled: false,
    intensity: 0.8,
  },
  cassette: {
    id: "cassette",
    name: "卡带机失真",
    category: "时域变换",
    description: "模拟老式录音机马达不稳导致的音高抖动",
    enabled: false,
    intensity: 0.4,
  },
  tremolo: {
    id: "tremolo",
    name: "颤音冲浪",
    category: "时域变换",
    description: "快速颤动的波浪式音量变化，经典冲浪摇滚的灵魂",
    enabled: false,
    intensity: 0.5,
  },

  // 音质质感类
  underwater: {
    id: "underwater",
    name: "水下潜听",
    category: "音质质感",
    description: "极端低通滤波，模拟完全沉浸在水下的听觉体验",
    enabled: false,
    intensity: 0.7,
  },
  vinyl: {
    id: "vinyl",
    name: "黑胶唱片",
    category: "音质质感",
    description: "模拟 20 世纪初老旧唱机的窄频和砂砾感",
    enabled: false,
    intensity: 0.6,
  },
  bitcrusher: {
    id: "bitcrusher",
    name: "像素粉碎",
    category: "音质质感",
    description: "将现代高清音频转化为复古 8 位电子游戏音效",
    enabled: false,
    intensity: 0.5,
  },
  talkie: {
    id: "talkie",
    name: "对讲机",
    category: "音质质感",
    description: "窄频宽、高失真的广播音效",
    enabled: false,
    intensity: 0.6,
  },
  megaBass: {
    id: "megaBass",
    name: "深海巨响",
    category: "音质质感",
    description: "极大增强超低频的物理冲击力",
    enabled: false,
    intensity: 0.5,
  },
  asmr: {
    id: "asmr",
    name: "颅内高潮",
    category: "音质质感",
    description: "极度放大音频中的高频细节，如呼吸声、唇齿音",
    enabled: false,
    intensity: 0.6,
  },
  phaser: {
    id: "phaser",
    name: "极化迷幻",
    category: "音质质感",
    description: '产生标志性的"盘旋"和"极化"音色',
    enabled: false,
    intensity: 0.5,
  },
  vocalRemove: {
    id: "vocalRemove",
    name: "KTV 伴奏",
    category: "音质质感",
    description: "极大地降低中置人声的音量，保留两侧乐器声",
    enabled: false,
    intensity: 0.8,
  },
  cyberpunkDistortion: {
    id: "cyberpunkDistortion",
    name: "赛博失真",
    category: "时域变换",
    description: "高强度数字削峰失真，带来极具侵略性的赛博朋克工业音色",
    enabled: false,
    intensity: 0.7,
  },
  loFiPhone: {
    id: "loFiPhone",
    name: "低保真电台",
    category: "音质质感",
    description: "极度受限的频宽与模拟电磁干扰，犹如从旧收音机中传出的音乐",
    enabled: false,
    intensity: 0.8,
  },
};

export const useAudioEffectsStore = create<AudioEffectsState>((set, get) => ({
  effects: defaultEffects,
  isEnabled: true,

  toggleEffect: (effectId) => {
    const effectsManager = getAudioEffectsManager();
    const newEnabled = !get().effects[effectId].enabled;
    effectsManager.setEffectEnabled(effectId, newEnabled);

    set((state) => ({
      effects: {
        ...state.effects,
        [effectId]: {
          ...state.effects[effectId],
          enabled: newEnabled,
        },
      },
    }));
  },

  setEffectIntensity: (effectId, intensity) => {
    const effectsManager = getAudioEffectsManager();
    effectsManager.setEffectIntensity(effectId, intensity);

    set((state) => ({
      effects: {
        ...state.effects,
        [effectId]: {
          ...state.effects[effectId],
          intensity,
        },
      },
    }));
  },

  setIsEnabled: (enabled) => {
    if (!enabled) {
      const effectsManager = getAudioEffectsManager();
      effectsManager.reset();
    }
    set({ isEnabled: enabled });
  },

  resetAllEffects: () => {
    const effectsManager = getAudioEffectsManager();
    effectsManager.reset();

    set({
      effects: defaultEffects,
    });
  },
}));
