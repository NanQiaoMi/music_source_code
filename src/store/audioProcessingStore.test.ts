import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAudioProcessingStore } from './audioProcessingStore';

describe('audioProcessingStore', () => {
  beforeEach(() => {
    useAudioProcessingStore.setState({
      isProcessing: false,
      processingProgress: 0,
      currentTask: '',
      ffmpegLoaded: false,
      ffmpegLoading: false,
      conversionQueue: [],
      conversionHistory: [],
      waveformCache: new Map(),
      waveformGenerationQueue: [],
      spectrumData: null,
      spectrumEnabled: false,
      dspEnabled: true,
      dspProcessors: [],
      masterGain: 1.0,
      masterCompressorEnabled: false,
      audioContext: null,
      masterNode: null,
      compressorNode: null,
    });
  });

  it('初始状态 FFmpeg 未加载', () => {
    const state = useAudioProcessingStore.getState();
    expect(state.ffmpegLoaded).toBe(false);
    expect(state.ffmpegLoading).toBe(false);
  });

  it('添加转换任务', () => {
    const job = {
      id: 'job-1',
      inputPath: '/test.mp3',
      outputPath: '/test.wav',
      inputFormat: 'mp3',
      outputFormat: 'wav',
      config: {},
      status: 'pending' as const,
      progress: 0,
      createdAt: Date.now(),
    };
    useAudioProcessingStore.getState().addConversionJob(job);
    expect(useAudioProcessingStore.getState().conversionQueue).toHaveLength(1);
  });

  it('移除转换任务', () => {
    const job = {
      id: 'job-1', inputPath: '/test.mp3', outputPath: '/test.wav',
      inputFormat: 'mp3', outputFormat: 'wav', config: {},
      status: 'pending' as const, progress: 0, createdAt: Date.now(),
    };
    useAudioProcessingStore.getState().addConversionJob(job);
    useAudioProcessingStore.getState().removeConversionJob('job-1');
    expect(useAudioProcessingStore.getState().conversionQueue).toHaveLength(0);
  });

  it('DSP 处理器操作', () => {
    useAudioProcessingStore.getState().addDSPProcessor({
      id: 'dsp-1', type: 'eq', enabled: true, params: {},
    });
    expect(useAudioProcessingStore.getState().dspProcessors).toHaveLength(1);
    useAudioProcessingStore.getState().toggleDSP();
    expect(useAudioProcessingStore.getState().dspEnabled).toBe(false);
  });

  it('resetProcessing 重置处理状态', () => {
    useAudioProcessingStore.getState().addConversionJob({
      id: 'job-1', inputPath: '/test.mp3', outputPath: '/test.wav',
      inputFormat: 'mp3', outputFormat: 'wav', config: {},
      status: 'pending' as const, progress: 50, createdAt: Date.now(),
    });
    useAudioProcessingStore.getState().resetProcessing();
    expect(useAudioProcessingStore.getState().isProcessing).toBe(false);
    expect(useAudioProcessingStore.getState().conversionQueue).toHaveLength(0);
  });
});