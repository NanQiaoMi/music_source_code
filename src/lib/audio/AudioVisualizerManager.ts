"use client";

export * from "@/hooks/useAudioPlayer";

import { getAudioAnalyser, getAudioContext } from "@/hooks/useAudioPlayer";

export const getSharedAnalyser = getAudioAnalyser;
export const getSharedAudioContext = getAudioContext;

export const initializeSharedAudio = async (): Promise<AnalyserNode | null> => {
  return getAudioAnalyser();
};

export const isAudioContextReady = (): boolean => {
  const analyser = getAudioAnalyser();
  return analyser !== null;
};