import { describe, expect, it } from "vitest";
import {
  createInitialPlaybackState,
  transitionPlaybackState,
  type PlaybackMachineEvent,
} from "@/lib/audio/playbackStateMachine";

describe("playbackStateMachine", () => {
  it("does not confirm playback until the current active deck emits playing", () => {
    let state = transitionPlaybackState(createInitialPlaybackState(), {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });

    expect(state.phase).toBe("loading");
    expect(state.shouldPlay).toBe(true);

    state = transitionPlaybackState(state, {
      type: "activate",
      requestId: state.requestId,
      targetSongId: "song-a",
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });

    expect(
      transitionPlaybackState(state, {
        type: "playing",
        requestId: state.requestId,
        deckId: "deck-a",
        source: "https://example.test/a.mp3",
      }).phase
    ).toBe("playing");
  });

  it("ignores stale generations, inactive decks, and mismatched sources", () => {
    let state = transitionPlaybackState(createInitialPlaybackState(), {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });
    state = transitionPlaybackState(state, {
      type: "activate",
      requestId: state.requestId,
      targetSongId: "song-a",
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });
    state = transitionPlaybackState(state, {
      type: "request",
      targetSongId: "song-b",
      targetSource: "source-b",
      shouldPlay: true,
    });

    const staleEvents: PlaybackMachineEvent[] = [
      {
        type: "playing",
        requestId: state.requestId - 1,
        deckId: "deck-a",
        source: "https://example.test/a.mp3",
      },
      {
        type: "playing",
        requestId: state.requestId,
        deckId: "deck-a",
        source: "https://example.test/b.mp3",
      },
    ];

    for (const event of staleEvents) {
      expect(transitionPlaybackState(state, event)).toEqual(state);
    }
  });

  it("keeps play intent idempotent while the same target is loading", () => {
    let state = transitionPlaybackState(createInitialPlaybackState(), {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });
    const firstRequestId = state.requestId;

    state = transitionPlaybackState(state, {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });

    expect(state.requestId).toBe(firstRequestId);
    expect(state.phase).toBe("loading");
  });

  it.each([
    ["waiting", "buffering"],
    ["pause", "paused"],
    ["ended", "ended"],
    ["error", "error"],
  ] as const)("transitions active %s events to %s", (type, expectedPhase) => {
    let state = transitionPlaybackState(createInitialPlaybackState(), {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });
    state = transitionPlaybackState(state, {
      type: "activate",
      requestId: state.requestId,
      targetSongId: "song-a",
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });
    state = transitionPlaybackState(state, {
      type: "playing",
      requestId: state.requestId,
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });

    state = transitionPlaybackState(state, {
      type,
      requestId: state.requestId,
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });

    expect(state.phase).toBe(expectedPhase);
  });

  it("does not resume playing from a late event after a pause request", () => {
    let state = transitionPlaybackState(createInitialPlaybackState(), {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });
    state = transitionPlaybackState(state, {
      type: "activate",
      requestId: state.requestId,
      targetSongId: "song-a",
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });
    state = transitionPlaybackState(state, {
      type: "playing",
      requestId: state.requestId,
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });
    state = transitionPlaybackState(state, {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: false,
    });
    const pauseIntentState = state;

    state = transitionPlaybackState(state, {
      type: "playing",
      requestId: state.requestId,
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });

    expect(state).toEqual(pauseIntentState);
  });

  it("rejects an asynchronous play error from an earlier request", () => {
    let state = transitionPlaybackState(createInitialPlaybackState(), {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });
    const staleRequestId = state.requestId;
    state = transitionPlaybackState(state, {
      type: "request",
      targetSongId: "song-b",
      targetSource: "source-b",
      shouldPlay: true,
    });

    expect(
      transitionPlaybackState(state, {
        type: "request-error",
        requestId: staleRequestId,
        message: "stale rejection",
      })
    ).toEqual(state);
    expect(
      transitionPlaybackState(state, {
        type: "request-error",
        requestId: state.requestId,
        message: "current rejection",
      })
    ).toMatchObject({ phase: "error", shouldPlay: false, error: "current rejection" });
  });

  it("preserves confirmed playback when the same active deck is rebound", () => {
    let state = transitionPlaybackState(createInitialPlaybackState(), {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });
    state = transitionPlaybackState(state, {
      type: "activate",
      requestId: state.requestId,
      targetSongId: "song-a",
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });
    state = transitionPlaybackState(state, {
      type: "playing",
      requestId: state.requestId,
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });

    state = transitionPlaybackState(state, {
      type: "activate",
      requestId: state.requestId,
      targetSongId: "song-a",
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });

    expect(state.phase).toBe("playing");
  });

  it("starts a fresh generation when playback resumes after pause", () => {
    let state = transitionPlaybackState(createInitialPlaybackState(), {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });
    state = transitionPlaybackState(state, {
      type: "activate",
      requestId: state.requestId,
      targetSongId: "song-a",
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });
    state = transitionPlaybackState(state, {
      type: "playing",
      requestId: state.requestId,
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });
    state = transitionPlaybackState(state, {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: false,
    });
    state = transitionPlaybackState(state, {
      type: "pause",
      requestId: state.requestId,
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });
    const pausedRequestId = state.requestId;

    state = transitionPlaybackState(state, {
      type: "request",
      targetSongId: "song-a",
      targetSource: "source-a",
      shouldPlay: true,
    });

    expect(state.requestId).toBe(pausedRequestId + 1);
    expect(state.phase).toBe("loading");
    expect(state.activeDeckId).toBeNull();
  });
});
