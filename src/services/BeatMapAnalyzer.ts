/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

export interface BeatMapPoint {
  time: number;
  energy: number;
  isDownbeat: boolean;
  impact: number;
  low: number;
  snap: number;
}

export interface BeatMapData {
  key: string;
  bpm: number;
  gridStep: number;
  duration: number;
  beats: BeatMapPoint[];
  downbeats: number[];
  kicks: number[];
  analyzedAt: number;
}

interface BiquadFilterState {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

function makeBiquad(type: "lowpass" | "highpass", freq: number, q: number, sr: number): BiquadFilterState {
  freq = Math.max(8, Math.min(freq, sr * 0.45));
  const w0 = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * (q || 0.707));

  let b0: number, b1: number, b2: number;
  if (type === "highpass") {
    b0 = (1 + cos) * 0.5;
    b1 = -(1 + cos);
    b2 = (1 + cos) * 0.5;
  } else {
    b0 = (1 - cos) * 0.5;
    b1 = 1 - cos;
    b2 = (1 - cos) * 0.5;
  }

  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  const inv = 1 / a0;

  return {
    b0: b0 * inv,
    b1: b1 * inv,
    b2: b2 * inv,
    a1: a1 * inv,
    a2: a2 * inv,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  };
}

function runBiquad(st: BiquadFilterState, x: number): number {
  const y = st.b0 * x + st.b1 * st.x1 + st.b2 * st.x2 - st.a1 * st.y1 - st.a2 * st.y2;
  st.x2 = st.x1;
  st.x1 = x;
  st.y2 = st.y1;
  st.y1 = y;
  return y;
}

export class BeatMapAnalyzer {
  private static instance: BeatMapAnalyzer;
  private memoryCache = new Map<string, BeatMapData>();

  public static getInstance(): BeatMapAnalyzer {
    if (!BeatMapAnalyzer.instance) {
      BeatMapAnalyzer.instance = new BeatMapAnalyzer();
    }
    return BeatMapAnalyzer.instance;
  }

  /**
   * 从音频 URL 异步分析整首歌曲的节拍网格 (带内存与本地持久化缓存)
   */
  public async analyzeAudioUrl(audioUrl: string, songKey: string): Promise<BeatMapData> {
    // 1. 检查内存缓存
    if (this.memoryCache.has(songKey)) {
      return this.memoryCache.get(songKey)!;
    }

    // 2. 尝试从本地 IndexedDB / LocalStorage 恢复缓存
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(`beatmap_${songKey}`);
        if (stored) {
          const parsed = JSON.parse(stored) as BeatMapData;
          this.memoryCache.set(songKey, parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn("[BeatMapAnalyzer] Cache read failed:", e);
    }

    // 3. 抓取音频二进制数据并解码
    console.log(`[BeatMapAnalyzer] Decoding & analyzing audio DSP for: ${songKey}`);
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // 4. 双二阶滤波器频段隔离与瞬态提取
    const lowFilter = makeBiquad("lowpass", 140, 0.8, sampleRate);
    const highFilter = makeBiquad("highpass", 2400, 0.7, sampleRate);

    const hopSize = 512;
    const numFrames = Math.floor(channelData.length / hopSize);
    const beats: BeatMapPoint[] = [];
    const kicks: number[] = [];
    const downbeats: number[] = [];

    let prevLow = 0;
    for (let frame = 0; frame < numFrames; frame++) {
      let lowEnergySum = 0;
      let snapEnergySum = 0;

      for (let i = 0; i < hopSize; i++) {
        const sample = channelData[frame * hopSize + i];
        const lowSample = runBiquad(lowFilter, sample);
        const highSample = runBiquad(highFilter, sample);

        lowEnergySum += lowSample * lowSample;
        snapEnergySum += highSample * highSample;
      }

      const lowEnergy = Math.sqrt(lowEnergySum / hopSize);
      const snapEnergy = Math.sqrt(snapEnergySum / hopSize);
      const frameTime = (frame * hopSize) / sampleRate;

      // 瞬态低音跃升检测
      const lowRise = Math.max(0, lowEnergy - prevLow);
      prevLow = lowEnergy;

      if (lowRise > 0.08 && lowEnergy > 0.15) {
        const isDown = frame % 4 === 0;
        beats.push({
          time: Number(frameTime.toFixed(3)),
          energy: Number(lowEnergy.toFixed(3)),
          isDownbeat: isDown,
          impact: Number((lowRise * 4.0).toFixed(3)),
          low: Number(lowEnergy.toFixed(3)),
          snap: Number(snapEnergy.toFixed(3)),
        });

        kicks.push(Number(frameTime.toFixed(3)));
        if (isDown) {
          downbeats.push(Number(frameTime.toFixed(3)));
        }
      }
    }

    // 5. 估算整体 BPM
    let bpm = 120;
    if (kicks.length > 8) {
      const intervals: number[] = [];
      for (let i = 1; i < kicks.length; i++) {
        const diff = kicks[i] - kicks[i - 1];
        if (diff > 0.3 && diff < 1.4) {
          intervals.push(diff);
        }
      }
      if (intervals.length > 0) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        bpm = Math.round(60 / avgInterval);
      }
    }

    const gridStep = Number((60 / bpm).toFixed(3));

    const beatMapData: BeatMapData = {
      key: songKey,
      bpm,
      gridStep,
      duration: Number(duration.toFixed(2)),
      beats,
      downbeats,
      kicks,
      analyzedAt: Date.now(),
    };

    // 写入内存与本地持久化缓存
    this.memoryCache.set(songKey, beatMapData);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(`beatmap_${songKey}`, JSON.stringify(beatMapData));
      }
    } catch {
      // 忽略 localStorage 容量限制
    }

    return beatMapData;
  }
}

export const beatMapAnalyzer = BeatMapAnalyzer.getInstance();
