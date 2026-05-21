import { afterEach, describe, expect, it, vi } from "vitest";
import { createFadeCurve, encodePcmWav, renderCrossfadePreview } from "./crossfadeRenderer";

function makeAudioBuffer(duration: number, sampleRate = 44100, channels = 1): AudioBuffer {
  const data = Array.from({ length: channels }, (_, channelIndex) => {
    const values = new Float32Array(Math.ceil(duration * sampleRate));
    values.fill(channelIndex === 0 ? 0.25 : -0.25);
    return values;
  });

  return {
    duration,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: (channelIndex: number) => data[channelIndex],
  } as AudioBuffer;
}

describe("crossfadeRenderer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds deterministic fade curves", () => {
    expect(Array.from(createFadeCurve("linear", "in", 3))).toEqual([0, 0.5, 1]);
    expect(Array.from(createFadeCurve("linear", "out", 3))).toEqual([1, 0.5, 0]);

    const sCurve = createFadeCurve("s-curve", "in", 5);
    expect(sCurve[0]).toBe(0);
    expect(sCurve[2]).toBeCloseTo(0.5, 5);
    expect(sCurve[4]).toBe(1);
  });

  it("encodes PCM samples as a WAV blob", async () => {
    const blob = encodePcmWav([new Float32Array([0, 0.5, -0.5])], 44100);

    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 3 * 2);
    expect(await blob.slice(0, 4).text()).toBe("RIFF");
    expect(await blob.slice(8, 12).text()).toBe("WAVE");
  });

  it("renders a crossfade region through OfflineAudioContext", async () => {
    const decodedBuffers = [makeAudioBuffer(5), makeAudioBuffer(3)];
    const renderedBuffer = makeAudioBuffer(0.01, 44100, 2);
    const instances: FakeOfflineAudioContext[] = [];

    class FakeBufferSource {
      buffer: AudioBuffer | null = null;
      start = vi.fn();

      connect(node: unknown) {
        return node as AudioNode;
      }
    }

    class FakeGainNode {
      gain = { setValueCurveAtTime: vi.fn() };

      connect(node: unknown) {
        return node as AudioNode;
      }
    }

    class FakeOfflineAudioContext {
      destination = {} as AudioDestinationNode;
      sources: FakeBufferSource[] = [];
      gains: FakeGainNode[] = [];

      constructor(
        public numberOfChannels: number,
        public length: number,
        public sampleRate: number
      ) {
        instances.push(this);
      }

      decodeAudioData() {
        const decoded = decodedBuffers.shift();
        if (!decoded) throw new Error("Missing decoded buffer");
        return Promise.resolve(decoded);
      }

      createBufferSource() {
        const source = new FakeBufferSource();
        this.sources.push(source);
        return source;
      }

      createGain() {
        const gain = new FakeGainNode();
        this.gains.push(gain);
        return gain;
      }

      startRendering() {
        return Promise.resolve(renderedBuffer);
      }
    }

    vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);

    const progress: number[] = [];
    const blob = await renderCrossfadePreview({
      fromBlob: new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      toBlob: new Blob([new Uint8Array([2])], { type: "audio/wav" }),
      durationSeconds: 2,
      curveType: "s-curve",
      onProgress: (value) => progress.push(value),
    });

    const renderContext = instances.find((instance) => instance.length > 1);
    expect(renderContext?.numberOfChannels).toBe(1);
    expect(renderContext?.length).toBe(88200);
    expect(renderContext?.sources[0].start).toHaveBeenCalledWith(0, 3, 2);
    expect(renderContext?.sources[1].start).toHaveBeenCalledWith(0, 0, 2);
    expect(renderContext?.gains[0].gain.setValueCurveAtTime).toHaveBeenCalledWith(
      expect.any(Float32Array),
      0,
      2
    );
    expect(progress).toEqual([10, 35, 70, 95, 100]);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBeGreaterThan(44);
  });
});
