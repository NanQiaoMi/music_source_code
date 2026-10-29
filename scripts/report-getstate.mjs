#!/usr/bin/env node
/**
 * S6-10 getState 分层报告 + 层级棘轮。
 * 口径：src 下非测试 .ts/.tsx 中 `useXxxStore.getState(` 的出现次数（与 report-store-stats 的 getStateByLayer 一致）。
 * 用法：node scripts/report-getstate.mjs [--json <path>] [--check]
 *  --json   写完整报告（byLayer / 逐文件计数）。
 *  --check  读 perf/getstate-baseline.json：按层校验 targets.<layer> 与 allowed.<layer>[file]。
 *           S6-10a 已收敛 services=0；S6-10b 收敛 components=0；S6-9c 收敛 lib=5
 *           （bootstrap / gesture 白名单，理由见 baseline.allowedRationale）；
 *           S6-9d 收敛 hooks=0（全部改为 selector 订阅或 store/actions 动作层入口）。store 仍只报告。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const BASELINE_FILE = path.join(ROOT, "perf", "getstate-baseline.json");
const LAYERS = ["app", "components", "hooks", "lib", "services", "store", "domain"];
const RATCHET_LAYERS = ["services", "components", "lib", "hooks"];
const GETSTATE_RE = /use[A-Z][A-Za-z0-9_]*Store\.getState\(/g;
const args = process.argv.slice(2);
const jsonIdx = args.indexOf("--json");
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.|\.spec\./.test(entry.name))
      out.push(full);
  }
  return out;
};

const files = walk(SRC);
const byLayer = Object.fromEntries(LAYERS.map((layer) => [layer, 0]));
const byFile = {};
let total = 0;
for (const file of files) {
  const count = (fs.readFileSync(file, "utf8").match(GETSTATE_RE) || []).length;
  if (count === 0) continue;
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const layer = rel.split("/")[1] || "other";
  byFile[rel] = count;
  byLayer[layer] = (byLayer[layer] || 0) + count;
  total += count;
}
const layerFiles = (layer) =>
  Object.fromEntries(
    Object.entries(byFile)
      .filter(([file]) => file.startsWith(`src/${layer}/`))
      .sort()
  );
const report = {
  metric: "useXStore.getState() calls in non-test src files",
  generatedAt: new Date().toISOString(),
  totals: { getState: total, files: Object.keys(byFile).length },
  byLayer,
  ...Object.fromEntries(
    RATCHET_LAYERS.map((layer) => [
      layer,
      {
        total: byLayer[layer] || 0,
        files: layerFiles(layer),
        scanned: files.filter((f) => f.split(path.sep).includes(layer)).length,
      },
    ])
  ),
  files: byFile,
};

console.log(
  JSON.stringify(
    {
      totals: report.totals,
      byLayer,
      ...Object.fromEntries(RATCHET_LAYERS.map((layer) => [layer, report[layer]])),
    },
    null,
    2
  )
);
if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, jsonOut)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, jsonOut), JSON.stringify(report, null, 2) + "\n");
  console.log("[getstate] wrote " + jsonOut);
}

if (args.includes("--check")) {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
  const targets = baseline.targets ?? {};
  const allowed = baseline.allowed ?? {};
  const violations = [];
  for (const layer of RATCHET_LAYERS) {
    const target = targets[layer] ?? 0;
    const allowedFiles = allowed[layer] ?? {};
    const current = report[layer];
    if (current.total > target) {
      violations.push(`${layer} total ${current.total} > target ${target}`);
    }
    for (const [file, count] of Object.entries(current.files)) {
      const cap = allowedFiles[file] ?? 0;
      if (count > cap) violations.push(`${file}: ${count} > allowed ${cap}`);
    }
  }
  if (violations.length > 0) {
    console.error("FAIL: getState ratchet exceeded:\n  " + violations.join("\n  "));
    process.exit(1);
  }
  console.log(
    "OK: " +
      RATCHET_LAYERS.map((layer) => `${layer} ${report[layer].total}/${targets[layer] ?? 0}`).join(
        ", "
      ) +
      " (allowed files: " +
      RATCHET_LAYERS.map((layer) => Object.keys(allowed[layer] ?? {}).length).join("/") +
      ")"
  );
}
