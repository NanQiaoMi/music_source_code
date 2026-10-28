# perf/ — 性能与架构基线工具（S0-6）

> 上级计划: docs/nbl/plans/2026-10-21-arch-perf-execution/S0-baseline.md
> 创建: 2026-10-21（S0-6 测量基座 v1）
> 约束: 基线文件由工具生成；更新基线必须附原因与 before/after，并在 PR 描述说明。

## 1. 文件

| 文件 | 说明 |
|---|---|
| scripts/perf/bundle-budget.mjs | 包体预算：rootMainFiles / 首页 script / CSS / async chunk / public 体积；支持 --check 与 --json |
| scripts/perf/report-store-stats.mjs | Store 架构统计：store 数、persist key、整店订阅、store 依赖边/SCC、getState 分层；支持 --check、--json 与 --store |
| scripts/report-audio-consumers.mjs | S6-4 audioStore 播放字段消费清单：9 字段的 selector / getState 链（含跨行与解构）/ 别名 / setState / `useAudioCurrentSong` 读写点，按层与字段汇总；支持 --json、--fields、--group（progress / playback / all 批次）、--check（components/hooks/lib/services/store 读点归零门禁；audioStore 自身定义点豁免） |
| scripts/check-docs-facts.mjs | 文档事实校验：store 数、过期字样、CI 触发分支、端口一致性（warn）、INDEX 链接、执行计划包完整性 |
| perf/budget.json | 包体阈值（baseline / target / hardMax） |
| perf/bundle-baseline.json | 2026-10-21 包体基线快照 |
| perf/store-stats-baseline.json | 2026-10-21 Store 架构基线快照 |
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
    node scripts/perf/bundle-budget.mjs --json perf/bundle-baseline.json
    node scripts/perf/bundle-budget.mjs --check        # 超 hardMax 时 exit 1（S4 后启用）

    # Store 架构
    node scripts/perf/report-store-stats.mjs
    node scripts/perf/report-store-stats.mjs --json perf/store-stats-baseline.json
    node scripts/perf/report-store-stats.mjs --check   # 不得比基线更差
    node scripts/perf/report-store-stats.mjs --store usePlaylistStore  # 单 store 整店订阅数

    # audioStore 播放字段消费（S6-4）
    node scripts/report-audio-consumers.mjs
    node scripts/report-audio-consumers.mjs --json perf/reports/s6-audio-consumers.json
    node scripts/report-audio-consumers.mjs --fields volume,isMuted        # 单字段清单（写点也会列出）
    node scripts/report-audio-consumers.mjs --group progress --check        # 进度读点归零（写点仍走 audioStore）
    node scripts/report-audio-consumers.mjs --group playback --check        # isPlaying 读点归零（写点仍走 audioStore）
    node scripts/report-audio-consumers.mjs --group all --check             # 9 字段读点在 services/store 也归零（audioStore 自身豁免）

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
