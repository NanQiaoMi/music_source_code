import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AudioFingerprint {
  songId: string;
  fingerprint: number[];
  duration: number;
  sampleRate: number;
  channels: number;
  createdAt: number;
}

export interface FingerprintMatch {
  songId: string;
  confidence: number;
  offset: number;
}

export interface FingerprintState {
  fingerprints: Map<string, AudioFingerprint>;
  isScanning: boolean;
  scanProgress: number;
  scannedCount: number;
  totalCount: number;

  autoGenerate: boolean;
  matchThreshold: number;

  setFingerprint: (songId: string, fingerprint: AudioFingerprint) => void;
  getFingerprint: (songId: string) => AudioFingerprint | undefined;
  hasFingerprint: (songId: string) => boolean;

  matchFingerprint: (fingerprint: number[]) => FingerprintMatch[];

  setScanning: (scanning: boolean) => void;
  setScanProgress: (progress: number) => void;
  setScannedCount: (count: number) => void;
  setTotalCount: (count: number) => void;

  setAutoGenerate: (auto: boolean) => void;
  setMatchThreshold: (threshold: number) => void;

  clearFingerprints: () => void;
  removeFingerprint: (songId: string) => void;
}

export const useFingerprintStore = create<FingerprintState>()(
  persist(
    (set, get) => ({
      fingerprints: new Map(),
      isScanning: false,
      scanProgress: 0,
      scannedCount: 0,
      totalCount: 0,

      autoGenerate: true,
      matchThreshold: 0.85,

      setFingerprint: (songId: string, fingerprint: AudioFingerprint) => {
        set((state: FingerprintState) => {
          const newMap = new Map(state.fingerprints);
          newMap.set(songId, fingerprint);
          return { fingerprints: newMap };
        });
      },

      getFingerprint: (songId: string) => {
        return get().fingerprints.get(songId);
      },

      hasFingerprint: (songId: string) => {
        return get().fingerprints.has(songId);
      },

      matchFingerprint: (fingerprint: number[]) => {
        const state = get();
        const matches: FingerprintMatch[] = [];

        state.fingerprints.forEach((fp: AudioFingerprint, songId: string) => {
          const confidence = calculateFingerprintSimilarity(fingerprint, fp.fingerprint);
          if (confidence >= state.matchThreshold) {
            matches.push({
              songId,
              confidence,
              offset: 0,
            });
          }
        });

        return matches.sort((a, b) => b.confidence - a.confidence);
      },

      setScanning: (scanning: boolean) => {
        set({ isScanning: scanning });
      },

      setScanProgress: (progress: number) => {
        set({ scanProgress: Math.min(100, Math.max(0, progress)) });
      },

      setScannedCount: (count: number) => {
        set({ scannedCount: count });
      },

      setTotalCount: (count: number) => {
        set({ totalCount: count });
      },

      setAutoGenerate: (auto: boolean) => {
        set({ autoGenerate: auto });
      },

      setMatchThreshold: (threshold: number) => {
        set({ matchThreshold: Math.min(1, Math.max(0, threshold)) });
      },

      clearFingerprints: () => {
        set({ fingerprints: new Map() });
      },

      removeFingerprint: (songId: string) => {
        set((state: FingerprintState) => {
          const newMap = new Map(state.fingerprints);
          newMap.delete(songId);
          return { fingerprints: newMap };
        });
      },
    }),
    {
      name: "fingerprint-store-v5",
      partialize: (state) => ({
        fingerprints: Object.fromEntries(state.fingerprints),
        autoGenerate: state.autoGenerate,
        matchThreshold: state.matchThreshold,
      }),
      merge: (persistedState: any) => ({
        ...persistedState,
        fingerprints: new Map(Object.entries(persistedState.fingerprints || {})),
      }),
    }
  )
);

function calculateFingerprintSimilarity(fp1: number[], fp2: number[]): number {
  if (fp1.length !== fp2.length) {
    return 0;
  }

  let matches = 0;
  for (let i = 0; i < fp1.length; i++) {
    if (fp1[i] === fp2[i]) {
      matches++;
    }
  }

  return matches / fp1.length;
}
