"use client";

import { createContext, useContext } from "react";

interface AudioElementRef {
  current: HTMLAudioElement | null;
}

declare global {
  interface Window {
    audioElementRef?: AudioElementRef;
  }
}

const AudioElementContext = createContext<AudioElementRef | null>(null);

export const useAudioElementRef = (): AudioElementRef => {
  const context = useContext(AudioElementContext);
  if (context) {
    return context;
  }

  if (typeof window !== "undefined" && window.audioElementRef) {
    return window.audioElementRef;
  }

  return { current: null };
};

export { AudioElementContext };