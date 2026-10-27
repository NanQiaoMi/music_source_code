import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.join(process.cwd(), "src");
// Matches "import x from 'jsmediatags'" / bare imports, but not "import type ..."
// or "await import('jsmediatags')".
const STATIC_IMPORT_PATTERNS = [
  /^\s*import\s+(?!type\b)[^;]*?from\s+["']jsmediatags["']/m,
  /^\s*import\s+["']jsmediatags["']/m,
];

describe("heavy dependency loading (S4-1)", () => {
  it("never statically imports jsmediatags", () => {
    const files = fs.readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" }) as string[];
    const offenders = files
      .filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."))
      .filter((file) => {
        const source = fs.readFileSync(path.join(SRC_DIR, file), "utf8");
        return STATIC_IMPORT_PATTERNS.some((pattern) => pattern.test(source));
      });

    expect(offenders).toEqual([]);
  });
});
