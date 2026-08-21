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

type PersistedFingerprintState = Partial<FingerprintState> & {
  fingerprints?: Record<string, AudioFingerprint>;
};

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

      setFingerprint: (songId, fingerprint) => {
        set((state) => {
          const fingerprints = new Map(state.fingerprints);
          fingerprints.set(songId, fingerprint);
          return { fingerprints };
        });
      },
      getFingerprint: (songId) => get().fingerprints.get(songId),
      hasFingerprint: (songId) => get().fingerprints.has(songId),
      matchFingerprint: (fingerprint) => {
        const matches: FingerprintMatch[] = [];
        const { fingerprints, matchThreshold } = get();
        fingerprints.forEach((stored, songId) => {
          const confidence = calculateFingerprintSimilarity(fingerprint, stored.fingerprint);
          if (confidence >= matchThreshold) {
            matches.push({ songId, confidence, offset: 0 });
          }
        });
        return matches.sort((a, b) => b.confidence - a.confidence);
      },
      setScanning: (isScanning) => set({ isScanning }),
      setScanProgress: (progress) => set({ scanProgress: Math.min(100, Math.max(0, progress)) }),
      setScannedCount: (scannedCount) => set({ scannedCount }),
      setTotalCount: (totalCount) => set({ totalCount }),
      setAutoGenerate: (autoGenerate) => set({ autoGenerate }),
      setMatchThreshold: (threshold) =>
        set({ matchThreshold: Math.min(1, Math.max(0, threshold)) }),
      clearFingerprints: () => set({ fingerprints: new Map() }),
      removeFingerprint: (songId) => {
        set((state) => {
          const fingerprints = new Map(state.fingerprints);
          fingerprints.delete(songId);
          return { fingerprints };
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
      merge: (persistedState: unknown, currentState) => {
        const persisted = persistedState as PersistedFingerprintState | undefined;
        return {
          ...currentState,
          ...persisted,
          fingerprints: new Map(Object.entries(persisted?.fingerprints ?? {})),
        };
      },
    }
  )
);

function calculateFingerprintSimilarity(fp1: number[], fp2: number[]): number {
  if (fp1.length === 0 || fp1.length !== fp2.length) return 0;
  let matches = 0;
  for (let i = 0; i < fp1.length; i++) {
    if (fp1[i] === fp2[i]) matches++;
  }
  return matches / fp1.length;
}
