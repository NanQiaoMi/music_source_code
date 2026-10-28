import { describe, expect, it } from "vitest";
import { TtlLruCache } from "./TtlLruCache";

describe("TtlLruCache", () => {
  it("evicts the least recently used entry at capacity", () => {
    const cache = new TtlLruCache<string, number>({ maxEntries: 2, maxAgeMs: 60_000 });
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1); // "a" becomes most recently used
    cache.set("c", 3);
    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  it("expires entries lazily after maxAgeMs", () => {
    let now = 1_000;
    const cache = new TtlLruCache<string, number>({ maxEntries: 4, maxAgeMs: 50, now: () => now });
    cache.set("a", 1);
    cache.set("b", 2);
    now = 1_049;
    expect(cache.get("a")).toBe(1);
    now = 1_050;
    expect(cache.has("b")).toBe(false);
    expect(cache.get("b")).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it("reports hits, misses, evictions and hitRate", () => {
    const cache = new TtlLruCache<string, number>({ maxEntries: 1, maxAgeMs: 60_000 });
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("missing")).toBeNull();
    cache.set("b", 2); // evicts "a"
    expect(cache.stats()).toEqual({ hits: 1, misses: 1, evictions: 1, hitRate: 0.5 });
  });

  it("calls onEvict with lru and ttl reasons", () => {
    let now = 0;
    const evicted: Array<[string, number, "lru" | "ttl"]> = [];
    const cache = new TtlLruCache<string, number>({
      maxEntries: 1,
      maxAgeMs: 10,
      now: () => now,
      onEvict: (key, value, reason) => evicted.push([key, value, reason]),
    });
    cache.set("a", 1);
    cache.set("b", 2); // lru eviction
    now = 20;
    cache.set("c", 3); // "b" is expired on capacity pressure
    expect(evicted).toEqual([
      ["a", 1, "lru"],
      ["b", 2, "ttl"],
    ]);
  });

  it("bounds growth and prunes expired entries", () => {
    let now = 0;
    const cache = new TtlLruCache<number, number>({
      maxEntries: 300,
      maxAgeMs: 1_000,
      now: () => now,
    });
    for (let i = 0; i < 1_000; i += 1) cache.set(i, i);
    expect(cache.size()).toBe(300);
    expect(cache.get(0)).toBeNull();
    expect(cache.get(999)).toBe(999);
    now = 2_000;
    expect(cache.prune()).toBe(300);
    expect(cache.size()).toBe(0);
  });
});
