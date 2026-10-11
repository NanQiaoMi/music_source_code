import { create } from "zustand";
import {
  createInitialPlaybackState,
  transitionPlaybackState,
  type PlaybackMachineEvent,
  type PlaybackMachineState,
} from "@/lib/audio/playbackStateMachine";

interface PlaybackRuntimeActions {
  requestPlayback: (
    targetSongId: string | null,
    targetSource: string | null,
    shouldPlay: boolean,
    forceNewGeneration?: boolean
  ) => number;
  bindActiveDeck: (
    requestId: number,
    targetSongId: string | null,
    deckId: string,
    source: string
  ) => void;
  dispatchMediaEvent: (event: Exclude<PlaybackMachineEvent, { type: "request" }>) => void;
  reset: () => void;
}

export type PlaybackRuntimeState = PlaybackMachineState & PlaybackRuntimeActions;

export const usePlaybackRuntimeStore = create<PlaybackRuntimeState>((set, get) => ({
  ...createInitialPlaybackState(),

  requestPlayback: (targetSongId, targetSource, shouldPlay, forceNewGeneration = false) => {
    const current = get();
    const next = transitionPlaybackState(current, {
      type: "request",
      targetSongId,
      targetSource,
      shouldPlay,
      forceNewGeneration,
    });
    if (next !== current) set(next);
    return next.requestId;
  },

  bindActiveDeck: (requestId, targetSongId, deckId, source) => {
    const current = get();
    const next = transitionPlaybackState(current, {
      type: "activate",
      requestId,
      targetSongId,
      deckId,
      source,
    });
    if (next !== current) set(next);
  },

  dispatchMediaEvent: (event) => {
    const current = get();
    const next = transitionPlaybackState(current, event);
    if (next !== current) set(next);
  },

  reset: () => set(createInitialPlaybackState()),
}));
