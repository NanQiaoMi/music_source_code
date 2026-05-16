import { afterEach, describe, expect, it } from "vitest";
import {
  canExportConvertedAudio,
  canRenderCrossfadePreview,
  detect,
} from "./processingCapabilities";

const keys = [
  "OfflineAudioContext",
  "webkitOfflineAudioContext",
  "AudioEncoder",
  "VideoEncoder",
  "__MIMI_FFMPEG_WASM_LOADED__",
] as const;

function setGlobal(key: (typeof keys)[number], value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

describe("processingCapabilities", () => {
  afterEach(() => {
    for (const key of keys) {
      Reflect.deleteProperty(globalThis, key);
    }
  });

  it("reports all capabilities as false when browser APIs are missing", () => {
    expect(detect()).toEqual({
      offlineAudioContext: false,
      webCodecs: false,
      ffmpegWasmLoaded: false,
    });
  });

  it("detects OfflineAudioContext and WebCodecs", () => {
    setGlobal("OfflineAudioContext", function OfflineAudioContext() {});
    setGlobal("AudioEncoder", function AudioEncoder() {});

    expect(detect()).toEqual({
      offlineAudioContext: true,
      webCodecs: true,
      ffmpegWasmLoaded: false,
    });
  });

  it("detects prefixed OfflineAudioContext and ffmpeg readiness", () => {
    setGlobal("webkitOfflineAudioContext", function WebkitOfflineAudioContext() {});
    setGlobal("__MIMI_FFMPEG_WASM_LOADED__", true);

    expect(detect()).toEqual({
      offlineAudioContext: true,
      webCodecs: false,
      ffmpegWasmLoaded: true,
    });
  });

  it("allows export only when render plus encoder capability exists", () => {
    expect(
      canExportConvertedAudio({
        offlineAudioContext: true,
        webCodecs: false,
        ffmpegWasmLoaded: false,
      })
    ).toBe(false);
    expect(
      canExportConvertedAudio({
        offlineAudioContext: true,
        webCodecs: true,
        ffmpegWasmLoaded: false,
      })
    ).toBe(true);
    expect(
      canExportConvertedAudio({
        offlineAudioContext: true,
        webCodecs: false,
        ffmpegWasmLoaded: true,
      })
    ).toBe(true);
  });

  it("allows crossfade preview rendering with OfflineAudioContext only", () => {
    expect(
      canRenderCrossfadePreview({
        offlineAudioContext: false,
        webCodecs: true,
        ffmpegWasmLoaded: true,
      })
    ).toBe(false);
    expect(
      canRenderCrossfadePreview({
        offlineAudioContext: true,
        webCodecs: false,
        ffmpegWasmLoaded: false,
      })
    ).toBe(true);
  });
});
