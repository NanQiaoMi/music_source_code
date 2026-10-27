import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./AudioEngine";
import { AnalyserHub, FFT_SIZE, FREQUENCY_BIN_COUNT, analyserHub } from "./AnalyserHub";

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = "running";
  destination = { connect: vi.fn(), disconnect: vi.fn() };
  private readonly listeners = new Set<EventListener>();

  addEventListener(type: string, listener: EventListener): void {
    if (type === "statechange") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (type === "statechange") this.listeners.delete(listener);
  }

  close(): void {
    this.state = "closed";
    const event = new Event("statechange");
    for (const listener of this.listeners) listener(event);
  }

  get stateListenerCount(): number {
    return this.listeners.size;
  }

  createGain() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { value: 1, setTargetAtTime: vi.fn() },
    };
  }

  createBiquadFilter() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      type: "peaking",
      frequency: { value: 0 },
      Q: { value: 0 },
      gain: { value: 0, setTargetAtTime: vi.fn() },
    };
  }

  createAnalyser(): FakeAnalyser {
    return new FakeAnalyser(this);
  }

  createMediaElementSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }

  async resume(): Promise<void> {
    this.state = "running";
  }

  async suspend(): Promise<void> {
    this.state = "suspended";
  }
}

class FakeAnalyser {
  fftSize = 0;
  smoothingTimeConstant = 0;
  frequencyValue = 128;
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
  readonly getByteFrequencyData = vi.fn((array: Uint8Array) => {
    array.fill(this.frequencyValue);
  });
  readonly getByteTimeDomainData = vi.fn((array: Uint8Array) => {
    array.fill(128);
  });
  private readonly contextRef: FakeAudioContext;

  constructor(context: FakeAudioContext) {
    this.contextRef = context;
  }

  get context(): FakeAudioContext {
    return this.contextRef;
  }

  get frequencyBinCount(): number {
    return Math.floor(this.fftSize / 2);
  }
}

function attach(hub: AnalyserHub, context: FakeAudioContext): FakeAnalyser {
  const analyser = new FakeAnalyser(context);
  hub.attach(analyser as unknown as AnalyserNode);
  return analyser;
}

describe("AnalyserHub", () => {
  let hub: AnalyserHub;
  let context: FakeAudioContext;

  beforeEach(() => {
    hub = new AnalyserHub();
    context = new FakeAudioContext();
  });

  afterEach(() => {
    hub.detach();
    analyserHub.detach();
    Reflect.set(AudioEngine, "instance", undefined);
    vi.unstubAllGlobals();
  });

  it("forces a stable fftSize and exposes bin-sized reusable buffers", () => {
    const analyser = attach(hub, context);

    expect(analyser.fftSize).toBe(FFT_SIZE);
    expect(hub.fftSize).toBe(FFT_SIZE);

    const frame = hub.readFrame();
    expect(frame.frequency).toBe(hub.getFrequencyData());
    expect(frame.waveform).toBe(hub.getTimeDomainData());
    expect(frame.frequency).toHaveLength(FREQUENCY_BIN_COUNT);
    expect(frame.waveform).toHaveLength(FFT_SIZE);
    expect(frame.frequency).toHaveLength(analyser.frequencyBinCount);
    expect(hub.frequencyBinCount).toBe(FREQUENCY_BIN_COUNT);

    // A consumer writing fftSize must not win: the hub reasserts it on the next read.
    analyser.fftSize = 256;
    hub.readFrame();
    expect(analyser.fftSize).toBe(FFT_SIZE);
    expect(hub.frequencyBinCount).toBe(FREQUENCY_BIN_COUNT);
  });

  it("reads the analyser once per AudioContext currentTime quantum", () => {
    const analyser = attach(hub, context);

    const first = hub.readFrame();
    const firstFrameId = first.frameId;
    expect(analyser.getByteFrequencyData).toHaveBeenCalledTimes(1);
    expect(analyser.getByteTimeDomainData).toHaveBeenCalledTimes(1);

    expect(hub.readFrame()).toBe(first);
    expect(hub.getFrequencyData()).toBe(first.frequency);
    expect(hub.getTimeDomainData()).toBe(first.waveform);
    expect(analyser.getByteFrequencyData).toHaveBeenCalledTimes(1);

    context.currentTime = 0.5;
    const next = hub.readFrame();
    expect(next).toBe(first);
    expect(analyser.getByteFrequencyData).toHaveBeenCalledTimes(2);
    expect(next.frameId).toBeGreaterThan(firstFrameId);
  });

  it("returns the same frame and arrays across 1000 frames without new Uint8Array", () => {
    attach(hub, context);
    const allocations: number[] = [];
    const OriginalUint8Array = globalThis.Uint8Array;
    const trackedUint8Array = new Proxy(OriginalUint8Array, {
      construct(target, args) {
        allocations.push(1);
        return Reflect.construct(target, args);
      },
    });
    vi.stubGlobal("Uint8Array", trackedUint8Array);

    const first = hub.readFrame();
    const frequency = first.frequency;
    const waveform = first.waveform;
    const baseline = allocations.length;

    let last = first;
    for (let i = 0; i < 1000; i += 1) {
      context.currentTime += 1 / 60;
      last = hub.readFrame();
    }

    expect(allocations.length).toBe(baseline);
    expect(last).toBe(first);
    expect(last.frequency).toBe(frequency);
    expect(last.waveform).toBe(waveform);
    expect(last.frequency).toHaveLength(FREQUENCY_BIN_COUNT);
  });

  it("normalizes bass, mid, treble and full to 0..1", () => {
    const analyser = attach(hub, context);
    analyser.frequencyValue = 255;

    const loud = hub.readFrame();
    expect(loud.bass).toBeCloseTo(1, 6);
    expect(loud.mid).toBeCloseTo(1, 6);
    expect(loud.treble).toBeCloseTo(1, 6);
    expect(loud.full).toBeCloseTo(1, 6);

    analyser.frequencyValue = 128;
    context.currentTime = 1;
    const half = hub.readFrame();
    expect(half.bass).toBeGreaterThanOrEqual(0);
    expect(half.bass).toBeLessThanOrEqual(1);
    expect(half.treble).toBeGreaterThanOrEqual(0);
    expect(half.treble).toBeLessThanOrEqual(1);
    expect(half.full).toBeCloseTo(128 / 255, 6);
  });

  it("publishes one notification per new frame and stops after unsubscribe", () => {
    attach(hub, context);
    const listener = vi.fn();
    const unsubscribe = hub.subscribe(listener);

    hub.readFrame();
    hub.readFrame();
    expect(listener).toHaveBeenCalledTimes(1);

    context.currentTime = 1;
    hub.readFrame();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0]).toBe(listener.mock.calls[0][0]);

    unsubscribe();
    context.currentTime = 2;
    hub.readFrame();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("detaches and zeroes its shared buffers when the AudioContext closes", () => {
    const analyser = attach(hub, context);
    analyser.frequencyValue = 255;
    context.currentTime = 1;
    hub.readFrame();

    context.close();

    expect(hub.getAnalyser()).toBeNull();
    expect(context.stateListenerCount).toBe(0);
    expect(hub.getFrequencyData()[0]).toBe(0);
    expect(hub.getTimeDomainData()[0]).toBe(0);
    expect(hub.readFrame().bass).toBe(0);
  });

  it("keeps one fallback destination edge while sharing the analyser", () => {
    vi.stubGlobal("AudioContext", FakeAudioContext as unknown as typeof AudioContext);
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    Reflect.set(AudioEngine, "instance", undefined);

    const engine = AudioEngine.getInstance();
    engine.init(document.createElement("audio"));

    const analyser = engine.getAnalyser() as unknown as FakeAnalyser;
    expect(analyser).not.toBeNull();
    expect(analyser.fftSize).toBe(FFT_SIZE);
    expect(analyserHub.getAnalyser()).toBe(analyser);
    expect(engine.fftSize).toBe(FFT_SIZE);
    expect(engine.frequencyBinCount).toBe(FREQUENCY_BIN_COUNT);

    const destination = engine.getContext()!.destination;
    const connects = analyser.connect.mock.calls.filter(([to]) => to === destination).length;
    const disconnects = analyser.disconnect.mock.calls.filter(([to]) => to === destination).length;
    expect(connects - disconnects).toBe(1);
  });
});
