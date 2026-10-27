#!/usr/bin/env node
/**
 * 同步 MediaPipe Tasks Vision 本地资产。
 *
 * 手势识别默认从 public/mediapipe 加载 WASM 与 hand_landmarker.task，
 * 这样 Electron / 离线环境 / 国内网络都不依赖 CDN。运行：
 *
 *   npm run sync:mediapipe
 *
 * 参数：
 *   --force     强制重新下载模型
 *   --optional  失败只警告（供 prebuild 使用，缺资产时运行时回退 CDN）
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE_WASM_DIR = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const TARGET_ROOT = path.join(ROOT, "public", "mediapipe");
const TARGET_WASM_DIR = path.join(TARGET_ROOT, "wasm");
const TARGET_MODEL_DIR = path.join(TARGET_ROOT, "models");
const TARGET_MODEL = path.join(TARGET_MODEL_DIR, "hand_landmarker.task");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const EXPECTED_MODEL_BYTES = 7819105;

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const optional = args.has("--optional");

function log(message) {
  console.log("[mediapipe-assets] " + message);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyWasmAssets() {
  if (!(await exists(SOURCE_WASM_DIR))) {
    throw new Error(
      "找不到 node_modules/@mediapipe/tasks-vision/wasm，请先执行 npm install"
    );
  }

  await mkdir(TARGET_WASM_DIR, { recursive: true });
  const entries = ["vision_wasm_internal.js", "vision_wasm_internal.wasm"];
  const optionalEntries = [
    "vision_wasm_module_internal.js",
    "vision_wasm_module_internal.wasm",
    "vision_wasm_nosimd_internal.js",
    "vision_wasm_nosimd_internal.wasm",
  ];
  let copied = 0;
  for (const entry of [...entries, ...optionalEntries]) {
    const source = path.join(SOURCE_WASM_DIR, entry);
    if (!(await exists(source))) continue;
    await copyFile(source, path.join(TARGET_WASM_DIR, entry));
    copied += 1;
  }
  if (copied === 0) {
    throw new Error("node_modules 中的 MediaPipe wasm 目录为空");
  }
  log("已复制 " + copied + " 个 wasm 资源 → public/mediapipe/wasm");
}

async function downloadModel() {
  if (!force && (await exists(TARGET_MODEL))) {
    const size = (await stat(TARGET_MODEL)).size;
    if (size === EXPECTED_MODEL_BYTES) {
      log("模型已存在，跳过下载（" + size + " bytes）");
      return;
    }
    log("模型大小异常（" + size + " bytes），重新下载");
  }

  await mkdir(TARGET_MODEL_DIR, { recursive: true });
  log("下载 hand_landmarker.task …");
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error("下载模型失败：HTTP " + response.status);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 1_000_000) {
    throw new Error("下载模型失败：文件过小（" + buffer.byteLength + " bytes）");
  }
  await writeFile(TARGET_MODEL, buffer);
  const digest = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  log(
    "模型已保存 → public/mediapipe/models/hand_landmarker.task（" +
      buffer.byteLength +
      " bytes, sha256:" +
      digest +
      "…）"
  );

  // 记录来源，方便排查版本差异。
  await writeFile(
    path.join(TARGET_MODEL_DIR, "hand_landmarker.source.json"),
    JSON.stringify({ url: MODEL_URL, bytes: buffer.byteLength, sha256: digest }, null, 2) + "\n",
    "utf8"
  );
}

async function main() {
  await copyWasmAssets();
  await downloadModel();
  log("完成。运行时优先加载 /mediapipe，缺失时回退固定版本 CDN。");
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (optional) {
    console.warn("[mediapipe-assets] 警告：" + message + "（将回退 CDN）");
    process.exitCode = 0;
    return;
  }
  console.error("[mediapipe-assets] " + message);
  process.exitCode = 1;
});
