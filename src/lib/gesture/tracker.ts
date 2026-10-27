/**
 * MediaPipe HandLandmarker 手部跟踪器。
 *
 * 设计约束：
 * - 动态 import("@mediapipe/tasks-vision")：避免 Next.js 服务端渲染阶段打包/执行 wasm 运行时；
 * - 资产本地优先（public/mediapipe），本地不可用时回退到 jsDelivr 固定版本 CDN；
 * - 每个资产档位内部再做 GPU -> CPU delegate 回退；
 * - 所有加载/推理异常统一包装成 GestureTrackerError，交给上层映射为界面提示。
 */

import { isGestureLandmarks, type GestureLandmarks } from "./types";

export type GestureTrackerBackend = "local" | "cdn";

export interface HandTracker {
  /**
   * 视频模式检测一帧；没有手返回 null。
   * 同一实例的 timestampMs 必须递增（MediaPipe 要求），重复/回退的时间戳内部自动 +1ms 兜底。
   */
  detect(video: HTMLVideoElement, timestampMs: number): GestureLandmarks | null;
  /** 释放 MediaPipe 原生资源；幂等。 */
  dispose(): void;
}

export interface CreateHandTrackerOptions {
  /** 资产根目录，默认 process.env.NEXT_PUBLIC_MEDIAPIPE_ASSET_BASE || "/mediapipe"。 */
  assetBase?: string;
}

export type GestureTrackerErrorCode = "model_load_failed" | "tracker_failed";

export class GestureTrackerError extends Error {
  readonly code: GestureTrackerErrorCode;

  constructor(code: GestureTrackerErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "GestureTrackerError";
    this.code = code;
    if (options && options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

type VisionModule = typeof import("@mediapipe/tasks-vision");
type HandLandmarkerInstance = import("@mediapipe/tasks-vision").HandLandmarker;

const DEFAULT_ASSET_BASE = "/mediapipe";
const LOCAL_WASM_DIR = "wasm";
const LOCAL_MODEL_PATH = "models/hand_landmarker.task";
/** CDN 版本必须与 package.json 中 @mediapipe/tasks-vision 保持一致，避免 wasm 与 JS 协议不匹配。 */
const CDN_WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const CDN_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const DELEGATE_PREFERENCE = ["GPU", "CPU"] as const;

const HAND_LANDMARKER_OPTIONS = {
  runningMode: "VIDEO" as const,
  numHands: 1,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

interface AssetSource {
  backend: GestureTrackerBackend;
  label: string;
  wasmBase: string;
  modelUrl: string;
}

function readEnvAssetBase(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const configured = process.env.NEXT_PUBLIC_MEDIAPIPE_ASSET_BASE;
  return configured?.trim() || undefined;
}

function normalizeAssetBase(assetBase?: string): string {
  const configured = assetBase?.trim() || readEnvAssetBase() || DEFAULT_ASSET_BASE;
  const trimmed = configured.replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : DEFAULT_ASSET_BASE;
}

function resolveAssetSources(assetBase?: string): AssetSource[] {
  const base = normalizeAssetBase(assetBase);
  return [
    {
      backend: "local",
      label: "本地资源",
      wasmBase: base + "/" + LOCAL_WASM_DIR,
      modelUrl: base + "/" + LOCAL_MODEL_PATH,
    },
    {
      backend: "cdn",
      label: "在线 CDN",
      wasmBase: CDN_WASM_BASE,
      modelUrl: CDN_MODEL_URL,
    },
  ];
}

function describeErrorSummary(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return "未知错误";
}

/**
 * 在同一个资产档位内按 GPU -> CPU 顺序创建 HandLandmarker。
 * wasm fileset 只解析一次，delegate 失败时复用 fileset 重试，避免重复下载。
 */
async function createLandmarker(
  vision: VisionModule,
  source: AssetSource
): Promise<HandLandmarkerInstance> {
  const fileset = await vision.FilesetResolver.forVisionTasks(source.wasmBase);
  let lastError: unknown = null;

  for (const delegate of DELEGATE_PREFERENCE) {
    try {
      return await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: source.modelUrl, delegate },
        ...HAND_LANDMARKER_OPTIONS,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(source.label + "手部模型初始化失败");
}

function createTrackerInstance(landmarker: HandLandmarkerInstance): HandTracker {
  let disposed = false;
  let lastTimestampMs: number | null = null;

  /** MediaPipe 视频模式要求时间戳严格递增：重复/回退的时间戳自动 +1ms 兜底。 */
  const normalizeTimestamp = (timestampMs: number): number => {
    const frameTimestamp = Number.isFinite(timestampMs) ? Math.max(0, Math.floor(timestampMs)) : 0;
    if (lastTimestampMs === null) {
      lastTimestampMs = frameTimestamp;
      return frameTimestamp;
    }
    const nextTimestamp = Math.max(lastTimestampMs + 1, frameTimestamp);
    lastTimestampMs = nextTimestamp;
    return nextTimestamp;
  };

  return {
    detect(video, timestampMs) {
      if (disposed) {
        throw new GestureTrackerError("tracker_failed", "手部跟踪器已释放，无法继续识别。");
      }
      try {
        const result = landmarker.detectForVideo(video, normalizeTimestamp(timestampMs));
        const firstHand = result.landmarks[0];
        return isGestureLandmarks(firstHand) ? firstHand : null;
      } catch (error) {
        if (error instanceof GestureTrackerError) throw error;
        throw new GestureTrackerError("tracker_failed", "手部关键点识别失败。", { cause: error });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lastTimestampMs = null;
      try {
        landmarker.close();
      } catch {
        // close 在已释放/上下文丢失时可能抛错，释放流程不应把异常抛给上层。
      }
    },
  };
}

/**
 * 创建手部跟踪器。
 *
 * 顺序：本地 wasm + 本地模型（GPU -> CPU）-> CDN wasm + CDN 模型（GPU -> CPU）。
 * 全部失败时抛出 code = model_load_failed 的 GestureTrackerError，附带每次尝试的失败摘要。
 */
export async function createHandTracker(
  options: CreateHandTrackerOptions = {}
): Promise<{ tracker: HandTracker; backend: GestureTrackerBackend }> {
  let vision: VisionModule;
  try {
    vision = await import("@mediapipe/tasks-vision");
  } catch (error) {
    throw new GestureTrackerError("model_load_failed", "手部识别模块加载失败，请检查网络或重试。", {
      cause: error,
    });
  }

  const sources = resolveAssetSources(options.assetBase);
  const failureSummaries: string[] = [];
  let lastError: unknown = null;

  for (const source of sources) {
    try {
      const landmarker = await createLandmarker(vision, source);
      return { tracker: createTrackerInstance(landmarker), backend: source.backend };
    } catch (error) {
      lastError = error;
      failureSummaries.push(source.label + "：" + describeErrorSummary(error));
    }
  }

  throw new GestureTrackerError(
    "model_load_failed",
    "手部识别模型加载失败，本地资源与在线 CDN 均不可用（" + failureSummaries.join("；") + "）",
    { cause: lastError }
  );
}
