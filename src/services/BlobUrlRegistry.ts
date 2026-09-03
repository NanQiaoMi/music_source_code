/**
 * BlobUrlRegistry
 * LRU 对象池与引用计数管理服务。
 * 限制活跃 Blob URL 上限（默认 100 个），当达到上限或曲目/组件卸载时，
 * 自动对最旧未使用的 URL 调用 `URL.revokeObjectURL(url)`，释放底层二进制数据内存。
 */

interface BlobEntry {
  url: string;
  tag: string;
  createdAt: number;
  lastUsedAt: number;
  refCount: number;
}

export class BlobUrlRegistry {
  private static instance: BlobUrlRegistry | null = null;
  private maxCapacity: number;
  private registry: Map<string, BlobEntry> = new Map();

  constructor(maxCapacity = 100) {
    this.maxCapacity = maxCapacity;
  }

  public static getInstance(): BlobUrlRegistry {
    if (!BlobUrlRegistry.instance) {
      BlobUrlRegistry.instance = new BlobUrlRegistry(100);
    }
    return BlobUrlRegistry.instance;
  }

  /**
   * 创建并注册一个受管理的 Blob URL
   */
  public register(blob: Blob | File, tag = "general"): string {
    if (typeof window === "undefined" || !window.URL) {
      return "";
    }

    // 检查容量，达到上限前根据 LRU 驱逐最旧的
    if (this.registry.size >= this.maxCapacity) {
      this.evictOldest();
    }

    const url = URL.createObjectURL(blob);
    const now = Date.now();
    this.registry.set(url, {
      url,
      tag,
      createdAt: now,
      lastUsedAt: now,
      refCount: 1,
    });

    return url;
  }

  /**
   * 增加引用计数
   */
  public retain(url: string): void {
    const entry = this.registry.get(url);
    if (entry) {
      entry.refCount += 1;
      entry.lastUsedAt = Date.now();
    }
  }

  /**
   * 释放引用，若归零则可安全 revoke
   */
  public release(url: string): void {
    const entry = this.registry.get(url);
    if (!entry) return;

    entry.refCount = Math.max(0, entry.refCount - 1);
    entry.lastUsedAt = Date.now();

    if (entry.refCount === 0) {
      this.revoke(url);
    }
  }

  /**
   * 显式立即回收某个 URL
   */
  public revoke(url: string): void {
    if (!url || !url.startsWith("blob:")) return;
    const entry = this.registry.get(url);
    if (entry) {
      this.registry.delete(url);
    }
    if (typeof window !== "undefined" && typeof window.URL?.revokeObjectURL === "function") {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
  }

  /**
   * 按 Tag 批量回收 (如换歌时回收前一首歌: revokeByTag(`song_${songId}`))
   */
  public revokeByTag(tag: string): void {
    const toRevoke: string[] = [];
    for (const [url, entry] of this.registry.entries()) {
      if (entry.tag === tag) {
        toRevoke.push(url);
      }
    }
    for (const url of toRevoke) {
      this.revoke(url);
    }
  }

  /**
   * 清理全部注册的 Blob URLs
   */
  public clearAll(): void {
    const urls = Array.from(this.registry.keys());
    for (const url of urls) {
      this.revoke(url);
    }
  }

  public getSize(): number {
    return this.registry.size;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    // 优先逐出 refCount <= 0 的项
    for (const [url, entry] of this.registry.entries()) {
      if (entry.refCount <= 0 && entry.lastUsedAt < oldestTime) {
        oldestTime = entry.lastUsedAt;
        oldestKey = url;
      }
    }

    // 如果所有项 refCount > 0，退化为严格按 lastUsedAt 最久远项驱逐
    if (!oldestKey) {
      for (const [url, entry] of this.registry.entries()) {
        if (entry.lastUsedAt < oldestTime) {
          oldestTime = entry.lastUsedAt;
          oldestKey = url;
        }
      }
    }

    if (oldestKey) {
      this.revoke(oldestKey);
    }
  }
}
