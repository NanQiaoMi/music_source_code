import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ opfsAudio: true }));
type CachedRecord = {
  cacheKey: string;
  songId: string;
  source: string;
  fileData: Blob | ArrayBuffer;
  fileType: string;
  fileSize: number;
};
const idb = vi.hoisted(() => ({
  saveCachedAudio: vi.fn(async (_record: CachedRecord) => {}),
  getCachedAudio: vi.fn(
    async (
      _id: string,
      _source: string
    ): Promise<Pick<CachedRecord, "fileData" | "fileType"> | null> => null
  ),
  deleteCachedAudio: vi.fn(async (_key: string) => {}),
  getAllCachedAudioMeta: vi.fn(
    async (): Promise<Array<{ songId: string; source: string; fileSize: number }>> => []
  ),
  makeCacheKey: (songId: string, source?: string) => (source || "netease") + ":" + songId,
}));

vi.mock("@/lib/perf/featureFlags", () => ({ featureFlags: flags }));
vi.mock("@/services/networkAudioCache", () => idb);

const {
  OPFS_AUDIO_SOURCE,
  deleteAudio,
  getStats,
  isOpfsAudioSupported,
  listAudio,
  readAudio,
  writeAudio,
} = await import("./opfsAudioStore");

const notFound = () => new DOMException("missing", "NotFoundError");

function fakeOpfs(options: { failWrite?: Error } = {}) {
  const files = new Map<string, { data: Blob | null; aborted: boolean }>();
  const handleFor = (name: string) => {
    const state = files.get(name) ?? { data: null, aborted: false };
    files.set(name, state);
    return {
      kind: "file",
      name,
      async getFile() {
        if (!state.data) throw notFound();
        return new File([state.data], name);
      },
      async createWritable() {
        const chunks: BlobPart[] = [];
        return {
          async write(data: Blob | ArrayBuffer) {
            if (options.failWrite) throw options.failWrite;
            chunks.push(data);
          },
          async close() {
            state.data = new Blob(chunks);
          },
          async abort() {
            state.aborted = true;
          },
        };
      },
    };
  };
  const dir = {
    files,
    async getFileHandle(name: string, opts?: { create?: boolean }) {
      if (!files.has(name) && !opts?.create) throw notFound();
      return handleFor(name);
    },
    async removeEntry(name: string) {
      if (!files.delete(name)) throw notFound();
    },
    async *values() {
      for (const name of files.keys()) yield handleFor(name);
    },
  };
  return dir;
}

let dir = fakeOpfs();
const estimate = { quota: 10_000, usage: 100 };
const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");

function installStorage(storage: unknown) {
  Object.defineProperty(navigator, "storage", { configurable: true, value: storage });
}

beforeEach(() => {
  flags.opfsAudio = true;
  dir = fakeOpfs();
  idb.saveCachedAudio.mockClear();
  idb.getCachedAudio.mockClear();
  idb.deleteCachedAudio.mockClear();
  idb.getAllCachedAudioMeta.mockClear();
  installStorage({
    getDirectory: async () => ({ getDirectoryHandle: async () => dir }),
    estimate: async () => estimate,
  });
});

afterEach(() => {
  if (originalStorage) Object.defineProperty(navigator, "storage", originalStorage);
  else delete (navigator as unknown as { storage?: unknown }).storage;
});

describe("opfsAudioStore", () => {
  it("reports unsupported when OPFS is missing and writes through IndexedDB", async () => {
    installStorage({});
    await expect(isOpfsAudioSupported()).resolves.toEqual({
      available: false,
      reason: "unsupported",
    });
    const result = await writeAudio("netease:1", new Blob(["abc"]));
    expect(result).toEqual({ ok: true, bytes: 3, backend: "indexeddb" });
    expect(idb.saveCachedAudio).toHaveBeenCalledTimes(1);
    const record = idb.saveCachedAudio.mock.calls[0][0];
    expect(record.source).toBe(OPFS_AUDIO_SOURCE);
    expect(record.cacheKey).toBe(OPFS_AUDIO_SOURCE + ":netease:1");
  });

  it("reports unavailable and falls back when the feature flag is off", async () => {
    flags.opfsAudio = false;
    await expect(isOpfsAudioSupported()).resolves.toEqual({
      available: false,
      reason: "flag-disabled",
    });
    expect(await writeAudio("a", new ArrayBuffer(2))).toEqual({
      ok: true,
      bytes: 2,
      backend: "indexeddb",
    });
    idb.getCachedAudio.mockResolvedValueOnce({
      fileData: new Blob(["legacy"]),
      fileType: "audio/wav",
    });
    const read = await readAudio("a");
    expect(read.ok && read.backend).toBe("indexeddb");
    expect(read.ok && (await read.blob.text())).toBe("legacy");
    await expect(listAudio()).resolves.toEqual({ ok: true, entries: [], backend: "indexeddb" });
  });

  it("writes, reads and encodes ids that are not filename safe", async () => {
    const blob = new Blob(["hello-opfs"], { type: "audio/wav" });
    await expect(writeAudio("netease:42/x", blob)).resolves.toEqual({
      ok: true,
      bytes: 10,
      backend: "opfs",
    });
    expect([...dir.files.keys()]).toEqual([encodeURIComponent("netease:42/x") + ".bin"]);
    const read = await readAudio("netease:42/x");
    expect(read.ok).toBe(true);
    expect(read.ok && read.bytes).toBe(10);
    expect(read.ok && (await read.blob.text())).toBe("hello-opfs");
  });

  it("lists entries and sums sizes in stats", async () => {
    await writeAudio("b", new Blob(["12345"]));
    await writeAudio("a", new Blob(["123"]));
    await expect(listAudio()).resolves.toEqual({
      ok: true,
      entries: [
        { id: "a", bytes: 3 },
        { id: "b", bytes: 5 },
      ],
      backend: "opfs",
    });
    await expect(getStats()).resolves.toEqual({
      available: true,
      backend: "opfs",
      count: 2,
      bytes: 8,
      quotaBytes: 10_000,
      usageBytes: 100,
    });
  });

  it("deletes from OPFS and the IndexedDB fallback", async () => {
    await writeAudio("gone", new Blob(["x"]));
    await expect(deleteAudio("gone")).resolves.toEqual({ ok: true, backend: "opfs" });
    await expect(readAudio("gone")).resolves.toEqual({ ok: false, reason: "not-found" });
    expect(dir.files.size).toBe(0);
    expect(idb.deleteCachedAudio).toHaveBeenCalledWith(OPFS_AUDIO_SOURCE + ":gone");
  });

  it("returns a quota reason instead of throwing when the write is rejected", async () => {
    dir = fakeOpfs({ failWrite: new DOMException("full", "QuotaExceededError") });
    const result = await writeAudio("big", new Blob(["x"]));
    expect(result).toEqual({ ok: false, reason: "quota" });
    expect([...dir.files.values()][0]?.aborted).toBe(true);
  });

  it("aborts a write through the provided signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await writeAudio("stop", new Blob(["x"]), { signal: controller.signal });
    expect(result).toEqual({ ok: false, reason: "aborted" });
    expect([...dir.files.values()][0]?.aborted).toBe(true);
  });

  it("reads a pre-existing IndexedDB entry when OPFS has no file", async () => {
    idb.getCachedAudio.mockResolvedValueOnce({
      fileData: new Blob(["old"]),
      fileType: "audio/mpeg",
    });
    const read = await readAudio("legacy");
    expect(read.ok && read.backend).toBe("indexeddb");
    expect(read.ok && (await read.blob.text())).toBe("old");
    expect(dir.files.size).toBe(0);
  });
});
