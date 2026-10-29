# S4 阶段退出证据（M4 出口门）

> 计划依据：[S4-bundle-loading.md](../S4-bundle-loading.md) §1.2 出口条件、§3 任务总表、§5 阶段级验证命令与证据清单
> 看板：[TRACKING.md](../TRACKING.md) §S4（行 83–92）、汇总行 16、阻塞登记行 153
> 决策：[00-decisions.md](../00-decisions.md) D1（**Pending**，行 22 / 33–42）
> 生成时间：2026-10-29 18:45（Asia/Shanghai）
> worktree：`D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`
> 分支：`docs/s4-evidence`（自 `integration/s2-audio` HEAD `88ef20b` 创建）
> 约束：仅新增本文档；未 push；未改动主工作区 `D:/26project/music_source_code_V1.1_full/music_source_code`。

## 0. 结论（先看这里）

- **任务完成度 6/7**：TRACKING 记 S4-1..S4-6 done；**S4-7 阻塞在 D1**（D1 仍 Pending，本轮未做任何 V8 删除）。计划 10 个 PR 在当前集成历史上压成 **7 个 perf 提交 + 7 个 docs 提交**（`git log --all --grep='s4-'` 实测 14 条），全部是 HEAD 祖先。
- **本轮实测（2026-10-29，HEAD `88ef20b` 的全新生产构建）**：`npm run build` **exit 0**（compile 14.8s / TypeScript 15.2s / 28 静态页）；`rootMain` **3 files / 681.8 KB raw / 208.4 KB gzip**；`/ First Load` **8 scripts / 1,976.2 KB raw / 616.7 KB gzip**；初始 9 文件对 `ID3v2` / `WordArray` / `CryptoJS` / `mediapipe.NormalizedRect` / `THREE.WebGLRenderer` 命中**全 0**。
- **E4-1 / E4-2 / E4-3 / E4-6 达成**：jsmediatags、crypto-js、mediapipe 均只在 async chunk；rootMain 文件数 23→3（≤12）。
- **E4-4 部分**：208.4 KB gzip ≤230 硬线，但 **>190 目标 18.4 KB**（计划 §5.3 的缺口未闭合，Q4-3 未拍板）。
- **E4-5 部分**：1,976.2 KB raw ≤2,000 硬线，但 **>1,700 目标 276.2 KB**；相对 S4 收口时点（1,645.0，`perf/s4-after-s42.json`）回升 331.2 KB，**推断**由 S4 之后合入的 S5/S6/S7 提交带来（未逐提交归因）。
- **E4-7 / E4-8 部分**：CoverImage 覆盖 5 个业务文件（目标 3+队列，达成）；VirtualList 4 个业务接入点，500 项窗口化有 jsdom 用例；**无真实浏览器 long-task / 帧率证据**（计划硬门未满足）。
- **E4-9 未执行**：D1 Pending。V8 UI 树已在更早的 `1e7ffbc`（2026-10-27）移出 `src/` 到 `archive/visualization-v8/`（47 文件 / 12,304 行），`src` 内 `VisualizationViewV8` / `visualizationV8Store` 引用已为 0；但计划 §4.7 的其余删除（`lib/visualization/CinematicDirector.ts` 100 行、`lib/three/ThreeJSScene.ts` 118 行、`presetStore.ts` 183 行、`animationStore.ts` 102 行）**一行未删**，`storageRegistry.ts:395` 仍保留 `"visualization-v8-store"` key。
- **M4 出口门未关闭**（计划 §1.2 要求 E4-1..E4-9 全绿 **且** `bundle-budget` violations 为空）：当前 **4 条未验证/未达成 + 2 条 budget violation**（`maxAsyncChunkKB` 675.9、`publicMB` 58.4，均非 S4 写作用域）。
- **口径**：本轮实际执行并捕获 exit code 的数字标「实测」；来自 `perf/*.json` 或 TRACKING 提交时记录的标「历史」；jsdom/构造断言标「合成」；无证据的标「**未验证**」。本文不写任何未测量的包体数字。

## 1. 环境与统计口径

| 项           | 值                                                                               |
| ------------ | -------------------------------------------------------------------------------- |
| OS / shell   | Windows / PowerShell 7（pwsh）                                                   |
| Node / npm   | v24.16.0 / 11.13.0（本轮实测）                                                   |
| Next / 构建  | Next.js 16.2.4（webpack）、`npm run build`、28 静态页                            |
| 测试框架     | Vitest 4.1.5（jsdom，非 watch）                                                  |
| 分支 / 基点  | `docs/s4-evidence` ← `88ef20b`（`integration/s2-audio` HEAD）                    |
| 构建产物     | `.next` 重构于 2026-10-29 18:31:05（本地时区），`BUILD_ID` 存在                  |
| 变更行数来源 | `git show --shortstat <commit>`（含测试与 perf JSON）                            |
| 包体口径     | `scripts/perf/bundle-budget.mjs`（gzip level 9，逐文件求和，与 S0-6 基线同口径） |

> 分支关系（实测）：`feature/arch-perf-s4-1` @ `536f8ee`、`s4-2` @ `5e07ef4`、`s4-3a` @ `7a5e904`、`s4-3b` @ `0cdd11a`、`s4-4` @ `c425cf3`、`s4-5` @ `06366a3`、`s4-6` @ `8c4b980`；7 个 tip 均 `git merge-base --is-ancestor` exit 0。**无 `feature/arch-perf-s4-7` 分支**。历史提交均未 push。

## 2. S4-1..S4-7 交付与验证

### 2.0 `git log --all --oneline --grep='s4-'`（实测 14 条）

```text
8c4b980 docs(s4-6): record search and batch virtualization
2e7f3e4 perf(s4-6): virtualize search and batch lists
06366a3 docs(s4-5): record QueuePanel virtualization
31f7b9f perf(s4-5): virtualize QueuePanel list
c425cf3 docs(s4-4): record CoverImage unification
6a29535 perf(s4-4): unify cover images behind CoverImage
0cdd11a docs(s4-3): record splitChunks + marker guard done
1f47945 perf(s4-3b): add initial-bundle marker guard
5e07ef4 docs(s4-2): record lazy crypto-js done
c903c86 perf(s4-2): lazy-load crypto-js and add WebCrypto helpers
b13d5bd perf(s4-3a): split async-only vendor chunks out of initial
7a5e904 docs(s4): record jsmediatags E4-1 achieved via splitChunks 3a
536f8ee docs(s4-1): record lazy jsmediatags results
f4eed94 perf(s4-1): defer first-tier heavy dependencies
```

### 2.1 任务表

| ID   | 交付摘要（与 TRACKING 对齐）                                                                                                                                                                                | 代码提交（分支 tip）                                              | 文档提交                               | 变更（`--shortstat`）                                | 定向测试（本轮实测）                                     | exit | 缺口 / 备注                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S4-1 | jsmediatags 函数内 `await import`（3 处静态 import 清零，类型改 `import type`）+ 新增 `featureFlags.ts`（S4-1 时 5 开关，S4-6 增至 6）+ `lazyImports` 静态守卫 + 失败降级文件名解析                         | `f4eed94`（`feature/arch-perf-s4-1` @ `536f8ee`）                 | `536f8ee`（TRACKING + 2 份 perf JSON） | 9 文件 +306/−30（代码）；3 文件 +125/−1（文档+JSON） | 5 文件 / **15 passed**                                   | 0    | 单看本任务 E4-1 未达成（jsmediatags 仍在 vendors 块），由 S4-3a 才真正移出；计划 Step 6 的 `check-initial-chunks.mjs` 被 S4-3b 的 `check-bundle-markers.mjs` 取代 |
| S4-2 | crypto-js 懒加载 + `createSandbox(crypto)` 注入 + 单飞 promise；13 处调用改用注入实例；黄金值等价用例                                                                                                       | `c903c86`（`feature/arch-perf-s4-2` @ `5e07ef4`）                 | `5e07ef4`                              | 4 文件 +164/−34                                      | 1 文件 / **8 passed**                                    | 0    | WebCrypto **未替换**（LX `utils.crypto` 为同步契约）；无 dev/Electron 手测                                                                                        |
| S4-3 | 3a：`splitChunks` 语义块（`chunks:"initial"`、删 `maxSize`、framework/vendor-ui/vendor-core + async three/fabric/ffmpeg/mediapipe/asyncShared）+ `SPLIT_CHUNKS=off` 回退；3b：初始包 marker 守卫脚本 + 测试 | `b13d5bd` + `1f47945`（`s4-3a` @ `7a5e904`；`s4-3b` @ `0cdd11a`） | `7a5e904` + `0cdd11a`                  | 2 文件 +155/−53；5 文件 +317/−0                      | 1 文件 / **6 passed**（有构建时 6/6，无构建时 5+1 skip） | 0    | **字体 `@import`→`<link>` 未做**（`src/app/globals.css:1` 仍是 `@import`，`layout.tsx:25-26` 只有 preconnect）；`maxAsyncChunk` 口径把初始 `vendor-core` 计入     |
| S4-4 | 新增 `CoverImage`（cachedSrc>src>default、lazy/eager、decoding async、data/blob unoptimized、一次性回退、`no-referrer`）；接入 MusicCardStack 3 处 / SearchPanel 1 处 / VisualizationView 1 处              | `6a29535`（`feature/arch-perf-s4-4` @ `c425cf3`）                 | `c425cf3`                              | 8 文件 +317/−18                                      | 4 文件 / **32 passed**（CoverImage 6 + 其余既有）        | 0    | `NEXT_PUBLIC_COVER_IMAGE_V2=off` 分支无单测；无 dev 截图 A/B；`referrerPolicy` 为有意请求头变化；QueuePanel 留 S4-5                                               |
| S4-5 | `VirtualList` 增强（`scrollToIndex`/`scrollToTop`/`initialIndex`/`getItemKey`/ResizeObserver/`data-virtual-*`）+ QueuePanel 行 `memo` 化，`QUEUE_ROW_HEIGHT=72`，当前曲 reveal 改 `scrollToIndex`           | `31f7b9f`（`feature/arch-perf-s4-5` @ `06366a3`）                 | `06366a3`                              | 4 文件 +593/−173                                     | 2 文件 / **16 passed**                                   | 0    | 无真实浏览器 long-task trace；行高固定 72px；`smooth` 路径 jsdom 未验；`scrollToIndex` 忽略 padding                                                               |
| S4-6 | SearchPanel 结果 `SearchResultRow` + VirtualList；BatchMetadataEditor / CrossfadeMixer 列表虚拟化（`virtualListSearch` / `virtualListBatch`）                                                               | `2e7f3e4`（`feature/arch-perf-s4-6` @ `8c4b980`）                 | `8c4b980`                              | 8 文件 +696/−161                                     | 3 文件 / **17 passed**（SearchPanel 与 S4-4 重复点名）   | 0    | 无真实浏览器 long-task / 首帧 <50ms trace；Crossfade 混音队列与 Batch 预览列表仍全量；行高固定                                                                    |
| S4-7 | V8 处置执行（D1）                                                                                                                                                                                           | **无提交**                                                        | **无**                                 | 0                                                    | 未执行                                                   | —    | **blocked on D1**（见 §2.3）：GUI 树已由 `1e7ffbc` 归档，计划 §4.7 的删除/契约移植一行未做                                                                        |

- 行数为 `git show --shortstat` 汇总（含测试与 perf JSON）；「N passed」为该命令 vitest 输出，不是提交内测试文件数。
- 代码提交合计 **7 个 / +2,548 −469**；文档提交合计 **7 个 / +144 −20**。计划 10 个子 PR 在集成历史里按任务压平（S4-3 保留 3a/3b + 两条 docs，S4-1 保留 1a/1b 合一的单提交）。

### 2.2 定向测试明细（2026-10-29，本 worktree 实测，6 条命令全部 exit 0）

| 任务     | 命令（`npx vitest run` 后跟文件）                                                                                                                                                               | 结果                                  | exit |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---- |
| S4-1     | `src/lib/perf/featureFlags.test.ts` + `lazyImports.test.ts` + `src/services/audioMetadata.test.ts` + `src/utils/localMusicImport.test.ts` + `src/components/library/LocalMusicManager.test.tsx` | 5 文件 / 15 passed                    | 0    |
| S4-2     | `src/lib/sources/lxRunner.test.ts`                                                                                                                                                              | 1 文件 / 8 passed                     | 0    |
| S4-3     | `scripts/perf/check-bundle-markers.test.mjs`                                                                                                                                                    | 1 文件 / 6 passed（构建后复跑）       | 0    |
| S4-4     | `src/components/shared/ui/CoverImage.test.tsx` + `MusicCardStack.test.tsx` + `SearchPanel.test.tsx` + `VisualizationView.selectors.test.tsx`                                                    | 4 文件 / 32 passed                    | 0    |
| S4-5     | `src/components/shared/Glass/VirtualList.test.tsx` + `src/components/player/QueuePanel.test.tsx`                                                                                                | 2 文件 / 16 passed                    | 0    |
| S4-6     | `SearchPanel.test.tsx` + `src/components/audio/CrossfadeMixer.test.tsx` + `src/components/library/BatchMetadataEditor.test.tsx`                                                                 | 3 文件 / 17 passed                    | 0    |
| **合计** | 16 次文件点名 / **15 个不同文件**（SearchPanel 重复）                                                                                                                                           | **94 passed，0 failed**（去重 86 条） | 0    |

> 首次运行 `check-bundle-markers.test.mjs` 时无生产构建，第 6 条用例 `skipIf(!HAS_BUILD)` 被跳过（5 passed / 1 skipped）；构建后复跑为 6/6。全部为 jsdom/结构测试，不含真实浏览器。

### 2.3 S4-7 状态：blocked on D1（partial，无任何处置）

| 判据（计划 §4.7 / E4-9）                             | 计划值                           | 本轮实测                                                                                                                                          | 状态                         |
| ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| D1 决策                                              | `00-decisions.md` D1 已 Accepted | 行 22 `D1 \| ... \| **Pending**`；TRACKING 行 153 仍登记「D1 V8 处置未拍板」                                                                      | **阻塞**                     |
| `src/components/visualization-v8/**`                 | 45 文件（38 非测试）待删         | `git ls-files` = **0**；`src` 下目录不存在；内容在 `archive/visualization-v8/` 47 文件 / 12,304 行（由 `1e7ffbc`，2026-10-27 归档，非 S4-7 所为） | 已不在 `src`（历史既有处置） |
| `visualization-v8` 引用（src）                       | 执行后 = 0                       | **1 处**：`src/lib/storage/storageRegistry.ts:395` 的 persist key 字符串                                                                          | 部分（key 按计划本阶段不删） |
| `VisualizationViewV8` 引用                           | 执行后 = 0                       | 0                                                                                                                                                 | 达成                         |
| `visualizationV8Store` 引用                          | 执行后 = 0                       | 0（store 文件已不存在）                                                                                                                           | 达成                         |
| 5 处跨系统消费者（计划 §4.7）                        | 重定向到 V7 或删除               | `AppleUnifiedNavIsland.tsx:103` 已是 `useVisualizationStore`；`aiAgentTools.ts` 无 V8 写入                                                        | 已消失（历史重构）           |
| `lib/visualization/CinematicDirector.ts`             | 删除                             | **仍存在，100 行，0 importer**                                                                                                                    | **未删（D1）**               |
| `lib/three/ThreeJSScene.ts`                          | 删除                             | **仍存在，118 行，0 importer**                                                                                                                    | **未删（D1）**               |
| `presetStore.ts` / `animationStore.ts`               | 删除                             | **仍存在，183 + 102 行，0 importer**                                                                                                              | **未删（D1）**               |
| `performanceV8Store.ts`                              | 保留（V7 在用）                  | 89 行，7 个消费者（VisualSettings / NowPlayingHalo / PlayerSkinsPanel / quality / bootstrapStores / storageRegistry / storeBindings）             | 保留（符合计划）             |
| 契约先行（`src/runtime/effectPlugin.ts`，C 方案 7a） | 新增 ~350 行                     | `src/runtime/` 下无 `effectPlugin.ts`（S5-4 落的是 `effectRegistry.ts`/插件形态，未做计划 C 的复制）                                              | **未做**                     |
| 包体影响                                             | 差异 ≤1%（V8 未打包）            | 本轮 `chunk-*` 中无 V8 痕迹；归档后 `rootMain` 无变化                                                                                             | 无法对比（删除未发生）       |

> 结论：S4-7 记为 **partial / blocked on D1**，本轮**未删除任何文件、未移植契约**；E4-9 不判绿。若 D1=C/A 拍板，剩余可删面为 4 文件 / 503 行（上表 4 个「未删」项），删除后需复跑 `rg`=0、tsc、vitest（V8 测试已随归档移出）。

## 3. 包体证据（measured / historical / 未验证）

### 3.1 基线与阈值

- `perf/bundle-baseline.json`（`updatedAt` 2026-10-28T19:33:05Z，`source` = `perf/bundle-report.json`，**该 report 文件当前不存在**）：`rootMain` **3 files / 689.3 KB raw / 211 KB gzip**；`firstLoad` 8 scripts / 1,959.8 KB raw / 607.2 KB gzip；CSS 225.4/29；`dataManagerFirstLoad` 7 scripts / 1,628 KB；`asyncChunks` 122 files / max 683.5 KB；`publicMB` 58.4。
- `perf/budget.json` 阈值：rootMain gzip target **190** / hardMax **230**；rootMain files target 12 / hardMax 16；first-load raw target **1,700** / hardMax **2,000**；first-load gzip target 500 / hardMax 650；CSS raw target 210 / hardMax 230；maxAsyncChunk target 350 / hardMax 400；publicMB target 40 / hardMax 45。

### 3.2 历史序列（`perf/*.json`，提交时点记录，非本轮）

| 快照                                 | generatedAt（UTC）     | rootMain files | rawKB     | gzipKB    | / scripts | / rawKB     | async maxKB |
| ------------------------------------ | ---------------------- | -------------- | --------- | --------- | --------- | ----------- | ----------- |
| `s4-before.json`                     | 2026-10-27T23:27:01Z   | 23             | 969.3     | 293.0     | 39        | 1,952.0     | 333.5       |
| `s4-after-s41.json`                  | 2026-10-27T23:43:04Z   | 23             | 969.3     | 293.0     | 39        | 1,951.8     | 333.5       |
| `s4-after-s43a.json`                 | 2026-10-28T00:01:01Z   | 3              | 752.1     | 238.7     | 8         | 1,707.4     | 746.4       |
| `s4-after-s42.json`                  | 2026-10-28T00:13:30Z   | 3              | 689.2     | **211.0** | 8         | 1,645.0     | 683.5       |
| `s4-after-s43b.json`                 | 2026-10-28T00:23:11Z   | 3              | 689.2     | 211.0     | 8         | 1,645.0     | 683.5       |
| `bundle-baseline.json`（S8-3a 重建） | 2026-10-28T19:33:05Z   | 3              | 689.3     | 211.0     | 8         | 1,959.8     | 683.5       |
| **本轮实测（全新构建）**             | 2026-10-29 build 18:31 | **3**          | **681.8** | **208.4** | **8**     | **1,976.2** | **675.9**   |

- S4-1 后指标**未变**（969.3/293）：符合 TRACKING 的根因分析——jsmediatags 被 `chunks:"all"` 的 vendor 组固定在初始块，只有 S4-3a 改语义块后才移出。
- `s4-after-s42` 已包含 3a（生成于 00:13，晚于 3a 的 00:01），因此 21.0→211.0 是 S4-3a+S4-2 的合并效果，不是单任务增益。
- 基线（19:33Z）的 first-load 1,959.8 与 S4 收口（1,645.0）不同：基线在 S4 之后由 S5/S6 集成构建重建，口径同工具、内容不同。
- `perf/s4-guard-s43b.json`（历史）：`ok=true`，9 个初始文件，`violations=[]`，`missing=[]`。

### 3.3 本轮实测（2026-10-29，HEAD `88ef20b`，构建后立即测量）

`npm run build` → `BUILD_EXIT=0`（`✓ Compiled successfully in 14.8s`；`Finished TypeScript in 15.2s`；`Generating static pages (28/28)`；prebuild 复制 6 个 mediapipe wasm 并下载 `hand_landmarker.task` 7,819,105 B）。

`node scripts/perf/bundle-budget.mjs --json <tmp>/s4-current.json` → **exit 0**：

```text
== Bundle budget ==
rootMain      3 files  681.8 KB raw / 208.4 KB gzip  (hard 800/230)
first load /  8 scripts  1976.2 KB raw / 616.7 KB gzip
css           226.1 KB raw / 29.2 KB gzip
async max     static\chunks\vendor-core-c65e0d94154c621c.js  675.9 KB  (121 chunks)
public        58.4 MB
violations    2
  FAIL maxAsyncChunkKB=675.9 > hardMax 400 (target 350)
  FAIL publicMB=58.4 > hardMax 45 (target 40)
```

`node scripts/perf/bundle-diff.mjs --report <tmp>/s4-current.json` → **exit 0（PASS）**：

| Metric          |   Baseline |    Current |    Delta | Threshold | Result |
| --------------- | ---------: | ---------: | -------: | --------: | ------ |
| rootMain gzip   |     211 KB |   208.4 KB |  −2.6 KB |     +5 KB | PASS   |
| rootMain raw    |   689.3 KB |   681.8 KB |  −7.5 KB |         — | info   |
| first-load gzip |   607.2 KB |   616.7 KB |  +9.5 KB |    +10 KB | PASS   |
| first-load raw  | 1,959.8 KB | 1,976.2 KB | +16.4 KB |         — | info   |
| css gzip        |      29 KB |    29.2 KB |  +0.2 KB |         — | info   |
| rootMain files  |          3 |          3 |       +0 |         — | info   |

- 「Current」是本轮 **实测**；「Baseline」是 S8-3a 重建的 `perf/bundle-baseline.json`（历史）。
- rootMain gzip 比历史最优（211.0）再降 2.6 KB，仍在 190 目标外 18.4 KB；first-load gzip 逼近 +10 KB 阈值（余量 0.5 KB），后续任何首屏新增都会触发 diff 失败。
- 两条 violation 属**既有、非 S4 写作用域**：`maxAsyncChunkKB` 取 `.next/static/chunks` 下最大文件（当前是**初始** `vendor-core`，`scripts/perf/bundle-budget.mjs:107-112` 未区分 initial/async，TRACKING S4-3b 已记该口径伪影）；`publicMB` 由 `public/` 静态资源决定（mediapipe 模型/wasm 等），S4 未触碰。
- 语义块实测：`vendors-*` 碎片 **0**（计划 ≤6）；`chunk-three` 538,607 B、`chunk-fabric` 281,590 B、`chunk-ffmpeg` 6,451 B、`chunk-mediapipe` 135,481 B、`vendor-ui` 61,486 B、`vendor-core` 692,084 B、`framework` 191,268 B。

### 3.4 初始包 marker（E4-1 / E4-2 / E4-6，本轮实测）

`node scripts/perf/check-bundle-markers.mjs --json <tmp>/markers.json` → **exit 0**：

```text
[bundle-markers] .next: 9 files from rootMainFiles + / + /data-manager
  ok   E4-1 jsmediatags [ID3v2] hits=0
  ok   E4-6 mediapipe [mediapipe.NormalizedRect] hits=0
[bundle-markers] PASS - no initial-bundle markers
```

E4-2 不在守卫脚本的 `MARKERS` 表内（`scripts/perf/check-bundle-markers.mjs:17-20` 只有 jsmediatags/mediapipe），本轮用同一 9 文件集合额外扫描：

| 初始文件（9）                                             |    字节 | sources                  | `WordArray` | `CryptoJS` | `ID3v2` | `mediapipe.NormalizedRect` | `THREE.WebGLRenderer` |
| --------------------------------------------------------- | ------: | ------------------------ | ----------: | ---------: | ------: | -------------------------: | --------------------: |
| `static/chunks/webpack-868c0a867a4a3d15.js`               |   5,565 | rootMain,/,/data-manager |           0 |          0 |       0 |                          0 |                     0 |
| `static/chunks/vendor-core-c65e0d94154c621c.js`           | 692,084 | rootMain,/,/data-manager |           0 |          0 |       0 |                          0 |                     0 |
| `static/chunks/main-app-8e633c34535bae1e.js`              |     529 | rootMain,/,/data-manager |           0 |          0 |       0 |                          0 |                     0 |
| `static/chunks/vendor-ui-394f99f448815250.js`             |  61,486 | /,/data-manager          |           0 |          0 |       0 |                          0 |                     0 |
| `static/chunks/app/layout-55b8f6fa90c1f2e5.js`            | 527,881 | /,/data-manager          |           0 |          0 |       0 |                          0 |                     0 |
| `static/chunks/framework-6685fe91b6064b42.js`             | 191,268 | /                        |           0 |          0 |       0 |                          0 |                     0 |
| `static/chunks/app/page-8e062ed8a30e96c2.js`              | 432,176 | /                        |           0 |          0 |       0 |                          0 |                     0 |
| `static/chunks/polyfills-42372ed130431b0a.js`             | 112,594 | /,/data-manager          |           0 |          0 |       0 |                          0 |                     0 |
| `static/chunks/app/data-manager/page-e0487234f6a0480f.js` | 290,461 | /data-manager            |           0 |          0 |       0 |                          0 |                     0 |

### 3.5 动态 import 边界（重库 → async chunk 实测映射）

| 库                        | 版本     | 初始集合命中 | 实测所在 chunk（本轮构建）                          |      大小 | 进入初始集合的路径                                                            |
| ------------------------- | -------- | ------------ | --------------------------------------------------- | --------: | ----------------------------------------------------------------------------- |
| `jsmediatags`             | ^3.9.7   | **0**        | `3213.dc151000c7ef147c.js`                          |  71,619 B | 无（3 处均 `await import`）                                                   |
| `crypto-js`               | ^4.2.0   | **0**        | `7351.ad954d9561ad28bd.js`                          |  64,446 B | 无（`lxRunner.ensureCrypto()` 单飞）                                          |
| `@mediapipe/tasks-vision` | ^0.10.34 | **0**        | `chunk-mediapipe.1159ad5948e083e2.js`               | 135,481 B | 无（`src/lib/gesture/tracker.ts:188` 动态 import）                            |
| `three`                   | ^0.183.2 | 0（标记）    | `chunk-three.2c5d6507325c4161.js`                   | 538,607 B | 无（`Shelf3DView` 静态 import，但组件本身 `next/dynamic` + `chunks:"async"`） |
| `fabric`                  | ^7.4.0   | 0（标记）    | `chunk-fabric.dbf14dfa4790094a.js`                  | 281,590 B | 无（`FabricCanvas` 经 `next/dynamic`）                                        |
| `@ffmpeg/*`               | ^0.12.15 | 0（标记）    | `chunk-ffmpeg.38b43ff0b2d7dca9.js` + 3 个 worker 块 |   6,451 B | 无（`audioProcessingStore.ts:211-212` 动态 import + worker）                  |

> 裁决规则：jsmediatags 用 `ID3v2`、mediapipe 用 `mediapipe.NormalizedRect`，避免 `console.warn` 文案与 CDN URL 误报（`check-bundle-markers.mjs:3-8`）。three/fabric/ffmpeg 的「0」是本轮对 9 个初始文件的额外扫描结果，不是守卫脚本的既有门禁。

### 3.6 E4-1..E4-6 判定（before → after）

| ID   | 指标                      | before（历史）    | after（本轮实测） | 目标   | 硬阈值 | 判定                                               |
| ---- | ------------------------- | ----------------- | ----------------- | ------ | ------ | -------------------------------------------------- |
| E4-1 | 初始集合 jsmediatags 标记 | 1（`c5c6856a`）   | **0**             | 0      | >0     | **达成**                                           |
| E4-2 | 初始集合 crypto-js 标记   | 1（`aacc2dbb`）   | **0**             | 0      | >0     | **达成（自测口径，非守卫门禁）**                   |
| E4-3 | rootMainFiles 数量        | 23                | **3**             | ≤12    | >16    | **达成**                                           |
| E4-4 | rootMainFiles gzip        | 296.8 / 293.0     | **208.4**         | ≤190   | >230   | **部分：硬线通过，目标缺口 18.4 KB**               |
| E4-5 | / First Load raw          | 1,996.7 / 1,952.0 | **1,976.2**       | ≤1,700 | >2,000 | **部分：硬线通过（余量 23.8），目标缺口 276.2 KB** |
| E4-6 | 初始集合 mediapipe 标记   | 1（`c5c6856a`）   | **0**             | 0      | >0     | **达成**                                           |

## 4. 模块与副作用证据

### 4.1 懒加载边界（源码位置，本轮核对）

| 位置                                                                                     | 现状                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/audioMetadata.ts:217-222`                                                  | `let jsmediatags` + `await import("jsmediatags")`；失败 `console.warn(...降级文件名解析...)`                                        |
| `src/utils/localMusicImport.ts:37-42`                                                    | 同上（函数内动态 import，`extractMetadata` 已 async）                                                                               |
| `src/components/library/LocalMusicManager.tsx:120-125`                                   | 同上（组件内 import，失败走 `defaultResult`）                                                                                       |
| `src/services/audioMetadata.ts:4` / `localMusicImport.ts:6` / `LocalMusicManager.tsx:24` | 全部为 `import type`（零运行时 import）                                                                                             |
| `src/lib/sources/lxRunner.ts:5,14-17`                                                    | `type CryptoJSApi = typeof import("crypto-js")["default"]`；`cryptoPromise ??= import("crypto-js")`（并发单飞）                     |
| `src/lib/gesture/tracker.ts:188`                                                         | `vision = await import("@mediapipe/tasks-vision")`（全仓唯一 mediapipe 运行时入口）                                                 |
| `src/store/audioProcessingStore.ts:211-212`                                              | `await import("@ffmpeg/ffmpeg")` / `await import("@ffmpeg/util")`                                                                   |
| `next.config.js:31-128`                                                                  | `chunks:"initial"` + framework/vendor-ui/vendor-core；three/fabric/ffmpeg/mediapipe `chunks:"async"`；`SPLIT_CHUNKS=off` 回退旧配置 |

### 4.2 dev-only 动态 import（生产不加载，无副作用）

| 位置                         | 代码                                                                            | 门控                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/bootstrap.ts:32-38` | `void import("@/lib/cache/cacheStats").then(({installCacheStatsProbe}) => ...)` | `process.env.NODE_ENV === "development"`（生产被 DCE，不加载 chunk） |
| `src/lib/bootstrap.ts:44-47` | `void import("@/lib/perf/audioMetrics").catch(() => {})`                        | `process.env.NODE_ENV !== "production"`（dev-only 音频探针）         |

> 两者均 `.catch` 吞错，探针失败不影响启动（对应不变量 I4「动态 import 失败必须有降级路径」）。

### 4.3 静态 import 守卫与 marker 测试

- `src/lib/perf/lazyImports.test.ts:7-28`：对 `jsmediatags`、`crypto-js` 表驱动扫描 `src/**/*.{ts,tsx}`（排除测试），匹配 `import x from "pkg"` 与裸 `import "pkg"`，放行 `import type` 与 `await import()`；**本轮 2 passed**。
- `scripts/perf/check-bundle-markers.mjs`：初始集合 = `build-manifest.rootMainFiles` ∪ `/` ∪ `/data-manager` 的 `<script src>`（去重、忽略外链/data:）；hits>0 → exit 1，缺 build-manifest → exit 2，`--skip-if-missing` → exit 0；`--json` 输出 `initialFiles/violations/missing`。
- `scripts/perf/check-bundle-markers.test.mjs`：6 条用例（warn 文案/CDN 误报放行、违规定位到文件、`--forbid` 单项、`--skip-if-missing`、未知 forbid+缺构建 exit 2、**真实 `.next` 通过**）；本轮构建后 **6/6 passed**。
- 本轮实测：`node scripts/perf/check-bundle-markers.mjs`（即 `npm run perf:check-bundle`）exit 0，9 文件、`ID3v2=0`、`mediapipe.NormalizedRect=0`、`missing=[]`。

### 4.4 重库排除的边界证据

- 初始 9 文件对 `ID3v2` / `WordArray` / `CryptoJS` / `mediapipe.NormalizedRect` / `THREE.WebGLRenderer` 命中 **0/0/0/0/0**（§3.4 表，实测）。
- 六个重库分别落在 6 个具名 async chunk（§3.5），无 `vendors-*` 碎片（实测 0）。
- `jsmediatags` 只出现在 `3213.*.js`、`crypto-js` 只出现在 `7351.*.js`——与计划「E4-1/E4-2 的 marker 必须为 0」同义，且块名已不再是 S4-1 时期的 `vendors-*`。

## 5. M4 出口门 checklist

### 5.1 计划 §1.2 出口条件

| ID   | 出口                                              | 计划目标           | 本轮状态（2026-10-29 实测）                                                                                                                        | 判定                   |
| ---- | ------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| E4-1 | 初始集合 jsmediatags 标记                         | 0                  | 0（守卫 exit 0）                                                                                                                                   | **达成**               |
| E4-2 | 初始集合 crypto-js 标记                           | 0                  | 0（额外扫描 WordArray/CryptoJS）                                                                                                                   | **达成（自测）**       |
| E4-3 | rootMainFiles 数量                                | ≤12（硬 >16）      | 3                                                                                                                                                  | **达成**               |
| E4-4 | rootMainFiles gzip                                | ≤190（硬 230）     | 208.4（硬线通过；目标缺口 18.4）                                                                                                                   | **部分**               |
| E4-5 | / First Load raw                                  | ≤1,700（硬 2,000） | 1,976.2（硬线通过；目标缺口 276.2）                                                                                                                | **部分**               |
| E4-6 | 初始集合 mediapipe 标记                           | 0                  | 0                                                                                                                                                  | **达成**               |
| E4-7 | 3 高频文件走 CoverImage、无新增裸 img             | 3 文件             | CoverImage 5 业务文件（MusicCardStack/SearchPanel/QueuePanel/VisualizationView/BatchMetadataEditor）；`src/components` 非测试 `<img` 32 处/16 文件 | **达成（本阶段口径）** |
| E4-8 | 2 列表 VirtualList；500 项 longtask=0；滚动 60fps | 硬门               | VirtualList 4 业务接入（Queue/Search/Batch/Crossfade）；jsdom 500 项窗口化用例通过；**无真实浏览器 long-task/帧率**                                | **部分/未验证**        |
| E4-9 | V8 处置执行；`visualization-v8` 引用=0            | 引用 0             | D1 Pending；4 文件/503 行未删；`visualization-v8` 字符串 1 处（persist key）                                                                       | **阻塞**               |

### 5.2 `bundle-budget` violations

计划 §1.2 要求 M4 时 `node scripts/perf/bundle-budget.mjs` 输出 `violations: []`。本轮实测 **2 条**：

| metric            | value | hardMax | 是否 S4 写作用域 | 说明                                                                                       |
| ----------------- | ----: | ------: | ---------------- | ------------------------------------------------------------------------------------------ |
| `maxAsyncChunkKB` | 675.9 |     400 | 否（口径伪影）   | 工具取 `.next/static/chunks` 最大文件，当前为**初始** `vendor-core`；TRACKING S4-3b 已登记 |
| `publicMB`        |  58.4 |      45 | 否               | `public/` 静态资源（mediapipe 模型/wasm 等），S4 未触碰                                    |

> 这两条在 S4 之前就存在（`perf/s4-before.json` 亦为 58.4 / 333.5→683.5 区间），不构成本阶段回归；但按计划字面 M4 不能判绿。

### 5.3 判定

**M4 未关闭。** 阻塞项按优先级：

1. **E4-4 目标缺口 18.4 KB**：需按计划 §5.3 给「每条缺失量 + 原因 + 候选杠杆」，并由 Lead/用户决定是否把 E4-4 调整为 ≤200 KB（总计划 §6.2 硬阈值 230 不变）。Q4-3 未拍板。
2. **E4-5 目标缺口 276.2 KB**：S4 收口时点 1,645.0 已接近目标；当前 1,976.2 是 S4 之后集成栈增长（**推断**，未逐提交归因）。需决定 E4-5 是否按「S4 收口时点」判定，或补首屏回归门禁（S8-3 nightly 已接 `bundle-diff`，+10 KB 阈值下余量仅 0.5 KB）。
3. **E4-8 无真实浏览器证据**：500 项 longtask、滚动 60fps、首帧 <50ms 均未测（本轮只有 jsdom 窗口化断言）。
4. **E4-9 / S4-7 blocked on D1**：无决策即无处置。
5. **budget violations 2 条**（非 S4 作用域，需口径修订或预算重定基线）。
6. **S4-3b 字体 `@import`→`<link>` 未做**（计划 Step 2 未落地；非 E4 验收项，但属计划内交付）。

## 6. 未验证 / 缺失证据（显式清单）

| 项                                                      | 现状                                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **D1 决策**                                             | `00-decisions.md` 仍 Pending；S4-7 无法执行                                                                            |
| **真实浏览器 long-task / 帧率（E4-8）**                 | 无 CDP Performance trace；Queue/Search/Batch/Crossfade 只有 jsdom 窗口化断言；无 60fps 曲线                            |
| **首帧 <50ms（S4-6 验收）**                             | 未测（无 `performance.now` 打点证据）                                                                                  |
| **dev 截图（S4-4 封面、S4-5 队列、S4-6 列表）**         | 全部缺失；无 normal/慢网/离线三态对照                                                                                  |
| **V7 14 效果截图（S4-7 验收）**                         | 缺失（且删除未发生）                                                                                                   |
| **`document.fonts.check` / 字体实际加载（S4-3b 验收）** | 未测；且 `@import` 迁移本身未做                                                                                        |
| **Electron `app://` 下的动态 chunk 相对路径**           | 未测（计划 S4-1 回滚条款的风险项）                                                                                     |
| **LX 源 dev smoke（S4-2 手测）**                        | 未做；只有 8 条单测                                                                                                    |
| **低端真机 LCP / 4K / Electron 打包后包体**             | 未测（计划 §5.2 明确归 S7/S8）                                                                                         |
| **`perf/s4-final.json` / `s4-final.rerun.json`**        | 不存在；本轮实测写入临时目录（`%TEMP%\s4-evidence\s4-current.json`），**未提交**                                       |
| **`perf/s4-after-s43b.json` 之后的正式终局快照**        | 不存在；最新提交态快照仍是 S4-3b（2026-10-28）                                                                         |
| **`perf/bundle-report.json`**                           | 不存在（基线 `source` 指向它）；`bundle-diff` 需显式 `--report`，否则 exit 2                                           |
| **全量测试套件**                                        | 本轮未复跑（TRACKING 集成栈 310 files / 1,930 passed 为**历史**）；只跑 S4 定向 15 文件                                |
| **计划文档状态**                                        | `S4-bundle-loading.md` 头部仍写「状态：**未开始**」，与 TRACKING 6/7 done 不一致                                       |
| **TRACKING 事实漂移**                                   | 行 16 写「rootMain gzip ≤190KB（缺口见 Q10）」；Q10 在 `00-decisions.md` 中是「16 个阻塞决策」而非包体缺口项，指代需修 |

## 7. 复现命令

在 `D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`（分支 `docs/s4-evidence`）执行：

```bash
# 1) 提交清单与祖先关系
git log --all --oneline --grep='s4-'
git show --shortstat f4eed94 b13d5bd c903c86 1f47945 6a29535 31f7b9f 2e7f3e4
git merge-base --is-ancestor 536f8ee HEAD   # 其余 6 个 tip 同理

# 2) 生产构建（I7：不得与 tsc 并行；构建前确认无 dev server）
npm run build

# 3) 包体（实测；本轮 exit 0）
node scripts/perf/bundle-budget.mjs --json "$TEMP/s4-evidence/s4-current.json"
node scripts/perf/bundle-diff.mjs --report "$TEMP/s4-evidence/s4-current.json" --json "$TEMP/s4-evidence/diff.json" --md "$TEMP/s4-evidence/diff.md"

# 4) 初始包 marker（E4-1 / E4-6；本轮 exit 0）
node scripts/perf/check-bundle-markers.mjs --json "$TEMP/s4-evidence/markers.json"
npx vitest run scripts/perf/check-bundle-markers.test.mjs

# 5) E4-2 额外扫描（守卫未覆盖 crypto-js）
node -e "const fs=require('fs'),m=require('./.next/build-manifest.json');const f=[...new Set(m.rootMainFiles)];for(const x of f){const t=fs.readFileSync('.next/'+x,'utf8');console.log(x,(t.match(/WordArray/g)||[]).length,(t.match(/CryptoJS/g)||[]).length)}"

# 6) 定向测试（6 条命令，本轮全部 exit 0）
npx vitest run src/lib/perf/featureFlags.test.ts src/lib/perf/lazyImports.test.ts src/services/audioMetadata.test.ts src/utils/localMusicImport.test.ts src/components/library/LocalMusicManager.test.tsx
npx vitest run src/lib/sources/lxRunner.test.ts
npx vitest run src/components/shared/ui/CoverImage.test.tsx src/components/player/MusicCardStack.test.tsx src/components/player/SearchPanel.test.tsx src/components/visualization/VisualizationView.selectors.test.tsx
npx vitest run src/components/shared/Glass/VirtualList.test.tsx src/components/player/QueuePanel.test.tsx
npx vitest run src/components/player/SearchPanel.test.tsx src/components/audio/CrossfadeMixer.test.tsx src/components/library/BatchMetadataEditor.test.tsx

# 7) 文档与类型门禁（本轮 exit 0）
npm run verify:docs
npx tsc --noEmit

# 8) V8 现状（S4-7 证据）
git ls-files 'src/components/visualization-v8'          # 0
Get-ChildItem archive/visualization-v8 -Recurse -File | Measure-Object   # 47
rg -n 'visualization-v8|VisualizationViewV8' src        # 1（storageRegistry key）
rg -n 'CinematicDirector|ThreeJSScene' src --glob '!*.test.*'  # 各 1（仅定义）
```

> 本轮未执行 `npm start` + Chrome DevTools / CDP 测量，未做 dev smoke 截图，未跑全量 vitest。未 push，未触碰主工作区。

## 8. 结论与回退

- **可以确认（实测）**：S4-1..S4-6 的代码与测试在 HEAD 上成立；全新生产构建 exit 0；初始 9 文件对 jsmediatags / crypto-js / mediapipe / three 标记全 0；rootMain 3 files / 208.4 KB gzip / 8 scripts；`vendors-*` 碎片 0；`bundle-diff` PASS（rootMain −2.6 KB）。
- **不能确认**：M4 的任何真实浏览器性能项（500 项 longtask、60fps、首帧 <50ms、字体实际加载）；E4-4 目标 190 KB 与 E4-5 目标 1,700 KB 均未达到；`bundle-budget` violations 非空。**因此 M4 不能判绿**；TRACKING 的「S4-1..S4-6 done」只能理解为「实现完成」。
- **回退**：构建期 `SPLIT_CHUNKS=off npm run build` 恢复旧 splitChunks（TRACKING 记 23 files / 969.3 / 293 可复现）；客户端 `NEXT_PUBLIC_VL_QUEUE` / `VL_SEARCH` / `VL_BATCH` / `COVER_IMAGE_V2` = off 回退 S4-4/5/6 行为；S4-1/S4-2 为纯懒加载重构，revert 单提交即恢复静态 import。
- **建议的关闭顺序**：(1) 拍板 D1（解除 S4-7）；(2) 按 §5.3 处理 E4-4 缺口并给 Lead 书面结论（190 或 200/230 基线）；(3) 补真实浏览器 500 项 longtask + 首帧打点（E4-8 / S4-6）与字体 `@import`→`<link>`（S4-3b）；(4) 修 `maxAsyncChunk` 口径（区分 initial/async）或重定 publicMB，使 `violations` 可解释为空；(5) 补 S4-4/5/6 dev 截图与 `perf/s4-final.json` 后重评审 M4。
