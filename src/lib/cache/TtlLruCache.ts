/**
 * Map-backed bounded LRU + TTL cache: recency follows Map insertion order and
 * expired entries are dropped lazily on access/prune, never by timers.
 */
export interface TtlLruCacheOptions<K, V> {
  /** Hard cap on entries (minimum 1). */
  maxEntries: number;
  /** Lifetime in ms; 0 expires immediately, Infinity disables TTL. */
  maxAgeMs: number;
  now?: () => number;
  onEvict?: (key: K, value: V, reason: "lru" | "ttl") => void;
}
export interface TtlLruCacheStats {
  hits: number;
  misses: number;
  /** Automatic capacity/TTL removals; delete()/clear() are not evictions. */
  evictions: number;
  hitRate: number;
}
interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}
export class TtlLruCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();
  private readonly maxEntries: number;
  private readonly maxAgeMs: number;
  private readonly now: () => number;
  private readonly onEvict?: TtlLruCacheOptions<K, V>["onEvict"];
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: TtlLruCacheOptions<K, V>) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries));
    this.maxAgeMs = Math.max(0, options.maxAgeMs);
    this.now = options.now ?? Date.now;
    this.onEvict = options.onEvict;
  }
  get(key: K): V | null {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (this.isExpired(entry)) {
      this.remove(key, entry, "ttl");
      this.misses += 1;
      return null;
    }
    this.entries.delete(key); // refresh recency, keep the fixed TTL
    this.entries.set(key, entry);
    this.hits += 1;
    return entry.value;
  }
  has(key: K): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (!this.isExpired(entry)) return true;
    this.remove(key, entry, "ttl");
    return false;
  }
  set(key: K, value: V): void {
    this.entries.delete(key); // overwrites become most recently used
    this.entries.set(key, { value, expiresAt: this.now() + this.maxAgeMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      const entry = this.entries.get(oldest.value);
      if (!entry) break;
      this.remove(oldest.value, entry, this.isExpired(entry) ? "ttl" : "lru");
    }
  }
  delete(key: K): boolean {
    return this.entries.delete(key);
  }
  clear(): void {
    this.entries.clear();
  }
  /** Prunes expired entries, then returns the number of live entries. */
  size(): number {
    this.prune();
    return this.entries.size;
  }
  /** Prunes expired entries and returns how many were removed. */
  prune(): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (!this.isExpired(entry)) continue;
      this.remove(key, entry, "ttl");
      removed += 1;
    }
    return removed;
  }
  stats(): TtlLruCacheStats {
    const lookups = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: lookups === 0 ? 0 : this.hits / lookups,
    };
  }
  private isExpired(entry: CacheEntry<V>): boolean {
    return this.now() >= entry.expiresAt;
  }
  private remove(key: K, entry: CacheEntry<V>, reason: "lru" | "ttl"): void {
    this.entries.delete(key);
    this.evictions += 1;
    this.onEvict?.(key, entry.value, reason);
  }
}
