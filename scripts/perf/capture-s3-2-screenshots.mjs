#!/usr/bin/env node
/**
 * S3-2 / D7 protected-view screenshot capture.
 *
 * Captures the three protected surfaces (Home, Player, fullscreen lyrics) at a
 * fixed 1440x900 CSS viewport / DPR 1 so evidence is reproducible:
 *
 *   node scripts/perf/capture-s3-2-screenshots.mjs
 *   node scripts/perf/capture-s3-2-screenshots.mjs --base-url http://127.0.0.1:3037 --out <dir>
 *
 * The Player / lyrics captures seed localStorage with the real persist envelope
 * shapes used by this app:
 *   - ui-store-v2  {state:{currentView,themeMode,themeColors,isDynamicTheme},version:2}
 *   - player-store {state:{currentSong,volume,isMuted,playbackRate,loopMode},version:0}
 * The current song fixture is the built-in demo track 稻香 with the LRC fixture
 * copied from src/services/lyricsSearchService.ts, so the protected surfaces show
 * representative content instead of an empty profile. No application code is
 * changed by this script.
 *
 * Requirements: dev server running from this worktree, Playwright installed
 * (npm i --no-save --legacy-peer-deps playwright@1.64.1) and local Chrome.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const DEFAULT_BASE_URL = process.env.S3_2_BASE_URL || "http://127.0.0.1:3037";
const DEFAULT_OUT_DIR = "docs/nbl/plans/2026-10-21-arch-perf-execution/evidence/screenshots/s3-2";
const DEFAULT_CHROME_PATH =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DEFAULT_TIMEOUT_MS = 120000;
const SETTLE_MS = 8000;
const VIEWPORT = { width: 1440, height: 900 };
const DEVICE_SCALE_FACTOR = 1;

const THEME_COLORS = {
  primary: "rgb(55, 65, 81)",
  secondary: "rgb(31, 41, 55)",
  accent: "rgb(75, 85, 99)",
  complementary: "rgb(30, 41, 59)",
  background: "rgb(8, 9, 12)",
  surface: "rgb(15, 17, 23)",
  gradient: ["rgb(55, 65, 81)", "rgb(31, 41, 55)", "rgb(75, 85, 99)"],
  text: "rgb(255, 255, 255)",
  textMuted: "rgba(255, 255, 255, 0.6)",
};

// A valid 0.1s silent WAV keeps the media element happy without network access.
function createSilentWavDataUrl() {
  const sampleRate = 8000;
  const samples = 800;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return "data:audio/wav;base64," + buffer.toString("base64");
}

// Copied from src/services/lyricsSearchService.ts (demo fixture for 稻香-周杰伦).
const DEMO_LYRICS = `[00:00.00]稻香
[00:04.00]作词：周杰伦 作曲：周杰伦
[00:08.00]
[00:14.00]对这个世界如果你有太多的抱怨
[00:19.00]跌倒了就不敢继续往前走
[00:24.00]为什么人要这么的脆弱堕落
[00:29.00]请你打开电视看看
[00:33.00]多少人为生命在努力勇敢的走下去
[00:38.00]我们是不是该知足
[00:42.00]珍惜一切就算没有拥有
[00:47.00]还记得你说家是唯一的城堡
[00:52.00]随着稻香河流继续奔跑
[00:57.00]微微笑 小时候的梦我知道
[01:02.00]不要哭让萤火虫带着你逃跑
[01:07.00]乡间的歌谣永远的依靠
[01:12.00]回家吧 回到最初的美好`;

const UI_STORE_FIXTURE = {
  state: {
    currentView: "player",
    themeMode: "dark",
    themeColors: THEME_COLORS,
    isDynamicTheme: false,
  },
  version: 2,
};

const PLAYER_STORE_FIXTURE = {
  state: {
    currentSong: {
      // A display-only fixture with a local source and a tiny inline WAV. This
      // stops MultiSourceResolver from substituting a remote stream while still
      // satisfying hasPlayableAudioSource (no inline "audio unavailable" panel).
      id: "s3-2-fixture-daoxiang",
      title: "稻香",
      artist: "周杰伦",
      album: "魔杰座",
      cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=600&fit=crop",
      audioUrl: createSilentWavDataUrl(),
      duration: 223,
      source: "local",
      lyrics: DEMO_LYRICS,
    },
    volume: 0.7,
    isMuted: false,
    playbackRate: 1,
    loopMode: "none",
  },
  version: 0,
};

function usage() {
  console.log(
    [
      "Usage: node scripts/perf/capture-s3-2-screenshots.mjs [options]",
      "",
      "Options:",
      "  --base-url <url>     Dev server URL (default: " + DEFAULT_BASE_URL + ")",
      "  --out <dir>          Output directory, relative to cwd (default: " + DEFAULT_OUT_DIR + ")",
      "  --chrome-path <p>    Chrome executable (default: " + DEFAULT_CHROME_PATH + ")",
      "  --timeout <ms>       Navigation / selector timeout (default: " + DEFAULT_TIMEOUT_MS + ")",
      "  --help               Show this help",
      "",
      "Outputs:",
      "  home-1440x900.png",
      "  player-1440x900.png",
      "  lyrics-fullscreen-1440x900.png",
      "  manifest.json",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    outDir: DEFAULT_OUT_DIR,
    chromePath: DEFAULT_CHROME_PATH,
    timeout: DEFAULT_TIMEOUT_MS,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inlineValue = eq >= 0 ? arg.slice(eq + 1) : undefined;
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      i += 1;
      if (i >= argv.length) throw new Error("Missing value for " + key);
      return argv[i];
    };
    if (key === "--base-url") options.baseUrl = takeValue();
    else if (key === "--out") options.outDir = takeValue();
    else if (key === "--chrome-path") options.chromePath = takeValue();
    else if (key === "--timeout") options.timeout = Number(takeValue());
    else if (key === "--help" || key === "-h") options.help = true;
    else throw new Error("Unknown argument: " + arg);
  }
  if (!Number.isFinite(options.timeout) || options.timeout <= 0) {
    throw new Error("--timeout must be a positive number of milliseconds");
  }
  return options;
}

function gitValue(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function ensureChrome(chromePath) {
  if (!fs.existsSync(chromePath)) {
    throw new Error(
      "Chrome executable not found at " + chromePath + ". Pass --chrome-path or set CHROME_PATH."
    );
  }
}

async function preflight(baseUrl, timeout) {
  let response;
  try {
    response = await fetch(baseUrl, { signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    throw new Error(
      "Dev server is not reachable at " +
        baseUrl +
        " (" +
        (error && error.message ? error.message : String(error)) +
        "). Start it first, e.g. node node_modules/next/dist/bin/next dev --webpack -p 3037."
    );
  }
  if (!response.ok) {
    throw new Error("Dev server at " + baseUrl + " returned HTTP " + response.status);
  }
}

async function openApp(browser, options, fixture) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    locale: "zh-CN",
  });
  if (fixture) {
    await context.addInitScript((payload) => {
      window.localStorage.setItem("ui-store-v2", JSON.stringify(payload.uiStore));
      window.localStorage.setItem("player-store", JSON.stringify(payload.playerStore));
    }, fixture);
  }
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const bootstrapReady = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 30000);
    const onConsole = (message) => {
      if (message.text().includes("Application successfully bootstrapped")) {
        clearTimeout(timer);
        page.off("console", onConsole);
        resolve(true);
      }
    };
    page.on("console", onConsole);
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(options.baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: options.timeout,
  });
  await page.waitForSelector("main", { timeout: options.timeout });
  // Wait for the explicit hydration/bootstrap sequence to finish; clicking the
  // lyrics surface while stores are still hydrating can race a state reset.
  await bootstrapReady;
  // Hide the Next.js dev indicator only; app UI is untouched.
  await page
    .addStyleTag({ content: "nextjs-portal { display: none !important; }" })
    .catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  return { context, page, consoleErrors, pageErrors };
}

async function capture(page, outDir, name) {
  const file = path.join(outDir, name + ".png");
  await page.screenshot({
    path: file,
    type: "png",
    animations: "disabled",
    caret: "hide",
  });
  return {
    file,
    bytes: fs.statSync(file).size,
    sha256: sha256(file),
    capturedAt: new Date().toISOString(),
  };
}

function failOnPageErrors(view, pageErrors) {
  if (pageErrors.length > 0) {
    throw new Error(
      view + " produced uncaught page errors:\n" + pageErrors.map((e) => "  - " + e).join("\n")
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  ensureChrome(options.chromePath);
  await preflight(options.baseUrl, options.timeout);

  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    channel: "chrome",
    executablePath: options.chromePath,
    headless: true,
  });

  const views = [];
  const collectedErrors = {};
  try {
    // 1. Home (fresh profile, default view).
    const home = await openApp(browser, options, null);
    const homeShot = await capture(home.page, outDir, "home-1440x900");
    failOnPageErrors("Home", home.pageErrors);
    collectedErrors.home = home.consoleErrors;
    views.push({
      name: "home",
      label: "Home View (default)",
      route: "/",
      state: "fresh browser profile; no localStorage seed; currentView defaults to home",
      ...homeShot,
    });
    await home.context.close();

    // 2. Player (persisted currentView=player + demo current song).
    const player = await openApp(browser, options, {
      uiStore: UI_STORE_FIXTURE,
      playerStore: PLAYER_STORE_FIXTURE,
    });
    const playerShot = await capture(player.page, outDir, "player-1440x900");
    failOnPageErrors("Player", player.pageErrors);
    collectedErrors.player = player.consoleErrors;
    views.push({
      name: "player",
      label: "Player View",
      route: "/",
      state:
        "localStorage ui-store-v2 currentView=player (persist envelope v2) + player-store currentSong fixture (稻香 / LRC demo fixture)",
      ...playerShot,
    });

    // 3. Fullscreen lyrics (opened from the Player lyrics panel).
    const lyricsTrigger = player.page.locator('[title="点击进入全屏歌词"]');
    await lyricsTrigger.waitFor({ state: "visible", timeout: options.timeout });
    await lyricsTrigger.click({ timeout: options.timeout });
    // .fullscreen-lyrics-root itself is a 0x0 flex item; its fixed inset-0
    // child is the actual full-viewport surface, so wait on the child.
    await player.page
      .locator(".fullscreen-lyrics-root > .fixed")
      .waitFor({ state: "visible", timeout: options.timeout });
    await player.page.waitForTimeout(1500);
    const lyricsShot = await capture(player.page, outDir, "lyrics-fullscreen-1440x900");
    failOnPageErrors("Fullscreen lyrics", player.pageErrors);
    collectedErrors["lyrics-fullscreen"] = player.consoleErrors;
    views.push({
      name: "lyrics-fullscreen",
      label: "Fullscreen Lyrics View",
      route: "/",
      state: "same state as Player, then click [title=点击进入全屏歌词] → .fullscreen-lyrics-root",
      ...lyricsShot,
    });
    await player.context.close();

    const manifest = {
      task: "S3-2 D7 protected-view screenshots",
      capturedAt: new Date().toISOString(),
      baseUrl: options.baseUrl,
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      browser: {
        channel: "chrome",
        executablePath: options.chromePath,
        version: browser.version(),
      },
      runtime: {
        node: process.version,
        playwright: "1.64.1",
      },
      git: {
        branch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
        commit: gitValue(["rev-parse", "HEAD"]),
      },
      views: views.map((view) => ({
        name: view.name,
        label: view.label,
        route: view.route,
        state: view.state,
        file: path.relative(process.cwd(), view.file).split(path.sep).join("/"),
        bytes: view.bytes,
        sha256: view.sha256,
        capturedAt: view.capturedAt,
        consoleErrorCount: collectedErrors[view.name].length,
      })),
      notes: [
        "Fixed viewport 1440x900 at deviceScaleFactor 1.",
        "The Next.js dev indicator is hidden with CSS; application UI is not modified.",
        "Player/lyrics use a deterministic demo-song fixture (稻香, LRC from src/services/lyricsSearchService.ts) so protected surfaces show content on a fresh profile.",
        "Console errors are recorded, not fatal; the dev-mode app may log external demo-asset/API network failures.",
      ],
    };
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

    console.log("Captured " + views.length + " protected views in " + outDir);
    for (const view of views) {
      console.log(
        "  " +
          path.basename(view.file) +
          "  " +
          view.bytes +
          " bytes  sha256=" +
          view.sha256 +
          "  consoleErrors=" +
          collectedErrors[view.name].length
      );
    }
    console.log("Manifest: " + path.join(outDir, "manifest.json"));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[capture-s3-2] " + (error && error.stack ? error.stack : String(error)));
  process.exitCode = 1;
});
