export interface AudioProcessingCapabilities {
  offlineAudioContext: boolean;
  webCodecs: boolean;
  ffmpegWasmLoaded: boolean;
}

export function detect(): AudioProcessingCapabilities {
  const scope = globalThis as typeof globalThis & {
    OfflineAudioContext?: unknown;
    webkitOfflineAudioContext?: unknown;
    AudioEncoder?: unknown;
    VideoEncoder?: unknown;
    __MIMI_FFMPEG_WASM_LOADED__?: unknown;
  };

  return {
    offlineAudioContext: Boolean(scope.OfflineAudioContext || scope.webkitOfflineAudioContext),
    webCodecs: Boolean(scope.AudioEncoder || scope.VideoEncoder),
    ffmpegWasmLoaded: scope.__MIMI_FFMPEG_WASM_LOADED__ === true,
  };
}

export function canExportConvertedAudio(
  capabilities: AudioProcessingCapabilities = detect()
): boolean {
  return (
    capabilities.offlineAudioContext && (capabilities.webCodecs || capabilities.ffmpegWasmLoaded)
  );
}

export function canRenderCrossfadePreview(
  capabilities: AudioProcessingCapabilities = detect()
): boolean {
  return capabilities.offlineAudioContext;
}
