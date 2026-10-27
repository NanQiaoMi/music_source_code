"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useGestureStore } from "@/store/gestureStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import {
  createGestureTuning,
  type GestureErrorState,
  type GestureFrameResult,
  type GestureLandmarks,
  type GestureMode,
  type GesturePosture,
} from "@/lib/gesture/types";
import { createGestureEngine, type GestureEngine } from "@/lib/gesture/engine";
import { GestureTrackerError, createHandTracker, type HandTracker } from "@/lib/gesture/tracker";
import {
  describeCameraError,
  isGestureCameraSupported,
  requestGestureCamera,
  stopGestureStream,
} from "@/lib/gesture/camera";
import { GesturePointerBridge } from "@/lib/gesture/pointerBridge";
import { executeGestureAction, resolveGestureActionForCommand } from "@/lib/gesture/actions";

const HAND_CONNECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

const KEY_LANDMARKS = new Set([4, 8]);

const SUPPORT_HINT = "请使用 Chrome / Edge 等支持摄像头的浏览器，并通过 https 或 localhost 访问。";
const DEVICE_HINT = "请检查摄像头是否连接正常，或关闭占用摄像头的其它应用后重试。";
const MODEL_HINT =
  "本地模型加载失败时会自动回退 CDN；若仍失败，请检查网络或执行 npm run sync:mediapipe 同步本地资产。";

interface GestureDebugReplayFrame {
  landmarks: GestureLandmarks | null;
  timestamp: number;
}

interface GestureDebugApi {
  feed: (landmarks: GestureLandmarks | null, timestamp?: number) => GestureFrameResult | null;
  replay: (frames: GestureDebugReplayFrame[]) => void;
  state: () => ReturnType<typeof useGestureStore.getState>;
}

declare global {
  interface Window {
    __gestureDebug?: GestureDebugApi;
  }
}

export interface GestureSessionController {
  retry: () => void;
  resetInProgress: boolean;
}

interface UseGestureSessionOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

function waitForVideo(
  videoRef: RefObject<HTMLVideoElement | null>,
  isCancelled: () => boolean
): Promise<HTMLVideoElement | null> {
  const existing = videoRef.current;
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const video = videoRef.current;
      if (video || isCancelled() || attempts > 40) {
        clearInterval(timer);
        resolve(isCancelled() ? null : video);
      }
    }, 25);
  });
}

function waitForVideoReady(video: HTMLVideoElement, isCancelled: () => boolean): Promise<boolean> {
  if (video.readyState >= 2) return Promise.resolve(true);

  return new Promise((resolve) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (video.readyState >= 2) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (isCancelled() || attempts > 120) {
        clearInterval(timer);
        resolve(false);
      }
    }, 25);
  });
}

function trackerErrorState(error: unknown): GestureErrorState {
  if (error instanceof GestureTrackerError) {
    return {
      code: error.code === "model_load_failed" ? "model_load_failed" : "tracker_failed",
      message: error.code === "model_load_failed" ? "手势识别模型加载失败" : "手部识别引擎运行异常",
      hint: MODEL_HINT,
      recoverable: true,
    };
  }
  return {
    code: "unknown",
    message: "手势识别初始化失败",
    hint: MODEL_HINT,
    recoverable: true,
  };
}

/**
 * 手势会话编排。
 *
 * 只做“连接与调度”：摄像头 → MediaPipe → 纯引擎 → 指针桥 / 动作 → runtime store。
 * 不渲染任何 UI，因此可以独立测试、也可以被设置面板的“测试模式”复用。
 *
 * 生命周期要点：
 * - effect 只依赖 enabled / cameraDeviceId / retryToken，显示开关变化不会重启摄像头；
 * - 用 cancelled 标记 + 资源局部变量保证 StrictMode 双执行与快速开关时幂等清理；
 * - 页面隐藏时暂停推理并关闭视频轨道（省电、关指示灯），恢复后重建时间基准。
 */
export function useGestureSession({
  videoRef,
  canvasRef,
}: UseGestureSessionOptions): GestureSessionController {
  const enabled = useGestureSettingsStore((state) => state.enabled);
  const cameraDeviceId = useGestureSettingsStore((state) => state.cameraDeviceId);
  const sensitivity = useGestureSettingsStore((state) => state.sensitivity);
  const pointerSmoothing = useGestureSettingsStore((state) => state.pointerSmoothing);
  const mirror = useGestureSettingsStore((state) => state.mirror);

  const [retryToken, setRetryToken] = useState(0);
  const engineRef = useRef<GestureEngine | null>(null);

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  // 灵敏度 / 平滑度 / 镜像变更只重建纯引擎（廉价），不重启摄像头。
  useEffect(() => {
    if (!enabled) return;
    const settings = useGestureSettingsStore.getState();
    engineRef.current = createGestureEngine(createGestureTuning(settings));
  }, [enabled, sensitivity, pointerSmoothing, mirror]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let tracker: HandTracker | null = null;
    let bridge: GesturePointerBridge | null = null;
    let rafHandle = 0;
    let videoFrameHandle = 0;
    let running = false;
    let lastDetectAt = -1;
    let lastVideoTime = -1;
    let lastMediaTimestamp = 0;
    let consecutiveErrors = 0;
    let fpsWindowStart = 0;
    let fpsFrames = 0;
    // 开发调试桥注入合成帧后，短暂跳过真实 tracker，避免 fake camera 的空帧
    // 与合成帧交替导致 handPresent/捏合状态抖动。
    let debugOverrideUntil = 0;
    const videoTracks: MediaStreamTrack[] = [];

    const runtime = useGestureStore.getState();
    const isCancelled = () => cancelled;
    const tuning = createGestureTuning(useGestureSettingsStore.getState());
    const state = {
      handPresent: false,
      posture: "none" as GesturePosture,
      mode: "idle" as GestureMode,
      pinching: false,
      dragging: false,
      cursorVisible: false,
    };
    let lastCursor = { x: -1, y: -1 };
    let lastBridgeCursor = { x: -1, y: -1 };
    let lastDwellProgress = -1;

    const fail = (error: GestureErrorState) => {
      runtime.setError(error);
      runtime.setStatus("error");
      runtime.setHandPresent(false);
      runtime.setCursorVisible(false);
      runtime.setPinching(false);
      runtime.setDragging(false);
      runtime.setDwell(null);
      running = false;
      bridge?.cancel();
      if (tracker) {
        tracker.dispose();
        tracker = null;
      }
      stopGestureStream(stream);
      stream = null;
      videoTracks.length = 0;
      runtime.setCameraActive(false);
    };

    const drawSkeleton = (landmarks: GestureLandmarks) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "rgba(48, 209, 88, 0.78)";
      context.lineWidth = 2;
      context.lineCap = "round";
      for (const connection of HAND_CONNECTIONS) {
        const from = landmarks[connection[0]];
        const to = landmarks[connection[1]];
        context.beginPath();
        context.moveTo(from.x * width, from.y * height);
        context.lineTo(to.x * width, to.y * height);
        context.stroke();
      }
      for (let index = 0; index < landmarks.length; index += 1) {
        const point = landmarks[index];
        const key = KEY_LANDMARKS.has(index);
        context.beginPath();
        context.arc(point.x * width, point.y * height, key ? 5 : 3, 0, Math.PI * 2);
        context.fillStyle = key ? "#ffd60a" : index === 0 ? "#ff6b6b" : "#ffffff";
        context.fill();
      }
    };

    const applyCommand = (command: Parameters<typeof resolveGestureActionForCommand>[0]) => {
      const bindings = useGestureSettingsStore.getState().bindings;
      const action = resolveGestureActionForCommand(command, bindings);
      const outcome = executeGestureAction(action);
      runtime.pushEvent({
        action: outcome.action,
        command,
        label: outcome.label,
        detail: outcome.detail,
        tone: outcome.tone,
      });
    };

    const applyFrame = (result: GestureFrameResult) => {
      const settings = useGestureSettingsStore.getState();

      if (result.handPresent !== state.handPresent) {
        state.handPresent = result.handPresent;
        runtime.setHandPresent(result.handPresent);
      }
      if (!result.handPresent) {
        if (state.cursorVisible) {
          state.cursorVisible = false;
          runtime.setCursorVisible(false);
        }
        if (state.pinching) {
          state.pinching = false;
          runtime.setPinching(false);
        }
        if (state.dragging) {
          state.dragging = false;
          runtime.setDragging(false);
        }
        if (lastDwellProgress !== -1) {
          lastDwellProgress = -1;
          runtime.setDwell(null);
        }
      }

      if (result.posture !== state.posture) {
        state.posture = result.posture;
        runtime.setPosture(result.posture);
      }
      if (result.mode !== state.mode) {
        state.mode = result.mode;
        runtime.setMode(result.mode);
      }
      if (result.pinching !== state.pinching) {
        state.pinching = result.pinching;
        runtime.setPinching(result.pinching);
      }
      const dragging = result.mode === "drag";
      if (dragging !== state.dragging) {
        state.dragging = dragging;
        runtime.setDragging(dragging);
      }

      const cursorVisible =
        result.cursor !== null &&
        (result.mode === "pointer" || result.mode === "pinch" || result.mode === "drag");

      if (result.cursor) {
        const deltaX = Math.abs(result.cursor.x - lastCursor.x);
        const deltaY = Math.abs(result.cursor.y - lastCursor.y);
        if (deltaX > 0.0008 || deltaY > 0.0008) {
          lastCursor = { x: result.cursor.x, y: result.cursor.y };
          runtime.setCursor(result.cursor.x, result.cursor.y);
        }
        // 指针桥必须拿到“当前帧光标”，否则手出现后不移动直接捏合会没有 hover 目标。
        if (cursorVisible) {
          const bridgeDeltaX = Math.abs(result.cursor.x - lastBridgeCursor.x);
          const bridgeDeltaY = Math.abs(result.cursor.y - lastBridgeCursor.y);
          if (bridgeDeltaX > 0.0008 || bridgeDeltaY > 0.0008) {
            lastBridgeCursor = { x: result.cursor.x, y: result.cursor.y };
            bridge?.moveTo(result.cursor.x, result.cursor.y);
          }
        }
      }
      if (cursorVisible !== state.cursorVisible) {
        state.cursorVisible = cursorVisible;
        runtime.setCursorVisible(cursorVisible);
      }

      runtime.setDebug(result.debug);

      for (const event of result.events) {
        switch (event.type) {
          case "pointer_move":
            // 光标移动已按 result.cursor 统一派发，这里不重复 move。
            break;
          case "pointer_down":
            bridge?.press();
            break;
          case "pointer_up":
            bridge?.release({ click: event.click });
            break;
          case "command":
            runtime.setDwell(null);
            lastDwellProgress = -1;
            if (settings.enabled) applyCommand(event.command);
            break;
          case "dwell": {
            if (Math.abs(event.progress - lastDwellProgress) > 0.01 || event.progress >= 1) {
              lastDwellProgress = event.progress;
              runtime.setDwell({ command: event.command, progress: event.progress });
            }
            break;
          }
          case "tracking":
            if (!event.present) {
              bridge?.cancel();
              runtime.setDwell(null);
              lastDwellProgress = -1;
            }
            break;
          default:
            break;
        }
      }
    };

    const detectOnce = (timestamp: number) => {
      if (timestamp < debugOverrideUntil) return;
      const video = videoRef.current;
      const engine = engineRef.current;
      if (!video || !tracker || !engine || cancelled || !running) return;
      if (video.readyState < 2) return;
      if (video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      if (timestamp - lastDetectAt < 1000 / tuning.maxFps - 2) return;
      lastDetectAt = timestamp;

      const settings = useGestureSettingsStore.getState();
      let landmarks: GestureLandmarks | null = null;
      try {
        lastMediaTimestamp = Math.max(lastMediaTimestamp + 0.01, timestamp);
        landmarks = tracker.detect(video, lastMediaTimestamp);
        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) {
          fail(trackerErrorState(error));
        }
        return;
      }

      if (cancelled || !running) return;
      if (landmarks && settings.showSkeleton) drawSkeleton(landmarks);
      else if (!landmarks && canvasRef.current) {
        const context = canvasRef.current.getContext("2d");
        context?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      const engineResult = engine.processFrame(landmarks, timestamp);
      applyFrame(engineResult);

      fpsFrames += 1;
      if (fpsWindowStart === 0) fpsWindowStart = timestamp;
      const elapsed = timestamp - fpsWindowStart;
      if (elapsed >= 1000) {
        runtime.setFps(Math.round((fpsFrames * 1000) / elapsed));
        fpsFrames = 0;
        fpsWindowStart = timestamp;
      }
    };

    const scheduleNextFrame = () => {
      if (cancelled || !running) return;
      const video = videoRef.current;
      if (!video) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        videoFrameHandle = video.requestVideoFrameCallback((now: number) => {
          detectOnce(now);
          scheduleNextFrame();
        });
        return;
      }
      rafHandle = requestAnimationFrame((now: number) => {
        detectOnce(now);
        scheduleNextFrame();
      });
    };

    const cancelLoop = () => {
      const video = videoRef.current;
      if (rafHandle) {
        cancelAnimationFrame(rafHandle);
        rafHandle = 0;
      }
      if (videoFrameHandle && video && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(videoFrameHandle);
      }
      videoFrameHandle = 0;
    };

    const handleTrackEnded = () => {
      if (cancelled) return;
      fail({
        code: "camera_failed",
        message: "摄像头连接已中断",
        hint: DEVICE_HINT,
        recoverable: true,
      });
    };

    const handleVisibilityChange = () => {
      if (cancelled || !running) return;
      if (document.visibilityState === "hidden") {
        cancelLoop();
        bridge?.cancel();
        runtime.setStatus("paused");
        runtime.setCursorVisible(false);
        runtime.setPinching(false);
        runtime.setDragging(false);
        runtime.setDwell(null);
        for (const track of videoTracks) track.enabled = false;
        engineRef.current?.reset();
        return;
      }
      runtime.setStatus("running");
      for (const track of videoTracks) track.enabled = true;
      engineRef.current?.reset();
      lastDetectAt = -1;
      lastVideoTime = -1;
      lastMediaTimestamp = 0;
      scheduleNextFrame();
    };

    const setupDebugApi = () => {
      if (process.env.NODE_ENV === "production") return;
      const engine = engineRef.current;
      if (!engine) return;
      window.__gestureDebug = {
        feed: (landmarks, timestamp = performance.now()) => {
          if (!engineRef.current) return null;
          debugOverrideUntil = performance.now() + 400;
          const result = engineRef.current.processFrame(landmarks, timestamp);
          if (landmarks) drawSkeleton(landmarks);
          applyFrame(result);
          return result;
        },
        replay: (frames) => {
          debugOverrideUntil = performance.now() + 400 + frames.length * 50;
          for (const frame of frames) {
            if (!engineRef.current) return;
            const result = engineRef.current.processFrame(frame.landmarks, frame.timestamp);
            if (frame.landmarks) drawSkeleton(frame.landmarks);
            applyFrame(result);
          }
        },
        state: () => useGestureStore.getState(),
      };
    };

    const init = async () => {
      const settings = useGestureSettingsStore.getState();
      runtime.setStatus("loading_assets");
      runtime.setError(null);
      runtime.setCameraActive(false);
      runtime.setModelReady(false);
      runtime.setBackend(null);
      runtime.setFps(0);
      runtime.resetRuntime();
      runtime.setStatus("loading_assets");

      const video = await waitForVideo(videoRef, isCancelled);
      if (cancelled) return;
      if (!video) {
        fail({
          code: "unsupported",
          message: "找不到摄像头预览节点",
          hint: "请刷新页面后重试。",
          recoverable: true,
        });
        return;
      }

      if (!isGestureCameraSupported()) {
        const insecure = typeof window !== "undefined" && !window.isSecureContext;
        fail({
          code: insecure ? "insecure_context" : "unsupported",
          message: insecure ? "当前环境不是安全上下文" : "当前浏览器不支持摄像头访问",
          hint: SUPPORT_HINT,
          recoverable: false,
        });
        return;
      }

      if (!engineRef.current) {
        engineRef.current = createGestureEngine(createGestureTuning(settings));
      }

      runtime.setStatus("requesting_camera");
      const cameraPromise = requestGestureCamera({ deviceId: cameraDeviceId });
      const trackerPromise = createHandTracker().then(
        (result) => ({ ok: true as const, result }),
        (error: unknown) => ({ ok: false as const, error })
      );
      const cameraSettled = await cameraPromise.then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error })
      );

      if (cancelled) {
        stopGestureStream(cameraSettled.ok ? cameraSettled.value : null);
        void trackerPromise.then((pendingTracker) => {
          if (pendingTracker.ok) pendingTracker.result.tracker.dispose();
        });
        return;
      }
      if (!cameraSettled.ok) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[gesture] requestGestureCamera failed", cameraSettled.error);
        }
        const cameraError = describeCameraError(cameraSettled.error);
        const pendingTracker = await trackerPromise;
        if (pendingTracker.ok) pendingTracker.result.tracker.dispose();
        fail(cameraError);
        return;
      }
      stream = cameraSettled.value;

      const trackerSettled = await trackerPromise;
      if (cancelled) {
        stopGestureStream(stream);
        stream = null;
        if (trackerSettled.ok) trackerSettled.result.tracker.dispose();
        return;
      }
      if (!trackerSettled.ok) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[gesture] createHandTracker failed", trackerSettled.error);
        }
        stopGestureStream(stream);
        stream = null;
        runtime.setCameraActive(false);
        fail(trackerErrorState(trackerSettled.error));
        return;
      }
      tracker = trackerSettled.result.tracker;
      runtime.setModelReady(true);
      runtime.setBackend(trackerSettled.result.backend);

      video.srcObject = stream;
      try {
        await video.play();
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[gesture] video.play failed", error);
        }
        const cameraError = describeCameraError(error);
        fail(cameraError);
        return;
      }
      if (cancelled) return;

      const videoReady = await waitForVideoReady(video, isCancelled);
      if (cancelled) return;
      if (!videoReady) {
        fail({
          code: "camera_failed",
          message: "摄像头没有返回画面",
          hint: DEVICE_HINT,
          recoverable: true,
        });
        return;
      }

      const tracks = stream.getVideoTracks();
      videoTracks.push(...tracks);
      for (const track of tracks) track.addEventListener("ended", handleTrackEnded);

      runtime.setCameraActive(true);
      runtime.setStatus("running");
      running = true;
      bridge = new GesturePointerBridge({
        doubleClickWindowMs: tuning.doubleClickWindowMs,
      });
      setupDebugApi();
      document.addEventListener("visibilitychange", handleVisibilityChange);
      scheduleNextFrame();
    };

    init().catch((error: unknown) => {
      if (cancelled) return;
      fail({
        code: "unknown",
        message: "手势会话启动失败",
        hint: error instanceof Error ? error.message : MODEL_HINT,
        recoverable: true,
      });
    });

    return () => {
      cancelled = true;
      running = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelLoop();
      bridge?.cancel();
      bridge?.dispose();
      bridge = null;
      for (const track of videoTracks) {
        track.removeEventListener("ended", handleTrackEnded);
        track.enabled = true;
      }
      stopGestureStream(stream);
      stream = null;
      if (tracker) {
        try {
          tracker.dispose();
        } catch {
          // 释放失败不应阻塞清理
        }
        tracker = null;
      }
      // HUD 在会话期间保持同一 video/canvas 节点（显示/折叠/错误态只切换可见 UI），
      // 因此 cleanup 读取当前 ref 是安全的；这里刻意不把节点缓存到 effect 顶部。
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (typeof window !== "undefined" && window.__gestureDebug) {
        delete window.__gestureDebug;
      }
      engineRef.current?.reset();
      const store = useGestureStore.getState();
      store.resetRuntime();
      store.setModelReady(false);
      store.setBackend(null);
    };
  }, [enabled, cameraDeviceId, retryToken, videoRef, canvasRef]);

  return { retry, resetInProgress: false };
}
