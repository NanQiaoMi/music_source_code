"use client";

import { getAudioAnalyser, getAudioContext } from "@/lib/audio/audioEngineAccess";
import { analyserHub } from "./AnalyserHub";

export const getAnalyserHub = (): typeof analyserHub => analyserHub;
export const getSharedAnalyser = (): AnalyserNode | null =>
  getAudioAnalyser() ?? analyserHub.getAnalyser();
export const getSharedAudioContext = getAudioContext;

export const initializeSharedAudio = async (): Promise<AnalyserNode | null> => {
  return getSharedAnalyser();
};

export const isAudioContextReady = (): boolean => {
  return getSharedAnalyser() !== null;
};
