/* eslint-env node */
// S8-6: docs/nbl/BACKLOG.md must stay a trigger-gated, reviewable long-term backlog.
// It pins the plan S8-6 items (L1-L10), a measurable trigger per row, resolvable plan
// links, and the quarterly review loop. Breaking any of those fails the full suite.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rel = "docs/nbl/BACKLOG.md";
const doc = fs.readFileSync(path.join(root, rel), "utf8");
const lines = doc.split(/\r?\n/);

const headerAt = lines.findIndex((line) => /^\|\s*ID\s*\|/i.test(line));
const header =
  headerAt < 0
    ? []
    : lines[headerAt]
        .split("|")
        .slice(1, -1)
        .map((cell) =>
          cell
            .replace(/（[^）]*）/g, "")
            .trim()
            .toLowerCase()
        );
const rows =
  headerAt < 0
    ? []
    : lines
        .slice(headerAt + 2)
        .filter((line) => line.trim().startsWith("|"))
        .map((line) =>
          line
            .split("|")
            .slice(1, -1)
            .map((cell) => cell.trim())
        );
const col = (name) => header.indexOf(name);
const cell = (row, name) => row[col(name)] ?? "";
const rowText = (row) => row.join(" ");

// Plan S8-6 lists L1-L10; L11/L12 are items other phase plans explicitly filed here.
const PLAN_ITEMS = Array.from({ length: 10 }, (_, i) => "L" + (i + 1));

const TOPICS = [
  ["features 领域化", /features/i],
  ["14 个效果插件化", /14\s*个?\s*效果/],
  ["EffectPlugin 契约", /EffectPlugin|插件化/],
  ["4K 适配", /4K/i],
  ["低端设备", /低端/],
  ["E2E 套件", /E2E|Playwright/i],
  ["OPFS", /OPFS/i],
  ["mutation testing", /mutation|Stryker/i],
  ["依赖升级", /依赖升级/],
  ["质量看板", /看板/],
  ["仓库卫生", /仓库卫生|\bGC\b/],
  ["安全审计", /沙箱|安全审计/],
];

describe("docs/nbl/BACKLOG.md", () => {
  it("has the expected table header and 10+ backlog rows", () => {
    expect(header).toEqual(["id", "事项", "理由", "触发条件", "优先级", "owner", "计划链接"]);
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) expect(row, row.join(" | ")).toHaveLength(header.length);
  });

  it("covers every plan S8-6 item L1-L10 with unique ids", () => {
    const ids = rows.map((row) => cell(row, "id"));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^L\d+$/);
    for (const id of PLAN_ITEMS) expect(ids, "missing " + id).toContain(id);
  });

  it("gives every row a measurable trigger, not a placeholder", () => {
    const PLACEHOLDER = /^(?:tbd|todo|待定|无|—|-|n\/a)$/i;
    for (const row of rows) {
      const trigger = cell(row, "触发条件");
      expect(trigger.length, "empty trigger in " + cell(row, "id")).toBeGreaterThan(0);
      expect(PLACEHOLDER.test(trigger), cell(row, "id") + " placeholder trigger").toBe(false);
      // Measurable = a number or a comparison operator, e.g. ">=65%" or "连续 14 天".
      expect(trigger, cell(row, "id") + " has no measurable signal").toMatch(/\d|≥|≤|>|</);
    }
  });

  it("gives every row a rationale, priority and owner placeholder", () => {
    for (const row of rows) {
      const id = cell(row, "id");
      expect(cell(row, "事项").length, id + " item").toBeGreaterThan(3);
      expect(cell(row, "理由").length, id + " rationale").toBeGreaterThan(10);
      expect(["P1", "P2", "P3"], id + " priority").toContain(cell(row, "优先级"));
      expect(cell(row, "owner").length, id + " owner").toBeGreaterThan(0);
      expect(cell(row, "owner"), id + " owner must stay a placeholder").toMatch(/^(?:TBD|待定)/i);
    }
  });

  it("mentions every required long-term topic inside a table row", () => {
    for (const [topic, pattern] of TOPICS) {
      const hit = rows.some((row) => pattern.test(rowText(row)));
      expect(hit, "topic missing from table rows: " + topic).toBe(true);
    }
  });

  it("links every row to plan sections that exist", () => {
    const linkRe = /\]\(([^)\s]+)\)/g;
    for (const row of rows) {
      const links = [...cell(row, "计划链接").matchAll(linkRe)].map((match) => match[1]);
      expect(links.length, cell(row, "id") + " has no plan link").toBeGreaterThan(0);
      for (const link of links) {
        const target = path.resolve(path.join(root, "docs", "nbl"), link.split("#")[0]);
        expect(fs.existsSync(target), cell(row, "id") + " broken link: " + link).toBe(true);
      }
    }
  });

  it("documents the quarterly review loop, including the archive rule", () => {
    const section = doc.slice(doc.search(/##\s.*季度评审|##\s.*quarterly/i));
    expect(section).not.toBe("");
    for (const token of ["每季度", "触发条件", "quarterly-YYYY-QN", "归档"]) {
      expect(section, "quarterly section missing: " + token).toContain(token);
    }
  });

  it("is reachable from the ROADMAP and PROCESS entry points", () => {
    for (const entry of ["docs/nbl/ROADMAP.md", "docs/nbl/PROCESS.md"]) {
      const file = path.join(root, entry);
      if (!fs.existsSync(file)) continue;
      expect(fs.readFileSync(file, "utf8"), entry + " does not link BACKLOG.md").toContain(
        "BACKLOG.md"
      );
    }
  });
});
