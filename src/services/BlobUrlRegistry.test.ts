import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BlobUrlRegistry } from "./BlobUrlRegistry";

describe("BlobUrlRegistry", () => {
  let createdUrls: string[] = [];
  let revokedUrls: string[] = [];
  let urlCounter = 0;

  beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];
    urlCounter = 0;

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      const url = `blob:http://localhost/${++urlCounter}`;
      createdUrls.push(url);
      return url;
    });

    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url: string) => {
      revokedUrls.push(url);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers blob URLs and maintains capacity limit via LRU eviction", () => {
    const registry = new BlobUrlRegistry(3); // Small capacity for test
    const dummyBlob = new Blob(["test"]);

    const url1 = registry.register(dummyBlob, "cover");
    const url2 = registry.register(dummyBlob, "cover");
    const url3 = registry.register(dummyBlob, "cover");

    expect(registry.getSize()).toBe(3);
    expect(revokedUrls.length).toBe(0);

    // Registering 4th url should evict url1 (the oldest)
    const url4 = registry.register(dummyBlob, "cover");
    expect(registry.getSize()).toBe(3);
    expect(revokedUrls).toContain(url1);
    expect(registry.getSize()).toBe(3);
  });

  it("releases reference and revokes URL when refCount drops to 0", () => {
    const registry = new BlobUrlRegistry(10);
    const dummyBlob = new Blob(["test"]);

    const url = registry.register(dummyBlob, "audio");
    expect(registry.getSize()).toBe(1);

    registry.release(url);
    expect(revokedUrls).toContain(url);
    expect(registry.getSize()).toBe(0);
  });

  it("revokes all URLs associated with a specific tag", () => {
    const registry = new BlobUrlRegistry(10);
    const dummyBlob = new Blob(["test"]);

    const url1 = registry.register(dummyBlob, "song_123");
    const url2 = registry.register(dummyBlob, "song_123");
    const url3 = registry.register(dummyBlob, "song_456");

    registry.revokeByTag("song_123");
    expect(revokedUrls).toContain(url1);
    expect(revokedUrls).toContain(url2);
    expect(revokedUrls).not.toContain(url3);
    expect(registry.getSize()).toBe(1);
  });
});
