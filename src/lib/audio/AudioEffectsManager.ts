import type { AudioEffectType } from "@/store/audioEffectsStore";
import { getAudioContext } from "@/hooks/useAudioPlayer";
import { usePlayerStore } from "@/store/playerStore";
import { AudioEngine } from "./AudioEngine";

// S2-2: AudioParam 平滑时间常数（秒），拖动时避免爆音/拉链噪声。
const PARAM_SMOOTHING_SECONDS = 0.02;

export class AudioEffectsManager {
  private context: AudioContext | null = null;
  private sourceNode: AudioNode | null = null;
  private destinationNode: AudioNode | null = null;
  // S2-1: 效果链唯一汇点。所有子路径先汇入这里，再由这里单边连到 destination。
  private chainOutput: GainNode | null = null;

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
  // S2-2: 深度增益在 init 时创建一次，强度拖动只改参数，避免每次重建新建节点。
  private tremoloDepthGain: GainNode | null = null;

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
  // S2-2: 已接线效果的参数 applier。命中时只改 AudioParam（setTargetAtTime），不重建链路。
  private intensityAppliers = new Map<AudioEffectType, (value: number) => void>();
  // S2-2 调试计数（E3 验收/测试断言）：拖动期间 connect 与 rebuild 增量都必须为 0。
  private graphConnectCount = 0;
  private graphRebuildCount = 0;
  // cyberpunkDistortion 的 WaveShaper.curve 是结构型参数，只在提交时按强度重算一次。
  private cyberpunkCurveIntensity: number | null = null;

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

    // S2-1: 效果链唯一输出汇点，保证 destination 只有一条入边（混响的干/湿两路在此合流）。
    this.chainOutput = this.context.createGain();
    this.chainOutput.gain.value = 1;

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
    // S2-2: 深度增益跟随 LFO 的调制深度，常驻节点由 applier 更新。
    this.tremoloDepthGain = this.context.createGain();
    this.tremoloDepthGain.gain.value = 0.75;
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

    // S2-1: 重连前先摘掉自己拥有的旧输出，避免 destination 出现重复入边。
    this.disconnectOwnedOutput();

    this.sourceNode = source;
    this.destinationNode = destination;

    if (mediaElement) {
      this.mediaElement = mediaElement;
      this.originalPlaybackRate = mediaElement.playbackRate;
    }

    AudioEngine.getInstance().setOutputOwnedByEffects(true);
    this.rebuildAudioChain();
  }

  /**
   * S2-1: 效果链退场，恢复 AudioEngine 的 analyser -> destination 兜底直连。
   */
  detach(): void {
    this.disconnectOwnedOutput();
    this.sourceNode = null;
    this.destinationNode = null;
    this.mediaElement = null;

    const engine = AudioEngine.getInstance();
    engine.setOutputOwnedByEffects(false);
    engine.connectFallbackOutput();
  }

  private disconnectOwnedOutput(): void {
    try {
      this.sourceNode?.disconnect();
    } catch {
      // 节点可能已断开。
    }
    try {
      this.chainOutput?.disconnect();
    } catch {
      // 节点可能已断开。
    }
  }

  private rebuildAudioChain(): void {
    if (!this.context || !this.sourceNode || !this.destinationNode || !this.chainOutput) return;

    // S2-2: 重建/connect 次数是 E3（拖动不重建）的验收指标。
    this.graphRebuildCount += 1;
    this.intensityAppliers.clear();

    try {
      // S2-1: 输入边和汇点输出边也必须先摘掉，否则每次重建都会叠加平行边。
      this.sourceNode.disconnect();
      this.chainOutput.disconnect();

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
      this.tremoloDepthGain?.disconnect();

      this.cyberpunkDistortion?.disconnect();
      this.cyberpunkFilter?.disconnect();

      this.loFiPhoneHPF?.disconnect();
      this.loFiPhoneLPF?.disconnect();
      this.loFiPhoneDistortion?.disconnect();
      this.loFiPhoneNoiseGain?.disconnect();
    } catch {
      // Nodes may already be disconnected; rebuild the chain below.
    }

    const hasAnyEffect = Array.from(this.effectsEnabled.values()).some((v) => v);
    // S2-2: 先注册 applier 再接线，reverb 分支提前 return 也不会漏注册。
    this.registerIntensityAppliers(hasAnyEffect);

    if (!hasAnyEffect) {
      if (this.mediaElement) {
        const targetRate = usePlayerStore.getState().playbackRate || 1.0;
        this.mediaElement.playbackRate = targetRate;
      }
      this.link(this.sourceNode, this.destinationNode);
      return;
    }

    let currentNode: AudioNode = this.sourceNode;

    // 处理播放速度相关效果（互斥）
    if (this.effectsEnabled.get("vaporwave")) {
      if (this.mediaElement) {
        this.mediaElement.playbackRate = 0.8;
      }
      if (this.vaporwaveFilter) {
        this.link(currentNode, this.vaporwaveFilter);
        currentNode = this.vaporwaveFilter;
      }
    } else if (this.effectsEnabled.get("nightcore")) {
      if (this.mediaElement) {
        this.mediaElement.playbackRate = 1.25;
      }
      if (this.nightcoreFilter) {
        this.link(currentNode, this.nightcoreFilter);
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
        const targetRate = usePlayerStore.getState().playbackRate || 1.0;
        this.mediaElement.playbackRate = targetRate;
      }
    }

    // KTV 伴奏 (人声消除) - 简化版本（仅使用滤波器）
    if (
      this.effectsEnabled.get("vocalRemove") &&
      this.vocalRemoveHP &&
      this.vocalRemoveLP &&
      this.vocalRemoveGain
    ) {
      this.link(currentNode, this.vocalRemoveHP);
      this.link(this.vocalRemoveHP, this.vocalRemoveLP);
      this.link(this.vocalRemoveLP, this.vocalRemoveGain);
      currentNode = this.vocalRemoveGain;
    }

    // 水下潜听
    if (this.effectsEnabled.get("underwater") && this.underwaterFilter && this.underwaterDelay) {
      this.link(currentNode, this.underwaterFilter);
      this.link(this.underwaterFilter, this.underwaterDelay);
      currentNode = this.underwaterDelay;
    }

    // 黑胶唱片
    if (
      this.effectsEnabled.get("vinyl") &&
      this.vinylBPF &&
      this.vinylDistortion &&
      this.vinylLPF
    ) {
      this.link(currentNode, this.vinylBPF);
      this.link(this.vinylBPF, this.vinylDistortion);
      this.link(this.vinylDistortion, this.vinylLPF);
      currentNode = this.vinylLPF;
    }

    // 对讲机
    if (
      this.effectsEnabled.get("talkie") &&
      this.talkieHPF &&
      this.talkieLPF &&
      this.talkieDistortion
    ) {
      this.link(currentNode, this.talkieHPF);
      this.link(this.talkieHPF, this.talkieDistortion);
      this.link(this.talkieDistortion, this.talkieLPF);
      currentNode = this.talkieLPF;
    }

    // 赛博失真
    if (
      this.effectsEnabled.get("cyberpunkDistortion") &&
      this.cyberpunkDistortion &&
      this.cyberpunkFilter
    ) {
      const intensity = this.effectIntensities.get("cyberpunkDistortion") || 0.7;
      this.cyberpunkCurveIntensity = intensity;
      this.createDistortionCurve(this.cyberpunkDistortion, 50 + intensity * 200);

      this.link(currentNode, this.cyberpunkDistortion);
      this.link(this.cyberpunkDistortion, this.cyberpunkFilter);
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
      this.link(this.loFiPhoneNoiseGain, this.chainOutput); // Route static into the single sink

      this.link(currentNode, this.loFiPhoneHPF);
      this.link(this.loFiPhoneHPF, this.loFiPhoneDistortion);
      this.link(this.loFiPhoneDistortion, this.loFiPhoneLPF);
      currentNode = this.loFiPhoneLPF;
    }

    // 深海巨响
    if (this.effectsEnabled.get("megaBass") && this.megaBassFilter) {
      this.link(currentNode, this.megaBassFilter);
      currentNode = this.megaBassFilter;
    }

    // 颅内高潮
    if (this.effectsEnabled.get("asmr") && this.asmrFilter && this.asmrCompressor) {
      this.link(currentNode, this.asmrFilter);
      this.link(this.asmrFilter, this.asmrCompressor);
      currentNode = this.asmrCompressor;
    }

    // 极化迷幻
    if (this.effectsEnabled.get("phaser") && this.phaserAllPassNodes.length > 0) {
      for (const node of this.phaserAllPassNodes) {
        this.link(currentNode, node);
        currentNode = node;
      }
    }

    // 8D 环绕音
    if (this.effectsEnabled.get("autoPan") && this.autoPanNode && this.autoPanGain) {
      this.link(currentNode, this.autoPanNode);
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
      this.link(currentNode, this.stereoWidenerSplitter);

      this.link(this.stereoWidenerSplitter, this.stereoWidenerDelayLeft, 0);
      this.link(this.stereoWidenerSplitter, this.stereoWidenerDelayRight, 1);

      this.link(this.stereoWidenerDelayLeft, this.stereoWidenerMerger, 0, 0);
      this.link(this.stereoWidenerDelayRight, this.stereoWidenerMerger, 0, 1);

      currentNode = this.stereoWidenerMerger;
    }

    // 演唱会现场 (混响)
    if (this.effectsEnabled.get("reverb") && this.reverbNode && this.wetGain && this.dryGain) {
      const dryChain = currentNode;
      this.link(dryChain, this.dryGain);
      this.link(this.dryGain, this.chainOutput);

      this.link(currentNode, this.reverbNode);
      this.link(this.reverbNode, this.wetGain);
      this.link(this.wetGain, this.chainOutput);
      this.link(this.chainOutput, this.destinationNode);
      return;
    }

    // 颤音冲浪
    if (this.effectsEnabled.get("tremolo") && this.tremoloGain && this.tremoloDepthGain) {
      this.tremoloGain.connect(this.tremoloDepthGain.gain);
      this.graphConnectCount += 1;
      this.link(currentNode, this.tremoloDepthGain);
      currentNode = this.tremoloDepthGain;
    }

    this.link(currentNode, this.chainOutput);
    this.link(this.chainOutput, this.destinationNode);
  }

  /**
   * S2-2: 为已启用的效果注册参数 applier。命中 applier 时 setEffectIntensity 只改 AudioParam。
   * 速度/结构型效果（bitcrusher/nightcore/vaporwave/cassette）没有连续 AudioParam，
   * 注册空 applier 以保证拖动期间同样不重建链路，强度在下次重建（开关/切歌）时读取。
   */
  private registerIntensityAppliers(hasAnyEffect: boolean): void {
    if (!hasAnyEffect) return;

    const register = (effect: AudioEffectType, applier: (value: number) => void): void => {
      if (!this.effectsEnabled.get(effect)) return;
      this.intensityAppliers.set(effect, applier);
      applier(this.effectIntensities.get(effect) ?? 0.5);
    };

    register("reverb", (value) => {
      this.setParam(this.wetGain?.gain, value);
      this.setParam(this.dryGain?.gain, 1 - value * 0.3);
    });

    register("stereoWidener", (value) => {
      this.setParam(this.stereoWidenerDelayLeft?.delayTime, 0);
      this.setParam(this.stereoWidenerDelayRight?.delayTime, value * 0.015);
    });

    register("tremolo", (value) => {
      this.setParam(this.tremoloLFO?.frequency, 5 + value * 10);
      this.setParam(this.tremoloDepthGain?.gain, 1 - value * 0.5);
    });

    register("underwater", (value) => {
      this.setParam(this.underwaterFilter?.frequency, 400 + value * 400);
      this.setParam(this.underwaterDelay?.delayTime, value * 0.05);
    });

    register("vinyl", (value) => {
      this.setParam(this.vinylBPF?.frequency, 800 + value * 2000);
      this.setParam(this.vinylBPF?.Q, 0.5 + value * 1.5);
    });

    register("talkie", (value) => {
      this.setParam(this.talkieHPF?.frequency, 800 + value * 800);
      this.setParam(this.talkieLPF?.frequency, 3000 + value * 1000);
    });

    register("cyberpunkDistortion", (value) => {
      // 拖动只改补偿增益；WaveShaper.curve 由 commitEffectIntensity() 在提交时重算。
      this.setParam(this.cyberpunkFilter?.gain, value * 15);
    });

    register("loFiPhone", (value) => {
      this.setParam(this.loFiPhoneHPF?.frequency, 300 + value * 200);
      this.setParam(this.loFiPhoneLPF?.frequency, 3000 - value * 1000);
      this.setParam(this.loFiPhoneNoiseGain?.gain, value * 0.05);
    });

    register("megaBass", (value) => {
      this.setParam(this.megaBassFilter?.gain, value * 12);
    });

    register("asmr", (value) => {
      this.setParam(this.asmrFilter?.gain, value * 8);
    });

    register("phaser", (value) => {
      this.setParam(this.phaserGain?.gain, value * 500);
    });

    register("autoPan", (value) => {
      this.setParam(this.autoPanGain?.gain, value);
      this.setParam(this.autoPanOscillator?.frequency, 0.1 + value * 0.1);
    });

    register("vocalRemove", (value) => {
      this.setParam(this.vocalRemoveHP?.frequency, 100 + value * 200);
      this.setParam(this.vocalRemoveLP?.frequency, 5000 - value * 2000);
      this.setParam(this.vocalRemoveGain?.gain, 0.5 + value * 0.5);
    });

    register("bitcrusher", () => {});
    register("nightcore", () => {});
    register("vaporwave", () => {});
    register("cassette", () => {});
  }

  private setParam(param: AudioParam | null | undefined, value: number): void {
    if (!param || !this.context) return;
    param.setTargetAtTime(value, this.context.currentTime, PARAM_SMOOTHING_SECONDS);
  }

  /** S2-2: 唯一的声音连接出口，同时累计 connect 次数（E3 探针）。 */
  private link(
    from: AudioNode | null,
    to: AudioNode | null,
    output?: number,
    input?: number
  ): void {
    if (!from || !to) return;
    if (input !== undefined) {
      from.connect(to, output ?? 0, input);
    } else if (output !== undefined) {
      from.connect(to, output);
    } else {
      from.connect(to);
    }
    this.graphConnectCount += 1;
  }

  getGraphRebuildCount(): number {
    return this.graphRebuildCount;
  }

  getGraphConnectCount(): number {
    return this.graphConnectCount;
  }

  /** 测试/性能探针：清空累计的图变更计数。 */
  resetGraphStats(): void {
    this.graphRebuildCount = 0;
    this.graphConnectCount = 0;
  }

  /**
   * S2-2: 结构型参数（WaveShaper.curve）在拖动结束/程序化设定后提交一次，
   * 只重算已有节点的曲线，不重建链路。
   */
  commitEffectIntensity(effect: AudioEffectType): void {
    if (effect !== "cyberpunkDistortion" || !this.effectsEnabled.get(effect)) return;
    const intensity = this.effectIntensities.get(effect) ?? 0.7;
    if (
      this.cyberpunkCurveIntensity !== null &&
      Math.abs(intensity - this.cyberpunkCurveIntensity) <= 0.02
    ) {
      return;
    }
    if (!this.cyberpunkDistortion) return;
    this.cyberpunkCurveIntensity = intensity;
    this.createDistortionCurve(this.cyberpunkDistortion, 50 + intensity * 200);
  }

  setEffectEnabled(effect: AudioEffectType, enabled: boolean): void {
    this.effectsEnabled.set(effect, enabled);
    this.rebuildAudioChain();
  }

  setEffectIntensity(effect: AudioEffectType, intensity: number): void {
    this.effectIntensities.set(effect, intensity);

    // S2-2: 已接线效果只更新已有节点的 AudioParam（setTargetAtTime），不重建链路。
    const applier = this.intensityAppliers.get(effect);
    if (applier) {
      applier(intensity);
      return;
    }

    // 未启用效果不参与当前链路，强度只需存起来，启用时由重建读取。
    if (!this.effectsEnabled.get(effect)) return;

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
