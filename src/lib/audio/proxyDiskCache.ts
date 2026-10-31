import fs from "fs";
import path from "path";
import crypto from "crypto";
import { isValidAudioData } from "@/lib/audio/playableAudioSource";

export interface CacheMeta {
  url: string;
  contentType: string;
  contentLength: number;
  lastAccessed: number;
  createdAt: number;
  complete: boolean;
}

const CACHE_DIR = path.join(process.cwd(), ".cache", "audio_stream");
const MAX_CACHE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB
const TARGET_PRUNED_SIZE_BYTES = 800 * 1024 * 1024; // 800MB

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch {
      // Ignore if exists
    }
  }
}

export function getCacheKey(url: string): string {
  return crypto.createHash("sha256").update(url.trim()).digest("hex");
}

export function getCacheFilePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.bin`);
}

export function getCacheMetaPath(key: string): string {
  return path.join(CACHE_DIR, `${key}.meta.json`);
}

export function getCachePartPath(key: string): string {
  return path.join(CACHE_DIR, `${key}.part`);
}

export async function hasCompleteCache(key: string): Promise<{
  isHit: boolean;
  filePath: string;
  meta: CacheMeta | null;
}> {
  ensureCacheDir();
  const filePath = getCacheFilePath(key);
  const metaPath = getCacheMetaPath(key);

  if (fs.existsSync(filePath) && fs.existsSync(metaPath)) {
    try {
      const metaContent = await fs.promises.readFile(metaPath, "utf-8");
      const meta: CacheMeta = JSON.parse(metaContent);
      if (meta.complete && meta.contentLength > 1000) {
        // Touch last accessed timestamp asynchronously
        meta.lastAccessed = Date.now();
        fs.promises.writeFile(metaPath, JSON.stringify(meta), "utf-8").catch(() => {});
        return { isHit: true, filePath, meta };
      }
    } catch {
      // Corrupt meta or file
    }
  }

  return { isHit: false, filePath, meta: null };
}

export function serveCachedFile(
  filePath: string,
  meta: CacheMeta,
  rangeHeader: string | null
): Response {
  const totalSize = meta.contentLength;
  const cleanContentType =
    (meta.contentType || "audio/mpeg").split(";")[0].trim().toLowerCase() || "audio/mpeg";

  if (!rangeHeader) {
    const nodeStream = fs.createReadStream(filePath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk: Buffer | string) => {
          controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": cleanContentType,
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, X-Cache",
        "X-Cache": "HIT",
      },
    });
  }

  // Parse Range header: e.g. "bytes=0-1024", "bytes=1024-", "bytes=-500"
  const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!matches) {
    return new Response("Invalid Range Header", { status: 416 });
  }

  let start = matches[1] ? parseInt(matches[1], 10) : 0;
  let end = matches[2] ? parseInt(matches[2], 10) : totalSize - 1;

  if (isNaN(start)) start = 0;
  if (isNaN(end) || end >= totalSize) end = totalSize - 1;

  if (start > end || start >= totalSize) {
    return new Response("Requested Range Not Satisfiable", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${totalSize}`,
      },
    });
  }

  const chunkSize = end - start + 1;
  const nodeStream = fs.createReadStream(filePath, { start, end });
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  return new Response(webStream, {
    status: 206,
    headers: {
      "Content-Type": cleanContentType,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, X-Cache",
      "X-Cache": "HIT",
    },
  });
}

export function cacheStreamAndTee(
  key: string,
  url: string,
  contentType: string,
  expectedLength: number,
  upstreamStream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  ensureCacheDir();
  const partPath = getCachePartPath(key);
  const finalPath = getCacheFilePath(key);
  const metaPath = getCacheMetaPath(key);

  let writeStream: fs.WriteStream | null = null;
  try {
    writeStream = fs.createWriteStream(partPath);
  } catch (e) {
    console.warn("[proxyDiskCache] Failed to create write stream:", e);
  }

  let totalWritten = 0;
  const [streamForClient, streamForDisk] = upstreamStream.tee();

  const cleanContentType = contentType.split(";")[0].trim().toLowerCase() || "audio/mpeg";

  // Async disk saver
  (async () => {
    const reader = streamForDisk.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && writeStream && !writeStream.destroyed) {
          writeStream.write(Buffer.from(value));
          totalWritten += value.byteLength;
        }
      }

      if (writeStream) {
        writeStream.end(async () => {
          // Verify size
          const isComplete =
            expectedLength > 0 ? totalWritten >= expectedLength : totalWritten > 50000;
          if (isComplete) {
            try {
              if (fs.existsSync(partPath)) {
                // 校验音频魔数，杜绝将 HTML/JSON 等文本流误存为本地音频磁盘缓存
                const headerBuf = Buffer.alloc(64);
                const fd = await fs.promises.open(partPath, "r");
                await fd.read(headerBuf, 0, 64, 0);
                await fd.close();

                if (!isValidAudioData(headerBuf, 32)) {
                  console.warn("[proxyDiskCache] Dropping invalid audio stream payload:", url);
                  fs.unlink(partPath, () => {});
                  return;
                }

                await fs.promises.rename(partPath, finalPath);
                const meta: CacheMeta = {
                  url,
                  contentType: cleanContentType,
                  contentLength: totalWritten,
                  lastAccessed: Date.now(),
                  createdAt: Date.now(),
                  complete: true,
                };
                await fs.promises.writeFile(metaPath, JSON.stringify(meta), "utf-8");
                pruneLruCacheIfNeeded().catch(() => {});
              }
            } catch (err) {
              console.warn("[proxyDiskCache] Failed to finalize cache file:", err);
            }
          } else {
            // Incomplete download, clean up part file
            fs.unlink(partPath, () => {});
          }
        });
      }
    } catch {
      if (writeStream) {
        writeStream.destroy();
      }
      fs.unlink(partPath, () => {});
    }
  })();

  return streamForClient;
}

export async function pruneLruCacheIfNeeded(): Promise<void> {
  try {
    ensureCacheDir();
    const files = await fs.promises.readdir(CACHE_DIR);
    const metaFiles = files.filter((f) => f.endsWith(".meta.json"));

    const entries: { key: string; meta: CacheMeta; size: number }[] = [];
    let totalSize = 0;

    for (const mFile of metaFiles) {
      try {
        const key = mFile.replace(".meta.json", "");
        const metaPath = path.join(CACHE_DIR, mFile);
        const binPath = path.join(CACHE_DIR, `${key}.bin`);

        if (fs.existsSync(binPath)) {
          const stat = await fs.promises.stat(binPath);
          const meta: CacheMeta = JSON.parse(await fs.promises.readFile(metaPath, "utf-8"));
          totalSize += stat.size;
          entries.push({ key, meta, size: stat.size });
        }
      } catch {
        // 单条缓存条目读取/删除失败则跳过该条
      }
    }

    if (totalSize > MAX_CACHE_SIZE_BYTES) {
      // Sort oldest accessed first
      entries.sort((a, b) => a.meta.lastAccessed - b.meta.lastAccessed);

      for (const entry of entries) {
        if (totalSize <= TARGET_PRUNED_SIZE_BYTES) break;
        const binPath = path.join(CACHE_DIR, `${entry.key}.bin`);
        const metaPath = path.join(CACHE_DIR, `${entry.key}.meta.json`);
        try {
          if (fs.existsSync(binPath)) await fs.promises.unlink(binPath);
          if (fs.existsSync(metaPath)) await fs.promises.unlink(metaPath);
          totalSize -= entry.size;
        } catch {
          // 单条缓存条目删除失败则跳过该条
        }
      }
    }
  } catch (e) {
    console.warn("[proxyDiskCache] LRU pruning failed:", e);
  }
}
