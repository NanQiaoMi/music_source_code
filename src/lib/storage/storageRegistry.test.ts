import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKUP_KEYS,
  EXTERNAL_KEYS,
  STORAGE_KEYS,
  STORAGE_REGISTRY,
  assertStorageRegistryIntegrity,
  getStorageEntry,
  getStorageKeyForOwner,
} from "./storageRegistry";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const STORE_DIR = path.join(SRC_DIR, "store");
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function walk(dir: string, out: string[]): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function collectConstants(): Map<string, string> {
  const map = new Map<string, string>();
  const files = walk(SRC_DIR, []).filter((p) => /\.(ts|tsx)$/.test(p) && !p.includes(".test."));
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const re = /(?:export\s+)?const\s+([A-Z][A-Z0-9_]+)\s*=\s*["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) map.set(m[1], m[2]);
  }
  return map;
}

function collectPersistKeys(): string[] {
  const constants = collectConstants();
  const files = fs
    .readdirSync(STORE_DIR)
    .filter((f) => f.endsWith(".ts") && !f.includes(".test.") && f !== "index.ts");
  const keys: string[] = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(STORE_DIR, file), "utf8");
    const idxs: number[] = [];
    const callRe = /persist\(/g;
    let cm: RegExpExecArray | null;
    while ((cm = callRe.exec(text))) idxs.push(cm.index);
    for (let i = 0; i < idxs.length; i += 1) {
      const slice = text.slice(idxs[i], i + 1 < idxs.length ? idxs[i + 1] : text.length);
      let key: string | null = null;
      const nameRe = /name:\s*["']([^"']+)["']/g;
      let nm: RegExpExecArray | null;
      while ((nm = nameRe.exec(slice))) {
        if (KEY_PATTERN.test(nm[1])) {
          key = nm[1];
          break;
        }
      }
      if (!key) {
        const ref = slice.match(/name:\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
        if (ref && constants.has(ref[1])) key = constants.get(ref[1]) ?? null;
      }
      if (!key) throw new Error("cannot resolve persist key for " + file);
      keys.push(key);
    }
  }
  return keys;
}

describe("storageRegistry", () => {
  it("registers every persisted key exactly once (44 keys)", () => {
    const actual = collectPersistKeys().sort();
    expect(actual).toHaveLength(44);
    expect(new Set(actual).size).toBe(44);
    expect([...STORAGE_KEYS].sort()).toEqual(actual);
  });

  it("keeps one registry entry per store owner and the store file exists", () => {
    for (const entry of STORAGE_REGISTRY) {
      const file = path.join(STORE_DIR, entry.owner + ".ts");
      expect(fs.existsSync(file), "missing store file for " + entry.owner).toBe(true);
      expect(getStorageEntry(entry.key)?.owner).toBe(entry.owner);
    }
  });

  it("declares the intended 8 backup keys", () => {
    expect(BACKUP_KEYS).toHaveLength(8);
    for (const key of [
      "audio-store-v4",
      "visual-settings-v4",
      "player-store",
      "queue-store-v5",
      "recommendation-storage",
      "library-manager-store-v4",
      "lyrics-cover-store-v4",
      "playlist-group-store-v1",
    ]) {
      expect(BACKUP_KEYS).toContain(key);
    }
  });

  it("passes integrity checks and exposes owner lookup", () => {
    expect(() => assertStorageRegistryIntegrity()).not.toThrow();
    expect(getStorageKeyForOwner("queueStore")).toBe("queue-store-v5");
    expect(getStorageKeyForOwner("missingStore")).toBeUndefined();
    expect(getStorageEntry("queue-store-v5")?.group).toBe("playback");
    expect(getStorageEntry("ui-store-v2")?.version).toBe(2);
  });

  it("keeps external bare keys out of the managed registry", () => {
    for (const key of EXTERNAL_KEYS) {
      expect(STORAGE_KEYS.has(key)).toBe(false);
    }
  });
});
