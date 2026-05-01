export type DSPProcessorType =
  | "eq"
  | "compressor"
  | "limiter"
  | "reverb"
  | "delay"
  | "chorus"
  | "phaser"
  | "distortion";

export interface DSPProcessorConfig {
  type: DSPProcessorType;
  enabled: boolean;
  params: Record<string, number | boolean | string>;
}

export interface EQBand {
  frequency: number;
  gain: number;
  Q: number;
  type: BiquadFilterType;
}

export class DSPProcessor {
  private context: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private wetNode: GainNode;
  private dryNode: GainNode;
  private processors: AudioNode[] = [];
  private config: DSPProcessorConfig;

  constructor(context: AudioContext, config: DSPProcessorConfig) {
    this.context = context;
    this.config = config;

    this.inputNode = context.createGain();
    this.outputNode = context.createGain();
    this.wetNode = context.createGain();
    this.dryNode = context.createGain();

    this.buildProcessorChain();
  }

  private buildProcessorChain(): void {
    switch (this.config.type) {
      case "eq":
        this.buildEQ();
        break;
      case "compressor":
        this.buildCompressor();
        break;
      case "limiter":
        this.buildLimiter();
        break;
      case "reverb":
        this.buildReverb();
        break;
      case "delay":
        this.buildDelay();
        break;
      case "chorus":
        this.buildChorus();
        break;
      case "phaser":
        this.buildPhaser();
        break;
      case "distortion":
        this.buildDistortion();
        break;
    }
  }

  private buildEQ(): void {
    const bands = (this.config.params.bands as unknown as EQBand[]) || [];

    bands.forEach((band) => {
      const filter = this.context.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = band.Q;
      this.processors.push(filter);
    });

    this.connectChain();
  }

  private buildCompressor(): void {
    const compressor = this.context.createDynamicsCompressor();

    compressor.threshold.value = (this.config.params.threshold as number) || -24;
    compressor.knee.value = (this.config.params.knee as number) || 30;
    compressor.ratio.value = (this.config.params.ratio as number) || 12;
    compressor.attack.value = (this.config.params.attack as number) || 0.003;
    compressor.release.value = (this.config.params.release as number) || 0.25;

    this.processors.push(compressor);
    this.connectChain();
  }

  private buildLimiter(): void {
    const limiter = this.context.createDynamicsCompressor();

    limiter.threshold.value = (this.config.params.threshold as number) || -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;

    this.processors.push(limiter);
    this.connectChain();
  }

  private buildReverb(): void {
    const convolver = this.context.createConvolver();
    const mix = (this.config.params.mix as number) || 0.5;

    this.wetNode.gain.value = mix;
    this.dryNode.gain.value = 1 - mix;

    this.processors.push(convolver);

    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);

    if (this.processors.length > 0) {
      this.inputNode.connect(this.processors[0]);
      this.connectProcessors();
      this.processors[this.processors.length - 1].connect(this.wetNode);
      this.wetNode.connect(this.outputNode);
    }
  }

  private buildDelay(): void {
    const delay = this.context.createDelay(5.0);
    const feedback = this.context.createGain();
    const mix = (this.config.params.mix as number) || 0.5;

    delay.delayTime.value = (this.config.params.time as number) || 0.5;
    feedback.gain.value = (this.config.params.feedback as number) || 0.3;

    this.wetNode.gain.value = mix;
    this.dryNode.gain.value = 1 - mix;

    delay.connect(feedback);
    feedback.connect(delay);

    this.processors.push(delay, feedback);

    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);
    this.inputNode.connect(delay);
    delay.connect(this.wetNode);
    this.wetNode.connect(this.outputNode);
  }

  private buildChorus(): void {
    const delay1 = this.context.createDelay();
    const delay2 = this.context.createDelay();
    const lfo1 = this.context.createOscillator();
    const lfo2 = this.context.createOscillator();
    const lfoGain1 = this.context.createGain();
    const lfoGain2 = this.context.createGain();

    const rate = (this.config.params.rate as number) || 1.5;
    const depth = (this.config.params.depth as number) || 0.002;
    const mix = (this.config.params.mix as number) || 0.5;

    lfo1.frequency.value = rate;
    lfo2.frequency.value = rate * 1.1;
    lfoGain1.gain.value = depth;
    lfoGain2.gain.value = depth;

    delay1.delayTime.value = 0.02;
    delay2.delayTime.value = 0.025;

    lfo1.connect(lfoGain1);
    lfo2.connect(lfoGain2);
    lfoGain1.connect(delay1.delayTime);
    lfoGain2.connect(delay2.delayTime);

    lfo1.start();
    lfo2.start();

    this.wetNode.gain.value = mix;
    this.dryNode.gain.value = 1 - mix;

    this.processors.push(delay1, delay2);

    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);
    this.inputNode.connect(delay1);
    this.inputNode.connect(delay2);
    delay1.connect(this.wetNode);
    delay2.connect(this.wetNode);
    this.wetNode.connect(this.outputNode);
  }

  private buildPhaser(): void {
    const filters: BiquadFilterNode[] = [];
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();

    const rate = (this.config.params.rate as number) || 0.5;
    const depth = (this.config.params.depth as number) || 1000;
    const stages = (this.config.params.stages as number) || 4;
    const mix = (this.config.params.mix as number) || 0.5;

    lfo.frequency.value = rate;
    lfoGain.gain.value = depth;

    for (let i = 0; i < stages; i++) {
      const filter = this.context.createBiquadFilter();
      filter.type = "allpass";
      filter.frequency.value = 1000;
      filter.Q.value = 10;
      filters.push(filter);
      this.processors.push(filter);
    }

    lfo.connect(lfoGain);
    filters.forEach((filter) => {
      lfoGain.connect(filter.frequency);
    });

    lfo.start();

    this.wetNode.gain.value = mix;
    this.dryNode.gain.value = 1 - mix;

    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);
    this.connectChain();
    this.processors[this.processors.length - 1].connect(this.wetNode);
    this.wetNode.connect(this.outputNode);
  }

  private buildDistortion(): void {
    const distortion = this.context.createWaveShaper();
    const amount = (this.config.params.amount as number) || 50;

    const curve = this.makeDistortionCurve(amount);
    (distortion.curve as any) = curve;
    distortion.oversample = "4x";

    this.processors.push(distortion);
    this.connectChain();
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve as Float32Array<ArrayBuffer>;
  }

  private connectChain(): void {
    if (this.processors.length === 0) {
      this.inputNode.connect(this.outputNode);
      return;
    }
    this.inputNode.connect(this.processors[0]);
    this.connectProcessors();
    this.processors[this.processors.length - 1].connect(this.outputNode);
  }

  private connectProcessors(): void {
    for (let i = 0; i < this.processors.length - 1; i++) {
      this.processors[i].connect(this.processors[i + 1]);
    }
  }

  getInputNode(): GainNode {
    return this.inputNode;
  }

  getOutputNode(): GainNode {
    return this.outputNode;
  }

  updateParam(param: string, value: number | boolean | string): void {
    this.config.params[param] = value;

    switch (this.config.type) {
      case "eq":
        this.updateEQParam(param, value);
        break;
      case "compressor":
        this.updateCompressorParam(param, value);
        break;
      case "delay":
        this.updateDelayParam(param, value);
        break;
    }
  }

  private updateEQParam(param: string, value: number | boolean | string): void {
    if (param.startsWith("band_")) {
      const [_, bandIndex, bandParam] = param.split("_");
      const index = parseInt(bandIndex);
      const filter = this.processors[index] as BiquadFilterNode;

      if (filter) {
        switch (bandParam) {
          case "gain":
            filter.gain.value = value as number;
            break;
          case "frequency":
            filter.frequency.value = value as number;
            break;
          case "Q":
            filter.Q.value = value as number;
            break;
        }
      }
    }
  }

  private updateCompressorParam(param: string, value: number | boolean | string): void {
    const compressor = this.processors[0] as DynamicsCompressorNode;
    if (!compressor) return;

    switch (param) {
      case "threshold":
        compressor.threshold.value = value as number;
        break;
      case "knee":
        compressor.knee.value = value as number;
        break;
      case "ratio":
        compressor.ratio.value = value as number;
        break;
      case "attack":
        compressor.attack.value = value as number;
        break;
      case "release":
        compressor.release.value = value as number;
        break;
    }
  }

  private updateDelayParam(param: string, value: number | boolean | string): void {
    switch (param) {
      case "time":
        (this.processors[0] as DelayNode).delayTime.value = value as number;
        break;
      case "feedback":
        (this.processors[1] as GainNode).gain.value = value as number;
        break;
      case "mix":
        this.wetNode.gain.value = value as number;
        this.dryNode.gain.value = 1 - (value as number);
        break;
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (enabled) {
      this.inputNode.gain.value = 1;
      this.outputNode.gain.value = 1;
    } else {
      this.inputNode.gain.value = 0;
      this.outputNode.gain.value = 0;
    }
  }

  disconnect(): void {
    this.processors.forEach((processor) => {
      processor.disconnect();
    });
    this.inputNode.disconnect();
    this.outputNode.disconnect();
    this.wetNode.disconnect();
    this.dryNode.disconnect();
  }
}

export class DSPChain {
  private context: AudioContext;
  private processors: Map<string, DSPProcessor> = new Map();
  private inputNode: GainNode;
  private outputNode: GainNode;

  constructor(context: AudioContext) {
    this.context = context;
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();
  }

  addProcessor(id: string, config: DSPProcessorConfig): DSPProcessor {
    const processor = new DSPProcessor(this.context, config);
    this.processors.set(id, processor);
    this.rebuildChain();
    return processor;
  }

  removeProcessor(id: string): void {
    const processor = this.processors.get(id);
    if (processor) {
      processor.disconnect();
      this.processors.delete(id);
      this.rebuildChain();
    }
  }

  getProcessor(id: string): DSPProcessor | undefined {
    return this.processors.get(id);
  }

  private rebuildChain(): void {
    this.inputNode.disconnect();
    this.outputNode.disconnect();

    const processorArray = Array.from(this.processors.values());

    if (processorArray.length === 0) {
      this.inputNode.connect(this.outputNode);
      return;
    }

    this.inputNode.connect(processorArray[0].getInputNode());

    for (let i = 0; i < processorArray.length - 1; i++) {
      processorArray[i].getOutputNode().connect(processorArray[i + 1].getInputNode());
    }

    processorArray[processorArray.length - 1].getOutputNode().connect(this.outputNode);
  }

  getInputNode(): GainNode {
    return this.inputNode;
  }

  getOutputNode(): GainNode {
    return this.outputNode;
  }

  disconnect(): void {
    this.processors.forEach((processor) => processor.disconnect());
    this.processors.clear();
    this.inputNode.disconnect();
    this.outputNode.disconnect();
  }
}
