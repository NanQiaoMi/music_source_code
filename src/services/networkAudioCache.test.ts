import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  makeCacheKey,
  saveCachedAudio,
  getCachedAudio,
  getCachedAudioMeta,
  getAllCachedAudioMeta,
  getCacheStats,
  deleteCachedAudio,
  clearAllNetworkCache,
  updateLastPlayed,
  createBlobUrlFromCache,
  CachedNetworkAudio,
} from "./networkAudioCache";

// Setup In-Memory IndexedDB Mock for Node/jsdom test runner
function setupMockIndexedDB() {
  const storeMap = new Map<string, any>();

  const mockStore = {
    put: (item: any) => {
      storeMap.set(item.cacheKey, item);
      const req: any = { onsuccess: null, onerror: null };
      setTimeout(() => req.onsuccess?.({ target: { result: item.cacheKey } }), 0);
      return req;
    },
    get: (key: string) => {
      const item = storeMap.get(key);
      const req: any = { onsuccess: null, onerror: null, result: item };
      setTimeout(() => {
        req.result = item;
        req.onsuccess?.({ target: { result: item } });
      }, 0);
      return req;
    },
    delete: (key: string) => {
      storeMap.delete(key);
      const req: any = { onsuccess: null, onerror: null };
      setTimeout(() => req.onsuccess?.({ target: { result: undefined } }), 0);
      return req;
    },
    getAll: () => {
      const items = Array.from(storeMap.values());
      const req: any = { onsuccess: null, onerror: null, result: items };
      setTimeout(() => {
        req.result = items;
        req.onsuccess?.({ target: { result: items } });
      }, 0);
      return req;
    },
    clear: () => {
      storeMap.clear();
      const req: any = { onsuccess: null, onerror: null };
      setTimeout(() => req.onsuccess?.({ target: { result: undefined } }), 0);
      return req;
    },
    index: (name: string) => ({
      getAll: () => {
        const items = Array.from(storeMap.values()).sort((a, b) => (a[name] || 0) - (b[name] || 0));
        const req: any = { onsuccess: null, onerror: null, result: items };
        setTimeout(() => {
          req.result = items;
          req.onsuccess?.({ target: { result: items } });
        }, 0);
        return req;
      },
    }),
  };

  const mockDB: any = {
    objectStoreNames: { contains: () => true },
    transaction: () => ({
      objectStore: () => mockStore,
    }),
  };

  const mockFactory = {
    open: () => {
      const req: any = { onsuccess: null, onerror: null, onupgradeneeded: null, result: mockDB };
      setTimeout(() => {
        req.result = mockDB;
        req.onsuccess?.({ target: { result: mockDB } });
      }, 0);
      return req;
    },
  };

  (globalThis as any).indexedDB = mockFactory;
}

describe("NetworkAudioCache Service", () => {
  beforeEach(async () => {
    setupMockIndexedDB();
    await clearAllNetworkCache();
  });

  afterEach(async () => {
    await clearAllNetworkCache();
  });

  it("should correctly generate cache keys", () => {
    expect(makeCacheKey("12345", "netease")).toBe("netease:12345");
    expect(makeCacheKey("test_song", "kuwo")).toBe("kuwo:test_song");
  });

  it("should save and retrieve cached audio with full metadata", async () => {
    const fakeBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const item: CachedNetworkAudio = {
      cacheKey: "netease:1001",
      songId: "1001",
      source: "netease",
      title: "七里香",
      artist: "周杰伦",
      album: "七里香",
      cover: "https://example.com/cover.jpg",
      lyrics: "[00:01.00]窗外的麻雀",
      translationLyrics: "",
      duration: 299,
      fileData: fakeBuffer,
      fileType: "audio/mpeg",
      originalUrl: "https://example.com/audio.mp3",
      cachedAt: Date.now(),
      lastPlayedAt: Date.now(),
      fileSize: fakeBuffer.byteLength,
    };

    await saveCachedAudio(item);

    const retrieved = await getCachedAudio("1001", "netease");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe("七里香");
    expect(retrieved?.artist).toBe("周杰伦");
    expect(retrieved?.lyrics).toBe("[00:01.00]窗外的麻雀");
    expect(retrieved?.fileData.byteLength).toBe(5);
  });

  it("should retrieve metadata without loading large binary data", async () => {
    const fakeBuffer = new Uint8Array([10, 20, 30]).buffer;
    const item: CachedNetworkAudio = {
      cacheKey: "kuwo:2002",
      songId: "2002",
      source: "kuwo",
      title: "晴天",
      artist: "周杰伦",
      duration: 269,
      fileData: fakeBuffer,
      fileType: "audio/flac",
      originalUrl: "https://kuwo.cn/audio.flac",
      cachedAt: Date.now(),
      lastPlayedAt: Date.now(),
      fileSize: fakeBuffer.byteLength,
    };

    await saveCachedAudio(item);

    const meta = await getCachedAudioMeta("2002", "kuwo");
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe("晴天");
    expect(meta?.fileSize).toBe(3);
    expect((meta as any).fileData).toBeUndefined();
  });

  it("should calculate cache stats and list all metadata", async () => {
    const buf1 = new Uint8Array(1024).buffer; // 1 KB
    const buf2 = new Uint8Array(2048).buffer; // 2 KB

    await saveCachedAudio({
      cacheKey: "netease:s1",
      songId: "s1",
      source: "netease",
      title: "Song 1",
      artist: "Artist 1",
      duration: 200,
      fileData: buf1,
      fileType: "audio/mpeg",
      originalUrl: "",
      cachedAt: Date.now(),
      lastPlayedAt: Date.now(),
      fileSize: 1024,
    });

    await saveCachedAudio({
      cacheKey: "qq:s2",
      songId: "s2",
      source: "qq",
      title: "Song 2",
      artist: "Artist 2",
      duration: 210,
      fileData: buf2,
      fileType: "audio/mpeg",
      originalUrl: "",
      cachedAt: Date.now(),
      lastPlayedAt: Date.now(),
      fileSize: 2048,
    });

    const stats = await getCacheStats();
    expect(stats.count).toBe(2);
    expect(stats.totalSizeBytes).toBe(3072);

    const all = await getAllCachedAudioMeta();
    expect(all.length).toBe(2);
    expect(all.map((m) => m.title)).toContain("Song 1");
    expect(all.map((m) => m.title)).toContain("Song 2");
  });

  it("should delete individual cached songs", async () => {
    const buf = new Uint8Array(512).buffer;
    await saveCachedAudio({
      cacheKey: "kugou:k1",
      songId: "k1",
      source: "kugou",
      title: "海阔天空",
      artist: "Beyond",
      duration: 320,
      fileData: buf,
      fileType: "audio/mpeg",
      originalUrl: "",
      cachedAt: Date.now(),
      lastPlayedAt: Date.now(),
      fileSize: 512,
    });

    let cached = await getCachedAudio("k1", "kugou");
    expect(cached).not.toBeNull();

    await deleteCachedAudio("kugou:k1");

    cached = await getCachedAudio("k1", "kugou");
    expect(cached).toBeNull();
  });

  it("should update lastPlayedAt timestamp", async () => {
    const buf = new Uint8Array(256).buffer;
    const initialTime = 1000000;
    await saveCachedAudio({
      cacheKey: "netease:t1",
      songId: "t1",
      source: "netease",
      title: "Test Timestamp",
      artist: "Tester",
      duration: 180,
      fileData: buf,
      fileType: "audio/mpeg",
      originalUrl: "",
      cachedAt: initialTime,
      lastPlayedAt: initialTime,
      fileSize: 256,
    });

    await updateLastPlayed("netease:t1");

    const updated = await getCachedAudio("t1", "netease");
    expect(updated?.lastPlayedAt).toBeGreaterThan(initialTime);
  });

  it("should provide default fallback values when source, title, or artist are missing in cache", async () => {
    const buf = new Uint8Array(256).buffer;
    await saveCachedAudio({
      cacheKey: "unknown-key",
      songId: "legacy-song",
      source: undefined as any,
      title: undefined as any,
      artist: undefined as any,
      duration: 120,
      fileData: buf,
      fileType: "audio/mpeg",
      originalUrl: "",
      cachedAt: Date.now(),
      lastPlayedAt: Date.now(),
      fileSize: 256,
    });

    const all = await getAllCachedAudioMeta();
    const legacy = all.find((m) => m.songId === "legacy-song");
    expect(legacy).toBeDefined();
    expect(legacy?.source).toBe("netease");
    expect(legacy?.title).toBe("未知歌曲");
    expect(legacy?.artist).toBe("未知艺术家");
  });

  it("makeCacheKey should handle missing source safely", () => {
    expect(makeCacheKey("12345", "qq")).toBe("qq:12345");
    expect(makeCacheKey("12345", undefined)).toBe("netease:12345");
    expect(makeCacheKey("12345", "")).toBe("netease:12345");
  });
});
