import { describe, it, expect, beforeEach } from "vitest";
import {
  getCacheKey,
  getCacheFilePath,
  getCacheMetaPath,
  hasCompleteCache,
  serveCachedFile,
  CacheMeta,
} from "./proxyDiskCache";
import fs from "fs";

describe("proxyDiskCache", () => {
  const testUrl = "http://example.com/audio/test.mp3";
  const testKey = getCacheKey(testUrl);

  it("should generate deterministic sha256 cache key", () => {
    const key1 = getCacheKey(testUrl);
    const key2 = getCacheKey(testUrl);
    expect(key1).toBe(key2);
    expect(key1.length).toBe(64);
  });

  it("should report cache miss when file does not exist", async () => {
    const result = await hasCompleteCache("non_existent_key_12345");
    expect(result.isHit).toBe(false);
    expect(result.meta).toBeNull();
  });

  it("should correctly serve cached file with Range header (206 Partial Content)", async () => {
    const filePath = getCacheFilePath(testKey);
    const metaPath = getCacheMetaPath(testKey);

    const dummyData = Buffer.alloc(10000, 65); // 10KB
    fs.mkdirSync(require("path").dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, dummyData);

    const meta: CacheMeta = {
      url: testUrl,
      contentType: "audio/mpeg",
      contentLength: 10000,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
      complete: true,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta), "utf-8");

    const hit = await hasCompleteCache(testKey);
    expect(hit.isHit).toBe(true);
    expect(hit.meta?.contentLength).toBe(10000);

    // Request Range: bytes=0-1023 (first 1KB)
    const rangeRes = serveCachedFile(filePath, meta, "bytes=0-1023");
    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers.get("Content-Range")).toBe("bytes 0-1023/10000");
    expect(rangeRes.headers.get("Content-Length")).toBe("1024");
    expect(rangeRes.headers.get("X-Cache")).toBe("HIT");

    // Clean up
    try {
      fs.unlinkSync(filePath);
      fs.unlinkSync(metaPath);
    } catch {}
  });
});
