/**
 * 关键点几何特征。
 *
 * 所有姿态判定都做手的尺度归一化（handScale = 腕关节 0 到中指 MCP 9 的距离），
 * 避免手离摄像头远近导致阈值不一致；本文件不依赖 React / DOM / MediaPipe。
 */

import {
  LANDMARK,
  type GestureActiveRegion,
  type GestureCursor,
  type GestureLandmark,
  type GestureLandmarks,
  type GesturePosture,
} from "./types";

export type GestureFinger = "thumb" | "index" | "middle" | "ring" | "pinky";

/** 伸展判定：指尖到腕关节距离 / PIP 到腕关节距离。 */
export const FINGER_EXTENDED_MIN_RATIO = 1.1;
/** 收拢判定：与伸展判定留出回滞区间，避免临界抖动。 */
export const FINGER_CURLED_MAX_RATIO = 1.02;

const EXTENSION_SCORE_MIN_RATIO = 0.95;
const EXTENSION_SCORE_MAX_RATIO = 1.35;
const MIN_HAND_SCALE = 1e-4;

interface FingerChain {
  mcp: number;
  pip: number;
  tip: number;
}

/** 拇指没有 PIP，用 IP 作为中段参考点。 */
const FINGER_CHAINS: Record<GestureFinger, FingerChain> = {
  thumb: { mcp: LANDMARK.THUMB_MCP, pip: LANDMARK.THUMB_IP, tip: LANDMARK.THUMB_TIP },
  index: { mcp: LANDMARK.INDEX_MCP, pip: LANDMARK.INDEX_PIP, tip: LANDMARK.INDEX_TIP },
  middle: { mcp: LANDMARK.MIDDLE_MCP, pip: LANDMARK.MIDDLE_PIP, tip: LANDMARK.MIDDLE_TIP },
  ring: { mcp: LANDMARK.RING_MCP, pip: LANDMARK.RING_PIP, tip: LANDMARK.RING_TIP },
  pinky: { mcp: LANDMARK.PINKY_MCP, pip: LANDMARK.PINKY_PIP, tip: LANDMARK.PINKY_TIP },
};

/** 参与张开度计算的五指顺序。 */
const FINGER_ORDER: readonly GestureFinger[] = ["thumb", "index", "middle", "ring", "pinky"];

/** 参与握拳 / 张掌判定的四指（拇指不参与，避免拇指姿态差异导致误判）。 */
const FOUR_FINGERS: readonly GestureFinger[] = ["index", "middle", "ring", "pinky"];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isUsableHand(landmarks: GestureLandmarks): boolean {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return false;
  const wrist = landmarks[LANDMARK.WRIST];
  const middleMcp = landmarks[LANDMARK.MIDDLE_MCP];
  return (
    typeof wrist?.x === "number" &&
    typeof wrist.y === "number" &&
    typeof middleMcp?.x === "number" &&
    typeof middleMcp.y === "number"
  );
}

/** 二维欧氏距离（忽略 z：摄像头深度抖动较大，手势力图只用屏幕平面）。 */
export function distance2D(
  a: Pick<GestureLandmark, "x" | "y">,
  b: Pick<GestureLandmark, "x" | "y">
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/** 手的尺度：腕关节到中指 MCP 的距离，用于归一化所有比例指标。 */
export function handScale(landmarks: GestureLandmarks): number {
  if (!isUsableHand(landmarks)) return 0;
  const scale = distance2D(landmarks[LANDMARK.WRIST], landmarks[LANDMARK.MIDDLE_MCP]);
  return scale > MIN_HAND_SCALE ? scale : 0;
}

/** 捏合比例：拇指尖 4 与食指尖 8 的距离 / handScale；越小越接近捏合。 */
export function pinchRatio(landmarks: GestureLandmarks): number {
  const scale = handScale(landmarks);
  if (scale <= 0) return 0;
  return distance2D(landmarks[LANDMARK.THUMB_TIP], landmarks[LANDMARK.INDEX_TIP]) / scale;
}

/** 单指伸展比例（不依赖手的绝对大小，但依赖 PIP 位置，不适合做阈值主判定）。 */
export function fingerExtensionRatio(landmarks: GestureLandmarks, finger: GestureFinger): number {
  if (!isUsableHand(landmarks)) return 0;
  const chain = FINGER_CHAINS[finger];
  const wrist = landmarks[LANDMARK.WRIST];
  const pipDistance = distance2D(wrist, landmarks[chain.pip]);
  const tipDistance = distance2D(wrist, landmarks[chain.tip]);
  if (pipDistance <= MIN_HAND_SCALE) return 0;
  return tipDistance / pipDistance;
}

/** 手指伸展度 0-1，用于 HUD / palmOpenness（0.95 弯曲 ~ 1.35 完全伸展）。 */
export function fingerExtensionScore(landmarks: GestureLandmarks, finger: GestureFinger): number {
  const ratio = fingerExtensionRatio(landmarks, finger);
  return clamp01(
    (ratio - EXTENSION_SCORE_MIN_RATIO) / (EXTENSION_SCORE_MAX_RATIO - EXTENSION_SCORE_MIN_RATIO)
  );
}

export function isFingerExtended(landmarks: GestureLandmarks, finger: GestureFinger): boolean {
  return fingerExtensionRatio(landmarks, finger) >= FINGER_EXTENDED_MIN_RATIO;
}

export function isFingerCurled(landmarks: GestureLandmarks, finger: GestureFinger): boolean {
  return fingerExtensionRatio(landmarks, finger) <= FINGER_CURLED_MAX_RATIO;
}

/** 手掌张开度 0-1：五指的伸展度平均值。 */
export function palmOpenness(landmarks: GestureLandmarks): number {
  if (!isUsableHand(landmarks)) return 0;
  let total = 0;
  for (const finger of FINGER_ORDER) {
    total += fingerExtensionScore(landmarks, finger);
  }
  return clamp01(total / FINGER_ORDER.length);
}

/** 手掌中心：腕关节与四个 MCP 的均值，作为张掌 / 握拳时的光标锚点。 */
export function palmCenter(landmarks: GestureLandmarks): GestureLandmark {
  const base = landmarks[LANDMARK.WRIST] ?? { x: 0, y: 0, z: 0 };
  if (!isUsableHand(landmarks)) return { x: base.x, y: base.y, z: base.z };
  const indices = [
    LANDMARK.WRIST,
    LANDMARK.INDEX_MCP,
    LANDMARK.MIDDLE_MCP,
    LANDMARK.RING_MCP,
    LANDMARK.PINKY_MCP,
  ];
  let x = 0;
  let y = 0;
  let z = 0;
  for (const index of indices) {
    const point = landmarks[index];
    x += point.x;
    y += point.y;
    z += point.z;
  }
  return { x: x / indices.length, y: y / indices.length, z: z / indices.length };
}

/**
 * 姿态分类（单帧原始判定，不带滞后；滞后由 engine 的 postureHoldMs 负责）。
 * - open_palm：食指 / 中指 / 无名指 / 小指全部伸展；
 * - point：仅食指伸展，其余三指收拢；
 * - fist：四指全部收拢；
 * - 其他组合返回 unknown。
 */
export function classifyPosture(landmarks: GestureLandmarks): GesturePosture {
  if (!isUsableHand(landmarks)) return "unknown";

  const extended = FOUR_FINGERS.filter((finger) => isFingerExtended(landmarks, finger));
  if (extended.length === FOUR_FINGERS.length) return "open_palm";

  const curled = FOUR_FINGERS.every((finger) => isFingerCurled(landmarks, finger));
  if (curled) return "fist";

  const onlyIndex =
    isFingerExtended(landmarks, "index") &&
    FOUR_FINGERS.filter((finger) => finger !== "index").every((finger) =>
      isFingerCurled(landmarks, finger)
    );
  return onlyIndex ? "point" : "unknown";
}

export interface MapPointOptions {
  /** 是否镜像画面（前置摄像头左右翻转）。屏幕坐标 = 1 - 原始 x。 */
  mirror: boolean;
  /** 活跃识别区域：把中央区域拉伸到整块屏幕。 */
  activeRegion: GestureActiveRegion;
}

function remapAxis(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0.5;
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return 0.5;
  return clamp01((value - min) / span);
}

/**
 * 把摄像头归一化坐标映射成屏幕归一化坐标：
 * 1）mirror 时 x 取反（前置摄像头镜像补偿）；
 * 2）按 activeRegion 拉伸到 0-1；
 * 3）clamp 到 [0, 1]，防止抬手到画面外时指针飞出屏幕。
 * 屏幕坐标系 y 向下，与本项目光标 / 滑动方向一致。
 */
export function mirrorAndMapPoint(
  point: Pick<GestureLandmark, "x" | "y">,
  options: MapPointOptions
): GestureCursor {
  const mirroredX = options.mirror ? 1 - point.x : point.x;
  return {
    x: remapAxis(mirroredX, options.activeRegion.xMin, options.activeRegion.xMax),
    y: remapAxis(point.y, options.activeRegion.yMin, options.activeRegion.yMax),
  };
}
