/**
 * @deprecated 2026-10-21: unwired coordinator shell (0 imports outside this directory).
 * Kept for one release per AGENTS.md "不要删除不确定的代码"; do not import.
 * Replaced by the S6 domain use-cases + typed events (src/domain, src/lib/events).
 * Reference: docs/nbl/plans/2026-10-21-arch-perf-execution/S6-state-architecture.md
 */
export { audioCoordinator } from "./audioCoordinator";
export { queueCoordinator } from "./queueCoordinator";
export type { AudioCoordinator, QueueCoordinator, EmotionCoordinator } from "./types";
