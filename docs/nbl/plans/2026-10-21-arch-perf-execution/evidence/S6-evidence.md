# S6 阶段退出证据（M6 出口门）

> 计划依据：[S6-state-architecture.md](../S6-state-architecture.md) §1/§3/§5「阶段级验证命令与证据清单」
> 看板：[TRACKING.md](../TRACKING.md) §S6（行 106–121）｜上游：[架构与性能优化总计划](../../../2026-10-21-architecture-performance-optimization.md) §5 S6
> 生成时间：2026-10-29 18:21（Asia/Shanghai）
> worktree：`D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`
> 分支：`docs/s6-evidence`（自 `e7f076e` 创建；该提交同时是 `integration/s2-audio` 的 HEAD）
> 约束：仅新增本文档；未 push；未改动主工作区 `D:/26project/music_source_code_V1.1_full/music_source_code`。
> 标注约定：**实测** = 本轮在本 worktree 执行并捕获 exit code；**历史** = TRACKING/提交时记录；**结构/合成** = 静态扫描或 jsdom 单测，不是真实浏览器/设备测量；**未验证** = 无证据。

## 0. 结论（先看这里）

- **任务完成度**：TRACKING 记 S6-1..S6-8、S6-10..S6-12 共 11 项 done，**S6-9 未勾选（partial）**。`git log --all --grep='s6-'` 实测 **82 条**：81 条约定式提交 + 1 条 merge 命中（`c736326`，正文含 s6-），其中 S6-12 占 36 条（c..r 拆分 + 文档）。
- **本轮实测（2026-10-29，本 worktree）**：12 组定向测试 **47 文件 / 310 passed，12/12 exit 0**；全量 `npx vitest run` **310 files / 1930 passed / 1 skipped，exit 0**；`npx eslint src --max-warnings=0` **exit 0**；`npm run verify:docs` **fail=0 warn=0，exit 0**；`npx tsc --noEmit` **exit 0**；depcruise **0 errors / 29 warnings**；`check-store-budgets` **PASS**；`report-getstate --check` **PASS**；`report-store-stats --max-whole 0` **OK**。
- **架构数字（实测）**：**64 个 store / 43 个 persist key / 43 个已注册**；hydration 5 阶段 `playback → queue → audioProjection → ui → business`；store 图 **23 条运行时边（脚本口径）/ SCC 0**，`EDGE_BUDGET = 27`；整店订阅 **whole 0 / whole-only 文件 0**；getState 棘轮 **services 0 / components 0 / hooks 0 / lib 4（上限 5）**；store 行数预算 **113 文件 / 19,500 行 / over-cap 0 / SCC 0**；depcruise **0 errors**。
- **M6 未关闭**：6 项出口条件中 **2 项达成**（组件整店订阅 0、audioStore <400 行），**4 项 partial/未达成**（运行时边 ≤6、44/44 key 有 version/migrate、整店持久化 0、11 组重复事实 0）。**因此 M6 不能判绿**；TRACKING 的 done 只表示「实现完成 + 定向验证通过」。
- **本轮新发现（诚实登记）**：
  1. `node scripts/perf/report-store-stats.mjs --check` **exit 1**：基线 `perf/store-stats-baseline.json` 仍是 2026-10-21 的 60 stores / 44 keys，与现状 64 / 43 不符；`perf:gates` 实际走的是 `--max-whole 10`，`--check` 处于**事实禁用**状态。
  2. store 图扫描器把 `queueNavigation -> playerStore` 误判为 type-only（同一条 import 正则跨语句吞行），脚本输出 23 条；用 TypeScript AST 复核为 **24 条运行时边**，SCC 仍为 0。契约测试用同一正则，因此也按 23 条通过。`EDGE_BUDGET` 的 27 条登记原因中，修正后仍有 **3 条**（`useAIAgentStore -> playerStore/favoritesStore/emotionStore`）已无对应边。
  3. 计划中的 `registeredStorage` envelope、`src/lib/storage/fixtures/`、`usePlaybackCommands`、`qualityStore`、`check-store-graph.mjs`、`check-file-size.mjs`、`S6-event-subscribers.md` 均未按计划命名落地（见 §7）。

## 1. 环境与统计口径

| 项           | 值                                                                  |
| ------------ | ------------------------------------------------------------------- |
| OS / shell   | Windows / PowerShell 7（pwsh）                                      |
| Node / npm   | v24.16.0 / 11.13.0（本轮 `node -v` / `npm -v`）                     |
| 测试框架     | Vitest 4.1.5（jsdom，非 watch）                                     |
| 分支 / 基点  | `docs/s6-evidence` ← `e7f076e`（`integration/s2-audio` HEAD）       |
| 变更行数来源 | `git show --numstat <commit>`（代码 + 测试 + 文档合并计；文档单列） |
| 提交统计     | `git log --all --grep='s6-' -i` = 82 条（81 约定式 + 1 merge 命中） |
| 定向测试合计 | **47 文件 / 310 passed / 0 failed，12 条命令全部 exit 0**           |
| 全量测试     | **310 files / 1930 passed / 1 skipped，exit 0**（109.33s）          |

> 分支关系：81 条约定式提交全部可在 `integration/s2-audio` 历史（HEAD `e7f076e`）中检索到；各 `feature/arch-perf-s6-*` 分支 tip 未逐一做 `merge-base --is-ancestor` 断言（本轮只验证内容可达）。历史提交均未 push。

## 2. S6-1..S6-12 交付与验证

### 2.0 `git log --all --oneline --grep='s6-'`（实测 82 条）

```text
c736326 Merge feature/arch-perf-s1-2a (5862795) into integration/s1-batch (496186f).
739d8f2 docs(s6-5): update store count to 64
09ba933 refactor(s6-5): remove queue mirror and EQ duplicates
11363e8 docs(s6-9): record getState lint override
bbad439 chore(s6-9e): add no-getState lint override for lib/services
7602624 refactor(s6-9d): converge hook getState calls
a79892b docs(s6-12): mark store budgets and depcruise done
18fa51d refactor(s6-12r): split stats achievements store under 400
01cef72 docs(s6-12): record offline download store trim
8b65618 refactor(s6-12q): trim offline download store under 400
566248b docs(s6-12): record user account store trim
6488fbe refactor(s6-12p): trim user account store under 400
0b8e73d docs(s6-12): record AI agent store trim
4bb0985 refactor(s6-12o): trim AI agent store under 400
d088d99 docs(s6-12): record visual settings store trim
e1a3e14 refactor(s6-12n): trim visual settings store under 400
61e3f29 docs(s6-12): record source config store trim
fc7b2df refactor(s6-12m): trim source config store under 400
487b6ad docs(s6-12): record smart playlist store trim
9c14dd4 refactor(s6-12l): trim smart playlist store under 400
3d3a21e docs(s6-12): record AI store trim
5764f8e refactor(s6-12k): trim AI store under 400
2035844 docs(s6-12): record audio effects store trim
ac572b9 refactor(s6-12j): trim audio effects store under 400
055eb61 docs(s6-12): record emotion store trim
c8b5475 refactor(s6-12i): trim emotion store under 400
3c3d359 docs(s6-12): record backup store trim
cb4982f refactor(s6-12h): trim backup store under 400
2e38d85 docs(s6-12): record search store trim
bbfcf14 refactor(s6-12g): trim search store under 400
bcdbd07 docs(s6-12): record playback slice trim and refresh README
cd2677e refactor(s6-12f): trim playback slice under 400
61f1591 docs(s6-12): record queue store trim
a43f799 refactor(s6-12e): trim queue store under 400
1bc381f docs(s6-12): record lyrics cover store trim
1a49986 refactor(s6-12d): trim lyrics cover store under 400
b27db9d docs(s6-12): record library store trim
be22596 refactor(s6-12c): trim library manager store under 400
1798f17 docs(s6-9): record lib getState convergence
a0c327e refactor(s6-9c): converge lib getState calls
1fc7d87 refactor(s6-8): dedupe fullscreen toast and quality ownership
432565f docs(s6-7): update total count
ac7c70b refactor(s6-7): unify theme source of truth
b581c0e docs(s6-6): mark UI domain split done
e6dd27a refactor(s6-6c): extract ui shell store from uiStore
1d41c2d refactor(s6-6b): extract panel store from uiStore
6b07b01 refactor(s6-6): extract toast store from uiStore
af564d6 docs(s6-12): record dependency-cruiser layering gate
cd55ab3 chore(s6-12a): add dependency-cruiser layering rules
dcf5207 docs(s6-10): update total count
e071948 refactor(s6-10b): remove component getState reads
46bd0e5 refactor(s6-10): converge service getState calls
d91ae5e docs(s6-9): record playback ports and agent tools migration
ee96f9e refactor(s6-9b): add playback ports and migrate agent tools
17b9e34 docs(s6-9): record playback command layer partial
1317533 feat(s6-9): add playback command layer and events
08d5249 chore(s6-12b): wire store/bundle perf gates into CI
df8e64f docs(s6-11): mark contract matrix done
9462deb test(s6-11c): complete store contract matrix
4e6f919 docs(s6-11): record additional contract matrices
8dc12a1 test(s6-11b): add hydration/version/quota/backup contracts
9f89672 chore(s6-12): add store line budget ratchet
530aeac docs(s6-11): record store contract matrix partial
8c77a70 test(s6-11): add persisted store contract matrix
92e3e2e docs(s6-4): mark consumption migration done
cf2b56e refactor(s6-4): migrate service layer off audioStore reads
77cfc0e refactor(s6-4): migrate isPlaying consumers to playbackClock
f0979dd docs(s6-4): record identity and progress migrations
868b1c1 refactor(s6-4): move progress consumers to PlaybackClock
4c67ed0 docs(s6-2): mark registry/hydration gate done
fe25ea4 feat(s6-2c): gate first-paint restore on hydration
87e993c refactor(s6-4): migrate currentSong consumers to playerStore
218cf51 docs(s6-4): record mixer field migration
7ec6118 refactor(s6-4): migrate playback field consumers
be9c2e1 docs(s6-3): record single progress authority done
a219559 refactor(s6-3): make audioStore single progress authority
aae2ea5 docs(s6-1): record whole-store lint gate done
b7f2eae feat(s6-1): add whole-store selector lint gate
eb175ed docs(s6-2b): record hydration status hook
96bde72 feat(s6-2b): expose hydration status hook
bb3dedc docs(s6-2): record storage registry and ordered hydration (partial)
e92161e feat(s6-1): add storage registry and ordered store hydration
```

> 说明：`e92161e` 的提交标题写 `s6-1`，但内容是 S6-2 的 registry + hydration（TRACKING 也把它记在 S6-2）。按标题前缀统计时 S6-1=3、S6-2=5；按内容归属应为 S6-1=2、S6-2=6。下表使用内容归属。

### 2.1 任务表

| ID    | 交付摘要                                                                                                                                            | 代码提交（分支）                                                             | 文档提交                                   | 变更（唯一文件 / 行）                 | 定向测试（本轮实测）                                                                         | exit | 状态 / 缺口                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| S6-1  | repo-local ESLint 规则 `no-whole-store`（无参 `useXStore()` → error）+ RuleTester + CI lint 接线                                                    | `b7f2eae`（`feature/arch-perf-s6-1b`）                                       | `aae2ea5`                                  | 7 +1 文件 / +112−4（代码）            | `eslint-rules` 2 文件 **20 passed**                                                          | 0    | 达成 E1/E2；codemod 与 `selector-allowlist.json` **未落地**（whole 已为 0）；`--rulesdir` 仍是 ESLint 8 legacy                 |
| S6-2  | storageRegistry 43/43 + 全量 `skipHydration` + 有序 `hydrateStores` + hydration 状态/首帧门控                                                       | `e92161e` + `96bde72` + `fe25ea4`（标题写 s6-1/s6-2b/s6-2c）                 | `bb3dedc`、`eb175ed`、`4c67ed0`            | 58 文件 / +685−35（代码）             | `bootstrapStores`+`hydrationStatus`+`storage` 8 文件 **44 passed**                           | 0    | 部分：envelope/`registeredStorage`/sizeBudget/fixtures **未做**；version 仅 4/43、migrate 仅 1（见 §3.1）                      |
| S6-3  | audioStore 成为进度唯一持久权威；playerStore 移除进度持久化与 player→audio 进度订阅                                                                 | `a219559`（`feature/arch-perf-s6-3`）                                        | `be9c2e1`                                  | 9 文件 / +169−32                      | `progressPersistenceAuthority`+`globalStatePersistence`+`playerStore` 3 文件 **15 passed**   | 0    | 达成 E8 语义（单权威）；**真实 60s 写盘计数未测**；直接 `setState` 旁路写 player 的路径仍在                                    |
| S6-4  | 播放字段消费迁移：混音→playerStore、currentSong→playerStore、进度/isPlaying→PlaybackClock、services 收尾                                            | `7ec6118`+`87e993c`+`868b1c1`+`77cfc0e`+`cf2b56e`                            | `218cf51`、`f0979dd`、`92e3e2e`            | 97 文件 / +4417−715（含 docs 44/21）  | `src/test/audio-consumers.*` 5 文件 **13 passed**                                            | 0    | 组件/hooks/lib/services 读点归零；**播放写点仍走 audioStore**（S6-5/S6-9）；无浏览器播放回归                                   |
| S6-5  | 删除 audioStore 队列镜像与 4 个 EQ 字段/action、EQ 迁移到 eqStore、消除 `audioStore→queueStore` 边                                                  | `09ba933`（`feature/arch-perf-s6-5`）                                        | `739d8f2`                                  | 31 文件 / +847−379（含 docs 40/40）   | `queueOwnership`+`eqOwnership` 2 文件 **10 passed**                                          | 0    | 达成队列/EQ 单 owner、SCC 0；无浏览器播放/EQ 听感 smoke；playSong 的 library 兜底仍在 playbackSlice                            |
| S6-6  | uiStore 拆分：toastStore（6a）、panelStore（6b）、uiShellStore（6c）+ deprecated facade                                                             | `6b07b01`+`1d41c2d`+`e6dd27a`                                                | `b581c0e`                                  | 74 文件 / +1384−654（含 docs 18/18）  | `toastStore`+`panelStore`+`uiShellStore`+`uiStore.facade` 4 文件 **50 passed**               | 0    | 部分：6d facade 收尾未做；78 处 toast 调用仍走转发器；无浏览器 Profiler 对比                                                   |
| S6-7  | themeStore 唯一 owner + `useThemeVars` CSS 变量单点 + `ThemeBootScript` 首帧防闪 + 静态契约                                                         | `ac7c70b`（`feature/arch-perf-s6-7`）                                        | `432565f`                                  | 23 文件 / +784−181（含 docs 7/7）     | `themeStore`+`themeSource.contract`+`useThemeVars`+`ThemeBootScript` 4 文件 **23 passed**    | 0    | 部分：visualSettings 主题预设未迁（无消费者）；无真实刷新/切歌录屏；Electron/CSP 内联脚本未验                                  |
| S6-8  | 全屏枚举（fullscreenSurface）、成就 toast 并入 toastStore、性能档 owner 收敛到 visualRuntime + performanceV8Store 只读投影                          | `1fc7d87`（`feature/arch-perf-s6-8`）                                        | 同提交（TRACKING 3 行）                    | 30 文件 / +739−353（含 docs 3/3）     | `stateOwnership.contract`+`statsAchievementsStore`+`performanceV8Store` 3 文件 **28 passed** | 0    | 部分：OS 级 F11 不回流（未动 IPC）；无成就 toast 截图/Profiler；用户档位现在真实生效但非锁定                                   |
| S6-9  | domain 命令层/事件/ports + getState 收敛（9c lib、9d hooks、9e lint）+ AI agent 工具迁移                                                            | `1317533`+`ee96f9e`+`a0c327e`+`7602624`+`bbad439`                            | `17b9e34`、`d91ae5e`、`1798f17`、`11363e8` | 42 文件 / +2149−461（含 docs 58/5）   | `src/domain`+`playbackBoundary` 4 文件 **22 passed**                                         | 0    | **partial（TRACKING 未勾选）**：运行时边 23/24 **> 6**；`usePlaybackCommands` 未建；仅 aiAgentTools/键盘迁移；无浏览器 smoke   |
| S6-10 | service getState 24→0（10a）、component getState 117→0（10b）+ 动作层薄适配                                                                         | `46bd0e5`+`e071948`                                                          | `dcf5207`                                  | 68 文件 / +1274−383（含 docs 5/5）    | `getstate-boundary` 1 文件 **6 passed**                                                      | 0    | 达成 E6/E7 数字；services 仍 import `@/store/actions/*`（计划 Step 4 未做）；store 层 getState 195 未棘轮；无浏览器 smoke      |
| S6-11 | 8 文件契约矩阵：storeContractMatrix + hydrationOrder/persistenceVersion/quotaPolicy/backupRoundtrip/playbackConsistency/selectorSnapshot/storeGraph | `8c77a70`+`8dc12a1`+`9462deb`                                                | `530aeac`、`4e6f919`、`df8e64f`            | 11 文件 / +1032−5（几乎全测试）       | `src/store/__contract__` 8 文件 **69 passed**                                                | 0    | 部分：仅 4 店声明 version/1 个 migrate；5 个整店持久化未消除；无 store 覆盖率扩域；fixtures 目录缺失                           |
| S6-12 | store 行数棘轮 `check-store-budgets` + depcruise 分层规则 + CI perf:gates + 26 次 store 拆分（c..r）                                                | `9f89672`+`cd55ab3`+`08d5249`+`be22596`..`18fa51d`（c..r 共 26 个 refactor） | 18 条 docs(s6-12)                          | 73 文件 / +6216−4579（含 docs 99/32） | 3 个脚本测试文件 **10 passed**                                                               | 0    | 达成 0 循环 + 存储文件全部 ≤400；**无 CI 实跑**；29 条 no-orphans 仅 warn；`playSelectedSongs` 删除属 API 变更（跨分支需同步） |

- 行数为 `git show --numstat` 汇总（含测试；文档行数单列在括号内）；「唯一文件」按任务内代码+文档去重。
- 「N passed」为该命令 vitest 输出，包含点名文件内的既有用例，不全部归本任务新增。
- S6-4/S6-6/S6-9/S6-12 为多提交任务，行数是任务内去重文件上的合计，不能与单 PR ≤400 行直接对照（拆分发生在分支内）。

### 2.2 定向测试明细（2026-10-29，本 worktree 实测）

| 任务  | 命令（`npx vitest run` 后跟文件/目录）                                                                                                               | 结果               | exit |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---- |
| S6-1  | `eslint-rules`                                                                                                                                       | 2 文件 / 20 passed | 0    |
| S6-2  | `src/lib/bootstrapStores.test.ts src/lib/hydrationStatus.test.ts src/lib/storage`                                                                    | 8 文件 / 44 passed | 0    |
| S6-3  | `src/store/progressPersistenceAuthority.test.ts src/store/globalStatePersistence.test.ts src/store/playerStore.test.ts`                              | 3 文件 / 15 passed | 0    |
| S6-4  | `src/test/audio-consumers.identity.test.ts` + `.isPlaying` + `.mixer` + `.progress` + `.services`（5 文件）                                          | 5 文件 / 13 passed | 0    |
| S6-5  | `src/store/queueOwnership.test.ts src/store/eqOwnership.test.ts`                                                                                     | 2 文件 / 10 passed | 0    |
| S6-6  | `src/store/toastStore.test.ts src/store/panelStore.test.ts src/store/uiShellStore.test.ts src/store/uiStore.facade.test.ts`                          | 4 文件 / 50 passed | 0    |
| S6-7  | `src/store/themeStore.test.ts src/store/themeSource.contract.test.ts src/hooks/useThemeVars.test.tsx src/components/layout/ThemeBootScript.test.tsx` | 4 文件 / 23 passed | 0    |
| S6-8  | `src/store/stateOwnership.contract.test.ts src/store/statsAchievementsStore.test.ts src/store/performanceV8Store.test.ts`                            | 3 文件 / 28 passed | 0    |
| S6-9  | `src/domain src/services/playbackBoundary.test.ts`                                                                                                   | 4 文件 / 22 passed | 0    |
| S6-10 | `src/test/getstate-boundary.test.ts`                                                                                                                 | 1 文件 / 6 passed  | 0    |
| S6-11 | `src/store/__contract__`                                                                                                                             | 8 文件 / 69 passed | 0    |
| S6-12 | `scripts/perf/check-store-budgets.test.mjs scripts/verify-layers.test.mjs scripts/perf/report-store-stats.test.mjs`                                  | 3 文件 / 10 passed | 0    |
| 合计  | 47 个文件次                                                                                                                                          | **310 passed**     | 0    |

> 口径：全部为 jsdom 单测/静态扫描；没有真实 Canvas、FPS、写盘采样或浏览器交互。`310 passed` 可复跑，不等于性能/行为验收。

## 3. 存储架构证据（逐项，实测）

### 3.1 64 stores / 43 persist keys / registry（实测）

```text
$ node scripts/perf/report-store-stats.mjs
== Store architecture stats ==
stores        64  persist keys 43
registry      43/43 persisted keys registered
subscriptions 1222 calls: whole 0 (0%), selector 1222, whole-only files 0
store graph   23 edges, SCC 0
getState      {"domain":15,"lib":4,"store":195}
```

`--json` 明细（本轮实测）：`missing=[]`、`unregistered=[]`。registry 组成（脚本统计）：**43 key / 43 唯一 owner**；版本分布 **41×v1 + 2×v2**（`eq-store`、`ui-store-v2`）；分组 `ai 7 / playback 8 / library 8 / settings 18 / ui 2`；`backup: true` **8** 条；registry 内**只有 1 个 migrate**（eq-store v1→v2）。

| 指标（计划 E4/E5）          | 目标       | 当前实测                                                                            | 状态            |
| --------------------------- | ---------- | ----------------------------------------------------------------------------------- | --------------- |
| persist key 注册            | 44/44      | **43/43**（计划 44 为基线扫描假象：Hi-Res 标识 + 过时外部 key）                     | 达成（43 口径） |
| persist 配置声明 `version`  | 44/44      | **4/43**（aiStore、eqStore、gestureSettingsStore、uiStore）                         | **partial**     |
| 迁移键有 `migrate`          | 迁移键全部 | **1**（eq-store v1→v2；其余 39 个 version=1 的规划值未接线）                        | **partial**     |
| 整店持久化（无 partialize） | 0          | **5**：knowledge、linerNotes、lyricSettings、professionalMode、recommendation       | **未达成**      |
| 整店持久化且写 runtime 字段 | 0          | **2** 个显式例外：knowledgeStore/recommendationStore 的 `isLoading`（契约矩阵棘轮） | **partial**     |

> 整店持久化口径：本轮用脚本检查「store 文件含 `persist(` 且 persist 选项无 `partialize`」，43 个持久化 store 中 38 有 partialize、5 没有。该方法不解析嵌套/条件配置，属结构近似，但 5 个文件与 TRACKING S6-11 记录一致。

### 3.2 hydration 阶段顺序（结构，实测）

`src/lib/bootstrapStores.ts`（223 行）实测：

```ts
export const HYDRATION_PHASES = ["playback", "queue", "audioProjection", "ui", "business"] as const;
const FIXED_PHASES = {
  playerStore: "playback",
  queueStore: "queue",
  audioStore: "audioProjection",
  uiStore: "ui",
  visualSettingsStore: "ui",
};
```

| 断言                                                            | 证据（测试）                                                                                        | 结果 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---- |
| 阶段顺序固定，player→queue→audio→ui→business，ui 在 business 前 | `hydrationOrder.contract.test.ts`「keeps phase order and the dependency-critical prefix stable」    | 通过 |
| 43 个 key 每个恰好一次、plan 确定性                             | 同文件「names every registered key exactly once and is deterministic」                              | 通过 |
| 按 plan 顺序 rehydrate、重复调用不二次 hydrate                  | 同文件「rehydrates in plan order …」+ `bootstrapStores.test.ts`「hydrates unchanged stores once …」 | 通过 |
| 未知 owner/key 抛错而非静默                                     | `bootstrapStores.test.ts`「rejects unknown keys/owners …」                                          | 通过 |
| 状态机 idle→hydrating→ready / error，SSR 保持 idle              | `hydrationStatus.test.ts` 5 例                                                                      | 通过 |
| 首帧不阻塞、ready 后只恢复一次                                  | `useRestoreAfterHydration` + S6-2c 提交 `fe25ea4`（TRACKING 记录 6 例）                             | 历史 |

- 全部 43 个 persist 配置带 `skipHydration: true`（registry 扫描测试断言）；模块级 promise 幂等；`typeof window === "undefined"` 时直接返回。
- 缺口：**没有 performance.mark 时间线**，计划 E11 的「总 <300ms、每阶段 <50ms」**未验证**；无浏览器首屏 hydrating 观测。

### 3.3 store 图（脚本口径 23 / AST 复核 24，SCC 0）

```text
store graph   23 edges, SCC 0        # scripts/perf/report-store-stats.mjs
```

- `src/store/__contract__/storeGraph.contract.test.ts`：`EDGE_BUDGET = 27`，`RUNTIME_EDGE_REASONS` **27 条**；断言「每条检测到的边都有原因 + 边数 ≤27 + SCC=[] + 合成环正控」。4 个用例本轮全部通过。
- 实测边表（脚本输出 23 条）：audioStore→playerStore、emotionStore→aiStore、healthCheckStore→libraryHealthStore/playlistStore、knowledgeStore→aiStore、linerNotesStore→aiStore、playerStore→playbackRuntimeStore、queueNavigation→queueStore、sleepTimerStore→audioStore、smartMixStore→playlistGroupStore/queueStore、smartPlaylistStore→queueStore/statsAchievementsStore、sourceConfigStore→userAccountStore、statsAchievementsStore→toastStore、uiStore→panelStore/themeStore/toastStore/uiShellStore、useAIAgentStore→aiStore/audioStore/panelStore/useOfflineDownloadStore。
- **口径缺陷（本轮新发现）**：报告脚本的 import 正则用非贪婪跨语句匹配，`queueNavigation.ts` 的 `import type { LoopMode } from "./slices/types"` 会吞掉后续 import，把第 17 行 `import { usePlayerStore } from "./playerStore"` 误判为 `import type`。用 TypeScript AST 逐条 `ImportDeclaration` 复核：**24 条运行时边**（多出的正是 `queueNavigation -> playerStore`），Tarjan **SCC 仍为 0**。契约测试使用同一正则，因此也按 23 条通过。
- 修正后仍有 **3 条**登记原因没有对应边：`useAIAgentStore -> playerStore/favoritesStore/emotionStore`（该文件这 3 个 import 已不存在，S6-12o 拆分后迁走）。`EDGE_BUDGET=27` 相对实际 24 有 3 条虚位；建议下一轮清理原因并把预算降到 24（本轮 docs only，不改代码）。

| 指标（计划 E3）        | 目标                    | 当前实测                                     | 状态       |
| ---------------------- | ----------------------- | -------------------------------------------- | ---------- |
| store 运行时 import 边 | **≤6 且全部 type-only** | **23（脚本）/ 24（AST）**，仅 1 条 type-only | **未达成** |
| 循环依赖               | SCC = 0                 | SCC = 0（两种口径一致）                      | 达成       |
| depcruise no-circular  | 0 violations            | 0 errors / 29 warnings                       | 达成       |

### 3.4 整店订阅（E1/E2）与 ESLint 门禁（实测）

- `report-store-stats`：**1222 次订阅调用，whole 0（0%），selector 1222，whole-only 文件 0**；`--max-whole 0` → `[store-stats] OK: wholeCalls 0 <= 0`。
- repo-local 规则 `eslint-rules/no-whole-store.js`：对 `@/store/*` 具名 import 的无参 `useXStore()` 报 **error**（`.eslintrc.json:19`）；允许 selector/useShallow/getState/非 store hook/本地同名 hook；RuleTester **5 valid + 4 invalid = 9 例**。
- 本轮 `npx eslint src --ext ts,tsx --rulesdir eslint-rules --report-unused-disable-directives --max-warnings=0` → **exit 0**（0 problems）。
- **缺口**：`--check` 模式 **exit 1** —— `stores 64 != baseline 60; persistCount 43 < baseline 44`。`perf/store-stats-baseline.json` 仍是 2026-10-21 快照（60 store / 44 key / whole 161 / SCC 1），`perf:gates` 只用 `--max-whole`，所以 CI 不会因 baseline 过期而红。

### 3.5 getState 棘轮（E6/E7，实测）

```text
$ node scripts/report-getstate.mjs --check
OK: services 0/0, components 0/0, lib 4/5, hooks 0/0 (allowed files: 0/0/2/0)
exit 0
```

| 层         | 计数（非测试）                                 | 目标 / 棘轮            | 状态 |
| ---------- | ---------------------------------------------- | ---------------------- | ---- |
| services   | **0**（18 文件扫描）                           | 0                      | 达成 |
| components | **0**（235 文件扫描）                          | 0                      | 达成 |
| hooks      | **0**（23 文件扫描）                           | 0（S6-9d 新增棘轮）    | 达成 |
| lib        | **4**（bootstrap.ts 1 + gesture/actions.ts 3） | ≤5（白名单 2+3）       | 达成 |
| store      | 195                                            | 未棘轮（仅报告）       | —    |
| domain     | 15                                             | 未棘轮（ports 适配器） | —    |
| 合计       | 214 / 39 文件                                  | —                      | —    |

- 守卫测试 `src/test/getstate-boundary.test.ts` 6 例：分层计数、防退化哨兵、services 0、components 0、hooks 0、脚本 `--check`。
- 缺口：`perf/getstate-baseline.json` 的 `allowed.lib.bootstrap` 仍写 **2**，实际只有 1（棘轮松弛 1 处）；store 层 195 处没有上限，动作层继续增长时无人拦截。

### 3.6 行数预算与 depcruise（实测）

```text
$ node scripts/check-store-budgets.mjs
== Store line budgets + cycles ==
files         113  total lines 19500  max 400
baseline      103 files  grandfathered 0  stale 0
cycles        SCC 0 (runtime store-to-store imports)
[store-budgets] PASS: 113 files within budget; SCC 0
```

```text
$ npx depcruise src --config .dependency-cruiser.cjs --output-type err
x 29 dependency violations (0 errors, 29 warnings). 856 modules, 2033 dependencies cruised.
exit 0
```

- `audioStore.ts` **165 行**、`playerStore.ts` **175 行**（`Get-Content | Measure-Object -Line`），均 <400；S6-12 前 `audioStore` 为 818 行（计划基线）。
- 113 个 store 文件全部 ≤400，over-cap **0**、grandfathered **0**、baseline 外新增文件 **10** 个且均 ≤400。
- depcruise 29 条全部是 `no-orphans` warn（含 type-only 与动态 `lx_sources`）；`no-circular`、分层规则 0 error；`npm run verify:layers` exit 0。

## 4. 所有权地图（每事实一个可写 owner）

| 事实域                   | 唯一 owner（可写）                                                                                        | 兼容/投影层                                                                                                        | 契约/所有权测试（本轮实测用例名）                                                                                                                                                                                                                                                                                                                                                                               | 状态                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| toast                    | `src/store/toastStore.ts`（transient，无 persist/registry）                                               | `uiStore.showToast/removeToast` deprecated 转发器；`uiActions` 命令式单例                                          | `toastStore.test.ts` 10 例（如「caps the queue at MAX_TOASTS by dropping the oldest toast」「carries the achievement variant payload…」）；`stateOwnership.contract.test.ts`「declares the toast queue only in toastStore」「removes the duplicate achievement queue, timer and toast action」；`statsAchievementsStore.test.ts`「enqueues exactly one achievement-variant toast in toastStore (single owner)」 | 达成                         |
| panel                    | `src/store/panelStore.ts`（transient）                                                                    | `uiStore` 9 个 deprecated 转发器 + `isShelf3DOpen` 镜像                                                            | `panelStore.test.ts` 7 例（「keeps fullscreen panels mutually exclusive while preserving non-fullscreen panels」「registers every panel exactly once with a closed default」）；`uiStore.facade.test.ts` 转发等价                                                                                                                                                                                               | 达成                         |
| uiShell（view/nav/全屏） | `src/store/uiShellStore.ts`（transient；`fullscreenSurface: none\|lyrics\|panel`）                        | `uiStore.currentView` 持久化投影 + 7 个 deprecated 动作转发器；原生 `fullscreenchange` 只在此文件监听              | `uiShellStore.test.ts` 15 例（「transitions none -> panel -> none and is mutually exclusive with lyrics」「mirrors native fullscreen events without clobbering lyrics on exit」「never writes non-persisted shell fields to ui-store-v2」）；`stateOwnership.contract.test.ts`「keeps the fullscreen surface enum only in uiShellStore」「listens to native fullscreen events once, in the shell owner」        | 达成（枚举互斥为 S6-8 语义） |
| theme                    | `src/store/themeStore.ts`（transient；同值写短路）                                                        | `uiStore` 三字段写时投影 + `adoptLegacyTheme` 回灌；`useThemeVars` 唯一 CSS 变量写入；`ThemeBootScript` 首帧 class | `themeStore.test.ts` 6 例（「is the only writer of theme changes and projects them once into ui-store-v2」）；`themeSource.contract.test.ts` 7 例（「defines runtime theme state only in themeStore (uiStore keeps the persist projection)」「declares --theme-\* variable names only in useThemeVars」）；`useThemeVars.test.tsx` 5 例；`ThemeBootScript.test.tsx` 5 例                                        | 达成（视觉预设字段未迁）     |
| queue                    | `src/store/queueStore.ts`（persist `queue-store-v5`）                                                     | audioStore 队列镜像已删除；`queueNavigation` 是 currentIndex 唯一写入口                                            | `queueOwnership.test.ts` 5 例（「audioStore exposes no queue/currentIndex state or compatibility setters」「queue edits land in queueStore and audioStore writes never reach the queue」「keeps the queue-store-v5 persistence payload shape unchanged」）                                                                                                                                                      | 达成                         |
| EQ                       | `src/store/eqStore.ts`（persist `eq-store` v2 + v1→v2 migrate）                                           | audioStore 4 字段/5 action/EQ 持久化键已删除；AudioEqualizer 只读 eqStore                                          | `eqOwnership.test.ts` 5 例（「audioStore exposes no EQ writable state or actions」「migrates legacy audio-store-v4 EQ fields into eq-store v2」「persists EQ settings under eq-store v2」）                                                                                                                                                                                                                     | 达成                         |
| backup                   | `src/store/backupRestoreStore.ts`（+ `src/store/backup/helpers.ts`、`preview.ts`）                        | v5 schema/parse/v4 migration 在 `backupSchema` 管线                                                                | `src/store/__contract__/backupRoundtrip.contract.test.ts` 3 例（「exports exactly the registry」「roundtrips a full payload through exportBackup -> JSON -> importBackup」「rejects a newer backup major instead of importing it」）                                                                                                                                                                            | 达成（S1-2 合入后复跑绿）    |
| stats / achievements     | `src/store/statsAchievementsStore.ts`（+ `statsAchievements/{types,defaults,achievements,statsHelpers}`） | 成就 toast 只发事件到 toastStore（variant=achievement），不再自持队列/定时器                                       | `statsAchievementsStore.test.ts` 11 例（查询/排序/分布 + 单 toast 所有权）；`stateOwnership.contract.test.ts`「removes the duplicate achievement queue, timer and toast action」                                                                                                                                                                                                                                | 达成                         |
| 性能档（附）             | `src/runtime/visualRuntime.ts`（tier 唯一写入口 `setQuality`）                                            | `performanceV8Store` 只读投影（`projectQuality`，partialize 只剩 config）                                          | `performanceV8Store.test.ts` + `stateOwnership.contract.test.ts`「keeps performanceV8Store a read-only projection without tier write paths」「routes every explicit tier write through visualRuntime.setQuality」                                                                                                                                                                                               | 达成                         |

> 持久化归属：toast/panel/uiShell/theme 均 **transient**（不在 43 key registry 内）；ui-store-v2 仍由 `uiStore` 持久化 currentView/themeMode/themeColors/isDynamicTheme 四字段，owner 侧只做单向投影。这就是 M6「每事实一个可写 owner」与「旧 key 保留」之间的兼容层。

## 5. M6 出口门 checklist

TRACKING 行 108 的 6 项：

| #   | M6 项（TRACKING）             | 状态             | 证据 / 缺口                                                                                                                                                                  |
| --- | ----------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 组件整店订阅 0                | **达成（实测）** | whole 0、whole-only 0、1222 全 selector；ESLint error 规则 9 例；`--max-whole 0` OK                                                                                          |
| 2   | store 运行时 import ≤6 且无环 | **partial**      | SCC 0 达成；边数 **23（脚本）/ 24（AST）**，远高于 6；仅 1 条 type-only；`EDGE_BUDGET=27` 有 3 条虚位                                                                        |
| 3   | 44/44 key 有 version/migrate  | **partial**      | 实际 43 key 全部注册；persist **4/43** 声明 version；migrate **1** 个；其余 39 个靠 registry 规划值 1，未接线 migrate/fixture                                                |
| 4   | 整店持久化 0                  | **未达成**       | 仍有 5 个无 partialize（knowledge/linerNotes/lyricSettings/professionalMode/recommendation）；其中 2 个写 `isLoading` 为显式例外                                             |
| 5   | audioStore <400 行            | **达成（实测）** | `src/store/audioStore.ts` 165 行；playerStore 175 行                                                                                                                         |
| 6   | 11 组重复事实→0               | **partial**      | 队列/EQ/主题/全屏/toast/性能档/currentView 已单 owner；**播放 8 字段仍双写**（audioStore 写、PlaybackClock/playerStore 读）；V7/V8 可视化两套未处置（V8 dead code，S4 范围） |

README 行 102 的 W8-W9 门（44/44 key 注册；store 无环；audioStore <400 行；重复事实 0）：key 43/43（44 为假象）、无环达成、165 行达成、重复事实 partial。

计划 §1 的量化出口：

| ID  | 出口                         | 目标                                 | 当前实测 / 证据                                            | 状态                                     |
| --- | ---------------------------- | ------------------------------------ | ---------------------------------------------------------- | ---------------------------------------- |
| E1  | 组件层整店订阅               | 0；全仓 ≤10 白名单                   | whole 0（1222 selector）                                   | **达成**                                 |
| E2  | 只整店无 selector 文件       | 0                                    | whole-only 0                                               | **达成**                                 |
| E3  | store 静态 import 边 / SCC   | ≤6 且 type-only；SCC 0               | 23/24 边；1 type-only；SCC 0                               | **partial**                              |
| E4  | persist registry 覆盖        | 44/44 注册 + version + migrate       | 43/43 注册；4/43 version；1 migrate                        | **partial**                              |
| E5  | 整店持久化 store 数          | 0                                    | 5                                                          | **未达成**                               |
| E6  | 组件 getState 写状态         | 0                                    | 0（117→0，S6-10b）                                         | **达成**                                 |
| E7  | service/lib getState         | service 0；lib ≤5                    | service 0；lib 4（bootstrap 1 + gesture 3）                | **达成**                                 |
| E8  | 播放写盘                     | ≤1 次/秒                             | 只有 `throttledPersist` 单测（S2-4 历史）；**无 60s 采样** | **未验证**                               |
| E9  | audioStore 行数 / 重复事实组 | <400 / 0 组                          | 165 行；11 组 partial                                      | **partial**                              |
| E10 | 新增文件 ≤400 + 循环依赖     | 0 violations                         | 113 文件 over-cap 0；depcruise 0 errors                    | **达成**                                 |
| E11 | hydration                    | 全部 skipHydration + 显式顺序 + 测试 | 43/43 skipHydration；5 阶段有序；契约/状态测试绿           | **达成（结构）**；耗时/浏览器 **未验证** |

## 6. 未验证 / partial 显式清单

**partial（有实现与结构证据，但出口指标未达）**

1. **S6-9**（TRACKING 未勾选）：domain 命令层/事件/ports 存在（`src/domain/events.ts`、`playback/playbackCommands.ts`、`playback/ports.ts`），但运行时边 **23/24 > 6**；`usePlaybackCommands` 未创建；仅 aiAgentTools/键盘迁移，其余 UI 写点走 `src/store/actions/*`；无浏览器 smoke。
2. **E3/S6-5 边收敛**：SCC 已 0，边数仍 23/24；`EDGE_BUDGET` 与登记原因未随实际下降（3 条虚位 + 1 条扫描误判）。
3. **E4/S6-2 version/migrate**：43/43 注册但 4/43 version、1 migrate；39 个 store 仍是规划 version=1，无 fixture。
4. **E5/S6-11 整店持久化**：5 个无 partialize；2 个把 `isLoading` 写盘（契约矩阵显式例外）。
5. **11 组重复事实**：播放字段读/写已分离但 audioStore 仍是写侧镜像；currentView/theme 仍以 ui-store-v2 为持久化投影；V7/V8 可视化未动。
6. **S6-6d facade 收尾**：uiStore 仍保留转发器/投影，未删内部实现；78 处 toast 调用仍走 deprecated API。
7. **S6-7 主题**：visualSettings 的 currentTheme/customTheme/followSystemTheme/autoDayNight 未迁（无运行时消费者）；Electron/CSP 内联脚本未验。
8. **S6-8 全屏**：OS 级 F11/Electron 窗口全屏不经 document 事件时不回流（与拆前一致）；枚举互斥使「歌词 + 面板全屏同时为真」不再可能。
9. **S6-10 分层**：services 仍 import `@/store/actions/*`；组件仍 import store（计划 L5 未完全达成）；store 层 getState 195 未棘轮。
10. **S6-12**：26 次拆分后 `playSelectedSongs` 被删，属 API 变更；CI 未实跑新门禁。

**未验证（本轮无证据）**

1. 播放 60s `Storage.prototype.setItem` 计数（E8 ≤1/s）；只有 `throttledPersist` 单测。
2. hydration 阶段耗时 / 总 <300ms（performance.mark）；只有顺序与幂等断言。
3. 受保护界面（Home/Player/全屏歌词）S6 前后截图/像素对比（D7）；S3-2 的截图不覆盖 S6 改动。
4. 主题刷新/切歌防闪录屏或帧对比；Electron/CSP 打包下 boot script。
5. 成就 toast、全屏按钮、面板开合的真机/浏览器截图与 Profiler commit 对比。
6. 播放/队列/EQ/音源/备份-恢复的浏览器 smoke（切歌、循环、队列编辑→结束、刷新恢复）。
7. 备份→恢复→重载的端到端（`backupRoundtrip` 只做 storage 适配器 roundtrip，不 rehydrate）。
8. 回滚演练（计划要求 revert S6-3a + S6-6c 各一次）。
9. CI 真实运行 `perf:gates` / depcruise / 行数棘轮（本轮只本地跑）。
10. store 域覆盖率扩域（vitest coverage include 未加 `src/store/**`）。

## 7. 缺失证据 / 未按计划落地的产物

| 计划要求                                          | 现状                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `perf/store-stats-before.json` / `-after.json`    | **不存在**；只有 `perf/reports/s6-5-store-stats.{before,after}.json` 与 S6-9/10 getState JSON |
| `perf/store-stats-baseline.json` 可用             | 文件存在但**过期**（60 stores/44 keys/whole 161/SCC 1）→ `--check` exit 1                     |
| `registeredStorage` envelope + sizeBudget         | **未实现**（`src/lib/storage/registeredStorage.ts` 不存在）                                   |
| `src/lib/storage/fixtures/` 迁移 fixture          | **不存在**；只有 eq-store migrate 的内联用例                                                  |
| `scripts/check-store-graph.mjs`                   | **未创建**；由 `check-store-budgets.mjs` 的 SCC 扫描 + `storeGraph.contract.test.ts` 承担     |
| `scripts/check-file-size.mjs`                     | **未创建**；由 `scripts/check-store-budgets.mjs` 承担                                         |
| `scripts/codemod-store-selectors.mjs` + allowlist | **未创建**（whole 已 0，codemod 未需要）                                                      |
| `src/store/qualityStore.ts`                       | **未创建**；性能档 owner 改为 `visualRuntime`，`performanceV8Store` 只读投影                  |
| `src/hooks/usePlaybackCommands.ts`                | **未创建**；由 `playbackCommands` + `ports` + 键盘/Agent 直接调用承担                         |
| `src/lib/events/domainEvents.ts`                  | **未创建**；事件总线路径为 `src/domain/events.ts`（API 名称不同）                             |
| `evidence/S6-event-subscribers.md`                | **不存在**（S6-9b 要求登记订阅方）                                                            |
| 写盘计数脚本 / 60s 采样                           | **无**                                                                                        |
| hydration performance.mark 时间线                 | **无**                                                                                        |
| Home/Player/全屏歌词 S6 前后截图                  | **无**（S3-2 截图早于 S6）                                                                    |
| 主题防闪录屏/帧序列                               | **无**                                                                                        |
| 回滚演练记录                                      | **无**                                                                                        |
| CI 实跑日志（新门禁）                             | **无**                                                                                        |
| contract 矩阵「故意破坏则失败」的 PR 证据         | 测试内含反向证明（错误绑定/version 会红、合成环正控），但**无 PR 级破坏-恢复日志**            |

> `src/store/coordinator/` 已删除（`rg "store/coordinator" src` = 0，目录不存在），这一项按 S6-9c 完成；它不在缺失清单内。

## 8. 复现命令

在 `D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`（分支 `docs/s6-evidence`）执行：

```bash
# 1) 提交清单
git log --all --oneline --grep='s6-' -i
git show --numstat b7f2eae e92161e 96bde72 fe25ea4 a219559 7ec6118 87e993c 868b1c1 77cfc0e cf2b56e \
  09ba933 6b07b01 1d41c2d e6dd27a ac7c70b 1fc7d87 1317533 ee96f9e a0c327e 7602624 bbad439 \
  46bd0e5 e071948 8c77a70 8dc12a1 9462deb 9f89672 cd55ab3 08d5249

# 2) 架构门禁（全部本轮实测）
node scripts/perf/report-store-stats.mjs
node scripts/perf/report-store-stats.mjs --max-whole 0     # exit 0
node scripts/perf/report-store-stats.mjs --check           # 预期 exit 1（基线 60/44 过期，见 §3.4）
node scripts/report-getstate.mjs --check                   # exit 0
node scripts/check-store-budgets.mjs                       # exit 0，113 files / over-cap 0 / SCC 0
npx depcruise src --config .dependency-cruiser.cjs --output-type err   # 0 errors / 29 warnings
node scripts/report-audio-consumers.mjs --group all --check             # exit 0（只校验读点）

# 3) 定向测试（12 组，47 文件 / 310 passed）
npx vitest run eslint-rules
npx vitest run src/lib/bootstrapStores.test.ts src/lib/hydrationStatus.test.ts src/lib/storage
npx vitest run src/store/progressPersistenceAuthority.test.ts src/store/globalStatePersistence.test.ts src/store/playerStore.test.ts
npx vitest run src/test/audio-consumers.identity.test.ts src/test/audio-consumers.isPlaying.test.ts src/test/audio-consumers.mixer.test.ts src/test/audio-consumers.progress.test.ts src/test/audio-consumers.services.test.ts
npx vitest run src/store/queueOwnership.test.ts src/store/eqOwnership.test.ts
npx vitest run src/store/toastStore.test.ts src/store/panelStore.test.ts src/store/uiShellStore.test.ts src/store/uiStore.facade.test.ts
npx vitest run src/store/themeStore.test.ts src/store/themeSource.contract.test.ts src/hooks/useThemeVars.test.tsx src/components/layout/ThemeBootScript.test.tsx
npx vitest run src/store/stateOwnership.contract.test.ts src/store/statsAchievementsStore.test.ts src/store/performanceV8Store.test.ts
npx vitest run src/domain src/services/playbackBoundary.test.ts
npx vitest run src/test/getstate-boundary.test.ts
npx vitest run src/store/__contract__
npx vitest run scripts/perf/check-store-budgets.test.mjs scripts/verify-layers.test.mjs scripts/perf/report-store-stats.test.mjs

# 4) 全量与静态门禁
npx eslint src --ext ts,tsx --rulesdir eslint-rules --report-unused-disable-directives --max-warnings=0
npx vitest run --reporter=dot          # 310 files / 1930 passed / 1 skipped
npx tsc --noEmit
npm run verify:docs                    # fail=0 warn=0

# 5) 图口径复核（TypeScript AST；临时脚本，不提交）
node <temp>/s6-edge-corrected.mjs       # 24 runtime edges / SCC []
```

计划 §5.1 中**不可执行/会失败**的命令（如实登记）：

```text
node scripts/check-store-graph.mjs            # 文件不存在
node scripts/check-file-size.mjs              # 文件不存在
node scripts/perf/report-store-stats.mjs --section=persist   # 脚本无 --section 参数（用 --store/--json）
```

> 本轮未执行 `npm run build`、`npm run dev`、浏览器 smoke、Chrome/CDP、React Profiler、真实写盘计数；未 push，未触碰主工作区。

## 9. 结论与回退

- **可以确认**：S6 的存储/所有权收敛在代码、静态门禁与 jsdom 结构测试层面成立——43 key 全注册、hydration 5 阶段有序且幂等、整店订阅归零、getState 的 services/components/hooks 归零、store 图无环、存储文件全部 ≤400、depcruise 0 error；8 个事实域（toast/panel/uiShell/theme/queue/EQ/backup/stats）各有唯一 owner 与可复跑测试。
- **不能确认**：M6 的 4 项出口（边 ≤6、44/44 version+migrate、整店持久化 0、11 组重复事实 0）与全部浏览器/性能/写盘证据；S6-9 未验收。**M6 不能判绿**。
- **回退**：S6 未引入运行时特性开关；回退按提交粒度 revert。门禁回退：ESLint `no-whole-store` 改 warn、移除 CI 的 depcruise/行数步骤、`perf:gates` 去掉 `check-store-budgets`；数据回退：旧 key（audio-store-v4/ui-store-v2/eq-store 等）均保留，新 store 只做投影/转发，删除投影层不会丢数据。注意 `playSelectedSongs` 已删除（S6-12），跨分支回退需同步调用点。
- **建议的关闭顺序**：① 修 report-store-stats 的 import 正则（AST 或按行）并重建 baseline（64/43），让 `--check` 回到 CI；② 清掉 3 条虚位边并把 `EDGE_BUDGET` 降到 24（或继续压到 ≤6，属 S6-9 主线）；③ 给 39 个 store 接 version/migrate + fixture（E4），消除 5 个整店持久化（E5）；④ 补 60s 写盘采样、hydration 时间线、受保护视图截图与主题录屏；⑤ 最后再评审 M6。
