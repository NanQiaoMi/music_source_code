#!/usr/bin/env node
// CI helper: run vitest and surface real failures as GitHub Actions annotations.
// Job logs are not downloadable without repo admin, so parse the output stream.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const vitestBin = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
const args = process.argv.slice(2);
const child = spawn(process.execPath, [vitestBin, ...args], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});
const lines = [];
const forward = (stream, target) => {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    target.write(chunk);
    buffer += chunk;
    const parts = buffer.split(/\r?\n/);
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      lines.push(line);
      if (lines.length > 3000) lines.shift();
    }
  });
  stream.on("end", () => {
    if (buffer) lines.push(buffer);
  });
};
forward(child.stdout, process.stdout);
forward(child.stderr, process.stderr);

const clean = (line) => line.replace(/\u001b\[[0-9;]*m/g, "").replace(/[\r\n]+/g, " ").trim();
const annotate = (text) => {
  const value = clean(text).slice(0, 900);
  if (value) console.log("::error::" + value);
};
child.on("close", (code, signal) => {
  try { fs.writeFileSync("vitest-ci-output.log", lines.join("\n") + "\n"); } catch {}
  if (code !== 0 || signal) {
    const strong = lines.filter((line) =>
      /(^\s*FAIL\s|^\s*×\s|Failed Tests|AssertionError|Unhandled (Error|Rejection)|heap out of memory|Cannot find module|ERR_|Error occurred during test run|Test Files\s+.*failed|Tests\s+.*failed)/i.test(clean(line))
    );
    const picked = [];
    for (const line of strong) {
      const value = clean(line);
      if (value && !picked.includes(value)) picked.push(value);
      if (picked.length >= 8) break;
    }
    for (const value of picked) annotate(value);
    if (picked.length === 0) {
      for (const value of lines.slice(-6).map(clean).filter(Boolean)) annotate("tail: " + value);
    }
    annotate("vitest exited " + (code ?? signal) + " (full log: vitest-ci-output.log)");
  }
  process.exit(code ?? 1);
});
