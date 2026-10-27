/**
 * 手势摄像头设备层。
 *
 * 设计约束：
 * - 只做浏览器/Electron 摄像头 API 的薄封装，不依赖 React / Zustand；
 * - 所有异常统一映射为 GestureErrorState，文案面向普通用户（简体中文）；
 * - SSR 安全：模块顶层不访问 window / navigator，只在调用时读取。
 */

import type { GestureCameraDevice, GestureErrorState } from "./types";

/** 手势识别对分辨率的要求不高，640x480 足够且能显著降低 GPU 占用。 */
const DEFAULT_VIDEO_WIDTH = 640;
const DEFAULT_VIDEO_HEIGHT = 480;

export interface GestureCameraRequestOptions {
  /** 指定摄像头设备；为空时交给浏览器按 facingMode 选择。 */
  deviceId?: string | null;
}

/** 只声明手势层用到的能力；不用 extends MediaDevices，避免可选 getUserMedia 与必选签名冲突。 */
interface MediaDevicesLike {
  getUserMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
  enumerateDevices?: () => Promise<MediaDeviceInfo[]>;
}

function getMediaDevices(): MediaDevicesLike | null {
  if (typeof navigator === "undefined") return null;
  const mediaDevices = navigator.mediaDevices as MediaDevicesLike | undefined;
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") return null;
  return mediaDevices;
}

function getWindowLocation(): Location | null {
  if (typeof window === "undefined") return null;
  return window.location ?? null;
}

/** 浏览器规范把 localhost / 127.0.0.1 / [::1] 视为安全上下文。 */
function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

/**
 * Electron（渲染进程）与本地文件协议允许摄像头：
 * - 打包后应用通常以 file:// 加载，isSecureContext 可能为 false；
 * - preload 会暴露 window.electronAPI，或渲染进程带 Electron UA。
 */
function isElectronRuntime(): boolean {
  if (typeof window === "undefined") return false;
  if (window.electronAPI) return true;
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent)) return true;
  return false;
}

function isSecureCameraContext(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext === true) return true;

  const location = getWindowLocation();
  if (location) {
    if (location.protocol === "file:") return true;
    if (isLoopbackHost(location.hostname.toLowerCase())) return true;
  }

  return isElectronRuntime();
}

/**
 * 当前环境是否支持手势摄像头。
 *
 * 判定条件：mediaDevices.getUserMedia 存在 + 安全上下文（Electron / localhost 允许）。
 */
export function isGestureCameraSupported(): boolean {
  return getMediaDevices() !== null && isSecureCameraContext();
}

/**
 * 枚举视频输入设备。
 *
 * - 失败或环境不支持时返回空数组（调用方按“无可用摄像头”处理，不抛错）；
 * - 未授予权限时浏览器会隐藏 label，此时用「摄像头 N」兜底，保证下拉框可读。
 */
export async function listGestureCameras(): Promise<GestureCameraDevice[]> {
  const mediaDevices = getMediaDevices();
  if (!mediaDevices || typeof mediaDevices.enumerateDevices !== "function") return [];

  try {
    const devices = await mediaDevices.enumerateDevices();
    const cameras: GestureCameraDevice[] = [];
    for (const device of devices) {
      if (device.kind !== "videoinput") continue;
      const index = cameras.length + 1;
      const label = device.label?.trim();
      cameras.push({
        deviceId: device.deviceId,
        label: label && label.length > 0 ? label : `摄像头 ${index}`,
      });
    }
    return cameras;
  } catch {
    return [];
  }
}

function createCameraError(name: string, message: string): Error {
  if (typeof DOMException === "function") {
    return new DOMException(message, name);
  }
  const error = new Error(message);
  error.name = name;
  return error;
}

/**
 * 申请手势摄像头流。
 *
 * @throws NotSupportedError 环境不支持媒体设备
 * @throws SecurityError 非安全上下文（浏览器拒绝）
 * @throws 其他 getUserMedia 原生错误（由 describeCameraError 统一翻译）
 */
export async function requestGestureCamera(
  options: GestureCameraRequestOptions = {}
): Promise<MediaStream> {
  const mediaDevices = getMediaDevices();
  const getUserMedia = mediaDevices?.getUserMedia;
  if (!mediaDevices || typeof getUserMedia !== "function") {
    throw createCameraError("NotSupportedError", "当前环境不支持摄像头访问");
  }
  if (!isSecureCameraContext()) {
    throw createCameraError("SecurityError", "当前页面不是安全上下文，浏览器禁止访问摄像头");
  }

  const deviceId = options.deviceId?.trim();
  const video: MediaTrackConstraints = {
    width: { ideal: DEFAULT_VIDEO_WIDTH },
    height: { ideal: DEFAULT_VIDEO_HEIGHT },
    facingMode: "user",
  };
  if (deviceId) {
    // 用户显式选择设备时用 exact，避免浏览器回退到错误摄像头。
    video.deviceId = { exact: deviceId };
  }

  // 必须绑定回 MediaDevices 实例：浏览器把 getUserMedia 实现为需要正确 this 的 WebIDL 方法，
  // 提取成裸函数再调用会抛 "Illegal invocation"（真实浏览器必现，mock 测试容易漏掉）。
  return getUserMedia.call(mediaDevices, { audio: false, video });
}

/** 停止并释放摄像头流；重复调用、空流均安全。 */
export function stopGestureStream(stream: MediaStream | null | undefined): void {
  if (!stream || typeof stream.getTracks !== "function") return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // 流已经结束时部分浏览器重复 stop 会抛错，忽略即可。
    }
  }
}

function readErrorName(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const candidate = error as { name?: unknown };
  return typeof candidate.name === "string" ? candidate.name : "";
}

/**
 * 把 getUserMedia / 媒体相关异常翻译成中文可读的 GestureErrorState。
 *
 * recoverable 表示“用户调整后重试可能成功”：权限、设备、占用可恢复；
 * 环境不支持 / 非安全上下文需要换运行环境，视为不可恢复。
 */
export function describeCameraError(error: unknown): GestureErrorState {
  switch (readErrorName(error)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return {
        code: "permission_denied",
        message: "摄像头权限被拒绝",
        recoverable: true,
        hint: "请在地址栏的权限设置中允许访问摄像头，然后重试。",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return {
        code: "camera_not_found",
        message: "未找到可用的摄像头",
        recoverable: true,
        hint: "请确认摄像头已连接且未被禁用，也可以换一个摄像头设备重试。",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        code: "camera_busy",
        message: "摄像头无法启动，可能被其他应用占用",
        recoverable: true,
        hint: "请关闭其他正在使用摄像头的应用或标签页后重试。",
      };
    case "NotSupportedError":
      return {
        code: "unsupported",
        message: "当前环境不支持手势摄像头",
        recoverable: false,
        hint: "请使用支持摄像头访问的浏览器，或在 MIMI 桌面客户端中使用。",
      };
    case "SecurityError":
      return {
        code: "insecure_context",
        message: "当前页面不是安全上下文，无法访问摄像头",
        recoverable: false,
        hint: "请通过 localhost 或 HTTPS 打开应用。",
      };
    case "AbortError":
      return {
        code: "camera_failed",
        message: "摄像头启动被中断",
        recoverable: true,
        hint: "请重试；如果问题持续出现，请重启应用。",
      };
    default:
      return {
        code: "camera_failed",
        message: "摄像头启动失败",
        recoverable: true,
        hint: "请检查摄像头设备与系统隐私权限后重试。",
      };
  }
}
