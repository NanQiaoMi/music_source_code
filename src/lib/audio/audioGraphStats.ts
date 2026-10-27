/**
 * S2-3: 音频图节点生命周期计数（dev 探针 + 单测断言）。
 *
 * 这里只保存计数，不持有 AudioNode 引用——强引用会阻止节点被回收，反而制造泄漏。
 * resetAudioGraphStats() 之后 activeNodes 表示「自 reset 以来的净新增节点数」，
 * E7 验收（100 次切歌）即断言该 delta 为 0。
 */
export type AudioGraphNodeKind = "graph" | "media-source" | "crossfade-gain";

type NodeCounts = Record<AudioGraphNodeKind, number>;

const KINDS: AudioGraphNodeKind[] = ["graph", "media-source", "crossfade-gain"];

function emptyCounts(): NodeCounts {
  return { graph: 0, "media-source": 0, "crossfade-gain": 0 };
}

const created: NodeCounts = emptyCounts();
const released: NodeCounts = emptyCounts();
let pendingCrossfadeTimers = 0;

export interface AudioGraphStats {
  /** 自上次 reset 以来新建的节点数。 */
  createdNodes: number;
  /** 自上次 reset 以来释放的节点数。 */
  releasedNodes: number;
  /** createdNodes - releasedNodes：delta 视图，不是绝对存活数。 */
  activeNodes: number;
  mediaSourceNodes: number;
  crossfadeGainNodes: number;
  pendingCrossfadeTimers: number;
}

export function recordNodesCreated(kind: AudioGraphNodeKind, count = 1): void {
  if (count <= 0) return;
  created[kind] += count;
}

export function recordNodesReleased(kind: AudioGraphNodeKind, count = 1): void {
  if (count <= 0) return;
  released[kind] += count;
}

export function recordPendingCrossfadeTimers(count: number): void {
  pendingCrossfadeTimers = Math.max(0, count);
}

export function getAudioGraphStats(): AudioGraphStats {
  const activeByKind = emptyCounts();
  let createdNodes = 0;
  let releasedNodes = 0;

  for (const kind of KINDS) {
    activeByKind[kind] = created[kind] - released[kind];
    createdNodes += created[kind];
    releasedNodes += released[kind];
  }

  return {
    createdNodes,
    releasedNodes,
    activeNodes: createdNodes - releasedNodes,
    mediaSourceNodes: activeByKind["media-source"],
    crossfadeGainNodes: activeByKind["crossfade-gain"],
    pendingCrossfadeTimers,
  };
}

export function resetAudioGraphStats(): void {
  for (const kind of KINDS) {
    created[kind] = 0;
    released[kind] = 0;
  }
  pendingCrossfadeTimers = 0;
}

type AudioGraphStatsWindow = Window & {
  __audioGraphStats?: {
    getSnapshot: typeof getAudioGraphStats;
    reset: typeof resetAudioGraphStats;
  };
};

// dev-only 探针：__audioGraphStats.getSnapshot() / .reset()；测试环境不挂 window。
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const statsWindow = window as AudioGraphStatsWindow;
  if (!statsWindow.__audioGraphStats) {
    statsWindow.__audioGraphStats = {
      getSnapshot: getAudioGraphStats,
      reset: resetAudioGraphStats,
    };
  }
}
