export type PlaybackPhase =
  | "idle"
  | "loading"
  | "playing"
  | "buffering"
  | "paused"
  | "ended"
  | "error";

export interface PlaybackMachineState {
  phase: PlaybackPhase;
  requestId: number;
  targetSongId: string | null;
  targetSource: string | null;
  shouldPlay: boolean;
  activeDeckId: string | null;
  activeSource: string | null;
  error: string | null;
}

interface PlaybackOwner {
  requestId: number;
  deckId: string;
  source: string;
}

export type PlaybackMachineEvent =
  | {
      type: "request";
      targetSongId: string | null;
      targetSource?: string | null;
      shouldPlay: boolean;
      forceNewGeneration?: boolean;
    }
  | { type: "request-error"; requestId: number; message?: string }
  | ({ type: "activate"; targetSongId: string | null } & PlaybackOwner)
  | ({ type: "loadstart" } & PlaybackOwner)
  | ({ type: "canplay" } & PlaybackOwner)
  | ({ type: "playing" } & PlaybackOwner)
  | ({ type: "waiting" } & PlaybackOwner)
  | ({ type: "pause" } & PlaybackOwner)
  | ({ type: "ended" } & PlaybackOwner)
  | ({ type: "error"; message?: string } & PlaybackOwner);

export function createInitialPlaybackState(): PlaybackMachineState {
  return {
    phase: "idle",
    requestId: 0,
    targetSongId: null,
    targetSource: null,
    shouldPlay: false,
    activeDeckId: null,
    activeSource: null,
    error: null,
  };
}

function ownsActiveSource(state: PlaybackMachineState, event: PlaybackOwner): boolean {
  return (
    event.requestId === state.requestId &&
    event.deckId === state.activeDeckId &&
    event.source === state.activeSource
  );
}

export function transitionPlaybackState(
  state: PlaybackMachineState,
  event: PlaybackMachineEvent
): PlaybackMachineState {
  if (event.type === "request") {
    const targetSource = event.targetSource ?? null;
    const targetChanged =
      event.targetSongId !== state.targetSongId || targetSource !== state.targetSource;
    const intentChanged = event.shouldPlay !== state.shouldPlay;
    const generationChanged = targetChanged || event.forceNewGeneration === true || intentChanged;

    if (!generationChanged && !intentChanged) return state;

    const requestId = generationChanged ? state.requestId + 1 : state.requestId;
    const phase = event.shouldPlay
      ? generationChanged || state.phase !== "playing"
        ? "loading"
        : state.phase
      : generationChanged
        ? "paused"
        : state.phase;

    return {
      ...state,
      phase: event.targetSongId === null ? "idle" : phase,
      requestId,
      targetSongId: event.targetSongId,
      targetSource,
      shouldPlay: event.shouldPlay,
      activeDeckId: generationChanged ? null : state.activeDeckId,
      activeSource: generationChanged ? null : state.activeSource,
      error: generationChanged ? null : state.error,
    };
  }

  if (event.type === "activate") {
    if (event.requestId !== state.requestId || event.targetSongId !== state.targetSongId) {
      return state;
    }

    const sameActiveSource =
      state.activeDeckId === event.deckId && state.activeSource === event.source;
    const nextPhase = state.shouldPlay
      ? sameActiveSource && state.phase === "playing"
        ? "playing"
        : "loading"
      : state.phase === "playing" || state.phase === "buffering"
        ? state.phase
        : state.phase;

    return {
      ...state,
      phase: nextPhase,
      activeDeckId: event.deckId,
      activeSource: event.source,
      error: null,
    };
  }

  if (event.type === "request-error") {
    if (event.requestId !== state.requestId) return state;
    return {
      ...state,
      phase: "error",
      shouldPlay: false,
      error: event.message ?? "Playback failed",
    };
  }

  if (!ownsActiveSource(state, event)) return state;

  switch (event.type) {
    case "loadstart":
      return state.shouldPlay ? { ...state, phase: "loading", error: null } : state;
    case "canplay":
      return state.shouldPlay ? state : { ...state, phase: "paused" };
    case "playing":
      return state.shouldPlay ? { ...state, phase: "playing", error: null } : state;
    case "waiting":
      return state.shouldPlay ? { ...state, phase: "buffering" } : state;
    case "pause":
      return { ...state, phase: "paused", shouldPlay: false };
    case "ended":
      return { ...state, phase: "ended", shouldPlay: false };
    case "error":
      return {
        ...state,
        phase: "error",
        shouldPlay: false,
        error: event.message ?? "Playback failed",
      };
  }
}
