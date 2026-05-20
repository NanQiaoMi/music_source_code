import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioProcessingStore, type ConversionJob } from "./audioProcessingStore";

const mocks = vi.hoisted(() => ({
  ffmpegLoad: vi.fn(),
  ffmpegOn: vi.fn(),
  toBlobURL: vi.fn(),
}));

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: vi.fn(function FFmpeg() {
    return {
      load: mocks.ffmpegLoad,
      on: mocks.ffmpegOn,
    };
  }),
}));

vi.mock("@ffmpeg/util", () => ({
  toBlobURL: mocks.toBlobURL,
}));

function createJob(overrides: Partial<ConversionJob> = {}): ConversionJob {
  return {
    id: "job-1",
    inputPath: "/test.mp3",
    outputPath: "/test.wav",
    inputFormat: "mp3",
    outputFormat: "wav",
    config: {},
    status: "pending",
    progress: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

function resetStore() {
  useAudioProcessingStore.setState({
    isProcessing: false,
    processingProgress: 0,
    currentTask: "",
    ffmpegLoaded: false,
    ffmpegLoading: false,
    ffmpegLoadError: null,
    conversionQueue: [],
    conversionHistory: [],
    waveformCache: new Map(),
    waveformGenerationQueue: [],
    spectrumData: null,
    spectrumEnabled: false,
    dspEnabled: true,
    dspProcessors: [],
    masterGain: 1.0,
    masterCompressorEnabled: false,
    audioContext: null,
    masterNode: null,
    compressorNode: null,
  });
}

function getFFmpegReadyFlag(): boolean | undefined {
  return (globalThis as typeof globalThis & { __MIMI_FFMPEG_WASM_LOADED__?: boolean })
    .__MIMI_FFMPEG_WASM_LOADED__;
}

describe("audioProcessingStore", () => {
  beforeEach(() => {
    resetStore();
    Reflect.deleteProperty(globalThis, "__MIMI_FFMPEG_WASM_LOADED__");
    mocks.ffmpegLoad.mockReset().mockResolvedValue(undefined);
    mocks.ffmpegOn.mockReset();
    mocks.toBlobURL.mockReset().mockImplementation(async (url: string) => `blob:${url}`);
  });

  it("starts with FFmpeg unloaded", () => {
    const state = useAudioProcessingStore.getState();
    expect(state.ffmpegLoaded).toBe(false);
    expect(state.ffmpegLoading).toBe(false);
    expect(state.ffmpegLoadError).toBeNull();
  });

  it("adds and removes conversion jobs", () => {
    useAudioProcessingStore.getState().addConversionJob(createJob());
    expect(useAudioProcessingStore.getState().conversionQueue).toHaveLength(1);

    useAudioProcessingStore.getState().removeConversionJob("job-1");
    expect(useAudioProcessingStore.getState().conversionQueue).toHaveLength(0);
  });

  it("updates DSP processor state", () => {
    useAudioProcessingStore.getState().addDSPProcessor({
      id: "dsp-1",
      type: "eq",
      enabled: true,
      params: {},
    });
    expect(useAudioProcessingStore.getState().dspProcessors).toHaveLength(1);

    useAudioProcessingStore.getState().toggleDSP();
    expect(useAudioProcessingStore.getState().dspEnabled).toBe(false);
  });

  it("resets active processing state", () => {
    useAudioProcessingStore.getState().addConversionJob(createJob({ progress: 50 }));

    useAudioProcessingStore.getState().resetProcessing();

    expect(useAudioProcessingStore.getState().isProcessing).toBe(false);
    expect(useAudioProcessingStore.getState().conversionQueue).toHaveLength(0);
  });

  it("loads FFmpeg once, records readiness, and updates capability detection", async () => {
    await useAudioProcessingStore.getState().loadFFmpeg();

    expect(mocks.ffmpegLoad).toHaveBeenCalledTimes(1);
    expect(mocks.toBlobURL).toHaveBeenCalledWith(
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
      "text/javascript"
    );
    expect(mocks.toBlobURL).toHaveBeenCalledWith(
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
      "application/wasm"
    );

    const state = useAudioProcessingStore.getState();
    expect(state.ffmpegLoaded).toBe(true);
    expect(state.ffmpegLoading).toBe(false);
    expect(state.ffmpegLoadError).toBeNull();
    expect(getFFmpegReadyFlag()).toBe(true);
  });

  it("reuses an in-flight FFmpeg load request", async () => {
    let resolveLoad: () => void = () => undefined;
    mocks.ffmpegLoad.mockReturnValue(new Promise<void>((resolve) => (resolveLoad = resolve)));

    const first = useAudioProcessingStore.getState().loadFFmpeg();
    const second = useAudioProcessingStore.getState().loadFFmpeg();

    expect(first).toBe(second);
    await vi.waitFor(() => expect(mocks.ffmpegLoad).toHaveBeenCalledTimes(1));
    expect(useAudioProcessingStore.getState().ffmpegLoading).toBe(true);

    resolveLoad();
    await first;

    expect(useAudioProcessingStore.getState().ffmpegLoaded).toBe(true);
    expect(useAudioProcessingStore.getState().ffmpegLoading).toBe(false);
  });

  it("stores FFmpeg load errors and clears readiness", async () => {
    mocks.ffmpegLoad.mockRejectedValue(new Error("network blocked"));

    await useAudioProcessingStore.getState().loadFFmpeg();

    const state = useAudioProcessingStore.getState();
    expect(state.ffmpegLoaded).toBe(false);
    expect(state.ffmpegLoading).toBe(false);
    expect(state.ffmpegLoadError).toBe("network blocked");
    expect(getFFmpegReadyFlag()).toBe(false);
  });
});
