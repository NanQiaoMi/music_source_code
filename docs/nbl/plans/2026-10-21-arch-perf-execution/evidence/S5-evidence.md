# S5 阶段退出证据（M5 出口门）

> 计划依据：[S5-render-runtime.md](../S5-render-runtime.md) §1/§3/§5「阶段级验证命令与证据清单」
> 看板：[TRACKING.md](../TRACKING.md) §S5（行 94–104）｜上游：[架构与性能优化总计划](../../../2026-10-21-architecture-performance-optimization.md) §5 S5
> 生成时间：2026-10-29 18:06（Asia/Shanghai）
> worktree：`D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`
> 分支：`docs/s5-evidence`（自 `692f908` 创建；该提交同时是 `integration/s2-audio` 的 HEAD）
> 约束：仅新增本文档；未 push；未改动主工作区 `D:/26project/music_source_code_V1.1_full/music_source_code`。

## 0. 结论（先看这里）

- **任务完成度**：TRACKING 记 S5-1..S5-7 全部 done（7/7），计划 17 个子 PR 在当前集成历史上压成 **8 个 perf 提交 + 8 个 docs 提交**（`git log --all --grep='s5-'` 实测 16 条）。8 个分支 tip 均为 HEAD 祖先（`git merge-base --is-ancestor` 全部 exit 0）。
- **本轮实测**（2026-10-29，本 worktree）：S5 定向测试 **12 文件 / 71 passed，6 条命令 exit 0**；`npm run verify:docs` **fail=0 warn=0，exit 0**；`npx tsc --noEmit` **exit 0**。
- **渲染结构已落地**：`visualRuntime` 单例成为唯一帧/画质权威，`visualization` / `shelf3d` / `floating-spectrum` / `floating-waveform` / `floating-hud` **5 个订阅者共享 1 条 rafScheduler 循环**；隐藏标签页停表；high/medium/low 三档（DPR 2/1.5/1、effectScale 1/0.75/0.5）由 FPS 窗口与 >50ms longtask 驱动；2 个试点效果（spatialMesh、nebulaField）走 EffectPlugin 契约（**2/14**）。
- **M5 出口门未关闭**（按 TRACKING 行 96 与计划 §1.2 判定）：
  1. **rAF 审计已可复现（2026-10-29 补齐）**：`perf/rAF-whitelist.json` + `npm run verify:raf` 覆盖非测试 `requestAnimationFrame` 调用 **14 行**（9 行允许 + **5 行 pending：Player3D ×4、AudioEffectsPanel ×1**，reason 标注 TODO(S5-3b)）。E5-1 的「调用点 ≤8」**仍不判达成**：pending 迁移完成前按 9 允许 + 5 待办计，不得把 pending 当豁免。
  2. **1080p dpr2 ≥90fps 无 dropped 完全未验证**：没有真实浏览器/生产构建测量；`visualRuntime.getStats()` **没有 droppedFrames 字段**，即使跑浏览器也无法给出 dropped 数字。
  3. **draw p95 仅有 jsdom 合成证据**：`visualRuntime.test.ts` 用 1.3/1.7ms 合成负载断言 p95 ≤ baseline×1.1；TRACKING 记迁移前后 1.7037–1.7042ms → 1.7075–1.7095ms（+0.21~0.31%），为 jsdom 同帧口径。真实 1920×1080 dpr2 未测。
  4. **4x CPU throttle 与 >200ms 长任务未验证**：只有「33.4ms/帧」的合成帧序列降档测试（2 个采样窗口内 high→low），不是 Chrome 4x throttle trace。
  5. **计划中的测量基座整体缺失**：`perf/s5-*.json`、`scratch/perf/measure.py`、`src/app/dev/viz-harness`、`scripts/perf/allocation-probe.mjs`、`perf/allocation/*.json`、14 效果截图、Profiler/CDP 证据均不存在（§6）。
- **证据口径**：本轮实际执行并捕获 exit code 的数字标「实测」；来自 TRACKING/提交时记录的标「历史」；jsdom + 构造器计数/合成负载标「合成」；无证据的标「**未验证**」。本文不写任何未测量的性能数字。

## 1. 环境与统计口径

| 项           | 值                                                                     |
| ------------ | ---------------------------------------------------------------------- |
| OS / shell   | Windows / PowerShell 7（pwsh）                                         |
| Node / npm   | v24.16.0 / 11.13.0（本轮实测 `node -v` / `npm -v`）                    |
| 测试框架     | Vitest 4.1.5（jsdom，非 watch）                                        |
| 分支 / 基点  | `docs/s5-evidence` ← `692f908`（`integration/s2-audio` HEAD）          |
| 变更行数来源 | `git show --numstat <perf-commit>`（src/docs/测试合并计）              |
| 测试计数     | vitest 默认 reporter 的 files/tests 行（仅点名文件，含文件内既有用例） |
| 定向测试合计 | **12 文件 / 71 passed / 0 failed，6 条命令全部 exit 0**                |

> 分支关系（实测）：`feature/arch-perf-s5-1` @ `e906be5`、`s5-2` @ `ebb2d38`、`s5-3` @ `9e1f932`、`s5-4` @ `ae0bfb2`、`s5-5` @ `cd3c9cd`、`s5-6` @ `6d4995e`、`s5-6b` @ `b8e0c0c`、`s5-7` @ `df95414`；8 个 tip 全部是 HEAD 的祖先。历史提交均未 push。

## 2. S5-1..S5-7 交付与验证

### 2.0 `git log --all --oneline --grep='s5-'`（实测 16 条）

```text
df95414 docs(s5-7): record heavy effect allocation audit
15f8ef9 perf(s5-7): remove per-frame allocations in heavy effects
cd3c9cd docs(s5-5): record frame and particle buffer reuse
0f9fbfe perf(s5-5): reuse plugin frame and particle buffers
ae0bfb2 docs(s5-4): record effect plugin registry with pilots
384a6a4 perf(s5-4): add EffectPlugin contract and registry with 2 pilots
b8e0c0c docs(s5-6): record longtask auto wiring done
0110cf4 perf(s5-6b): auto-attach longtask observer and consume quality tier
6d4995e docs(s5-6): record quality tier 6a, 6b pending
0d0714a perf(s5-6): add quality tier with longtask downgrade
9e1f932 perf(s5-3): migrate Shelf3D and floating loops to VisualRuntime
ebb2d38 docs(s5): fix S5 counters after S5-2
37c5e3e docs(s5-2): record VisualizationView migration
490249a perf(s5-2): migrate VisualizationView draw scheduling
e906be5 docs(s5-1): record VisualRuntime v1
f83d2a0 perf(s5-1): add single VisualRuntime frame/quality authority
```

### 2.1 任务表

| ID   | 交付摘要（与 TRACKING 对齐）                                                                                                                              | 代码提交（分支 tip）                                | 文档提交                | 变更（`git show --numstat`）           | 定向测试（本轮实测）                                                            | exit | 缺口 / 备注                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| S5-1 | VisualRuntime v1：单 rafScheduler、FPS 窗口、DPR/effectScale 档位、draw 采样、hidden 暂停                                                                 | `f83d2a0`（`feature/arch-perf-s5-1` @ `e906be5`）   | `e906be5`               | 4 文件 +554/−18                        | `visualRuntime.test.ts` **19 passed**（与 S5-2/5-6 共享文件；S5-1 归属约 8 条） | 0    | 无 DevTools 单 rAF 截图、无 `getStats()` 导出；计划中的 priority bucket/FrameGate/fpsCap/reducedMotion **未实现**；无 droppedFrames |
| S5-2 | VisualizationView 调度迁入 runtime（绘制体不动，flag off 保留旧循环）                                                                                     | `490249a`（`feature/arch-perf-s5-2` @ `ebb2d38`）   | `37c5e3e` + `ebb2d38`   | 4 文件 +205/−40                        | `VisualizationView.selectors.test.tsx` **15 passed**（含 S3-3 既有用例）        | 0    | 无 `perf/s5-before/after.json`、无 measure.py、无 14 效果截图、无 Profiler 导出；p95 仅 jsdom 合成                                  |
| S5-3 | Shelf3D + 3 个浮动层组件（spectrum/waveform/debug HUD）改 `visualRuntime.subscribe`（id：shelf3d / floating-spectrum / floating-waveform / floating-hud） | `9e1f932`（`feature/arch-perf-s5-3` @ `9e1f932`）   | 同提交（TRACKING 3 行） | 8 文件 +510/−28（src 7 文件 +507/−25） | 3 文件 **14 passed**（Shelf3D 3 + Floating 4 + gating 7）                       | 0    | 无 3D+可视化同开 FPS 曲线/截图；`Player3D` 仍原生 rAF（S5-3b 未做）；`perf/rAF-whitelist.json` 缺失                                 |
| S5-4 | EffectPlugin 契约 + registry（LRU=2）+ spatialMesh/nebulaField 两个试点                                                                                   | `384a6a4`（`feature/arch-perf-s5-4` @ `ae0bfb2`）   | `ae0bfb2`               | 13 文件 +896/−48                       | 4 文件 **17 passed**（registry 6、dispatch 5、两试点各 3）                      | 0    | 无 legacy vs plugin 帧时间/截图 diff；registry 为同步加载（无 async/preload）；`NEXT_PUBLIC_EFFECT_PLUGINS` 默认 off                |
| S5-5 | 粒子池对象复用 + EffectFrame/theme/utils/refs 稳定引用                                                                                                    | `0f9fbfe`（`feature/arch-perf-s5-5` @ `cd3c9cd`）   | `cd3c9cd`               | 6 文件 +362/−63                        | 2 文件 **3 passed**；另有 2 条用例在 selectors/plugin 测试内                    | 0    | 无 Chrome Allocation 截图、无 draw p95 对比；JS 对象字面量计数无法覆盖                                                              |
| S5-6 | FPS/longtask 自动降档（6a）+ PerformanceObserver 自动挂接与档位消费（6b）                                                                                 | `0d0714a` + `0110cf4`（tips `6d4995e` / `b8e0c0c`） | `6d4995e` + `b8e0c0c`   | 2 提交、4 个不同文件，累计 +383/−20    | `visualRuntime.test.ts` 19 条中的 **9 条**质量/长任务用例                       | 0    | 无 D5 设备检测、`?tier=`、`NEXT_PUBLIC_QUALITY_TIER`；无 Chrome 4x trace；无 >200ms longtask 实测                                   |
| S5-7 | 3 个重效果每帧分配审计与修复（cinematicLyricDrift / 手书纸面族 / orientalLandscape）                                                                      | `15f8ef9`（`feature/arch-perf-s5-7` @ `df95414`）   | `df95414`               | 8 文件 +900/−254                       | `heavyEffectsAllocation.test.ts` **3 passed**                                   | 0    | 无 CDP HeapProfiler/allocKBPerSec、无 `perf/allocation/*.json`；探针用 jsdom 构造器计数替代                                         |

- 行数为 `git show --numstat` 汇总（含测试；S5-3 含 TRACKING 3 行）；「N passed」为该命令 vitest 输出，不是提交内测试文件数。
- 计划 17 个子 PR 与当前可见的 8 个 perf 提交不是一一对应：集成历史按任务压平，S5-6 保留 6a/6b 两个提交。本文按任务粒度记录。

### 2.2 定向测试明细（2026-10-29，本 worktree 实测）

| 任务     | 命令（`npx vitest run` 后跟文件）                                                                                                    | 结果               | exit |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ---- |
| S5-1/2/6 | `src/runtime/visualRuntime.test.ts`                                                                                                  | 1 文件 / 19 passed | 0    |
| S5-4     | `src/runtime/effectRegistry.test.ts` + `effectPlugins.test.ts` + `spatialMeshPlugin.test.ts` + `nebulaFieldPlugin.test.ts`           | 4 文件 / 17 passed | 0    |
| S5-2     | `src/components/visualization/VisualizationView.selectors.test.tsx`                                                                  | 1 文件 / 15 passed | 0    |
| S5-5     | `src/components/visualization/particlePool.test.ts` + `effects/pilotDrawAllocation.test.ts`                                          | 2 文件 / 3 passed  | 0    |
| S5-7     | `src/components/visualization/effects/heavyEffectsAllocation.test.ts`                                                                | 1 文件 / 3 passed  | 0    |
| S5-3     | `src/components/library/Shelf3DView.runtime.test.tsx` + `player/floating/FloatingVisualRuntime.test.tsx` + `floatingGating.test.tsx` | 3 文件 / 14 passed | 0    |
| **合计** | 12 个不同测试文件                                                                                                                    | **71 passed**      | 0    |

> 特点：全部为 jsdom 单元/结构测试；没有真实 Canvas 像素、没有真实 FPS、没有 CDP/Profiler。表中「passed」可复现，性能数字不可当作真实设备结论。

## 3. 渲染证据（逐项，标注口径）

### 3.1 单一帧循环（E5-2，合成）

`visualRuntime` 是唯一帧权威：订阅者写入 `Map`，循环由 `rafScheduler.request` 排一次；`tick` 内快照订阅者并逐个回调，单订阅者异常被隔离并摘除。生产接线 5 个 id：

| 消费者              | 文件                                                      | 优先级/门控（现状）              |
| ------------------- | --------------------------------------------------------- | -------------------------------- |
| `visualization`     | `src/components/visualization/VisualizationView.tsx`      | 视图切换时 stop/重建订阅         |
| `shelf3d`           | `src/components/library/Shelf3DView.tsx`                  | flag on 时订阅；保留自身画质窗口 |
| `floating-spectrum` | `src/components/player/floating/FloatingSpectrumGlow.tsx` | 无信号/隐藏时 stop               |
| `floating-waveform` | `FloatingWaveformGlow.tsx`                                | 减动效/隐藏时 stop               |
| `floating-hud`      | `FloatingDebugHUD.tsx`                                    | HUD 关闭 0 回调                  |

| 断言                                                           | 测试文件 / 用例                                                 | 当前实测（合成）                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| 3 个订阅者只产生 1 次 rAF 请求，回调按注册顺序分发             | `src/runtime/visualRuntime.test.ts`「shares one rAF …」         | requestFrame=1；1 帧后 =2；顺序 [a,b,c]                |
| 2 个视觉消费者共享 1 条循环，每帧仅 1 次排帧                   | 同文件「keeps one scheduler request …」                         | 3 帧 → 每消费者 3 次、request 3 次                     |
| Shelf3D + 浮动波形只 1 个待执行帧                              | `src/components/library/Shelf3DView.runtime.test.tsx`           | ids [shelf3d, floating-waveform]；request=1；pending=1 |
| 两个浮动可视层共享 1 帧，5 帧 = 5 次 request + 10 次 clearRect | `src/components/player/floating/FloatingVisualRuntime.test.tsx` | request=5、clearRect=10（2×5）、pending=1              |
| flag off：旧路径每消费者一条链（2 请求/帧）                    | 同文件「flag off …」                                            | 3 帧 → request=6、clearRect=6                          |

> 缺口：没有「可视化 + 3D 架 + 浮动层同时激活」的三订阅者单测；E5-2 的「同时激活只 1 循环」是 **2 消费者组合 + 单测 3 订阅者** 的结构证据，不是三者同开的实测。

### 3.2 FPS 档位与 long-task 降档（S5-1/S5-6，合成）

常量（`src/runtime/visualRuntime.ts` 实测）：

| 项            | 值                                                                       |
| ------------- | ------------------------------------------------------------------------ |
| 档位          | `high` dprCap 2 / effectScale 1；`medium` 1.5 / 0.75；`low` 1 / 0.5      |
| 粒子数        | `max(120, round(1000 × effectScale))`（VisualizationView）→ 1000/750/500 |
| FPS 降档      | < 50（`FPS_DOWNGRADE_THRESHOLD`）                                        |
| FPS 升档      | ≥ 58 连续 3 个 1s 窗口（`QUALITY_UPGRADE_STABLE_WINDOWS`）               |
| longtask      | > 50ms 立即降一档；1000ms 冷却；一次只降一档，clamp 到 low               |
| delta clamp   | 首帧 16.67ms，最大 50ms                                                  |
| draw 采样窗口 | 最近 120 次订阅者回调（`Float64Array` 环形缓冲）                         |

| 断言                                       | 测试用例（`visualRuntime.test.ts`）                            | 当前实测（合成）                                                          |
| ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 33.34ms/帧（≈30fps）在 2 个窗口内 high→low | 「downgrades DPR …」+「simulates 4x throttle …」               | 31 帧后 medium、62 帧后 low；继续低帧不重复通知                           |
| 连续 3 个 ≥58fps 窗口升一档                | 「upgrades one tier after three stable …」                     | 183 帧（3 窗口）low→medium；不足 3 窗口不升                               |
| 80ms 长任务立即降档、冷却期内不叠加        | 「recordLongTask drops one tier …」                            | high→medium；冷却后半程 medium→low；重复 500ms 仍 low、只通知 2 次        |
| 长任务 observer 单例挂接/停订/隔离异常     | 「attaches one longtask observer …」「routes …」「survives …」 | factory 1 次；首个 stop 不 disconnect，末个 stop disconnect；dispose 摘除 |
| 档位三元组与监听                           | 「exposes tier via getQuality() …」                            | {high,2,1}→{medium,1.5,0.75}                                              |

> 口径：33.4ms 帧序列是**合成的 4x throttle 近似**（约 30fps），不是 Chrome DevTools CPU 4x；没有记录任何真实 longtask 时长，也没有 >200ms 长任务 trace。

### 3.3 draw p50/p95（S5-2，合成 + 历史）

| 断言                                    | 测试用例                                      | 当前实测 / 记录                                              |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| 最近秩分位正确，窗口只保留 120 次       | 「samples draw p50/p95 …」                    | 注入 1..100ms → p50=50、p95=95；再跑 60 帧后 drawSamples=120 |
| runtime p95 ≤ 同帧 legacy baseline ×1.1 | 「keeps draw p95 within 10% …」               | 合成成本 1.3/1.7ms；断言通过（测试不打印实际 p95）           |
| 迁移前后 jsdom 同帧 p95                 | TRACKING S5-2 行（历史，提交 `490249a` 时点） | 1.7037–1.7042ms → 1.7075–1.7095ms，**+0.21~0.31%**（≤10%）   |
| 真实 1920×1080 dpr2 单效果 60s          | 计划 §S5-2b                                   | **未验证**（无 measure.py / harness / perf JSON）            |

> `drawP95Ms` 只统计订阅者回调本体（排帧/统计不计入），与旧循环口径可比。真实设备 p95、dropped、FPS 均无数据。

### 3.4 S5-3 共享帧循环与后台暂停

| 场景                    | 测试（`Shelf3DView.runtime.test.tsx` / `FloatingVisualRuntime.test.tsx`） | 当前实测（合成）                                    |
| ----------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| Shelf3D + 浮动波形挂载  | Shelf3D「flag on：…共享 1 个 runtime 帧」                                 | 2 个 id、1 次 request、pending=1                    |
| 隐藏标签页              | Shelf3D「隐藏时不排帧，恢复可见后重新订阅式续帧」                         | subscribers=1、pending=0；恢复后 pending=1          |
| 浮动层隐藏 5 帧         | Floating「hidden 时共享帧停止（0 帧）…」                                  | 隐藏期间 clearRect=0；恢复后 pending=1、1 帧画 2 次 |
| 60fps 驱动 2s（120 帧） | Floating「帧时基：60fps 驱动 2 秒…」                                      | runtime fps ≥50；每消费者 120 帧；request=120       |
| flag off 回退旧链       | 两文件「flag off」用例                                                    | 不订阅 runtime；2 条链（3 帧 6 次 request）         |

> 口径：时间是测试注入的 16.67ms 帧序列，不是真实刷新率；60Hz/165Hz 屏、3D+可视化同开 FPS≥50 均 **未验证**。

### 3.5 后台暂停（归属澄清）与 S5-5 对象复用

**澄清**：S5-5 本身不含「后台暂停」语义；后台暂停/隐藏停表由 **S5-1 runtime** 与 **S5-3 浮动层/Shelf** 覆盖（见 3.4）。S5-5 的证据是「resize/切效果不再重建对象」：

| 断言                                                   | 测试文件 / 用例                                                 | 当前实测（合成）                                                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 100 次 resize 后 frame/refs/theme/utils/粒子引用全不变 | `VisualizationView.selectors.test.tsx`「S5-5: 100 次 resize …」 | 同一 frame/refs/theme/utils；particles 仍 1000 个且首对象同一；热路径 Array.from/Float32Array/Uint8Array = **0/0/0** |
| 粒子池容量足够时 100 次 resize 复用每个对象            | `particlePool.test.ts`「reuses every particle object …」        | 1000 个引用逐项相同                                                                                                  |
| 扩容只在超出容量时发生，缩容原地截断                   | `particlePool.test.ts`「grows only …」                          | 128→256 保留首对象；256→64 原地截断                                                                                  |
| 两个试点效果 draw 无 Array.from / typed array / slice  | `pilotDrawAllocation.test.ts`                                   | 计数 0/0/0                                                                                                           |

> 缺口：这是构造器计数，不是 Chrome Allocation Instrumentation；无 GC 锯齿/堆增长数据。

### 3.6 S5-6 质量档位（功能接通，D5 设备档未做）

- 档位判定/切换：`visualRuntime.setQuality(tier)` + 用户预设入口 `src/lib/visualization/quality.ts`（S6-8c，cinematic/balanced/battery → high/medium/low）。
- 档位消费：`VisualizationView` 监听 `onQualityChange`，仅档位变化时重建后备存储与粒子池；jsdom 用例把 `devicePixelRatio` 固定为 2，画布宽实测 **2048 → 1536 → 1024**，同档重复通知不重建（`width` setter 只调用 1 次）。
- 自动降档：FPS <50 → 降一档；>50ms longtask → 立即降一档（1s 冷却）；≥58fps ×3 窗口升一档。
- **未实现**（计划 D5/§S5-6）：`detectTier`（deviceMemory/hardwareConcurrency）、`?tier=` dev 覆盖、`NEXT_PUBLIC_QUALITY_TIER` flag、low 档关闭 canvas filter / medium 降 blur（当前 filter 只由效果参数决定，与档位无关）、独立 `src/runtime/qualityTier.ts`。

### 3.7 S5-4 插件试点（2/14 效果，合成）

| 断言                                                  | 测试文件                                                  | 当前实测（合成）                                                          |
| ----------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| 仅注册 2 个试点，按 id 选择，未迁移返回 null          | `effectPlugins.test.ts`（5 条）                           | spatialMesh/nebulaField 命中；auroraWave → null；flag off 全 null         |
| 实例缓存、重复注册抛错、LRU=2 淘汰 dispose            | `effectRegistry.test.ts`（6 条）                          | 同 id 工厂 1 次；容量 2 时最久未用 dispose；release/disposeAll 释放       |
| 插件与 legacy 的 Canvas2D 调用序列逐条一致（各 5 帧） | `spatialMeshPlugin.test.ts` / `nebulaFieldPlugin.test.ts` | 调用序列 `toEqual`；私有平滑值 dispose 后归零                             |
| 插件不写回共享 refs                                   | 两试点测试「does not write back …」                       | `refs.smoothBass/treble` 保持 0                                           |
| 已迁移走插件、未迁移走旧 switch                       | `VisualizationView.selectors.test.tsx`                    | spatialMesh draw 1 次；切 nebulaField 后 1 次；切 auroraWave 两者均不再增 |

> 覆盖率：**2/14 效果**（14 个效果见 `visualizationStore.ts` 的 union）。`NEXT_PUBLIC_EFFECT_PLUGINS` 默认 **off**（灰度未开），生产默认仍走旧 switch；无 20 轮切换后 LRU=2 的端到端用例（registry 单测覆盖容量语义）。

### 3.8 E5-9 canvas 宿主 commit 隔离（合成 Profiler）

| 断言                                                    | 测试                                           | 当前实测（jsdom）       |
| ------------------------------------------------------- | ---------------------------------------------- | ----------------------- |
| currentTime 变化 10 次，VisualizationView 顶层 commit 0 | `VisualizationView.selectors.test.tsx` 第 1 条 | commits = 0             |
| 进度子树 currentTime 10 次 → 10 commit                  | `VisualizationProgressContainer` 用例          | commits = 10，文本 0:10 |
| currentEffect 变化 → 1 commit                           | 同文件第 3 条                                  | commits = 1             |

> 口径：这是 S3-3 的 selector 隔离 + 进度下沉，等价达到「canvas 宿主不因进度 commit」；计划要求的 `VisualCanvasHost`/`VisualControls` **物理拆包未做**，也无 React Profiler trace 导出。

## 4. 性能目标与状态（计划 §1.2 / §5.3）

| #   | 指标（计划阈值）                         | 证据                                                                       | 状态                             |
| --- | ---------------------------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| 1   | 同一时刻仅 1 个 rAF 循环（E5-2）         | 单测 3 订阅者 1 请求；Shelf+浮动 1 请求；浮动双消费者 1 请求               | **达成（合成）**                 |
| 2   | draw p95 劣化 ≤10%（E5-3）               | jsdom 合成 p95 守卫通过；历史 +0.21~0.31%；真实未测                        | **部分（合成）**                 |
| 3   | dropped = 0（E5-3 硬门）                 | runtime 无 droppedFrames 字段；无浏览器测量                                | **未验证**                       |
| 4   | 1920×1080 dpr2 FPS 中位 ≥90（E5-3/M5）   | 无生产构建/真实浏览器数据                                                  | **未验证**                       |
| 5   | 隐藏视图 5s 内 draw = 0（E5-4）          | hidden 停表：0 回调/0 clearRect；恢复 1 帧                                 | **达成（合成）**                 |
| 6   | 4x CPU throttle 10s 内自动降档（E5-5）   | 33.4ms/帧合成序列 2 窗口 high→low                                          | **部分（合成）**                 |
| 7   | 无 >200ms longtask（E5-5）               | 未采集 longtask 时长；只有 >50ms 降档逻辑                                  | **未验证**                       |
| 8   | 3 重效果稳态分配 ≤1KB/帧（E5-8）         | jsdom 构造器计数/窗口有界；无 CDP heap                                     | **部分（合成）**                 |
| 9   | 连续 resize 100 次对象不线性增长（E5-7） | 引用同一批粒子/同一 frame；计数 0/0/0                                      | **达成（合成）**                 |
| 10  | 全仓 rAF ≤8（非测试非白名单，E5-1）      | 14 可执行行全部入白名单（9 允许 + 5 pending）；`npm run verify:raf` exit 0 | **部分（审计可复现，迁移未完）** |
| 11  | canvas 宿主 commit=0（E5-9）             | currentTime ×10 → 顶层 0 commit                                            | **达成（等价口径）**             |
| 12  | 2 个试点同契约、切换无残留（E5-6）       | 调用序列一致、dispose 重置、LRU=2                                          | **达成（合成）**                 |

> 判定规则按计划 §5.3：p95 劣化 >15% 或 dropped>0 阻塞；FPS 中位降 >10% 记软回归。**当前没有真实数字可套用这两条阈值**，所以不能宣布 E5-3 通过。

## 5. M5 出口门 checklist

TRACKING 行 96 的四项：

| M5 项                        | 状态             | 证据 / 缺口                                                                              |
| ---------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| rAF 调用点 ≤8                | **部分**         | 白名单已落地（14 处：9 允许 + 5 pending）；Player3D 4 处、AudioEffectsPanel 1 处待 S5-3b |
| 1080p dpr2 ≥90fps 无 dropped | **未验证**       | 无真实浏览器；无 dropped 计数器；无 measure.py/harness/perf JSON                         |
| 隐藏视图零绘制               | **达成（合成）** | runtime hidden 停表 + 浮动/Shelf 用例；无真实浏览器 5s 计数                              |
| 4x throttle 自动降档         | **部分（合成）** | 33.4ms 帧序列 2 窗口 high→low；无 Chrome CPU 4x trace                                    |

计划 E5-1..E5-9：

| ID   | 出口                                       | 状态                     | 说明                                                                                                                                          |
| ---- | ------------------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| E5-1 | rAF 调用点 ≤8                              | **部分（审计可复现）**   | 14 可执行行全部入 `perf/rAF-whitelist.json`（9 允许 + 5 pending：Player3D ×4、AudioEffectsPanel ×1，TODO S5-3b）；`npm run verify:raf` exit 0 |
| E5-2 | 同一时刻 1 个循环                          | **达成（合成）**         | 5 订阅者共享 rafScheduler；2 消费者组合 + 3 订阅者单测                                                                                        |
| E5-3 | p95 劣化 ≤10%、dropped=0、FPS≥90           | **未验证**               | 仅合成 p95 守卫与历史 jsdom 数字；dropped/FPS 无数据                                                                                          |
| E5-4 | 隐藏视图 0 绘制                            | **达成（合成）**         | hidden: 0 帧/0 clearRect；恢复 1 帧                                                                                                           |
| E5-5 | 档位可判定/切换、4x 降档、无 >200ms 长任务 | **部分/未验证**          | 三档 + FPS/longtask 自适应；无 D5 设备档/?tier；无真实 throttle 与 >200ms 测量                                                                |
| E5-6 | 2 试点同契约、切换无残留                   | **达成（2/14）**         | 17 条插件/registry 用例；flag 默认 off；无端到端 20 轮切换                                                                                    |
| E5-7 | resize 100 次不线性增长、p95 ≤10%          | **达成（合成，p95 缺）** | 对象复用成立；frame p95 对比未测                                                                                                              |
| E5-8 | 3 重效果 ≤1KB/帧                           | **部分（合成）**         | jsdom 构造器/数组方法有界；无 CDP HeapProfiler                                                                                                |
| E5-9 | canvas 宿主 commit=0                       | **达成（等价）**         | 顶层 0 commit；物理拆包未做、无 Profiler trace                                                                                                |

## 6. 缺失证据清单（计划 §5.2 对照）

| 计划要求                                                      | 现状                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `perf/s5-before.json` / `s5-after-s52.json` / `s5-final.json` | **不存在**（`perf/` 只有 S4/bundle/coverage 基线与 `reports/`，无任何 s5 JSON） |
| `scratch/perf/measure.py`（+ `--route`/`--effects`）          | **文件不存在**（全仓 glob `measure.py` = 0）                                    |
| `src/app/dev/viz-harness/page.tsx`                            | **不存在**（`src/app/dev` 目录不存在）                                          |
| `scripts/perf/allocation-probe.mjs`                           | **不存在**（`scripts/perf/` 无此文件）                                          |
| `perf/allocation/*.json`（before/after）                      | **不存在**                                                                      |
| `perf/rAF-whitelist.json`                                     | **已补齐**（S5-2d，2026-10-29；15 条 = 14 调用点 + 1 runtime 绑定）             |
| S5-1 DevTools 单 rAF 截图 + `getStats()` 输出                 | **无**                                                                          |
| S5-2 14 效果 before/after 表 + 截图/接触表                    | **无**（只有 jsdom p95 记录）                                                   |
| S5-2 React Profiler 宿主 commit 对比                          | **无 trace**（只有 jsdom Profiler 计数用例）                                    |
| S5-3 3D+可视化同开 FPS 曲线/截图                              | **无**                                                                          |
| S5-4 legacy vs plugin 帧时间 + 截图 diff                      | **无**（只有 Canvas2D 调用序列一致）                                            |
| S5-5 Chrome Allocation 截图 + p95 对比                        | **无**（构造器计数替代）                                                        |
| S5-6 4x throttle 降档日志/截图 + low 档粒子/DPR/filter 证据   | **无**（DPR/粒子有 jsdom 断言；filter 未接档位）                                |
| S5-7 3 份 allocation JSON（before/after）                     | **无**（jsdom 计数 + TRACKING 历史数字）                                        |
| 显式登记未执行项（4K/真机低端/Electron/长时 soak）            | 计划要求登记；本文 §8 记录                                                      |

> 另：**dropped-frame 计数器本身缺失**——即使补浏览器，`getStats()` 也不能回答「dropped=0」，需要先加采样字段（或改用 CDP 帧统计）。这是 E5-3/M5 的前置缺口。

## 7. 复现命令

在 `D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`（分支 `docs/s5-evidence`）执行：

```bash
# 1) 提交清单与祖先关系
git log --all --oneline --grep='s5-' -i
git show --stat f83d2a0 490249a 9e1f932 384a6a4 0f9fbfe 0d0714a 0110cf4 15f8ef9
git show --numstat f83d2a0 490249a 9e1f932 384a6a4 0f9fbfe 0d0714a 0110cf4 15f8ef9

# 2) 定向测试（6 条命令，本轮全部 exit 0）
npx vitest run src/runtime/visualRuntime.test.ts
npx vitest run src/runtime/effectRegistry.test.ts src/components/visualization/effectPlugins.test.ts src/components/visualization/effects/spatialMeshPlugin.test.ts src/components/visualization/effects/nebulaFieldPlugin.test.ts
npx vitest run src/components/visualization/VisualizationView.selectors.test.tsx
npx vitest run src/components/visualization/particlePool.test.ts src/components/visualization/effects/pilotDrawAllocation.test.ts
npx vitest run src/components/visualization/effects/heavyEffectsAllocation.test.ts
npx vitest run src/components/library/Shelf3DView.runtime.test.tsx src/components/player/floating/FloatingVisualRuntime.test.tsx src/components/player/floating/floatingGating.test.tsx

# 3) 文档与类型门禁
npm run verify:docs
npm run verify:raf
npx tsc --noEmit

# 4) rAF 文本统计（PowerShell；排除测试文件）
rg -n "requestAnimationFrame" src --glob '!*.test.*'
```

计划 §5.1 中的以下命令**在本 worktree 不可执行**（文件不存在，见 §6）：

```text
python scratch/perf/measure.py --base-url http://localhost:3025 --route /dev/viz-harness --label s5-before --out perf/s5-before.json
node scripts/perf/allocation-probe.mjs --route /dev/viz-harness --effects cinematicLyricDrift,orientalLandscape,handwrittenPaper --out perf/allocation/s5-before
```

> 本轮未执行 `npm run build; npm start` 的真实 perf 测量，也未执行 Chrome DevTools Performance/CPU 4x、CDP Allocation/HeapProfiler、React Profiler 录制。未 push，未触碰主工作区。

## 8. 未验证 / 未执行项（显式清单）

1. **真实浏览器 1920×1080 dpr2**：14 效果各自 draw p50/p95/max、dropped、FPS 中位（≥90）——全部未测。
2. **Chrome CDP**：单 rAF 截图、CPU 4x throttle 10s 降档日志、longtask >200ms 采样、HeapProfiler/Allocation 采样、帧时间曲线。
3. **React Profiler 录制**：只有 jsdom Profiler commit 计数；无宿主/控制层 trace 导出。
4. **14 效果截图/接触表与视觉对照**：未做；「绘制体不动」目前只有调用序列/单元断言（2 个试点）。
5. **3D 架 + 可视化同时激活 FPS ≥50**：未测；Shelf3D 画质窗口仍是自身 FPS 逻辑，未接 runtime 档位。
6. **Player3D**：仍是原生 rAF（4 处），S5-3b 未做；已在白名单中记为 `player3d-pending`（TODO），不是豁免。
7. **S5-2c 删除旧路径**：未做；`NEXT_PUBLIC_VISUAL_RUNTIME=off` 的 legacy 循环仍在生产代码中（这是 rAF 文本数偏高的主要原因），未满足「双跑一版后删除」。
8. **S5-6 D5 档位**：无 `detectTier`（deviceMemory/hardwareConcurrency）、无 `?tier=`、无 `NEXT_PUBLIC_QUALITY_TIER`、无 low 档关闭 canvas filter / medium 降 blur。
9. **S5-7 CDP 分配审计**：无 `allocKBPerSec`、无 Top 帧表、无 before/after JSON；结论基于 jsdom 构造器计数。
10. **真实设备/平台**：4K、低端真机、Electron 生产 perf、长时 soak（归 S7/S8）均未执行。
11. **全量测试套件**：本轮未复跑（TRACKING 集成栈记录 310 files / 1930 passed（1 skipped）为**历史**，非本证据实测）。
12. **计划文档状态**：`S5-render-runtime.md` 头部仍写「状态：未开始」，与 TRACKING 的 7/7 done 不一致（文档未同步）。

## 9. 结论与回退

- **可以确认**：S5 的调度收敛在代码与 jsdom 结构测试层面成立——1 条 runtime 循环、5 个消费者、隐藏停表、三档自适应、2 个插件试点、resize/粒子复用均有可复跑用例（71 passed）。
- **不能确认**：M5 的任何真实性能阈值（p95/FPS/dropped/4x throttle/>200ms longtask/分配速率）。计划 §5.2 要求的证据文件几乎全部缺失，measure harness 从未落地。**因此 M5 不能判绿**；TRACKING 的「S5-1..S5-7 done」只能理解为「实现完成」，不是「出口门通过」。
- **回退**：`NEXT_PUBLIC_VISUAL_RUNTIME=off` → 组件回旧 rAF 路径（S5-2/S5-3 双跑分支仍在）；`NEXT_PUBLIC_EFFECT_PLUGINS=off`（当前默认）→ 全部效果走旧 switch；`visualRuntime.setQuality` 仅影响 DPR/effectScale，无持久化 key。
- **建议的关闭顺序**：(1) 补 dropped-frame 采样（E5-3 前置；rAF whitelist 已由 S5-2d 落地）；(2) 落 `dev/viz-harness` + `measure.py --route`，采 before/after JSON 与 14 效果截图；(3) Chrome 4x/longtask/Allocation 三组 CDP 证据；(4) 处理 Player3D 与 S5-2c 后再复算 rAF 计数；(5) 最后再评审 E5-3/E5-5/E5-8。
