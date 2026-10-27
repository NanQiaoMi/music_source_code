import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./AudioEngine";
import { AudioEffectsManager } from "./AudioEffectsManager";

const mocks = vi.hoisted(() => ({ context: null as unknown as AudioContext }));

vi.mock("@/hooks/useAudioPlayer", () => ({
  getAudioContext: () => mocks.context,
}));

type Edge = { from: FakeNode; to: FakeNode };

class FakeParam {
  value = 0;
  setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  cancelScheduledValues = vi.fn();
}

class FakeNode {
  readonly connect = vi.fn((to: FakeNode) => {
    this.context.edges.push({ from: this, to });
    return to;
  });
  readonly disconnect = vi.fn((to?: FakeNode) => {
    const edges = this.context.edges;
    for (let i = edges.length - 1; i >= 0; i -= 1) {
      if (edges[i].from === this && (!to || edges[i].to === to)) edges.splice(i, 1);
    }
  });
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  delayTime = new FakeParam();
  pan = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  fftSize = 2048;
  frequencyBinCount = 1024;
  smoothingTimeConstant = 0;
  type = "sine";
  curve: Float32Array | null = null;
  buffer: AudioBuffer | null = null;
  start = vi.fn();
  getByteFrequencyData = vi.fn();

  constructor(readonly context: FakeAudioContext) {}
}

class FakeAudioContext {
  static last: FakeAudioContext | null = null;

  readonly edges: Edge[] = [];
  readonly destination = new FakeNode(this);
  currentTime = 0;
  sampleRate = 2000;
  state: AudioContextState = "running";

  constructor() {
    FakeAudioContext.last = this;
  }

  private node(): FakeNode {
    return new FakeNode(this);
  }

  createGain(): FakeNode {
    return this.node();
  }
  createAnalyser(): FakeNode {
    return this.node();
  }
  createBiquadFilter(): FakeNode {
    return this.node();
  }
  createStereoPanner(): FakeNode {
    return this.node();
  }
  createOscillator(): FakeNode {
    return this.node();
  }
  createConvolver(): FakeNode {
    return this.node();
  }
  createChannelSplitter(): FakeNode {
    return this.node();
  }
  createChannelMerger(): FakeNode {
    return this.node();
  }
  createDelay(): FakeNode {
    return this.node();
  }
  createWaveShaper(): FakeNode {
    return this.node();
  }
  createDynamicsCompressor(): FakeNode {
    return this.node();
  }
  createMediaElementSource(): FakeNode {
    return this.node();
  }
  createBuffer(_channels: number, length: number, sampleRate: number): AudioBuffer {
    return {
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer;
  }
  async resume(): Promise<void> {
    this.state = "running";
  }
  async suspend(): Promise<void> {
    this.state = "suspended";
  }
}

function destinationInbound(context: FakeAudioContext): number {
  return context.edges.filter((edge) => edge.to === context.destination).length;
}

function resetEngine(): void {
  Reflect.set(AudioEngine, "instance", undefined);
  FakeAudioContext.last = null;
}

async function buildGraph(): Promise<{
  engine: AudioEngine;
  effects: AudioEffectsManager;
  context: FakeAudioContext;
  analyser: FakeNode;
  audio: HTMLAudioElement;
}> {
  const audio = document.createElement("audio");
  const engine = AudioEngine.getInstance();
  engine.init(audio);

  const context = FakeAudioContext.last;
  if (!context) throw new Error("fake AudioContext was not created");
  mocks.context = context as unknown as AudioContext;

  const effects = new AudioEffectsManager();
  await effects.init();
  effects.connect(engine.getAnalyser()!, context.destination as unknown as AudioNode, audio);

  return {
    engine,
    effects,
    context,
    analyser: engine.getAnalyser() as unknown as FakeNode,
    audio,
  };
}

describe("S2-1 audio graph routing", () => {
  beforeEach(() => {
    resetEngine();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
  });

  afterEach(() => {
    resetEngine();
    vi.unstubAllGlobals();
  });

  it("keeps exactly one destination input with no effects (direct path)", async () => {
    const { effects, context, analyser } = await buildGraph();

    expect(destinationInbound(context)).toBe(1);
    expect(context.edges).toContainEqual({ from: analyser, to: context.destination });
    expect(
      (effects as unknown as { chainOutput: FakeNode }).chainOutput.connect
    ).not.toHaveBeenCalledWith(context.destination);
  });

  it("keeps exactly one destination input with reverb and mixes dry/wet in the single sink", async () => {
    const { effects, context, analyser } = await buildGraph();
    const state = effects as unknown as {
      chainOutput: FakeNode;
      dryGain: FakeNode;
      wetGain: FakeNode;
      reverbNode: FakeNode;
    };

    effects.setEffectEnabled("reverb", true);

    expect(destinationInbound(context)).toBe(1);
    expect(context.edges).not.toContainEqual({ from: analyser, to: context.destination });
    expect(state.chainOutput.connect).toHaveBeenCalledTimes(1);
    expect(state.chainOutput.connect).toHaveBeenCalledWith(context.destination);
    expect(state.dryGain.connect).toHaveBeenCalledWith(state.chainOutput);
    expect(state.wetGain.connect).toHaveBeenCalledWith(state.chainOutput);
    expect(state.reverbNode.connect).toHaveBeenCalledWith(state.wetGain);
  });

  it("does not accumulate destination or source edges on repeated connects/rebuilds", async () => {
    const { engine, effects, context, analyser } = await buildGraph();

    effects.connect(engine.getAnalyser()!, context.destination as unknown as AudioNode);
    engine.connectFallbackOutput();
    expect(destinationInbound(context)).toBe(1);

    for (let i = 0; i < 5; i += 1) {
      effects.setEffectEnabled("reverb", i % 2 === 0);
      expect(destinationInbound(context)).toBe(1);
    }
    // reverb 的干/湿两路是合法扇出；重复重建不得继续累加。
    expect(context.edges.filter((edge) => edge.from === analyser)).toHaveLength(2);
    effects.setEffectEnabled("reverb", false);
    expect(context.edges.filter((edge) => edge.from === analyser)).toHaveLength(1);
  });

  it("detach restores exactly one analyser fallback edge", async () => {
    const { effects, context, analyser } = await buildGraph();
    effects.setEffectEnabled("autoPan", true);
    expect(destinationInbound(context)).toBe(1);

    effects.detach();

    expect(destinationInbound(context)).toBe(1);
    expect(context.edges).toContainEqual({ from: analyser, to: context.destination });
  });

  it("keeps one destination input when a second connect arrives while attached", async () => {
    const { engine, effects, context } = await buildGraph();
    effects.setEffectEnabled("reverb", true);

    effects.connect(engine.getAnalyser()!, context.destination as unknown as AudioNode);

    expect(destinationInbound(context)).toBe(1);
  });
});
