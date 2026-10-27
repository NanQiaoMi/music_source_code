import { create } from "zustand";
import type {
  GestureDebugMetrics,
  GestureDwellState,
  GestureErrorState,
  GestureFeedbackEvent,
  GestureMode,
  GesturePosture,
  GestureStatus,
} from "@/lib/gesture/types";

type GestureBackend = "local" | "cdn";

interface GestureRuntimeState {
  status: GestureStatus;
  error: GestureErrorState | null;
  cameraActive: boolean;
  modelReady: boolean;
  backend: GestureBackend | null;

  handPresent: boolean;
  posture: GesturePosture;
  mode: GestureMode;
  cursor: { x: number; y: number };
  cursorVisible: boolean;
  pinching: boolean;
  dragging: boolean;
  dwell: GestureDwellState | null;

  lastEvent: GestureFeedbackEvent | null;
  eventSeq: number;
  fps: number;
  debug: GestureDebugMetrics;

  setStatus: (status: GestureStatus) => void;
  setError: (error: GestureErrorState | null) => void;
  setCameraActive: (active: boolean) => void;
  setModelReady: (ready: boolean) => void;
  setBackend: (backend: GestureBackend | null) => void;
  setHandPresent: (present: boolean) => void;
  setPosture: (posture: GesturePosture) => void;
  setMode: (mode: GestureMode) => void;
  setCursor: (x: number, y: number) => void;
  setCursorVisible: (visible: boolean) => void;
  setPinching: (pinching: boolean) => void;
  setDragging: (dragging: boolean) => void;
  setDwell: (dwell: GestureDwellState | null) => void;
  setFps: (fps: number) => void;
  setDebug: (debug: GestureDebugMetrics) => void;
  pushEvent: (
    event: Omit<GestureFeedbackEvent, "seq" | "at"> & { at?: number }
  ) => GestureFeedbackEvent;
  resetRuntime: () => void;
}

const EMPTY_DEBUG: GestureDebugMetrics = {
  pinchRatio: 0,
  palmOpenness: 0,
  pointerSpeed: 0,
  posture: "none",
};

function createRuntimeDefaults() {
  return {
    status: "idle" as GestureStatus,
    error: null as GestureErrorState | null,
    cameraActive: false,
    modelReady: false,
    backend: null as GestureBackend | null,
    handPresent: false,
    posture: "none" as GesturePosture,
    mode: "idle" as GestureMode,
    cursor: { x: 0.5, y: 0.5 },
    cursorVisible: false,
    pinching: false,
    dragging: false,
    dwell: null as GestureDwellState | null,
    lastEvent: null as GestureFeedbackEvent | null,
    eventSeq: 0,
    fps: 0,
    debug: { ...EMPTY_DEBUG },
  };
}

/**
 * 手势运行时状态（不持久化）。
 *
 * 高频字段（cursor / fps / debug）由识别循环直接 set，订阅者应只 selector 自己需要的字段；
 * 动作反馈通过 pushEvent 递增 seq，避免时间戳相同导致 UI 不更新。
 */
export const useGestureStore = create<GestureRuntimeState>((set, get) => ({
  ...createRuntimeDefaults(),

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setCameraActive: (cameraActive) => set({ cameraActive }),
  setModelReady: (modelReady) => set({ modelReady }),
  setBackend: (backend) => set({ backend }),
  setHandPresent: (handPresent) => set({ handPresent }),
  setPosture: (posture) => set({ posture }),
  setMode: (mode) => set({ mode }),
  setCursor: (x, y) => set({ cursor: { x, y } }),
  setCursorVisible: (cursorVisible) => set({ cursorVisible }),
  setPinching: (pinching) => set({ pinching }),
  setDragging: (dragging) => set({ dragging }),
  setDwell: (dwell) => set({ dwell }),
  setFps: (fps) => set({ fps }),
  setDebug: (debug) => set({ debug }),

  pushEvent: (event) => {
    const nextSeq = get().eventSeq + 1;
    const fullEvent: GestureFeedbackEvent = {
      ...event,
      seq: nextSeq,
      at: event.at ?? Date.now(),
    };
    set({ lastEvent: fullEvent, eventSeq: nextSeq });
    return fullEvent;
  },

  resetRuntime: () =>
    set({
      ...createRuntimeDefaults(),
      eventSeq: get().eventSeq,
      lastEvent: null,
    }),
}));
