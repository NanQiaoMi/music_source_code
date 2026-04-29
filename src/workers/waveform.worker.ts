/// <reference lib="webworker" />

interface WaveformMessage {
  type: "generate";
  audioBuffer: AudioBuffer;
  songId: string;
  samplesPerPixel: number;
}

interface WaveformResponse {
  type: "waveform-generated";
  songId: string;
  waveform: {
    songId: string;
    channels: {
      channelIndex: number;
      points: {
        time: number;
        min: number;
        max: number;
        avg: number;
      }[];
      duration: number;
      sampleRate: number;
    }[];
    totalDuration: number;
    generatedAt: number;
    zoomLevel: number;
  };
}

interface ErrorMessage {
  type: "error";
  error: string;
  songId?: string;
}

self.onmessage = async (event: MessageEvent<WaveformMessage>) => {
  const { type, audioBuffer, songId, samplesPerPixel } = event.data;

  if (type !== "generate") {
    return;
  }

  try {
    const waveform = generateWaveform(audioBuffer, samplesPerPixel);

    const response: WaveformResponse = {
      type: "waveform-generated",
      songId,
      waveform,
    };

    self.postMessage(response);
  } catch (error) {
    const errorMessage: ErrorMessage = {
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      songId,
    };

    self.postMessage(errorMessage);
  }
};

function generateWaveform(
  audioBuffer: AudioBuffer,
  samplesPerPixel: number = 100
): WaveformResponse["waveform"] {
  const startTime = performance.now();

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.length / sampleRate;

  const channels: WaveformResponse["waveform"]["channels"] = [];

  for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
    const channelData = audioBuffer.getChannelData(channelIndex);
    const points = calculateWaveformPoints(channelData, sampleRate, samplesPerPixel);

    channels.push({
      channelIndex,
      points,
      duration,
      sampleRate,
    });
  }

  const endTime = performance.now();
  console.log(
    `Waveform generated in ${((endTime - startTime) / 1000).toFixed(2)}s for ${duration.toFixed(2)}s audio`
  );

  return {
    songId: "",
    channels,
    totalDuration: duration,
    generatedAt: Date.now(),
    zoomLevel: 1,
  };
}

function calculateWaveformPoints(
  channelData: Float32Array,
  sampleRate: number,
  samplesPerPixel: number
): { time: number; min: number; max: number; avg: number }[] {
  const points: { time: number; min: number; max: number; avg: number }[] = [];
  const blockSize = Math.floor(channelData.length / samplesPerPixel);

  if (blockSize === 0) {
    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i];
      points.push({
        time: i / sampleRate,
        min: sample,
        max: sample,
        avg: sample,
      });
    }
    return points;
  }

  for (let i = 0; i < samplesPerPixel; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);

    let min = 1.0;
    let max = -1.0;
    let sum = 0;
    let count = 0;

    for (let j = start; j < end; j++) {
      const sample = channelData[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
      sum += sample;
      count++;
    }

    const avg = count > 0 ? sum / count : 0;
    const time = (i * blockSize) / sampleRate;

    points.push({
      time,
      min,
      max,
      avg,
    });
  }

  return points;
}

export {};
