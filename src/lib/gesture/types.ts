/**
 * 隔空手势系统的公共契约。
 *
 * 设计约束：
 * - 本文件只包含类型、常量与纯函数，不依赖 React / Zustand / DOM / MediaPipe。
 * - 识别引擎（engine.ts）、设备层（camera.ts / tracker.ts）、指针桥（pointerBridge.ts）、
 *   状态层（gestureStore.ts / gestureSettingsStore.ts）与 UI 全部以本文件为唯一契约。
 * - 任何新增手势 / 动作都必须先在这里登记，避免 UI 与识别层各自维护一份列表。
 */

export interface GestureLandmark {
  x: number;
  y: number;
  z: number;
}

export type GestureLandmarks = readonly GestureLandmark[];

/** MediaPipe Hands 的 21 个关键点索引。 */
export const LANDMARK = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export const HAND_LANDMARK_COUNT = 21;

/** 单手姿态。识别层每帧输出一个，带滞后稳定。 */
export type GesturePosture = "none" | "unknown" | "point" | "open_palm" | "fist";

/** 交互模式。UI/光标/反馈都按这个状态渲染。 */
export type GestureMode = "idle" | "pointer" | "pinch" | "drag" | "palm" | "fist" | "cooldown";

/** 可用命令手势（离散动作，一次触发一次）。 */
export type GestureCommandId =
  | "swipe_left"
  | "swipe_right"
  | "swipe_up"
  | "swipe_down"
  | "fist_hold";

/** 可绑定动作。none 用于停用某个命令手势。 */
export type GestureActionId =
  | "next_track"
  | "prev_track"
  | "volume_up"
  | "volume_down"
  | "toggle_play"
  | "toggle_mute"
  | "seek_forward"
  | "seek_backward"
  | "toggle_lyrics"
  | "none";

export type GestureIconName =
  | "swipe-left"
  | "swipe-right"
  | "swipe-up"
  | "swipe-down"
  | "hand"
  | "volume-high"
  | "volume-low"
  | "play"
  | "pause"
  | "skip-next"
  | "skip-prev"
  | "mute"
  | "fast-forward"
  | "rewind"
  | "lyrics"
  | "cursor"
  | "fist"
  | "info"
  | "warning"
  | "none";

export interface GestureActionDefinition {
  id: GestureActionId;
  label: string;
  shortLabel: string;
  icon: GestureIconName;
  description: string;
}

export const GESTURE_ACTION_DEFINITIONS: readonly GestureActionDefinition[] = [
  {
    id: "next_track",
    label: "下一首",
    shortLabel: "下一首",
    icon: "skip-next",
    description: "切到播放队列的下一首",
  },
  {
    id: "prev_track",
    label: "上一首",
    shortLabel: "上一首",
    icon: "skip-prev",
    description: "切到播放队列的上一首",
  },
  {
    id: "volume_up",
    label: "音量增加",
    shortLabel: "音量 +",
    icon: "volume-high",
    description: "按设定步进提高音量",
  },
  {
    id: "volume_down",
    label: "音量减少",
    shortLabel: "音量 −",
    icon: "volume-low",
    description: "按设定步进降低音量",
  },
  {
    id: "toggle_play",
    label: "播放 / 暂停",
    shortLabel: "播放/暂停",
    icon: "play",
    description: "切换当前歌曲的播放状态",
  },
  {
    id: "toggle_mute",
    label: "静音切换",
    shortLabel: "静音",
    icon: "mute",
    description: "静音或取消静音",
  },
  {
    id: "seek_forward",
    label: "快进 10 秒",
    shortLabel: "快进",
    icon: "fast-forward",
    description: "向前跳转 10 秒",
  },
  {
    id: "seek_backward",
    label: "快退 10 秒",
    shortLabel: "快退",
    icon: "rewind",
    description: "向后跳转 10 秒",
  },
  {
    id: "toggle_lyrics",
    label: "全屏歌词",
    shortLabel: "歌词",
    icon: "lyrics",
    description: "进入或退出全屏歌词",
  },
  {
    id: "none",
    label: "不绑定",
    shortLabel: "关闭",
    icon: "none",
    description: "保留手势检测但不执行动作",
  },
];

export interface GestureCommandDefinition {
  id: GestureCommandId;
  label: string;
  posture: GesturePosture;
  description: string;
  defaultAction: GestureActionId;
  icon: GestureIconName;
}

export const GESTURE_COMMAND_DEFINITIONS: readonly GestureCommandDefinition[] = [
  {
    id: "swipe_left",
    label: "张开手掌左滑",
    posture: "open_palm",
    description: "手掌张开后向屏幕左侧挥动",
    defaultAction: "next_track",
    icon: "swipe-left",
  },
  {
    id: "swipe_right",
    label: "张开手掌右滑",
    posture: "open_palm",
    description: "手掌张开后向屏幕右侧挥动",
    defaultAction: "prev_track",
    icon: "swipe-right",
  },
  {
    id: "swipe_up",
    label: "张开手掌上滑",
    posture: "open_palm",
    description: "手掌张开后向上挥动",
    defaultAction: "volume_up",
    icon: "swipe-up",
  },
  {
    id: "swipe_down",
    label: "张开手掌下滑",
    posture: "open_palm",
    description: "手掌张开后向下挥动",
    defaultAction: "volume_down",
    icon: "swipe-down",
  },
  {
    id: "fist_hold",
    label: "握拳停顿",
    posture: "fist",
    description: "握拳保持约 0.65 秒触发播放 / 暂停",
    defaultAction: "toggle_play",
    icon: "fist",
  },
];

export type GestureBindings = Record<GestureCommandId, GestureActionId>;

export function createDefaultGestureBindings(): GestureBindings {
  return {
    swipe_left: "next_track",
    swipe_right: "prev_track",
    swipe_up: "volume_up",
    swipe_down: "volume_down",
    fist_hold: "toggle_play",
  };
}

export const DEFAULT_GESTURE_BINDINGS: GestureBindings = createDefaultGestureBindings();

/** 活跃识别区域：把摄像头画面的中央区域映射到整块屏幕，避免“要抬手到极限才能碰到屏幕边缘”。 */
export interface GestureActiveRegion {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface GestureTuning {
  mirror: boolean;
  sensitivity: number;
  pointerSmoothing: number;
  pinchEnterRatio: number;
  pinchExitRatio: number;
  pinchClickMaxMs: number;
  pinchClickMoveTolerance: number;
  doubleClickWindowMs: number;
  dwellMs: number;
  swipeMinDistance: number;
  swipeMinVelocity: number;
  swipeDominance: number;
  swipeWindowMs: number;
  commandCooldownMs: number;
  postureHoldMs: number;
  handLostGraceMs: number;
  maxFps: number;
  activeRegion: GestureActiveRegion;
  oneEuroMinCutoff: number;
  oneEuroBeta: number;
}

export const DEFAULT_GESTURE_TUNING: GestureTuning = {
  mirror: true,
  sensitivity: 1,
  pointerSmoothing: 0.55,
  pinchEnterRatio: 0.42,
  pinchExitRatio: 0.55,
  pinchClickMaxMs: 420,
  pinchClickMoveTolerance: 0.012,
  doubleClickWindowMs: 320,
  dwellMs: 650,
  swipeMinDistance: 0.14,
  swipeMinVelocity: 0.9,
  swipeDominance: 1.35,
  swipeWindowMs: 180,
  commandCooldownMs: 700,
  postureHoldMs: 90,
  handLostGraceMs: 350,
  maxFps: 30,
  activeRegion: { xMin: 0.15, xMax: 0.85, yMin: 0.12, yMax: 0.88 },
  oneEuroMinCutoff: 1.4,
  oneEuroBeta: 0.02,
};

export interface GestureSettings {
  /** 手势总开关。持久化；下次启动会恢复。 */
  enabled: boolean;
  /** 右上角悬浮 HUD。 */
  showHud: boolean;
  /** HUD 内摄像头预览。 */
  showPreview: boolean;
  /** HUD 内 21 点骨骼。 */
  showSkeleton: boolean;
  /** 虚拟光标。 */
  showCursor: boolean;
  /** HUD 内显示诊断数据（灵敏度调参用）。 */
  showDebugStats: boolean;
  /** HUD 折叠状态。 */
  hudCollapsed: boolean;
  mirror: boolean;
  /** 0.5 - 2.0，越高越容易触发。 */
  sensitivity: number;
  /** 0 - 1，越高越平滑但延迟越大。 */
  pointerSmoothing: number;
  /** 音量步进 0.01 - 0.2。 */
  volumeStep: number;
  cameraDeviceId: string | null;
  bindings: GestureBindings;
}

export function createDefaultGestureSettings(): GestureSettings {
  return {
    enabled: false,
    showHud: true,
    showPreview: true,
    showSkeleton: true,
    showCursor: true,
    showDebugStats: false,
    hudCollapsed: false,
    mirror: true,
    sensitivity: 1,
    pointerSmoothing: 0.55,
    volumeStep: 0.05,
    cameraDeviceId: null,
    bindings: createDefaultGestureBindings(),
  };
}

export const DEFAULT_GESTURE_SETTINGS: GestureSettings = createDefaultGestureSettings();

export const GESTURE_SETTINGS_STORAGE_KEY = "mimi-gesture-settings-v1";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 把用户设置换算成识别参数。
 * 敏感度只影响“判定门槛”（捏合比例、挥动距离/速度），不改变时间窗口；
 * 指针平滑度只影响 One Euro 滤波器的截止频率。
 */
export function createGestureTuning(settings: GestureSettings): GestureTuning {
  const sensitivity = clamp(settings.sensitivity, 0.5, 2);
  const smoothing = clamp(settings.pointerSmoothing, 0, 1);
  const pinchEnterRatio = clamp(DEFAULT_GESTURE_TUNING.pinchEnterRatio / sensitivity, 0.2, 0.7);

  return {
    ...DEFAULT_GESTURE_TUNING,
    mirror: settings.mirror,
    sensitivity,
    pointerSmoothing: smoothing,
    pinchEnterRatio,
    pinchExitRatio: clamp(pinchEnterRatio * 1.32, pinchEnterRatio + 0.05, 0.85),
    swipeMinDistance: clamp(DEFAULT_GESTURE_TUNING.swipeMinDistance / sensitivity, 0.07, 0.28),
    swipeMinVelocity: clamp(DEFAULT_GESTURE_TUNING.swipeMinVelocity / sensitivity, 0.45, 2.0),
    oneEuroMinCutoff: clamp(0.45 + (1 - smoothing) * 2.6, 0.45, 3.2),
  };
}

/** 指针桥接器方向：屏幕坐标系（y 向下），已经过镜像补偿。 */
export type SwipeDirection = "left" | "right" | "up" | "down";

export interface GestureCursor {
  /** 0-1 屏幕归一化坐标。 */
  x: number;
  y: number;
}

export interface GestureDwellState {
  command: GestureCommandId;
  /** 0-1 蓄力进度。 */
  progress: number;
}

export interface GestureDebugMetrics {
  pinchRatio: number;
  palmOpenness: number;
  pointerSpeed: number;
  posture: GesturePosture;
}

export type GestureFrameEvent =
  | { type: "pointer_move"; x: number; y: number }
  | { type: "pointer_down"; x: number; y: number }
  | { type: "pointer_up"; x: number; y: number; click: boolean; durationMs: number }
  | { type: "command"; command: GestureCommandId; x: number; y: number; confidence: number }
  | { type: "dwell"; command: GestureCommandId; progress: number }
  | { type: "mode"; mode: GestureMode; posture: GesturePosture }
  | { type: "tracking"; present: boolean };

export interface GestureFrameResult {
  timestamp: number;
  handPresent: boolean;
  posture: GesturePosture;
  mode: GestureMode;
  cursor: GestureCursor | null;
  pinching: boolean;
  events: GestureFrameEvent[];
  debug: GestureDebugMetrics;
}

export interface GestureEngineConfig extends GestureTuning {
  /** 识别手势但不下发 pointer/command 事件（HUD 预览、校准模式）。 */
  observeOnly?: boolean;
}

export type GestureStatus =
  | "idle"
  | "loading_assets"
  | "requesting_camera"
  | "starting"
  | "running"
  | "paused"
  | "error";

export type GestureErrorCode =
  | "unsupported"
  | "insecure_context"
  | "permission_denied"
  | "camera_not_found"
  | "camera_busy"
  | "camera_failed"
  | "model_load_failed"
  | "tracker_failed"
  | "unknown";

export interface GestureErrorState {
  code: GestureErrorCode;
  message: string;
  recoverable: boolean;
  hint?: string;
}

export type GestureFeedbackTone = "info" | "success" | "warning" | "error";

export interface GestureFeedbackEvent {
  seq: number;
  action: GestureActionId;
  command?: GestureCommandId;
  label: string;
  detail?: string;
  tone: GestureFeedbackTone;
  at: number;
}

export interface GestureActionOutcome {
  ok: boolean;
  action: GestureActionId;
  label: string;
  detail?: string;
  tone: GestureFeedbackTone;
}

export interface GestureCameraDevice {
  deviceId: string;
  label: string;
}

/** 判断是否为 21 点手部关键点（防止 MediaPipe 版本/异常返回脏数据）。 */
export function isGestureLandmarks(value: unknown): value is GestureLandmarks {
  if (!Array.isArray(value) || value.length < HAND_LANDMARK_COUNT) return false;
  for (let index = 0; index < HAND_LANDMARK_COUNT; index += 1) {
    const point = value[index] as Partial<GestureLandmark> | null | undefined;
    if (!point || typeof point.x !== "number" || typeof point.y !== "number") return false;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  }
  return true;
}

export function findGestureActionDefinition(action: GestureActionId): GestureActionDefinition {
  return (
    GESTURE_ACTION_DEFINITIONS.find((definition) => definition.id === action) ??
    GESTURE_ACTION_DEFINITIONS[GESTURE_ACTION_DEFINITIONS.length - 1]
  );
}

export function findGestureCommandDefinition(command: GestureCommandId): GestureCommandDefinition {
  return (
    GESTURE_COMMAND_DEFINITIONS.find((definition) => definition.id === command) ??
    GESTURE_COMMAND_DEFINITIONS[0]
  );
}
