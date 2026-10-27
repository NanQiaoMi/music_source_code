"use client";

export * from "@/hooks/useAudioPlayer";

import { getAudioContext } from "@/hooks/useAudioPlayer";
import { analyserHub } from "./AnalyserHub";

export const getAnalyserHub = (): typeof analyserHub => analyserHub;
export const getSharedAnalyser = (): AnalyserNode | null => analyserHub.getAnalyser();
export const getSharedAudioContext = getAudioContext;

export const initializeSharedAudio = async (): Promise<AnalyserNode | null> => {
  return analyserHub.getAnalyser();
};

export const isAudioContextReady = (): boolean => {
  return analyserHub.getAnalyser() !== null;
};
