import { beforeEach, describe, expect, it } from "vitest";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";

describe("playbackRuntimeStore", () => {
  beforeEach(() => {
    usePlaybackRuntimeStore.getState().reset();
  });

  it("keeps request metadata in memory and advances generations for new targets", () => {
    const runtime = usePlaybackRuntimeStore.getState();
    const firstRequestId = runtime.requestPlayback("song-a", "source-a", true, true);
    const duplicateRequestId = usePlaybackRuntimeStore
      .getState()
      .requestPlayback("song-a", "source-a", true);
    const secondRequestId = usePlaybackRuntimeStore
      .getState()
      .requestPlayback("song-b", "source-b", true, true);

    expect(firstRequestId).toBeGreaterThan(0);
    expect(duplicateRequestId).toBe(firstRequestId);
    expect(secondRequestId).toBe(firstRequestId + 1);
    expect(usePlaybackRuntimeStore.getState().targetSongId).toBe("song-b");
    expect(usePlaybackRuntimeStore.getState()).not.toHaveProperty("audioElement");
    expect(usePlaybackRuntimeStore.getState()).not.toHaveProperty("analyser");
  });

  it("accepts only events for the current request and active deck", () => {
    const runtime = usePlaybackRuntimeStore.getState();
    const requestId = runtime.requestPlayback("song-a", "source-a", true, true);
    runtime.bindActiveDeck(requestId, "song-a", "deck-a", "https://example.test/a.mp3");
    usePlaybackRuntimeStore.getState().dispatchMediaEvent({
      type: "playing",
      requestId: requestId - 1,
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });

    expect(usePlaybackRuntimeStore.getState().phase).toBe("loading");

    usePlaybackRuntimeStore.getState().dispatchMediaEvent({
      type: "playing",
      requestId,
      deckId: "deck-a",
      source: "https://example.test/a.mp3",
    });

    expect(usePlaybackRuntimeStore.getState().phase).toBe("playing");
  });

  it("keeps a repeated play request idempotent while loading", () => {
    const runtime = usePlaybackRuntimeStore.getState();
    const requestId = runtime.requestPlayback("song-a", "source-a", true, true);

    usePlaybackRuntimeStore.getState().requestPlayback("song-a", "source-a", true);

    expect(usePlaybackRuntimeStore.getState().requestId).toBe(requestId);
    expect(usePlaybackRuntimeStore.getState().phase).toBe("loading");
  });
});
