/**
 * Tactile Sound Synthesis Engine (Web Audio Native)
 *
 * Synthesizes PSP-style mechanical gear clicks, ratchet detents, and haptic audio
 * micro-interactions using native Web Audio API oscillators and noise burst filters.
 *
 * Zero external audio file dependencies.
 */

export interface TactileTickOptions {
  /** Master volume multiplier (0.0 to 1.0, default 0.45) */
  volume?: number;
  /** Center base frequency in Hz (800Hz - 1400Hz, default 980Hz) */
  freq?: number;
  /** Pitch multiplier (e.g. 0.8 for low tick, 1.2 for high tick) */
  pitchShift?: number;
  /** Gear detent step count for rotational tooth micro-variation */
  detentStep?: number;
  /** Sound characteristic profile */
  type?: "gear" | "snap" | "clack" | "soft" | "switch";
}

class TactileSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.5;
  private lastTickTime: number = 0;
  private minIntervalMs: number = 45; // Rate limit to prevent audio clipping and CPU node saturation on ultra-fast scrolls

  constructor() {
    // Lazy initialization on first user interaction
    if (typeof window !== "undefined") {
      const unlock = () => {
        this.initContext();
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("wheel", unlock);
      };
      window.addEventListener("pointerdown", unlock, { passive: true, once: true });
      window.addEventListener("keydown", unlock, { passive: true, once: true });
      window.addEventListener("wheel", unlock, { passive: true, once: true });
    }
  }

  private initContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Set global master volume for tactile sounds */
  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /** Get current tactile volume */
  public getVolume(): number {
    return this.volume;
  }

  /**
   * Synthesizes a PSP-style crisp mechanical gear click tick
   * Structure:
   * 1. Primary downward sweep impulse (800Hz - 1200Hz down to ~250Hz in 5ms)
   * 2. Secondary micro-tooth ratchet bounce (at +2.5ms, higher pitched, 3ms decay)
   * 3. Filtered transient snap (bandpass white noise burst, 2ms)
   */
  public playTick(options: TactileTickOptions = {}): void {
    const nowMs = performance.now();
    if (nowMs - this.lastTickTime < this.minIntervalMs) {
      return;
    }
    this.lastTickTime = nowMs;

    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    const optVolume = options.volume ?? 0.45;
    const baseFreq = options.freq ?? 980;
    const pitchShift = options.pitchShift ?? 1.0;
    const step = options.detentStep ?? 0;
    const type = options.type ?? "gear";

    // Slight frequency modulation based on gear detent step for authentic analog mechanical tooth feel
    const detentFactor = 1 + (((step % 5) - 2) * 0.035);
    const freq = Math.max(200, Math.min(4000, baseFreq * pitchShift * detentFactor));

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(this.masterGain);

    if (type === "gear" || type === "clack") {
      // ── 1. Primary Impulse (Down-sweeping triangle/sine wave) ──
      const osc1 = ctx.createOscillator();
      const osc1Gain = ctx.createGain();

      osc1.type = type === "clack" ? "square" : "triangle";
      osc1.frequency.setValueAtTime(freq * 1.2, now);
      osc1.frequency.exponentialRampToValueAtTime(freq * 0.28, now + 0.0055);

      osc1Gain.gain.setValueAtTime(optVolume * 0.9, now);
      osc1Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.0065);

      osc1.connect(osc1Gain);
      osc1Gain.connect(gainNode);

      osc1.start(now);
      osc1.stop(now + 0.008);

      // ── 2. Mechanical Ratchet Rebound (Secondary tooth click) ──
      const osc2 = ctx.createOscillator();
      const osc2Gain = ctx.createGain();
      const delay2 = 0.0022;

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq * 1.45, now + delay2);
      osc2.frequency.exponentialRampToValueAtTime(freq * 0.5, now + delay2 + 0.004);

      osc2Gain.gain.setValueAtTime(0, now);
      osc2Gain.gain.setValueAtTime(optVolume * 0.4, now + delay2);
      osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + delay2 + 0.0045);

      osc2.connect(osc2Gain);
      osc2Gain.connect(gainNode);

      osc2.start(now + delay2);
      osc2.stop(now + delay2 + 0.006);

      // ── 3. Transient Noise Snap (Mechanical click transient) ──
      this.playNoiseSnap(ctx, gainNode, now, optVolume * 0.35, freq * 1.8);
    } else if (type === "snap") {
      // Crisp light snap (higher frequency, shorter decay)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 1.6, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.004);

      oscGain.gain.setValueAtTime(optVolume * 0.8, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.0045);

      osc.connect(oscGain);
      oscGain.connect(gainNode);

      osc.start(now);
      osc.stop(now + 0.006);
      this.playNoiseSnap(ctx, gainNode, now, optVolume * 0.4, 2800);
    } else if (type === "soft") {
      // Soft subdued tick
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 0.9, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.35, now + 0.008);

      oscGain.gain.setValueAtTime(optVolume * 0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.009);

      osc.connect(oscGain);
      oscGain.connect(gainNode);

      osc.start(now);
      osc.stop(now + 0.01);
    } else if (type === "switch") {
      // Mode switch sound: dual resonant click
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const gA = ctx.createGain();
      const gB = ctx.createGain();

      oscA.type = "triangle";
      oscA.frequency.setValueAtTime(650 * pitchShift, now);
      oscA.frequency.exponentialRampToValueAtTime(1200 * pitchShift, now + 0.012);
      gA.gain.setValueAtTime(optVolume * 0.6, now);
      gA.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

      oscB.type = "sine";
      oscB.frequency.setValueAtTime(1400 * pitchShift, now + 0.008);
      oscB.frequency.exponentialRampToValueAtTime(900 * pitchShift, now + 0.02);
      gB.gain.setValueAtTime(0, now);
      gB.gain.setValueAtTime(optVolume * 0.5, now + 0.008);
      gB.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      oscA.connect(gA);
      gA.connect(gainNode);
      oscB.connect(gB);
      gB.connect(gainNode);

      oscA.start(now);
      oscA.stop(now + 0.018);
      oscB.start(now + 0.008);
      oscB.stop(now + 0.025);
    }

    // Clean up gainNode after sound completes
    setTimeout(() => {
      gainNode.disconnect();
    }, 50);
  }

  /** Helper to generate a micro noise burst */
  private playNoiseSnap(
    ctx: AudioContext,
    destination: AudioNode,
    startTime: number,
    volume: number,
    centerFreq: number
  ): void {
    const bufferSize = Math.floor(ctx.sampleRate * 0.003); // 3ms buffer
    if (bufferSize <= 0) return;

    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(centerFreq, startTime);
    filter.Q.setValueAtTime(3.5, startTime);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.0035);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(destination);

    noiseSource.start(startTime);
    noiseSource.stop(startTime + 0.004);
  }
}

// Global Singleton Instance
const tactileEngine = new TactileSoundEngine();

/**
 * Primary export: Play PSP mechanical gear click sound (800Hz - 1200Hz, 5ms short pulse)
 */
export function playTactileTick(options?: TactileTickOptions): void {
  tactileEngine.playTick(options);
}

/**
 * Play gear tooth rotation click with automatic pitch detent variation
 * @param step Gear rotation step index
 * @param velocity Speed factor (0.5 to 2.0)
 */
export function playMechanicalGearTick(step: number = 0, velocity: number = 1.0): void {
  const pitchShift = Math.max(0.7, Math.min(1.4, 0.95 + (velocity - 1.0) * 0.15));
  tactileEngine.playTick({
    freq: 1020,
    volume: Math.min(0.65, 0.4 + (velocity - 1.0) * 0.1),
    detentStep: step,
    pitchShift,
    type: "gear",
  });
}

/**
 * Play card selection / confirmation click
 */
export function playCardSelectTick(): void {
  tactileEngine.playTick({
    freq: 1250,
    volume: 0.6,
    type: "snap",
  });
}

/**
 * Play spatial mode switch click (Side Shelf ⇋ Stage Shelf)
 */
export function playModeSwitchTick(): void {
  tactileEngine.playTick({
    volume: 0.55,
    type: "switch",
  });
}

/**
 * Set master volume for all tactile feedback sounds
 */
export function setTactileVolume(vol: number): void {
  tactileEngine.setVolume(vol);
}

/**
 * Get current master volume for tactile feedback sounds
 */
export function getTactileVolume(): number {
  return tactileEngine.getVolume();
}
