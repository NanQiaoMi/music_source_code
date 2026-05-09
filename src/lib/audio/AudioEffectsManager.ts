import { AudioEffectType } from "@/store/audioEffectsStore";
import { getAudioContext, getAudioAnalyser } from "@/hooks/useAudioPlayer";

export class AudioEffectsManager {
  private context: AudioContext | null = null;
  private sourceNode: AudioNode | null = null;
  private destinationNode: AudioNode | null = null;

  // 基础增益节点
  private originalGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private dryGain: GainNode | null = null;

  // 环境空间类
  private autoPanNode: StereoPannerNode | null = null;
  private autoPanOscillator: OscillatorNode | null = null;
  private autoPanGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private stereoWidenerSplitter: ChannelSplitterNode | null = null;
  private stereoWidenerMerger: ChannelMergerNode | null = null;
  private stereoWidenerMidGain: GainNode | null = null;
  private stereoWidenerSideGain: GainNode | null = null;
  private stereoWidenerDelayLeft: DelayNode | null = null;
  private stereoWidenerDelayRight: DelayNode | null = null;

  // 时域变换类
  private nightcoreFilter: BiquadFilterNode | null = null;
  private vaporwaveFilter: BiquadFilterNode | null = null;
  private cassetteLFO: OscillatorNode | null = null;
  private cassetteGain: GainNode | null = null;
  private tremoloLFO: OscillatorNode | null = null;
  private tremoloGain: GainNode | null = null;

  // 音质质感类
  private underwaterFilter: BiquadFilterNode | null = null;
  private underwaterDelay: DelayNode | null = null;
  private vinylBPF: BiquadFilterNode | null = null;
  private vinylDistortion: WaveShaperNode | null = null;
  private vinylLPF: BiquadFilterNode | null = null;
  private talkieHPF: BiquadFilterNode | null = null;
  private talkieLPF: BiquadFilterNode | null = null;
  private talkieDistortion: WaveShaperNode | null = null;
  private megaBassFilter: BiquadFilterNode | null = null;
  private asmrFilter: BiquadFilterNode | null = null;
  private asmrCompressor: DynamicsCompressorNode | null = null;
  private phaserAllPassNodes: BiquadFilterNode[] = [];
  private phaserLFO: OscillatorNode | null = null;
  private phaserGain: GainNode | null = null;
  private vocalRemoveSplitter: ChannelSplitterNode | null = null;
  private vocalRemoveMerger: ChannelMergerNode | null = null;
  private vocalRemoveGain: GainNode | null = null;
  private vocalRemoveHP: BiquadFilterNode | null = null;
  private vocalRemoveLP: BiquadFilterNode | null = null;

  // 新增：赛博失真
  private cyberpunkDistortion: WaveShaperNode | null = null;
  private cyberpunkFilter: BiquadFilterNode | null = null;

  // 新增：低保真电台
  private loFiPhoneHPF: BiquadFilterNode | null = null;
  private loFiPhoneLPF: BiquadFilterNode | null = null;
  private loFiPhoneDistortion: WaveShaperNode | null = null;
  private loFiPhoneNoise: OscillatorNode | null = null;
  private loFiPhoneNoiseGain: GainNode | null = null;

  // 通用效果器
  private isInitialized = false;
  private effectsEnabled = new Map<AudioEffectType, boolean>();
  private effectIntensities = new Map<AudioEffectType, number>();

  private mediaElement: HTMLAudioElement | null = null;
  private originalPlaybackRate: number = 1;

  constructor() {
    const effectTypes: AudioEffectType[] = [
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

    effectTypes.forEach((type) => {
      this.effectsEnabled.set(type, false);
      this.effectIntensities.set(type, 0.5);
    });

    this.effectIntensities.set("reverb", 0.4);
    this.effectIntensities.set("stereoWidener", 0.5);
    this.effectIntensities.set("nightcore", 1.0);
    this.effectIntensities.set("vaporwave", 0.8);
    this.effectIntensities.set("cassette", 0.4);
    this.effectIntensities.set("tremolo", 0.5);
    this.effectIntensities.set("underwater", 0.7);
    this.effectIntensities.set("vinyl", 0.6);
    this.effectIntensities.set("bitcrusher", 0.5);
    this.effectIntensities.set("talkie", 0.6);
    this.effectIntensities.set("megaBass", 0.5);
    this.effectIntensities.set("asmr", 0.6);
    this.effectIntensities.set("phaser", 0.5);
    this.effectIntensities.set("vocalRemove", 0.8);
    this.effectIntensities.set("cyberpunkDistortion", 0.7);
    this.effectIntensities.set("loFiPhone", 0.8);
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    this.context = getAudioContext();
    if (!this.context) return;

    // 基础增益
    this.originalGain = this.context.createGain();
    this.wetGain = this.context.createGain();
    this.dryGain = this.context.createGain();

    // 8D 环绕音
    this.autoPanNode = this.context.createStereoPanner();
    this.autoPanOscillator = this.context.createOscillator();
    this.autoPanGain = this.context.createGain();
    this.autoPanOscillator.type = "sine";
    this.autoPanOscillator.frequency.value = 0.15;
    this.autoPanGain.gain.value = 0;
    this.autoPanOscillator.connect(this.autoPanGain);
    this.autoPanGain.connect(this.autoPanNode.pan);
    this.autoPanOscillator.start();

    // 演唱会现场 (混响)
    this.reverbNode = this.context.createConvolver();

    // 多维拓宽
    this.stereoWidenerSplitter = this.context.createChannelSplitter(2);
    this.stereoWidenerMerger = this.context.createChannelMerger(2);
    this.stereoWidenerMidGain = this.context.createGain();
    this.stereoWidenerSideGain = this.context.createGain();
    this.stereoWidenerDelayLeft = this.context.createDelay(0.005);
    this.stereoWidenerDelayRight = this.context.createDelay(0.005);

    // 蒸汽波
    this.vaporwaveFilter = this.context.createBiquadFilter();
    this.vaporwaveFilter.type = "lowpass";
    this.vaporwaveFilter.frequency.value = 2000;

    // 夜核
    this.nightcoreFilter = this.context.createBiquadFilter();
    this.nightcoreFilter.type = "highshelf";
    this.nightcoreFilter.frequency.value = 2000;
    this.nightcoreFilter.gain.value = 3;

    // 卡带机失真
    this.cassetteLFO = this.context.createOscillator();
    this.cassetteGain = this.context.createGain();
    this.cassetteLFO.type = "sine";
    this.cassetteLFO.frequency.value = 0.5;
    this.cassetteGain.gain.value = 0;

    // 颤音冲浪
    this.tremoloLFO = this.context.createOscillator();
    this.tremoloGain = this.context.createGain();
    this.tremoloLFO.type = "sine";
    this.tremoloLFO.frequency.value = 8;
    this.tremoloGain.gain.value = 0;
    this.tremoloLFO.connect(this.tremoloGain);
    this.tremoloLFO.start();

    // 水下潜听
    this.underwaterFilter = this.context.createBiquadFilter();
    this.underwaterFilter.type = "lowpass";
    this.underwaterFilter.frequency.value = 400;
    this.underwaterDelay = this.context.createDelay(0.05);

    // 黑胶唱片
    this.vinylBPF = this.context.createBiquadFilter();
    this.vinylBPF.type = "bandpass";
    this.vinylBPF.frequency.value = 2000;
    this.vinylBPF.Q.value = 1;
    this.vinylDistortion = this.context.createWaveShaper();
    this.vinylLPF = this.context.createBiquadFilter();
    this.vinylLPF.type = "lowpass";
    this.vinylLPF.frequency.value = 4000;
    this.createDistortionCurve(this.vinylDistortion, 20);

    // 对讲机
    this.talkieHPF = this.context.createBiquadFilter();
    this.talkieHPF.type = "highpass";
    this.talkieHPF.frequency.value = 1200;
    this.talkieLPF = this.context.createBiquadFilter();
    this.talkieLPF.type = "lowpass";
    this.talkieLPF.frequency.value = 3500;
    this.talkieDistortion = this.context.createWaveShaper();
    this.createDistortionCurve(this.talkieDistortion, 50);

    // 深海巨响
    this.megaBassFilter = this.context.createBiquadFilter();
    this.megaBassFilter.type = "peaking";
    this.megaBassFilter.frequency.value = 60;
    this.megaBassFilter.Q.value = 2;
    this.megaBassFilter.gain.value = 0;

    // 颅内高潮
    this.asmrFilter = this.context.createBiquadFilter();
    this.asmrFilter.type = "highshelf";
    this.asmrFilter.frequency.value = 8000;
    this.asmrFilter.gain.value = 0;
    this.asmrCompressor = this.context.createDynamicsCompressor();
    this.asmrCompressor.threshold.value = -30;
    this.asmrCompressor.ratio.value = 4;
    this.asmrCompressor.attack.value = 0.003;
    this.asmrCompressor.release.value = 0.25;

    // 极化迷幻
    this.phaserLFO = this.context.createOscillator();
    this.phaserGain = this.context.createGain();
    this.phaserLFO.type = "sine";
    this.phaserLFO.frequency.value = 0.5;
    this.phaserGain.gain.value = 0;
    this.phaserLFO.connect(this.phaserGain);
    this.phaserLFO.start();

    for (let i = 0; i < 6; i++) {
      const allPass = this.context.createBiquadFilter();
      allPass.type = "allpass";
      allPass.frequency.value = 500 + i * 300;
      this.phaserGain.connect(allPass.frequency);
      this.phaserAllPassNodes.push(allPass);
    }

    // KTV 伴奏
    this.vocalRemoveSplitter = this.context.createChannelSplitter(2);
    this.vocalRemoveMerger = this.context.createChannelMerger(2);
    this.vocalRemoveGain = this.context.createGain();
    this.vocalRemoveGain.gain.value = 1;
    this.vocalRemoveHP = this.context.createBiquadFilter();
    this.vocalRemoveHP.type = "highpass";
    this.vocalRemoveHP.frequency.value = 100;
    this.vocalRemoveLP = this.context.createBiquadFilter();
    this.vocalRemoveLP.type = "lowpass";
    this.vocalRemoveLP.frequency.value = 5000;

    // 赛博失真 (Hard clipping & filtering)
    this.cyberpunkDistortion = this.context.createWaveShaper();
    this.createDistortionCurve(this.cyberpunkDistortion, 100);
    this.cyberpunkFilter = this.context.createBiquadFilter();
    this.cyberpunkFilter.type = "peaking";
    this.cyberpunkFilter.frequency.value = 2500;
    this.cyberpunkFilter.gain.value = 10;

    // 低保真电台 (Telephone EQ & Noise)
    this.loFiPhoneHPF = this.context.createBiquadFilter();
    this.loFiPhoneHPF.type = "highpass";
    this.loFiPhoneHPF.frequency.value = 400;
    this.loFiPhoneLPF = this.context.createBiquadFilter();
    this.loFiPhoneLPF.type = "lowpass";
    this.loFiPhoneLPF.frequency.value = 2500;
    this.loFiPhoneDistortion = this.context.createWaveShaper();
    this.createDistortionCurve(this.loFiPhoneDistortion, 15);

    this.loFiPhoneNoise = this.context.createOscillator();
    this.loFiPhoneNoise.type = "sawtooth";
    this.loFiPhoneNoise.frequency.value = 50; // Low frequency rumble
    this.loFiPhoneNoiseGain = this.context.createGain();
    this.loFiPhoneNoiseGain.gain.value = 0;
    this.loFiPhoneNoise.connect(this.loFiPhoneNoiseGain);
    this.loFiPhoneNoise.start();

    this.originalGain.gain.value = 1;
    this.wetGain.gain.value = 0;
    this.dryGain.gain.value = 1;

    await this.createReverbImpulse();

    this.isInitialized = true;
  }

  private createDistortionCurve(node: WaveShaperNode, amount: number): void {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    node.curve = curve;
  }

  private async createReverbImpulse(): Promise<void> {
    if (!this.context || !this.reverbNode) return;

    const sampleRate = this.context.sampleRate;
    const length = sampleRate * 3;
    const impulse = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }

    this.reverbNode.buffer = impulse;
  }

  connect(source: AudioNode, destination: AudioNode, mediaElement?: HTMLAudioElement): void {
    if (!this.isInitialized) return;
    if (!this.context) return;

    this.sourceNode = source;
    this.destinationNode = destination;

    if (mediaElement) {
      this.mediaElement = mediaElement;
      this.originalPlaybackRate = mediaElement.playbackRate;
    }

    this.rebuildAudioChain();
  }

  private rebuildAudioChain(): void {
    if (!this.context || !this.sourceNode || !this.destinationNode) return;

    try {
      // 断开所有节点
      this.autoPanNode?.disconnect();
      this.reverbNode?.disconnect();
      this.originalGain?.disconnect();
      this.wetGain?.disconnect();
      this.dryGain?.disconnect();
      this.vaporwaveFilter?.disconnect();
      this.nightcoreFilter?.disconnect();
      this.underwaterFilter?.disconnect();
      this.underwaterDelay?.disconnect();
      this.vinylBPF?.disconnect();
      this.vinylDistortion?.disconnect();
      this.vinylLPF?.disconnect();
      this.talkieHPF?.disconnect();
      this.talkieLPF?.disconnect();
      this.talkieDistortion?.disconnect();
      this.megaBassFilter?.disconnect();
      this.asmrFilter?.disconnect();
      this.asmrCompressor?.disconnect();
      this.phaserAllPassNodes.forEach((n) => n?.disconnect());
      this.vocalRemoveSplitter?.disconnect();
      this.vocalRemoveMerger?.disconnect();
      this.vocalRemoveGain?.disconnect();
      this.vocalRemoveHP?.disconnect();
      this.vocalRemoveLP?.disconnect();
      this.stereoWidenerSplitter?.disconnect();
      this.stereoWidenerMerger?.disconnect();
      this.stereoWidenerMidGain?.disconnect();
      this.stereoWidenerSideGain?.disconnect();
      this.stereoWidenerDelayLeft?.disconnect();
      this.stereoWidenerDelayRight?.disconnect();
      this.tremoloGain?.disconnect();

      this.cyberpunkDistortion?.disconnect();
      this.cyberpunkFilter?.disconnect();

      this.loFiPhoneHPF?.disconnect();
      this.loFiPhoneLPF?.disconnect();
      this.loFiPhoneDistortion?.disconnect();
      this.loFiPhoneNoiseGain?.disconnect();
    } catch (e) {}

    const hasAnyEffect = Array.from(this.effectsEnabled.values()).some((v) => v);

    if (!hasAnyEffect) {
      if (this.mediaElement) {
        this.mediaElement.playbackRate = this.originalPlaybackRate;
      }
      this.sourceNode.connect(this.destinationNode);
      return;
    }

    let currentNode: AudioNode = this.sourceNode;

    // 处理播放速度相关效果（互斥）
    if (this.effectsEnabled.get("vaporwave")) {
      if (this.mediaElement) {
        this.mediaElement.playbackRate = 0.8;
      }
      if (this.vaporwaveFilter) {
        currentNode.connect(this.vaporwaveFilter);
        currentNode = this.vaporwaveFilter;
      }
    } else if (this.effectsEnabled.get("nightcore")) {
      if (this.mediaElement) {
        this.mediaElement.playbackRate = 1.25;
      }
      if (this.nightcoreFilter) {
        currentNode.connect(this.nightcoreFilter);
        currentNode = this.nightcoreFilter;
      }
    } else if (this.effectsEnabled.get("cassette")) {
      const intensity = this.effectIntensities.get("cassette") || 0.4;
      if (this.mediaElement) {
        const rateVariation = intensity * 0.05;
        this.mediaElement.playbackRate = 1 + rateVariation * Math.sin(Date.now() * 0.001);
      }
    } else {
      if (this.mediaElement) {
        this.mediaElement.playbackRate = this.originalPlaybackRate;
      }
    }

    // KTV 伴奏 (人声消除) - 简化版本（仅使用滤波器）
    if (
      this.effectsEnabled.get("vocalRemove") &&
      this.vocalRemoveHP &&
      this.vocalRemoveLP &&
      this.vocalRemoveGain
    ) {
      const intensity = this.effectIntensities.get("vocalRemove") || 0.8;

      // 使用中置频率滤波来削弱人声（人声通常在 200Hz-4000Hz）
      this.vocalRemoveHP.frequency.value = 100 + intensity * 200;
      this.vocalRemoveLP.frequency.value = 5000 - intensity * 2000;
      this.vocalRemoveGain.gain.value = 0.5 + intensity * 0.5;

      currentNode.connect(this.vocalRemoveHP);
      this.vocalRemoveHP.connect(this.vocalRemoveLP);
      this.vocalRemoveLP.connect(this.vocalRemoveGain);
      currentNode = this.vocalRemoveGain;
    }

    // 水下潜听
    if (this.effectsEnabled.get("underwater") && this.underwaterFilter && this.underwaterDelay) {
      const intensity = this.effectIntensities.get("underwater") || 0.7;
      this.underwaterFilter.frequency.value = 400 + intensity * 400;
      this.underwaterDelay.delayTime.value = intensity * 0.05;

      currentNode.connect(this.underwaterFilter);
      this.underwaterFilter.connect(this.underwaterDelay);
      currentNode = this.underwaterDelay;
    }

    // 黑胶唱片
    if (
      this.effectsEnabled.get("vinyl") &&
      this.vinylBPF &&
      this.vinylDistortion &&
      this.vinylLPF
    ) {
      const intensity = this.effectIntensities.get("vinyl") || 0.6;
      this.vinylBPF.frequency.value = 800 + intensity * 2000;
      this.vinylBPF.Q.value = 0.5 + intensity * 1.5;

      currentNode.connect(this.vinylBPF);
      this.vinylBPF.connect(this.vinylDistortion);
      this.vinylDistortion.connect(this.vinylLPF);
      currentNode = this.vinylLPF;
    }

    // 对讲机
    if (
      this.effectsEnabled.get("talkie") &&
      this.talkieHPF &&
      this.talkieLPF &&
      this.talkieDistortion
    ) {
      const intensity = this.effectIntensities.get("talkie") || 0.6;
      this.talkieHPF.frequency.value = 800 + intensity * 800;
      this.talkieLPF.frequency.value = 3000 + intensity * 1000;

      currentNode.connect(this.talkieHPF);
      this.talkieHPF.connect(this.talkieDistortion);
      this.talkieDistortion.connect(this.talkieLPF);
      currentNode = this.talkieLPF;
    }

    // 赛博失真
    if (
      this.effectsEnabled.get("cyberpunkDistortion") &&
      this.cyberpunkDistortion &&
      this.cyberpunkFilter
    ) {
      const intensity = this.effectIntensities.get("cyberpunkDistortion") || 0.7;
      this.createDistortionCurve(this.cyberpunkDistortion, 50 + intensity * 200);
      this.cyberpunkFilter.gain.value = intensity * 15;

      currentNode.connect(this.cyberpunkDistortion);
      this.cyberpunkDistortion.connect(this.cyberpunkFilter);
      currentNode = this.cyberpunkFilter;
    }

    // 低保真电台
    if (
      this.effectsEnabled.get("loFiPhone") &&
      this.loFiPhoneHPF &&
      this.loFiPhoneLPF &&
      this.loFiPhoneDistortion &&
      this.loFiPhoneNoiseGain
    ) {
      const intensity = this.effectIntensities.get("loFiPhone") || 0.8;
      this.loFiPhoneHPF.frequency.value = 300 + intensity * 200; // 300-500
      this.loFiPhoneLPF.frequency.value = 3000 - intensity * 1000; // 3000-2000

      this.loFiPhoneNoiseGain.gain.value = intensity * 0.05; // Add background static
      this.loFiPhoneNoiseGain.connect(this.destinationNode); // Route static directly

      currentNode.connect(this.loFiPhoneHPF);
      this.loFiPhoneHPF.connect(this.loFiPhoneDistortion);
      this.loFiPhoneDistortion.connect(this.loFiPhoneLPF);
      currentNode = this.loFiPhoneLPF;
    }

    // 深海巨响
    if (this.effectsEnabled.get("megaBass") && this.megaBassFilter) {
      const intensity = this.effectIntensities.get("megaBass") || 0.5;
      this.megaBassFilter.gain.value = intensity * 12;

      currentNode.connect(this.megaBassFilter);
      currentNode = this.megaBassFilter;
    }

    // 颅内高潮
    if (this.effectsEnabled.get("asmr") && this.asmrFilter && this.asmrCompressor) {
      const intensity = this.effectIntensities.get("asmr") || 0.6;
      this.asmrFilter.gain.value = intensity * 8;

      currentNode.connect(this.asmrFilter);
      this.asmrFilter.connect(this.asmrCompressor);
      currentNode = this.asmrCompressor;
    }

    // 极化迷幻
    if (this.effectsEnabled.get("phaser") && this.phaserAllPassNodes.length > 0) {
      const intensity = this.effectIntensities.get("phaser") || 0.5;
      this.phaserGain!.gain.value = intensity * 500;

      for (const node of this.phaserAllPassNodes) {
        currentNode.connect(node);
        currentNode = node;
      }
    }

    // 8D 环绕音
    if (this.effectsEnabled.get("autoPan") && this.autoPanNode && this.autoPanGain) {
      const intensity = this.effectIntensities.get("autoPan") || 0.5;
      this.autoPanGain.gain.value = intensity;
      this.autoPanOscillator!.frequency.value = 0.1 + intensity * 0.1;

      currentNode.connect(this.autoPanNode);
      currentNode = this.autoPanNode;
    }

    // 多维拓宽 - 最简化版本（使用简单的左右声道延迟）
    if (
      this.effectsEnabled.get("stereoWidener") &&
      this.stereoWidenerSplitter &&
      this.stereoWidenerMerger &&
      this.stereoWidenerDelayLeft &&
      this.stereoWidenerDelayRight
    ) {
      const intensity = this.effectIntensities.get("stereoWidener") || 0.5;
      const delayTime = intensity * 0.015;

      currentNode.connect(this.stereoWidenerSplitter);

      this.stereoWidenerDelayLeft.delayTime.value = 0;
      this.stereoWidenerDelayRight.delayTime.value = delayTime;

      this.stereoWidenerSplitter.connect(this.stereoWidenerDelayLeft, 0);
      this.stereoWidenerSplitter.connect(this.stereoWidenerDelayRight, 1);

      this.stereoWidenerDelayLeft.connect(this.stereoWidenerMerger, 0, 0);
      this.stereoWidenerDelayRight.connect(this.stereoWidenerMerger, 0, 1);

      currentNode = this.stereoWidenerMerger;
    }

    // 演唱会现场 (混响)
    if (this.effectsEnabled.get("reverb") && this.reverbNode && this.wetGain && this.dryGain) {
      const intensity = this.effectIntensities.get("reverb") || 0.4;
      this.wetGain.gain.value = intensity;
      this.dryGain.gain.value = 1 - intensity * 0.3;

      const dryChain = currentNode;
      dryChain.connect(this.dryGain);
      this.dryGain.connect(this.destinationNode);

      currentNode.connect(this.reverbNode);
      this.reverbNode.connect(this.wetGain);
      this.wetGain.connect(this.destinationNode);
      return;
    }

    // 颤音冲浪
    if (this.effectsEnabled.get("tremolo") && this.tremoloGain) {
      const intensity = this.effectIntensities.get("tremolo") || 0.5;
      this.tremoloLFO!.frequency.value = 5 + intensity * 10;

      const gainNode = this.context!.createGain();
      gainNode.gain.value = 1 - intensity * 0.5;
      this.tremoloGain.connect(gainNode.gain);

      currentNode.connect(gainNode);
      currentNode = gainNode;
    }

    currentNode.connect(this.destinationNode);
  }

  setEffectEnabled(effect: AudioEffectType, enabled: boolean): void {
    this.effectsEnabled.set(effect, enabled);
    this.rebuildAudioChain();
  }

  setEffectIntensity(effect: AudioEffectType, intensity: number): void {
    this.effectIntensities.set(effect, intensity);
    this.rebuildAudioChain();
  }

  reset(): void {
    this.effectsEnabled.forEach((_, effect) => {
      this.effectsEnabled.set(effect, false);
    });

    const effectTypes: AudioEffectType[] = [
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

    effectTypes.forEach((type) => {
      this.effectIntensities.set(type, 0.5);
    });

    this.effectIntensities.set("reverb", 0.4);
    this.effectIntensities.set("stereoWidener", 0.5);
    this.effectIntensities.set("nightcore", 1.0);
    this.effectIntensities.set("vaporwave", 0.8);
    this.effectIntensities.set("cassette", 0.4);
    this.effectIntensities.set("tremolo", 0.5);
    this.effectIntensities.set("underwater", 0.7);
    this.effectIntensities.set("vinyl", 0.6);
    this.effectIntensities.set("bitcrusher", 0.5);
    this.effectIntensities.set("talkie", 0.6);
    this.effectIntensities.set("megaBass", 0.5);
    this.effectIntensities.set("asmr", 0.6);
    this.effectIntensities.set("phaser", 0.5);
    this.effectIntensities.set("vocalRemove", 0.8);
    this.effectIntensities.set("cyberpunkDistortion", 0.7);
    this.effectIntensities.set("loFiPhone", 0.8);

    this.rebuildAudioChain();
  }
}

let effectsManagerInstance: AudioEffectsManager | null = null;

export function getAudioEffectsManager(): AudioEffectsManager {
  if (!effectsManagerInstance) {
    effectsManagerInstance = new AudioEffectsManager();
  }
  return effectsManagerInstance;
}
