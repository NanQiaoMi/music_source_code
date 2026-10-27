import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeCameraError,
  isGestureCameraSupported,
  listGestureCameras,
  requestGestureCamera,
  stopGestureStream,
} from "../camera";
import type { GestureErrorCode } from "../types";

const originalMediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

function installMediaDevices(mediaDevices: Partial<MediaDevices>): void {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: mediaDevices,
  });
}

function restoreMediaDevices(): void {
  if (originalMediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", originalMediaDevicesDescriptor);
    return;
  }
  Reflect.deleteProperty(navigator, "mediaDevices");
}

function createMediaDevice(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string
): MediaDeviceInfo {
  return { deviceId, kind, label, groupId: "group-1" } as MediaDeviceInfo;
}

function createStream(trackCount = 2): {
  stream: MediaStream;
  stops: Array<ReturnType<typeof vi.fn>>;
} {
  const stops = Array.from({ length: trackCount }, () => vi.fn());
  const stream = {
    getTracks: () => stops.map((stop) => ({ stop })),
  } as unknown as MediaStream;
  return { stream, stops };
}

function domError(name: string): Error {
  return new DOMException("测试错误", name);
}

afterEach(() => {
  restoreMediaDevices();
  vi.restoreAllMocks();
});

describe("isGestureCameraSupported", () => {
  it("缺少 mediaDevices 时返回 false", () => {
    restoreMediaDevices();
    expect(isGestureCameraSupported()).toBe(false);
  });

  it("存在 getUserMedia 且 localhost 环境时返回 true", () => {
    installMediaDevices({ getUserMedia: vi.fn() });
    expect(isGestureCameraSupported()).toBe(true);
  });

  it("mediaDevices 存在但缺少 getUserMedia 时返回 false", () => {
    installMediaDevices({});
    expect(isGestureCameraSupported()).toBe(false);
  });
});

describe("listGestureCameras", () => {
  it("只返回 videoinput，并用摄像头序号兜底空 label", async () => {
    const enumerateDevices = vi
      .fn()
      .mockResolvedValue([
        createMediaDevice("audio-1", "audioinput", "内置麦克风"),
        createMediaDevice("cam-1", "videoinput", "前置摄像头"),
        createMediaDevice("cam-2", "videoinput", "   "),
        createMediaDevice("cam-3", "videoinput", "USB 摄像头"),
      ]);
    installMediaDevices({ getUserMedia: vi.fn(), enumerateDevices });

    const cameras = await listGestureCameras();

    expect(cameras).toEqual([
      { deviceId: "cam-1", label: "前置摄像头" },
      { deviceId: "cam-2", label: "摄像头 2" },
      { deviceId: "cam-3", label: "USB 摄像头" },
    ]);
  });

  it("环境不支持时返回空数组", async () => {
    restoreMediaDevices();
    await expect(listGestureCameras()).resolves.toEqual([]);
  });

  it("enumerateDevices 失败时返回空数组而不是抛错", async () => {
    const enumerateDevices = vi.fn().mockRejectedValue(domError("NotAllowedError"));
    installMediaDevices({ getUserMedia: vi.fn(), enumerateDevices });

    await expect(listGestureCameras()).resolves.toEqual([]);
  });
});

describe("requestGestureCamera", () => {
  it("按 640x480 + facingMode user 申请视频流", async () => {
    const { stream } = createStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    installMediaDevices({ getUserMedia });

    await expect(requestGestureCamera()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
    });
  });

  it("以 MediaDevices 实例为 this 调用 getUserMedia（防 Illegal invocation）", async () => {
    const { stream } = createStream();
    const mediaDevices = {
      getUserMedia(this: unknown): Promise<MediaStream> {
        if (this !== mediaDevices) throw new TypeError("Illegal invocation");
        return Promise.resolve(stream);
      },
    };
    installMediaDevices(mediaDevices as unknown as Partial<MediaDevices>);

    await expect(requestGestureCamera()).resolves.toBe(stream);
  });

  it("指定 deviceId 时使用 exact 约束", async () => {
    const { stream } = createStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    installMediaDevices({ getUserMedia });

    await requestGestureCamera({ deviceId: "  cam-1  " });

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
        deviceId: { exact: "cam-1" },
      },
    });
  });

  it("环境不支持时抛出 NotSupportedError", async () => {
    restoreMediaDevices();
    await expect(requestGestureCamera()).rejects.toMatchObject({ name: "NotSupportedError" });
  });

  it("透传 getUserMedia 的原始错误", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(domError("NotAllowedError"));
    installMediaDevices({ getUserMedia });

    await expect(requestGestureCamera()).rejects.toMatchObject({ name: "NotAllowedError" });
  });
});

describe("stopGestureStream", () => {
  it("停止全部轨道", () => {
    const { stream, stops } = createStream(2);
    stopGestureStream(stream);
    for (const stop of stops) expect(stop).toHaveBeenCalledTimes(1);
  });

  it("空流与无轨道流均安全", () => {
    expect(() => stopGestureStream(null)).not.toThrow();
    expect(() => stopGestureStream(undefined)).not.toThrow();
    expect(() => stopGestureStream({} as MediaStream)).not.toThrow();
  });
});

describe("describeCameraError", () => {
  const cases: Array<[string, GestureErrorCode, boolean]> = [
    ["NotAllowedError", "permission_denied", true],
    ["PermissionDeniedError", "permission_denied", true],
    ["NotFoundError", "camera_not_found", true],
    ["DevicesNotFoundError", "camera_not_found", true],
    ["OverconstrainedError", "camera_not_found", true],
    ["ConstraintNotSatisfiedError", "camera_not_found", true],
    ["NotReadableError", "camera_busy", true],
    ["TrackStartError", "camera_busy", true],
    ["NotSupportedError", "unsupported", false],
    ["SecurityError", "insecure_context", false],
    ["AbortError", "camera_failed", true],
  ];

  it.each(cases)("把 %s 映射为 %s", (name, code, recoverable) => {
    const state = describeCameraError(domError(name));
    expect(state.code).toBe(code);
    expect(state.recoverable).toBe(recoverable);
    expect(state.message.length).toBeGreaterThan(0);
    expect(state.hint?.length ?? 0).toBeGreaterThan(0);
  });

  it("未知错误兜底为 camera_failed", () => {
    expect(describeCameraError(new Error("boom")).code).toBe("camera_failed");
    expect(describeCameraError("字符串错误").code).toBe("camera_failed");
    expect(describeCameraError(null).code).toBe("camera_failed");
  });

  it("错误文案为简体中文", () => {
    expect(describeCameraError(domError("NotAllowedError")).message).toContain("摄像头");
    expect(describeCameraError(domError("NotReadableError")).message).toContain("占用");
  });
});
