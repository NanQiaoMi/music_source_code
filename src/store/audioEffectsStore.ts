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

export interface EffectPreset {
  id: string;
  name: string;
  icon: string;
  effects: Partial<Record<AudioEffectType, { enabled: boolean; intensity: number }>>;
  xy?: { x: number; y: number };
}

export interface EffectScene {
  id: string;
  nameZh: string;
  icon: string;
  gradient: string;
  description: string;
  effects: Partial<Record<AudioEffectType, { enabled: boolean; intensity: number }>>;
  xy: { x: number; y: number };
}

export const EFFECT_SCENES: EffectScene[] = [
  {
    id: "late-night-radio",
    nameZh: "深夜电台",
    icon: "🌙",
    gradient: "from-indigo-600 to-purple-800",
    description: "温暖的 Lo-Fi 质感，适合深夜独处",
    effects: {
      loFiPhone: { enabled: true, intensity: 0.6 },
      reverb: { enabled: true, intensity: 0.3 },
      vinyl: { enabled: true, intensity: 0.4 },
    },
    xy: { x: 0.3, y: 0.7 },
  },
  {
    id: "space-walk",
    nameZh: "太空漫游",
    icon: "🚀",
    gradient: "from-cyan-500 to-blue-700",
    description: "失重感的太空漂浮体验",
    effects: {
      reverb: { enabled: true, intensity: 0.8 },
      stereoWidener: { enabled: true, intensity: 0.7 },
      autoPan: { enabled: true, intensity: 0.3 },
      phaser: { enabled: true, intensity: 0.4 },
    },
    xy: { x: 0.8, y: 0.8 },
  },
  {
    id: "concert-hall",
    nameZh: "演唱会现场",
    icon: "🎤",
    gradient: "from-pink-500 to-red-600",
    description: "万人演唱会的震撼空间感",
    effects: {
      reverb: { enabled: true, intensity: 0.7 },
      megaBass: { enabled: true, intensity: 0.6 },
      stereoWidener: { enabled: true, intensity: 0.5 },
    },
    xy: { x: 0.6, y: 0.9 },
  },
  {
    id: "retro-arcade",
    nameZh: "复古街机",
    icon: "🕹️",
    gradient: "from-lime-400 to-green-600",
    description: "8-bit 像素游戏厅的怀旧感",
    effects: {
      bitcrusher: { enabled: true, intensity: 0.6 },
      tremolo: { enabled: true, intensity: 0.3 },
    },
    xy: { x: 0.2, y: 0.3 },
  },
  {
    id: "cyberpunk-city",
    nameZh: "赛博都市",
    icon: "🌃",
    gradient: "from-yellow-400 to-red-600",
    description: "霓虹灯下的数字失真未来感",
    effects: {
      cyberpunkDistortion: { enabled: true, intensity: 0.6 },
      stereoWidener: { enabled: true, intensity: 0.4 },
      autoPan: { enabled: true, intensity: 0.2 },
    },
    xy: { x: 0.7, y: 0.4 },
  },
  {
    id: "underwater-deep",
    nameZh: "深海潜行",
    icon: "🌊",
    gradient: "from-blue-400 to-indigo-700",
    description: "深海压力下的沉闷共鸣",
    effects: {
      underwater: { enabled: true, intensity: 0.8 },
      megaBass: { enabled: true, intensity: 0.4 },
    },
    xy: { x: 0.2, y: 0.9 },
  },
  {
    id: "vaporwave-sunset",
    nameZh: "蒸汽波黄昏",
    icon: "🌅",
    gradient: "from-violet-500 to-pink-600",
    description: "80 年代复古未来的梦幻氛围",
    effects: {
      vaporwave: { enabled: true, intensity: 0.7 },
      reverb: { enabled: true, intensity: 0.4 },
      stereoWidener: { enabled: true, intensity: 0.3 },
    },
    xy: { x: 0.4, y: 0.6 },
  },
  {
    id: "asmr-whisper",
    nameZh: "颅内低语",
    icon: "🎧",
    gradient: "from-fuchsia-500 to-pink-500",
    description: "放大每一个细微的呼吸和唇齿音",
    effects: {
      asmr: { enabled: true, intensity: 0.7 },
      reverb: { enabled: true, intensity: 0.2 },
    },
    xy: { x: 0.5, y: 0.2 },
  },
  {
    id: "k-mode",
    nameZh: "KTV 模式",
    icon: "🎵",
    gradient: "from-pink-400 to-rose-500",
    description: "去人声 + 混响，变身 K 歌之王",
    effects: {
      vocalRemove: { enabled: true, intensity: 0.8 },
      reverb: { enabled: true, intensity: 0.4 },
      megaBass: { enabled: true, intensity: 0.3 },
    },
    xy: { x: 0.5, y: 0.5 },
  },
  {
    id: "cassette-tape",
    nameZh: "卡带时光机",
    icon: "📼",
    gradient: "from-amber-500 to-yellow-600",
    description: "90 年代随身听的温暖磁带质感",
    effects: {
      cassette: { enabled: true, intensity: 0.5 },
      vinyl: { enabled: true, intensity: 0.3 },
    },
    xy: { x: 0.3, y: 0.4 },
  },
];


interface AudioEffectsState {
  effects: Record<AudioEffectType, AudioEffect>;
  isEnabled: boolean;

  toggleEffect: (effectId: AudioEffectType) => void;
  setEffectIntensity: (effectId: AudioEffectType, intensity: number) => void;
  setIsEnabled: (enabled: boolean) => void;
  resetAllEffects: () => void;
  activeScene: string | null;
  applyScene: (sceneId: string) => void;
  clearScene: () => void;
  randomize: () => void;
  shuffleIntensity: () => void;
  xyX: number;
  xyY: number;
  setXY: (x: number, y: number) => void;
  savedPresets: EffectPreset[];
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  morphToScene: (sceneId: string, duration?: number) => void;
  isMorphing: boolean;
  lfoEnabled: boolean;
  lfoSpeed: number;
  lfoDepth: number;
  toggleLFO: () => void;
  setLFOSpeed: (speed: number) => void;
  setLFODepth: (depth: number) => void;
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
  activeScene: null,
  xyX: 0.5,
  xyY: 0.5,
  savedPresets: [],

    applyScene: (sceneId) => {
      const scene = EFFECT_SCENES.find((s) => s.id === sceneId);
      if (!scene) return;
      const effectsManager = getAudioEffectsManager();
      const newEffects = { ...get().effects } as Record<AudioEffectType, AudioEffect>;
      Object.keys(newEffects).forEach((key) => {
        const id = key as AudioEffectType;
        newEffects[id] = { ...newEffects[id], enabled: false };
        effectsManager.setEffectEnabled(id, false);
      });
      Object.entries(scene.effects).forEach(([effectId, config]) => {
        if (config) {
          const id = effectId as AudioEffectType;
          newEffects[id] = { ...newEffects[id], enabled: config.enabled, intensity: config.intensity };
          effectsManager.setEffectEnabled(id, config.enabled);
          effectsManager.setEffectIntensity(id, config.intensity);
        }
      });
      set({ effects: newEffects, activeScene: sceneId, xyX: scene.xy.x, xyY: scene.xy.y });
    },

    clearScene: () => {
      const effectsManager = getAudioEffectsManager();
      effectsManager.reset();
      set({ activeScene: null, xyX: 0.5, xyY: 0.5 });
    },

    randomize: () => {
      const effectsManager = getAudioEffectsManager();
      const effectTypes = Object.keys(get().effects) as AudioEffectType[];
      const newEffects = { ...get().effects };
      const count = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...effectTypes].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, count);
      effectTypes.forEach((id) => {
        const shouldEnable = picked.includes(id);
        const intensity = shouldEnable ? 0.3 + Math.random() * 0.5 : 0;
        newEffects[id] = { ...newEffects[id], enabled: shouldEnable, intensity };
        effectsManager.setEffectEnabled(id, shouldEnable);
        if (shouldEnable) effectsManager.setEffectIntensity(id, intensity);
      });
      set({ effects: newEffects, activeScene: null, xyX: Math.random(), xyY: Math.random() });
    },

    shuffleIntensity: () => {
      const effectsManager = getAudioEffectsManager();
      const newEffects = { ...get().effects };
      Object.keys(newEffects).forEach((key) => {
        const id = key as AudioEffectType;
        if (newEffects[id].enabled) {
          const intensity = 0.2 + Math.random() * 0.7;
          newEffects[id] = { ...newEffects[id], intensity };
          effectsManager.setEffectIntensity(id, intensity);
        }
      });
      set({ effects: newEffects });
    },

    setXY: (x, y) => {
      const effectsManager = getAudioEffectsManager();
      const effects = get().effects;
      if (effects.stereoWidener.enabled) effectsManager.setEffectIntensity('stereoWidener', x);
      if (effects.reverb.enabled) effectsManager.setEffectIntensity('reverb', y);
      set({ xyX: x, xyY: y });
    },

    savePreset: (name) => {
      const preset: EffectPreset = {
        id: `preset-${Date.now()}`,
        name,
        icon: "\u2B50",
        effects: Object.fromEntries(
          Object.entries(get().effects)
            .filter(([, v]) => v.enabled)
            .map(([k, v]) => [k, { enabled: v.enabled, intensity: v.intensity }])
        ),
        xy: { x: get().xyX, y: get().xyY },
      };
      set((state) => ({ savedPresets: [...state.savedPresets, preset] }));
    },

    loadPreset: (presetId) => {
      const preset = get().savedPresets.find((p) => p.id === presetId);
      if (!preset) return;
      const effectsManager = getAudioEffectsManager();
      const newEffects = { ...get().effects };
      Object.keys(newEffects).forEach((key) => {
        const id = key as AudioEffectType;
        newEffects[id] = { ...newEffects[id], enabled: false };
        effectsManager.setEffectEnabled(id, false);
      });
      Object.entries(preset.effects).forEach(([effectId, config]) => {
        if (config) {
          const id = effectId as AudioEffectType;
          newEffects[id] = { ...newEffects[id], enabled: config.enabled, intensity: config.intensity };
          effectsManager.setEffectEnabled(id, config.enabled);
          effectsManager.setEffectIntensity(id, config.intensity);
        }
      });
      set({ effects: newEffects, activeScene: null, xyX: preset.xy?.x ?? 0.5, xyY: preset.xy?.y ?? 0.5 });
    },

    deletePreset: (presetId) => {
      set((state) => ({ savedPresets: state.savedPresets.filter((p) => p.id !== presetId) }));
    },

    morphToScene: (sceneId, duration = 800) => {
      const scene = EFFECT_SCENES.find((s) => s.id === sceneId);
      if (!scene) return;
      const fxMgr = getAudioEffectsManager();
      const from = { ...get().effects };
      const t0 = Date.now();
      set({ isMorphing: true, activeScene: sceneId });
      const tick = () => {
        const p = Math.min(1, (Date.now() - t0) / duration);
        const e = 1 - Math.pow(1 - p, 3);
        const cur = { ...get().effects } as Record<AudioEffectType, AudioEffect>;
        (Object.keys(cur) as AudioEffectType[]).forEach((id) => {
          const tgt = scene.effects[id];
          const v = from[id].intensity + ((tgt?.intensity ?? 0) - from[id].intensity) * e;
          const on = e > 0.5 ? (tgt?.enabled ?? false) : from[id].enabled;
          cur[id] = { ...cur[id], enabled: on, intensity: v };
          fxMgr.setEffectEnabled(id, on);
          if (on) fxMgr.setEffectIntensity(id, v);
        });
        set({ effects: cur });
        if (p < 1) { requestAnimationFrame(tick); }
        else {
          const fin = { ...get().effects } as Record<AudioEffectType, AudioEffect>;
          (Object.keys(fin) as AudioEffectType[]).forEach((id) => {
            const t = scene.effects[id];
            fin[id] = { ...fin[id], enabled: t?.enabled ?? false, intensity: t?.intensity ?? 0 };
            fxMgr.setEffectEnabled(id, t?.enabled ?? false);
            if (t?.enabled) fxMgr.setEffectIntensity(id, t.intensity);
          });
          set({ effects: fin, isMorphing: false, xyX: scene.xy.x, xyY: scene.xy.y });
        }
      };
      requestAnimationFrame(tick);
    },

    isMorphing: false,
    lfoEnabled: false,
    lfoSpeed: 0.5,
    lfoDepth: 0.3,

    toggleLFO: () => {
      const next = !get().lfoEnabled;
      set({ lfoEnabled: next });
      if (next) {
        const tick = () => {
          const s = get();
          if (!s.lfoEnabled) return;
          const w = Math.sin(Date.now() / 1000 * s.lfoSpeed * Math.PI * 2) * 0.5 + 0.5;
          const mgr = getAudioEffectsManager();
          (Object.keys(s.effects) as AudioEffectType[]).forEach((id) => {
            if (s.effects[id].enabled) {
              const m = Math.max(0, Math.min(1, s.effects[id].intensity + (s.lfoDepth * 0.3) * (w - 0.5)));
              mgr.setEffectIntensity(id, m);
            }
          });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    },

    setLFOSpeed: (speed) => set({ lfoSpeed: Math.max(0.1, Math.min(2, speed)) }),
    setLFODepth: (depth) => set({ lfoDepth: Math.max(0, Math.min(1, depth)) }),

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
