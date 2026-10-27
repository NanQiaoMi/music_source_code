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

function destinationEdges(engine: AudioEngine): number {
  const analyser = engine.getAnalyser() as unknown as {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  const destination = engine.getContext()!.destination;
  const connects = analyser.connect.mock.calls.filter(([to]) => to === destination).length;
  const disconnects = analyser.disconnect.mock.calls.filter(([to]) => to === destination).length;
  return connects - disconnects;
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

  it("returns masterGain by default when EQ is disabled and eqNodes[0] when EQ is enabled", () => {
    const engine = AudioEngine.getInstance();
    const audio = document.createElement("audio");
    engine.init(audio);

    const masterGain = engine.getMasterGain();
    expect(masterGain).not.toBeNull();
    expect(engine.getEQChainEntry()).toBe(masterGain);

    const firstEqNode = (engine as unknown as { eqNodes: AudioNode[] }).eqNodes[0];
    expect(firstEqNode).toBeDefined();

    engine.setEQEnabled(true);
    expect(engine.getEQChainEntry()).toBe(firstEqNode);
  });

  it("toggling setEQEnabled(false) disconnects and reconnects sources to masterGain", () => {
    const engine = AudioEngine.getInstance();
    const audio = document.createElement("audio");
    engine.init(audio);

    const sourceNode = engine.createMediaSource(audio)!;
    const masterGain = engine.getMasterGain()!;
    const firstEqNode = (engine as unknown as { eqNodes: AudioNode[] }).eqNodes[0];

    // Initially connected to masterGain because EQ is disabled by default
    expect(sourceNode.connect).toHaveBeenCalledWith(masterGain);

    // Enable EQ -> disconnects and reconnects to first EQ node
    engine.setEQEnabled(true);
    expect(sourceNode.disconnect).toHaveBeenCalledTimes(1);
    expect(sourceNode.connect).toHaveBeenLastCalledWith(firstEqNode);

    // Toggle EQ back to false -> disconnects and reconnects to masterGain
    engine.setEQEnabled(false);
    expect(sourceNode.disconnect).toHaveBeenCalledTimes(2);
    expect(sourceNode.connect).toHaveBeenLastCalledWith(masterGain);
  });

  it("writes user volume only to masterGain and keeps the media element at full scale", () => {
    const engine = AudioEngine.getInstance();
    const audio = document.createElement("audio");
    audio.volume = 1;
    engine.init(audio);

    const masterGain = engine.getMasterGain()!;
    engine.setVolume(0.5);

    expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledTimes(1);
    expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, 0, 0.01);
    expect(audio.volume).toBe(1);
    expect(20 * Math.log10(0.5)).toBeCloseTo(-6.02, 1);
  });

  it("applies the last requested volume when the context is created later", () => {
    const engine = AudioEngine.getInstance();
    engine.setVolume(0.5);
    engine.init(document.createElement("audio"));

    const masterGain = engine.getMasterGain()!;
    expect(masterGain.gain.value).toBe(0.5);
    expect(masterGain.gain.setTargetAtTime).not.toHaveBeenCalled();
  });

  it("mutes through the same masterGain point without touching element volume", () => {
    const engine = AudioEngine.getInstance();
    const audio = document.createElement("audio");
    audio.volume = 1;
    engine.init(audio);

    const masterGain = engine.getMasterGain()!;
    engine.setVolume(0);

    expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledTimes(1);
    expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.01);
    expect(audio.volume).toBe(1);
  });

  it("keeps one fallback destination edge and hands it to the effects owner idempotently", () => {
    const engine = AudioEngine.getInstance();
    const audio = document.createElement("audio");
    engine.init(audio);

    expect(destinationEdges(engine)).toBe(1);
    engine.connectFallbackOutput();
    expect(destinationEdges(engine)).toBe(1);

    engine.setOutputOwnedByEffects(true);
    expect(destinationEdges(engine)).toBe(0);
    engine.connectFallbackOutput();
    expect(destinationEdges(engine)).toBe(0);

    engine.setOutputOwnedByEffects(false);
    engine.connectFallbackOutput();
    expect(destinationEdges(engine)).toBe(1);
  });

  it("does not disconnect or reconnect if setEQEnabled is called with the same value", () => {
    const engine = AudioEngine.getInstance();
    const audio = document.createElement("audio");
    engine.init(audio);

    const sourceNode = engine.createMediaSource(audio)!;
    expect(sourceNode.disconnect).toHaveBeenCalledTimes(0);

    // Calling setEQEnabled(false) when already false returns early
    engine.setEQEnabled(false);
    expect(sourceNode.disconnect).toHaveBeenCalledTimes(0);

    // Enable EQ
    engine.setEQEnabled(true);
    expect(sourceNode.disconnect).toHaveBeenCalledTimes(1);

    // Calling setEQEnabled(true) when already true returns early
    engine.setEQEnabled(true);
    expect(sourceNode.disconnect).toHaveBeenCalledTimes(1);
  });
});
