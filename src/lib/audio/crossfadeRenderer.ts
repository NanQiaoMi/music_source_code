export type CrossfadeCurveType = "linear" | "exponential" | "s-curve";

export interface RenderCrossfadePreviewInput {
  fromBlob: Blob;
  toBlob: Blob;
  durationSeconds: number;
  curveType: CrossfadeCurveType;
  onProgress?: (progress: number) => void;
}

type OfflineAudioContextClass = typeof OfflineAudioContext;

function getOfflineAudioContextConstructor(): OfflineAudioContextClass {
  const scope = globalThis as typeof globalThis & {
    webkitOfflineAudioContext?: OfflineAudioContextClass;
  };
  const OfflineContext = scope.OfflineAudioContext || scope.webkitOfflineAudioContext;

  if (!OfflineContext) {
    throw new Error("OfflineAudioContext is not available");
  }

  return OfflineContext;
}

async function decodeAudioBlob(
  OfflineContext: OfflineAudioContextClass,
  blob: Blob,
  sampleRate: number
): Promise<AudioBuffer> {
  const decodeContext = new OfflineContext(1, 1, sampleRate);
  const arrayBuffer = await blob.arrayBuffer();
  return decodeContext.decodeAudioData(arrayBuffer.slice(0));
}

export function createFadeCurve(
  curveType: CrossfadeCurveType,
  direction: "in" | "out",
  points = 128
): Float32Array {
  const safePoints = Math.max(2, Math.floor(points));
  const curve = new Float32Array(safePoints);

  for (let index = 0; index < safePoints; index += 1) {
    const t = index / (safePoints - 1);
    let fadeIn: number;

    switch (curveType) {
      case "exponential":
        fadeIn = t * t;
        break;
      case "s-curve":
        fadeIn = t * t * (3 - 2 * t);
        break;
      case "linear":
      default:
        fadeIn = t;
        break;
    }

    curve[index] = direction === "in" ? fadeIn : 1 - fadeIn;
  }

  return curve;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function encodePcmWav(channels: Float32Array[], sampleRate: number): Blob {
  if (channels.length === 0) {
    throw new Error("Cannot encode WAV without audio channels");
  }

  const frameCount = channels[0].length;
  if (!channels.every((channel) => channel.length === frameCount)) {
    throw new Error("Cannot encode WAV with uneven channel lengths");
  }

  const bytesPerSample = 2;
  const dataLength = frameCount * channels.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * bytesPerSample, true);
  view.setUint16(32, channels.length * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[frame]));
      const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, pcm, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function encodeAudioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
    audioBuffer.getChannelData(channelIndex)
  );
  return encodePcmWav(channels, audioBuffer.sampleRate);
}

export async function renderCrossfadePreview({
  fromBlob,
  toBlob,
  durationSeconds,
  curveType,
  onProgress,
}: RenderCrossfadePreviewInput): Promise<Blob> {
  const OfflineContext = getOfflineAudioContextConstructor();
  const sampleRate = 44100;

  onProgress?.(10);
  const [fromBuffer, toBuffer] = await Promise.all([
    decodeAudioBlob(OfflineContext, fromBlob, sampleRate),
    decodeAudioBlob(OfflineContext, toBlob, sampleRate),
  ]);
  onProgress?.(35);

  const fadeDuration = Math.min(
    Math.max(0.25, Number.isFinite(durationSeconds) ? durationSeconds : 5),
    fromBuffer.duration,
    toBuffer.duration
  );

  if (!Number.isFinite(fadeDuration) || fadeDuration <= 0) {
    throw new Error("Audio sources are too short to render a crossfade preview");
  }

  const channels = Math.max(fromBuffer.numberOfChannels, toBuffer.numberOfChannels, 1);
  const frameCount = Math.max(1, Math.ceil(fadeDuration * sampleRate));
  const renderContext = new OfflineContext(channels, frameCount, sampleRate);

  const fromSource = renderContext.createBufferSource();
  fromSource.buffer = fromBuffer;
  const toSource = renderContext.createBufferSource();
  toSource.buffer = toBuffer;

  const fromGain = renderContext.createGain();
  const toGain = renderContext.createGain();
  fromGain.gain.setValueCurveAtTime(createFadeCurve(curveType, "out"), 0, fadeDuration);
  toGain.gain.setValueCurveAtTime(createFadeCurve(curveType, "in"), 0, fadeDuration);

  fromSource.connect(fromGain).connect(renderContext.destination);
  toSource.connect(toGain).connect(renderContext.destination);

  fromSource.start(0, Math.max(0, fromBuffer.duration - fadeDuration), fadeDuration);
  toSource.start(0, 0, fadeDuration);
  onProgress?.(70);

  const rendered = await renderContext.startRendering();
  onProgress?.(95);

  const outputBlob = encodeAudioBufferToWavBlob(rendered);
  onProgress?.(100);
  return outputBlob;
}
