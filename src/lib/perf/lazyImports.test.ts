import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.join(process.cwd(), "src");
// Packages that must only be reached through "await import(...)".
const LAZY_ONLY_PACKAGES = ["jsmediatags", "crypto-js"];

describe("heavy dependency loading (S4-1/S4-2)", () => {
  for (const pkg of LAZY_ONLY_PACKAGES) {
    it(`never statically imports ${pkg}`, () => {
      const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Matches "import x from 'pkg'" / bare imports, but not "import type ..."
      // or "await import('pkg')".
      const patterns = [
        new RegExp(`^\\s*import\\s+(?!type\\b)[^;]*?from\\s+["']${escaped}["']`, "m"),
        new RegExp(`^\\s*import\\s+["']${escaped}["']`, "m"),
      ];
      const files = fs.readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" }) as string[];
      const offenders = files
        .filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."))
        .filter((file) => {
          const source = fs.readFileSync(path.join(SRC_DIR, file), "utf8");
          return patterns.some((pattern) => pattern.test(source));
        });

      expect(offenders).toEqual([]);
    });
  }
});
