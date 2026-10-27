import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHandTracker, GestureTrackerError, type HandTracker } from "../tracker";

const visionMock = vi.hoisted(() => ({
  forVisionTasks: vi.fn(),
  createFromOptions: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: visionMock.forVisionTasks },
  HandLandmarker: { createFromOptions: visionMock.createFromOptions },
}));

const CDN_WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const CDN_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const LOCAL_WASM_BASE = "/mediapipe/wasm";
const LOCAL_MODEL_URL = "/mediapipe/models/hand_landmarker.task";

interface LandmarkerStub {
  detectForVideo: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

interface CreateFromOptionsArgs {
  baseOptions: { modelAssetPath: string; delegate?: string };
  runningMode?: string;
  numHands?: number;
}

function createLandmarkerStub(): LandmarkerStub {
  return {
    detectForVideo: vi.fn(() => ({ landmarks: [] })),
    close: vi.fn(),
  };
}

function createLandmarks(): Array<{ x: number; y: number; z: number }> {
  return Array.from({ length: 21 }, (_, index) => ({
    x: 0.1 + index * 0.01,
    y: 0.5,
    z: 0,
  }));
}

function createVideo(): HTMLVideoElement {
  return document.createElement("video");
}

function createFromOptionsCall(index: number): [unknown, CreateFromOptionsArgs] {
  return visionMock.createFromOptions.mock.calls[index] as [unknown, CreateFromOptionsArgs];
}

function collectDelegates(): Array<string | undefined> {
  return visionMock.createFromOptions.mock.calls.map(
    (_call, index) => createFromOptionsCall(index)[1].baseOptions.delegate
  );
}

function collectModelPaths(): string[] {
  return visionMock.createFromOptions.mock.calls.map(
    (_call, index) => createFromOptionsCall(index)[1].baseOptions.modelAssetPath
  );
}

beforeEach(() => {
  visionMock.forVisionTasks.mockReset();
  visionMock.createFromOptions.mockReset();
  visionMock.forVisionTasks.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function createTracker(): Promise<{ tracker: HandTracker; close: ReturnType<typeof vi.fn> }> {
  const landmarker = createLandmarkerStub();
  visionMock.createFromOptions.mockResolvedValue(landmarker);
  const { tracker } = await createHandTracker();
  return { tracker, close: landmarker.close };
}

describe("createHandTracker 资产加载", () => {
  it("本地资源 + GPU 成功时返回 backend=local", async () => {
    const landmarker = createLandmarkerStub();
    visionMock.createFromOptions.mockResolvedValue(landmarker);

    const result = await createHandTracker();

    expect(result.backend).toBe("local");
    expect(result.tracker).toBeDefined();
    expect(visionMock.forVisionTasks).toHaveBeenCalledTimes(1);
    expect(visionMock.forVisionTasks).toHaveBeenCalledWith(LOCAL_WASM_BASE);
    const options = createFromOptionsCall(0)[1];
    expect(options.baseOptions).toEqual({ modelAssetPath: LOCAL_MODEL_URL, delegate: "GPU" });
    expect(options.runningMode).toBe("VIDEO");
    expect(options.numHands).toBe(1);
  });

  it("本地 GPU 失败后回退 CPU", async () => {
    const landmarker = createLandmarkerStub();
    visionMock.createFromOptions
      .mockRejectedValueOnce(new Error("GPU delegate 不可用"))
      .mockResolvedValueOnce(landmarker);

    const result = await createHandTracker();

    expect(result.backend).toBe("local");
    expect(collectDelegates()).toEqual(["GPU", "CPU"]);
    expect(collectModelPaths()).toEqual([LOCAL_MODEL_URL, LOCAL_MODEL_URL]);
  });

  it("本地两种 delegate 均失败后回退 CDN", async () => {
    const landmarker = createLandmarkerStub();
    visionMock.createFromOptions.mockImplementation(
      (_fileset: unknown, options: CreateFromOptionsArgs) => {
        if (
          options.baseOptions.modelAssetPath === CDN_MODEL_URL &&
          options.baseOptions.delegate === "GPU"
        ) {
          return Promise.resolve(landmarker);
        }
        return Promise.reject(new Error("本地资产加载失败"));
      }
    );

    const result = await createHandTracker({ assetBase: "/custom-assets" });

    expect(result.backend).toBe("cdn");
    expect(visionMock.forVisionTasks).toHaveBeenNthCalledWith(1, "/custom-assets/wasm");
    expect(visionMock.forVisionTasks).toHaveBeenNthCalledWith(2, CDN_WASM_BASE);
    expect(collectDelegates()).toEqual(["GPU", "CPU", "GPU"]);
    expect(collectModelPaths()).toEqual([
      "/custom-assets/models/hand_landmarker.task",
      "/custom-assets/models/hand_landmarker.task",
      CDN_MODEL_URL,
    ]);
  });

  it("本地 wasm 解析失败时也回退 CDN", async () => {
    const landmarker = createLandmarkerStub();
    visionMock.forVisionTasks.mockImplementation((basePath: string) =>
      basePath === CDN_WASM_BASE
        ? Promise.resolve({})
        : Promise.reject(new Error("本地 wasm 不存在"))
    );
    visionMock.createFromOptions.mockResolvedValue(landmarker);

    const result = await createHandTracker();

    expect(result.backend).toBe("cdn");
    expect(visionMock.forVisionTasks).toHaveBeenCalledTimes(2);
    expect(collectModelPaths()).toEqual([CDN_MODEL_URL]);
  });

  it("assetBase 末尾斜杠会被归一化", async () => {
    visionMock.createFromOptions.mockResolvedValue(createLandmarkerStub());

    await createHandTracker({ assetBase: "/mediapipe/" });

    expect(visionMock.forVisionTasks).toHaveBeenCalledWith("/mediapipe/wasm");
    expect(collectModelPaths()[0]).toBe("/mediapipe/models/hand_landmarker.task");
  });

  it("默认 assetBase 读取 NEXT_PUBLIC_MEDIAPIPE_ASSET_BASE", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIAPIPE_ASSET_BASE", "/env-assets/");
    visionMock.createFromOptions.mockResolvedValue(createLandmarkerStub());

    await createHandTracker();

    expect(visionMock.forVisionTasks).toHaveBeenCalledWith("/env-assets/wasm");
    expect(collectModelPaths()[0]).toBe("/env-assets/models/hand_landmarker.task");
  });

  it("全部尝试失败时抛出 model_load_failed", async () => {
    visionMock.createFromOptions.mockRejectedValue(new Error("加载失败"));

    let thrown: unknown = null;
    try {
      await createHandTracker();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(GestureTrackerError);
    const trackerError = thrown as GestureTrackerError;
    expect(trackerError.code).toBe("model_load_failed");
    expect(trackerError.message).toContain("均不可用");
    expect(visionMock.forVisionTasks).toHaveBeenCalledTimes(2);
    expect(visionMock.createFromOptions).toHaveBeenCalledTimes(4);
  });
});

describe("HandTracker.detect", () => {
  it("返回 21 点关键点，空结果与脏数据返回 null", async () => {
    const landmarker = createLandmarkerStub();
    visionMock.createFromOptions.mockResolvedValue(landmarker);
    const { tracker } = await createHandTracker();
    const landmarks = createLandmarks();

    landmarker.detectForVideo.mockReturnValue({ landmarks: [landmarks] });
    expect(tracker.detect(createVideo(), 10)).toEqual(landmarks);

    landmarker.detectForVideo.mockReturnValue({ landmarks: [] });
    expect(tracker.detect(createVideo(), 20)).toBeNull();

    landmarker.detectForVideo.mockReturnValue({ landmarks: [landmarks.slice(0, 5)] });
    expect(tracker.detect(createVideo(), 30)).toBeNull();
  });

  it("推理异常包装成 tracker_failed", async () => {
    const landmarker = createLandmarkerStub();
    visionMock.createFromOptions.mockResolvedValue(landmarker);
    const { tracker } = await createHandTracker();
    landmarker.detectForVideo.mockImplementation(() => {
      throw new Error("推理崩溃");
    });

    let thrown: unknown = null;
    try {
      tracker.detect(createVideo(), 100);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(GestureTrackerError);
    expect((thrown as GestureTrackerError).code).toBe("tracker_failed");
  });

  it("重复时间戳自动递增，满足 MediaPipe 单调性要求", async () => {
    const landmarker = createLandmarkerStub();
    visionMock.createFromOptions.mockResolvedValue(landmarker);
    const { tracker } = await createHandTracker();
    const video = createVideo();

    tracker.detect(video, 100);
    tracker.detect(video, 100);
    tracker.detect(video, 50);

    expect(landmarker.detectForVideo).toHaveBeenNthCalledWith(1, video, 100);
    expect(landmarker.detectForVideo).toHaveBeenNthCalledWith(2, video, 101);
    expect(landmarker.detectForVideo).toHaveBeenNthCalledWith(3, video, 102);
  });
});

describe("HandTracker.dispose", () => {
  it("close 只调用一次，释放后 detect 抛 tracker_failed", async () => {
    const { tracker, close } = await createTracker();

    tracker.dispose();
    expect(close).toHaveBeenCalledTimes(1);

    let thrown: unknown = null;
    try {
      tracker.detect(createVideo(), 1);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(GestureTrackerError);
    expect((thrown as GestureTrackerError).code).toBe("tracker_failed");

    tracker.dispose();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("close 抛错不影响释放流程", async () => {
    const landmarker = createLandmarkerStub();
    visionMock.createFromOptions.mockResolvedValue(landmarker);
    const { tracker } = await createHandTracker();
    landmarker.close.mockImplementation(() => {
      throw new Error("close 失败");
    });

    expect(() => tracker.dispose()).not.toThrow();
    expect(landmarker.close).toHaveBeenCalledTimes(1);
  });
});
