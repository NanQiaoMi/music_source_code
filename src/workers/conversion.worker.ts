/// <reference lib="webworker" />

import { FFmpeg } from "@ffmpeg/ffmpeg";

export type FFmpegCoreSource = "local" | "cdn";

export const LOCAL_FFMPEG_CORE_BASE_URL = "/ffmpeg-core";
export const CDN_FFMPEG_CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

let ffmpeg: FFmpeg | null = null;
let coreSource: FFmpegCoreSource | null = null;

interface ConversionMessage {
  type: "convert";
  data: {
    /** Input audio bytes, transferred from the main thread (sender copy is detached). */
    fileBuffer: ArrayBuffer;
    sourceFormat: string;
    targetFormat: string;
    bitrate: number;
    sampleRate: number;
    channels: number;
    preserveMetadata: boolean;
  };
}

interface ConversionReply {
  outputBuffer: ArrayBuffer;
  outputType: string;
  coreSource: FFmpegCoreSource;
}

const hasCoreAsset = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Prefers the app-hosted core (works offline / in Electron) and only falls back
 * to unpkg when the assets are missing. Run `npm run fetch:ffmpeg-core` to
 * populate `public/ffmpeg-core/` before a release build.
 */
export const resolveFFmpegCoreSource = async (): Promise<{
  baseURL: string;
  source: FFmpegCoreSource;
}> => {
  const localJs = `${LOCAL_FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`;
  const localWasm = `${LOCAL_FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`;
  if ((await hasCoreAsset(localJs)) && (await hasCoreAsset(localWasm))) {
    return { baseURL: LOCAL_FFMPEG_CORE_BASE_URL, source: "local" };
  }

  console.warn(
    `[Conversion Worker] self-hosted FFmpeg core missing under ${LOCAL_FFMPEG_CORE_BASE_URL}; ` +
      "falling back to unpkg CDN (offline conversion unavailable). Run `npm run fetch:ffmpeg-core`."
  );
  return { baseURL: CDN_FFMPEG_CORE_BASE_URL, source: "cdn" };
};

const toBlobURL = async (url: string, mimeType: string) => {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to load ${url} (HTTP ${resp.status})`);
  }
  const body = await resp.blob();
  return URL.createObjectURL(new Blob([body], { type: mimeType }));
};

const loadCore = async (baseURL: string): Promise<FFmpeg> => {
  const instance = new FFmpeg();
  instance.on("log", ({ message }) => {
    console.log("[FFmpeg Worker Log]:", message);
  });
  await instance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  return instance;
};

const loadFFmpeg = async (): Promise<{ instance: FFmpeg; source: FFmpegCoreSource }> => {
  if (ffmpeg && coreSource) {
    return { instance: ffmpeg, source: coreSource };
  }

  const resolved = await resolveFFmpegCoreSource();
  try {
    ffmpeg = await loadCore(resolved.baseURL);
    coreSource = resolved.source;
  } catch (error) {
    if (resolved.source !== "local") throw error;
    console.warn("[Conversion Worker] self-hosted core failed to load; retrying unpkg CDN", error);
    ffmpeg = await loadCore(CDN_FFMPEG_CORE_BASE_URL);
    coreSource = "cdn";
  }

  return { instance: ffmpeg, source: coreSource };
};

/** Returns an ArrayBuffer that owns exactly `bytes` so it can be transferred. */
const toTransferableBuffer = (bytes: Uint8Array): ArrayBuffer => {
  // slice() copies views that share a larger backing store; transfer would otherwise move the whole store.
  return bytes.slice().buffer as ArrayBuffer;
};

const convertAudio = async (
  fileBuffer: ArrayBuffer,
  sourceFormat: string,
  targetFormat: string,
  bitrate: number,
  sampleRate: number,
  channels: number,
  preserveMetadata: boolean
): Promise<ConversionReply> => {
  const { instance: ffmpegInstance, source } = await loadFFmpeg();

  const inputFileName = `input.${sourceFormat}`;
  const outputFileName = `output.${targetFormat}`;

  await ffmpegInstance.writeFile(inputFileName, new Uint8Array(fileBuffer));

  const ffmpegArgs = ["-i", inputFileName];

  if (preserveMetadata) {
    ffmpegArgs.push("-map_metadata", "0");
  }

  ffmpegArgs.push(
    "-ar",
    sampleRate.toString(),
    "-ac",
    channels.toString(),
    "-b:a",
    `${bitrate}k`,
    outputFileName
  );

  await ffmpegInstance.exec(ffmpegArgs);

  const outputFile = await ffmpegInstance.readFile(outputFileName);
  const outputBuffer = toTransferableBuffer(
    typeof outputFile === "string" ? new TextEncoder().encode(outputFile) : outputFile
  );

  await ffmpegInstance.deleteFile(inputFileName);
  await ffmpegInstance.deleteFile(outputFileName);

  return { outputBuffer, outputType: `audio/${targetFormat}`, coreSource: source };
};

self.onmessage = async (event: MessageEvent<ConversionMessage>) => {
  const { type, data } = event.data;

  if (type === "convert") {
    try {
      const {
        fileBuffer,
        sourceFormat,
        targetFormat,
        bitrate,
        sampleRate,
        channels,
        preserveMetadata,
      } = data;

      self.postMessage({ type: "progress", data: { progress: 10, coreSource } });

      const {
        outputBuffer,
        outputType,
        coreSource: usedCoreSource,
      } = await convertAudio(
        fileBuffer,
        sourceFormat,
        targetFormat,
        bitrate,
        sampleRate,
        channels,
        preserveMetadata
      );

      self.postMessage({ type: "progress", data: { progress: 100, coreSource: usedCoreSource } });

      // Transfer the output back instead of structured-cloning a large buffer.
      self.postMessage(
        {
          type: "complete",
          // coreSource is part of the contract so callers can observe local vs CDN.
          data: { outputBuffer, outputType, coreSource: usedCoreSource },
        },
        [outputBuffer]
      );
    } catch (error) {
      console.error("[Conversion Worker Error]:", error);
      self.postMessage({
        type: "error",
        data: {
          error: error instanceof Error ? error.message : "Conversion failed",
          coreSource,
        },
      });
    }
  }
};

export default self as unknown as Worker;
