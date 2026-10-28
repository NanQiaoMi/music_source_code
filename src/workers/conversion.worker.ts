/// <reference lib="webworker" />

import { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpeg: FFmpeg | null = null;

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

const loadFFmpeg = async () => {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

    ffmpeg.on("log", ({ message }) => {
      console.log("[FFmpeg Worker Log]:", message);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
  }
  return ffmpeg;
};

const toBlobURL = async (url: string, _mimeType: string) => {
  const resp = await fetch(url);
  const body = await resp.blob();
  return URL.createObjectURL(body);
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
) => {
  const ffmpegInstance = await loadFFmpeg();

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

  return { outputBuffer, outputType: `audio/${targetFormat}` };
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

      self.postMessage({ type: "progress", data: { progress: 10 } });

      const { outputBuffer, outputType } = await convertAudio(
        fileBuffer,
        sourceFormat,
        targetFormat,
        bitrate,
        sampleRate,
        channels,
        preserveMetadata
      );

      self.postMessage({ type: "progress", data: { progress: 100 } });

      // Transfer the output back instead of structured-cloning a large buffer.
      self.postMessage(
        {
          type: "complete",
          data: { outputBuffer, outputType },
        },
        [outputBuffer]
      );
    } catch (error) {
      console.error("[Conversion Worker Error]:", error);
      self.postMessage({
        type: "error",
        data: { error: error instanceof Error ? error.message : "Conversion failed" },
      });
    }
  }
};

export default self as unknown as Worker;
