/// <reference lib="webworker" />

import { DSDRate, DSDQuality } from "@/store/dsdProcessingStore";

interface DSDConversionMessage {
  type: "convertDSD";
  data: {
    fileBlob: Blob;
    sourceRate: DSDRate;
    targetSampleRate: number;
    outputMode: "pcm" | "dop" | "native";
    dsdQuality: DSDQuality;
    filterType: "sharp" | "slow" | "medium";
    dithering: boolean;
  };
}

const dsdRateToHz: Record<DSDRate, number> = {
  dsd64: 2822400,
  dsd128: 5644800,
  dsd256: 11289600,
  dsd512: 22579200,
};

const decimationFactors: Record<DSDQuality, number> = {
  low: 64,
  standard: 48,
  high: 32,
  ultra: 16,
};

const getFilterCoefficients = (type: "sharp" | "slow" | "medium", length: number): number[] => {
  const coefficients: number[] = [];

  for (let i = 0; i < length; i++) {
    const n = i - (length - 1) / 2;
    const x = Math.PI * n * 0.5;

    if (type === "sharp") {
      if (n === 0) {
        coefficients.push(0.5);
      } else {
        coefficients.push(
          (Math.sin(x) / (Math.PI * n)) * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1)))
        );
      }
    } else if (type === "slow") {
      if (n === 0) {
        coefficients.push(0.4);
      } else {
        coefficients.push((Math.sin(x) / (Math.PI * n)) * 0.5);
      }
    } else {
      if (n === 0) {
        coefficients.push(0.45);
      } else {
        coefficients.push(
          (Math.sin(x) / (Math.PI * n)) * (0.5 - 0.1 * Math.cos((2 * Math.PI * i) / (length - 1)))
        );
      }
    }
  }

  return coefficients;
};

const convertDSDToPCM = async (
  fileBlob: Blob,
  sourceRate: DSDRate,
  targetSampleRate: number,
  dsdQuality: DSDQuality,
  filterType: "sharp" | "slow" | "medium",
  dithering: boolean
): Promise<Blob> => {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const inputData = new Uint8Array(arrayBuffer);

  const sourceHz = dsdRateToHz[sourceRate];
  const decimationFactor = decimationFactors[dsdQuality];
  const outputLength = Math.floor(inputData.length / decimationFactor);

  const pcmData = new Float32Array(outputLength);

  const filterLength = 256;
  const filterCoeffs = getFilterCoefficients(filterType, filterLength);

  self.postMessage({ type: "progress", data: { progress: 10 } });

  for (let i = 0; i < outputLength; i++) {
    let sample = 0;

    for (let j = 0; j < filterLength && i * decimationFactor + j < inputData.length; j++) {
      const bit = (inputData[i * decimationFactor + j] >> (7 - (j % 8))) & 1;
      const signedBit = bit ? 1 : -1;
      sample += signedBit * filterCoeffs[j];
    }

    sample = sample / filterLength;

    if (dithering) {
      sample += (Math.random() - 0.5) * 0.0001;
    }

    sample = Math.max(-1, Math.min(1, sample));
    pcmData[i] = sample;

    if (i % 10000 === 0) {
      const progress = Math.floor((i / outputLength) * 80) + 10;
      self.postMessage({ type: "progress", data: { progress } });
    }
  }

  self.postMessage({ type: "progress", data: { progress: 90 } });

  const numChannels = 2;
  const bitsPerSample = 24;
  const dataLength = outputLength * numChannels * (bitsPerSample / 8);

  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const wavView = new DataView(wavBuffer);

  const writeString = (view: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(wavView, 0, "RIFF");
  wavView.setUint32(4, 36 + dataLength, true);
  writeString(wavView, 8, "WAVE");
  writeString(wavView, 12, "fmt ");
  wavView.setUint32(16, 16, true);
  wavView.setUint16(20, 1, true);
  wavView.setUint16(22, numChannels, true);
  wavView.setUint32(24, targetSampleRate, true);
  wavView.setUint32(28, targetSampleRate * numChannels * (bitsPerSample / 8), true);
  wavView.setUint16(32, numChannels * (bitsPerSample / 8), true);
  wavView.setUint16(34, bitsPerSample, true);
  writeString(wavView, 36, "data");
  wavView.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < outputLength; i++) {
    const left = pcmData[i];
    const right = pcmData[i];

    const leftInt = Math.floor(left * 8388607);
    const rightInt = Math.floor(right * 8388607);

    wavView.setUint8(offset, leftInt & 0xff);
    wavView.setUint8(offset + 1, (leftInt >> 8) & 0xff);
    wavView.setUint8(offset + 2, (leftInt >> 16) & 0xff);

    wavView.setUint8(offset + 3, rightInt & 0xff);
    wavView.setUint8(offset + 4, (rightInt >> 8) & 0xff);
    wavView.setUint8(offset + 5, (rightInt >> 16) & 0xff);

    offset += 6;
  }

  self.postMessage({ type: "progress", data: { progress: 100 } });

  return new Blob([wavBuffer], { type: "audio/wav" });
};

const convertDSDToDOP = async (
  fileBlob: Blob,
  sourceRate: DSDRate,
  targetSampleRate: number
): Promise<Blob> => {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const inputData = new Uint8Array(arrayBuffer);

  const sourceHz = dsdRateToHz[sourceRate];
  const decimationFactor = 64;
  const outputLength = Math.floor(inputData.length / decimationFactor);

  const dopData = new Uint8Array(outputLength * 4);

  self.postMessage({ type: "progress", data: { progress: 10 } });

  for (let i = 0; i < outputLength; i++) {
    let dsdSample = 0;
    for (let j = 0; j < decimationFactor && i * decimationFactor + j < inputData.length; j++) {
      const byte = inputData[i * decimationFactor + j];
      dsdSample += byte;
    }
    dsdSample = dsdSample / decimationFactor;

    const marker = i % 2 === 0 ? 0x69 : 0x96;
    const pcmLow = Math.floor(dsdSample / 128 + 128) & 0xff;
    const pcmHigh = Math.floor(dsdSample / 256) & 0xff;

    dopData[i * 4] = marker;
    dopData[i * 4 + 1] = pcmLow;
    dopData[i * 4 + 2] = 0x69;
    dopData[i * 4 + 3] = pcmHigh;

    if (i % 10000 === 0) {
      const progress = Math.floor((i / outputLength) * 90) + 10;
      self.postMessage({ type: "progress", data: { progress } });
    }
  }

  self.postMessage({ type: "progress", data: { progress: 100 } });

  return new Blob([dopData], { type: "audio/dop" });
};

self.onmessage = async (event: MessageEvent<DSDConversionMessage>) => {
  const { type, data } = event.data;

  if (type === "convertDSD") {
    try {
      const {
        fileBlob,
        sourceRate,
        targetSampleRate,
        outputMode,
        dsdQuality,
        filterType,
        dithering,
      } = data;

      self.postMessage({ type: "progress", data: { progress: 5 } });

      let outputBlob: Blob;

      if (outputMode === "pcm") {
        outputBlob = await convertDSDToPCM(
          fileBlob,
          sourceRate,
          targetSampleRate,
          dsdQuality,
          filterType,
          dithering
        );
      } else if (outputMode === "dop") {
        outputBlob = await convertDSDToDOP(fileBlob, sourceRate, targetSampleRate);
      } else {
        throw new Error("Native DSD output not supported in browser");
      }

      self.postMessage({
        type: "complete",
        data: { outputBlob },
      });
    } catch (error) {
      console.error("[DSD Worker Error]:", error);
      self.postMessage({
        type: "error",
        data: { error: error instanceof Error ? error.message : "DSD conversion failed" },
      });
    }
  }
};

export default self as unknown as Worker;
