// S6-11c store graph: runtime store-to-store imports among top-level src/store modules must stay
// acyclic (Tarjan SCC = 0) and within the recorded edge ratchet. The scan runs at test time with the
// same scope as scripts/check-store-budgets.mjs; `import type` and `{ type X }` specifiers are ignored.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STORE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/**
 * 2026-10-29 snapshot: 28 runtime edges.
 * S1-5 并入 queueNavigation（导航状态入口）后 +2：queueNavigation -> playerStore / queueStore。
 * 其余 26 条来源：S6-6a toast、S6-6b panel、S6-6c shell、S6-7 theme、S6-8b achievements->toast。
 */
const EDGE_BUDGET = 28;

/** Documented reason for every runtime edge; a new edge must add an entry (and lower the budget). */
const RUNTIME_EDGE_REASONS: Readonly<Record<string, string>> = {
  "audioStore -> playerStore": "播放状态/曲目单向投影到 player 运行时镜像",
  "audioStore -> queueStore": "队列推进读取 queueStore 唯一事实源",
  "emotionStore -> aiStore": "情感分析结果写入 AI store",
  "healthCheckStore -> libraryHealthStore": "健康报告聚合 libraryHealth",
  "healthCheckStore -> playlistStore": "库扫描读取 playlist songs",
  "knowledgeStore -> aiStore": "知识卡片读取 AI 配置",
  "linerNotesStore -> aiStore": "AI 生成内页笔记",
  "playerStore -> playbackRuntimeStore": "播放请求写入 runtime",
  "queueNavigation -> playerStore": "S1-5 QueueNavigator 读取 loopMode（play-through/single 策略）",
  "queueNavigation -> queueStore":
    "S1-5 QueueNavigator 是 currentIndex 的唯一写入口（队列单一权威）",
  "sleepTimerStore -> audioStore": "定时停止调用 audio 播放控制",
  "smartMixStore -> playlistGroupStore": "混音会话读取分组",
  "smartMixStore -> queueStore": "混音会话装载队列",
  "smartPlaylistStore -> queueStore": "智能歌单装载队列",
  "smartPlaylistStore -> statsAchievementsStore": "规则评估读取统计",
  "sourceConfigStore -> userAccountStore": "音源配置读取账号权限",
  "useAIAgentStore -> aiStore": "Agent 会话读写 AI 配置",
  "useAIAgentStore -> audioStore": "Agent 工具控制播放",
  "useAIAgentStore -> emotionStore": "Agent 读取情感矩阵",
  "useAIAgentStore -> favoritesStore": "Agent 管理收藏",
  "useAIAgentStore -> playerStore": "Agent 读取当前曲目",
  "useAIAgentStore -> panelStore": "Agent 打开面板（S6-6b 后唯一 owner 是 panelStore）",
  "statsAchievementsStore -> toastStore":
    "S6-8b 成就 toast 并入唯一 owner；stats store 只负责解锁事实，不再自持队列/定时器",
  "uiStore -> toastStore": "S6-6a toast 兼容 facade 转发到唯一 owner",
  "uiStore -> panelStore": "S6-6b panel 兼容 facade 转发到唯一 owner（镜像在 uiStore 侧）",
  "uiStore -> uiShellStore":
    "S6-6c 壳域唯一 owner；uiStore 只保留 currentView 持久化投影与 deprecated 转发器",
  "uiStore -> themeStore":
    "S6-7 主题唯一 owner；uiStore 只保留 ui-store-v2 持久化投影、hydrate 回灌与 deprecated 转发器",
  "useAIAgentStore -> useOfflineDownloadStore": "Agent 触发离线下载",
};

type Edge = { readonly from: string; readonly to: string };
const label = (edge: Edge): string => edge.from + " -> " + edge.to;

const IMPORT_RE = /^import\s+(type\s+)?([\s\S]*?)from\s+["']([^"']+)["']/gm;

function isTypeOnly(clause: string): boolean {
  const runtime = (specifier: string): boolean => {
    const s = specifier.trim();
    return s.length > 0 && !s.startsWith("type ");
  };
  const named = [...clause.matchAll(/\{([\s\S]*?)\}/g)].flatMap((match) => match[1].split(","));
  const rest = clause.replace(/\{[\s\S]*?\}/g, "").replace(/,/g, " ");
  return !runtime(rest) && !named.some(runtime);
}

/** Mirrors the scripts' scope: direct imports of top-level store modules only. */
function scanSource(from: string, source: string, stores: ReadonlySet<string>): Edge[] {
  const edges: Edge[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const target = /^(?:@\/store\/|\.\/)([A-Za-z0-9_]+)$/.exec(match[3])?.[1];
    if (!target || target === from || !stores.has(target)) continue;
    if (match[1] || isTypeOnly(match[2])) continue;
    edges.push({ from, to: target });
  }
  return edges;
}

const STORES: readonly string[] = readdirSync(STORE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.includes(".test."))
  .map((entry) => entry.name.slice(0, -3))
  .filter((name) => name !== "index.ts");
const STORE_SET = new Set(STORES);

function scanRepository(): Edge[] {
  return STORES.flatMap((name) =>
    scanSource(name, readFileSync(resolve(STORE_DIR, name + ".ts"), "utf8"), STORE_SET)
  );
}

/** Tarjan SCC; returns every component with more than one member (a runtime cycle). */
function stronglyConnected(edges: readonly Edge[], nodes: ReadonlySet<string>): string[][] {
  const graph = new Map([...nodes].map((node) => [node, [] as string[]]));
  for (const edge of edges) graph.get(edge.from)?.push(edge.to);
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const connect = (node: string): void => {
    indices.set(node, index);
    low.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!indices.has(next)) {
        connect(next);
        low.set(node, Math.min(low.get(node) ?? index, low.get(next) ?? index));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node) ?? index, indices.get(next) ?? index));
      }
    }
    if (low.get(node) !== indices.get(node)) return;
    const component: string[] = [];
    let member = stack.pop();
    while (member !== undefined) {
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
      member = stack.pop();
    }
    if (component.length > 1) components.push(component.sort());
  };
  for (const node of nodes) if (!indices.has(node)) connect(node);
  return components.sort();
}

describe("store graph contract (S6-11c)", () => {
  it("keeps every runtime edge documented and inside the ratchet", () => {
    const edges = scanRepository();
    const labels = edges.map(label).sort();
    expect(edges.length).toBeLessThanOrEqual(EDGE_BUDGET);
    expect(Object.keys(RUNTIME_EDGE_REASONS)).toHaveLength(EDGE_BUDGET);
    expect(labels.filter((edge) => !(edge in RUNTIME_EDGE_REASONS))).toEqual([]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("has no runtime store-to-store cycles (Tarjan SCC = 0)", () => {
    expect(stronglyConnected(scanRepository(), STORE_SET)).toEqual([]);
  });

  it("ignores type-only imports and still finds runtime edges", () => {
    const stores = new Set(["a", "b", "c", "d"]);
    const source = [
      'import type { A } from "./a";',
      'import { type B } from "./b";',
      'import { C, type D } from "./c";',
      'import * as d from "@/store/d";',
      'import { create } from "zustand";',
    ].join("\n");
    expect(scanSource("subject", source, stores).map(label)).toEqual([
      "subject -> c",
      "subject -> d",
    ]);
  });

  it("detects a synthetic cycle (positive control for the SCC scan)", () => {
    const nodes = new Set(["a", "b", "c"]);
    const edges: Edge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
      { from: "b", to: "c" },
    ];
    expect(stronglyConnected(edges, nodes)).toEqual([["a", "b"]]);
  });
});
