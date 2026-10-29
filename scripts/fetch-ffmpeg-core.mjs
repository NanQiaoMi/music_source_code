#!/usr/bin/env node
/**
 * Download and self-host the FFmpeg wasm core (S7-3b).
 *
 *   npm run fetch:ffmpeg-core              # idempotent: verified files are skipped
 *   npm run fetch:ffmpeg-core -- --force   # re-download
 *   npm run fetch:ffmpeg-core -- --optional # warn-only (prebuild/CI without network)
 *   FFMPEG_CORE_BASE_URL=https://mirror/... npm run fetch:ffmpeg-core
 *
 * Release and offline builds must run this: `npm run build` does it through the
 * `prebuild` hook (`--optional`, so a network-less CI still builds and the
 * worker keeps its unpkg fallback). Assets land in public/ffmpeg-core/ (git
 * ignored, ~31MB) and conversion.worker.ts prefers them over the CDN.
 *
 * Proxy: native fetch ignores HTTP(S)_PROXY. Node >= 24 supports
 * --use-env-proxy, so when a proxy variable is set this script re-execs itself
 * with that flag once (set FFMPEG_CORE_NO_PROXY_REEXEC=1 to opt out) and
 * otherwise warns before trying a direct download.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const VERSION = "0.12.6";
const DEFAULT_BASE = `https://unpkg.com/@ffmpeg/core@${VERSION}/dist/umd`;
const TARGET_DIR = path.join(process.cwd(), "public", "ffmpeg-core");
const ASSETS = [
  {
    name: "ffmpeg-core.js",
    bytes: 114673,
    sha256: "a34873964b0f62aec516bac75e3aa9086ec3535d4d07f0269aa94ea748b6cb71",
  },
  {
    name: "ffmpeg-core.wasm",
    bytes: 32129114,
    sha256: "2390efa7fb66e7e42dbae15427571a5ffc96b829480904c30f471f0a78967f61",
  },
];

const args = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("--base")));
const force = args.has("--force");
const optional = args.has("--optional");
const baseFlagIndex = process.argv.indexOf("--base");
const baseUrl = (
  (baseFlagIndex > -1 ? process.argv[baseFlagIndex + 1] : process.env.FFMPEG_CORE_BASE_URL) ||
  DEFAULT_BASE
).replace(/\/+$/, "");

const PROXY_VARS = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy",
];
const proxy = PROXY_VARS.map((name) => process.env[name]).find(Boolean);

if (
  proxy &&
  process.env.FFMPEG_CORE_NO_PROXY_REEXEC !== "1" &&
  !process.execArgv.includes("--use-env-proxy") &&
  process.allowedNodeEnvironmentFlags.has("--use-env-proxy")
) {
  const result = spawnSync(process.execPath, ["--use-env-proxy", ...process.argv.slice(1)], {
    stdio: "inherit",
    env: { ...process.env, FFMPEG_CORE_NO_PROXY_REEXEC: "1" },
  });
  process.exit(result.status ?? 1);
}

function log(message) {
  console.log("[ffmpeg-core] " + message);
}

async function existingSize(file) {
  try {
    return (await stat(file)).size;
  } catch {
    return -1;
  }
}

async function download(asset) {
  const url = `${baseUrl}/${asset.name}`;
  log("downloading " + url);
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength !== asset.bytes) {
    throw new Error(`${asset.name}: expected ${asset.bytes} bytes, got ${buffer.byteLength}`);
  }
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (digest !== asset.sha256) {
    throw new Error(`${asset.name}: sha256 mismatch (got ${digest})`);
  }
  const target = path.join(TARGET_DIR, asset.name);
  const temp = target + ".download";
  await writeFile(temp, buffer);
  await rename(temp, target);
  log(`${asset.name} -> public/ffmpeg-core/${asset.name} (${buffer.byteLength} bytes)`);
}

async function ensure(asset) {
  if (!force) {
    const size = await existingSize(path.join(TARGET_DIR, asset.name));
    if (size === asset.bytes) {
      log(`${asset.name} present (${size} bytes), skipping`);
      return;
    }
    if (size !== -1) log(`${asset.name} size mismatch (${size} != ${asset.bytes}), re-downloading`);
  }
  await download(asset);
}

try {
  await mkdir(TARGET_DIR, { recursive: true });
  for (const asset of ASSETS) await ensure(asset);
  log("ready: /ffmpeg-core is served same-origin and preferred by the conversion worker");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (optional) {
    console.warn("[ffmpeg-core] warning: " + message + " (conversion keeps the unpkg fallback)");
    process.exitCode = 0;
  } else {
    console.error("[ffmpeg-core] " + message);
    process.exitCode = 1;
  }
}
