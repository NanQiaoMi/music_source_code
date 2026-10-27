/**
 * AnalyserHub
 * One AnalyserNode is shared by every visualizer; its buffers and frame object are
 * allocated once and refreshed at most once per AudioContext currentTime quantum.
 * Consumers MUST treat the returned arrays as read-only and must not retain them
 * across frames (their contents are overwritten in place).
 */
export interface AnalyserFrame {
  /** Shared read-only view with length FFT_SIZE / 2. Do not write or retain. */
  frequency: Uint8Array;
  /** Shared read-only view with length FFT_SIZE. Do not write or retain. */
  waveform: Uint8Array;
  /** Pre-computed band means in the 0..1 range. */
  bass: number;
  mid: number;
  treble: number;
  full: number;
  /** Increments once per new AudioContext currentTime quantum. */
  frameId: number;
}

export const FFT_SIZE = 2048;
export const FREQUENCY_BIN_COUNT = FFT_SIZE / 2;

export type AnalyserFrameListener = (frame: AnalyserFrame) => void;

type ContextWithStateEvents = BaseAudioContext & {
  addEventListener?: (type: "statechange", listener: EventListener) => void;
  removeEventListener?: (type: "statechange", listener: EventListener) => void;
};

interface MutableAnalyserFrame {
  frequency: Uint8Array;
  waveform: Uint8Array;
  bass: number;
  mid: number;
  treble: number;
  full: number;
  frameId: number;
}

export class AnalyserHub {
  private analyser: AnalyserNode | null = null;
  private context: ContextWithStateEvents | null = null;
  private frequencyData = new Uint8Array(FREQUENCY_BIN_COUNT);
  private waveformData = new Uint8Array(FFT_SIZE);
  private frame: MutableAnalyserFrame = {
    frequency: this.frequencyData,
    waveform: this.waveformData,
    bass: 0,
    mid: 0,
    treble: 0,
    full: 0,
    frameId: 0,
  };
  private lastQuantum = Number.NaN;
  private nextFrameId = 0;
  private listeners: Set<AnalyserFrameListener> | null = null;

  public attach(analyser: AnalyserNode): void {
    if (this.analyser === analyser) {
      this.enforceFftSize(analyser);
      return;
    }

    this.detach();
    this.analyser = analyser;
    this.enforceFftSize(analyser);

    const context = (analyser as AnalyserNode & { context?: ContextWithStateEvents }).context;
    this.context = context ?? null;
    this.resizeBuffers(analyser);

    if (context && typeof context.addEventListener === "function") {
      context.addEventListener("statechange", this.handleContextStateChange);
    }
  }

  public detach(): void {
    if (this.context && typeof this.context.removeEventListener === "function") {
      this.context.removeEventListener("statechange", this.handleContextStateChange);
    }
    this.analyser = null;
    this.context = null;
    this.lastQuantum = Number.NaN;
    this.resetFrame();
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public get fftSize(): number {
    return FFT_SIZE;
  }

  public get frequencyBinCount(): number {
    return this.frequencyData.length;
  }

  /** Shared frequency buffer; refreshed at most once per currentTime quantum. */
  public getFrequencyData(): Uint8Array {
    return this.readFrame().frequency;
  }

  /** Shared time-domain buffer; refreshed at most once per currentTime quantum. */
  public getTimeDomainData(): Uint8Array {
    return this.readFrame().waveform;
  }

  public readFrame(): AnalyserFrame {
    const analyser = this.analyser;
    if (!analyser) return this.frame;

    this.enforceFftSize(analyser);

    const context = this.context;
    if (context?.state === "closed") {
      this.detach();
      return this.frame;
    }

    const quantum = context ? context.currentTime : -1;
    if (quantum === this.lastQuantum) return this.frame;

    const frequency = this.frequencyData;
    analyser.getByteFrequencyData(frequency as Uint8Array<ArrayBuffer>);
    if (typeof analyser.getByteTimeDomainData === "function") {
      analyser.getByteTimeDomainData(this.waveformData as Uint8Array<ArrayBuffer>);
    }

    const length = frequency.length;
    const bassEnd = Math.max(1, Math.floor(length * 0.1));
    const midEnd = Math.max(bassEnd + 1, Math.floor(length * 0.45));
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    let fullSum = 0;

    for (let i = 0; i < length; i += 1) {
      const value = frequency[i];
      fullSum += value;
      if (i < bassEnd) bassSum += value;
      else if (i < midEnd) midSum += value;
      else trebleSum += value;
    }

    this.frame.bass = bassSum / (bassEnd * 255);
    this.frame.mid = midSum / (Math.max(1, midEnd - bassEnd) * 255);
    this.frame.treble = trebleSum / (Math.max(1, length - midEnd) * 255);
    this.frame.full = fullSum / (length * 255);
    this.frame.frameId = ++this.nextFrameId;
    this.lastQuantum = quantum;
    this.notify();

    return this.frame;
  }

  /** Optional push channel: called once per new AudioContext quantum. */
  public subscribe(listener: AnalyserFrameListener): () => void {
    if (!this.listeners) this.listeners = new Set();
    this.listeners.add(listener);
    return () => {
      this.listeners?.delete(listener);
    };
  }

  private readonly handleContextStateChange = (): void => {
    if (this.context?.state === "closed") this.detach();
  };

  private enforceFftSize(analyser: AnalyserNode): void {
    if (analyser.fftSize !== FFT_SIZE) analyser.fftSize = FFT_SIZE;
  }

  private resizeBuffers(analyser: AnalyserNode): void {
    const binCount = Math.max(1, analyser.frequencyBinCount);
    if (this.frequencyData.length !== binCount) {
      this.frequencyData = new Uint8Array(binCount);
      this.frame.frequency = this.frequencyData;
    }

    const waveLength = Math.max(1, analyser.fftSize);
    if (this.waveformData.length !== waveLength) {
      this.waveformData = new Uint8Array(waveLength);
      this.frame.waveform = this.waveformData;
    }
  }

  private resetFrame(): void {
    this.frequencyData.fill(0);
    this.waveformData.fill(0);
    this.frame.bass = 0;
    this.frame.mid = 0;
    this.frame.treble = 0;
    this.frame.full = 0;
  }

  private notify(): void {
    if (!this.listeners) return;
    for (const listener of this.listeners) {
      try {
        listener(this.frame);
      } catch {
        // A broken visualizer must not stop the shared analyser loop.
      }
    }
  }
}

export const analyserHub = new AnalyserHub();
