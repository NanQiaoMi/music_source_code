# S6 状态架构收敛 — 实现级执行计划

> **上级计划**：[架构与性能优化总计划](../2026-10-21-architecture-performance-optimization.md) §5 S6 · [执行计划包说明](./README.md) · 决策：[00-decisions.md](./00-decisions.md)
> **阶段**：S6（S6-1..S6-12，12 个任务 / 28 个子 PR） · **预估工期**：单人 10-15 天，2-3 人并行 5-7 天 · **状态**：**未开始**
> **基线**：规划快照 = `feature/gesture-air-control-overhaul @ c73a872`（含 55 项未提交手势改动，禁止触碰）；实施必须从 S0-1 处理后的干净分支开始（master = 90c2152）。
> **证据来源**：审计 A `scratch/architecture-audit-2026-10-21/store-audit.md`（§2.2 60 store 表、§2.3 订阅、§2.4 依赖图、§2.5/§2.6 持久化、§5 目标架构、§6 W0-W13）；审计 C `runtime-audio-audit.md` §4.1/§5；审计 B `render-perf-audit.md` §5.3。本文行号为 2026-10-21 在规划工作区用 read/grep 实测复核；与审计不同的数字已在文中标注。

---

## 1. 阶段目标与出口条件（量化）

**目标**：把"多套权威并存"收敛为"每事实一个可写 owner + 机器可执行门禁"。四件事：① 持久化从 44 个散落 key 变成 registry 即代码；② 播放/队列/EQ/主题/全屏/toast/性能档 11 组重复事实去重；③ 组件与 service 不再整店订阅、不在 render 体 getState；④ 跨 store 编排下沉到 `src/domain` 纯用例 + 类型化事件，配 contract 测试矩阵与行数/依赖棘轮。

| # | 出口指标 | 现状（审计/实测） | 目标 | 测量命令 |
|---|---|---|---:|---|
| E1 | 组件层整店订阅调用点 | 160（全仓）；实测 `useUIStore()` 19 处活代码、`useVisualSettingsStore()` 5、`useQueueStore()` 5 | **0**；全仓 ≤10（白名单） | `node scripts/report-store-stats.mjs --check` |
| E2 | 只整店无 selector 的文件 | 59 | 0 | 同上 |
| E3 | store 间静态 import 边 / SCC | 21 边，SCC=[audioStore,playlistStore] | **≤6 且全部 type-only，SCC=0** | `node scripts/check-store-graph.mjs` + depcruise |
| E4 | persist registry 覆盖 | 44 key 无注册表；version 3/44、migrate 1/44 | **44/44 注册，44/44 version，迁移键全部有 migrate** | `src/store/__contract__/storageRegistry.contract.test.ts` |
| E5 | 整店持久化 store 数 | 5（knowledge/linerNotes/lyricSettings/professionalMode/recommendation） | 0（全部 partialize 白名单） | report-store-stats |
| E6 | 组件 getState 写状态 | 126 处 / 45 文件 | **0** | `rg "use.*Store[.]getState[(][)]" src/components` = 0 |
| E7 | service/lib getState 写状态 | 29 / 3 service；25 / 8 lib | service **0**；lib ≤5（bootstrap/gesture 白名单） | 同上按目录统计 |
| E8 | 播放写盘 | ~8 次/秒（双 store 双 persist） | **≤1 次/秒** | patch `Storage.prototype.setItem` 计数脚本 |
| E9 | audioStore 行数 / 语义重复事实组 | 818 行（read 实测 totalLines=818）/ 11 组 | **<400 行 / 0 组** | `node scripts/check-file-size.mjs` + S6-11 矩阵 |
| E10 | 新增文件行数 + 循环依赖 | 无门禁 | 新增文件 ≤400；depcruise 0 violations | `npm run verify:boundaries` |
| E11 | hydration | 22 个 persist 首屏同步 hydrate，无 skipHydration | 全部 skipHydration + `hydrateStores()` 显式顺序，hydration 测试通过 | hydrationOrder.contract.test.ts |

**出口定义**：E1-E11 全部达标 + §5 验证全绿 + 证据入 `evidence/S6-evidence.md`；未达标项须在 TRACKING 说明原因与后续任务，不得静默放行。

---

## 2. 前置条件、依赖与不变量

**硬前置（未满足不得启动对应任务）**

1. **S0-1** 55 项脏改已处理；S6 涉及的 `page.tsx`、`uiStore.ts`、`PanelOrchestrator.tsx`、`GlobalClientComponents.tsx`、`package.json`、`tsconfig.json` 不再 dirty（审计 A P2-08）。
2. **S1-1** storageRegistry v1 已落地（44 key 清单 + 一致性测试）；S6-2 只做 envelope/hydration/迁移与 44/44 补齐。
3. **S2-4** 播放写盘降频已完成（playerStore/audioStore partialize 已去高频字段），S6-3 才能安全停双 persist。
4. **S3-1/S3-2/S3-8/S3-10** 页级/壳层/playlistStore/剩余 Top-20 整店订阅已清零；S6-1 只做"门禁 + 残余 codemod"。
5. **D6 已拍板**（默认 A：新建 themeStore）；**D5 已拍板**（质量档位）供 S6-8 合并性能档。
6. **D7 授权**：本阶段只改订阅/派生，不改编排与视觉；任何 Home/Player/全屏歌词 JSX/样式改动需单独 PR 与截图。

**本阶段附加不变量（违反即拒绝合并）**

| # | 不变量 |
|---|---|
| N1 | 旧 key 一律保留：新结构写新 version 或新 key，读旧写新；**删除旧 key 的代码必须是独立 PR，且迁移 PR 发布 ≥1 个版本之后**（总计划 I1）。 |
| N2 | 每个事实只允许一个可写 owner；兼容层只能单向依赖（新 owner → 旧 facade 或反之，禁止双向 subscribe），旧 API 必须标 `@deprecated` + 替代 API + 计划删除版本。 |
| N3 | 播放连续性：store 迁移不得重建 audio 元素、不得重置进度；异步失败不得污染当前曲目/队列。 |
| N4 | 受保护界面（Home/Player/全屏歌词）只允许 D7 授权的等价改写；改前截图、改后对比。 |
| N5 | 每 PR ≤400 行（测试/文档不计，`docs/nbl/PROCESS.md:133-134`）；大任务按"兼容层 → 调用迁移 → 删除旧路径"拆子 PR，子 PR 文件集合不相交。 |
| N6 | 验证顺序固定：eslint → vitest → tsc --noEmit → build → clean-port/dev → HTTP smoke；禁止并行 build 与 tsc，禁止 dev 存活时 clean .next。 |

**同阶段并行规则（写作用域不相交）**：轨道 A 持久化（src/lib/storage/**、store persist 配置）、轨道 B 播放域（audioStore/playerStore/queueStore/domain/playback）、轨道 C UI 域（uiStore/uiShellStore/panelStore/toastStore/themeStore）、轨道 D 门禁（scripts/**、.eslintrc.json、CI）。**共享串行文件（同一时刻只能一个 owner，禁止并行）**：`src/store/audioStore.ts`、`src/store/playerStore.ts`、`src/store/uiStore.ts`、`src/app/page.tsx`、`src/lib/bootstrap.ts`、`.eslintrc.json`、`package.json`、`.github/workflows/ci.yml`、`vitest.config.ts`。

**兼容层公约（全阶段统一）**

```ts
// 兼容 facade / 旧 action 的文件头必须包含：
/** @deprecated since S6-x. Use <替代 API>. Removal: S6 完成后下一个 minor 版本. */
// 退出条件（PR 描述必须写）：rg "<旧 API 名>" src --glob '!**/*.test.*' = 0 且 contract 测试通过。
```

---

## 3. 任务总表

| ID | 目标 | 主要写作用域（新建 N / 修改 M） | PR 数 | 依赖 | 风险 | 验收摘要 |
|---|---|---|---:|---|---|---|
| S6-1 | selector 门禁（warn→error）+ codemod + CI 快照 | N scripts/codemod-store-selectors.mjs、report-store-stats.mjs、selector-allowlist.json；M .eslintrc.json、ci.yml | 3 | S3-8/S3-10、S0-2 | 低（误改语法） | E1/E2 |
| S6-2 | storageRegistry 44/44 + envelope + hydrateStores + 迁移 fixture + 体积预算 | N src/lib/storage/storageRegistry.ts、registeredStorage.ts、src/lib/bootstrapStores.ts、useStoresHydrated.ts；M 44 个 store persist 配置（3 批） | 5 | S1-1、S2-4 | 中高（丢设置） | E4/E5/E11 |
| S6-3 | audioStore/playerStore 去重：停双 persist、删双向同步、单向只读投影、旧 key 迁移 | M audioStore.ts、playerStore.ts、bootstrap.ts、N src/lib/playback/playerProjection.ts、测试 | 3 | S2-4 | 中高（播放回归） | E8、写路径唯一 |
| S6-4 | audioStore 播放字段消费迁移（80+ 文件，4 批） | M 组件/hooks（按域分批）；N scripts/report-audio-consumers.mjs | 4 | S6-3 | 中高（面大） | audioStore 播放字段引用=0 |
| S6-5 | 队列/EQ 副本删除 + SCC 消除 | M audioStore.ts、queueStore.ts、eqStore.ts、playlistStore.ts + 残余消费文件 | 3 | S1-5、S6-3、S6-9a | 中 | E3/E9 |
| S6-6 | UI 域拆分：uiShellStore/panelStore/toastStore + uiStore 兼容 facade | N src/store/uiShellStore.ts、panelStore.ts、toastStore.ts；M uiStore.ts + 29 个面板消费文件 | 4 | S3 | 中高 | 每类事实 owner=1 |
| S6-7 | 主题单一来源 + CSS 变量 + 防闪烁 | N src/store/themeStore.ts、src/hooks/useThemeVars.ts、ThemeBootScript.tsx；M useDynamicTheme.ts、layout.tsx、visualSettingsStore.ts | 3 | S6-6、D6 | 中（闪烁） | 主题来源唯一 |
| S6-8 | 全屏/toast/性能档去重 | M uiShellStore.ts、visualizationStore.ts、performanceV8Store.ts、AchievementToast.tsx；N src/store/qualityStore.ts | 3 | S6-6、S5-6、D5 | 中 | 每类事实 owner=1；key -2 |
| S6-9 | domain 用例层 + 类型化事件 + 旧 coordinator 退场 | N src/domain/playback/*、domain/queue/*、domain/library/*、lib/events/domainEvents.ts、hooks/usePlaybackCommands.ts；M audioStore.ts、store/coordinator/* | 4 | S6-4、S6-5 | 中高（播放核心） | E3、domain 无 zustand |
| S6-10 | 分层穿透收敛：组件/service/lib getState | M 45 组件 + 3 service + 8 lib + .eslintrc.json | 4 | S6-9 | 中 | E6/E7 |
| S6-11 | contract 测试矩阵（44 key/21 边/播放一致性/hydration） | N src/store/__contract__/*.test.ts（8 文件）、fixtures | 2 | S6-2、S6-3 | 低 | 矩阵全绿 |
| S6-12 | 行数棘轮 + depcruise 边界门禁 | N .dependency-cruiser.cjs、scripts/check-file-size.mjs、check-store-graph.mjs；M ci.yml、package.json | 2 | S0-2、S6-1 | 中（首跑暴露存量） | E10 |

**执行顺序（串行主干 + 并行支线）**：S6-1 ∥ S6-2 → S6-3 → S6-4 ∥ S6-6 → S6-9a → S6-5 → S6-9b/c → S6-7/S6-8 → S6-10 → S6-11/S6-12。
> 说明：总计划写 "S6-9 依赖 S6-4/5"，但消除 audioStore→playlistStore SCC 必须先把 playSong 的本地库兜底（audioStore.ts:529-540）改为 port 注入，因此拆出 **S6-9a**（domain 骨架 + playSong 用例）前置到 S6-5 之前；这是本执行计划对总计划的唯一顺序修订。

---

## 4. 逐任务执行步骤

### S6-1 selector 门禁 + codemod + CI 快照（3 个 PR，~250 行 + 脚本）

- **目标**：机器拦住新增整店订阅；存量残余用 codemod 收敛；快照阈值进 CI。
- **前置**：S3-10（组件层整店订阅已 ≤10）；S0-2 ci.yml 可用。
- **写作用域**：新建 scripts/codemod-store-selectors.mjs、scripts/report-store-stats.mjs、scripts/selector-allowlist.json、perf/store-stats-baseline.json；修改 .eslintrc.json、.github/workflows/ci.yml（共享串行文件，Lead 排期）。
- **Step 1（S6-1a）报告脚本**：report-store-stats.mjs 复用审计 A `scratch/store-arch-auditor/analyze.mjs` 口径，用 TypeScript compiler API 扫 src 下 ts/tsx（排除 *.test.*、.v7、.fix），输出 JSON：`{wholeCalls, wholeOnlyFiles, perStore, storeEdges, scc, getStateByLayer, persistCoverage}`；支持 `--check`（阈值来自 perf/store-stats-baseline.json）与 `--json <path>`。
- **Step 2（S6-1a）ESLint 规则**：.eslintrc.json 的 rules 增加
  `"no-restricted-syntax": ["warn", {"selector": "CallExpression[callee.name=/^use[A-Z][A-Za-z0-9_]*Store$/][arguments.length=0]", "message": "禁止整店订阅：useXStore(s => s.field)，多字段用 useShallow" }]`。
  **替代方案（待核实）**：若 ESLint 8 + @typescript-eslint 组合不接受 esquery 正则，则改由 report-store-stats.mjs 的 wholeCalls 阈值承担门禁，ESLint 只作提示。
- **Step 3（S6-1b）codemod 规则**（scripts/codemod-store-selectors.mjs，TypeScript compiler AST）：
  1) 命中 VariableDeclaration → ObjectPattern，initializer 为 CallExpression，callee 名匹配 `/^use[A-Z][A-Za-z0-9_]*Store$/` 且 arguments.length===0；
  2) 仅处理位于组件/自定义 hook 函数体**顶层语句**的节点（父链直接到 BlockStatement；if/for/&&/?:/try 内跳过并写 TODO）；
  3) 拆成每属性一个原子调用 `const a = useXStore((s) => s.a);`；字段 ≥4 且全为基础值时输出 useShallow 合并版并标 `// TODO(S6-1): 确认浅比较`；
  4) 跳过：...rest、计算属性、字段名 actions/state、文件内存在同 hook 非空参调用（避免顺序语义变化）；
  5) 产出 `scratch/codemod-report.json`（{file,line,store,fields,safe}）；单文件改动 >80 行则跳过交人工；--write 前自动备份到 scratch/codemod-backup/。
- **Step 4（S6-1b）干跑/分批写入**：`node scripts/codemod-store-selectors.mjs --dry-run --glob "src/components/**/*.tsx"` → 核对 safe 数；再按 `--batch shell|panels|widgets` 写入；每批 ≤400 行、单独 PR。
- **Step 5（S6-1c）收紧**：残余白名单进 scripts/selector-allowlist.json（初始应为 0 或仅 src/hooks/*）；ESLint 规则 warn→error；CI 增加 `node scripts/report-store-stats.mjs --check`（阈值 wholeCalls ≤10、wholeOnlyFiles=0）。
- **测试**：`scripts/__tests__/codemod-store-selectors.test.ts` 用 5 个 fixture（单字段/多字段/条件内/解构别名/rest）断言输出与跳过原因；`src/store/__contract__/selectorSnapshot.contract.test.ts` 断言脚本 JSON 与阈值。
- **验证**：`node scripts/report-store-stats.mjs --check`（exit 0，wholeCalls=0）；`npx eslint src --max-warnings=0`（0 problems）；`npx vitest run scripts src/store/__contract__/selectorSnapshot.contract.test.ts`。
- **验收**：E1/E2 达标；新增整店订阅在 CI 直接 failed。
- **回滚**：revert codemod 批次（逐批独立）；ESLint 规则回 warn。
- **风险**：codemod 误改导致条件 hook 顺序变化 → 只处理顶层语句 + 单测 fixture；断言脚本口径漂移 → 报告脚本与审计脚本同源。

### S6-2 持久化基础设施：44/44 registry + envelope + hydrateStores + 迁移（5 个 PR，~1,300 行）

- **目标**：清单即代码；所有 key 有 owner/version/migrate/backup/预算；显式 hydration 消除首屏 22 次同步 hydrate（审计 A §2.5/§2.7）。
- **前置**：S1-1 registry v1、S2-4 写盘降频、D4（备份不含音频）拍板。
- **写作用域**：新建 src/lib/storage/storageRegistry.ts、registeredStorage.ts、src/lib/bootstrapStores.ts、src/lib/storage/useStoresHydrated.ts、src/lib/storage/fixtures/*.json、storageRegistry.test.ts；修改 44 个 store 的 persist 配置（3 批，每批 ≤15 文件）、src/components/layout/GlobalClientComponents.tsx（调用 hydrateStores；共享串行）、src/app/layout.tsx（可选）。
- **Step 1（S6-2a）registry 44 条 + 一致性测试**：类型按总计划 §4.5；每条含 `legacyKeys?`（读旧写新）；backup 按 D4；owner 填 store 名。测试断言：`grep "persist(" src/store` 的 name 集合 == registry key 集合（44 个，审计 A §2.6）；每条 version ≥1；同 key 无重复 owner。
- **Step 2（S6-2b）envelope + registeredStorage**：
```ts
// src/lib/storage/registeredStorage.ts
import type { StateStorage } from "zustand/middleware";
export interface StorageEnvelope<T = unknown> { v: number; savedAt: number; data: T; }
export function createRegisteredStorage(key: string): StateStorage {
  // getItem: 读 localStorage[key] → 解析 envelope（无 envelope 视为旧版 {state,version}）
  //          → 返回 zustand 期望的原始字符串（保持 zustand persist 解析职责不变）
  // setItem: 包装为 { v: entry.version, savedAt: Date.now(), data: raw } 后写 localStorage
  // legacyKeys: 新 key 无值且旧 key 有值 → 迁移读取并标记 pendingDeleteLegacy（本版本不删）
}
```
  向后兼容：**不改 zustand persist 的 {state,version} 语义**，envelope 只是外层包装；旧数据（无 envelope）按 entry.version 处理；读取失败一律回退旧接口并 console.warn，不得抛错。
- **Step 3（S6-2b）hydrateStores 显式顺序**：
```ts
// src/lib/bootstrapStores.ts
export type HydrationPhase = "playback" | "queue" | "audioProjection" | "ui" | "business";
export async function hydrateStores(): Promise<{ phases: Record<HydrationPhase, number> }>;
// 顺序：playerStore → queueStore →（S6-3 后）audioStore 投影 → uiShellStore/themeStore → 业务域
// 全部 persist 设 skipHydration: true，由 hydrateStores 调 store.persist.rehydrate()
```
  首帧不等待：GlobalClientComponents 挂载后 `void hydrateStores()`；需要"已 hydrate"的组件用 `useStoresHydrated()`（内部布尔 store，初始 false）。
- **Step 4（S6-2c/d/e）store persist 配置改造（3 批、每批 ≤15 文件、文件集合不相交）**：批 A 播放与 UI（audioStore/playerStore/queueStore/uiStore/visualSettings/eqStore/audioEffects/crossfade/audioSource 等）；批 B 业务设置（sourceConfig/userAccount/backupRestore/knowledge/linerNotes/lyricSettings/professionalMode/recommendation/stats/listeningJournal/keyboard/gesture 等）；批 C 余下全部。统一模板：
```ts
persist(creator, {
  name: STORAGE_REGISTRY.<owner>.key,          // 禁止字面量 key
  version: STORAGE_REGISTRY.<owner>.version,
  storage: createJSONStorage(() => createRegisteredStorage(STORAGE_REGISTRY.<owner>.key)),
  skipHydration: true,
  migrate: (persisted, from) => STORAGE_REGISTRY.<owner>.migrate?.(persisted, from) ?? persisted,
  partialize,
});
```
  5 个整店持久化（knowledgeStore/linerNotesStore/lyricSettingsStore/professionalModeStore/recommendationStore，审计 A §2.5）本步补 partialize 白名单。
- **Step 5（S6-2e）迁移骨架 + fixture**：每个改结构的 key：version+1 + migrate；fixture 命名 `src/lib/storage/fixtures/<key>.v<from>.json`（旧版真实样例，≤2KB，脱敏）。测试用例命名统一 `it("migrates <key> v<from> → v<to> keeps <fields>")`，断言迁移后字段 + 未丢字段 + version 正确。
- **Step 6 体积预算**：registry 每条 sizeBudgetBytes；hydrateStores 完成后 requestIdleCallback 统计各 key 字节数，超预算 console.warn + 一次性 toast（走 S6-6 toastStore 或 uiStore.showToast 兼容 API）；总量 <2MB、单 key <256KB（audio/queue/lyrics 单列）。
- **测试**：storageRegistry.test.ts（44 key 集合/owner 唯一/backup 分组）；hydrationOrder.test.ts（spy 断言 rehydrate 顺序与 phase 耗时 <50ms/阶段）；registeredStorage.test.ts（envelope 往返、旧格式读取、legacyKeys 读取、写失败降级）；每个 migrate 一个 fixture 用例。
- **验证**：`npx vitest run src/lib/storage src/store --reporter=dot`（全绿）；`npx tsc --noEmit`；`node scripts/report-store-stats.mjs --section=persist`（44/44、whole-store=0）。
- **验收**：E4/E5/E11；旧 JSON fixture 全部通过；刷新后设置/队列不丢（人工 smoke）。
- **回滚**：S6-2c/d/e 按批 revert（store 配置回字面量 key）；registry 与 registeredStorage 保留。
- **风险**：skipHydration 漏配导致某些组件首帧读到默认值 → useStoresHydrated 门禁 + 逐 store 测试；envelope 双层序列化开销 → 只在下一次写入时包装，读路径零额外 parse（待核实基准）。

### S6-3 audioStore / playerStore 去重（3 个 PR，~300 行 + 测试）

- **目标**：消除双向强同步与双份播放持久化；playerStore 唯一 owner，audioStore 仅只读投影（S6-4 后删除投影）。
- **前置**：S2-4；S1-6 媒体桥（避免与 hook 改动冲突）。
- **写作用域**：修改 src/store/audioStore.ts、src/store/playerStore.ts、src/lib/bootstrap.ts、src/store/globalStatePersistence.test.ts、playerStore.test.ts、audioStore.test.ts；新建 src/lib/playback/playerProjection.ts、src/store/playbackDedup.test.ts。**禁止并行**：src/hooks/useAudioPlayer.ts、src/app/page.tsx。
- **Step 1（S6-3a）停双 persist 播放字段**：audioStore.ts:705-734 的 partialize 删除播放字段（currentSong/currentTime/duration/currentIndex/volume/isMuted/playbackRate/loopMode/isPlaying），仅保留设置字段（EQ 待 S6-5 再删）；version 由 registry 提供并 +1；新增 migrate：旧 payload 的播放字段**不写入 audioStore**，转存临时键 `audio-store-v4:legacy-playback`（供 playerStore migrate 读取，删除延后一版本）。
- **Step 2（S6-3a）playerStore migrate 合并旧值**：playerStore.ts:148-160 的 persist 增加 version+1 与 migrate(persisted, from)：from 为 0/1 时若 legacy-playback 存在，用其 volume/loopMode/currentTime 补缺（player-store 已有值优先，避免覆盖用户最新状态）。fixture：`src/lib/storage/fixtures/player-store.v1.json` + `audio-store-v4.v1-playback.json`。
- **Step 3（S6-3b）删双向同步**：删除 playerStore.ts:38-44、:59-146 中的 audioStoreSyncListener 调用与 registerAudioStoreSync 导出；删除 playerStore.ts:165-179 全局 subscribe；删除 audioStore.ts:740-782（registerAudioStoreSync 回调）与 audioStore.ts:785-818（反向 subscribe）。替换为单向投影：
```ts
// src/lib/playback/playerProjection.ts
/** 单向只读投影：playerStore(owner) → audioStore(legacy mirror)。S6-4 完成后删除。 */
export function installPlayerAudioProjection(): () => void;
// 内部：usePlayerStore.subscribe(s => s.<field>, v => useAudioStore.setState({<field>: v}))，
// 仅 8 个仍被消费的字段；不反向写回
```
  在 src/lib/bootstrap.ts（客户端启动处）安装一次；HMR/测试需返回 disposer。
- **Step 4（S6-3b）bootstrap 简化**：bootstrap.ts:32-64 删除 audioStore 的 queue/loopMode/currentSong 回填（queue 由 S1-5 queueStore 权威；currentSong 由 playerStore hydrate 提供）；hasRestoredPlaybackState 语义改为 hydrateStores 完成信号（S6-2）。
- **Step 5（S6-3c）测试改写**：globalStatePersistence.test.ts:42 用例名与断言从"三处都持久化"改为"player-store 唯一持久化播放断点；audio-store-v4 仅设置字段"；新增 playbackDedup.test.ts 用例：`"audio-store-v4 no longer persists playback fields"`、`"one playerStore mutation triggers exactly one audio projection write"`、`"legacy playback payload migrates into player-store"`、`"mirror does not write back to player-store"`。
- **验证**：`npx vitest run src/store/playbackDedup.test.ts src/store/playerStore.test.ts src/store/audioStore.test.ts`；`rg "registerAudioStoreSync|audioStoreSyncListener" src` = 0；播放 60s 写盘计数 ≤60（≤1/s）；刷新后 currentSong/volume/loopMode 恢复。
- **验收**：E8；`rg "useAudioStore.subscribe" src/store/audioStore.ts` = 0。
- **回滚**：S6-3a（持久化）与 S6-3b（同步删除）分开 revert；迁移代码保留旧键读取。
- **风险**：迁移期 audioStore 投影字段被旧代码写入造成漂移 → audioStore.setState 只在投影文件内调用，加 ESLint 约束（S6-10）；isPlaying 与 playbackRuntimeStore 重叠留待 S6-9 统一。

### S6-4 audioStore 播放字段消费迁移（4 个 PR，每批 ≤400 行，80+ 文件）

- **目标**：组件/hook 的播放状态读取全部指向 playerStore（或 PlaybackClock 的进度），audioStore 播放字段引用归零，为 S6-5 删除铺路。
- **前置**：S6-3；S3 已清零整店订阅（本任务只换 store 来源，不再改订阅粒度）。
- **写作用域**：分批修改 src/components/**、src/hooks/**（列表由脚本生成）；新建 scripts/report-audio-consumers.mjs、perf/reports/s6-audio-consumers.json。**禁止并行**：src/store/*、src/app/page.tsx、src/hooks/useAudioPlayer.ts。
- **Step 1 生成消费清单**：`node scripts/report-audio-consumers.mjs --json perf/reports/s6-audio-consumers.json`，输出 {file, field, action, kind: read|write}；口径：useAudioStore(...) / useAudioStore.getState() + 字段名匹配 8 个播放字段。已实测代表文件：src/hooks/useAudioPlayer.ts:1-6、src/hooks/useDynamicTheme.ts:1-3（读 currentSong）、src/components/player/QueuePanel.tsx、src/components/visualization/VisualizationView.tsx、src/components/layout/PlayerView.tsx、src/components/player/Apple3DQueueDrawer.tsx。
- **Step 2 映射表**（字段→替代 API）：

  | audioStore 字段 | 替代（读） | 替代（写） |
  |---|---|---|
  | currentSong | usePlayerStore(s => s.currentSong) | playerStore.setCurrentSong / usePlaybackCommands.playSong |
  | isPlaying | usePlayerStore(s => s.isPlaying) | playerStore.setIsPlaying / playbackRuntime 派生 |
  | currentTime/duration | PlaybackClock 订阅（进度条/歌词）；一次性读取用 playerStore.getState() | 不写；检查点由 S2-4 管 |
  | volume/isMuted/playbackRate/loopMode/isLoading | usePlayerStore 原子 selector | playerStore 同名 setter |
- **Step 3 分批（文件集合不相交，先全局壳后面板）**：
  - **4a 全局壳/播放器（≤25 文件，≤400 行）**：src/app/page.tsx 不直接读 audioStore（若 hook 内读则改 hook）、components/layout/{HomeView,PlayerView,HeaderToolbar,AppleUnifiedNavIsland}.tsx、components/player/{Player3D,Apple3DQueueDrawer}.tsx、components/features-v7/{DesktopLyrics,VisualizationToggle,...}.tsx。
  - **4b 可视化/歌词（≤25 文件）**：components/visualization/VisualizationView.tsx、components/lyrics/**、lib/audio/PlaybackClock.ts 消费点（只读进度）。
  - **4c 面板/业务组件（≤40 文件）**：components/player/QueuePanel.tsx、components/library/**、components/settings/**、components/emotion/**。
  - **4d hooks/services 残余（≤15 文件）**：hooks/useMediaSession.ts 等；hooks/useAudioPlayer.ts 内 getState() 保留（S6-10 白名单）但读取目标换 playerStore。
- **Step 4 写路径改造**：组件事件处理器中的 useAudioStore.getState().setVolume(...) 等改为 usePlayerStore.getState()；跨域编排（playSong/next/prev/queue 结束）**不在本任务改**，交给 S6-9 用例层。
- **测试**：每批加 1 个渲染测试（`src/test/audio-consumers.<batch>.test.tsx`）断言组件在 playerStore 变化时更新、不再订阅 audioStore（mock useAudioStore 调用计数）。
- **验证**：`rg "s[.](currentSong|isPlaying|currentTime|duration|volume|isMuted|playbackRate|loopMode|isLoading)" src/components src/hooks` 逐步归零；每批 `npx eslint <批文件> --max-warnings=0`、`npx tsc --noEmit`、`npx vitest run src/components src/hooks`。
- **验收**：audioStore 播放字段引用=0；播放/暂停/切歌/进度/音量 UI 与基线一致（截图/录屏）。
- **回滚**：逐批 revert（4a/4b/4c/4d 独立）。
- **风险**：批量改 selector 触发渲染次数变化 → 每批只换来源不合并订阅；进度条误用 store 导致 4Hz 重渲染 → 强制 PlaybackClock。

### S6-5 队列/EQ 副本删除 + audioStore↔playlistStore SCC 消除（3 个 PR，~300 行）

- **目标**：queueStore 是队列唯一 owner，eqStore 是 EQ 唯一 owner；删除 audioStore 的 queue/currentIndex/EQ 字段与 action；消除唯一 SCC。
- **前置**：S1-5（QueueNavigator 接管 next/prev）、S6-3、**S6-9a**（playSong 用例接收 library port）。
- **写作用域**：修改 src/store/audioStore.ts、queueStore.ts、eqStore.ts、playlistStore.ts、残余消费文件（components/player/QueuePanel.tsx、components/audio/AudioEqualizer.tsx 等）、src/lib/bootstrap.ts；测试 3 个文件。**共享串行**：audioStore.ts。
- **Step 1（S6-5a）队列字段删除**：删除 audioStore.ts:77-78（queue/currentIndex 字段）、:130-131（setQueue/setCurrentIndex 类型）、:240-241（初始值）、:391-392（setter），以及 :394-494 nextSong/prevSong 中的 queue 副本读取（改为调 S1-5 QueueNavigator）；:504-592 playSong/playQueue 与 :658-692 appendSongsAndPlay 中写 queue 副本的分支改为只写 queueStore（由 S6-9a 用例统一）。消费文件改 useQueueStore selector。queueStore.ts 的 getCurrentSong（:323-329）保持。
- **Step 2（S6-5b）EQ 去重**：删除 audioStore.ts:83-86（4 字段）、:143-147（action 类型）、:246-249（初始值）、:594-625（EQ action 实现）；持久化字段已在 S6-3 移出。eqStore.ts:28-79 的 key `eq-store` version+1 + migrate：from<2 时从 audio-store-v4 旧 payload 读取 eqBands/currentEQPreset/isEQEnabled/customEQPresets（仅当 eq-store 无值）补入；fixture `fixtures/eq-store.v1.json`。消费文件（`rg "eqBands|currentEQPreset|isEQEnabled|saveCustomEQPreset|loadEQPreset" src`）改 useEQStore。
- **Step 3（S6-5c）SCC 消除**：删除 audioStore.ts:6（import { usePlaylistStore }）与 audioStore.ts:529-540 的本地库兜底；改由 S6-9a 的 library.getSongs() port 注入（UI 层 usePlaybackCommands 传入 usePlaylistStore.getState().songs）。playlistStore.ts:5 的 import { useAudioStore } 若仅为 playSong 调用则改为 usePlaybackCommands（待核实其使用点，实测该 import 存在）；随后 check-store-graph.mjs 断言边数下降、SCC 为空。
- **Step 4 测试**：src/store/queueOwnership.test.ts：`"queue edits go to queueStore only"`、`"nextSong reads queueStore snapshot after external removal"`；src/store/eqOwnership.test.ts：`"audioStore exposes no EQ writable state"`、`"eq-store migrates legacy audio-store-v4 EQ fields"`；storeGraph.contract.test.ts（S6-11 建，本任务先加占位）断言 SCC=0。
- **验证**：`rg "s[.](queue|currentIndex|eqBands|currentEQPreset|isEQEnabled|customEQPresets)" src/components src/hooks` = 0；`rg "usePlaylistStore" src/store/audioStore.ts` = 0；`node scripts/check-store-graph.mjs` 输出 scc=[]；队列删/排/清 → 播完切歌正确（smoke）。
- **验收**：E3（SCC=0）；E9（audioStore 818 → <400 行，预计 ~330）；EQ 面板与听感不变。
- **回滚**：5a/5b/5c 三个 PR 独立 revert；EQ 迁移保留旧 payload 读取。
- **风险**：队列字段删除面大（实测 audioStore 静态 import 104 文件，含测试）→ S6-4 先迁移；EQ 双写历史造成听感变化 → 迁移后 A/B。

### S6-6 UI 域拆分：uiShellStore / panelStore / toastStore + uiStore 兼容 facade（4 个 PR，~400 行）

- **目标**：把 uiStore.ts 的 3 类事实拆为独立 owner：壳（view/transition/fullscreen/nav）、面板（panels）、toast；旧 useUIStore 保留兼容 facade。
- **前置**：S3-1/S3-2（page/壳已 selector 化）、S6-2（hydration）。D6 若选 B（uiStore 独占主题）则 S6-7 改走本 store。
- **写作用域**：新建 src/store/uiShellStore.ts、panelStore.ts、toastStore.ts、测试 3 个；修改 src/store/uiStore.ts（facade）、29 个面板 action 消费文件（PanelOrchestrator.tsx、HeaderToolbar.tsx、AppleUnifiedNavIsland.tsx、features-v7/*Toggle.tsx、Shelf3DView.tsx 等；实测 `openPanel|closePanel|togglePanel|isPanelOpen` 共 147 处 / 29 文件）、GlobalClientComponents.tsx（共享串行）、page.tsx（共享串行）。
- **Step 1（S6-6a）panelStore**（transient，不持久化）：字段 panels: Record<PanelName, boolean> + openPanel/closePanel/togglePanel/closeAllPanels/isPanelOpen；PANEL_NAMES/FULLSCREEN_PANELS 从 uiStore.ts:54-111 迁出；保持 openPanel 的全屏面板互斥语义（uiStore.ts:230-247）。PanelOrchestrator.tsx 的样板（useStoreWithEqualityFn(useUIStore, s => s.panels, shallow)，审计 B §5.3 点名）改为 usePanelStore。
- **Step 2（S6-6b）toastStore**（transient）：字段 toasts: ToastMessage[] + showToast/removeToast（逻辑来自 uiStore.ts:279-295，78 处调用不变，通过 facade 转发）；ToastMessage 增加 `variant?: "toast" | "achievement"`（S6-8 用）。
- **Step 3（S6-6c）uiShellStore**（持久化，key 沿用 `ui-store-v2` 以保数据）：字段 currentView/isTransitioning/isNavMenuOpen/isFullscreenLyrics/fullscreenSurface/isFullscreen + actions；version 3（registry）+ migrate：from<3 用默认值补 fullscreenSurface，保留 currentView；删除 mimimusic_active_view 双通道（uiStore.ts:197-216、:323-333、:363-372 三处写读），page.tsx:86 的 restorePersistedView() 删除（currentView 由 persist hydrate 提供）。
- **Step 4（S6-6d）uiStore 兼容 facade**：uiStore.ts 只保留
```ts
/** @deprecated since S6-6. Use useUiShellStore / usePanelStore / useToastStore. Removal: 下一 minor 版本. */
export { useUiShellStore as useUIStore };   // 壳字段 + 兼容 action 名转发
export { usePanelStore, useToastStore };
```
  实现方式：facade 直接重导出 uiShellStore，并在 uiShellStore 提供兼容 action 名（openPanel/closePanel/showToast/... 转发到 panelStore/toastStore）——**不新造合并 store**；剩余只读旧字段的调用点由 S6-1 的 codemod 迁移，编译错误即清单。
- **Step 5 分批迁移**：6a 面板（29 文件，≤400 行）→ 6b toast（useUIStore(s => s.toasts/removeToast) 消费点，GlassToast.tsx 等）→ 6c 壳（page.tsx/useDynamicTheme/HomeView/PlayerView/VisualizationView/HeaderToolbar/Apple3DQueueDrawer/AIToolbox/UnifiedDataManagerHub/PlayerSkinsPanel/FloatingExpandedState 等 17 个活文件，实测 useUIStore() 19 处活调用）→ 6d 删除 uiStore 内部实现。
- **测试**：src/store/uiShellStore.test.ts（view/fullscreen 互斥、migrate v2→v3）；panelStore.test.ts（open/close/toggle/全屏互斥、PANEL_NAMES 44 项）；toastStore.test.ts（show 自动 remove 定时、id 唯一）；uiStore.facade.test.ts（旧 API 等价）。
- **验证**：`rg "useUIStore[(][)]" src` = 0（活文件）；`rg "from .@/store/uiStore." src` 仅白名单（GlassToast/遗留测试）；`npx vitest run src/store src/components/layout`。
- **验收**：E1；toast/面板操作不再触发 page 重渲染（Profiler commit 组件数下降 ≥80%，S3 已测、此处不退化）；V7 保护视图截图一致。
- **回滚**：6a-6d 独立 revert；uiShell version 迁移保留旧字段读取。
- **风险**：29 文件面板 action 迁移量大 → 先建 panelStore 再 facade 转发，最后逐批换 import；page.tsx 与手势分支冲突 → 必须 S0-1 后。

### S6-7 主题单一来源 + CSS 变量 + 防闪烁（3 个 PR，~300 行）

- **目标**：themeStore 唯一可写主题；uiStore/visualSettingsStore 只读派生或删除；CSS 变量单点写入；刷新/切歌不闪。
- **前置**：D6=A；S6-6（uiShell 拆分）；S3-1 的 CssVarsStyle（若无则本任务先建叶子组件）。
- **写作用域**：新建 src/store/themeStore.ts、src/hooks/useThemeVars.ts、src/components/layout/ThemeBootScript.tsx、3 个测试；修改 src/hooks/useDynamicTheme.ts（:137-160 整店订阅 + setThemeColors 双写）、src/app/page.tsx:98-119（style jsx global 内插）、src/app/layout.tsx:20（固定 className="dark"）、src/store/uiStore.ts（facade 主题字段）、src/store/visualSettingsStore.ts:457-470、:618-634。
- **Step 1（S6-7a）themeStore**：key `theme-store-v1`（**新 key**，见 Q1）；字段 themeMode/themeColors/isDynamicTheme/currentTheme/customTheme/followSystemTheme/autoDayNight + actions；version 1；registry 注册 group:"ui"、backup:true。
- **Step 2（S6-7a）一次性迁移**：src/lib/storage/migrations/themeFromLegacy.ts 在 hydrateStores 的 ui 阶段执行——读 ui-store-v2（themeMode/themeColors/isDynamicTheme）与 visual-settings-v4（currentTheme/customTheme/followSystemTheme/autoDayNight），若 theme-store-v1 无值则写入；旧字段本版本不清除（N1）；fixture 两个旧 JSON。
- **Step 3（S6-7b）消费迁移**：useDynamicTheme.ts:137-160 改 useThemeStore 原子 selector（themeColors 改为"不订阅返回值，只执行副作用"）+ setThemeColors 写 themeStore；VisualSettings.tsx 的主题预设区（实测 visualMode 10 处、currentTheme 等 56 处）改为 useThemeStore；PlayerSkinsPanel 只读主题。
- **Step 4（S6-7b）CSS 变量单点**：useThemeVars.ts 以 useEffect document.documentElement.style.setProperty(--theme-*) 写入（复用 useDynamicTheme.ts:142-160 已有写法）；删除 page.tsx:98-119 中主题色内插，保留静态 token；--blur-intensity/--animation-speed 归 visualSettings（S3-1 已做则不重复）。
- **Step 5（S6-7c）防闪烁 + 删除重复字段**：layout.tsx:20 固定 dark 改为服务端默认 dark + 内联 ThemeBootScript（script dangerouslySetInnerHTML）在首帧前读 localStorage[`theme-store-v1`] 的 themeMode 设置 html.class；随后（独立 PR、下一版本）删除 ui-store-v2 与 visual-settings-v4 的主题字段（version+1 migrate 丢弃，旧 key 保留）。
- **测试**：themeStore.test.ts（preset/自定义/system 模式、migrate 合并优先级）；themeMigration.test.ts（两旧 fixture → theme 值完整、旧 key 不被删除）；useThemeVars.test.ts（jsdom 断言 CSS 变量写入次数=字段变化次数）；themeSource.contract.test.ts（静态断言 theme 字段只出现在 themeStore）。
- **验证**：`rg "themeColors|themeMode|isDynamicTheme|currentTheme|customTheme" src/store` 仅 themeStore + facade；切歌 3 次/light↔dark/刷新：无闪白（录屏帧对比）；`npx vitest run src/store/themeStore.test.ts src/hooks/useThemeVars.test.ts`。
- **验收**：主题唯一来源（11 组去重之一）；persist key +1（theme-store-v1）且旧 key 不丢；页面主题色与基线一致（截图）。
- **回滚**：themeStore 保留、useDynamicTheme 回旧 uiStore 写入；新 key 数据不影响旧代码。
- **风险**：新 key 与备份覆盖（S1-2 的 includedStores 需同步）；inline boot script 与 Electron/CSP 兼容（待核实）。

### S6-8 全屏 / toast / 性能档去重（3 个 PR，~250 行）

- **目标**：3 个 isFullscreen → 1 个枚举；2 套 toast → 1 个带 variant；2 套性能档 → qualityStore 单一 owner。
- **前置**：S6-6（toastStore/uiShellStore）、S5-6 qualityTier、D5 拍板。
- **写作用域**：修改 src/store/uiShellStore.ts、visualizationStore.ts:29-51（isFullscreen 在 :31）、visualizationV8Store.ts:9-17、:107-116、statsAchievementsStore.ts:70-76、:706-728、:917-924、:948-950、components/shared/AchievementToast.tsx:56-57、visualSettingsStore.ts:457-470（visualMode 在 :462）、performanceV8Store.ts:7-8、:104-164；新建 src/store/qualityStore.ts、3 个测试。**共享串行**：uiShellStore.ts。
- **Step 1（S6-8a）全屏枚举**：uiShellStore 增加 `fullscreenSurface: "none" | "player" | "visualization" | "lyrics"` 与 setFullscreenSurface；删除 uiStore.isFullscreen/isFullscreenLyrics（facade 转发到枚举）、visualizationStore.isFullscreen（:31 与 setter/toggle）、visualizationV8Store.isFullscreen（:16、:105；其 partialize :109-115 未持久化，删除无数据风险）；native document.fullscreenElement / Electron 分支收敛到 toggleFullscreen 单 action（逻辑来自 uiStore.ts:300-318）。消费文件（实测 11 文件 44 处 isFullscreen|isFullscreenLyrics，含测试）逐个改 selector。
- **Step 2（S6-8b）toast 合并**：statsAchievementsStore.ts:706-728 的 activeToasts push/remove 改为 useToastStore.getState().showToast(msg, "success", 5000, {variant:"achievement", achievement})；删除 statsAchievementsStore.ts:70-76 的 activeToasts 字段、:948-950 的 dead prune（审计 A P1-08：不在 partialize 却清理）；AchievementToast.tsx:56-57 改为订阅 useToastStore 的 achievement 派生 selector（useShallow 或 selectors/toastSelectors.ts）。
- **Step 3（S6-8c）性能档合并**：新建 qualityStore（transient 或 key `quality-store-v1`）：字段 tier: "low"|"medium"|"high"、config: PerformanceConfig、source: "auto"|"user"、setTier/setAuto；从 performanceV8Store.ts:38-73 迁移 configs，从 visualSettingsStore.visualMode（:462、:477）与 performanceV8Store.activePreset（:7-8、:88-99）迁移用户预设；performanceV8Store 保留 FPS/CPU/内存 telemetry（字段 :10-20），删除 activePreset 与 setPerformancePreset；VisualSettings.tsx 的性能档 UI 改 qualityStore；S5-6 qualityTier 自动降档写 qualityStore。
- **测试**：fullscreenMatrix.test.ts（enum 与 native/Electron 状态一致、互斥规则）；toastVariants.test.ts（成就 toast 走统一容器、自动消失、UI 样式仍由 AchievementToast 渲染）；qualityTierOwnership.test.ts（auto 降档不覆盖 user 选择、migrate 旧 visualMode/activePreset）。
- **验证**：`rg "isFullscreen" src/store` 仅 uiShellStore + 测试白名单；`rg "activeToasts" src` = 0（除测试）；`rg "visualMode|activePreset" src/store` 仅 qualityStore/legacy 迁移；`npx vitest run src/store src/components/shared`。
- **验收**：每类事实 owner=1；persist key 数据 -1 字段组（visual-settings-v4 去 visualMode；performance-v8-store 去 activePreset）；全屏按钮行为与基线一致。
- **回滚**：8a/8b/8c 独立 revert；质量档 migrate 保留旧值读取。
- **风险**：全屏涉及 Electron 原生窗口状态 → 只改状态来源不动 IPC；成就 toast 属用户可见 → 截图对比。

### S6-9 domain 用例层 + 类型化事件 + 旧 coordinator 退场（4 个 PR，~400 行）

- **目标**：把 audioStore 的播放编排抽成无 React/无 zustand 的纯用例，由 hooks 注入 ports；跨域通知走类型化事件；旧 coordinator 删除。
- **前置**：S6-3、S6-4；S1-5 QueueNavigator（src/lib/playback/queueNavigator.ts，S1 产出；若未落地则本任务先建）。
- **写作用域**：新建 src/domain/playback/{ports.ts,playSong.ts,nextSong.ts,prevSong.ts,handleQueueEnd.ts,restorePlayback.ts,index.ts}、src/domain/queue/index.ts（re-export src/lib/queue/queueActions.ts 纯函数，保持兼容）、src/domain/library/findSong.ts、src/lib/events/domainEvents.ts、src/hooks/usePlaybackCommands.ts、测试 6 文件；修改 src/store/audioStore.ts（:394-592、:658-692 改薄封装）、src/store/playerStore.ts:145-146（空实现删除或转发）、src/store/coordinator/*（删除，需 Lead 批准）。**共享串行**：audioStore.ts、src/lib/bootstrap.ts。
- **Step 1（S6-9a）纯用例 + ports 接口**（播放核心契约，定稿后不可再改签名）：
```ts
// src/domain/playback/ports.ts
import type { Song } from "@/types/song";
export type LoopMode = "none" | "single" | "all" | "shuffle";
export interface QueueSnapshot { queue: Song[]; currentIndex: number; playThroughMode: "normal" | "play-through" }
export interface PlaybackPorts {
  player: { commitSong(song: Song | null): void; setPhase(intent: { playing: boolean; loading: boolean }): void;
            requestPlayback(song: Song, forceNewGeneration?: boolean): void; clearRequest(): void };
  queue: { snapshot(): QueueSnapshot; setQueue(queue: Song[], index: number): void; setCurrentIndex(index: number): void;
           addToHistory(song: Song): void; updateSong(id: string, updates: Partial<Song>): void };
  library: { getSongs(): Song[] };
  recommendations: { getRecommendations(): Song[] };
}
// src/domain/playback/playSong.ts
export type PlaySongResult =
  | { kind: "started"; song: Song; queue: Song[]; index: number }
  | { kind: "missing-source"; reason: "no-audio-source" }
  | { kind: "empty" };
export function playSongUseCase(input: { song: Song }, ports: PlaybackPorts): PlaySongResult;
// src/domain/playback/nextSong.ts
export type NextSongResult =
  | { kind: "advanced"; song: Song; index: number }
  | { kind: "queue-ended" }
  | { kind: "replaced-by-recommendations"; song: Song; queue: Song[] }
  | { kind: "stopped" };
export function nextSongUseCase(ports: PlaybackPorts): NextSongResult;
// prevSongUseCase / handleQueueEndUseCase / restorePlaybackUseCase 同构；
// nextSongUseCase 覆盖 5 种 loopMode × 空队列/单曲/多曲，等价迁移自 audioStore.ts:394-464
```
  handleQueueEnd 收敛 queueCoordinator.ts:18-24 的 play-through 语义与 audioStore.ts:399-432 的推荐兜底（**只保留一套**）。
- **Step 2（S6-9a）依赖注入（hook 适配层）**：
```ts
// src/hooks/usePlaybackCommands.ts —— 唯一允许跨多 store 编排的层
export function usePlaybackCommands(): {
  playSong(song: Song): PlaySongResult; next(): NextSongResult; prev(): NextSongResult; appendAndPlay(songs: Song[]): void;
};
// 内部 ports = useMemo(() => ({
//   player: { commitSong: (s) => usePlayerStore.getState().setCurrentSong(s), ... },
//   queue: { snapshot: () => useQueueStore.getState(), ... },
//   library: { getSongs: () => usePlaylistStore.getState().songs },
//   recommendations: { getRecommendations: () => useRecommendationStore.getState().getRecommendations() },
// }), []);
```
  组件/面板调用 commands，不再直接调 audioStore.playSong；audioStore.playSong/playQueue/appendSongsAndPlay/nextSong/prevSong 保留 @deprecated 薄封装（内部装配 ports 调 commands）一个版本。
- **Step 3（S6-9b）类型化事件总线**：
```ts
// src/lib/events/domainEvents.ts（~80 行，自研，无新依赖）
export type DomainEvent =
  | { type: "PlaybackStarted"; songId: string }
  | { type: "PlaybackEnded"; songId: string; reason: "ended" | "error" | "user" }
  | { type: "QueueEnded" } | { type: "TrackChanged"; from: string | null; to: string }
  | { type: "QueueMutated"; reason: "add" | "remove" | "reorder" | "clear" }
  | { type: "ThemeChanged"; source: "auto" | "user" };
export function emitDomainEvent(event: DomainEvent): void;
export function subscribeDomainEvent<T extends DomainEvent["type"]>(
  type: T, handler: (e: Extract<DomainEvent, { type: T }>) => void
): () => void;
```
  订阅方登记到 `evidence/S6-event-subscribers.md`（禁止隐式耦合）；首用：ListeningRecorder（统计）、useDynamicTheme（TrackChanged 提取主题）。
- **Step 4（S6-9b）store 间边收敛**：audioStore.ts 删除对 queueStore/recommendationStore/playerStore/playlistStore/eqStore 的 5 条运行时 import（:3-7）——改用例层注入后 audioStore 只保留 import type；sleepTimerStore→audioStore、smartPlaylistStore→queueStore 等剩余边按 S6-10 或事件替代；目标 E3 ≤6 且全 type-only。
- **Step 5（S6-9c）旧 coordinator 退场**：S0-5 已标 deprecated + no-restricted-imports；本步确认 `rg "store/coordinator" src` = 0 后删除 src/store/coordinator/ 4 文件（AGENTS 要求"优先标记后删除"，此处已标记 ≥1 版本）；docs/nbl/ARCHITECTURE.md 同步为"未接线（已删除）"。
- **测试**：src/domain/playback/__tests__/playSong.spec.ts（不在库/在队列/在库/缺音源/队列重复 5 例）、nextSong.spec.ts（表驱动 5 loopMode × 3 队列形态 = 15 例）、handleQueueEnd.spec.ts、domainEvents.spec.ts（订阅/退订/异常隔离）、usePlaybackCommands.test.tsx（注入 mock ports，不 mock zustand）、storeGraph.contract.test.ts（E3）。
- **验证**：`rg "from .zustand.|from .react." src/domain` = 0；`npx vitest run src/domain src/store`；`node scripts/check-store-graph.mjs`（边 ≤6、SCC=0、全部 type-only）；`rg "usePlaylistStore" src/store/audioStore.ts` = 0。
- **验收**：audioStore 行数 <400；播放行为由 domain 单测覆盖；组件不再 import 播放编排。
- **回滚**：9a（用例/DI）/9b（事件/边）/9c（删 coordinator）独立 revert；旧 audioStore action 保留一个版本。
- **风险**：播放语义迁移偏差（loopMode/推荐兜底）→ 表驱动测试对照旧实现；性能（ports 每次 getState）→ hook 内 useMemo 单例。

### S6-10 分层穿透收敛：组件/service/lib 的 getState 写状态（4 个 PR，~300 行）

- **目标**：组件 render/事件体与 service 层不再直接 useXStore.getState() 写状态；统一走 hooks/actions/命令；ESLint 分目录约束。
- **前置**：S6-9（commands/ports 可注入）。
- **写作用域**：修改 45 个组件文件、src/services/aiAgentTools.ts（实测 :4-10 import 6 个 store + 15 处 getState）、src/services/MultiSourceResolver.ts（8 处）、src/services/songPurgeService.ts（6 处）、src/lib/bootstrap.ts（8 处，白名单）、src/lib/gesture/actions.ts、src/lib/search/commandExecutor.ts 等 8 个 lib 文件；修改 .eslintrc.json overrides。**禁止并行**：src/store/**（除测试）。
- **Step 1 清单与分批（文件集合不相交）**：`rg "Store[.]getState[(][)]" src/components src/services src/lib -l` 生成；批 A 组件 Top-10（LxMusicSearchTab、AudioSourceManagerModal、DailyRecommendation、QueuePanel、HeaderToolbar 等）；批 B 其余组件；批 C service 3 文件（改为接收 ports 参数，调用方 hook 注入）；批 D lib 8 文件（bootstrap 白名单，其余改入参）。
- **Step 2 组件改造规则**：render 体禁止 getState；事件处理器内允许读取但必须用于调用本 store action（useAudioStore.getState().setVolume → usePlayerStore(s => s.setVolume)）；跨 store 编排调 usePlaybackCommands。
- **Step 3 service port 化**：aiAgentTools.ts 的 playSong/setVolume/nextSong 等工具改为 `ToolContext = { playback: PlaybackPorts; library: { getSongs(): Song[] }; favorites: {...} }` 由 src/hooks/useAIAgentBridge.ts（新建，若已有等价则复用，待核实）注入；MultiSourceResolver 的清缓存/统计调用改为回调参数。
- **Step 4 ESLint 约束**：.eslintrc.json overrides：src/components/** 禁 `CallExpression[callee.object.name=/^use.*Store$/][callee.property.name='getState']`（no-restricted-syntax: error）；src/services/** 禁 no-restricted-imports ["error", {patterns:["@/store/*"]}]；白名单用 eslint-disable-next-line + 理由（CI 统计白名单 ≤5）。
- **测试**：每批加 src/test/getstate-boundary.<batch>.test.ts（静态断言：文件文本不含 getState；或 ESLint API 跑规则）；service port 单测（fake ports）。
- **验证**：E6/E7；`npx eslint src --max-warnings=0`；`npx tsc --noEmit`；`npx vitest run src/services src/test`。
- **验收**：组件 getState=0；service getState=0；lib ≤5 白名单；AI Agent 工具/歌曲清除/解析缓存行为回归。
- **回滚**：逐批 revert；ESLint overrides 先 warn 后 error（与 S6-1 同策略）。
- **风险**：45 组件改动面大 → 只改调用形式不改编排；服务层行为变化 → fake ports 单测。

### S6-11 store contract 测试矩阵（2 个 PR，测试不计行）

- **目标**：把所有权/持久化/依赖/播放一致性变成可执行契约，防止回退。
- **前置**：S6-2（registry/hydration）、S6-3（播放去重）、S6-5（SCC=0）。
- **写作用域**：新建 src/store/__contract__/{storageRegistry,persistenceVersion,quotaPolicy,hydrationOrder,backupRoundtrip,playbackConsistency,selectorSnapshot,storeGraph}.contract.test.ts、src/lib/storage/fixtures/**、src/test/contractHelpers.ts；修改 vitest.config.ts（coverage include 增 src/store/**，需 Lead 排期）。
- **矩阵**：

  | 契约 | 覆盖 | 关键断言 | 文件 |
  |---|---|---|---|
  | 44 key registry | 44 key | key 集合 == grep persist name 集合；每 key owner/version/backup/group 非空；owner 唯一 | storageRegistry.contract.test.ts |
  | 版本迁移 | 每个 version>1 的 key | 旧 fixture 经 migrate 后可被 store 读取；不匹配且无 migrate 时行为显式（重置并 warn） | persistenceVersion.contract.test.ts |
  | 配额策略 | 5 个手写 storage + safeStorage | 模拟 QuotaExceededError 按 registry quotaPolicy 裁剪且不抛错、UI 提示一次 | quotaPolicy.contract.test.ts |
  | hydration 顺序 | hydrateStores | player/queue 先于 audio 投影，ui 在业务域前；全程 <300ms（jsdom 基准） | hydrationOrder.contract.test.ts |
  | 备份往返 | backupRestoreStore + registry | 创建→修改→恢复→rehydrate 后关键字段一致；includedStores == backup=true 集合 | backupRoundtrip.contract.test.ts |
  | 播放一致性 | player/queue/runtime | 一次 play/next/seek 后 player.currentSong == queue.getCurrentSong() == runtime.requestId 最新；**唯一 owner 断言**（旧双写断言删除） | playbackConsistency.contract.test.ts |
  | 21 边 / SCC | store 图 | 运行时边 ≤6 且 type-only；SCC=[]；每边有文档理由 | storeGraph.contract.test.ts |
  | selector 快照 | 全仓 | wholeCalls ≤10；wholeOnlyFiles=0；新增整店订阅=0 | selectorSnapshot.contract.test.ts |
- **Step 1（S6-11a）** 写 6 个测试 + contractHelpers.ts（readStoreFile/parsePersistName/mockQuotaError/seedLocalStorage(key,payload)）；fixtures 从审计 A §2.6 与真实旧 JSON 生成，文件名 `<key>.v<from>.json`。
- **Step 2（S6-11b）** 写 playbackConsistency + selectorSnapshot + storeGraph；`npm run test -- --run src/store/__contract__` 全绿；`--check` 阈值提交为 perf/store-stats-baseline.json。
- **Step 3 失败模式**：每个契约测试必须在 PR 描述贴"故意破坏则失败"的证明（改一行 → 红 → 撤销），防止空断言。
- **验证**：`npx vitest run src/store/__contract__ --reporter=dot`（8 文件 / ≥40 用例全绿）；`npx vitest run --coverage` 中 store 域纳入统计。
- **验收**：矩阵 8 项全绿；TRACKING.md 记录覆盖清单。
- **回滚**：纯新增测试，无产品代码；降噪 skip 需 Lead 批准。
- **风险**：jsdom 与浏览器 localStorage 行为差异 → seedLocalStorage 封装；fixture 体积（≤2KB/个）。

### S6-12 文件行数棘轮 + dependency-cruiser 边界门禁（2 个 PR，~200 行）

- **目标**：把"每 PR ≤400 行 + 分层规则 + 0 循环"变成 CI 机器门禁。
- **前置**：S0-2 ci.yml（部署触发分支当前仍为 main，`.github/workflows/deploy.yml:3-9` 实测，必须在 S0-2 改为 master）；S6-1 报告脚本。
- **写作用域**：新建 .dependency-cruiser.cjs、scripts/check-file-size.mjs、scripts/check-store-graph.mjs、scripts/file-size-baseline.json；修改 package.json（verify:boundaries/verify:filesize 脚本 + devDependency dependency-cruiser）、.github/workflows/ci.yml（共享串行，Lead 排期）。
- **Step 1（S6-12a）depcruise 规则**：禁止循环（no-circular: error）；src/store/** 之间仅 allow type-only（规则 store-to-store-type-only，用 type-only 依赖类型）；src/services/**、src/lib/** 禁止 import src/store/**|src/hooks/**|src/components/**（白名单 src/lib/bootstrap.ts、src/lib/gesture/actions.ts 至 S6-10 完成）；src/app/{page,layout}.tsx 禁 import store（S3-1 已达成，规则固化）；src/domain/** 禁 react/zustand/components/hooks/store。
- **Step 2（S6-12a）行数棘轮**：check-file-size.mjs 读 file-size-baseline.json：新增文件 >400 fail；baseline 存量只允许 ≤ 基线（减行通过、增行 fail）；--update 仅 Lead 在阶段出口执行。基线入档示例（read 实测）：src/store/statsAchievementsStore.ts 972、src/store/audioStore.ts 818、src/store/visualSettingsStore.ts 637、src/store/queueStore.ts 410、src/hooks/useAudioPlayer.ts 1823、src/store/playerStore.ts 179（脚本自动生成全量）。
- **Step 3（S6-12b）CI 接入**：ci.yml 增加两步（eslint 之后、build 之前）：`node scripts/check-file-size.mjs`、`npx depcruise --config .dependency-cruiser.cjs src`；首次以 continue-on-error: false 接入前先本地全量跑并修白名单（目标 0 violations），不允许长期 report-only。
- **Step 4**：文档更新 docs/nbl/CODING_STANDARDS.md（规则编号 R1-R8）与 PR 模板勾选项。
- **测试**：scripts/__tests__/check-file-size.test.ts（超限/缩行/新增三例）；depcruise 规则用 2 个 fixture 目录（scratch/boundary-fixtures，不提交 src）。
- **验证**：`npx depcruise --config .dependency-cruiser.cjs src` 预期 "no dependency violations found"；`node scripts/check-file-size.mjs` 预期 0 violations；`npm run verify:boundaries` exit 0。
- **验收**：E10；新 PR 超 400 行/新增循环/分层越界直接 CI fail。
- **回滚**：CI 步骤单独删除；depcruise 配置回滚不影响代码。
- **风险**：首跑暴露大量存量违规 → 白名单文件显式列出并设到期（S8 清理）；新增 devDependency 需 Lead/用户批准（package.json 共享）。

---

## 5. 阶段级验证命令与证据清单

**执行顺序（禁止并行 build 与 tsc；dev 存活时禁止 clean .next）**

```bash
# 0. 环境：干净工作树 + Node 24 + 已 npm ci
git status --porcelain            # 预期：空（S0-1 后）

# 1. 静态规则（阶段门禁脚本，需 S6-1/S6-12 先落地）
node scripts/report-store-stats.mjs --check          # 预期 exit 0，wholeCalls=0，wholeOnlyFiles=0
node scripts/check-store-graph.mjs                   # 预期 scc=[]，runtimeEdges<=6，typeOnly=all
node scripts/check-file-size.mjs                     # 预期 0 violations
npx depcruise --config .dependency-cruiser.cjs src   # 预期 "no dependency violations found"

# 2. eslint → vitest → tsc（项目固定顺序）
npx eslint src --max-warnings=0                      # 预期 0 problems
npx vitest run --reporter=dot                        # 预期 205+ 文件、0 failed（新增 contract 域纳入）
npx tsc --noEmit --incremental false --pretty false  # 预期 exit 0，0 errors

# 3. build（不并行 tsc）
npm run build                                        # 预期 exit 0；rootMain gzip 不高于 S5 出口值

# 4. dev/smoke（端口 3025）
node scripts/clean-port.js 3025 && npm run dev       # 预期 / 与 /data-manager 200；0 console error/exception
# 专项：切歌/循环/队列编辑→结束；刷新恢复 currentSong/queue/volume/loopMode；主题 light↔dark 不闪；
#       面板开合 20 次无重复 toast；备份→恢复→重载（D4 范围）
```

**证据清单（提交到 evidence/S6-evidence.md）**

| # | 证据 | 采集方式 | 通过标准 |
|---|---|---|---|
| 1 | perf/store-stats-before.json / -after.json | node scripts/report-store-stats.mjs --json | E1/E2/E3/E5/E6/E7 对照 |
| 2 | registry 报告 | node scripts/report-store-stats.mjs --section=persist | 44/44、version 44/44、whole-store 0 |
| 3 | 写盘计数 | patch Storage.prototype.setItem，播放 60s | ≤60 次（≤1/s） |
| 4 | 播放一致性 contract | npx vitest run src/store/__contract__ | 8 文件全绿 + 故意破坏证明 |
| 5 | hydration 时间线 | performance.mark 输出 | phase 顺序正确、总 <300ms（jsdom） |
| 6 | 迁移 fixture 矩阵 | persistenceVersion/backupRoundtrip | 全部旧格式可读 |
| 7 | 受保护视图截图 | Home/Player/全屏歌词 前/后 | 像素差异仅订阅层允许范围（D7） |
| 8 | 主题不闪录屏/帧 | 刷新 5 次 + 切歌 3 次 | 无白闪帧 |
| 9 | depcruise / file-size / eslint 输出 | 命令日志 | 0 violations |
| 10 | 回滚演练 | revert S6-3a + S6-6c 各一次（本地） | tsc/vitest 绿、刷新数据不丢 |

---

## 6. 与相邻阶段的接口 / 交接物

| 方向 | 交接物 | 消费方 |
|---|---|---|
| S1 → S6 | storageRegistry v1、queueStore 唯一权威、queueNavigator、mediaBridge | S6-2/3/5/9 |
| S2 → S6 | 播放写盘 ≤1/s 基线、analyserHub 不依赖 store | S6-3 验收基线 |
| S3 → S6 | selector 基线（整店 ≤10）、CssVarsStyle、playlistSelectors | S6-1/6/7 |
| S5 → S6 | qualityTier（S5-6）与 RUNTIME_V2 开关读取 qualityStore | S6-8 |
| **S6 → S7** | src/domain/playback/ports.ts（服务层可注入）、domainEvents（S7 缓存/解析解耦用） | S7-1/7-2 |
| **S6 → S8** | report-store-stats/check-store-graph/check-file-size/depcruise 四门禁 + 阈值 JSON | S8-1/S8-2 |
| **S6 → S1-2** | registry backup 分组（备份 v5 从 registry 收集） | S1-2 已落地则 S6 只校验一致性 |
| S6 输出文档 | ARCHITECTURE.md（60 store→owner 表）、CODING_STANDARDS.md（R1-R8）、S6-event-subscribers.md | S8-4 文档事实流水线 |

**S6 结束时下游可直接依赖的稳定 API**：STORAGE_REGISTRY、createRegisteredStorage、hydrateStores、useStoresHydrated、usePlayerStore/useQueueStore/useEQStore/useUiShellStore/usePanelStore/useToastStore/useThemeStore/useQualityStore、usePlaybackCommands、playSongUseCase/nextSongUseCase、domainEvents。

---

## 7. 未决问题 / 需用户或 Lead 决策

| # | 问题 | 推荐默认 | 阻塞任务 | 影响 |
|---|---|---|---|---|
| Q1 | 允许新建 persist key（theme-store-v1、quality-store-v1）吗？I1 只禁改/删旧 key | 允许新增，旧 key 保留一版 | S6-7、S6-8 | 需同步 S1-2 备份 includedStores 与文档 44→46 计数 |
| Q2 | audioStore 迁移终点：改名 audioSettingsStore 还是保留名 + 只留设置 | 保留名（减少 104 个 import 文件改动），S8 再改名 | S6-5、S6-9 | 影响 PR 规模与文档 |
| Q3 | 删除旧 key/旧字段的版本窗口（"一个版本"具体=哪个发布？） | 迁移 PR 合入后下一个 minor（CHANGELOG 记录） | S6-2/3/7 | 数据安全 |
| Q4 | 删除 src/store/coordinator/ 需 AGENTS 例外（已标 deprecated ≥1 版本） | 允许删除（S6-9c） | S6-9c | 4 文件 66 行 |
| Q5 | 新增 devDependency dependency-cruiser 是否批准 | 批准（dev-only，无运行时包体影响） | S6-12 | package.json 共享文件需 Lead 串行 |
| Q6 | storageRegistry 是否接管 mimimusic_active_view/mimimusic_offline_downloads 等非 zustand 裸 key | 裸 key 纳入 group:"transient" 或 external:true 标注，不接管读写 | S6-2 | 一致性测试断言范围 |
| Q7 | 视图 currentView 的 emotion 视图是否保留（uiStore.ts:6 类型含 emotion） | 保留，不扩大范围 | S6-6 | — |
| Q8 | 全屏语义是否包含 Electron 原生窗口全屏（F11 与可视化全屏互斥关系） | enum 单独记录 native 状态，不做双向自动同步 | S6-8 | 需要产品确认交互 |

**待核实项（实现前必须用 read/grep 复核，已在文中标注）**：① ESLint 8 + esquery 正则 callee 匹配是否可用；② useMediaSession.ts 的 audioStore 行号（审计 C 记 4,11）；③ playlistStore.ts:5 的 useAudioStore 使用点；④ src/lib/playback/queueNavigator.ts / S1-5 是否已落地；⑤ performanceV8Store 之外其他 activePreset（grep 实测 61 处含 audioEffectsStore/sourceConfigStore 同名字段，需按 store 区分）；⑥ GlobalClientComponents.tsx 当前行号（55 项脏改范围内）。
