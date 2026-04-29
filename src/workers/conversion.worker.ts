/// <reference lib="webworker" />

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

interface ConversionMessage {
  type: "convert";
  data: {
    fileBlob: Blob;
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

const toBlobURL = async (url: string, mimeType: string) => {
  const resp = await fetch(url);
  const body = await resp.blob();
  return URL.createObjectURL(body);
};

const convertAudio = async (
  fileBlob: Blob,
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

  await ffmpegInstance.writeFile(inputFileName, await fetchFile(fileBlob));

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

  const outputBlob = new Blob([outputFile as BlobPart], { type: `audio/${targetFormat}` });

  await ffmpegInstance.deleteFile(inputFileName);
  await ffmpegInstance.deleteFile(outputFileName);

  return outputBlob;
};

self.onmessage = async (event: MessageEvent<ConversionMessage>) => {
  const { type, data } = event.data;

  if (type === "convert") {
    try {
      const {
        fileBlob,
        sourceFormat,
        targetFormat,
        bitrate,
        sampleRate,
        channels,
        preserveMetadata,
      } = data;

      self.postMessage({ type: "progress", data: { progress: 10 } });

      const outputBlob = await convertAudio(
        fileBlob,
        sourceFormat,
        targetFormat,
        bitrate,
        sampleRate,
        channels,
        preserveMetadata
      );

      self.postMessage({ type: "progress", data: { progress: 100 } });

      self.postMessage({
        type: "complete",
        data: { outputBlob },
      });
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
