export type AnimationSyncMode = "audio" | "timeline" | "mixed";

export interface AnimationKeyframe {
  id: string;
  time: number;
  value: any;
  easing?: [number, number, number, number];
}

export interface AnimationTrack {
  id: string;
  parameterId: string;
  name: string;
  enabled: boolean;
  keyframes: AnimationKeyframe[];
  interpolation: "linear" | "step" | "bezier" | "ease";
}

export interface AudioAnimationConfig {
  beatDetection: boolean;
  beatMultiplier: number;
  frequencyBands: {
    band: "bass" | "mid" | "treble";
    multiplier: number;
    smoothing: number;
  }[];
}

export interface AnimationState {
  syncMode: AnimationSyncMode;
  timelineDuration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  tracks: AnimationTrack[];
  audioConfig: AudioAnimationConfig;
}

export interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  syncMode: AnimationSyncMode;
  tracks: AnimationTrack[];
  audioConfig?: AudioAnimationConfig;
}

export const DEFAULT_ANIMATION_PRESETS: AnimationPreset[] = [
  {
    id: "follow-beat",
    name: "跟随节拍",
    description: "参数随音乐节拍变化",
    syncMode: "audio",
    tracks: [],
    audioConfig: {
      beatDetection: true,
      beatMultiplier: 2,
      frequencyBands: [
        { band: "bass", multiplier: 1.5, smoothing: 0.2 },
        { band: "mid", multiplier: 1, smoothing: 0.1 },
        { band: "treble", multiplier: 0.8, smoothing: 0.05 }
      ]
    }
  },
  {
    id: "bass-driven",
    name: "低频驱动",
    description: "主要响应低频（贝斯）",
    syncMode: "audio",
    tracks: [],
    audioConfig: {
      beatDetection: true,
      beatMultiplier: 1,
      frequencyBands: [
        { band: "bass", multiplier: 3, smoothing: 0.3 },
        { band: "mid", multiplier: 0.5, smoothing: 0.1 },
        { band: "treble", multiplier: 0.3, smoothing: 0.05 }
      ]
    }
  },
  {
    id: "full-spectrum",
    name: "全频响应",
    description: "响应全频段频谱",
    syncMode: "audio",
    tracks: [],
    audioConfig: {
      beatDetection: true,
      beatMultiplier: 1.5,
      frequencyBands: [
        { band: "bass", multiplier: 1.2, smoothing: 0.2 },
        { band: "mid", multiplier: 1, smoothing: 0.15 },
        { band: "treble", multiplier: 1, smoothing: 0.1 }
      ]
    }
  },
  {
    id: "smooth-transition",
    name: "渐变变化",
    description: "参数缓慢平滑过渡",
    syncMode: "timeline",
    tracks: [],
    audioConfig: {
      beatDetection: false,
      beatMultiplier: 1,
      frequencyBands: [
        { band: "bass", multiplier: 1, smoothing: 0.5 },
        { band: "mid", multiplier: 1, smoothing: 0.5 },
        { band: "treble", multiplier: 1, smoothing: 0.5 }
      ]
    }
  },
  {
    id: "pulse-effect",
    name: "脉冲效果",
    description: "节拍时产生脉冲",
    syncMode: "mixed",
    tracks: [],
    audioConfig: {
      beatDetection: true,
      beatMultiplier: 3,
      frequencyBands: [
        { band: "bass", multiplier: 2, smoothing: 0.1 },
        { band: "mid", multiplier: 0.5, smoothing: 0.1 },
        { band: "treble", multiplier: 0.3, smoothing: 0.05 }
      ]
    }
  }
];
