// Static guard for S4-7b: the four 0-importer V8 leftovers must stay deleted, and no
// source/script/config file may import them again. The legacy "visualization-v8-store"
// key is intentionally retained until D1 decides the remaining V8 disposal (see
// docs/nbl/plans/2026-10-21-arch-perf-execution/S4-bundle-loading.md §4.7).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SELF = "scripts/dead-v8-leftovers.test.mjs";

const DELETED_PATHS = [
  "src/lib/visualization/CinematicDirector.ts",
  "src/lib/three/ThreeJSScene.ts",
  "src/store/presetStore.ts",
  "src/store/animationStore.ts",
];

const REFERENCE_PATTERNS = [
  /@\/store\/presetStore/,
  /@\/store\/animationStore/,
  /@\/lib\/three\/ThreeJSScene/,
  /@\/lib\/visualization\/CinematicDirector/,
  /["'][^"']*\/presetStore["']/,
  /["'][^"']*\/animationStore["']/,
  /["'][^"']*\/ThreeJSScene["']/,
  /["'][^"']*\/CinematicDirector["']/,
  /\busePresetStore\b/,
  /\buseAnimationStore\b/,
  /\bCinematicDirector\b/,
  /\bThreeJSScene\b/,
];

const CONFIG_FILES = [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "tsconfig.json",
  "vitest.config.ts",
  "package.json",
  ".dependency-cruiser.cjs",
  "postcss.config.js",
  "tailwind.config.ts",
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const scanned = [
  ...["src", "scripts"].flatMap((dir) => walk(path.join(ROOT, dir))),
  ...CONFIG_FILES.map((file) => path.join(ROOT, file)).filter((file) => fs.existsSync(file)),
].filter((file) => rel(file) !== SELF);

describe("S4-7b dead V8 leftovers", () => {
  it("keeps the four dead modules deleted", () => {
    const present = DELETED_PATHS.filter((file) => fs.existsSync(path.join(ROOT, file)));
    expect(present).toEqual([]);
  });

  it("has no import or identifier reference in src, scripts, or config", () => {
    const hits = [];
    for (const file of scanned) {
      const text = fs.readFileSync(file, "utf8");
      text.split(/\r?\n/).forEach((line, index) => {
        if (REFERENCE_PATTERNS.some((pattern) => pattern.test(line))) {
          hits.push(rel(file) + ":" + (index + 1) + ": " + line.trim());
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it("keeps the legacy visualization-v8-store key registered as external", () => {
    const registry = fs.readFileSync(path.join(ROOT, "src/lib/storage/storageRegistry.ts"), "utf8");
    expect(registry).toContain('"visualization-v8-store"');
    expect(registry).toMatch(/EXTERNAL_KEYS[\s\S]*"visualization-v8-store"/);
  });

  it("drops deleted store files from the line-budget baseline", () => {
    const baseline = JSON.parse(
      fs.readFileSync(path.join(ROOT, "perf/store-line-baseline.json"), "utf8")
    );
    expect(baseline.files["src/store/presetStore.ts"]).toBeUndefined();
    expect(baseline.files["src/store/animationStore.ts"]).toBeUndefined();
  });
});
