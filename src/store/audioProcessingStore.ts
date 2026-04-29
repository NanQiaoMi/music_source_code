import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "./playlistStore";

export type DSPMode = "bypass" | "eq" | "compressor" | "limiter" | "reverb";

export interface DSPProcessor {
  id: string;
  type: DSPMode;
  enabled: boolean;
  params: Record<string, number | boolean | string>;
}

export interface AudioProcessingState {
  isProcessing: boolean;
  processingProgress: number;
  currentTask: string;

  ffmpegLoaded: boolean;
  ffmpegLoading: boolean;

  dspEnabled: boolean;
  dspProcessors: DSPProcessor[];

  masterGain: number;
  masterCompressorEnabled: boolean;

  conversionQueue: ConversionJob[];
  conversionHistory: ConversionJob[];

  waveformCache: Map<string, WaveformData>;
  waveformGenerationQueue: string[];

  spectrumData: SpectrumData | null;
  spectrumEnabled: boolean;

  audioContext: AudioContext | null;
  masterNode: GainNode | null;
  compressorNode: DynamicsCompressorNode | null;

  initAudioContext: () => void;
  setMasterGain: (gain: number) => void;
  toggleMasterCompressor: () => void;

  loadFFmpeg: () => Promise<void>;

  addConversionJob: (job: ConversionJob) => void;
  removeConversionJob: (jobId: string) => void;
  updateConversionProgress: (jobId: string, progress: number) => void;
  completeConversionJob: (jobId: string, result: ConversionResult) => void;

  generateWaveform: (songId: string) => Promise<void>;
  getWaveform: (songId: string) => WaveformData | undefined;

  updateSpectrum: (data: SpectrumData) => void;
  toggleSpectrum: () => void;

  addDSPProcessor: (processor: DSPProcessor) => void;
  removeDSPProcessor: (processorId: string) => void;
  updateDSPProcessor: (
    processorId: string,
    params: Record<string, number | boolean | string>
  ) => void;
  toggleDSP: () => void;

  resetProcessing: () => void;
}

export interface ConversionJob {
  id: string;
  inputPath: string;
  outputPath: string;
  inputFormat: string;
  outputFormat: string;
  config: ConversionConfig;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  result?: ConversionResult;
  createdAt: number;
}

export interface ConversionConfig {
  sampleRate?: number;
  bitDepth?: number;
  bitrate?: number;
  channels?: number;
  preserveMetadata?: boolean;
  preserveAlbumArt?: boolean;
  normalize?: boolean;
}

export interface ConversionResult {
  outputPath: string;
  duration: number;
  fileSize: number;
  metadataPreserved: boolean;
  albumArtPreserved: boolean;
}

export interface WaveformData {
  songId: string;
  channels: Float32Array[];
  peaks: { min: number; max: number }[];
  duration: number;
  sampleRate: number;
  generatedAt: number;
}

export interface SpectrumData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  peak: number;
  rms: number;
  timestamp: number;
}

let globalAudioContext: AudioContext | null = null;
let globalMasterNode: GainNode | null = null;
let globalCompressorNode: DynamicsCompressorNode | null = null;

export const useAudioProcessingStore = create<AudioProcessingState>()(
  persist(
    (set, get) => ({
      isProcessing: false,
      processingProgress: 0,
      currentTask: "",

      ffmpegLoaded: false,
      ffmpegLoading: false,

      dspEnabled: true,
      dspProcessors: [],

      masterGain: 1.0,
      masterCompressorEnabled: false,

      conversionQueue: [],
      conversionHistory: [],

      waveformCache: new Map(),
      waveformGenerationQueue: [],

      spectrumData: null,
      spectrumEnabled: false,

      audioContext: null,
      masterNode: null,
      compressorNode: null,

      initAudioContext: () => {
        if (typeof window === "undefined") return;

        if (!globalAudioContext) {
          globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        if (!globalMasterNode && globalAudioContext) {
          globalMasterNode = globalAudioContext.createGain();
          globalMasterNode.connect(globalAudioContext.destination);
        }

        if (!globalCompressorNode && globalAudioContext) {
          globalCompressorNode = globalAudioContext.createDynamicsCompressor();
          globalCompressorNode.connect(globalMasterNode!);
        }

        set({
          audioContext: globalAudioContext,
          masterNode: globalMasterNode,
          compressorNode: globalCompressorNode,
        });
      },

      setMasterGain: (gain) => {
        if (globalMasterNode) {
          globalMasterNode.gain.value = Math.max(0, Math.min(2, gain));
          set({ masterGain: gain });
        }
      },

      toggleMasterCompressor: () => {
        const state = get();
        if (globalCompressorNode && globalMasterNode) {
          if (!state.masterCompressorEnabled) {
            globalMasterNode.disconnect();
            globalMasterNode.connect(globalCompressorNode);
            globalCompressorNode.connect(globalAudioContext!.destination);
          } else {
            globalCompressorNode.disconnect();
            globalMasterNode.connect(globalAudioContext!.destination);
          }
          set({ masterCompressorEnabled: !state.masterCompressorEnabled });
        }
      },

      loadFFmpeg: async () => {
        set({ ffmpegLoading: true });
        try {
          // FFmpeg.wasm will be loaded dynamically when needed
          // This is a placeholder for the actual implementation
          console.log("FFmpeg.wasm loading...");
          set({ ffmpegLoaded: true, ffmpegLoading: false });
        } catch (error) {
          console.error("Failed to load FFmpeg:", error);
          set({ ffmpegLoading: false });
        }
      },

      addConversionJob: (job) => {
        set((state) => ({
          conversionQueue: [...state.conversionQueue, job],
        }));
      },

      removeConversionJob: (jobId) => {
        set((state) => ({
          conversionQueue: state.conversionQueue.filter((j) => j.id !== jobId),
        }));
      },

      updateConversionProgress: (jobId, progress) => {
        set((state) => ({
          conversionQueue: state.conversionQueue.map((job) =>
            job.id === jobId ? { ...job, progress } : job
          ),
        }));
      },

      completeConversionJob: (jobId, result) => {
        set((state) => {
          const job = state.conversionQueue.find((j) => j.id === jobId);
          if (!job) return state;

          const completedJob: ConversionJob = {
            ...job,
            status: "completed",
            result,
          };

          return {
            conversionQueue: state.conversionQueue.filter((j) => j.id !== jobId),
            conversionHistory: [completedJob, ...state.conversionHistory].slice(0, 100),
          };
        });
      },

      generateWaveform: async (songId) => {
        const state = get();
        if (state.waveformCache.has(songId)) return;

        set({
          waveformGenerationQueue: [...state.waveformGenerationQueue, songId],
          isProcessing: true,
          currentTask: "Generating waveform",
        });
      },

      getWaveform: (songId) => {
        return get().waveformCache.get(songId);
      },

      updateSpectrum: (data) => {
        set({ spectrumData: data });
      },

      toggleSpectrum: () => {
        set((state) => ({ spectrumEnabled: !state.spectrumEnabled }));
      },

      addDSPProcessor: (processor) => {
        set((state) => ({
          dspProcessors: [...state.dspProcessors, processor],
        }));
      },

      removeDSPProcessor: (processorId) => {
        set((state) => ({
          dspProcessors: state.dspProcessors.filter((p) => p.id !== processorId),
        }));
      },

      updateDSPProcessor: (processorId, params) => {
        set((state) => ({
          dspProcessors: state.dspProcessors.map((p) =>
            p.id === processorId ? { ...p, params: { ...p.params, ...params } } : p
          ),
        }));
      },

      toggleDSP: () => {
        set((state) => ({ dspEnabled: !state.dspEnabled }));
      },

      resetProcessing: () => {
        set({
          isProcessing: false,
          processingProgress: 0,
          currentTask: "",
          conversionQueue: [],
        });
      },
    }),
    {
      name: "audio-processing-store-v5",
      partialize: (state) => ({
        dspEnabled: state.dspEnabled,
        dspProcessors: state.dspProcessors,
        masterGain: state.masterGain,
        masterCompressorEnabled: state.masterCompressorEnabled,
        conversionHistory: state.conversionHistory,
      }),
    }
  )
);
