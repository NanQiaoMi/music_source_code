import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const audioEngineMock = vi.hoisted(() => {
  const gainNodes: Array<{
    gain: {
      value: number;
      cancelScheduledValues: ReturnType<typeof vi.fn>;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  const sourceNode = { disconnect: vi.fn(), connect: vi.fn() };
  const context = {
    currentTime: 10,
    createGain: vi.fn(() => {
      const node = {
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gainNodes.push(node);
      return node;
    }),
  };

  return {
    gainNodes,
    context,
    engine: {
      getContext: () => context,
      createMediaSource: vi.fn(() => sourceNode),
      getEQChainEntry: vi.fn(() => ({})),
    },
  };
});

vi.mock("./AudioEngine", () => ({
  AudioEngine: { getInstance: () => audioEngineMock.engine },
}));

import { CrossfadeMixer } from "./CrossfadeMixer";

function createAudioElement(): HTMLAudioElement {
  return {
    paused: false,
    currentTime: 24,
    volume: 1,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  } as unknown as HTMLAudioElement;
}

describe("CrossfadeMixer request ownership", () => {
  beforeEach(() => {
    (CrossfadeMixer as unknown as { instance?: CrossfadeMixer }).instance = undefined;
    audioEngineMock.gainNodes.length = 0;
    audioEngineMock.context.currentTime = 10;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not let an old cleanup timer pause a deck reused by a newer request", async () => {
    const mixer = CrossfadeMixer.getInstance();
    const fromAudio = createAudioElement();
    const toAudio = createAudioElement();
    let requestIsCurrent = true;

    await mixer.crossfade(
      fromAudio,
      toAudio,
      0.4,
      () => requestIsCurrent,
      () => requestIsCurrent
    );
    requestIsCurrent = false;
    vi.advanceTimersByTime(600);

    expect(fromAudio.pause).not.toHaveBeenCalled();
    expect(fromAudio.currentTime).toBe(24);
  });

  it("does not schedule ramps when the target request becomes stale during play()", async () => {
    const mixer = CrossfadeMixer.getInstance();
    const fromAudio = createAudioElement();
    const toAudio = createAudioElement();
    let resolvePlay: (() => void) | undefined;
    toAudio.play = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePlay = resolve;
        })
    );
    let requestIsCurrent = true;

    const crossfadePromise = mixer.crossfade(fromAudio, toAudio, 0.4, () => requestIsCurrent);
    requestIsCurrent = false;
    resolvePlay?.();
    await crossfadePromise;

    expect(audioEngineMock.gainNodes[0]?.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(audioEngineMock.gainNodes[1]?.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it("starts the fade from the time playback is confirmed", async () => {
    const mixer = CrossfadeMixer.getInstance();
    const fromAudio = createAudioElement();
    const toAudio = createAudioElement();
    let resolvePlay: (() => void) | undefined;
    toAudio.play = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePlay = resolve;
        })
    );

    const crossfadePromise = mixer.crossfade(fromAudio, toAudio, 0.4);
    audioEngineMock.context.currentTime = 12;
    resolvePlay?.();
    await crossfadePromise;

    expect(audioEngineMock.gainNodes[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.001,
      12.4
    );
    expect(audioEngineMock.gainNodes[1]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1,
      12.4
    );
  });

  it("restores and stops decks owned by a stale pending crossfade", async () => {
    const mixer = CrossfadeMixer.getInstance();
    const fromAudio = createAudioElement();
    const toAudio = createAudioElement();
    let resolvePlay: (() => void) | undefined;
    toAudio.play = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePlay = resolve;
        })
    );
    let requestIsCurrent = true;

    const crossfadePromise = mixer.crossfade(fromAudio, toAudio, 0.4, () => requestIsCurrent);
    requestIsCurrent = false;
    resolvePlay?.();
    await crossfadePromise;

    expect(toAudio.pause).toHaveBeenCalledOnce();
    expect(fromAudio.pause).toHaveBeenCalledOnce();
    expect(audioEngineMock.gainNodes[1]?.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 10);
    expect(audioEngineMock.gainNodes[0]?.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 10);
  });

  it("does not reset a target deck after a newer crossfade has claimed it", async () => {
    const mixer = CrossfadeMixer.getInstance();
    const oldFromAudio = createAudioElement();
    const newFromAudio = createAudioElement();
    const toAudio = createAudioElement();
    const resolvePlay: Array<() => void> = [];
    toAudio.play = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePlay.push(resolve);
        })
    );
    let oldRequestIsCurrent = true;

    const oldCrossfade = mixer.crossfade(oldFromAudio, toAudio, 0.4, () => oldRequestIsCurrent);
    const newCrossfade = mixer.crossfade(newFromAudio, toAudio, 0.4);
    const gainWritesAfterNewClaim =
      audioEngineMock.gainNodes[1]?.gain.setValueAtTime.mock.calls.length;

    oldRequestIsCurrent = false;
    resolvePlay[0]?.();
    await oldCrossfade;

    expect(toAudio.pause).not.toHaveBeenCalled();
    expect(audioEngineMock.gainNodes[1]?.gain.setValueAtTime.mock.calls.length).toBe(
      gainWritesAfterNewClaim
    );

    mixer.prepareForDirectPlayback(toAudio);
    resolvePlay[1]?.();
    await newCrossfade;
  });

  it("cancels the pending deck cleanup when direct playback takes over", async () => {
    const mixer = CrossfadeMixer.getInstance();
    const fromAudio = createAudioElement();
    const toAudio = createAudioElement();

    await mixer.crossfade(fromAudio, toAudio, 0.4);
    expect(mixer.getPendingTimerCount()).toBe(1);

    mixer.prepareForDirectPlayback(fromAudio);
    expect(mixer.getPendingTimerCount()).toBe(0);

    vi.advanceTimersByTime(600);
    expect(fromAudio.pause).not.toHaveBeenCalled();
  });

  it("reuses one gain node per deck and releases it only when the deck is discarded", () => {
    const mixer = CrossfadeMixer.getInstance();
    const audio = createAudioElement();

    const first = mixer.prepareElement(audio);
    expect(mixer.prepareElement(audio)).toBe(first);
    expect(mixer.getNodeCount()).toBe(1);
    expect(audioEngineMock.gainNodes).toHaveLength(1);

    mixer.releaseElement(audio);
    expect(first?.disconnect).toHaveBeenCalled();
    expect(mixer.getNodeCount()).toBe(0);

    mixer.releaseElement(audio);
    expect(mixer.getNodeCount()).toBe(0);
  });

  it("pauses, rewinds, and normalizes a deck when playback is canceled", async () => {
    const mixer = CrossfadeMixer.getInstance();
    const audio = createAudioElement();
    const gain = mixer.prepareElement(audio);

    mixer.pauseAndReset(audio, true);

    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(0);
    expect(gain?.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 10);
  });
});
