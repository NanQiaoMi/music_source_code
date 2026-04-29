/// <reference lib="webworker" />

interface FingerprintMessage {
  type: "generate";
  audioBuffer: AudioBuffer;
  songId: string;
}

interface FingerprintResponse {
  type: "fingerprint-generated";
  songId: string;
  fingerprint: {
    songId: string;
    fingerprint: number[];
    duration: number;
    sampleRate: number;
    channels: number;
    createdAt: number;
  };
}

interface ErrorMessage {
  type: "error";
  error: string;
  songId?: string;
}

self.onmessage = async (event: MessageEvent<FingerprintMessage>) => {
  const { type, audioBuffer, songId } = event.data;

  if (type !== "generate") {
    return;
  }

  try {
    const fingerprint = generateFingerprint(audioBuffer);

    const response: FingerprintResponse = {
      type: "fingerprint-generated",
      songId,
      fingerprint: {
        songId,
        fingerprint,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        createdAt: Date.now(),
      },
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

function generateFingerprint(audioBuffer: AudioBuffer): number[] {
  const startTime = performance.now();

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  const fingerprint: number[] = [];
  const frameSize = 4096;
  const hopSize = 2048;
  const numBands = 32;

  for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
    const frame = channelData.slice(i, i + frameSize);
    const spectrum = computeSpectrum(frame, numBands);
    const hash = computeHash(spectrum, i);
    fingerprint.push(hash);
  }

  const endTime = performance.now();
  console.log(
    `Fingerprint generated in ${((endTime - startTime) / 1000).toFixed(2)}s for ${duration.toFixed(2)}s audio`
  );

  return fingerprint;
}

function computeSpectrum(frame: Float32Array, numBands: number): number[] {
  const hann = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frame.length - 1)));
  }

  const windowedFrame = frame.map((v, i) => v * hann[i]);

  const spectrum: number[] = [];
  const bandSize = Math.floor(frame.length / 2 / numBands);

  for (let band = 0; band < numBands; band++) {
    const start = band * bandSize;
    const end = (band + 1) * bandSize;

    let energy = 0;
    for (let i = start; i < end; i++) {
      energy += Math.abs(windowedFrame[i]);
    }

    spectrum.push(energy / (end - start));
  }

  return spectrum;
}

function computeHash(spectrum: number[], position: number): number {
  let hash = 0;

  for (let i = 0; i < spectrum.length - 1; i++) {
    if (spectrum[i] > spectrum[i + 1]) {
      hash |= 1 << i;
    }
  }

  return hash >>> 0;
}

export {};
