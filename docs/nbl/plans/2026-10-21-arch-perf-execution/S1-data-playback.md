# S1 数据与播放正确性 — 执行计划

> 上级计划：[架构与性能优化总计划](../2026-10-21-architecture-performance-optimization.md) §5 S1 / §7.3 / §9.2
> 执行包：[README](./README.md) · [决策记录](./00-decisions.md) · [进度看板](./TRACKING.md) · [S0](./S0-baseline.md)
> 阶段：S1（10 个任务，约 15 个子 PR）；预估：1.5-2 周（单人）；状态：**未开始**
> 前置：S0 出口门 M0 通过（干净基线、CI required、测量脚本、D4/D7 决策）
> 规划快照：feature/gesture-air-control-overhaul @ `c73a872`（脏树）；实施必须从 S0-1 后的干净分支开始
> 规范依据：PROCESS.md:131-134（≤400 行/PR）、总计划 §1.3 不变量、审计 A/C/D 与前置审计 A01/A02/A12

---

## 1. 阶段目标与出口条件

**目标**：把用户可感知的数据丢失、播错歌、本地音源不可播、监听丢失、设备切换不恢复、切歌无取消全部修掉，并用自动化回归证明。

| 出口 | 指标 | 现状（已核实证据） | 目标 | 验证 |
|---|---|---|---|---|
| E1-1 数据不丢 | persist key 注册覆盖 | 44 key 无注册表；启动压缩 200→50、30→20（safeStorage.ts:105,110） | 44/44 注册；200/200 队列、30/30 历史、index=199 原样保留 | S1-1/S1-3 fixture 测试 |
| E1-2 备份可恢复 | 备份→恢复→重载闭环 | 10 槽位中 5 个 key 错配（backupRestoreStore.ts:219-232,313-330）；恢复后不 rehydrate | v5 schema；有效 8 key 全恢复；旧 v4 备份可导入；不支持槽位明确提示；body 泄漏=0 | S1-2 单测 + S1-10 场景 |
| E1-3 本地音源 | 同一 IDB 版本 | localMusicService.ts:8 用 v1、localMusicStorage.ts:7 用 v2 同库 → VersionError 被吞（:42） | 统一 open v3；v1/v2→v3 迁移保数据；local:// 导入→刷新→可播 | S1-4 迁移测试 + 场景 |
| E1-4 队列唯一 | 队列写 owner | audioStore.queue/currentIndex（audioStore.ts:77-78）与 queueStore（queueStore.ts:128-348）双权威 | queueStore 唯一可写；audioStore 只读投影；删/排/清后 next/ended 一致 | S1-5 + S1-10 场景 1 |
| E1-5 媒体事件单例 | 监听 owner | 每个 hook 实例 attach/detach 共享元素（useAudioPlayer.ts:396-400,941-981,1248-1288） | 唯一 bridge；多实例交错挂载/卸载 ended/timeupdate 仍分发 | S1-6 + 场景 4 |
| E1-6 设备恢复 | watchdog 生效 | start 先于懒创建 context → 不挂载（AudioContextWatchdog.ts:29-46）；stop 不摘监听（:143-153） | start 幂等 + context 创建回调挂载；stop 摘除全部监听 | S1-7 |
| E1-7 请求可取消 | AbortSignal 贯穿 | 无 AbortController，仅 requestId 丢弃（useAudioPlayer.ts:106-149；resolver 仅 timeout 信号 MultiSourceResolver.ts:406-407） | 连点 5 首仅 1 in-flight；旧结果不写 store；旧请求被 abort | S1-8 + 场景 6 |
| E1-8 首声更快 | firstSound（缓存命中） | 串行 3 次 IDB + resolver（useAudioPlayer.ts:1407→1531），最坏 >5s | P50 <300ms / P95 <800ms（命中）；冷启动 P95 <2.5s | S1-9 + perf 证据 |
| E1-9 回归网 | 场景自动化 | 总计划 §9.2 全人工 | 6 个集成测试文件 / ≥20 用例全绿，覆盖 §9.2 全部场景 | S1-10 |

**出口门（M1）**：E1-1..E1-9 全部满足；总计划 §9.2 的 8 类场景全部有自动化断言（真机设备切换仅 mock + 手工 smoke 记录）；旧 key/旧备份 fixture 通过；无已知静默丢数据路径。

---

## 2. 前置条件、依赖与不变量

**前置条件**
1. S0 完成：干净基线、CI required checks、`scripts/report-store-stats.mjs`、`src/lib/perf/playbackMarks.ts`、`scripts/check-docs-facts.mjs`。
2. **D4 备份范围**已确认（默认 A：仅设置+元数据，不含音频二进制）——影响 S1-2 v5 schema；**D7** 不影响本阶段（本阶段不碰保护视图）。
3. S1-4 需要 IndexedDB 测试能力：优先新增 devDependency `fake-indexeddb`（§8 Q2）；若被否，用 `src/test/mocks/indexedDb.ts` 自建最小实现。
4. 所有 PR 从 S0-1 后的干净分支创建；禁止在主工作区直接改（用户 55 项脏改保留）。

**依赖顺序**
```
S1-1 ──→ S1-2 ──────────────┐
  └──→ S1-3 ──→ S1-5 ──→ S2-4
S0-6 ──→ S1-4（独立）
S0-6 ──→ S1-6 ──→ S1-7
              └──→ S1-8 ──→ S1-9
S1-2/S1-3/S1-4/S1-5/S1-6/S1-7/S1-8/S1-9 ──→ S1-10（最后合）
```
**可并行轨道**：A 数据轨（S1-1/2/3/4，文件集 `src/lib/storage/**`、`src/store/backupRestoreStore.ts`、`src/store/queueStore.ts`、`src/store/recommendationStore.ts`、`src/services/localMusic*.ts`）；B 播放轨（S1-5/6/7/8/9，文件集 `src/lib/playback/**`、`src/lib/audio/**`、`src/hooks/useAudioPlayer.ts`）。两轨唯一共享文件 `useAudioPlayer.ts`（仅 B 轨）与 `queueStore.ts`（仅 A 轨 S1-3，B 轨 S1-5 只读消费）——**S1-5 不得改 queueStore.ts**。

**硬不变量**：I1 用户数据兼容——不重命名/删除 44 key，不改备份 envelope 的旧读路径；改结构 = version+1 + migrate + 旧 JSON fixture；旧 key 保留一个版本。I2 播放连续性——不重建 audio 元素、不重置进度。I3 单一事实源。I6 ≤400 行/PR。I7 验证顺序。

---

## 3. 任务总表

| ID | 任务 | 写作用域（精确文件） | 子 PR | 依赖 | 风险 | 验收 |
|---|---|---|---|---|---|---|
| S1-1 | storageRegistry v1：44 key owner/version/group/backup + 一致性测试 | `src/lib/storage/storageRegistry.ts`（新）、`src/lib/storage/storageRegistry.test.ts`（新）、`src/test/fixtures/persistEnvelopes.ts`（新） | 1 | S0-6 | 低 | 44/44 注册；代码↔注册表 diff=0 |
| S1-2 | 备份/恢复修复 + v5 schema + 旧备份兼容 + body 泄漏 | `src/lib/storage/backupSchema.ts`（新）、`src/lib/storage/rehydrateRegisteredStores.ts`（新）、`src/store/backupRestoreStore.ts`、`src/components/library/BackupRestorePanel.tsx`、对应测试与 `src/store/__fixtures__/backup-v*.json` | 2（2a/2b） | S1-1 | 中 | v4 旧备份可导入；v5 闭环；不支持槽位明确；泄漏=0 |
| S1-3 | 启动压缩与配额策略修复：不截断、失败保留旧值、降级可见 | `src/lib/storage/safeStorage.ts`、`src/lib/storage/quotaPolicy.ts`（新）、`src/lib/storage/degradedNotifier.ts`（新）、`src/store/queueStore.ts`、`src/store/recommendationStore.ts`、`src/store/statsAchievementsStore.ts`、测试 | 1 | S1-1 | 中 | 200/200、30/30；QuotaExceeded 旧值字节不变；降级事件=1 |
| S1-4 | VibeMusicDB 统一 open v3 + 错误三分类 + v1/v2 迁移 | `src/lib/storage/vibeMusicDb.ts`（新）、`src/services/localMusicService.ts`、`src/services/localMusicStorage.ts`、`src/lib/audio/audioSource.ts`（错误映射）、测试 | 1 | S0-6 | 中（迁移） | v1→v3/v2→v3 测试；local:// 可播；错误不再静默 |
| S1-5 | 队列唯一权威：queueStore owner + QueueNavigator + 只读投影 | `src/lib/playback/queueNavigator.ts`（新）、`src/store/audioStore.ts`、`src/lib/bootstrap.ts`、`src/store/selectors/queueSelectors.ts`（新）、测试 | 2（5a/5b） | S1-3 | 中高 | 删/排/清后 next/ended 与面板一致；audioStore 无独立队列写入 |
| S1-6 | PlaybackMediaBridge 单例：12 事件唯一订阅 + 幂等 attach/detach | `src/lib/playback/mediaBridge.ts`（新）、`src/hooks/useAudioPlayer.ts`、测试（新） | 1 | S0-6 | 中高 | 多实例交错卸载后 ended/timeupdate 仍触发；监听数=12 |
| S1-7 | AudioContextWatchdog 懒 attach/detach + onContextCreated | `src/lib/audio/AudioContextWatchdog.ts`、`src/lib/audio/AudioEngine.ts`、`src/lib/audio/AudioContextWatchdog.test.ts` | 1 | S1-6 | 低 | start 先于 context 也能挂载；stop 后 0 监听 |
| S1-8 | PlaybackRequestCoordinator + AbortSignal 贯穿 resolver/cache/prefetch | **8a**：`src/lib/playback/requestCoordinator.ts`（新）、`MultiSourceResolver.ts`、`audioSource.ts`、`useNetworkAudioCache.ts`、`audioPrefetcher.ts`、测试；**8b**：`src/hooks/useAudioPlayer.ts`、集成测试 | 2（8a/8b） | S1-6 | 高（核心链路） | 连点 5 首 1 in-flight；旧 promise 不写 store；abort 生效 |
| S1-9 | 首声并行化：离线/本地/缓存 Promise.any + resolver 并发 + 歌词封面后置 | `src/lib/playback/sourceResolver.ts`（新）、`src/hooks/useAudioPlayer.ts`、`src/lib/perf/playbackMarks.ts`（接线）、测试 | 1 | S1-8、S0-6 | 中 | 命中 P50<300ms/P95<800ms（固定场景）；顺序断言绿 |
| S1-10 | 正确性集成测试矩阵（6 文件 / 20 用例） | `src/test/integration/**`（6 新文件）、`src/test/fixtures/**`、`src/test/utils/**` | 1 | S1-2..S1-9 | 低 | 20 用例全绿；覆盖 §9.2 全部场景 |

**子 PR 与文件序**：S1-2a（schema/collector/restore 引擎/后端 store，≤320 行）→ S1-2b（面板 UI/提示/泄漏清理，≤180 行）；S1-5a（navigator+audioStore 导航，≤300 行）→ S1-5b（投影/selectors/bootstrap/注解，≤150 行，rebase 5a）；S1-8a（lib 层信号链，≤330 行）→ S1-8b（hook 接线+集成测试，≤220 行）。其余单 PR；测试/文档不计 400 行上限。

---

## 4. 逐任务执行步骤

### S1-1 storageRegistry v1（1 PR，~250 行）

**目标**：44 个 persist key 有唯一注册表（owner/version/group/backup），成为 S1-2/S6-2 的唯一 key 事实源。
**前置**：S0-6a 的 `scripts/report-store-stats.mjs` 可产出 44 key 清单。
**写作用域**：`src/lib/storage/storageRegistry.ts`、`src/lib/storage/storageRegistry.test.ts`、`src/test/fixtures/persistEnvelopes.ts`。**不改任何 store 的 persist 配置**（envelope/skipHydration 属 S6-2）。

**Step 1｜定义接口**（与总计划 §4.5 一致，S6-2 只扩展不重写）
```ts
export type StorageGroup = "settings" | "playback" | "library" | "ai" | "ui" | "transient";
export type QuotaPolicy = "prune" | "prune-then-memory" | "memory";
export interface StorageEntry {
  key: string; owner: string; version: number;
  migrate?: (persisted: unknown, from: number) => unknown;
  group: StorageGroup; backup: boolean;
  sizeBudgetBytes?: number; quotaPolicy?: QuotaPolicy; pruneFields?: string[];
}
export const STORAGE_REGISTRY: readonly StorageEntry[];           // 恰好 44 项
export function getStorageEntry(key: string): StorageEntry | undefined;
export function listBackupKeys(): string[];                        // backup=true
export function listKeysByGroup(group: StorageGroup): string[];
export function resolveStorageKey(moduleHint: string): string | undefined; // 常量拼接 key 反查
```

**Step 2｜录入 44 项**（来源：审计 A §2.6 全表，逐项核对 `src/store/*.ts` 的 `persist({ name })`）
key 清单（作为测试期望值固化）：`mimi-ai-store, audio-effects-store-v2, audio-processing-store-v5, mimi_audio_source_settings, audio-store-v4, backup-restore-store-v4, crossfade-store-v5, dsd-processing-store-v5, vibe-emotion-store-v2, eq-store, favorites-store, fingerprint-store-v5, format-conversion-store-v5, mimi-gesture-settings-v1, hires-store-v5, keyboard-shortcuts-store-v1, mimi-knowledge-storage-v3, library-health-store-v5, library-manager-store-v4, mimi-liner-notes-store, journal-store-v1, lyric-settings-storage, lyrics-cover-store-v4, lyrics-search-storage, metadata-editor-store-v5, performance-v8-store, player-skin-store-v1, player-store, playlist-group-store-v1, professional-mode-store-v5, queue-store-v5, recommendation-storage, smart-playlist-store-v4, vibe_source_config_v1, spectrum-store-v5, stats-achievements-store-v4, track-cutting-store-v5, ui-store-v2, mimi_ai_agent_chat_store_v1, mimi_datamanager_hub_store_v1, mimi-user-account-storage, visual-settings-v4, visualization-v8-store, waveform-store-v5`。
录入规则：
- `version` = 该 store persist 配置中的 `version ?? 0`；当前仅 `aiStore`（migrate 已存在于 aiStore.ts:499-516）、`gestureSettingsStore`（v1）、`uiStore`（v2，**无 migrate**，登记为 S6-2 待补）；其余为 0。
- `owner` = store 模块文件名（如 `audioStore`），测试断言 `src/store/<owner>.ts` 存在。
- `group`：settings（音频/视觉/手势/皮肤/EQ…）、playback（player/queue/audio/spectrum）、library（library-manager/health/lyrics-cover/metadata…）、ai（ai/emotion/knowledge/AI agent…）、ui（ui-store/keyboard/player-skin…）、transient（backup-restore-store-v4）。
- `backup`：仅 v4 备份能映射到真实 key 的 8 项 = true：`audio-store-v4, visual-settings-v4, mimi-gesture-settings-v1, playlist-group-store-v1, queue-store-v5, recommendation-storage, library-manager-store-v4, lyrics-cover-store-v4`；其余 false。**不扩大备份范围**（D4）。
- 3 个常量拼接 key（gesture/playerSkin/ai）在 `resolveStorageKey` 里映射到 store 文件，测试读取对应常量声明赋值（**待核实**常量名与导出位置：gesture 见 `src/lib/gesture/types.ts:342`）。

**Step 3｜一致性测试** `storageRegistry.test.ts`
用例与断言：
- `"registers exactly 44 unique keys"`：`STORAGE_REGISTRY.length===44`；`new Set(keys).size===44`。
- `"every entry has owner/version/group and a resolvable store module"`：`fs.existsSync('src/store/'+owner+'.ts')` 全 true；`version>=0`。
- `"registry keys equal persist names found in src/store"`：递归读 `src/store/**/*.ts`（排除 `*.test.ts`），正则 `name:\s*["'\`]([^"'\`]+)`，与 registry 做集合相等；对常量 key 用 `resolveStorageKey` 比对；输出缺失/多余明细（失败信息可直接修）。
- `"backup keys are exactly the 8 legacy-mappable keys"`：`listBackupKeys()` 排序等于期望数组。
- `"legacy fixture envelopes stay parseable"`（`persistEnvelopes.ts` 提供 `makeZustandEnvelope(state, version)`）：对每个 backup=true key 构造 envelope，`JSON.parse` 后含 `{state, version}`。

**验证命令与预期**
```powershell
npx vitest run src/lib/storage/storageRegistry.test.ts     # 5 passed
node scripts/report-store-stats.mjs --json | Select-String persistKeys  # 44
npx tsc --noEmit; npx eslint src --max-warnings=0          # 0 errors
```
**验收**：44/44；代码↔注册表 diff=0；owner 文件全存在；backup=8。
**回滚**：纯新增文件，删除即可；无 store 配置变更。
**风险**：常量 key 无法静态提取 → 用显式映射表 + 测试断言常量值（不猜）；审计表与实际代码漂移 → 以代码扫描为准，把差异记入 PR。

---

### S1-2 备份/恢复修复 + v5 schema + 旧备份兼容（2 子 PR，~350 行）

**目标**：备份覆盖真实 key；恢复真正生效（rehydrate/提示）；旧 v4 备份可导入；移除 body 泄漏；不破坏 v4 envelope 的读路径。
**前置**：S1-1；D4=A（默认不含音频二进制）。
**写作用域**：S1-2a = `src/lib/storage/backupSchema.ts`（新）、`src/lib/storage/rehydrateRegisteredStores.ts`（新）、`src/store/backupRestoreStore.ts`、`src/store/backupRestoreStore.test.ts`、`src/store/__fixtures__/backup-v4-legacy.json`（新）、`backup-v3-unknown-major.json`（新）、`backup-v5.json`（新）；S1-2b = `src/components/library/BackupRestorePanel.tsx`、`src/components/library/BackupRestorePanel.test.tsx`（新增或更新）。

**Step 1｜v5 schema（新增，不替换 v4 结构）**
```ts
// backupSchema.ts
export const BACKUP_SCHEMA_VERSION = 5;
export interface BackupEntryV5 { key: string; version: number; group: StorageGroup; payload: string; } // payload = 原样 localStorage 字符串
export interface BackupPayloadV5 { schemaVersion: 5; createdAt: number; type: BackupType; entries: BackupEntryV5[]; }
export interface RestoreReport { restored: string[]; skipped: Array<{key:string; reason:"missing"|"corrupt"|"unsupported"}>; failed: Array<{key:string; reason:string}>; }
export function createBackupV5(source: Storage, keys: string[]): BackupPayloadV5;                 // 从 registry 收集，跳过 null
export function parseBackupV5(raw: string): { ok: true; value: BackupPayloadV5 } | { ok: false; reason: string };
export function migrateBackupV4(legacy: unknown): { payload: BackupPayloadV5; unsupported: string[] }; // 兼容读旧备份
export function restoreBackupV5(payload: BackupPayloadV5, target: Storage): RestoreReport;          // 先全量校验，再写入
```
**旧 v4 → v5 映射（必须逐条实现，字段名来自 backupRestoreStore.ts:215-250）**
| v4 槽位 | v4 读取（旧代码） | 当前真实 key | 处理 |
|---|---|---|---|
| settings.audio | `audio-store-v4` | `audio-store-v4` | 迁移 |
| settings.visual | `visual-settings-v4` | `visual-settings-v4` | 迁移 |
| settings.gesture | `gesture-store`（不存在）| `mimi-gesture-settings-v1` | 迁移；payload 为 null → skipped |
| settings.sleep | `sleep-timer-store`（不存在）| 无 persist | unsupported，UI 明示 |
| playlists.playlist | `playlist-store`（不存在）| 无 persist | unsupported，UI 明示 |
| playlists.playlistGroups | `playlist-group-store-v1` | 同 | 迁移 |
| playlists.queue | `queue-store`（错）| `queue-store-v5` | 迁移；先按 zustand envelope 校验，失败 → skipped+report |
| playlists.recommendation | `recommendation-store`（错）| `recommendation-storage` | 迁移 |
| library.library | `library-manager-store-v4` | 同 | 迁移 |
| lyrics | `lyrics-cover-store-v4` | 同 | 迁移 |

**Step 2｜备份创建/恢复流程**
- `createBackup`：从 `listBackupKeys()` 收集（不再硬编码 key）；body 写 `backup-data-<id>` 保留（S6-2 再迁 IDB），但 payload 加 `schemaVersion:5` 与每 key `version`；`estimateBackupSize` 改用实际字符串长度。
- `restoreBackup`：`getBackupData` 解析 → 若是 v5 直接 restore；若是 v4（无 `schemaVersion` 或 `version:"4.0.0"`）先 `migrateBackupV4`；**先对全部 entry 做 `JSON.parse` + envelope 形状校验 + registry.migrate（有则跑）**，全部通过才写；写入前把将被覆盖的 8 个 key 现值存入 `sessionStorage["mimi:restore-rollback"]`（单次恢复可一键回滚）；写入后调用 S1-2a 的 `rehydrateRegisteredStores(restoredKeys)`；返回 `RestoreReport`，UI 展示 restored/skipped/unsupported。
- `rehydrateRegisteredStores.ts`：
```ts
export type RehydrateHandle = () => void | Promise<void>;
export function registerRehydrateHandle(key: string, handle: RehydrateHandle): void;
export async function rehydrateRegisteredStores(keys?: string[]): Promise<{ ok: string[]; failed: string[] }>;
// 初始注册（各 store 模块内或集中注册）：player/queue/ui/audio/visualSettings/gesture/recommendation/library
//   handle = () => { const p = useXStore.persist; if (typeof p?.rehydrate === "function") return p.rehydrate(); }
```
恢复后：`set({ isRestoring:false })` 前完成 rehydrate；UI 提示"已恢复 N 项，M 项需刷新生效"并提供"立即刷新"按钮（`window.location.reload()`）。S6-2 用它过渡到 `hydrateStores()`，接口保持。

**Step 3｜泄漏与孤儿清理**
- `clearOldBackups`（backupRestoreStore.ts:504-507）：删除被裁剪备份对应的 `backup-data-<id>`；`deleteBackup`（:350-352）已有删除，保留。
- 新增 `pruneOrphanBackupBodies()`：启动/创建备份前扫描 `Object.keys(localStorage).filter(k=>k.startsWith("backup-data-"))`，不在 backups 列表中的删除；在 store 初始化或 `BackupRestorePanel` mount 时调用一次（择一，避免双调）。
- **不删除**旧 key（`queue-store` 等）——I1；仅在报告中提示。

**Step 4｜旧备份兼容测试**（fixtures 必须手写、参数化）
`src/store/backupRestoreStore.test.ts` 用例：
- `"migrates legacy v4 backup with wrong keys to current keys"`：fixture `backup-v4-legacy.json`（含 settings/playlists/library/lyrics 全槽位，queue/recommendation/gesture 槽为有效 envelope、sleep/playlist 为 null）→ restore → 断言 `queue-store-v5`/`recommendation-storage`/`mimi-gesture-settings-v1` 被写入且解析出的 state 与 fixture 一致；`backup-data-*` 中旧 key 不存在。
- `"reports unsupported slots instead of writing dead keys"`：断言 report.skipped 含 sleep/playlist，localStorage 无 `sleep-timer-store`/`playlist-store` 写入。
- `"rejects unknown major version"`：`backup-v3-unknown-major.json` → restore 返回失败，无任何写入（用 spy 断言 setItem 0 次）。
- `"v5 roundtrip restores all backup keys"`：create→restore→断言 8 key 值等于备份前；rehydrate mock 被调用 8 次。
- `"restore is atomic when one entry is corrupt"`：改坏一个 payload → setItem 0 次。
- `"clearOldBackups removes orphan backup bodies"`：3 个 backups + 5 个 body（2 孤儿）→ 清理后 body=3。
面板测试（S1-2b）：`"shows unsupported slots in preview"`、`"shows restore report and reload action"`、`"does not render dead keys (gesture-store/sleep-timer-store)"`。

**验证命令与预期**
```powershell
npx vitest run src/store/backupRestoreStore.test.ts src/components/library/BackupRestorePanel.test.tsx  # 全 passed
npx tsc --noEmit; npx eslint src --max-warnings=0
```
**验收**：v4 旧备份→恢复→rehydrate 闭环通过；不支持槽位 UI 明确；body 泄漏=0；恢复原子性；**不删除旧 key**。
**回滚**：v4 解析与恢复路径保留（本 PR 不改旧函数签名，只加分支）；v5 新函数可不用；rehydrate 是新增钩子，失败降级为旧行为（提示重启）。回滚顺序：先 revert 2b（UI）再 2a（引擎），数据不受影响。
**风险**：R2——旧备份 payload 与当前 store 结构不匹配 → `migrateBackupV4` 只做 key 映射，不做字段迁移；字段级不兼容记入 report.skipped 并由 UI 提示"该备份来自旧版本，部分数据无法自动迁移"；恢复覆盖会话中的 rollback 快照保留到页面刷新。

---

### S1-3 启动压缩与配额策略修复（1 PR，~300 行）

**目标**：启动不再截断有效队列/历史；配额失败保留上一份有效数据且降级可见；三套存储策略统一到可测策略模块。
**前置**：S1-1；前置审计 A01/A12。
**写作用域**：`src/lib/storage/safeStorage.ts`、`src/lib/storage/quotaPolicy.ts`（新）、`src/lib/storage/degradedNotifier.ts`（新）、`src/store/queueStore.ts`、`src/store/recommendationStore.ts`、`src/store/statsAchievementsStore.ts`、`src/lib/storage/safeStorage.test.ts`（新）、`src/store/queueStore.test.ts`、`src/store/recommendationStore.test.ts`（新增/更新）。

**Step 1｜修复 `compactExistingStorage`（safeStorage.ts:63-115）**
- 删除 `:105` `queue.slice(0,50)` 与 `:110` `history.slice(0,20)`，改为 `state.queue.map(sanitizeSongForStorage)`（**保长度**）、`state.history.map(sanitizeSongForStorage)`；移除 `:68-69` 无对应 key 的 legacy 清理（逐条确认后保留真正 legacy key；**待核实** :69 的 `legacyKey` 变量来源）。
- 加"有意义缩减才写回"门槛：`newRaw.length < oldRaw.length * 0.98` 才 `setItem`，避免启动时无意义写盘；任何情况下不删除原值（写失败保持旧值）。
- 导出签名保持 `compactExistingStorage(): void`（兼容 GlobalClientComponents.tsx:46 调用），加注释说明"只做字段瘦身，不裁剪集合"。

**Step 2｜统一配额策略** `quotaPolicy.ts`
```ts
export interface PersistPolicyInput { key: string; serialized: string; policy: QuotaPolicy; pruneFields?: string[]; pruneSteps?: string[][]; }
export type PersistOutcome =
  | { ok: true; bytes: number; degradedTo?: "history-trimmed" | "minimal-songs" | "index-only" }
  | { ok: false; reason: "quota" | "serialize"; keptPrevious: true };
export function writeWithPolicy(input: PersistPolicyInput, write: (value: string) => void): PersistOutcome;
// 规则：绝不先 remove 旧值；逐级尝试更小 payload；全部失败 → keptPrevious:true 且不写空集合
```
`degradedNotifier.ts`：`reportStorageDegraded({key, reason, degradedTo})` → `window.dispatchEvent(new CustomEvent("mimi:storage-degraded",{detail}))` + `console.warn`，并**动态** `import("@/store/uiStore")` 调 `showToast("存储空间不足，已保留上一次有效数据", "warning")`（动态 import 避免静态循环依赖；测试用 vi.mock）。

**Step 3｜queueStore 配额重写（queueStore.ts:343-400）**
- `tryPersistQueueState` 改为调用 `writeWithPolicy`：
  - 正常 payload = 现有 partialize（`:345` 200 项、`:347` 30 条历史、`:346` index clamp 199→ 改为 `Math.min(currentIndex, queue.length-1)` 保留原值语义）。
  - 配额失败降级顺序：history 30→5→0 → queue 仅最小字段（`toMinimalPersistedSong`）→ 仅 index（**禁止** `queue:[]` 落盘，删除 `:392` 的 `state.queue=[]` 写空逻辑）。
  - 全部失败：不动 localStorage 旧值 + `reportStorageDegraded({key:"queue-store-v5",reason:"quota"})`，返回 `{ok:false,keptPrevious:true}`。
- 更新 `queueStore.test.ts:121` 现有用例（把"配额耗尽后队列变空"的期望改为"保留上一份有效快照 + degraded 事件 + 不写空"）。
**Step 4｜recommendationStore（:136）与 statsAchievementsStore（:519/:918）**
- `slice(0, 20)` → 常量 `RECENT_HISTORY_LIMIT = 30`（**待核实** :136 数组语义是"最近播放/推荐历史"；若为推荐列表则保持 20 并在注释说明）。
- 两 store 的自定义 storage 统一包 `writeWithPolicy`（policy：recommendation=`prune-then-memory`，stats=`prune`），保留各自序列化逻辑；stats 的裁剪字段允许列表写进 registry 的 `pruneFields`（S1-1 已建，追加 entry 字段即可，不改 version）。

**Step 5｜fixture 测试（新增 `safeStorage.test.ts`，更新 queue 测试）**
- `"compaction preserves a 200-item queue with currentIndex 199"`：预置 `queue-store-v5` = `JSON.stringify({state:{queue:[...200],currentIndex:199,history:[...30],playThroughMode:"normal"},version:0})` → 调用 `compactExistingStorage()` → 断言解析后 `queue.length===200`、`currentIndex===199`、`history.length===30`。
- `"compaction preserves 51-item queue and index 50"`（边界）：51/50 原样保留。
- `"compaction still strips heavy song fields"`：item 含 `coverUrl` 大字段 → 被 `sanitizeSongForStorage` 去掉，但数量不变。
- `"compaction skips write when reduction is negligible"`：spy setItem，断言未调用。
- `"quota failure keeps previous snapshot byte-identical"`：mock setItem 抛 QuotaExceeded → 记录旧 raw → 写 200 项 → 断言 `localStorage.getItem(key)===oldRaw`。
- `"degraded event emitted once per failure"`：监听 `mimi:storage-degraded`，断言 detail.key/count=1。
- `"never persists an empty queue as fallback"`：全失败后解析旧值仍有 200 项。
**验证命令与预期**：`npx vitest run src/lib/storage/safeStorage.test.ts src/store/queueStore.test.ts src/store/recommendationStore.test.ts` → 全 passed；`npx tsc --noEmit` 0；`npx eslint src --max-warnings=0` 0。
**验收**：E1-1 场景全过（200/200、30/30、index 199、51/50）；QuotaExceeded 旧值字节不变；降级事件 1 次；无静默清空。
**回滚**：单 PR revert；不改 key 名/version → 数据格式不变；旧值保留意味着 revert 后仍可读。
**风险**：降级策略改变现有行为（旧测试期望空队列）→ 明确在本 PR 更新测试并在 PR 描述引用前置审计 A12；`writeWithPolicy` 统一化触及 stats store 序列化细节 → 若风险超预期，stats 可拆出另 PR（≤400 行规则优先）。

---

### S1-4 VibeMusicDB 统一 open / version v3（1 PR，~250 行）

**目标**：消除同库 v1/v2 双版本打开导致的 `local://` 读取失败；错误可分类可提示；v1/v2 数据无损升级到 v3。
**前置**：S0-6；审计 C P0-2；测试环境方案确定（§8 Q2）。
**写作用域**：`src/lib/storage/vibeMusicDb.ts`（新）、`src/lib/storage/vibeMusicDb.test.ts`（新）、`src/services/localMusicService.ts`、`src/services/localMusicStorage.ts`、`src/lib/audio/audioSource.ts`（仅错误映射）、`src/services/localMusicService.test.ts`（新）、`src/test/mocks/indexedDb.ts`（若不用 fake-indexeddb）。

**已核实现状**：`localMusicService.ts:7-9` DB_NAME/VibeMusicDB、DB_VERSION=1、STORE_NAME="musicFiles"；`:13` open(1)；`:42` onerror `resolve(null)`、`:44-46` catch 也返回 null。`localMusicStorage.ts:6-8` 同库 DB_VERSION=2、STORE_NAME="localMusic"；`:58` open(2)，升级时创建 store（审计 C P0-2；**待核实** :58-72 具体 createObjectStore 列表）。

**Step 1｜新模块接口**
```ts
// vibeMusicDb.ts
export const VIBE_MUSIC_DB_NAME = "VibeMusicDB";
export const VIBE_MUSIC_DB_VERSION = 3;
export const VIBE_MUSIC_STORES = {
  musicFiles: { keyPath: "id" },        // v1 既有，不可改
  localMusic: { keyPath: "id" },        // v2 既有
  metadata: { keyPath: "id" },          // v2 既有
  offlineAudio: { keyPath: "id" },      // v2 既有
} as const;
export type VibeMusicDbErrorCode = "version-conflict" | "blocked" | "missing-store" | "quota" | "unknown";
export class VibeMusicDbError extends Error { code: VibeMusicDbErrorCode; cause?: unknown; }
export function openVibeMusicDb(): Promise<IDBDatabase>;   // 模块级单例；onupgradeneeded 只增 store（contains 检查）
export function classifyVibeMusicDbError(error: unknown): VibeMusicDbErrorCode;
export function resetVibeMusicDbForTests(): void;          // 关闭连接并清空单例，仅测试用
```
实现要点：`onupgradeneeded` 中按 `db.objectStoreNames.contains(name)` **只创建缺失 store**，绝不 deleteObjectStore、绝不改 keyPath；`db.onversionchange` 关闭连接并置空单例；`onblocked` 记录日志并以 `blocked` 拒绝挂起 promise；并发调用复用同一 promise。

**Step 2｜改造两个 service**
- `localMusicService.ts`：删除 `openLegacyMusicDB`（:11-23），`getFileFromStorage` 改用 `openVibeMusicDb()`；区分三种结果：记录不存在 → `return null`；数据库错误 → `throw new VibeMusicDbError(code, ...)`（**不再静默吞错**）；读取事务失败 → throw `unknown`。保留 `LegacyStoredAudioFile` 导出（audioSource 依赖）。
- `localMusicStorage.ts`：`:58` open 改为 `openVibeMusicDb()`；删除本地 `onupgradeneeded` 建库逻辑（集中在 vibeMusicDb），其余事务代码不动；公开 API 不变。
- `audioSource.ts:91-96`：捕获 `VibeMusicDbError`，`version-conflict/missing-store` 抛用户可读错误（"本地音乐数据库版本异常，请重启应用或联系支持"），不再显示"文件不存在"；日志带 code。（`:95` 现文本 "Local audio file not found" 仅保留给"记录不存在"。）

**Step 3｜迁移兼容**
- v1 用户（只有 musicFiles）→ 打开 v3 触发升级，新增 localMusic/metadata/offlineAudio，musicFiles 记录保持。
- v2 用户 → 打开 v3 只补缺失 store（正常情况全有，无操作）。
- 不做数据搬迁、不删除任何 store；**不**把 v1 数据复制到 v2 表（职责分离由 service 读两条路径逐步统一，属后续）。
- 备份/清库逻辑（若有）不改。

**Step 4｜测试（fake-indexeddb 或 mock，必须真实触发 upgrade）**
`src/lib/storage/vibeMusicDb.test.ts`：
- `"creates v3 schema from empty database"`：open → `objectStoreNames` 含 4 项；keyPath 断言。
- `"upgrades v1 database to v3 without losing musicFiles records"`：先 `indexedDB.open(name,1)` 建 musicFiles 写 `{id:"a",data:ArrayBuffer,type:"audio/mpeg"}` → 关闭 → `openVibeMusicDb()` → 读 musicFiles 记录仍在；4 store 齐全。
- `"upgrades v2 database to v3 without losing localMusic records"`：同上 v2 写 localMusic 记录。
- `"existing store keyPaths are unchanged"`：断言 4 个 store 的 `keyPath` 与常量一致。
- `"classifies version conflict"`：先 open v4（模拟未来版本）→ `openVibeMusicDb()` 返回 `version-conflict`，不抛未分类错误。
- `"reuses one connection for concurrent callers"`：`Promise.all([openVibeMusicDb(), openVibeMusicDb()])` → 两结果 `=== `。
`src/services/localMusicService.test.ts`：
- `"returns null only when record is absent"`（正常库、无记录）。
- `"surfaces version conflict instead of silently returning null"`（mock open 抛 VersionError → 断言 throw code=version-conflict）。
- `"local:// import survives v2→v3 upgrade"`（配合 S1-10 场景 2 的公共 fixture）。

**验证命令与预期**：`npx vitest run src/lib/storage/vibeMusicDb.test.ts src/services/localMusicService.test.ts` → 全 passed；`npx tsc --noEmit` 0；`npx eslint src --max-warnings=0` 0。
**验收**：v1→v3 / v2→v3 迁移测试通过且记录不丢；`local://` 在 S1-10 场景 2 可播；错误三分类可断言；未改任何 keyPath。
**回滚**：revert 单 PR；DB 已被升级到 v3 后旧代码以 v2 打开会抛 VersionError（**注意**：回滚会锁死本地播放在旧版本，需在回滚说明中标注；因此迁移测试必须先于合并通过）。缓解：本 PR 不写新数据格式，可临时把 `VIBE_MUSIC_DB_VERSION` 降回 2 发补丁（v3 只多 store）。
**风险**：R2 数据迁移；测试环境 IDB 保真度 → 优先 fake-indexeddb；`localMusicStorage` 多处 open 需全部收敛（grep `indexedDB.open` 全仓确认只剩 vibeMusicDb）。

---

### S1-5 队列唯一权威 + QueueNavigator（2 子 PR，~350 行）

**目标**：`queueStore` 成为 queue/currentIndex/history 唯一可写 owner；`audioStore` 只做单向只读投影；next/prev/ended 全部走同一导航器。
**前置**：S1-3；前置审计 A01；设计与总计划 §4.3 一致。
**写作用域**：S1-5a = `src/lib/playback/queueNavigator.ts`（新）、`src/lib/playback/queueNavigator.test.ts`（新）、`src/store/audioStore.ts`、`src/store/queuePlaybackSync.test.ts`（新）；S1-5b = `src/lib/bootstrap.ts`、`src/store/selectors/queueSelectors.ts`（新）、`src/store/audioStore.ts`（仅 @deprecated 注记）。

**已核实现状**：`audioStore.ts:77-78` queue/currentIndex 字段、`:394-395` `nextSong` 读 `get().queue`、`:439` 末曲分支、`:447` 取模；`queueStore.ts:128-348` 拥有 queue/index/history 与 20+ 变更器（含 setQueue/addToQueue/addToNext/removeFromQueue/reorderQueue/clearQueue）；`bootstrap.ts:32-64` 启动把 queue/index/loopMode 写回 audioStore。三处手工同步（审计 C P0-1 列出的 `audioStore.ts:517-557 / :658-692`）实施时先逐行核实再删。

**Step 1（5a）｜导航器接口**
```ts
export type QueueNavReason = "advanced" | "wrapped" | "stopped-at-end" | "empty" | "single-loop";
export interface QueueNavResult { index: number; song: Song | null; reason: QueueNavReason; }
export function computeNext(queue: Song[], currentIndex: number, loopMode: LoopMode, playThroughMode: PlayThroughMode): QueueNavResult;
export function computePrev(queue: Song[], currentIndex: number, loopMode: LoopMode, playThroughMode: PlayThroughMode): QueueNavResult;
export function advanceQueue(direction: "next" | "prev"): QueueNavResult;  // 读 useQueueStore，写 currentIndex，不碰 audioStore
```
规则必须与 queueStore 现有语义一致：normal/play-through 到末尾 → `{song:null,reason:"stopped-at-end"}`；`loopMode==="single"` → 同曲 single-loop；列表循环到头回到 0（wrapped）；空队列 → empty；**不按 Song.id 去重**（重复曲目语义保留，位置为主）。

**Step 2（5a）｜audioStore 改为委托 + 单向投影**
- `nextSong/prevSong`：函数体替换为 `const r = advanceQueue("next"|"prev"); if (!r.song) { usePlayerStore.setState({isPlaying:false}); return; } useAudioStore.getState().playSong(r.song)`（保留旧公开签名与返回 void，**兼容 facade**，加 `@deprecated Use queueStore + advanceQueue`）。
- `appendSongsAndPlay`：改为 `useQueueStore.getState().setQueue(songs); playSong(songs[0])`（不再手写 audioStore.queue）。
- 删除 audioStore 内对 queue/currentIndex 的三处手工写；改为模块级单向投影：
```ts
if (typeof window !== "undefined") {
  useQueueStore.subscribe((s) => {
    const cur = useAudioStore.getState();
    if (cur.queue !== s.queue || cur.currentIndex !== s.currentIndex)
      useAudioStore.setState({ queue: s.queue, currentIndex: s.currentIndex });
  });
}
```
投影只在 queueStore 变化后写入，audioStore 不再反写 → 无循环。模块 import 方向：audioStore → queueStore（引入 1 条运行时边；目标态 S6-5 删除，登记债务）。
- `playSong` 内的队列同步块（:517-557）改为 `useQueueStore.getState().setQueueAndIndex(queue, index)`（若 queueStore 无此 action，在**本 PR 的 audioStore 侧**调用现有 `setQueue`+`setCurrentIndex`；不改 queueStore.ts，保持写作用域）。

**Step 3（5b）｜投影、selector、bootstrap**
- `queueSelectors.ts`：`selectQueue`、`selectCurrentIndex`、`selectCurrentSong`、`selectHistory`、`selectNextSong`（`computeNext(...)` 派生，不写状态）。
- `bootstrap.ts:49-55`：删除把 `restoredQueue/restoredIndex` 写入 audioStore 的块（queueStore 已持久化）；`:38-43` 的 currentSong/currentTime 恢复保留（playerStore 投影）。
- `audioStore.ts` 的 queue/currentIndex 字段类型保留，JSDoc 加 `@deprecated 只读投影，owner=queueStore；S6-5 删除`；模块内禁止再 `setState({queue})`（仅投影处）。

**Step 4｜测试**
`queueNavigator.test.ts` 用例：
- `"advances within queue"` / `"wraps at end in list-loop"` / `"stops at end in normal mode"` / `"returns null for empty queue"`
- `"single loop stays on same song"` / `"prev from index 0 stops in normal mode"`
- `"duplicate songs are navigated by position"`（同 id 两首，删其一后位置正确）
`queuePlaybackSync.test.ts` 用例：
- `"next uses queueStore after removeCurrent"`：queue=[A,B,C]、currentIndex=1、`removeFromQueue(B)` → `advanceQueue("next")` → C（不是旧数组的 C 也需按 index 重算）
- `"next uses reordered queue"`：reorder → next 顺序为新序
- `"clearing queue stops playback without error"`：clear → advance → song null、playerStore.isPlaying=false、无 toast
- `"audioStore mirror equals queueStore after mutations"`（setQueue/add/remove/reorder/clear 各一次）
- `"mirror never writes back to queueStore"`：spy queueStore.setState，audioStore 投影后调用次数=0

**验证命令与预期**：`npx vitest run src/lib/playback/queueNavigator.test.ts src/store/queuePlaybackSync.test.ts` → 全 passed；`npx tsc --noEmit`；`npx eslint src --max-warnings=0`。
**验收**：删当前/删末/清空/重排后 next 与 ended 均与面板一致；audioStore 无独立队列写（grep `setState({ queue` 仅投影处）；bootstrap 不再复制队列。
**回滚顺序**：先 revert 5b（bootstrap/selector/注解，行为回到"投影存在但 bootstrap 复制"），再 revert 5a；queue-store-v5 数据格式未变，回滚不丢数据。若出现播放回归，立即回滚并阻塞后续 S2-4。
**风险**：中高——播放链路；缓解：navigator 纯函数先测、old API 签名不变、逐 PR 回滚；重复曲目语义用「位置」而非 id。

---

### S1-6 PlaybackMediaBridge 单例（1 PR，~350 行）

**目标**：12 个媒体事件只有唯一订阅者；多实例挂载/卸载互不剥离；hook 只订阅快照。
**前置**：S0-6（playbackMarks 可复用于事件时间线）。
**写作用域**：`src/lib/playback/mediaBridge.ts`（新）、`src/lib/playback/mediaBridge.test.ts`（新）、`src/hooks/useAudioPlayer.ts`、`src/hooks/useAudioPlayer.multiInstance.test.tsx`（新）。

**已核实现状**：`useAudioPlayer.ts:396-400` attach 先 detach；`:941-952` 12 个 addEventListener；`:955-974` cleanup 移除 12 个；`:977-981` detachListeners 调当前 cleanup；`:1248-1288` 每个 hook 实例 effect attach、cleanup 无条件 detach。

**Step 1｜接口**
```ts
// mediaBridge.ts
export interface MediaSnapshot {
  currentTime: number; duration: number; buffered: number;
  isPlaying: boolean; isLoading: boolean;
  error: { message: string; code?: string } | null;
  requestId: number; deckId: string; source: string;
}
export interface MediaBridgeHandlers {
  onEnded?: (snapshot: MediaSnapshot) => void;
  onError?: (error: { message: string; code?: string }, snapshot: MediaSnapshot) => void;
  onPlaying?: () => void;
  onWaiting?: () => void;
  onTimeUpdate?: (t: number) => void;
}
export const playbackMediaBridge: {
  attach(audio: HTMLAudioElement, handlers: MediaBridgeHandlers): () => void; // 幂等：同元素多次 attach 只加一次监听，返回 release 计数-1
  getSnapshot(): MediaSnapshot;
  subscribe(listener: () => void): () => void;
  getServerSnapshot(): MediaSnapshot;   // SSR 稳定空快照
  attachCount(): number;                 // 测试用
  disposeForTests(): void;
};
```
实现：模块级 `WeakMap<HTMLAudioElement, {count, handlers, detach}>` 或 `Map`（测试可枚举）+ 快照对象；12 事件处理器集中在 bridge；`timeupdate` 继续 250ms 节流（沿用 useAudioPlayer.ts:417-430 的语义），单点写 `useAudioStore/usePlayerStore`（**只写一处**，S2-4 再降频）；`ended` 处理器负责 `requestId/deckId` 校验（沿用 `:106-149 getCurrentAudioOwner` 逻辑，迁移或调用）。
**兼容 facade**：保留模块内 `attachListeners/detachListeners` 导出（供旧调用/测试），实现改为 `playbackMediaBridge.attach(...)` / release；`_vibeCleanup` 字段仍由 bridge 设置（旧测试/第三方代码可用），但 bridge 以自身 WeakMap 为准，**不再依赖该字段做 detach**。

**Step 2｜hook 改造**
- `:1248-1288` effect：`const release = playbackMediaBridge.attach(audio, handlers); ... return () => { document.removeEventListener(...); release(); if (secondary) releaseSecondary(); }`。
- 新增 `useSyncExternalStore`：`const snapshot = useSyncExternalStore(playbackMediaBridge.subscribe, playbackMediaBridge.getSnapshot, playbackMediaBridge.getServerSnapshot)`；hook 返回值/状态由快照派生，**保留现有返回字段名**（兼容 6 个消费者：GlobalClientComponents.tsx:33、AudioEqualizer.tsx:50、FullscreenLyrics.tsx:145、VisualizationView.tsx:98、VisualizationViewV8.tsx:47、AppleMusicVisualizer.tsx:45）。
- 删除 `:1242-1245` 之外的实例级事件 effect 与 `_vibeCleanup` 写入（保留 deprecated 注释）。

**Step 3｜测试**
`mediaBridge.test.ts`：
- `"attach is idempotent per element"`：同 audio attach 两次 → `addEventListener` spy 调用=12（不是 24），`attachCount()===2`。
- `"release one of two keeps listeners attached"`：release 第一次 → removeEventListener=0；dispatch `ended` → handler 仍被调。
- `"release last removes all 12 listeners"`：removeEventListener=12；`attachCount()===0`。
- `"timeupdate writes stores once per throttle window"`：spy `useAudioStore.setState`/`usePlayerStore.setState`，连续 10 次 dispatch（同毫秒）→ 各 1 次。
- `"ended carries requestId/deckId and ignores stale"`：快照 requestId=2，事件带 requestId=1 → onEnded 不被调。
- `"snapshot notifies subscribers on timeupdate"`：subscribe spy 被调。
`useAudioPlayer.multiInstance.test.tsx`：
- `"unmounting an older instance does not detach the active instance"`：渲染 A、B（B 后挂载）→ unmount A → dispatch ended → B 的 `nextSong` 生效（spy）。
- `"closing lyrics panel keeps timeupdate updates"`：A=Global（常驻）、B=FullscreenLyrics；unmount B → dispatch timeupdate → hook 返回的 currentTime 更新。

**验证命令与预期**：`npx vitest run src/lib/playback/mediaBridge.test.ts src/hooks/useAudioPlayer.multiInstance.test.tsx` → 全 passed；`npx tsc --noEmit`；`npx eslint src --max-warnings=0`。
**验收**：监听总数=12 且多实例交错挂载/卸载后 ended/timeupdate 仍触发；hook 返回值兼容 6 个消费者；无双重写盘。
**回滚**：单 PR revert（旧 attach/detach 代码保留在 git 历史）；无数据影响；回滚顺序无（单 PR）。
**风险**：中高——播放核心。缓解：先写 mediaBridge 单测（不接 hook）→ 再接 hook；消费者 API 不变；S2-1/S2-4 依赖本任务，未合并前不动音频图。

---

### S1-7 AudioContextWatchdog 懒 attach/detach（1 PR，~180 行）

**目标**：watchdog 在 AudioContext 懒创建路径上真正生效；start/stop 对称；设备切换恢复可测。
**前置**：S1-6（事件归属清晰）。
**写作用域**：`src/lib/audio/AudioEngine.ts`、`src/lib/audio/AudioContextWatchdog.ts`、`src/lib/audio/AudioContextWatchdog.test.ts`、`src/lib/audio/AudioEngine.test.ts`（如存在则更新，否则新建）。
**已核实现状**：`AudioEngine.ts:37-75` 懒 init（`getAudioContext():172`）；`AudioContextWatchdog.ts:29-38` start 设 isStarted 后 attach；`:43-46` 无 ctx 直接 return；`:143-153` stop 只清定时器；全文件 removeEventListener=0。

**Step 1｜AudioEngine 增加上下文创建订阅**
```ts
// AudioEngine.ts
export type ContextCreatedListener = (ctx: AudioContext) => void;
public onContextCreated(listener: ContextCreatedListener): () => void; // 返回取消订阅
// initContext() 成功建图后（当前 :42-70 末尾、:68 analyser.connect(destination) 之后）通知所有 listener；已存在 ctx 时立即同步回调
```
**Step 2｜watchdog 改造**
```ts
// AudioContextWatchdog.ts
private attachedCtx: AudioContext | null = null;
private stateChangeHandler: (() => void) | null = null;
private deviceChangeHandler: (() => void) | null = null;
public start(heartbeatIntervalMs = 30*60*1000): void;  // 幂等；无 ctx 时注册 onContextCreated 一次性回调，创建后 attach
public attachAudioContextWatchdog(): void;              // 幂等：先 detach 再 attach；保存 handler+ctx
public detachAudioContextWatchdog(): void;              // removeEventListener("statechange") + 清 refs
public stop(): void;                                    // 清 heartbeat/debounce + detach + remove mediaDevices devicechange + isStarted=false
```
设备切换用保存的 `deviceChangeHandler` 调 `navigator.mediaDevices.removeEventListener`；heartbeat 保持现有 30min 行为。
**Step 3｜测试**（`AudioContextWatchdog.test.ts` 追加；复用现有 mock AudioEngine）
- `"start before context creation attaches once context is created"`：engine.getAudioContext()=null → start() → 触发 engine.onContextCreated 回调 → `addEventListener("statechange")` 被调 1 次；emit `suspended` 且 isPlaying=true → `resume()` 被调 1 次。
- `"start twice registers only one listener"`：start→start→创建 ctx → addEventListener=1。
- `"stop removes statechange and devicechange listeners"`：创建 ctx 后 stop → removeEventListener("statechange")/mediaDevices.removeEventListener("devicechange") 各 1；再次 emit 不 resume。
- `"suspended triggers single resume per event"`：连续 3 次 suspended → resume=3（每次一次）且无误报（isPlaying=false 时 0 次）。
**验证命令与预期**：`npx vitest run src/lib/audio/AudioContextWatchdog.test.ts` → 全 passed；`npx tsc --noEmit` 0。
**验收**：start 先于 context 也能挂载并自愈；stop 后监听=0；无重复 attach。
**回滚**：单 PR revert；`onContextCreated` 是新增 API，不影响旧调用（bootstrap.ts:73 的 start 调用保持）。
**风险**：低；测试 mock 与真实 AudioContext 行为差异 → 在 S1-10 场景 5 用 mock 覆盖事件序，真机合盖做手工 smoke 并记录"未自动化"。

---

### S1-8 PlaybackRequestCoordinator + AbortSignal 贯穿（2 子 PR，~350 行）

**目标**：切歌可取消；旧解析/下载/缓存任务被 abort；旧 promise 不写 store。
**前置**：S1-6（单点写状态）；审计 C P0-7。
**写作用域**：8a = `src/lib/playback/requestCoordinator.ts`（新）、`requestCoordinator.test.ts`（新）、`src/services/MultiSourceResolver.ts`、`src/lib/audio/audioSource.ts`、`src/hooks/useNetworkAudioCache.ts`、`src/lib/audio/audioPrefetcher.ts`、对应测试；8b = `src/hooks/useAudioPlayer.ts`、`src/test/integration/playback-cancellation.integration.test.ts`（S1-10 前预置，S1-10 复用）。

**已核实现状**：`useAudioPlayer.ts:106-149` requestId/deck 校验；`:1305` managePlayback 内 5 处 await（:1407,:1466,:1487,:1531,:1558,:1592 附近）；`MultiSourceResolver.ts:280-283` resolvePlayableAudio(query,bypassCache)；`:406-407` fetch 带 `AbortSignal.timeout(4000)`（仅超时）；`audioSource.ts:105` fetch 无 signal；`useNetworkAudioCache.ts:107` 后台 fetch 无 signal；`audioPrefetcher` 无 abort。

**Step 1（8a）｜协调器接口**
```ts
export interface PlaybackRequestInput { songId: string; source: string; }
export interface PlaybackRequestToken { id: number; songId: string; source: string; controller: AbortController; startedAt: number; }
export class PlaybackRequestCoordinator {
  begin(input: PlaybackRequestInput): PlaybackRequestToken;  // 先 abort 上一个；记录 inFlight
  complete(token: PlaybackRequestToken): void;               // 只清当前 token
  abortAll(reason?: string): void;
  isCurrent(token: PlaybackRequestToken): boolean;           // id === current.id && !signal.aborted
  signalOf(token: PlaybackRequestToken): AbortSignal;
  inFlight(): number;                                        // 0|1（用于验收"仅 1 in-flight"）
}
export const playbackRequestCoordinator = new PlaybackRequestCoordinator();
export function throwIfAborted(signal?: AbortSignal): void;  // DOMException("AbortError")
export function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal; // AbortSignal.any 不可用时的 polyfill
```

**Step 2（8a）｜信号贯穿点（逐个改，全部向后兼容：options 可选）**
| 文件:位置 | 现状 | 改法 |
|---|---|---|
| MultiSourceResolver.ts:280 | `resolvePlayableAudio(query, bypassCache=false)` | 重载为 `(query, options: {bypassCache?: boolean; signal?: AbortSignal} = {})`；保留旧 boolean 调用的运行时兼容（`typeof options==="boolean"` 分支，标 deprecated） |
| MultiSourceResolver.ts:406,988 等 30+ fetch | 仅 timeout | `fetch(url,{signal: combineSignals(options.signal, 4000)})`；每个 await 前 `throwIfAborted(options.signal)`；AbortError → 返回 null 或抛出由调用方判定（解析链返回 null，不写缓存） |
| MultiSourceResolver.ts:253-256 resolvedUrlCache | 失败/abort 也可能 set | abort 路径 **不写缓存** |
| audioSource.ts:51 resolveAudioSourceBlob / :105 fetch | 无 signal | 增加可选 `options?: {signal?: AbortSignal}`；fetch 传 `combineSignals(signal, 15000)`；abort 时 revoke 已创建 blob URL |
| useNetworkAudioCache.ts:90 triggerBackgroundCache / :107 fetch | 无 signal | 增加可选 signal；模块级 `abortControllers: Map<key, AbortController>`，新请求同 key 先 abort 旧；abort 后清理 `cachingTasks` 且不写缓存 |
| audioPrefetcher.ts:36-103 | 无 abort | 暴露 `cancelPrefetch(): void` 或接受 signal；换歌时由 8b 调用 |
**Step 3（8b）｜hook 接线**
- `managePlayback` 开头：`const token = playbackRequestCoordinator.begin({songId, source}); const signal = token.controller.signal;`；把 signal 传给 3 个 IDB 读取后检查点（IDB 不可取消，读后 `throwIfAborted`）、resolver（`{signal}`）、audioSource/cache。
- 现有 `isCurrentPlaybackRequest(requestId)` 守卫（:1453,:1478,:1488,:1538,:1554 附近，实施时逐处核实）保留，改为同时使用 `playbackRequestCoordinator.isCurrent(token)`；store 写入点统一包裹。
- `finally`：`playbackRequestCoordinator.complete(token)`；错误处理中 `AbortError` 直接 return（不弹 toast、不写 error store）。
- 面板/路由卸载时（hook cleanup）不 abort 当前播放（播放连续性），只在发起新播放时 abort 旧请求。
**Step 4｜测试**
`requestCoordinator.test.ts`：
- `"begin aborts previous token"`：t1=begin(A)；t2=begin(B) → `t1.controller.signal.aborted===true`，`inFlight()===1`
- `"isCurrent is false for stale token"` / `"complete only clears current"`
- `"abortAll aborts current"`
- `"combineSignals aborts on timeout or parent abort"`（fake timers）
`playback-cancellation.integration.test.ts`（8b）：
- `"rapid 5 plays leave only the last request in flight"`：mock resolver 返回延迟 promise；连续触发 5 次 play → 断言 `playbackRequestCoordinator.inFlight()===1`；前 4 个 signal.aborted=true；第 5 个完成。
- `"stale resolver results do not write stores"`：spy `useAudioStore.setState`/`usePlayerStore.setState`，让第 1 个 promise 在第 5 个之后 resolve → 断言 currentSong 仍为第 5 首、无 stale error toast。
**验证命令与预期**：`npx vitest run src/lib/playback/requestCoordinator.test.ts src/test/integration/playback-cancellation.integration.test.ts` → 全 passed；`npx tsc --noEmit`；`npx eslint src --max-warnings=0`。
**验收**：连点 5 首仅 1 in-flight；旧请求 abort 生效（fetch mock 的 signal.aborted）；旧结果不写 store；无 stale toast。
**回滚顺序**：先 revert 8b（hook 回旧路径，resolver/cache 的新可选参数不生效但兼容），再 revert 8a；resolver 旧 boolean 调用兼容保证回滚不破坏调用方。
**风险**：高——核心链路。缓解：8a 只加可选参数不改默认行为；先合 8a 并跑全量测试，再合 8b；AbortSignal.any 兼容用 polyfill；网络层 mock 需覆盖 abort 语义。

---

### S1-9 首声并行化（1 PR，~250 行）

**目标**：离线/本地/缓存三查并行、resolver 并发兜底、歌词/封面在起播后补；firstSound 指标可测。
**前置**：S1-8；S0-6b playbackMarks。
**写作用域**：`src/lib/playback/sourceResolver.ts`（新）、`src/lib/playback/sourceResolver.test.ts`（新）、`src/hooks/useAudioPlayer.ts`、`src/hooks/useAudioPlayer.firstSound.test.ts`（新）。

**Step 1｜接口**
```ts
export type FirstSoundKind = "offline" | "local" | "cache" | "resolved";
export interface FirstSoundCandidate { kind: FirstSoundKind; url: string; cleanup?: () => void; }
export interface FirstSoundDeps {
  getOfflineAudio: (id: string) => Promise<{ url: string; cleanup?: () => void } | null>;
  getStoredMusic: (id: string) => Promise<{ url: string; cleanup?: () => void } | null>;
  getCachedAudio: (id: string, source: string) => Promise<{ url: string; cleanup?: () => void } | null>;
  resolvePlayableAudio: (signal: AbortSignal) => Promise<{ url: string } | null>;
}
export async function resolveFirstSound(deps: FirstSoundDeps, signal: AbortSignal): Promise<FirstSoundCandidate | null>;
// 时序：t0 同时启动 4 条（3 个 IDB + resolver）；先成功者胜出 → abort 其余（IDB 读后检查）；loser 的 cleanup 必须调用；
// 全部失败/abort → null（由调用方走 onError 抢救路径）
```
**Step 2｜hook 重排（managePlayback，useAudioPlayer.ts:1305 起）**
- 新流程：`markPlayback("intent")` → 并行候选 → 胜出 → `markPlayback("sourceReady")` → 设置 `audio.src`/`play()` → `markPlayback("playing")`（playing 事件，S0-6b 已埋）；歌词/封面 `fetchOnlineLyrics/fetchOnlineCover`（:1556-1619）从"起播前 await"改为**起播后 fire-and-forget**（`void` + token 校验），失败不影响播放。
- 保留现有兜底：候选全失败 → 现有 onError 抢救路径（:850-905）；AbortError 不触发抢救。
- resolver 并发启动后若快源胜出：调用归还的 cleanup + 通过独立 AbortController abort resolver 请求（省带宽）；若 resolver 胜出：忽略 IDB 晚到结果并 revoke 其 blob URL。
**Step 3｜测试**
`sourceResolver.test.ts`：
- `"cache hit wins and aborts resolver"`：cache 10ms、resolver 100ms → kind=cache；resolver signal.aborted=true。
- `"resolver wins when IDB slower"`：resolver 5ms、IDB 50ms → kind=resolved；晚到 IDB 的 cleanup 被调用且 url revoke。
- `"all candidates fail returns null"`
- `"aborted signal returns null without cleanup leak"`：abort 后 loser cleanup 总数=启动数-1（胜者不计）。
- `"local and offline both succeed: first keeps, losers cleaned"`
`useAudioPlayer.firstSound.test.ts`：
- `"lyrics and cover fetches start only after play kickoff"`：spy 调用顺序断言 `play` 先于 `fetchOnlineLyrics`。
- `"marks record intent before source-ready before playing"`：mock performance.mark 调用顺序。
**Step 4｜指标测量（不改 CI 墙钟阈值）**
在 `perf/scenarios.md`（S8-3 前可先放本执行包 evidence）记录固定场景：缓存命中（本地 fixture ×20 次）、冷启动 ×10 次；用 CDP/PerformanceObserver 采集 `playback:intent→playback:playing`。目标 E1-8；未达标需在 PR 说明原因（不得把"改小样本"当达标）。
**验证命令与预期**：`npx vitest run src/lib/playback/sourceResolver.test.ts src/hooks/useAudioPlayer.firstSound.test.ts` → 全 passed；`npx tsc --noEmit`；`npx eslint src --max-warnings=0`。
**验收**：顺序断言绿；固定场景 P50<300ms/P95<800ms（缓存命中）、冷启动 P95<2.5s（记录样本数与设备）；无 blob URL 泄漏（cleanup 计数断言）。
**回滚**：单 PR revert（回到串行路径）；resolver API 不变（S1-8 后已带 options）；无数据影响。
**风险**：中——并行引入竞态；缓解：纯函数可测 + 取消语义复用 S1-8 token；歌词/封面后置若产品要求"起播即有歌词"，回滚该子改动即可（单独 commit）。

---

### S1-10 正确性集成测试矩阵（1 PR，6 文件 / ≥20 用例）

**目标**：把总计划 §9.2 的 8 类场景固化为可重复的集成测试；为 S2/S6 提供回归网。
**前置**：S1-2..S1-9 全部合并。
**写作用域**：`src/test/integration/queue-playback.integration.test.ts`（新）、`local-db-playback.integration.test.ts`（新）、`backup-restore.integration.test.ts`（新）、`media-bridge-panels.integration.test.tsx`（新）、`audio-context-recovery.integration.test.ts`（新）、`playback-cancellation.integration.test.ts`（8b 已建，此处补全）、`src/test/fixtures/{songs,queues,backup-v4-legacy.json,persist-envelopes}.ts|json`（新）、`src/test/utils/{resetStorage,mountAudioHook}.ts`（新）。

| # | 场景（§9.2） | 文件 | 用例名 | 关键断言 |
|---|---|---|---|---|
| 1 | 队列面板删除当前项/末项/清空 → 播放结束 | queue-playback.integration.test.ts | `"ended after removing current plays next surviving song"` | 当前 B 被删、ended → 播 C；`playerStore.currentSong.id==="C"` |
| 2 | 同上（末项） | 同 | `"ended on last item stops without out-of-bounds"` | ended → `isPlaying===false`；currentSong 不变；无越界错误 |
| 3 | 同上（清空） | 同 | `"ended after clear stops playback"` | `isPlaying===false`；无异常 toast；`currentSong===null` 或最后播放项（按现语义） |
| 4 | 队列重排/插入 next → 下一首 | 同 | `"next follows reordered queue"` / `"next uses inserted-next song"` | 顺序断言 |
| 5 | 本地导入 → 刷新 → 播放 | local-db-playback.integration.test.ts | `"local:// song is playable after v2→v3 reload"` | open v2 写记录 → reload（reset 单例+重开）→ `resolveAudioSourceBlob` 返回非空 blob；无 "file not found" |
| 6 | 同上（DB 异常） | 同 | `"db version conflict surfaces actionable error"` | 断言抛 `VibeMusicDbError.code==="version-conflict"`，错误文案非"文件不存在" |
| 7 | 备份 → 改设置 → 恢复 → 重载 | backup-restore.integration.test.ts | `"v4 legacy backup restores into current stores after reload"` | 恢复→rehydrate→读 store 值等于备份；重启后（reset+hydrate）仍等于 |
| 8 | 同上（v5 全量） | 同 | `"v5 backup roundtrip restores all registered backup keys"` | 8 key 全恢复；report.failed=0 |
| 9 | 同上（不支持槽位） | 同 | `"unsupported slots reported and not written"` | 无 dead key 写入；report.skipped 含 sleep/playlist |
| 10 | 同上（body 清理） | 同 | `"orphan backup bodies are pruned"` | body 数=backups 数 |
| 11 | 开/关全屏歌词、可视化、面板后再播放 | media-bridge-panels.integration.test.tsx | `"closing lyrics keeps ended and timeupdate"` | unmount 歌词实例 → dispatch ended/timeupdate → 仍更新 |
| 12 | 同上（多实例） | 同 | `"two instances share exactly one listener set"` | `playbackMediaBridge.attachCount()` 语义 + addEventListener 次数 |
| 13 | 同上（进度） | 同 | `"timeupdate updates progress after panel unmount"` | hook snapshot.currentTime 变化 |
| 14 | 模拟设备切换/合盖恢复 | audio-context-recovery.integration.test.ts | `"watchdog resumes suspended context created after start"` | mock engine 创建后 emit suspended → resume 1 次 |
| 15 | 同上（stop） | 同 | `"watchdog stop removes listeners"` | remove 断言；再 emit 不 resume |
| 16 | 同上（devicechange） | 同 | `"devicechange triggers one debounced reconnect"` | 连续 emit 3 次 → 重连 1 次 |
| 17 | 连点 5 首切歌 | playback-cancellation.integration.test.ts | `"only last request remains in flight"` | `inFlight()===1`；4 个 signal.aborted |
| 18 | 同上（旧结果） | 同 | `"stale results never overwrite current song"` | currentSong=第 5 首；无 stale error |
| 19 | 播放连续性（打开/关闭面板不重建元素） | media-bridge-panels.integration.test.tsx | `"audio element identity is stable across panel mounts"` | 同一 `HTMLAudioElement` 引用；currentTime 不重置 |
| 20 | 队列 200 项/历史 30 条 + 刷新 | queue-playback.integration.test.ts | `"startup compaction preserves 200-item queue"` | 200/30/index 199（复用 S1-3 fixture） |

**公共 fixture/helper**：`src/test/utils/resetStorage.ts`（清 localStorage/sessionStorage、重置 store 到默认、重置 vibeMusicDb 单例）、`src/test/utils/mountAudioHook.ts`（renderHook + 事件 dispatch 助手）、`songs.ts`（3 首固定 Song + 重复 id 变体）、`queues.ts`（A/B/C、200 项生成器）。
**验证命令与预期**
```powershell
npx vitest run src/test/integration --reporter=dot    # 6 files / ≥20 tests passed，0 failed
npm run test -- --run                                  # 全量 205+ 文件 0 failed
npx tsc --noEmit; npx eslint src --max-warnings=0      # 0
```
**验收**：20 用例全绿且可重复（连跑 3 次无 flake）；覆盖 §9.2 全部 8 类场景；测试不依赖真实网络/真实 AudioContext（全 mock）；真机设备切换/听感列为手工 smoke 并在证据文件记录"未自动化"。
**回滚**：测试文件独立，revert 不影响产品；若某场景因实现未就绪失败，不合并 S1-10（出口门要求）。
**风险**：flaky（fake timers/异步）→ 统一 `vi.useFakeTimers` 策略与 waitFor helper；jsdom 下 Audio 元素需 mock（沿用现有测试模式）。

---

## 5. 阶段级验证命令与证据清单

顺序固定（I7）：eslint → vitest → tsc → build → dev/smoke；**S1 不新增 build 门禁**（S0-2 已接入）。

| # | 命令 | 预期 |
|---|---|---|
| 1 | `npx eslint src --max-warnings=0` | exit 0，0 problems |
| 2 | `npm run test -- --run` | exit 0；≥225 文件 / ≥1287 用例；0 failed |
| 3 | `npx tsc --noEmit --incremental false --pretty false` | exit 0，0 errors |
| 4 | `npm run build` | exit 0；3 静态页 + 31 API route |
| 5 | `npm run clean:port; npm run dev` + `curl / 、/data-manager` | 200；控制台无未捕获异常 |
| 6 | `npx vitest run src/test/integration` | 6 文件 / ≥20 用例 passed |
| 7 | `node scripts/report-store-stats.mjs --out perf/s1-store-stats.json` | persistKeys=44；coordinator 外部引用=0；whole 订阅数不高于 S0 基线（本阶段不要求下降） |
| 8 | 数据迁移 fixture | v4 旧备份、v1/v2 IDB、200 项队列 fixture 全通过；迁移前后旧 key 值可读 |

**证据文件**：`evidence/S1-evidence.md`，必含：每 PR 变更文件/行数/exit code；9 类场景 before/after；firstSound 样本数与 P50/P95（设备、场景、命令）；迁移 fixture 清单与输出；回滚演练记录（至少 S1-2 与 S1-4 各一次 revert 演练）；未执行项（真机合盖、真实网络源、听感）明确列出。
**禁止**：把"单测通过"当用户验收；用真实用户 localStorage 做迁移实验（必须临时 profile）；删除旧 key（I1）。

---

## 6. 与相邻阶段的接口/交接物

**S1 → S2**
| 交接物 | 路径 | 消费方 |
|---|---|---|
| 媒体事件单点 + 快照 API | `src/lib/playback/mediaBridge.ts` | S2-1（音频图单入口）、S2-4（播放写盘降频） |
| 导航器 | `src/lib/playback/queueNavigator.ts` | S2-4（切歌检查点写盘）、S6-5 |
| 取消协调器 | `src/lib/playback/requestCoordinator.ts` | S2-5（Map 上界/soak）、S7-1 |
| 首声解析 | `src/lib/playback/sourceResolver.ts` | S2-6（性能报告）、S7-9（OPFS） |
| 存储策略 | `src/lib/storage/quotaPolicy.ts`、`degradedNotifier.ts` | S6-2（46 key 全量接入） |
| firstSound 指标 | `src/lib/perf/playbackMarks.ts` + evidence | S2-6 |
**S1 → S6**：`storageRegistry` 的 version/migrate 字段由 S6-2 扩展为 44/44 + envelope + `hydrateStores()`；S1-2 的 `rehydrateRegisteredStores` 保持签名，S6-2 内部切换到 `hydrateStores`。
**S1 内部依赖**：S2-4 必须在 S1-5 后；S2-1 必须在 S1-6 后；S2-5 必须在 S1-7 后；S2/S7 的取消能力来自 S1-8。
**S0 输入**：baseline JSON、CI、playbackMarks、store 统计脚本、D4 决策。

---

## 6.5 实施进展（滚动）

### 2026-10-21 ｜ S1-1 storageRegistry（done）

- src/lib/storage/storageRegistry.ts：44 key / 8 backup / owner+version+group+quotaPolicy + EXTERNAL_KEYS + 完整性校验。
- src/lib/storage/storageRegistry.test.ts：5 用例通过（key 集合与源码一致、owner 文件、备份清单、完整性/查找、external 隔离）。

### 2026-10-22 ｜ S1-3 启动压缩与配额策略（done）

- src/lib/storage/safeStorage.ts：删除 queue.slice(0,50)/history.slice(0,20) 截断；改为保长度 + 字段瘦身；仅缩减 ≥2% 才写回；配额失败保留旧值并上报（不再静默）。
- 新增 src/lib/storage/quotaPolicy.ts：逐级候选写盘；任何情况下不先删除旧值；全部失败返回 keptPrevious。
- 新增 src/lib/storage/degradedNotifier.ts：window 事件 mimi:storage-degraded + 30s 节流 toast（动态 import uiStore，避免循环依赖）。
- src/store/queueStore.ts：三档降级（history 5 / minimal songs / index-only），**永不写空队列**；删除旧"清空 queue"回退；partialize 的 currentIndex 按实际持久化长度 clamp。
- src/store/recommendationStore.ts、src/store/statsAchievementsStore.ts：统一 writePolicy，配额失败不清空数据，降级可见。
- 测试：quotaPolicy 5、safeStorage 5、queue 20（更新 1 个旧用例 + 新增 2 个配额用例）、recommendation 10、stats 10 全部通过；full suite exit 0；tsc/eslint 0。
- 未做：S1-2 备份恢复（下一步）、S1-4 VibeMusicDB（Q04 fake-indexeddb 待定）、S1-5..S1-10。

---

## 7. 未决问题 / 需用户决策

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| Q1 | D4 备份范围最终确认（默认 A：仅设置+元数据） | S1-2 v5 schema 是否含 IDB 音频 | 按 A 执行；B 另立"完整导出"计划 |
| Q2 | 是否允许新增 devDependency `fake-indexeddb`（仅测试） | S1-4 迁移测试质量 | 允许（dev-only，不影响运行时包体）；被否则用 `src/test/mocks/indexedDb.ts`（成本 +1-2 天，**待核实**覆盖度） |
| Q3 | recommendationStore.ts:136 的 `slice(0,20)` 语义（最近播放 vs 推荐列表） | S1-3 是改 30 还是保持 20 | 实施时先读上下文确认；若为推荐列表保持 20 并注释 |
| Q4 | 备份恢复后是否自动 `location.reload()` 还是提示按钮 | S1-2 UI 行为 | 推荐提示 + 按钮（默认不强制刷新，避免打断播放） |
| Q5 | 旧 `queue-store`/`gesture-store` 等历史 key 是否在 S6 前清理 | I1 数据安全 | 本阶段只写正确 key，不删旧 key；清理需单独迁移 PR + 用户确认 |
| Q6 | 降级 toast 的文案/频率（避免连续配额失败刷屏） | S1-3 体验 | 同 key 30s 内只提示一次（实现时加节流） |
| Q7 | 真机设备切换/听感验证谁执行、何时 | E1-6 验收 | 列入阶段证据"手工 smoke"，不能自动化替代 |

**「后续补充」边界**：若时间不足，S1-10 的 20 用例可先落 1-9（9 类场景的核心断言），UI 层断言（19）与 devicechange debounce（16）标注「后续补充」；S1-2b 的 UI 文案可复用现有组件样式，不新增设计。
