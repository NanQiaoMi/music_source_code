#!/usr/bin/env node
// CI helper: run vitest and surface failures as GitHub Actions annotations.
// Job logs are not downloadable without repo admin, so parse the stream instead.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

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
      if (lines.length > 400) lines.shift();
    }
  });
  stream.on("end", () => {
    if (buffer) lines.push(buffer);
  });
};
forward(child.stdout, process.stdout);
forward(child.stderr, process.stderr);
const annotate = (level, line) => {
  const text = line.replace(/[\r\n]+/g, " ").slice(0, 900);
  if (!text.trim()) return;
  console.log("::" + level + "::" + text);
};
child.on("close", (code, signal) => {
  if (code !== 0 || signal) {
    const interesting = lines.filter((line) =>
      /(FAIL|AssertionError|Error:|×|failed|Unhandled|heap out of memory|Cannot find)/i.test(line)
    );
    for (const line of interesting.slice(-40)) annotate("error", line);
    annotate("error", "vitest exited " + (code ?? signal) + "; tail: " + lines.slice(-8).join(" | "));
  }
  process.exit(code ?? 1);
});
