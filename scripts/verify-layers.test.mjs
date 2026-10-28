/* eslint-env node */
// S6-12a: runs dependency-cruiser with the same command as `npm run verify:layers` so the
// layering gate fails in the unit-test job too (the workflow also runs it as its own step).
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const require = createRequire(import.meta.url);
const config = require("../.dependency-cruiser.cjs");
const CLI = path.join(root, "node_modules", "dependency-cruiser", "bin", "dependency-cruiser.mjs");

function cruise(...args) {
  return spawnSync(process.execPath, [CLI, "src", "--config", ".dependency-cruiser.cjs", ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("dependency-cruiser layering gate (S6-12a)", () => {
  it("passes with 0 errors (npm run verify:layers)", () => {
    const result = cruise("--output-type", "err");
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }, 120000);

  it("keeps no-circular enforced as an error", () => {
    const circular = config.forbidden.find((rule) => rule.name === "no-circular");
    expect(circular).toBeDefined();
    expect(circular.severity).toBe("error");
    expect(circular.to).toMatchObject({ circular: true });
  });

  it("keeps the directional layering rules in the config", () => {
    const names = config.forbidden.map((rule) => rule.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "store-must-not-import-ui",
        "services-must-not-import-components",
        "lib-must-not-import-ui",
        "domain-must-not-import-ui",
        "domain-must-not-import-store",
        "no-dev-dependencies-in-src",
      ])
    );
  });
});
