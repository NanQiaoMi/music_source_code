# perf/ — 性能与架构基线工具（S0-6）

> 上级计划: docs/nbl/plans/2026-10-21-arch-perf-execution/S0-baseline.md
> 创建: 2026-10-21（S0-6 测量基座 v1）
> 约束: 基线文件由工具生成；更新基线必须附原因与 before/after，并在 PR 描述说明。

## 1. 文件

| 文件 | 说明 |
|---|---|
| scripts/perf/bundle-budget.mjs | 包体预算：rootMainFiles / 首页 script / CSS / async chunk / public 体积；支持 --check 与 --json |
| scripts/perf/report-store-stats.mjs | Store 架构统计：store 数、persist key、整店订阅、store 依赖边/SCC、getState 分层；支持 --check、--json 与 --store |
| scripts/check-docs-facts.mjs | 文档事实校验：store 数、过期字样、CI 触发分支、端口一致性（warn）、INDEX 链接、执行计划包完整性 |
| perf/budget.json | 包体阈值（baseline / target / hardMax） |
| perf/bundle-baseline.json | 2026-10-21 包体基线快照 |
| perf/store-stats-baseline.json | 2026-10-21 Store 架构基线快照 |

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
