import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./AudioEngine";
import { AudioEffectsManager } from "./AudioEffectsManager";
import { CrossfadeMixer } from "./CrossfadeMixer";
import { getAudioGraphStats, resetAudioGraphStats } from "./audioGraphStats";

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
  readonly mediaSources: FakeNode[] = [];
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
    const source = this.node();
    this.mediaSources.push(source);
    return source;
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

function resetMixer(): void {
  (CrossfadeMixer as unknown as { instance?: CrossfadeMixer }).instance = undefined;
}

function createAudioElement(): HTMLAudioElement {
  const audio = document.createElement("audio");
  vi.spyOn(audio, "play").mockResolvedValue(undefined);
  vi.spyOn(audio, "pause").mockImplementation(() => {});
  return audio;
}

async function buildPlaybackGraph(): Promise<{
  primary: HTMLAudioElement;
  secondary: HTMLAudioElement;
  engine: AudioEngine;
  effects: AudioEffectsManager;
  mixer: CrossfadeMixer;
  context: FakeAudioContext;
}> {
  const primary = createAudioElement();
  const secondary = createAudioElement();

  const engine = AudioEngine.getInstance();
  engine.init(primary);
  engine.init(secondary);

  const context = FakeAudioContext.last;
  if (!context) throw new Error("fake AudioContext was not created");
  mocks.context = context as unknown as AudioContext;

  const effects = new AudioEffectsManager();
  await effects.init();
  effects.connect(engine.getAnalyser()!, context.destination as unknown as AudioNode, primary);

  const mixer = CrossfadeMixer.getInstance();
  mixer.prepareElement(primary);
  mixer.prepareElement(secondary);

  return { primary, secondary, engine, effects, mixer, context };
}

describe("S2-3 audio graph lifecycle", () => {
  beforeEach(() => {
    resetEngine();
    resetMixer();
    resetAudioGraphStats();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetEngine();
    resetMixer();
    vi.unstubAllGlobals();
  });

  it("reuses one MediaElementSource per element instead of one per song", () => {
    const engine = AudioEngine.getInstance();
    const audio = createAudioElement();

    engine.init(audio);
    const first = engine.createMediaSource(audio);

    for (let i = 0; i < 100; i += 1) {
      engine.init(audio);
      expect(engine.createMediaSource(audio)).toBe(first);
    }

    expect(FakeAudioContext.last?.mediaSources).toHaveLength(1);
    expect(engine.sourceElementCount).toBe(1);
  });

  it("keeps node counts flat and destination inbound at 1 across 100 deck switches", async () => {
    const { primary, secondary, engine, effects, mixer, context } = await buildPlaybackGraph();
    const engineNodes = engine.getNodeCount();
    const effectNodes = effects.getNodeCount();
    const mixerNodes = mixer.getNodeCount();
    resetAudioGraphStats();

    for (let i = 0; i < 100; i += 1) {
      const current = i % 2 === 0 ? primary : secondary;
      const other = current === primary ? secondary : primary;

      // 与 useAudioPlayer + CrossfadeMixer 的实际播放路径一致：只换 deck / src，
      // 不创建新的 MediaElementSource，也不重建效果链节点。
      engine.init(current);
      expect(engine.createMediaSource(current)).not.toBeNull();
      effects.connect(engine.getAnalyser()!, context.destination as unknown as AudioNode, current);
      mixer.prepareForDirectPlayback(current);
      mixer.pauseAndReset(other, true);

      expect(destinationInbound(context)).toBe(1);
    }

    expect(context.mediaSources).toHaveLength(2);
    expect(engine.sourceElementCount).toBe(2);
    expect(engine.getNodeCount()).toBe(engineNodes);
    expect(effects.getNodeCount()).toBe(effectNodes);
    expect(mixer.getNodeCount()).toBe(mixerNodes);
    expect(mixer.getPendingTimerCount()).toBe(0);

    const stats = getAudioGraphStats();
    expect(stats.createdNodes).toBe(0);
    expect(stats.releasedNodes).toBe(0);
    expect(stats.activeNodes).toBe(0);
    expect(stats.mediaSourceNodes).toBe(0);
    expect(stats.crossfadeGainNodes).toBe(0);
    expect(stats.pendingCrossfadeTimers).toBe(0);
    expect(destinationInbound(context)).toBe(1);
  });

  it("bounds crossfade gains and cleanup timers across 100 rapid crossfades", async () => {
    vi.useFakeTimers();
    const { primary, secondary, mixer } = await buildPlaybackGraph();
    const gainNodes = mixer.getNodeCount();
    resetAudioGraphStats();

    for (let i = 0; i < 100; i += 1) {
      const from = i % 2 === 0 ? primary : secondary;
      const to = from === primary ? secondary : primary;
      await mixer.crossfade(from, to, 0.1);
      expect(mixer.getPendingTimerCount()).toBeLessThanOrEqual(1);
    }

    expect(mixer.getNodeCount()).toBe(gainNodes);
    expect(getAudioGraphStats().createdNodes).toBe(0);
    expect(getAudioGraphStats().pendingCrossfadeTimers).toBe(1);

    vi.advanceTimersByTime(300);

    expect(mixer.getPendingTimerCount()).toBe(0);
    expect(getAudioGraphStats().pendingCrossfadeTimers).toBe(0);
  });

  it("releases disconnected nodes when decks are discarded", async () => {
    const { primary, secondary, engine, mixer } = await buildPlaybackGraph();
    const before = getAudioGraphStats();

    mixer.releaseElement(primary);
    expect(mixer.getNodeCount()).toBe(1);
    engine.releaseElement(secondary);
    expect(engine.sourceElementCount).toBe(1);

    const after = getAudioGraphStats();
    expect(after.releasedNodes).toBe(before.releasedNodes + 2);
    expect(after.activeNodes).toBe(before.activeNodes - 2);
    expect(after.crossfadeGainNodes).toBe(before.crossfadeGainNodes - 1);
    expect(after.mediaSourceNodes).toBe(before.mediaSourceNodes - 1);
  });
});
