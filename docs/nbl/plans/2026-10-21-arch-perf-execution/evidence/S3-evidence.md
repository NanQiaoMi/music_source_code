# S3 阶段退出证据（M3 出口门）

> 计划依据：[S3-shell-subscriptions.md](../S3-shell-subscriptions.md) §5「阶段级验证命令与证据清单」
> 看板：[TRACKING.md](../TRACKING.md) §S3（行 69–81）｜上游：[架构与性能优化总计划](../../2026-10-21-architecture-performance-optimization.md) §5 S3
> 生成时间：2026-10-29 17:55（Asia/Shanghai）
> worktree：`D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`
> 分支：`docs/s3-evidence`（自 `b575d15` 创建；该提交同时是 `integration/s2-audio` 的 HEAD）
> 约束：仅新增本文档；未 push；未改动主工作区 `D:/26project/music_source_code_V1.1_full/music_source_code`。

## 0. 结论（先看这里）

- **任务完成度**：TRACKING 记 S3-1..S3-10 全部 done（10/10），另有 S3-10b 拆分增补与 S3-4/5 前置 rAF 调度器；本证据核对了 11 个任务提交 + 1 个前置提交的提交号、变更规模、测试与缺口。
- **本轮实测**（2026-10-29，本 worktree）：S3 定向测试 **14 文件 / 98 passed，exit 0**；`npx tsc --noEmit` **exit 0**；`npm run verify:docs` **fail=0 warn=0，exit 0**；`npm run verify:layers` **0 errors / 29 warnings，exit 0**。
- **结构指标**（`report-store-stats` 实测）：whole **0（0%）**、selector 1222、whole-only files **0**、64 stores、registry **43/43**、store graph 23 edges / SCC 0。
- **M3 出口门未关闭**（按 TRACKING 行 71 与 S3 计划 §1 判定）：
  1. **E3 / E5 / E6 / E7 / E12 缺 CDP/Profiler 实测**：现有证据均为 jsdom + fake timer / fake rAF 的结构证据。
  2. **E8 未达成**：S3-6b 未做——生产代码无 `usePanelDeactivate` 消费方，关闭面板的 `setInterval` 未被停止。
  3. **D7 改前/改后三视口 pixel diff 不可用**：本 worktree 无 before 基线，仅有 1440×900 当前态 3 张截图（§5）。
  4. **`report-store-stats --check` exit 1**：既有 baseline 过期（stores 64≠60、persistCount 43<44），需批准后重建。
  5. **包体不退化未验证**：本轮未跑 `npm run build`。
- **证据口径**：在本 worktree 实际执行并捕获 exit code 的数字标「实测」；来自 TRACKING/历史分支的标「历史」；无法核实的标「**未验证**」。全量 suite 本轮未复跑（§8）。

## 1. 环境与统计口径

| 项               | 值                                                              |
| ---------------- | --------------------------------------------------------------- |
| OS / shell       | Windows / PowerShell 7（pwsh）                                  |
| Node / npm / git | v24.16.0 / 11.13.0 / 2.54.0.windows.1（实测）                   |
| 测试框架         | Vitest 4.1.5（jsdom），`CI=1` 非 watch                          |
| 分支 / 基点      | `docs/s3-evidence` ← `b575d15`（`integration/s2-audio` HEAD）   |
| 变更行数来源     | `git show --numstat <perf-commit>`（src / docs / scripts 分列） |
| 测试计数         | 仅统计被点名文件（`--reporter=json` 解析），含文件内既有用例    |
| 定向测试合计     | **14 文件 / 98 passed / 0 failed，exit 0**                      |

> 分支关系（实测）：S3 的 11 个分支 tip（`c168345` / `2c67a37` / `846eada` / `f43a9fd` / `630695b` / `bc7e363` / `e3553db` / `dcff0d4` / `c630434` / `2ce9657` / `aecf2ad`）与截图提交 `b575d15` 均为当前 HEAD 的祖先（`git merge-base --is-ancestor` 全部通过）。历史提交均未 push。

## 2. S3-1..S3-10 交付与验证

| ID       | 交付摘要                                                         | 分支 @ tip                                                                   | perf commit                                      | 变更（`git show --stat`）                                                                                                                                                           | 定向测试（本次实测）                                                                        | exit           | 缺口 / 备注                                                                                                         |
| -------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| S3-1     | page 原子 selector + `VisualTokens`（CSS 变量）+ 壳整店订阅清理  | `feature/arch-perf-s3-1` @ `c168345`                                         | `722940f`                                        | 11 文件 +148/−33（src 11，测试 2）：page.tsx、VisualTokens.tsx(+test)、HomeView、PlayerView、HeaderToolbar、Apple3DQueueDrawer、AppleUnifiedNavIsland、useDynamicTheme、globals.css | `VisualTokens.test.tsx` **3 passed**                                                        | 0              | 计划中的 `shellSubscriptions.test.tsx`（≥5 用例）未落地；无 Profiler/CSS mutation CDP 证据；未跑 build              |
| S3-2     | 5 个壳文件 whole→0（结构由 S3-1/S3-10b 完成）+ D7 受保护视图截图 | `feature/arch-perf-s3-2` @ `2c67a37`；截图 `b575d15`（integration/s2-audio） | `b575d15`（docs）；`3da8fd0` 为误委派的 rAF 预研 | 8 文件 +616/−3（**src 0**；脚本 426 行 + docs 6 文件含 3 PNG）；预研 `3da8fd0`：13 文件 +323/−39                                                                                    | 无新增（0）；截图哈希/尺寸已复核（§4）                                                      | —（docs 提交） | 三视口改前/改后 pixel diff 缺失（§5）；无 E3 Profiler；`3da8fd0` 不计入 S3-2（见 TRACKING 注）                      |
| S3-3     | VisualizationView 原子 selector + 进度下沉 + canvas style memo   | `feature/arch-perf-s3-3` @ `846eada`                                         | `24b9734`                                        | 3 文件 +379/−73：VisualizationView.tsx、VisualizationProgressContainer.tsx、selectors test                                                                                          | `VisualizationView.selectors.test.tsx` **15 passed**                                        | 0              | 无 dev 10s 实播 Profiler、无 14 效果截图；`VisualizationSettingsPanel` 整店订阅留 S3-10（已清）                     |
| S3-4     | Player3D `currentView` 门控 + `shouldRunPlayer3DFrameLoop`       | `feature/arch-perf-s3-4` @ `f43a9fd`                                         | `f91e554`                                        | 4 文件 +155/−2：Player3D.tsx(+test)、player3dMotion.ts(+test)                                                                                                                       | `player3dMotion.test.ts` **9** + `Player3D.test.tsx` **9**（含既有；本任务新增 +5）         | 0              | 无 `window.__perf.player3dFrames` / CDP 60s 实测；Player3D 仍用原生 rAF（未迁 rafScheduler）                        |
| S3-5     | 浮动层 gating（`useFloatingActive` + active 透传）               | `feature/arch-perf-s3-5` @ `630695b`                                         | `e20d980`                                        | 9 文件 +500/−63：GlobalClientComponents、FloatingPlayer、Floating{SpectrumGlow,WaveformGlow,DebugHUD,ExpandedState,CompactControlsState}、useFloatingActive.ts(+test)               | `floatingGating.test.tsx` **7 passed**                                                      | 0              | 无 dev/CDP 60s idle 采样；expanded/waveform/HUD 生产树未挂载；framer 无限动画未按 active 门控                       |
| S3-6     | LazyPanel 三档 keepAlive + LRU(2) + PanelOrchestrator 白名单     | `feature/arch-perf-s3-6` @ `bc7e363`                                         | `2fc832e`                                        | 6 文件 +843/−292：panelLifecycle.tsx、LazyPanel.tsx(+test)、PanelOrchestrator.tsx(+keepAlive test)、data-manager/page                                                               | `LazyPanel.test.tsx` **10** + `PanelOrchestrator.keepAlive.test.tsx` **4**                  | 0              | **S3-6b 未做**：生产代码无 `usePanelDeactivate` 消费（仅测试引用）→ E8 未达成；回收率为 jsdom 10→2，非 CDP DOM 计数 |
| S3-7     | toast / SourceManagementModal 重复宿主清理                       | `feature/arch-perf-s3-7` @ `e3553db`                                         | `029f62e`                                        | 5 文件 +142/−16：GlobalClientComponents、PanelOrchestrator、page.tsx、UnifiedDataManagerHub、globalHosts test                                                                       | `globalHosts.test.tsx` **4 passed**                                                         | 0              | 无 CDP 运行时断言与「来源管理只发 1 请求」网络断言；SourceManagementModal 整店订阅已在 S3-10 清                     |
| S3-8     | playlistStore 整店订阅清零 + `playlistSelectors`                 | `feature/arch-perf-s3-8` @ `dcff0d4`                                         | `674a481`                                        | 40 文件 +360/−56（src 38 +345/−53，测试 9；scripts 2 +15/−3）                                                                                                                       | `playlistSelectors.test.ts` **3** + `playlistSubscriptions.test.tsx` **6**                  | 0              | `--check` baseline 过期（§6.4）；无 dev 输入 Profiler 实测；未做 DataManager 300ms debounce                         |
| S3-9     | 预取改 idle + pointer intent（12→2）                             | `feature/arch-perf-s3-9` @ `c630434`                                         | `e3c1997`                                        | 5 文件 +220/−25：PanelOrchestrator.tsx(+prefetch test)、page.tsx、AppleUnifiedNavIsland、DataManagerPlayerDock                                                                      | `PanelOrchestrator.prefetch.test.tsx` **6 passed**                                          | 0              | 无 CDP `PerformanceObserver(resource)` 首屏 5s 实测与 LCP A/B；queue 面板主壳无入口                                 |
| S3-10    | Top-20 剩余整店订阅清理                                          | `feature/arch-perf-s3-10` @ `2ce9657`                                        | `0cc8592`                                        | 26 文件 +534/−170（测试 3）                                                                                                                                                         | `top20Subscriptions.test.tsx` **14 passed**                                                 | 0              | 仅 jsdom Profiler 结构断言；无 dev Profiler 实测                                                                    |
| S3-10b   | 45 文件/53 处机械清零 + `--max-whole` 预算                       | `feature/arch-perf-s3-10b` @ `aecf2ad`                                       | `df67075`                                        | 56 文件 +629/−579（src 54 +587/−578；scripts 2 +42/−1）                                                                                                                             | `scripts/perf/report-store-stats.test.mjs` **2 passed**；`--max-whole 10` 实测 wholeCalls=0 | 0              | 无新增组件测试（复用 top20）；baseline 未重建                                                                       |
| （前置） | `rafScheduler` 单全局循环 + 11 个视觉循环迁移                    | `feature/arch-perf-s3-2` @ `2c67a37`                                         | `3da8fd0`                                        | 13 文件 +323/−39：rafScheduler.ts(+test) + 11 组件                                                                                                                                  | `rafScheduler.test.ts` **6 passed**                                                         | 0              | 归入 S3-4/S3-5 前置，不计入 S3-2                                                                                    |

- 行数为 `git show --numstat` 汇总；「测试 N」指该提交内 `.test.`/`.spec.` 文件数，非用例数。
- 每个任务的 docs 收尾提交：`c168345` / `b575d15` / `846eada` / `f43a9fd` / `630695b` / `bc7e363` / `e3553db` / `dcff0d4` / `c630434` / `2ce9657` / `aecf2ad`（文档改动未计入上表行数）。

### 2.1 定向测试明细（2026-10-29，本 worktree 实测）

| 任务     | 文件                                                                | 结果                     | exit  |
| -------- | ------------------------------------------------------------------- | ------------------------ | ----- |
| S3-1     | `src/components/layout/VisualTokens.test.tsx`                       | 3 passed                 | 0     |
| S3-3     | `src/components/visualization/VisualizationView.selectors.test.tsx` | 15 passed                | 0     |
| S3-4     | `src/components/player/player3dMotion.test.ts`                      | 9 passed                 | 0     |
| S3-4     | `src/components/player/Player3D.test.tsx`                           | 9 passed                 | 0     |
| S3-5     | `src/components/player/floating/floatingGating.test.tsx`            | 7 passed                 | 0     |
| S3-6     | `src/components/shared/LazyPanel.test.tsx`                          | 10 passed                | 0     |
| S3-6     | `src/components/layout/PanelOrchestrator.keepAlive.test.tsx`        | 4 passed                 | 0     |
| S3-7     | `src/components/layout/globalHosts.test.tsx`                        | 4 passed                 | 0     |
| S3-8     | `src/store/selectors/playlistSelectors.test.ts`                     | 3 passed                 | 0     |
| S3-8     | `src/components/layout/playlistSubscriptions.test.tsx`              | 6 passed                 | 0     |
| S3-9     | `src/components/layout/PanelOrchestrator.prefetch.test.tsx`         | 6 passed                 | 0     |
| S3-10    | `src/components/layout/top20Subscriptions.test.tsx`                 | 14 passed                | 0     |
| 前置     | `src/lib/perf/rafScheduler.test.ts`                                 | 6 passed                 | 0     |
| S3-10b   | `scripts/perf/report-store-stats.test.mjs`                          | 2 passed                 | 0     |
| **合计** | **14 文件**                                                         | **98 passed / 0 failed** | **0** |

> `shellSubscriptions.test.tsx` 在仓库中不存在（S3-2 计划要求 ≥5 用例），因此 S3-2 行测试数为 0；S3-2 的证据是截图而非测试。

### 2.2 TRACKING 记录的全量 suite（历史，未复核）

| 任务   | TRACKING 记录                 |
| ------ | ----------------------------- |
| S3-1   | 203 files / 1270 tests passed |
| S3-3   | 204 files / 1277 tests passed |
| S3-4   | 212 files / 1331 tests passed |
| S3-5   | 213 files / 1338 tests passed |
| S3-6   | 209 files / 1304 tests passed |
| S3-7   | 207 files / 1290 tests passed |
| S3-8   | 206 files / 1286 tests passed |
| S3-9   | 214 files / 1344 tests passed |
| S3-10  | 210 files / 1318 tests passed |
| S3-10b | 211 files / 1320 tests passed |

> 这些数字是各任务分支当时的全量结果，与本 worktree 当前集成栈（含 S5/S6 变更）不可直接比较；本轮只复跑定向文件。

## 3. 渲染 / 性能证据（visualRuntime）

> 代码：`src/runtime/visualRuntime.ts`；测试：`src/runtime/visualRuntime.test.ts`（本次实测 **19 passed，exit 0**）、`src/runtime/effectRegistry.test.ts`（**6 passed**）。S3-4/5 的 rAF 基座为 `src/lib/perf/rafScheduler.ts`（6 用例）。

### 3.1 档位与阈值（当前代码真值）

| 项                                    | 值                                                    | 位置                                 |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| 画质档（tier → dprCap / effectScale） | `high` 2 / 1 → `medium` 1.5 / 0.75 → `low` 1 / 0.5    | `visualRuntime.ts:28-32`             |
| FPS 降档阈值                          | **< 50** → 降一档                                     | `visualRuntime.ts:34`、`:346-351`    |
| FPS 升档阈值                          | **≥ 58**，且连续 **3** 个稳定窗口才升一档             | `visualRuntime.ts:35-37`、`:352-361` |
| FPS 采样窗口                          | 1000ms，最少 10 帧                                    | `visualRuntime.ts:36`、`:45`         |
| 长任务降档                            | > **50ms** 立即降一档；冷却 **1000ms**；到 `low` 夹取 | `visualRuntime.ts:39-41`、`:222-229` |
| 绘制耗时采样                          | 最近 **120** 次订阅者回调（环形缓冲）                 | `visualRuntime.ts:47`、`:317-329`    |

### 3.2 测试名与当前值

| 测试名（`visualRuntime.test.ts`）                                                | 断言 / 当前值（测试内可推导）                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `shares one rAF across multiple subscribers and dispatches in order`             | 3 订阅者仅 **1 次** rAF 请求；同帧按注册顺序派发                                     |
| `samples FPS on a one-second window`                                             | 61 帧 @16.67ms → `fps` ∈ (58, 62)，约 **60**                                         |
| `downgrades DPR and effect quality when average FPS stays below threshold`       | 64 帧 @33.34ms（≈30fps）→ `quality=low`、`dprCap=1`、`effectScale=0.5`               |
| `upgrades one tier after three stable high-FPS windows`                          | `low` →（3 窗口）`medium` →（3 窗口）`high`；hidden/恢复保留档位                     |
| `recordLongTask drops one tier immediately and respects the cooldown`            | 50ms 不降；80ms → `medium`；冷却内不再降；冷却后 → `low`，通知序列 `high→medium→low` |
| `routes longtask entries into quality downgrade`                                 | 观察者条目 >50ms → 降档；一次 `[+20,+70]` 条目只降一档                               |
| `attaches one longtask observer while subscribed, then detaches on stop/dispose` | 多订阅只 1 个 observer；最后一个 stop/dispose 断开                                   |
| `simulates 4x throttle (33ms frames) and reaches low within two windows`         | 第 1 窗口 `high→medium`，第 2 窗口 `medium→low`                                      |
| `upgrades one tier after three stable >=58fps windows`                           | 2 窗口不升；第 3 窗口 `low→medium`                                                   |
| `exposes tier via getQuality(), qualityTier, and getStats()`                     | 初始 `{tier:"high",dprCap:2,effectScale:1}`；60ms 长任务后 `{medium,1.5,0.75}`       |
| `samples draw p50/p95 from subscriber callback durations`                        | 注入 1..100ms → `drawP50Ms=50`、`drawP95Ms=95`；窗口封顶 `drawSamples=120`           |
| `keeps draw p95 within 10% of the simulated legacy baseline`                     | 合成负载 1.3/1.7ms；断言 `drawP95Ms ≤ baselineP95 × 1.1`                             |
| `keeps one scheduler request per frame for multiple visual consumers`            | 2 消费者 3 帧：各 3 次回调，scheduler 请求 **3 次（1/帧）**                          |
| `pauses on hidden, keeps no pending frame, and resets delta on visibility`       | hidden 后 0 待执行帧、`fps=0`；恢复首帧 delta=16.67ms                                |

### 3.3 draw p50/p95 的「当前值」口径

- **单测可推导的当前值只有合成值**：p50=50ms / p95=95ms 对应注入的 1..100ms 序列，不是真实渲染耗时；基线对比用例的 1.3/1.7ms 也是 `simulateDrawWork` 忙等合成负载。
- **历史口径（未复核）**：TRACKING S5-2 记录同帧 jsdom 对比 baseline p95 **1.7037–1.7042ms** vs runtime **1.7075–1.7095ms**（**+0.21%~+0.31%**，阈值 ≤10%）。
- **真机 1920×1080 dpr2 的 draw p50/p95 未采样**：`perf/` 下没有 `s5-before.json` / `s5-after.json`，`scratch/perf/measure.py` 的 14 效果 JSON 未落库 → **未验证**。

### 3.4 14 effects 迁移进度

- V7 效果共 **14** 个（`src/store/visualizationStore.ts:3-17`）。
- EffectPlugin 注册表只迁了 **2** 个试点：`spatialMesh`、`nebulaField`（`src/components/visualization/effectPlugins.ts:13-15`），其余 **12** 个仍走 `VisualizationView` 旧 switch。
- `featureFlags.effectPlugins` 默认 **off**（`src/lib/perf/featureFlags.ts:27`），即默认运行态下 14 个效果全部走旧路径；registry 单测 6 例通过。
- 结论：**14 effects migration = 2/14（结构），默认未启用**；14 效果逐张截图与人工对照未做。

## 4. S3-2 受保护视图截图（D7）

来源目录：[screenshots/s3-2/README.md](./screenshots/s3-2/README.md)（含状态 fixture、复现步骤与已知差异）。
manifest：[screenshots/s3-2/manifest.json](./screenshots/s3-2/manifest.json)（`baseUrl=http://127.0.0.1:3037`、Chrome 156.0.8078.49、git commit `6ac0eba`）。

| 视图     | 状态                                                           | 视口         | 文件                                                                                |      大小 | SHA-256                                                            | 捕获（UTC）              |
| -------- | -------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- | --------: | ------------------------------------------------------------------ | ------------------------ |
| Home     | 全新 profile，`currentView=home`                               | 1440×900 @1x | [home-1440x900.png](./screenshots/s3-2/home-1440x900.png)                           | 667,110 B | `8c35835476e484618025401f0389f9882f8caa585e252c2a65819b7d67c4f371` | 2026-10-29T09:41:35.826Z |
| Player   | `ui-store-v2` currentView=player + `player-store` 稻香 fixture | 1440×900 @1x | [player-1440x900.png](./screenshots/s3-2/player-1440x900.png)                       | 624,217 B | `8d45c3d978903f08105f22c4e8600f499da02eb370796a85fd6df9c82524f669` | 2026-10-29T09:41:45.607Z |
| 全屏歌词 | 同 Player，点击 `[title="点击进入全屏歌词"]`                   | 1440×900 @1x | [lyrics-fullscreen-1440x900.png](./screenshots/s3-2/lyrics-fullscreen-1440x900.png) | 299,053 B | `946c0718a169ebfe84abd7344e28df95801bc6480f439d21fc74b51c5508ab15` | 2026-10-29T09:41:47.612Z |

**本轮复核（实测）**：用 `Get-FileHash -Algorithm SHA256` 重算 3 个 PNG，哈希与 manifest 逐一相同；`System.Drawing` 读取尺寸均为 **1440×900**，均 < 2 MB。截图脚本与 manifest 记录的运行时为 Node v24.16.0 + Playwright 1.64.1（未提交为依赖）。

## 5. before vs after 限制：三视口 pixel diff 不可用

S3 计划 §S3-2 Step 3 要求：受保护视图（Home / Player / 全屏歌词）在 **1280×720、1920×1080、2560×1440** 三个视口各做改前/改后截图，pixelmatch/ImageMagick 输出 diff 比例，目标 **≤0.1%**（仅允许亚像素抗锯齿差异），并附 6 张对比图 + Lead 复核记录。

**本 worktree 无法产出该矩阵，原因如下（结论：pixel-diff matrix = 不可用 / unavailable）：**

1. **没有改前基线**：S3-1/S3-3/S3-10b 的选择器改写早已合入当前栈，worktree 中没有 pre-refactor 的 build/静态产物，也没有历史 before 截图；仅有 after 不构成 A/B。
2. **视口不匹配**：现有截图固定 **1440×900**（证据任务指定），不在计划三视口之列，无法与 1280/1920/2560 的矩阵拼合。
3. **重建 before 成本与风险高**：需要 checkout S3 之前的提交（如 `41b51e3` 之前的基点）单独 build/dev 捕获，再回到当前栈重采；且两棵树必须同 Chrome 版本、同 deviceScaleFactor、同字体与同 fixture，否则 diff 主要反映环境噪声而非订阅改写。
4. **缺少 diff 工具链**：仓库未提交 pixelmatch/ImageMagick 依赖与脚本，未做像素比对。

因此本文档**不宣称**受保护视图「像素等价」，只记录**当前态 3 张截图 + manifest 哈希**作为回归比对基线；D7 的 ≤0.1% 判定仍为 **未验证**。最小补齐路径见 §8。

## 6. M3 出口门清单

### 6.1 看板口径（TRACKING 行 71）

| 门项                      | 判据                                       | 当前证据                                                      | 状态             |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------- | ---------------- |
| 组件层整店订阅            | 0（全仓 ≤10）                              | `report-store-stats` 实测 whole **0**、whole-only files **0** | **达成（结构）** |
| toast/面板不再重渲染 page | Profiler：单次 toast 子树 commit 下降 ≥80% | 无 React Profiler 采样；仅有选择器静态归零                    | **未验证**       |
| idle rAF ≤1               | CDP 注入计数 + 60s 采样                    | `floatingGating` / `rafScheduler` fake-rAF 用例；无 CDP       | **部分（结构）** |
| 面板关闭 DOM 回收 ≥80%    | CDP DOM 节点计数                           | `LazyPanel` jsdom 10→2（80%）；无 CDP                         | **部分（结构）** |
| 包体不退化                | build + bundle report                      | 本轮未 build；S3 计划称不改包体                               | **未验证**       |

### 6.2 S3 计划 E1–E13

| 出口 | 指标                            | 目标    | 当前证据（实测/历史）                                                                                                            | 状态             |
| ---- | ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| E1   | page.tsx 整店订阅               | 0       | 全局 whole=0（page 含在内）                                                                                                      | **达成（结构）** |
| E2   | 5 个壳文件整店订阅              | 0       | 全局 whole=0；5 文件在 S3-1/S3-10b 清零                                                                                          | **达成（结构）** |
| E3   | 单次 toast 的 Home 子树 commit  | 降 ≥80% | 无 Profiler                                                                                                                      | **未验证**       |
| E4   | 播放中 viz 顶层 commit（10s）   | ≤1      | `VisualizationView.selectors.test.tsx` 15 例（Profiler 包裹，jsdom）；无 dev 10s 实播                                            | **部分**         |
| E5   | idle rAF 循环数                 | ≤1      | fake-rAF：挂载 2→1、hidden/inactive 0；无 CDP 60s                                                                                | **部分**         |
| E6   | Home 播放中 Player3D rAF（60s） | 0       | fake timer：60,000ms→0 次 rAF/0 次采样；无 `__perf` 实测                                                                         | **部分**         |
| E7   | 关 18/20 面板 DOM 回收率        | ≥80%    | jsdom 10 面板 10→2 mounted/0 active（计划 20 开/18 关口径未做）；无 CDP DOM                                                      | **部分**         |
| E8   | 关闭面板 5min 内活跃 timer      | 0       | S3-6b 未做；生产代码无 `usePanelDeactivate` 消费                                                                                 | **未达成**       |
| E9   | 重复全局宿主                    | 1 / 1   | `globalHosts.test.tsx` 4 例（单例、无 error warn、data-manager 可用）                                                            | **达成（结构）** |
| E10  | playlistStore 整店订阅文件      | 0       | 全局 whole=0                                                                                                                     | **达成（结构）** |
| E11  | audioStore 整店订阅文件         | 0       | 全局 whole=0（TRACKING 记 7→0）                                                                                                  | **达成（结构）** |
| E12  | 首屏后 5s 动态 import 数        | ≤3      | `PanelOrchestrator.prefetch.test.tsx` 6 例（2999ms 前 0、5s 内 2、saveData 跳过、pointerover 一次）；无 PerformanceObserver 实测 | **部分**         |
| E13  | 组件层整店订阅总数              | ≤10     | 实测 0                                                                                                                           | **达成（结构）** |

### 6.3 render 目标（S5/M5 计划口径，同一集成栈；父任务点名核对）

| 目标            | 判据                                                | 当前证据                                                                                                                         | 状态                         |
| --------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| draw p95        | 相对 before 劣化 ≤10%（1920×1080 dpr2，单效果 60s） | 单测：合成 baseline 1.3/1.7ms 下 `drawP95Ms ≤ baselineP95×1.1`；历史 jsdom 同帧 +0.21%~+0.31%；**无 measure.py JSON / 真机样本** | **部分（合成）/ 真机未验证** |
| long-task 降档  | >50ms 立即降一档、1s 冷却、一次一档                 | `recordLongTask` / observer 共 4 例相关用例通过；无真实 Chrome longtask trace                                                    | **达成（单测）/ 真机未验证** |
| FPS 档位        | <50 降档、≥58×3 窗口升档；4x throttle 2 窗口到 low  | 6 例通过（含 33.4ms 帧）；无真机 FPS 采样                                                                                        | **达成（单测）/ 真机未验证** |
| 14 effects 迁移 | 14 个效果迁移并通过截图/契约；draw p95 差 ≤10%      | 仅 **2/14** 注册（spatialMesh、nebulaField），flag 默认 off；无 14 效果截图                                                      | **未完成**                   |

### 6.4 未验证清单（显式）

- **未验证**：E3（toast→Home 子树 Profiler commit 降幅）。
- **未验证**：E5/E6/E7 的 CDP 60s / DOM 节点计数真机口径（仅有 jsdom/fake-timer 结构证据）。
- **未验证**：E12 的 `PerformanceObserver(resource)` 首屏 5s 实测与 LCP A/B。
- **未验证**：D7 三视口（1280/1920/2560）改前/改后 pixel diff ≤0.1%；现有截图仅 1440×900 当前态。
- **未验证**：真机 1920×1080 dpr2 的 draw p50/p95、dropped、FPS 中位；`perf/` 无 S5 JSON。
- **未验证**：面板重开 queue ≤300ms；无 PerformanceObserver longtask 实测。
- **未验证**：包体不退化（本轮未 `npm run build`）。
- **未验证**：运行态 0 console error / 0 uncaught exception（截图脚本记录 Player/歌词各 2 条既有 dev 401，非 pageerror）。
- **未达成**：E8（S3-6b 未接生产面板）。
- **未完成**：14 effects 迁移 2/14；effectPlugins 默认 off。
- **已知失败（非本轮引入）**：`report-store-stats --check` exit 1，stderr：`stores 64 != baseline 60; persistCount 43 < baseline 44`。

## 7. 复现命令

全部命令在 worktree 根目录执行（PowerShell 7）；exit code 为 2026-10-29 实测。

```powershell
# 0) 分支（从 b575d15 创建；已存在则跳过）
git checkout -b docs/s3-evidence b575d15

# 1) S3 定向测试（14 文件 / 98 passed）
$env:CI = "1"
npx vitest run `
  src/components/layout/VisualTokens.test.tsx `
  src/components/visualization/VisualizationView.selectors.test.tsx `
  src/components/player/player3dMotion.test.ts `
  src/components/player/Player3D.test.tsx `
  src/components/player/floating/floatingGating.test.tsx `
  src/components/shared/LazyPanel.test.tsx `
  src/components/layout/PanelOrchestrator.keepAlive.test.tsx `
  src/components/layout/globalHosts.test.tsx `
  src/store/selectors/playlistSelectors.test.ts `
  src/components/layout/playlistSubscriptions.test.tsx `
  src/components/layout/PanelOrchestrator.prefetch.test.tsx `
  src/components/layout/top20Subscriptions.test.tsx `
  src/lib/perf/rafScheduler.test.ts
# 实测 exit 0；再跑脚本预算测试：
npx vitest run scripts/perf/report-store-stats.test.mjs        # 2 passed, exit 0

# 2) 结构指标（E1/E2/E10/E11/E13）
node scripts/perf/report-store-stats.mjs                       # whole 0, exit 0
node scripts/perf/report-store-stats.mjs --max-whole 10        # OK: wholeCalls 0 <= 10, exit 0
node scripts/perf/report-store-stats.mjs --check               # 实测 exit 1（既有 baseline 过期）

# 3) 类型 / 文档 / 分层
npx tsc --noEmit                                               # exit 0
npm run verify:docs                                            # fail=0 warn=0, exit 0
npm run verify:layers                                          # 0 errors / 29 warnings, exit 0

# 4) 截图哈希复核（与 manifest 对比）
$dir = "docs/nbl/plans/2026-10-21-arch-perf-execution/evidence/screenshots/s3-2"
Get-ChildItem "$dir/*.png" | ForEach-Object {
  "{0}|{1}|{2}" -f $_.Name, $_.Length, (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
}

# 5) 如需重采当前态截图（需 dev server + Chrome；输出会覆盖同目录 manifest）
node node_modules/next/dist/bin/next dev --webpack -p 3037
npm run perf:screenshots:s3-2
```

```bash
# CI/类 Unix 等价（测试与校验部分）
CI=1 npx vitest run src/runtime/visualRuntime.test.ts src/runtime/effectRegistry.test.ts   # 25 passed
npm run verify:docs && npm run verify:layers && npx tsc --noEmit
```

## 8. 缺口、风险与建议

| #   | 缺口                                                                                       | 影响                                 | 建议                                                                                                               |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1   | S3-6b 未做：生产面板未消费 `usePanelDeactivate`                                            | E8 不达标；关闭面板后 timer/rAF 仍跑 | 按计划给 accountCenter/audioSourceManager/aiSettings/search/lyricsSearch 接 deactivate，并补「关闭后 timer=0」用例 |
| 2   | 无 `shellSubscriptions.test.tsx`                                                           | S3-2 的 E3 结构断言缺失              | 按计划补 5 例 Profiler（含 toast/panels 变化不 commit）                                                            |
| 3   | 无 CDP/Profiler 采样脚本产物                                                               | E3/E5/E6/E7/E12 无法关闭             | 落一个 `scripts/perf/s3-cdp.mjs`（rAF 计数、DOM 节点、PerformanceObserver、Profiler hook），输出 JSON 入库         |
| 4   | 无改前基线 / 三视口截图                                                                    | D7 ≤0.1% 无法判定                    | 在 S3 之前提交（如 `41b51e3`）建 before worktree，同 Chrome/同 fixture 采 3 视口，pixelmatch 后回填本表            |
| 5   | `report-store-stats --check` baseline 过期（baseline 60 stores / 44 keys vs 当前 64 / 43） | CI 若启用 --check 会红               | 经批准后重建 `perf/store-stats-baseline.json`（S3-10b 已记录同一问题）                                             |
| 6   | draw p95 无真机 JSON                                                                       | M5/渲染门无法判定                    | 跑 `scratch/perf/measure.py` 14 效果，落 `perf/s5-before.json` / `perf/s5-after.json`                              |
| 7   | 14 效果仅 2 个插件化                                                                       | 迁移门未达                           | 按 S5-4/S5-7 继续注册剩余 12 个，并补 14 张截图                                                                    |
| 8   | 全量 suite 未复跑                                                                          | 只能证明定向文件                     | 合入前跑一次 `npx vitest run`（TRACKING 最近记录：310 files / 1930 passed + 1 skipped）并回填 §2.2                 |

> 结论：S3 的**代码与结构目标**（整店订阅 0、idle 循环收敛、面板 LRU、宿主去重、预取 12→2）已在本集成栈成立，且定向回归与类型/文档/分层门禁全绿；但**M3 出口门仍未关闭**，阻塞项集中在 CDP/Profiler 真机证据、S3-6b 的 deactivate 接线、D7 三视口 baseline，以及过期的 store-stats baseline。
