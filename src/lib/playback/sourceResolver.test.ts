import { describe, expect, it, vi } from "vitest";
import { resolveFirstSound, type FirstSoundDeps, type FirstSoundKind } from "./sourceResolver";

type RawCandidate = { url: string; cleanup?: () => void } | null;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeDeps(overrides: Partial<FirstSoundDeps> = {}): FirstSoundDeps {
  return {
    getOfflineAudio: vi.fn(async () => null),
    getStoredMusic: vi.fn(async () => null),
    getCachedAudio: vi.fn(async () => null),
    resolvePlayableAudio: vi.fn(async () => null),
    ...overrides,
  };
}

const pending = (): Promise<null> => new Promise<null>(() => {});
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function expectKind(kind: FirstSoundKind | undefined, expected: FirstSoundKind): void {
  expect(kind).toBe(expected);
}

describe("resolveFirstSound (S1-9)", () => {
  it("offline hit wins and aborts the resolver", async () => {
    const offlineCleanup = vi.fn();
    let resolverSignal: AbortSignal | undefined;

    const deps = makeDeps({
      getOfflineAudio: async () => ({ url: "blob:offline", cleanup: offlineCleanup }),
      resolvePlayableAudio: (signal) => {
        resolverSignal = signal;
        return pending();
      },
    });

    const result = await resolveFirstSound(deps, new AbortController().signal);

    expectKind(result?.kind, "offline");
    expect(result?.url).toBe("blob:offline");
    expect(resolverSignal?.aborted).toBe(true);
    // 胜者的 cleanup 交还给调用方，这里不能提前释放
    expect(offlineCleanup).not.toHaveBeenCalled();
  });

  it("cache hit wins and aborts the resolver", async () => {
    const cache = deferred<RawCandidate>();
    const cacheCleanup = vi.fn();
    let resolverSignal: AbortSignal | undefined;

    const deps = makeDeps({
      getOfflineAudio: () => deferred<RawCandidate>().promise,
      getStoredMusic: () => deferred<RawCandidate>().promise,
      getCachedAudio: () => cache.promise,
      resolvePlayableAudio: (signal) => {
        resolverSignal = signal;
        return pending();
      },
    });

    const promise = resolveFirstSound(deps, new AbortController().signal);
    cache.resolve({ url: "blob:cache", cleanup: cacheCleanup });
    const result = await promise;

    expectKind(result?.kind, "cache");
    expect(result?.url).toBe("blob:cache");
    expect(resolverSignal?.aborted).toBe(true);
    expect(cacheCleanup).not.toHaveBeenCalled();
  });

  it("returns null when every candidate misses", async () => {
    const deps = makeDeps();

    const result = await resolveFirstSound(deps, new AbortController().signal);

    expect(result).toBeNull();
    expect(deps.getOfflineAudio).toHaveBeenCalledTimes(1);
    expect(deps.getStoredMusic).toHaveBeenCalledTimes(1);
    expect(deps.getCachedAudio).toHaveBeenCalledTimes(1);
    expect(deps.resolvePlayableAudio).toHaveBeenCalledTimes(1);
  });

  it("invokes late loser cleanup exactly once", async () => {
    const offline = deferred<RawCandidate>();
    const local = deferred<RawCandidate>();
    const cache = deferred<RawCandidate>();
    const offlineCleanup = vi.fn();
    const localCleanup = vi.fn();

    const deps = makeDeps({
      getOfflineAudio: () => offline.promise,
      getStoredMusic: () => local.promise,
      getCachedAudio: () => cache.promise,
      resolvePlayableAudio: () => pending(),
    });

    const promise = resolveFirstSound(deps, new AbortController().signal);
    cache.resolve({ url: "blob:cache" });
    const result = await promise;
    expectKind(result?.kind, "cache");

    offline.resolve({ url: "blob:offline", cleanup: offlineCleanup });
    local.resolve({ url: "blob:local", cleanup: localCleanup });
    await flush();

    expect(offlineCleanup).toHaveBeenCalledTimes(1);
    expect(localCleanup).toHaveBeenCalledTimes(1);
  });

  it("aborted signal returns null and still cleans up late candidates", async () => {
    const offline = deferred<RawCandidate>();
    const local = deferred<RawCandidate>();
    const cache = deferred<RawCandidate>();
    const cleanups = [vi.fn(), vi.fn(), vi.fn()];
    let resolverSignal: AbortSignal | undefined;

    const deps = makeDeps({
      getOfflineAudio: () => offline.promise,
      getStoredMusic: () => local.promise,
      getCachedAudio: () => cache.promise,
      resolvePlayableAudio: (signal) => {
        resolverSignal = signal;
        return pending();
      },
    });

    const controller = new AbortController();
    const promise = resolveFirstSound(deps, controller.signal);
    controller.abort();

    await expect(promise).resolves.toBeNull();
    expect(resolverSignal?.aborted).toBe(true);

    offline.resolve({ url: "blob:offline", cleanup: cleanups[0] });
    local.resolve({ url: "blob:local", cleanup: cleanups[1] });
    cache.resolve({ url: "blob:cache", cleanup: cleanups[2] });
    await flush();

    cleanups.forEach((cleanup) => expect(cleanup).toHaveBeenCalledTimes(1));
  });

  it("resolver wins when IDB reads are slower and revokes the late IDB blob", async () => {
    const offline = deferred<RawCandidate>();
    const offlineCleanup = vi.fn();

    const deps = makeDeps({
      getOfflineAudio: () => offline.promise,
      resolvePlayableAudio: async () => ({ url: "https://cdn.example.com/a.mp3" }),
    });

    const result = await resolveFirstSound(deps, new AbortController().signal);
    expectKind(result?.kind, "resolved");
    expect(result?.url).toBe("https://cdn.example.com/a.mp3");

    offline.resolve({ url: "blob:late", cleanup: offlineCleanup });
    await flush();
    expect(offlineCleanup).toHaveBeenCalledTimes(1);
  });

  it("pre-aborted signal starts no candidate", async () => {
    const controller = new AbortController();
    controller.abort();
    const deps = makeDeps();

    await expect(resolveFirstSound(deps, controller.signal)).resolves.toBeNull();
    expect(deps.getOfflineAudio).not.toHaveBeenCalled();
    expect(deps.getStoredMusic).not.toHaveBeenCalled();
    expect(deps.getCachedAudio).not.toHaveBeenCalled();
    expect(deps.resolvePlayableAudio).not.toHaveBeenCalled();
  });
});
