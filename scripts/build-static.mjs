#!/usr/bin/env node
// Build a fresh Next static export into out/ for desktop packaging (S0-3 interim).
// Sets STATIC_EXPORT=1 because next.config.js only enables output:"export" behind that flag.
// NOTE: package.json is currently occupied by WIP gesture changes; once S0-1 lands, add
//   "build:static": "node scripts/build-static.mjs"
// to package.json and let CI/desktop scripts call npm run build:static.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const skipClean = args.includes("--no-clean");

if (!skipClean) {
  fs.rmSync(new URL("../.next", import.meta.url), { recursive: true, force: true });
  console.log("[build-static] cleaned .next");
}

const env = { ...process.env, STATIC_EXPORT: "1" };
const nextBin = "node_modules/next/dist/bin/next";
console.log("[build-static] STATIC_EXPORT=1 next build --webpack");
const build = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
  stdio: "inherit",
  env,
});
if (build.error) {
  console.error("[build-static] failed to start next: " + build.error.message);
  process.exit(1);
}
if (build.status !== 0) {
  console.error("[build-static] next build failed with exit code " + build.status);
  process.exit(build.status ?? 1);
}

const verify = spawnSync(process.execPath, ["scripts/verify-static-export.mjs"], { stdio: "inherit" });
process.exit(verify.status ?? 1);
