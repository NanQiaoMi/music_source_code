import { create } from "zustand";
import { 
  AnimationState, 
  AnimationTrack, 
  AnimationKeyframe,
  AnimationSyncMode,
  DEFAULT_ANIMATION_PRESETS,
  AnimationPreset
} from "@/lib/visualization/animationTypes";

interface AnimationStore extends AnimationState {
  setSyncMode: (mode: AnimationSyncMode) => void;
  setTimelineDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  
  addTrack: (track: AnimationTrack) => void;
  updateTrack: (trackId: string, updates: Partial<AnimationTrack>) => void;
  deleteTrack: (trackId: string) => void;
  
  addKeyframe: (trackId: string, keyframe: AnimationKeyframe) => void;
  updateKeyframe: (trackId: string, keyframeId: string, updates: Partial<AnimationKeyframe>) => void;
  deleteKeyframe: (trackId: string, keyframeId: string) => void;
  
  setAudioConfig: (config: AnimationState["audioConfig"]) => void;
  applyPreset: (preset: AnimationPreset) => void;
  reset: () => void;
}

const DEFAULT_STATE: AnimationState = {
  syncMode: "audio",
  timelineDuration: 10,
  currentTime: 0,
  isPlaying: false,
  playbackSpeed: 1,
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
};

export const useAnimationStore = create<AnimationStore>((set, get) => ({
  ...DEFAULT_STATE,

  setSyncMode: (mode) => set({ syncMode: mode }),
  
  setTimelineDuration: (duration) => set({ timelineDuration: duration }),
  
  setCurrentTime: (time) => set({ currentTime: time }),
  
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  addTrack: (track) => set((state) => ({
    tracks: [...state.tracks, track]
  })),
  
  updateTrack: (trackId, updates) => set((state) => ({
    tracks: state.tracks.map((t) =>
      t.id === trackId ? { ...t, ...updates } : t
    )
  })),
  
  deleteTrack: (trackId) => set((state) => ({
    tracks: state.tracks.filter((t) => t.id !== trackId)
  })),

  addKeyframe: (trackId, keyframe) => set((state) => ({
    tracks: state.tracks.map((t) =>
      t.id === trackId
        ? { ...t, keyframes: [...t.keyframes, keyframe].sort((a, b) => a.time - b.time) }
        : t
    )
  })),
  
  updateKeyframe: (trackId, keyframeId, updates) => set((state) => ({
    tracks: state.tracks.map((t) =>
      t.id === trackId
        ? {
            ...t,
            keyframes: t.keyframes.map((k) =>
              k.id === keyframeId ? { ...k, ...updates } : k
            ).sort((a, b) => a.time - b.time)
          }
        : t
    )
  })),
  
  deleteKeyframe: (trackId, keyframeId) => set((state) => ({
    tracks: state.tracks.map((t) =>
      t.id === trackId
        ? { ...t, keyframes: t.keyframes.filter((k) => k.id !== keyframeId) }
        : t
    )
  })),

  setAudioConfig: (config) => set({ audioConfig: config }),

  applyPreset: (preset) => set({
    syncMode: preset.syncMode,
    tracks: preset.tracks,
    audioConfig: preset.audioConfig || DEFAULT_STATE.audioConfig,
    currentTime: 0,
    isPlaying: false
  }),

  reset: () => set(DEFAULT_STATE)
}));
