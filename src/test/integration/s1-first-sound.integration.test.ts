/** S1-10 matrix — first-sound resolution (S1-8/S1-9) through the request coordinator. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  playbackRequestCoordinator,
  type PlaybackRequestToken,
} from "@/lib/playback/requestCoordinator";
import {
  resolveFirstSound,
  type FirstSoundDeps,
  type FirstSoundKind,
} from "@/lib/playback/sourceResolver";

type Candidate = { url: string; cleanup?: () => void } | null;

function deferred(): { promise: Promise<Candidate>; resolve: (value: Candidate) => void } {
  let resolve!: (value: Candidate) => void;
  const promise = new Promise<Candidate>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const pending = (): Promise<Candidate> => new Promise<Candidate>(() => {});
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function makeDeps(overrides: Partial<FirstSoundDeps> = {}): FirstSoundDeps {
  return {
    getOfflineAudio: vi.fn(async () => null),
    getStoredMusic: vi.fn(async () => null),
    getCachedAudio: vi.fn(async () => null),
    resolvePlayableAudio: vi.fn(async () => null),
    ...overrides,
  };
}

function begin(songId: string): PlaybackRequestToken {
  return playbackRequestCoordinator.begin({ songId, source: "local" });
}

async function kindFor(overrides: Partial<FirstSoundDeps>): Promise<FirstSoundKind | undefined> {
  const token = begin("priority");
  try {
    return (await resolveFirstSound(makeDeps(overrides), token.controller.signal))?.kind;
  } finally {
    playbackRequestCoordinator.complete(token);
  }
}

afterEach(() => {
  playbackRequestCoordinator.abortAll("test-cleanup");
  vi.restoreAllMocks();
});

describe("S1-10 first-sound resolution", () => {
  it("first success wins in offline → local → cache → resolved order and cleans every loser", async () => {
    const localCleanup = vi.fn();
    const cacheCleanup = vi.fn();
    let resolverSignal: AbortSignal | undefined;
    const token = begin("song-1");
    const winner = await resolveFirstSound(
      makeDeps({
        getOfflineAudio: async () => ({ url: "blob:offline" }),
        getStoredMusic: async () => ({ url: "blob:local", cleanup: localCleanup }),
        getCachedAudio: async () => ({ url: "blob:cache", cleanup: cacheCleanup }),
        resolvePlayableAudio: async (signal) => {
          resolverSignal = signal;
          return { url: "https://cdn.test/a.mp3" };
        },
      }),
      token.controller.signal
    );
    expect(winner).toMatchObject({ kind: "offline", url: "blob:offline" });
    expect(resolverSignal?.aborted).toBe(true); // losers share the race signal
    expect(playbackRequestCoordinator.inFlight()).toBe(1);
    expect(playbackRequestCoordinator.isCurrent(token)).toBe(true);
    playbackRequestCoordinator.complete(token);
    await flush();
    expect(localCleanup).toHaveBeenCalledTimes(1);
    expect(cacheCleanup).toHaveBeenCalledTimes(1);
    const offlineHit = async () => ({ url: "blob:offline" });
    const localHit = async () => ({ url: "blob:local" });
    const cacheHit = async () => ({ url: "blob:cache" });
    const resolverHit = async () => ({ url: "https://cdn.test/prio.mp3" });
    expect(await kindFor({ getOfflineAudio: offlineHit })).toBe("offline");
    expect(await kindFor({ getStoredMusic: localHit })).toBe("local");
    expect(await kindFor({ getCachedAudio: cacheHit })).toBe("cache");
    expect(await kindFor({ resolvePlayableAudio: resolverHit })).toBe("resolved");
  });

  it("a superseding request cancels the race and late blobs are cleaned exactly once", async () => {
    const offline = deferred();
    const local = deferred();
    const cache = deferred();
    const cleanups = [vi.fn(), vi.fn(), vi.fn()];
    const first = begin("song-1");
    const race = resolveFirstSound(
      makeDeps({
        getOfflineAudio: () => offline.promise,
        getStoredMusic: () => local.promise,
        getCachedAudio: () => cache.promise,
        resolvePlayableAudio: () => pending(),
      }),
      first.controller.signal
    );
    const second = begin("song-2"); // aborts the first token immediately
    expect(first.controller.signal.aborted).toBe(true);
    await expect(race).resolves.toBeNull();
    expect(playbackRequestCoordinator.inFlight()).toBe(1);
    expect(second.controller.signal.aborted).toBe(false);
    offline.resolve({ url: "blob:offline", cleanup: cleanups[0] });
    local.resolve({ url: "blob:local", cleanup: cleanups[1] });
    cache.resolve({ url: "blob:cache", cleanup: cleanups[2] });
    await flush();
    cleanups.forEach((cleanup) => expect(cleanup).toHaveBeenCalledTimes(1));
    // A token superseded before the call must not launch any candidate.
    const stale = begin("song-3");
    playbackRequestCoordinator.complete(second);
    begin("song-4");
    expect(stale.controller.signal.aborted).toBe(true);
    const offlineProbe = vi.fn(async () => null);
    await expect(
      resolveFirstSound(makeDeps({ getOfflineAudio: offlineProbe }), stale.controller.signal)
    ).resolves.toBeNull();
    expect(offlineProbe).not.toHaveBeenCalled();
  });
});
