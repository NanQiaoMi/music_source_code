import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./AudioEngine";

type ConnectableNode = {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function connectable(): ConnectableNode {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

class FakeAudioContext {
  static created = 0;

  currentTime = 0;
  destination = connectable();
  sampleRate = 44100;
  state: AudioContextState = "suspended";

  constructor() {
    FakeAudioContext.created += 1;
  }

  createAnalyser() {
    return {
      ...connectable(),
      fftSize: 0,
      frequencyBinCount: 1024,
      getByteFrequencyData: vi.fn(),
      smoothingTimeConstant: 0,
    };
  }

  createBiquadFilter() {
    return {
      ...connectable(),
      Q: { value: 0 },
      frequency: { value: 0 },
      gain: { value: 0, setTargetAtTime: vi.fn() },
      type: "peaking" as BiquadFilterType,
    };
  }

  createGain() {
    return {
      ...connectable(),
      gain: { value: 1, setTargetAtTime: vi.fn() },
    };
  }

  createMediaElementSource() {
    return connectable();
  }

  async resume() {
    this.state = "running";
  }

  async suspend() {
    this.state = "suspended";
  }
}

function resetAudioEngine() {
  Reflect.set(AudioEngine, "instance", undefined);
  FakeAudioContext.created = 0;
}

describe("AudioEngine", () => {
  beforeEach(() => {
    resetAudioEngine();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
  });

  afterEach(() => {
    resetAudioEngine();
    vi.unstubAllGlobals();
  });

  it("does not create AudioContext when the singleton is only inspected", () => {
    const engine = AudioEngine.getInstance();

    expect(FakeAudioContext.created).toBe(0);
    expect(engine.getContext()).toBeNull();
    expect(engine.getAnalyser()).toBeNull();

    engine.setVolume(0.5);
    engine.updateEQ([1, 2, 3]);

    expect(FakeAudioContext.created).toBe(0);
  });

  it("creates the AudioContext when an audio element is initialized", () => {
    const engine = AudioEngine.getInstance();

    engine.init(document.createElement("audio"));

    expect(FakeAudioContext.created).toBe(1);
    expect(engine.getContext()).not.toBeNull();
    expect(engine.getAnalyser()).not.toBeNull();
  });

  it("can lazily create and resume the AudioContext for playback", async () => {
    const engine = AudioEngine.getInstance();

    await engine.resume();

    expect(FakeAudioContext.created).toBe(1);
    expect(engine.getContext()?.state).toBe("running");
  });
});
