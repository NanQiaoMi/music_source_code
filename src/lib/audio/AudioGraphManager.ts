import { AudioEngine } from "./AudioEngine";

export interface AudioNodeInfo {
  id: string;
  type: "source" | "gain" | "filter" | "compressor" | "analyser" | "panner" | "convolver" | "delay";
  node: globalThis.AudioNode;
  connected: boolean;
  params: Record<string, number | boolean | string>;
}

export interface AudioGraph {
  context: AudioContext;
  nodes: Map<string, AudioNodeInfo>;
  connections: Map<string, string[]>;
}

export class AudioGraphManager {
  private context: AudioContext | null = null;
  private nodes: Map<string, AudioNodeInfo> = new Map();
  private connections: Map<string, string[]> = new Map();
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  async init(): Promise<void> {
    if (typeof window === "undefined") return;

    this.context = AudioEngine.getInstance().getContext();
    if (!this.context) return;

    this.masterGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.compressor = this.context.createDynamicsCompressor();

    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.0;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.compressor);
    this.compressor.connect(this.context.destination);
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  async createSourceNode(
    id: string,
    audioElement: HTMLAudioElement
  ): Promise<MediaElementAudioSourceNode | null> {
    if (!this.context) return null;

    const source = this.context.createMediaElementSource(audioElement);
    this.nodes.set(id, {
      id,
      type: "source",
      node: source,
      connected: false,
      params: {},
    });

    return source;
  }

  createGainNode(id: string, gain: number = 1.0): GainNode | null {
    if (!this.context) return null;

    const gainNode = this.context.createGain();
    gainNode.gain.value = gain;

    this.nodes.set(id, {
      id,
      type: "gain",
      node: gainNode,
      connected: false,
      params: { gain },
    });

    return gainNode;
  }

  createFilterNode(
    id: string,
    type: BiquadFilterType,
    frequency: number,
    Q: number = 1,
    gain: number = 0
  ): BiquadFilterNode | null {
    if (!this.context) return null;

    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = Q;
    filter.gain.value = gain;

    this.nodes.set(id, {
      id,
      type: "filter",
      node: filter,
      connected: false,
      params: { frequency, Q, gain },
    });

    return filter;
  }

  createCompressorNode(
    id: string,
    threshold: number = -24,
    knee: number = 30,
    ratio: number = 12,
    attack: number = 0.003,
    release: number = 0.25
  ): DynamicsCompressorNode | null {
    if (!this.context) return null;

    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = threshold;
    compressor.knee.value = knee;
    compressor.ratio.value = ratio;
    compressor.attack.value = attack;
    compressor.release.value = release;

    this.nodes.set(id, {
      id,
      type: "compressor",
      node: compressor,
      connected: false,
      params: { threshold, knee, ratio, attack, release },
    });

    return compressor;
  }

  createDelayNode(id: string, delayTime: number = 0): DelayNode | null {
    if (!this.context) return null;

    const delay = this.context.createDelay();
    delay.delayTime.value = delayTime;

    this.nodes.set(id, {
      id,
      type: "delay",
      node: delay,
      connected: false,
      params: { delayTime },
    });

    return delay;
  }

  createConvolverNode(id: string, buffer: AudioBuffer): ConvolverNode | null {
    if (!this.context) return null;

    const convolver = this.context.createConvolver();
    convolver.buffer = buffer;

    this.nodes.set(id, {
      id,
      type: "convolver",
      node: convolver,
      connected: false,
      params: {},
    });

    return convolver;
  }

  connect(fromId: string, toId: string): boolean {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (!fromNode || !toNode) return false;

    try {
      (fromNode.node as globalThis.AudioNode).connect(toNode.node as globalThis.AudioNode);

      if (!this.connections.has(fromId)) {
        this.connections.set(fromId, []);
      }
      this.connections.get(fromId)!.push(toId);

      fromNode.connected = true;
      toNode.connected = true;

      return true;
    } catch (error) {
      console.error("Failed to connect nodes:", error);
      return false;
    }
  }

  disconnect(fromId: string, toId: string): boolean {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (!fromNode || !toNode) return false;

    try {
      (fromNode.node as globalThis.AudioNode).disconnect(toNode.node as globalThis.AudioNode);

      const connections = this.connections.get(fromId);
      if (connections) {
        const index = connections.indexOf(toId);
        if (index > -1) {
          connections.splice(index, 1);
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to disconnect nodes:", error);
      return false;
    }
  }

  updateNodeParams(id: string, params: Record<string, number | boolean | string>): boolean {
    const nodeInfo = this.nodes.get(id);
    if (!nodeInfo) return false;

    const node = nodeInfo.node as any;

    for (const [key, value] of Object.entries(params)) {
      if (node[key] && node[key] instanceof AudioParam) {
        (node[key] as AudioParam).value = value as number;
      } else if (typeof node[key] === "function") {
        node[key](value);
      }
    }

    nodeInfo.params = { ...nodeInfo.params, ...params };
    return true;
  }

  removeNode(id: string): boolean {
    const nodeInfo = this.nodes.get(id);
    if (!nodeInfo) return false;

    try {
      (nodeInfo.node as globalThis.AudioNode).disconnect();
      this.nodes.delete(id);
      this.connections.delete(id);
      return true;
    } catch (error) {
      console.error("Failed to remove node:", error);
      return false;
    }
  }

  getFrequencyData(): Float32Array | null {
    if (!this.analyser) return null;

    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(dataArray);
    return dataArray;
  }

  getTimeDomainData(): Float32Array | null {
    if (!this.analyser) return null;

    const dataArray = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  async resume(): Promise<void> {
    if (this.context && this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.context && this.context.state === "running") {
      await this.context.suspend();
    }
  }

  close(): void {
    if (this.context) {
      this.context.close();
      this.context = null;
      this.nodes.clear();
      this.connections.clear();
      this.masterGain = null;
      this.analyser = null;
      this.compressor = null;
    }
  }
}

export const audioGraphManager = new AudioGraphManager();
