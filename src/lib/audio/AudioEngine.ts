/**
 * AudioEngine Singleton
 * Centrally manages the global AudioContext and the main audio graph.
 * This class exists outside the React lifecycle to prevent audio glitches during re-renders.
 */
import { recordNodesCreated, recordNodesReleased } from "./audioGraphStats";

type AudioContextConstructor = new () => AudioContext;
type AudioEngineWindow = Window & {
  webkitAudioContext?: AudioContextConstructor;
};

export class AudioEngine {
  private static instance: AudioEngine;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNodes: Map<HTMLAudioElement, MediaElementAudioSourceNode> = new Map();
  private eqNodes: BiquadFilterNode[] = [];
  private isInitialized = false;
  private isEQEnabled = false;
  // S2-1: destination 只允许一条入边。效果链接管输出后，引擎不再常连 destination。
  private outputOwnedByEffects = false;
  private fallbackConnected = false;
  // setVolume 可能先于 AudioContext 创建（hook 挂载时），先记住，建图时落到 masterGain。
  private userVolume = 1;

  private static EQ_FREQUENCIES = [
    20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
    2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000,
  ];

  private constructor() {
    // Private constructor for singleton. AudioContext is created lazily after a playback path asks for it.
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  private getAudioContextConstructor(): AudioContextConstructor | null {
    if (typeof window === "undefined") return null;
    return window.AudioContext || (window as AudioEngineWindow).webkitAudioContext || null;
  }

  private initContext(): AudioContext | null {
    if (this.context) return this.context;

    const ContextConstructor = this.getAudioContextConstructor();
    if (!ContextConstructor) return null;

    this.context = new ContextConstructor();

    // Create master nodes
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.userVolume;
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Build default graph (EQ -> Gain -> Analyser -> Destination)
    this.initEQNodes();

    // Connect EQ chain
    if (this.eqNodes.length > 0 && this.masterGain) {
      for (let i = 0; i < this.eqNodes.length - 1; i++) {
        this.eqNodes[i].connect(this.eqNodes[i + 1]);
      }
      this.eqNodes[this.eqNodes.length - 1].connect(this.masterGain);
    }

    this.masterGain.connect(this.analyser);
    this.connectFallbackOutput();

    // S2-3: 固定图节点只创建一次（masterGain + analyser + 30 段 EQ）。
    recordNodesCreated("graph", this.eqNodes.length + 2);

    return this.context;
  }

  public ensureContext(): AudioContext | null {
    return this.initContext();
  }

  private initEQNodes(): void {
    if (!this.context) return;

    this.eqNodes = [];
    for (let i = 0; i < AudioEngine.EQ_FREQUENCIES.length; i++) {
      const filter = this.context.createBiquadFilter();
      filter.type =
        i === 0
          ? "lowshelf"
          : i === AudioEngine.EQ_FREQUENCIES.length - 1
            ? "highshelf"
            : "peaking";
      filter.frequency.value = AudioEngine.EQ_FREQUENCIES[i];
      filter.Q.value = 1;
      filter.gain.value = 0;
      this.eqNodes.push(filter);
    }
  }

  /**
   * Returns the first node in the EQ chain, or masterGain if EQ is disabled.
   */
  public getEQChainEntry(): AudioNode | null {
    if (this.isEQEnabled && this.eqNodes.length > 0) {
      return this.eqNodes[0];
    }
    return this.masterGain;
  }

  public setEQEnabled(enabled: boolean): void {
    if (this.isEQEnabled === enabled) {
      return;
    }
    this.isEQEnabled = enabled;
    for (const sourceNode of this.sourceNodes.values()) {
      try {
        sourceNode.disconnect();
      } catch {
        // Ignore disconnect errors if node is not connected
      }
      const target = this.getEQChainEntry();
      if (target) {
        sourceNode.connect(target);
      }
    }
  }

  /**
   * Initializes the engine with a MediaElement (HTMLAudioElement).
   * Ensures that createMediaElementSource is only called once per element.
   */
  public init(audioElement: HTMLAudioElement): void {
    const context = this.initContext();
    if (!context || !audioElement) return;

    if (!this.sourceNodes.has(audioElement)) {
      try {
        const sourceNode = context.createMediaElementSource(audioElement);
        this.sourceNodes.set(audioElement, sourceNode);
        recordNodesCreated("media-source");
        const entry = this.getEQChainEntry();
        if (entry) {
          sourceNode.connect(entry);
        }
      } catch (e) {
        console.warn("AudioEngine: Source node creation failed", e);
      }
    }

    this.isInitialized = true;
  }

  /**
   * Returns an existing MediaElementSourceNode or creates a new one safely.
   */
  public createMediaSource(audioElement: HTMLAudioElement): MediaElementAudioSourceNode | null {
    const context = this.initContext();
    if (!context || !audioElement) return null;

    let sourceNode = this.sourceNodes.get(audioElement);
    if (!sourceNode) {
      try {
        sourceNode = context.createMediaElementSource(audioElement);
        this.sourceNodes.set(audioElement, sourceNode);
        recordNodesCreated("media-source");
      } catch (e) {
        console.warn("AudioEngine: Could not create media source", e);
        return null;
      }
    }
    return sourceNode;
  }

  /**
   * S2-3: 释放某个媒体元素拥有的 MediaElementSource。
   * 只应在音频元素被永久丢弃时调用（同一元素无法二次 createMediaElementSource，
   * 切歌只换 src，不换元素，因此播放路径不应调用这里）。
   */
  public releaseElement(audioElement: HTMLAudioElement): boolean {
    const sourceNode = this.sourceNodes.get(audioElement);
    if (!sourceNode) return false;

    try {
      sourceNode.disconnect();
    } catch {
      // 已断开时忽略。
    }
    this.sourceNodes.delete(audioElement);
    recordNodesReleased("media-source");
    return true;
  }

  /** S2-3: 生命周期探针——当前持有的图节点总数（创建后应恒定）。 */
  public getNodeCount(): number {
    return (
      (this.masterGain ? 1 : 0) +
      (this.analyser ? 1 : 0) +
      this.eqNodes.length +
      this.sourceNodes.size
    );
  }

  /** S2-3: 当前仍持有 MediaElementSource 的元素数量。 */
  public get sourceElementCount(): number {
    return this.sourceNodes.size;
  }

  public getContext(): AudioContext | null {
    return this.context;
  }

  public getAudioContext(): AudioContext | null {
    return this.context;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  public getDestination(): AudioNode | null {
    return this.context?.destination ?? null;
  }

  /**
   * S2-1: 效果链未接管输出时的唯一兜底入口（analyser -> destination）。
   * 幂等：重复调用不会产生重复边。
   */
  public connectFallbackOutput(): void {
    if (this.outputOwnedByEffects) return;
    if (this.fallbackConnected) return;
    if (!this.analyser || !this.context) return;

    this.analyser.connect(this.context.destination);
    this.fallbackConnected = true;
  }

  /**
   * S2-1: 效果链接管 destination 前先摘掉兜底直连，保证 destination 始终只有一条入边。
   */
  public setOutputOwnedByEffects(owned: boolean): void {
    if (owned && this.fallbackConnected && this.analyser && this.context) {
      try {
        this.analyser.disconnect(this.context.destination);
      } catch {
        // 已断开或上下文已关闭时忽略。
      }
      this.fallbackConnected = false;
    }
    this.outputOwnedByEffects = owned;
  }

  public updateEQ(bands: number[]): void {
    if (!this.eqNodes.length || !this.context) return;

    this.eqNodes.forEach((filter, i) => {
      if (bands[i] !== undefined) {
        filter.gain.setTargetAtTime(bands[i], this.context?.currentTime || 0, 0.01);
      }
    });
  }

  public setVolume(volume: number): void {
    this.userVolume = volume;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.01);
    }
  }

  public async resume(): Promise<void> {
    const context = this.initContext();
    if (context && context.state === "suspended") {
      await context.resume();
    }
  }

  public async suspend(): Promise<void> {
    if (this.context && this.context.state === "running") {
      await this.context.suspend();
    }
  }

  public getByteFrequencyData(array: Uint8Array): void {
    this.analyser?.getByteFrequencyData(array as Uint8Array<ArrayBuffer>);
  }

  public get fftSize(): number {
    return this.analyser?.fftSize || 2048;
  }

  public get frequencyBinCount(): number {
    return this.analyser?.frequencyBinCount || 1024;
  }
}
