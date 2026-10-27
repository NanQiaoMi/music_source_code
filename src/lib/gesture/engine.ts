/**
 * 纯手势识别引擎：状态机 + 事件生成。
 *
 * 设计约束：
 * - 不 import React / DOM / Zustand，只依赖 types.ts、filters.ts、landmarks.ts；
 * - 所有时间窗口都使用 processFrame 传入的 timestamp（毫秒），测试可用可控时间序列；
 * - 同一帧最多下发一条 command，且同一 command 不会因单帧内多次判定重复下发；
 * - observeOnly 下仍更新内部状态与 result 字段，但不下发 pointer / command / dwell 事件。
 */

import { createOneEuroFilter } from "./filters";
import {
  classifyPosture,
  distance2D,
  mirrorAndMapPoint,
  palmCenter,
  palmOpenness,
  pinchRatio,
} from "./landmarks";
import {
  DEFAULT_GESTURE_TUNING,
  LANDMARK,
  isGestureLandmarks,
  type GestureActiveRegion,
  type GestureCommandId,
  type GestureCursor,
  type GestureFrameEvent,
  type GestureFrameResult,
  type GestureLandmarks,
  type GestureMode,
  type GesturePosture,
  type GestureTuning,
} from "./types";

export interface GestureEngine {
  processFrame(landmarks: GestureLandmarks | null, timestamp: number): GestureFrameResult;
  reset(): void;
}

export type GestureEngineOptions = Partial<GestureTuning> & { observeOnly?: boolean };

type AnchorKind = "finger" | "palm";

interface SwipeSample {
  x: number;
  y: number;
  at: number;
}

const CURSOR_MOVE_EPSILON = 5e-4;
const DWELL_PROGRESS_EPSILON = 0.002;
const FALLBACK_POINT: GestureCursor = { x: 0.5, y: 0.5 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function resolveActiveRegion(region: GestureActiveRegion | undefined): GestureActiveRegion {
  const fallback = DEFAULT_GESTURE_TUNING.activeRegion;
  if (!region) return { ...fallback };
  return {
    xMin: region.xMin ?? fallback.xMin,
    xMax: region.xMax ?? fallback.xMax,
    yMin: region.yMin ?? fallback.yMin,
    yMax: region.yMax ?? fallback.yMax,
  };
}

/** 合并默认参数；activeRegion 支持部分覆盖，其余字段逐个兜底以保持类型安全。 */
function resolveTuning(overrides: Partial<GestureTuning>): GestureTuning {
  return {
    mirror: overrides.mirror ?? DEFAULT_GESTURE_TUNING.mirror,
    sensitivity: overrides.sensitivity ?? DEFAULT_GESTURE_TUNING.sensitivity,
    pointerSmoothing: overrides.pointerSmoothing ?? DEFAULT_GESTURE_TUNING.pointerSmoothing,
    pinchEnterRatio: overrides.pinchEnterRatio ?? DEFAULT_GESTURE_TUNING.pinchEnterRatio,
    pinchExitRatio: overrides.pinchExitRatio ?? DEFAULT_GESTURE_TUNING.pinchExitRatio,
    pinchClickMaxMs: overrides.pinchClickMaxMs ?? DEFAULT_GESTURE_TUNING.pinchClickMaxMs,
    pinchClickMoveTolerance:
      overrides.pinchClickMoveTolerance ?? DEFAULT_GESTURE_TUNING.pinchClickMoveTolerance,
    doubleClickWindowMs:
      overrides.doubleClickWindowMs ?? DEFAULT_GESTURE_TUNING.doubleClickWindowMs,
    dwellMs: overrides.dwellMs ?? DEFAULT_GESTURE_TUNING.dwellMs,
    swipeMinDistance: overrides.swipeMinDistance ?? DEFAULT_GESTURE_TUNING.swipeMinDistance,
    swipeMinVelocity: overrides.swipeMinVelocity ?? DEFAULT_GESTURE_TUNING.swipeMinVelocity,
    swipeDominance: overrides.swipeDominance ?? DEFAULT_GESTURE_TUNING.swipeDominance,
    swipeWindowMs: overrides.swipeWindowMs ?? DEFAULT_GESTURE_TUNING.swipeWindowMs,
    commandCooldownMs: overrides.commandCooldownMs ?? DEFAULT_GESTURE_TUNING.commandCooldownMs,
    postureHoldMs: overrides.postureHoldMs ?? DEFAULT_GESTURE_TUNING.postureHoldMs,
    handLostGraceMs: overrides.handLostGraceMs ?? DEFAULT_GESTURE_TUNING.handLostGraceMs,
    maxFps: overrides.maxFps ?? DEFAULT_GESTURE_TUNING.maxFps,
    activeRegion: resolveActiveRegion(overrides.activeRegion),
    oneEuroMinCutoff: overrides.oneEuroMinCutoff ?? DEFAULT_GESTURE_TUNING.oneEuroMinCutoff,
    oneEuroBeta: overrides.oneEuroBeta ?? DEFAULT_GESTURE_TUNING.oneEuroBeta,
  };
}

export function createGestureEngine(options: GestureEngineOptions = {}): GestureEngine {
  const tuning = resolveTuning(options);
  const observeOnly = options.observeOnly === true;
  const nominalFrameMs = 1000 / clamp(tuning.maxFps, 1, 240);
  const mapOptions = { mirror: tuning.mirror, activeRegion: tuning.activeRegion };

  const cursorFilterX = createOneEuroFilter({
    minCutoff: tuning.oneEuroMinCutoff,
    beta: tuning.oneEuroBeta,
  });
  const cursorFilterY = createOneEuroFilter({
    minCutoff: tuning.oneEuroMinCutoff,
    beta: tuning.oneEuroBeta,
  });

  let lastTimestamp: number | null = null;
  let tracking = false;
  let lastHandSeenAt = 0;

  let posture: GesturePosture = "none";
  let pendingPosture: GesturePosture = "none";
  let pendingSince = 0;
  let mode: GestureMode = "idle";
  let anchorKind: AnchorKind = "finger";

  let cursor: GestureCursor | null = null;
  let lastCursor: GestureCursor | null = null;
  let pointerSpeed = 0;

  let pinching = false;
  let dragging = false;
  let pinchStartedAt = 0;
  let pinchAnchor: GestureCursor | null = null;

  let palmHistory: SwipeSample[] = [];
  let cooldownUntil = 0;

  let fistStartedAt: number | null = null;
  let fistTriggered = false;
  let lastDwellProgress = -1;

  let debugPinchRatio = 0;
  let debugPalmOpenness = 0;

  function pushEvent(event: GestureFrameEvent, events: GestureFrameEvent[]): void {
    if (observeOnly && event.type !== "tracking" && event.type !== "mode") return;
    events.push(event);
  }

  function changeMode(next: GestureMode, events: GestureFrameEvent[]): void {
    if (mode === next) return;
    mode = next;
    pushEvent({ type: "mode", mode: next, posture }, events);
  }

  function fallbackMode(): GestureMode {
    if (posture === "point") return "pointer";
    if (posture === "open_palm") return "palm";
    if (posture === "fist") return "fist";
    return "idle";
  }

  function resetInteraction(): void {
    posture = "none";
    pendingPosture = "none";
    pendingSince = lastTimestamp ?? 0;
    mode = "idle";
    anchorKind = "finger";
    cursor = null;
    lastCursor = null;
    pointerSpeed = 0;
    pinching = false;
    dragging = false;
    pinchStartedAt = 0;
    pinchAnchor = null;
    palmHistory = [];
    cooldownUntil = 0;
    fistStartedAt = null;
    fistTriggered = false;
    lastDwellProgress = -1;
    debugPinchRatio = 0;
    debugPalmOpenness = 0;
    cursorFilterX.reset();
    cursorFilterY.reset();
  }

  function updatePosture(candidate: GesturePosture, timestamp: number): void {
    if (candidate !== pendingPosture) {
      pendingPosture = candidate;
      pendingSince = timestamp;
    }
    const changed = pendingPosture !== posture;
    // 首次锁定立即生效；后续切换需要保持 postureHoldMs，抑制单帧抖动。
    if (posture === "none" || (changed && timestamp - pendingSince >= tuning.postureHoldMs)) {
      posture = pendingPosture;
    }
  }

  function startPinch(timestamp: number, anchor: GestureCursor, events: GestureFrameEvent[]): void {
    pinching = true;
    dragging = false;
    pinchStartedAt = timestamp;
    pinchAnchor = anchor;
    changeMode("pinch", events);
    const point = cursor ?? anchor;
    pushEvent({ type: "pointer_down", x: point.x, y: point.y }, events);
  }

  function finishPinch(timestamp: number, events: GestureFrameEvent[]): void {
    const point = cursor ?? pinchAnchor ?? FALLBACK_POINT;
    const durationMs = Math.max(0, timestamp - pinchStartedAt);
    const click = !dragging && durationMs <= tuning.pinchClickMaxMs;
    pushEvent({ type: "pointer_up", x: point.x, y: point.y, click, durationMs }, events);
    pinching = false;
    dragging = false;
    pinchAnchor = null;
    changeMode(fallbackMode(), events);
  }

  function cancelPinchOnLost(timestamp: number, events: GestureFrameEvent[]): void {
    if (!pinching) return;
    const point = cursor ?? pinchAnchor ?? FALLBACK_POINT;
    const durationMs = Math.max(0, timestamp - pinchStartedAt);
    pushEvent({ type: "pointer_up", x: point.x, y: point.y, click: false, durationMs }, events);
    pinching = false;
    dragging = false;
    pinchAnchor = null;
  }

  function detectSwipe(point: GestureCursor, timestamp: number, events: GestureFrameEvent[]): void {
    palmHistory.push({ x: point.x, y: point.y, at: timestamp });
    const windowStart = timestamp - Math.max(0, tuning.swipeWindowMs);
    while (palmHistory.length > 0 && palmHistory[0].at < windowStart) {
      palmHistory.shift();
    }
    if (palmHistory.length < 2) return;

    const start = palmHistory[0];
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    const durationMs = timestamp - start.at;
    if (durationMs <= 0) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const horizontalDominance = absX >= absY * tuning.swipeDominance;
    const verticalDominance = absY >= absX * tuning.swipeDominance;
    if (!horizontalDominance && !verticalDominance) return;

    const axisDistance = horizontalDominance ? absX : absY;
    const velocity = Math.hypot(dx, dy) / (durationMs / 1000);
    if (axisDistance < tuning.swipeMinDistance || velocity < tuning.swipeMinVelocity) return;

    let command: GestureCommandId;
    if (horizontalDominance) {
      command = dx < 0 ? "swipe_left" : "swipe_right";
    } else {
      command = dy < 0 ? "swipe_up" : "swipe_down";
    }

    const confidence = clamp01(
      0.4 + 0.6 * Math.min(1, axisDistance / Math.max(1e-6, tuning.swipeMinDistance * 2))
    );
    pushEvent({ type: "command", command, x: point.x, y: point.y, confidence }, events);
    cooldownUntil = timestamp + Math.max(0, tuning.commandCooldownMs);
    palmHistory = [];
    changeMode("cooldown", events);
  }

  function updateFistDwell(timestamp: number, events: GestureFrameEvent[]): void {
    if (fistStartedAt === null) {
      fistStartedAt = timestamp;
      lastDwellProgress = -1;
    }
    const dwellMs = Math.max(1, tuning.dwellMs);
    const progress = clamp01((timestamp - fistStartedAt) / dwellMs);
    if (progress > lastDwellProgress + DWELL_PROGRESS_EPSILON || lastDwellProgress < 0) {
      lastDwellProgress = progress;
      pushEvent({ type: "dwell", command: "fist_hold", progress }, events);
    }
    if (progress < 1 || fistTriggered) return;

    // 只触发一次：fistTriggered 在姿态离开 fist 时复位，全局 cooldown 结束后可再次蓄力。
    fistTriggered = true;
    cooldownUntil = timestamp + Math.max(0, tuning.commandCooldownMs);
    const point = cursor ?? FALLBACK_POINT;
    pushEvent(
      { type: "command", command: "fist_hold", x: point.x, y: point.y, confidence: 1 },
      events
    );
    changeMode("cooldown", events);
  }

  function buildResult(
    timestamp: number,
    handPresent: boolean,
    events: GestureFrameEvent[]
  ): GestureFrameResult {
    return {
      timestamp,
      handPresent,
      posture: tracking ? posture : "none",
      mode: tracking ? mode : "idle",
      cursor: tracking ? cursor : null,
      pinching: tracking ? pinching : false,
      events,
      debug: {
        pinchRatio: tracking ? debugPinchRatio : 0,
        palmOpenness: tracking ? debugPalmOpenness : 0,
        pointerSpeed: tracking ? pointerSpeed : 0,
        posture: tracking ? posture : "none",
      },
    };
  }

  function processFrame(
    rawLandmarks: GestureLandmarks | null,
    rawTimestamp: number
  ): GestureFrameResult {
    const events: GestureFrameEvent[] = [];

    // 时间戳只允许单调递增；重复 / 乱序保留上一帧时间，NaN 用标称帧间隔兜底。
    let timestamp: number;
    if (Number.isFinite(rawTimestamp)) {
      timestamp = lastTimestamp === null ? rawTimestamp : Math.max(rawTimestamp, lastTimestamp);
    } else {
      timestamp = lastTimestamp === null ? 0 : lastTimestamp + nominalFrameMs;
    }
    const elapsedMs = lastTimestamp === null ? 0 : timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const handPresent = isGestureLandmarks(rawLandmarks);
    const landmarks = handPresent ? rawLandmarks : null;

    if (handPresent) {
      lastHandSeenAt = timestamp;
      if (!tracking) {
        tracking = true;
        resetInteraction();
        pushEvent({ type: "tracking", present: true }, events);
      }
    } else if (tracking && timestamp - lastHandSeenAt > tuning.handLostGraceMs) {
      cancelPinchOnLost(timestamp, events);
      tracking = false;
      posture = "none";
      pendingPosture = "none";
      pendingSince = timestamp;
      cursor = null;
      lastCursor = null;
      pointerSpeed = 0;
      palmHistory = [];
      fistStartedAt = null;
      fistTriggered = false;
      lastDwellProgress = -1;
      cooldownUntil = 0;
      debugPinchRatio = 0;
      debugPalmOpenness = 0;
      cursorFilterX.reset();
      cursorFilterY.reset();
      changeMode("idle", events);
      pushEvent({ type: "tracking", present: false }, events);
      return buildResult(timestamp, false, events);
    }

    if (!tracking || landmarks === null) {
      // 手丢失宽限期内：冻结光标与模式，等待手回到画面。
      pointerSpeed = 0;
      return buildResult(timestamp, false, events);
    }

    const rawPinch = pinchRatio(landmarks);
    const openness = palmOpenness(landmarks);
    debugPinchRatio = rawPinch;
    debugPalmOpenness = openness;
    updatePosture(classifyPosture(landmarks), timestamp);

    if (posture !== "open_palm") {
      palmHistory = [];
    }
    if (posture !== "fist") {
      fistStartedAt = null;
      fistTriggered = false;
      lastDwellProgress = -1;
    }

    const nextAnchorKind: AnchorKind =
      posture === "open_palm" || posture === "fist" ? "palm" : "finger";
    if (nextAnchorKind !== anchorKind) {
      anchorKind = nextAnchorKind;
      cursorFilterX.reset();
      cursorFilterY.reset();
    }

    const fingerPoint = mirrorAndMapPoint(landmarks[LANDMARK.INDEX_TIP], mapOptions);
    const palmPoint = mirrorAndMapPoint(palmCenter(landmarks), mapOptions);
    const targetPoint = anchorKind === "palm" ? palmPoint : fingerPoint;
    const filteredCursor: GestureCursor = {
      x: cursorFilterX.filter(targetPoint.x, timestamp),
      y: cursorFilterY.filter(targetPoint.y, timestamp),
    };
    const previousCursor = lastCursor;
    const cursorMoved =
      previousCursor !== null && distance2D(previousCursor, filteredCursor) > CURSOR_MOVE_EPSILON;
    const deltaSeconds = elapsedMs > 0 ? elapsedMs / 1000 : 0;
    pointerSpeed =
      previousCursor !== null && deltaSeconds > 0
        ? distance2D(previousCursor, filteredCursor) / deltaSeconds
        : 0;
    cursor = filteredCursor;
    lastCursor = filteredCursor;

    if (timestamp < cooldownUntil) {
      // 冷却期只保留光标跟随，不再触发任何离散动作。
      changeMode("cooldown", events);
      return buildResult(timestamp, true, events);
    }

    if (pinching) {
      const shouldRelease = rawPinch >= tuning.pinchExitRatio || posture !== "point";
      if (shouldRelease) {
        finishPinch(timestamp, events);
      } else {
        if (
          !dragging &&
          pinchAnchor !== null &&
          distance2D(palmPoint, pinchAnchor) > tuning.pinchClickMoveTolerance
        ) {
          dragging = true;
          changeMode("drag", events);
        }
        if (!dragging) {
          changeMode("pinch", events);
        }
        if (cursorMoved) {
          pushEvent({ type: "pointer_move", x: filteredCursor.x, y: filteredCursor.y }, events);
        }
      }
    } else if (posture === "point" && rawPinch <= tuning.pinchEnterRatio) {
      startPinch(timestamp, palmPoint, events);
    } else if (posture === "open_palm") {
      changeMode("palm", events);
      detectSwipe(palmPoint, timestamp, events);
    } else if (posture === "fist") {
      changeMode("fist", events);
      updateFistDwell(timestamp, events);
    } else {
      changeMode(fallbackMode(), events);
      if (posture === "point" && cursorMoved) {
        pushEvent({ type: "pointer_move", x: filteredCursor.x, y: filteredCursor.y }, events);
      }
    }

    return buildResult(timestamp, true, events);
  }

  function reset(): void {
    lastTimestamp = null;
    tracking = false;
    lastHandSeenAt = 0;
    resetInteraction();
  }

  return { processFrame, reset };
}
