import { create } from "zustand";

export type GestureType =
  | "pinch"
  | "fist"
  | "swipe_left"
  | "swipe_right"
  | "volume_up"
  | "volume_down"
  | "speed_up"
  | "speed_down"
  | "heart"
  | "circle_cw"
  | "circle_ccw"
  | "wave_back"
  | "seek_forward"
  | "seek_backward"
  | null;

interface GestureState {
  isEnabled: boolean; // 手势功能总开关
  isCameraActive: boolean;
  cursorPosition: { x: number; y: number };
  isHandDetected: boolean;
  lastGesture: GestureType;
  gestureTriggered: boolean;
  gestureIntensity: number; // 0-1 for continuous gestures like volume
  isPinching: boolean;

  // Gesture feedback
  showVolumePanel: boolean;
  volumePanelValue: number;
  showSpeedPanel: boolean;
  speedPanelValue: number;
  showModeToast: boolean;
  modeToastMessage: string;
  showHeartAnimation: boolean;
  showSeekPreview: boolean;
  seekPreviewTime: number;
  seekPreviewLyric: string;

  // Toggle
  toggleGestureEnabled: () => void;
  setIsEnabled: (enabled: boolean) => void;

  setIsCameraActive: (active: boolean) => void;
  setCursorPosition: (x: number, y: number) => void;
  setIsHandDetected: (detected: boolean) => void;
  setLastGesture: (gesture: GestureType) => void;
  setGestureTriggered: (triggered: boolean) => void;
  setGestureIntensity: (intensity: number) => void;
  setIsPinching: (pinching: boolean) => void;

  // Panel controls
  setShowVolumePanel: (show: boolean) => void;
  setVolumePanelValue: (value: number) => void;
  setShowSpeedPanel: (show: boolean) => void;
  setSpeedPanelValue: (value: number) => void;
  setShowModeToast: (show: boolean) => void;
  setModeToastMessage: (message: string) => void;
  setShowHeartAnimation: (show: boolean) => void;
  setShowSeekPreview: (show: boolean) => void;
  setSeekPreviewTime: (time: number) => void;
  setSeekPreviewLyric: (lyric: string) => void;

  resetGesture: () => void;
}

export const useGestureStore = create<GestureState>((set) => ({
  isEnabled: false, // 默认关闭手势功能
  isCameraActive: false,
  cursorPosition: { x: 0.5, y: 0.5 },
  isHandDetected: false,
  lastGesture: null,
  gestureTriggered: false,
  gestureIntensity: 0,
  isPinching: false,

  showVolumePanel: false,
  volumePanelValue: 0.5,
  showSpeedPanel: false,
  speedPanelValue: 1,
  showModeToast: false,
  modeToastMessage: "",
  showHeartAnimation: false,
  showSeekPreview: false,
  seekPreviewTime: 0,
  seekPreviewLyric: "",

  // Toggle
  toggleGestureEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),
  setIsEnabled: (enabled) => set({ isEnabled: enabled }),

  setIsCameraActive: (active) => set({ isCameraActive: active }),
  setCursorPosition: (x, y) => set({ cursorPosition: { x, y } }),
  setIsHandDetected: (detected) => set({ isHandDetected: detected }),
  setLastGesture: (gesture) => set({ lastGesture: gesture }),
  setGestureTriggered: (triggered) => set({ gestureTriggered: triggered }),
  setGestureIntensity: (intensity) => set({ gestureIntensity: intensity }),
  setIsPinching: (pinching) => set({ isPinching: pinching }),

  setShowVolumePanel: (show) => set({ showVolumePanel: show }),
  setVolumePanelValue: (value) => set({ volumePanelValue: value }),
  setShowSpeedPanel: (show) => set({ showSpeedPanel: show }),
  setSpeedPanelValue: (value) => set({ speedPanelValue: value }),
  setShowModeToast: (show) => set({ showModeToast: show }),
  setModeToastMessage: (message) => set({ modeToastMessage: message }),
  setShowHeartAnimation: (show) => set({ showHeartAnimation: show }),
  setShowSeekPreview: (show) => set({ showSeekPreview: show }),
  setSeekPreviewTime: (time) => set({ seekPreviewTime: time }),
  setSeekPreviewLyric: (lyric) => set({ seekPreviewLyric: lyric }),

  resetGesture: () =>
    set({
      lastGesture: null,
      gestureTriggered: false,
      gestureIntensity: 0,
    }),
}));
