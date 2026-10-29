# perf/ — 性能与架构基线工具（S0-6）

> 上级计划: docs/nbl/plans/2026-10-21-arch-perf-execution/S0-baseline.md
> 创建: 2026-10-21（S0-6 测量基座 v1）
> 约束: 基线文件由工具生成；更新基线必须附原因与 before/after，并在 PR 描述说明。

## 1. 文件

| 文件 | 说明 |
|---|---|
| scripts/perf/bundle-budget.mjs | 包体预算：rootMainFiles / 首页 script / CSS / async chunk / public 体积；支持 --check 与 --json |
| scripts/perf/bundle-diff.mjs | S8-3a 包体回归 diff：基线与当前报告逐指标对比，输出 markdown/JSON；rootMain gzip 与首页 gzip 的 delta 超阈值 exit 1；仅 --update 显式重设基线 |
| scripts/perf/append-history.mjs | S8-3b 性能历史：把 bundle report（+ 可选 audio metrics）追加为 perf/perf-history.jsonl 一行；--init 建空文件、--check 校验 schema 与 ts 严格递增 |
| scripts/perf/perf-dashboard.mjs | S8-3b 看板：最近 14 行表格 + 趋势箭头 + 回归高亮 + 最新 runtime metrics；stdout 或 --out |
| scripts/perf/perf-history-lib.mjs | S8-3b 历史行 schema/解析共享模块（上面两个 CLI 共用） |
| scripts/perf/report-store-stats.mjs | Store 架构统计：store 数、persist key、整店订阅、store 依赖边/SCC、getState 分层；支持 --check、--json 与 --store |
| scripts/check-store-budgets.mjs | S6-12 Store 行数棘轮 + 环门禁：逐文件行数 ≤ baseline，未入基线的新文件 ≤400 行，运行时 store 图 SCC 必须为 0；支持 --update、--root、--baseline、--max-lines |
| scripts/report-audio-consumers.mjs | S6-4 audioStore 播放字段消费清单：9 字段的 selector / getState 链（含跨行与解构）/ 别名 / setState / `useAudioCurrentSong` 读写点，按层与字段汇总；支持 --json、--fields、--group（progress / playback / all 批次）、--check（components/hooks/lib/services/store 读点归零门禁；audioStore 自身定义点豁免） |
| scripts/check-docs-facts.mjs | 文档事实校验：store 数、过期字样、CI 触发分支、端口一致性（warn）、INDEX 链接、执行计划包完整性 |
| .dependency-cruiser.cjs | S6-12a 分层规则：no-circular(error)、no-orphans(warn)、store/services/lib/domain 反向依赖、src 禁 devDependency；由 `npm run verify:layers` 执行 |
| scripts/verify-layers.test.mjs | S6-12a 门禁测试：以同一 CLI 命令断言 exit 0，并校验 no-circular 与方向规则仍在配置中 |
| perf/budget.json | 包体阈值（baseline / target / hardMax） |
| perf/bundle-baseline.json | 包体回归基线（2026-10-29 重建；由 `bundle-diff --update` 从最新 report 维护） |
| perf/store-stats-baseline.json | 2026-10-21 Store 架构基线快照 |
| perf/store-line-baseline.json | 2026-10-29 Store 行数基线（64 文件 / 18,222 行；16 个 >400 行存量冻结） |
| perf/reports/s6-audio-consumers.before.json | S6-4 迁移前播放字段消费快照（297 处 / 64 文件；混音字段 73）——PR2 修正脚本口径后重跑，原口径 300 |
| perf/reports/s6-audio-consumers.json | S6-4 当前播放字段消费快照（PR5 后 91 处 / 28 文件；读点仅剩 audioStore 自身 18，服务/非 audioStore store 读点 0） |
| perf/reports/s6-audio-consumers.currentSong.before.json | PR2 迁移前 currentSong 快照（68 处 / 52 文件：components 44、hooks 12、lib 3、services 5、store 4） |
| perf/reports/s6-audio-consumers.currentSong.json | PR2 迁移后 currentSong 快照（9 处 / 4 文件，全部落在 services/store 层） |
| perf/reports/s6-audio-consumers.progress.before.json | PR3 迁移前进度字段快照（87 处 / 26 文件，读点 50：components 30、hooks 11、services 1、store 8） |
| perf/reports/s6-audio-consumers.progress.json | PR3 迁移后进度字段快照（46 处 / 17 文件；components/hooks/lib 读点 0，余 services 1 + store 8） |
| perf/reports/s6-audio-consumers.isPlaying.before.json | PR4 迁移前 isPlaying 快照（68 处 / 40 文件，读点 36：components 26、hooks 3、lib 3、services 1、store 3） |
| perf/reports/s6-audio-consumers.isPlaying.json | PR4 迁移后 isPlaying 快照（36 处 / 24 文件；components/hooks/lib 读点 0，余 services 1 + store 3 读点；写点 32 仍走 audioStore） |
| perf/reports/s6-audio-consumers.services.before.json | PR5 迁移前全字段快照（107 处 / 29 文件；services 读点 12、非 audioStore store 读点 4） |
| perf/reports/s6-audio-consumers.services.json | PR5 迁移后全字段快照（91 处 / 28 文件；services 读点 12→0、非 audioStore store 读点 4→0，余 audioStore 自身 18 读 + services/store 10 写） |

## 2. 用法

    # 包体（须先 npm run build；读取 .next 产物）
    node scripts/perf/bundle-budget.mjs
    node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json
    npm run perf:bundle:diff                            # 与 perf/bundle-baseline.json 比较（见 §8）
    node scripts/perf/bundle-budget.mjs --check        # 超 hardMax 时 exit 1（S4 后启用）

    # Store 架构
    node scripts/perf/report-store-stats.mjs
    node scripts/perf/report-store-stats.mjs --json perf/store-stats-baseline.json
    node scripts/perf/report-store-stats.mjs --check   # 不得比基线更差
    node scripts/perf/report-store-stats.mjs --store usePlaylistStore  # 单 store 整店订阅数

    # Store 行数棘轮 + 环（S6-12）
    npm run verify:filesize
    node scripts/check-store-budgets.mjs --update   # 仅显式更新；存量只减不增，新增 >400 拒绝入基线

    # audioStore 播放字段消费（S6-4）
    node scripts/report-audio-consumers.mjs
    node scripts/report-audio-consumers.mjs --json perf/reports/s6-audio-consumers.json
    node scripts/report-audio-consumers.mjs --fields volume,isMuted        # 单字段清单（写点也会列出）
    node scripts/report-audio-consumers.mjs --group progress --check        # 进度读点归零（写点仍走 audioStore）
    node scripts/report-audio-consumers.mjs --group playback --check        # isPlaying 读点归零（写点仍走 audioStore）
    node scripts/report-audio-consumers.mjs --group all --check             # 9 字段读点在 services/store 也归零（audioStore 自身豁免）

    # 分层依赖（S6-12a；CI 的 quality job 同命令）
    npm run verify:layers

    # 文档事实
    node scripts/check-docs-facts.mjs

## 3. 2026-10-21 基线（读取 .next mtime 2026-10-21 01:22；当前脏树）

| 指标 | 数值 |
|---|---:|
| rootMainFiles | 23 文件 / 969.3 KB raw / 296.8 KB gzip |
| 首页 script | 37 个 / 1,996.7 KB raw / 615.7 KB gzip |
| 全局 CSS | 1 文件 / 227.4 KB raw / 29.2 KB gzip |
| 最大 async chunk | chunk-three 333.5 KB |
| public 目录 | 58.4 MB |
| Store 模块 | 60 |
| persist key | 44 |
| 整店订阅 | 161 / 645 calls（25.0%），whole-only 文件 59 |
| store 依赖边 | 25（脚本口径；审计 A 的严格口径为 21，见第 5 节） |
| SCC | 1（audioStore ↔ playlistStore） |
| getState 调用 | 358（components 126 / hooks 83 / store 94 / services 29 / lib 25 / app 1） |

## 4. 判定

- 包体：S0-S3 期间只报告不阻塞（当前 4 项超 hardMax：rootMain raw/gzip、scriptCount、public）。S4 完成后把 CI 步骤改为 --check；阈值收紧须 Lead 批准。
- Store：--check 只要求"不比基线更差"（whole 数、边数不增加，persist 数不减少，store 数不变）；存量改造由 S3/S6 逐步下降，随后更新基线。
- 文档：FAIL 必须修；PORT 为 WARN（start 3024 vs dev 3025，需 S0-3 修 package.json，但该文件当前被 55 项手势脏改占用，暂缓）。

## 5. 口径差异与已知限制

1. store 依赖边 25 vs 审计 21：本脚本统计所有静态 import（含 type-only 与 playbackRuntime/userAccount 类边），审计 A 的图脚本按更严格口径得到 21；两者 SCC 均为 1。S6 以本脚本为唯一回归口径。
2. rootMain 系"首屏必载下界"：只统计 build-manifest.rootMainFiles，不含各路由 page/layout chunk；首页完整 script 见 firstLoad 行。
3. gzip 为 zlib level 9，非 HTTP 传输压缩率，跨版本比较须同一脚本。
4. .next 必须由同一次 build 生成；若产物陈旧（如当前 2026-10-21 01:22 的快照），数字只用于基线，不代表最新代码。
5. 性能 harness（FPS/LCP/INP/内存）对应 Q11：measure.py 与 dev-only 路由由 S5-1b 统一修改；S0-6 只固化数据脚本与阈值，不并行改同一文件。
6. report-audio-consumers.mjs 口径修正（S6-4 PR2）：改为沿 `getState()` 逐段跟随链式成员（不再把参数里的 `activeAudio.duration` 误计为 store 字段）、支持跨行链与解构、剔除 `(state) => state.x` 箭头参数误报、纳入 `useAudioCurrentSong` 便捷钩子、`--check` 覆盖 lib 层；因此全字段基线由 300/242 重算为 297/240，历史对比请以本口径为准。
7. isPlaying 批次（S6-4 PR4）：UI 读点统一走 PlaybackClock，`--group playback` 只校验读点，`setIsPlaying/togglePlaybackIntent/setState` 写点仍留在 audioStore（S6-5/S6-9 再收口）；迁移前后 isPlaying 68→36（读点 36→4，components/hooks/lib 读点 0）。
8. services/store 收尾（S6-4 PR5）：`--check` 默认层扩为 components/hooks/lib/services/store，`src/store/audioStore.ts`（字段声明、双向镜像、useAudio* 原子 hook）按定义点豁免；新增 `--group all` 覆盖全部 9 字段读点。aiAgentTools/useAIAgentStore/songPurgeService 的身份与进度读点改 playerStore/PlaybackClock，写点保留以等待 S6-9 编排下沉；services 读点 12→0、store 非豁免读点 4→0，全字段 107→91（29→28 文件）。

## 6. Store 行数棘轮 + 环门禁（S6-12，2026-10-29）

- 基线：`perf/store-line-baseline.json`，79 个非测试 store 文件 / 18,768 行；`maxLines=400`（S6-12c `--update` 补录 13 个 S6-6/S6-7 新增文件并新增 `libraryManager/helpers.ts`，over-cap 16→15；S6-12d 新增 `lyricsCover/helpers.ts`，over-cap 15→14）。
- 口径：统计 `src/store/**/*.{ts,tsx}` 物理行数（末尾换行不计），排除 `__tests__/`、`__contract__/`、`fixtures/`、`*.test.*`、`*.spec.*`。
- 棘轮：已入基线文件只允许 ≤ 基线（减行通过、增行 FAIL）；未入基线的新文件 >400 行 FAIL；`--update` 显式执行且 shrink-only（首次建基线除外；拒绝存量增行与新增 >400 入档），并清理已删除文件。
- 环：运行时 store→store import 的 SCC 必须为 0（type-only import 不构成运行时边；作用域与 `report-store-stats` 的顶层 store 模块一致）；FAIL 时逐条打印违规文件/环。
- 命令：`npm run verify:filesize`；测试 `scripts/perf/check-store-budgets.test.mjs` 覆盖真实仓库、增行、新文件超限、`--update` 与环 fixture。

当前最大文件（baseline 2026-10-29，>400 行均按基线冻结）：

| 行数 | 文件 |
|---:|---|
| 1012 | src/store/statsAchievementsStore.ts |
| 717 | src/store/useOfflineDownloadStore.ts |
| 701 | src/store/userAccountStore.ts |
| 644 | src/store/useAIAgentStore.ts |
| 638 | src/store/visualSettingsStore.ts |
| 612 | src/store/sourceConfigStore.ts |
| 604 | src/store/smartPlaylistStore.ts |
| 572 | src/store/aiStore.ts |
| 551 | src/store/audioEffectsStore.ts |
| 534 | src/store/emotionStore.ts |
| 529 | src/store/backupRestoreStore.ts |
| 500 | src/store/searchStore.ts |
| 467 | src/store/slices/playbackSlice.ts |
| 432 | src/store/queueStore.ts |

- 已知缺口：S6-12a 分层规则已落地（末尾 §10；首跑 8 errors 已清零）；14 个存量 >400 文件待拆分后执行 `--update` 收紧。S6-12c 已把 `libraryManagerStore.ts` 419→313 行（类型/默认值/纯函数下沉到 `src/store/libraryManager/helpers.ts`，public API 与 persist name/partialize 不变），over-cap 由 16 降到 15。S6-12d 已把 `lyricsCoverStore.ts` 425→355 行（歌词/封面类型与 LRC 编解码下沉到 `src/store/lyricsCover/helpers.ts`，public API 与 persist name/partialize 不变），over-cap 由 15 降到 14。S6-12b 的 CI 接线见第 7 节。

## 7. CI 接线（S6-12b，2026-10-29）

- `npm run perf:gates` = `check-store-budgets` → `report-store-stats --max-whole 10` → `check-bundle-markers --skip-if-missing`；任一失败即非 0 退出。
- `.github/workflows/deploy.yml` 的 `verify` 作业在 `Production build` 之后、同 job 内运行该脚本，保证 `.next` 存在；`--skip-if-missing` 只让 bundle markers 在无 build 产物时打印 skip 并放行（单独跑 `npm run perf:check-bundle` 仍为 exit 2）。
- **`report-store-stats.mjs --check` 仍禁用**：`perf/store-stats-baseline.json` 是 2026-10-21 快照（60 stores / 44 persist keys），实测 59 / 43，`--check` 会报 `stores 59 != baseline 60; persistCount 43 < baseline 44` 直接失败。重建基线需 Lead 批准并单独 PR；重建前 CI 用 `--max-whole 10` 兜底 whole-store 订阅，旧 "Store stats baseline gate" 步骤已移除，避免常红。
- 回归测试：`scripts/perf/ci-perf-gates.test.mjs` 以 YAML 文本断言 `perf:gates` 步骤存在、位于 verify job 且在 build 之后，断言 `--check` 未启用且 stale 说明仍在，并校验 npm 脚本三项顺序。

## 8. Bundle 回归 diff 与 nightly（S8-3a，2026-10-29）

- 基线 `perf/bundle-baseline.json` 记录 rootMain / first-load / CSS / async / public 全量快照（`updatedAt` + `source` + `result`），提交入库；`perf/bundle-report.json` 是 build 产物（CI/本机生成，不提交）。
- 命令：

      npm run build
      node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json
      npm run perf:bundle:diff                       # markdown 表；回归 exit 1，缺文件 exit 2
      npm run perf:bundle:diff -- --json perf/bundle-diff.json --md perf/bundle-diff.md
      npm run perf:bundle:diff -- --max-root-gzip 8 --max-first-load-gzip 12
      npm run perf:bundle:diff -- --update           # 显式重设基线（须评审后提交）

- 阈值：相对基线 `rootMain.gzipKB` +5KB、`firstLoad.gzipKB` +10KB；`--max-root-gzip` / `--max-first-load-gzip` 覆盖。raw / CSS / script count 只展示不拦截；绝对 hardMax 仍由 `bundle-budget --check`（S4 后启用）负责。
- nightly：`.github/workflows/nightly.yml`，`schedule` `0 18 * * *`（北京 02:00）+ `workflow_dispatch`；步骤 build → bundle report → 全量 `npm run test -- --run` → diff → 追加历史/看板（§9），失败即红；artifact `perf-bundle-<run_id>` 保留 `bundle-report.json` / `bundle-diff.json` / `bundle-diff.md` / `perf-history.jsonl` / `perf-dashboard.md`，diff 与看板写入 job summary。
- 当前基线（2026-10-29 本机 build）：rootMain 3 files / 689.3KB raw / 211KB gzip；首页 8 scripts / 1,959.8KB raw / 607.2KB gzip；CSS 225.4KB raw / 29KB gzip；最大 async chunk 683.5KB；public 58.4MB。
- 已知缺口：diff 只覆盖静态包体；runtime FPS / 内存采集仍未接线（S8-3b 已接入历史/看板，见 §9；指标生产者待 S8-3c/d）；2h soak（S8-3c）未接线；bundle-budget 仍报 maxAsyncChunk 683.5 > 400 与 public 58.4MB > 45 两项绝对超限，待 S4 / 资源治理处理，本 diff 不拦截。
- 测试：`scripts/perf/bundle-diff.test.mjs`（通过 / 超阈值 fail / 缺失文件 exit 2 / `--update` 棘轮）。

## 9. 性能历史与看板（S8-3b，2026-10-29）

- `scripts/perf/append-history.mjs` 把 `bundle-budget --json` 的 `result` 归一化为一行 JSONL，追加到 `perf/perf-history.jsonl`（生成物，随 nightly artifact 保存，不入库）。
- 行 schema（固定；`--check` 逐行校验）：

      { "ts": "2026-10-29T00:00:00.000Z", "commit": "a7da509",
        "rootMainGzipKB": 211, "firstLoadGzipKB": 607.2, "cssGzipKB": 29,
        "asyncMaxKB": 683.5, "publicMB": 58.4,
        "metrics": { "fpsP50": 57.5 } }

- 追加严格单调：新 `ts` 必须大于最后一行，重复或回退 `ts` exit 1，且写入前校验全文件 schema；`--check` 只读校验（空/缺失历史按 0 行通过）。`--init` 只创建空文件（无 header），已有文件不截断。
- `--report` / `--metrics` / `--history` / `--commit` / `--ts` 可覆盖默认值；`--metrics` 接受 `{ metrics: {...} }`（audio-metrics 输出）或裸对象。命令：

      node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json
      npm run perf:history:append -- --commit a7da509
      npm run perf:history:append -- --metrics perf/audio-metrics.json
      node scripts/perf/append-history.mjs --check
      npm run perf:dashboard                          # stdout
      npm run perf:dashboard -- --out perf/perf-dashboard.md
      node scripts/perf/perf-dashboard.mjs --limit 30 # 表格默认最近 14 行

- 看板：最近 14 行表格（时间 UTC / commit / rootMain gzip / 首页 gzip / CSS / 最大 async / public），每个指标带相对上一行的箭头与 delta（↑ 增长、↓ 下降、→ 持平）；`### Regression highlights` 列出超过阈值的相邻增量（rootMain +5KB、首页 +10KB、CSS +5KB、async +10KB、public +1MB）；最新行有 `metrics` 时输出“Latest runtime metrics”（最多 8 键）。空历史输出占位说明而非报错。
- nightly：`.github/workflows/nightly.yml` 在 bundle report 与 diff 之后，`if: always()` 追加历史（存在 `perf/audio-metrics.json` 时带 `--metrics`）→ 生成 dashboard 并写入 job summary；artifact `perf-bundle-<run_id>` 增加 `perf-history.jsonl` / `perf-dashboard.md`（及可选的 `audio-metrics.json`）。
- 测试：`scripts/perf/perf-history.test.mjs`（append schema + metrics / 重复与非单调 ts exit 1 / 3 行看板表格与回归高亮 / `--init` 与空历史看板）。
- 已知缺口：nightly 使用干净 checkout，历史行不跨 run 累积（仅随 artifact 保存），E6 的“≥28 行”需 S8-3d 汇总或后续回填；`--metrics` 的生产者（audio-metrics 的 `--out`）尚未在当前分支落地，nightly 以文件存在为接入条件；看板阈值与 `bundle-diff` 的 gzip 阈值一致，绝对 hardMax 仍由 `bundle-budget --check` 负责（当前禁用）。

## 10. 分层依赖门禁（S6-12a，2026-10-29）

- 配置：`.dependency-cruiser.cjs`；命令：`npm run verify:layers`（`depcruise src --config .dependency-cruiser.cjs --output-type err`）。CI 在 `quality` job 的 lint 之后运行；单测 `scripts/verify-layers.test.mjs` 用同一命令断言 exit 0，并校验 no-circular 与方向规则仍在配置中。
- error 规则：`no-circular`；`src/store` 禁 import `src/components|src/hooks`；`src/services` 禁 import `src/components`；`src/lib` 禁 import `src/components|src/hooks`；`src/domain` 禁 import react/next、`src/components|src/hooks`、`src/store`；`src` 生产代码禁 import devDependency。
- warn 规则：`no-orphans`（排除 Next 路由/worker 入口、测试与 `.d.ts`），只暴露孤立模块，不阻塞 CI。
- 豁免（棘轮，只准收紧）：
  - `src/domain/playback/ports.ts` 是唯一允许直连 store 的 domain 适配器（该文件头注释即契约）；其余 domain 模块不得新增 store import。
  - 测试文件（`*.test.*` / `*.spec.*` / `src/test/**`）不参与分层与 devDependency 规则；`import type` 默认不构成运行时边（与 S6-11c store 图口径一致）。
- 首跑（2026-10-29）8 errors / 26 warnings → **0 errors**。修复：store→GlassToast 3 处（toast 单例下沉 `src/store/actions/uiActions.ts`，GlassToast 仅 re-export）；lib→hooks 2 处（`src/lib/audio/audioEngineAccess.ts` 承接 getAudioContext/getAudioAnalyser）；`audioStore→playbackSlice→playlistStore→audioStore` 环（删除无消费者的 `playlistStore.playSelectedSongs`，`storeGraph.contract.test.ts` 边预算 22→21）；`degradedNotifier→uiStore→safeStorage→degradedNotifier` 环（toast 订阅上移 `src/hooks/useStorageDegradedToast.ts`）。
- 26 条 no-orphans warning 是存量孤立模块（多为仅 type import 的 types 文件与动态加载的 lx_sources），保持 warn；新增 error 必须修复，或用 `pathNot` 精确豁免并在 PR 说明原因（不得整目录排除）。
