import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts", "check-store-budgets.mjs");
const temps = [];
const lines = (n) => Array.from({ length: n }, (_, i) => `// line ${i + 1}`).join("\n") + "\n";
const write = (dir, rel, text) => { const file = path.join(dir, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const fixture = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "store-budgets-"));
  temps.push(dir);
  for (const [rel, text] of Object.entries(files)) write(dir, rel, text);
  return dir;
};
const run = (dir, ...args) => spawnSync(process.execPath, [SCRIPT, "--root", dir, ...args], { encoding: "utf8" });
afterEach(() => temps.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe("check-store-budgets ratchet", () => {
  it("passes against the real repo with SCC 0", () => {
    const result = run(process.cwd());
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("PASS");
    expect(result.stdout).toContain("SCC 0");
  });

  it("requires --update before creating a baseline", () => {
    const dir = fixture({ "src/store/a.ts": lines(10) });
    const missing = run(dir);
    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain("missing");
    expect(fs.existsSync(path.join(dir, "perf", "store-line-baseline.json"))).toBe(false);
    expect(run(dir, "--update").status).toBe(0);
    expect(run(dir).status).toBe(0);
  });

  it("fails when a baselined file grows or a new file exceeds 400 lines", () => {
    const dir = fixture({ "src/store/a.ts": lines(10), "src/store/b.ts": lines(5) });
    expect(run(dir, "--update").status).toBe(0);
    write(dir, "src/store/a.ts", lines(12));
    let result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("a.ts: 12 lines > baseline 10");
    write(dir, "src/store/c.ts", lines(401));
    result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("hard cap 400 (new file)");
  });

  it("is shrink-only on --update and lowers the baseline", () => {
    const dir = fixture({ "src/store/a.ts": lines(10) });
    expect(run(dir, "--update").status).toBe(0);
    write(dir, "src/store/a.ts", lines(8));
    expect(run(dir).status).toBe(0);
    expect(run(dir, "--update").status).toBe(0);
    const baseline = JSON.parse(fs.readFileSync(path.join(dir, "perf", "store-line-baseline.json"), "utf8"));
    expect(baseline.files["src/store/a.ts"]).toBe(8);
    write(dir, "src/store/a.ts", lines(12));
    expect(run(dir, "--update").status).toBe(1);
  });

  it("fails on runtime store cycles and ignores type-only imports", () => {
    const dir = fixture({
      "src/store/a.ts": 'import { b } from "./b";\nexport const a = b;\n',
      "src/store/b.ts": 'import type { A } from "./a";\nexport type B = A;\nexport const b = 1;\n',
    });
    expect(run(dir, "--update").status).toBe(0);
    expect(run(dir).status).toBe(0);
    write(dir, "src/store/b.ts", 'import { a } from "./a";\nexport const b = a;\n');
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("runtime store cycle");
  });
});
