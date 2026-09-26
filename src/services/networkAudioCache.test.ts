/* eslint-disable @typescript-eslint/no-explicit-any */
// IDB mock 天然是对 IDBRequest/IDBCursor 的部分实现，逐个补全类型只会掩盖被测行为
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
  pruneCacheToLimit,
  CachedNetworkAudio,
} from "./networkAudioCache";

// 暴露给用例：用来模拟"meta store 尚未回填 / 升级失败"的降级路径
let idbStores: { audio: Map<string, any>; meta: Map<string, any> } | null = null;

// Setup In-Memory IndexedDB Mock for Node/jsdom test runner
// 按 store 名分桶：networkAudio（含 fileData）与 networkAudioMeta 必须是两个独立的 Map，
// 否则 put 会互相覆盖 —— 全量读与元数据读就测不出区别了。
function setupMockIndexedDB() {
  const audioMap = new Map<string, any>();
  const metaMap = new Map<string, any>();
  const storesByName: Record<string, Map<string, any>> = {
    networkAudio: audioMap,
    networkAudioMeta: metaMap,
  };
  idbStores = { audio: audioMap, meta: metaMap };

  const makeStore = (map: Map<string, any>) => ({
    put: (item: any) => {
      map.set(item.cacheKey, item);
      const req: any = { onsuccess: null, onerror: null };
      setTimeout(() => req.onsuccess?.({ target: { result: item.cacheKey } }), 0);
      return req;
    },
    get: (key: string) => {
      const item = map.get(key);
      const req: any = { onsuccess: null, onerror: null, result: item };
      setTimeout(() => {
        req.result = item;
        req.onsuccess?.({ target: { result: item } });
      }, 0);
      return req;
    },
    delete: (key: string) => {
      map.delete(key);
      const req: any = { onsuccess: null, onerror: null };
      setTimeout(() => req.onsuccess?.({ target: { result: undefined } }), 0);
      return req;
    },
    count: () => {
      const req: any = { onsuccess: null, onerror: null };
      setTimeout(() => {
        req.result = map.size;
        req.onsuccess?.({ target: { result: map.size } });
      }, 0);
      return req;
    },
    getAll: () => {
      const items = Array.from(map.values());
      const req: any = { onsuccess: null, onerror: null, result: items };
      setTimeout(() => {
        req.result = items;
        req.onsuccess?.({ target: { result: items } });
      }, 0);
      return req;
    },
    openCursor: () => {
      const items = Array.from(map.values());
      let i = 0;
      const req: any = { onsuccess: null, onerror: null };
      const step = () => {
        req.result =
          i < items.length
            ? {
                value: items[i],
                continue: () => {
                  i++;
                  setTimeout(step, 0);
                },
              }
            : null;
        req.onsuccess?.({ target: { result: req.result } });
      };
      setTimeout(step, 0);
      return req;
    },
    clear: () => {
      map.clear();
      const req: any = { onsuccess: null, onerror: null };
      setTimeout(() => req.onsuccess?.({ target: { result: undefined } }), 0);
      return req;
    },
    index: (name: string) => ({
      getAll: () => {
        const items = Array.from(map.values()).sort((a, b) => (a[name] || 0) - (b[name] || 0));
        const req: any = { onsuccess: null, onerror: null, result: items };
        setTimeout(() => {
          req.result = items;
          req.onsuccess?.({ target: { result: items } });
        }, 0);
        return req;
      },
    }),
  });

  const mockDB: any = {
    objectStoreNames: { contains: (name: string) => name in storesByName },
    // 业务代码依赖 tx.oncomplete 收尾（原 mock 没有，会永远不 resolve）
    transaction: (names: string | string[]) => {
      const list = Array.isArray(names) ? names : [names];
      const stores = new Map<string, any>();
      for (const n of list) {
        stores.set(n, makeStore(storesByName[n] ?? audioMap));
      }
      const tx: any = { oncomplete: null, onerror: null, onabort: null, error: null };
      tx.objectStore = (name: string) =>
        stores.get(name) ?? makeStore(storesByName[name] ?? audioMap);
      setTimeout(() => tx.oncomplete?.(), 0);
      return tx;
    },
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

    // LRU 时间戳现在只写 networkAudioMeta（读取方也只看它）。
    // networkAudio 里同名字段是历史遗留、不再维护 —— 否则每次命中缓存播放
    // 都得把整段音频读出来再写回去。
    const updated = await getCachedAudioMeta("t1", "netease");
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

  it("meta 记录缺失时仍能返回元数据，且不带 fileData", async () => {
    const buf = new Uint8Array(64).buffer;
    await saveCachedAudio({
      cacheKey: "netease:fb1",
      songId: "fb1",
      source: "netease",
      title: "降级读取",
      artist: "Tester",
      duration: 100,
      fileData: buf,
      fileType: "audio/mpeg",
      originalUrl: "",
      cachedAt: Date.now(),
      lastPlayedAt: Date.now(),
      fileSize: 64,
    });

    // 模拟升级没跑成 / 回填尚未完成：meta store 里没有这条
    idbStores!.meta.clear();

    const meta = await getCachedAudioMeta("fb1", "netease");
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe("降级读取");
    expect(meta?.fileSize).toBe(64);
    expect((meta as any).fileData).toBeUndefined();
  });

  it("超过条数上限时按 lastPlayedAt 淘汰最旧的，并同时清掉两个 store", async () => {
    const buf = new Uint8Array(8).buffer;
    const base = 1_000_000;
    // MAX_CACHE_COUNT = 200，存 201 条后应当淘汰 1 条最旧的
    for (let i = 0; i < 201; i++) {
      await saveCachedAudio({
        cacheKey: `netease:prune-${i}`,
        songId: `prune-${i}`,
        source: "netease",
        title: `Song ${i}`,
        artist: "Tester",
        duration: 100,
        fileData: buf,
        fileType: "audio/mpeg",
        originalUrl: "",
        cachedAt: base + i,
        lastPlayedAt: base + i,
        fileSize: 8,
      });
    }

    await pruneCacheToLimit();

    const stats = await getCacheStats();
    expect(stats.count).toBe(200);

    // lastPlayedAt 最小的那条应被删掉，且 networkAudio / networkAudioMeta 都要清干净
    expect(await getCachedAudio("prune-0", "netease")).toBeNull();
    expect(idbStores!.audio.has("netease:prune-0")).toBe(false);
    expect(idbStores!.meta.has("netease:prune-0")).toBe(false);
    // 最新的仍在
    expect(idbStores!.meta.has("netease:prune-200")).toBe(true);
  });
});
