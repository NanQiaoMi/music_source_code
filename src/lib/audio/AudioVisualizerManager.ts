"use client";

import { getAudioAnalyser, getAudioContext } from "@/lib/audio/audioEngineAccess";

export const getSharedAnalyser = getAudioAnalyser;
export const getSharedAudioContext = getAudioContext;

export const initializeSharedAudio = async (): Promise<AnalyserNode | null> => {
  return getAudioAnalyser();
};

export const isAudioContextReady = (): boolean => {
  const analyser = getAudioAnalyser();
  return analyser !== null;
};
