import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioEffectType } from "@/store/audioEffectsStore";
import { AudioEffectsManager } from "./AudioEffectsManager";
import { AudioEngine } from "./AudioEngine";

const mocks = vi.hoisted(() => ({ context: null as unknown as AudioContext }));

vi.mock("@/hooks/useAudioPlayer", () => ({
  getAudioContext: () => mocks.context,
}));

const ALL_EFFECTS: AudioEffectType[] = [
  "autoPan",
  "reverb",
  "stereoWidener",
  "nightcore",
  "vaporwave",
  "cassette",
  "tremolo",
  "underwater",
  "vinyl",
  "bitcrusher",
  "talkie",
  "megaBass",
  "asmr",
  "phaser",
  "vocalRemove",
  "cyberpunkDistortion",
  "loFiPhone",
];

class FakeParam {
  value = 0;
  readonly setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

type Edge = { from: FakeNode; to: FakeNode | FakeParam };

class FakeNode {
  readonly connect = vi.fn((to: FakeNode | FakeParam, _output?: number, _input?: number) => {
    this.context.edges.push({ from: this, to });
    return to;
  });
  readonly disconnect = vi.fn((to?: FakeNode | FakeParam) => {
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
  readonly start = vi.fn();
  readonly getByteFrequencyData = vi.fn();

  constructor(readonly context: FakeAudioContext) {
    context.created.push(this);
  }
}

class FakeAudioContext {
  static last: FakeAudioContext | null = null;

  readonly edges: Edge[] = [];
  readonly created: FakeNode[] = [];
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
  effects: AudioEffectsManager;
  context: FakeAudioContext;
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

  return { effects, context, audio };
}

describe("S2-2 incremental effect intensity", () => {
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

  it("applies 100 reverb updates to the existing wet/dry nodes without rebuilding", async () => {
    const { effects, context } = await buildGraph();
    effects.setEffectEnabled("reverb", true);

    const state = effects as unknown as { wetGain: FakeNode; dryGain: FakeNode };
    const wetGain = state.wetGain;
    const createdBefore = context.created.length;
    wetGain.gain.setTargetAtTime.mockClear();
    state.dryGain.gain.setTargetAtTime.mockClear();
    effects.resetGraphStats();

    for (let i = 0; i < 100; i += 1) {
      effects.setEffectIntensity("reverb", i / 100);
    }

    expect(effects.getGraphRebuildCount()).toBe(0);
    expect(effects.getGraphConnectCount()).toBe(0);
    expect(context.created).toHaveLength(createdBefore);
    expect(state.wetGain).toBe(wetGain);
    expect(wetGain.gain.setTargetAtTime).toHaveBeenCalledTimes(100);
    expect(wetGain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.99, 0, 0.02);
    expect(state.dryGain.gain.setTargetAtTime).toHaveBeenLastCalledWith(1 - 0.99 * 0.3, 0, 0.02);
    expect(destinationInbound(context)).toBe(1);
  });

  it("keeps rebuild and connect counts at zero for 100 updates on every effect", async () => {
    const { effects, context } = await buildGraph();
    for (const effect of ALL_EFFECTS) {
      effects.setEffectEnabled(effect, true);
    }

    const createdBefore = context.created.length;
    effects.resetGraphStats();

    for (let i = 0; i < 100; i += 1) {
      for (const effect of ALL_EFFECTS) {
        effects.setEffectIntensity(effect, (i % 10) / 10);
      }
    }

    expect(effects.getGraphRebuildCount()).toBe(0);
    expect(effects.getGraphConnectCount()).toBe(0);
    expect(context.created).toHaveLength(createdBefore);
    expect(destinationInbound(context)).toBe(1);
  });

  it("still rebuilds exactly once when an effect is enabled", async () => {
    const { effects, context } = await buildGraph();
    effects.setEffectEnabled("reverb", true);

    effects.resetGraphStats();
    effects.setEffectEnabled("reverb", false);
    effects.setEffectEnabled("stereoWidener", true);

    expect(effects.getGraphRebuildCount()).toBe(2);
    expect(effects.getGraphConnectCount()).toBeGreaterThan(0);
    expect(destinationInbound(context)).toBe(1);
  });

  it("defers structural WaveShaper curve commits until pointer-up style commit", async () => {
    const { effects, context } = await buildGraph();
    effects.setEffectEnabled("cyberpunkDistortion", true);

    const state = effects as unknown as { cyberpunkDistortion: FakeNode };
    const curveBefore = state.cyberpunkDistortion.curve;
    effects.resetGraphStats();

    effects.setEffectIntensity("cyberpunkDistortion", 0.9);
    expect(state.cyberpunkDistortion.curve).toBe(curveBefore);

    effects.commitEffectIntensity("cyberpunkDistortion");
    expect(state.cyberpunkDistortion.curve).not.toBe(curveBefore);
    expect(effects.getGraphRebuildCount()).toBe(0);
    expect(effects.getGraphConnectCount()).toBe(0);
    expect(destinationInbound(context)).toBe(1);
  });

  it("does not rebuild for a disabled effect whose intensity cannot affect the chain", async () => {
    const { effects } = await buildGraph();
    effects.resetGraphStats();

    effects.setEffectIntensity("vinyl", 0.9);

    expect(effects.getGraphRebuildCount()).toBe(0);
    expect(effects.getGraphConnectCount()).toBe(0);
  });
});
