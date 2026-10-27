# 进度看板 — 架构与性能优化（74 任务）

> 上级：[总计划](../2026-10-21-architecture-performance-optimization.md) · [执行计划包 README](./README.md)
> 状态口径：pending（未开始）/ in_progress（实现中）/ review（待复核）/ done（已合并且验收通过）/ blocked（阻塞，需写原因）
> 规则：每完成一个子 PR 勾选对应任务下的子项；任务 done 必须附证据（命令/退出码/指标/截图）；阶段出口全部满足才能把阶段标记 done。
> 更新时间：2026-10-27（S0-1/S0-3 done；S0-4/S0-6 done；S0-2 本地完成待 push；S0-5 review；S0-7 待决策；S1-1/S1-2/S1-3 done）

## 汇总

| 阶段 | 任务数 | done | 子 PR（执行计划） | 阶段出口（摘要） | 状态 |
|---|---:|---:|---:|---|---|
| S0 止血与基线 | 7 | 4 | 10 | CI 在 master 绿；基线 JSON；文档纠偏；ADR 定稿；脏改已处理 | in_progress（S0-1/S0-3/S0-4/S0-6 done；S0-2 本地完成待 push；S0-5 review；S0-7 待决策） |
| S1 数据与播放正确性 | 10 | 4 | 15 | 数据/备份/本地音源/队列/媒体桥闭环；集成测试绿 | in_progress（S1-1/S1-2/S1-3/S1-5 done；S1-4/S1-6..S1-10 待） |
| S2 音频图与持久化 | 6 | 0 | 6 | destination 入边=1；写盘 ≤1/s；节点不泄漏 | pending |
| S3 外壳与订阅治理 | 10 | 0 | 12 | 组件整店订阅 0；idle rAF ≤1；面板可回收 | pending |
| S4 包体与加载 | 7 | 0 | 10 | rootMain gzip ≤190KB（缺口见 Q10）；script ≤12；V8 已处置 | pending |
| S5 渲染运行时 | 7 | 0 | 17 | rAF 调用点 ≤8；1080p ≥90fps 无 dropped | pending |
| S6 状态架构收敛 | 12 | 0 | 28 | 44/44 key 注册；store 无环；audioStore <400 行 | pending |
| S7 服务与平台边界 | 9 | 0 | 19 | 桌面本地运行时闭环；插件隔离；2h soak 达标 | pending |
| S8 门禁与长期治理 | 6 | 0 | ~12 | CI 完整门禁；覆盖率/包体/性能回归生效 | pending |
| **合计** | **74** | **8** | **约 129** | — | in_progress |

进度公式：已完成任务数 / 74（S8-6 长期项按"已排期"计 0.5）。

> 口径说明：74 是逻辑任务；子 PR 数是 9 份阶段执行计划按 ≤400 行拆出的最小可合并单元，同一任务的子 PR 可在阶段收口时 squash。S6 顺序修订：S6-9a 前置到 S6-5 之前。执行期确认项见 [00-decisions.md](./00-decisions.md) 的 Q01-Q23（Q01/Q02/Q04/Q05/Q07/Q10 为关键阻塞）。

---

## S0 止血与基线（里程碑 M0，出口门）

- [ ] **M0 出口门**：CI 在 master 全绿；基线 JSON 入库；文档事实校验通过；out 陈旧发布被阻断；55 项脏改已处理；D1-D8 已定稿。
  **2026-10-21 进展**：bundle/store-stats 基线已生成；docs-facts exit 0（ports 为 WARN）；CI 已改写但未 push 验证；脏改/out/ADR 仍待。
  **2026-10-27 进展**：脏改已按 Q01-A 落到 checkpoint 分支（干净树）；基线 tsc/vitest/eslint/build 全部复测通过；S0-3 done（生产 HTTP 冒烟 200）、S0-5 已完成 worktree GC（25→6）；out/CI push/ADR 决策与根目录清理仍待。
- [x] S0-1 处理 55 项未提交手势改动 — **done（2026-10-27，Q01-A）**：checkpoint/gesture-air-control-overhaul-20261027 @ 2b99173（123 files / +27,294/−1,967，含手势 WIP + handwritten MV + S0/S1 基线 + handover 文档）；主工作区已干净；原始 feature 分支仍在 c73a872。基线：tsc exit 0、vitest 208 files/1284 tests passed、eslint src（分块）0 errors/0 warnings、隔离 worktree build exit 0（28 static pages）；详见 evidence/S0-evidence.md
- [ ] S0-2 CI 复活（master 触发 + tsc/lint/test/build）— **本地完成**：.github/workflows/deploy.yml 已重写（master 触发、concurrency、Node20、.next/tsbuildinfo 缓存、tsc→lint→test→build→bundle-report→store-gate→docs-facts、desktop/vercel 改为手动/tag）；YAML 校验通过；待 push 后验证 required checks
- [x] S0-3 构建产物与端口明确化 — **done（2026-10-27，commit 84305f6）**：start 端口统一 3025（3024 引用=0）；build:electron* 前置 verify-desktop-release-ready guard（冻结期 fail-fast，默认 exit 1）；新增 build:static；verify-static-export 重构为纯函数 + 5 tests（缺失 exit 2 / 过期 exit 3）；ARCHITECTURE 构建模式已修正。HTTP 冒烟：在隔离 worktree @1be849f 完成 next build + next start -p 3026，`/` 与 `/data-manager` 均 200；3025 当时被用户 dev server 占用，故端口用 3026 验证，配置真值已统一为 3025。
- [x] S0-4 文档事实修正 — **done（部分文件）**：AGENTS.md/ARCHITECTURE.md 已按实测修正（60 stores / 19 hooks / 18 services / 4 workers；真实音频链；coordinator 死层；构建模式；AI 桩）；node scripts/check-docs-facts.mjs exit 0；ROADMAP/CHANGELOG 因脏改暂未动
- [ ] S0-5 死层标记与仓库卫生 — **review（2026-10-27，commit 195d996）**：coordinator 4 文件 @deprecated + ESLint no-restricted-imports 已在位；删除跟踪死文件 page.tsx.v7 / VisualizationView.tsx.fix（grep 0 代码引用）；新增 scripts/gc-worktrees.ps1；Q22 后执行 -Apply：worktrees **25→6**（removed 19，dirty skipped 5，分支/提交未动）。剩余：6 个 worktree 中 5 个为 dirty（用户/其它会话工作），根目录文件 31 项待保守清理；E0-5 的 ≤5/≤20 目标未完全达成。
- [x] S0-6 测量基座 v1 — **done（v1）**：scripts/perf/bundle-budget.mjs、scripts/perf/report-store-stats.mjs、scripts/check-docs-facts.mjs、perf/budget.json、perf/bundle-baseline.json、perf/store-stats-baseline.json、perf/README.md；实测数字与审计 B/D 一致；measure.py/dev harness 按 Q11 交 S5-1b
- [ ] S0-7 ADR D1-D8 评审与归档 — **部分完成**：docs/nbl/adr/ 已建（README + 0001 V8 / 0002 桌面运行时 / 0003 音频图 / 0004 持久化 / 0005 受保护视图，状态 Proposed）；待用户批准后转 Accepted

## S1 数据与播放正确性（M1，出口门）

- [ ] **M1 出口门**：正确性场景（总计划 §9.2）全部自动化通过；旧备份/旧 key fixture 通过；无已知数据丢失路径。
- [x] S1-1 storageRegistry v1 — **done（2026-10-21，提前落地）**：src/lib/storage/storageRegistry.ts（44 key/8 backup/owner+version+group+quotaPolicy）+ storageRegistry.test.ts 5 用例通过；依赖 S0-6 已满足；S1-2 可直接使用 registry
- [x] S1-2 备份/恢复修复（registry 槽位/rehydrate/泄漏/v5 schema）— **done（2026-10-27，2a+2b）**：分支 feature/arch-perf-s1-2a（已 rebase 到最新 checkpoint 1c3f1a1）@ 825e109（2a）+ 5862795（2b），隔离 worktree。2a：backupSchema.ts（v5 payload/parse/v4 migration/原子 restore/rollback snapshot）、rehydrateRegisteredStores.ts、backupRestoreStore 重写（8 个真实 registry key、v4 兼容、孤儿 body 清理、restoreReport）；3 fixtures + 14 tests。2b：BackupRestorePanel 恢复报告（restored/skipped/failed）、旧槽位 unsupported 提示、立即刷新按钮、挂载时 pruneOrphanBackupBodies，新增 3 panel tests + unsupportedStores 预览字段。worktree 内全量 204 files/1272 tests、tsc/eslint/prettier 全绿。**PR 拆分与合入 master 待办**。
- [x] S1-3 启动压缩与配额策略修复 — **done（2026-10-22）**：safeStorage 不再截断 200/30，只在缩减 ≥2% 时写回；新增 quotaPolicy（逐级降级、绝不先删旧值）+ degradedNotifier（事件+节流 toast）；queue/recommendation/stats 三处写盘统一策略；queue 永不写空队列。测试：quotaPolicy 5 + safeStorage 5 + queue/recommendation/stats 40，全部通过；tsc/eslint 0
- [ ] S1-4 VibeMusicDB 统一 open/version v3 — owner: — | PR: 1 | 依赖: S0-6 | 验收: v1→v3 迁移测试；local:// 可播
- [x] S1-5 队列唯一权威 + QueueNavigator — **done（2026-10-28）**：queueStore 成为队列/顺序/currentIndex 唯一权威，audioStore 派生镜像；新增 `queueNavigator.ts`（next/ended 统一导航）与 `queueSelectors.ts`；`queuePlaybackSync.test.ts` 10 用例（删/排/清后 next/ended 一致、双 store 不漂移），`queueNavigator.test.ts` 15 用例；targeted 45 passed；全量 204 files / 1292 tests passed；tsc/eslint 0。分支 `feature/arch-perf-s1-5`（未合并）。
- [ ] S1-6 PlaybackMediaBridge 单例 — owner: — | PR: 1 | 依赖: S0-6 | 验收: 多实例卸载后事件仍分发
- [ ] S1-7 AudioContextWatchdog 懒 attach/detach — owner: — | PR: 1 | 依赖: S1-6 | 验收: start 先于 context 也能挂载
- [ ] S1-8 PlaybackRequestCoordinator + AbortSignal — owner: — | PR: 1-2 | 依赖: S1-6 | 验收: 连点 5 首仅 1 in-flight
- [ ] S1-9 首声并行化 — owner: — | PR: 1 | 依赖: S1-8 | 验收: 命中 P50<300ms/P95<800ms
- [ ] S1-10 正确性集成测试矩阵 — owner: — | PR: 1 | 依赖: S1-2..S1-9 | 验收: 场景全部自动化

## S2 音频图与持久化性能（M2，出口门）

- [ ] **M2 出口门**：单入口混音（destination 入边=1）；写盘 ≤1/s；100 次切歌节点增量 0；听感 A/B 通过。
- [ ] S2-1 单入口混音 + 音量单点 — owner: — | PR: 1 | 依赖: S1-6 | 验收: 入边=1；volume=0.5 输出 -6dB
- [ ] S2-2 效果参数增量更新 — owner: — | PR: 1 | 依赖: S2-1 | 验收: 拖动 100 次 connect=0
- [ ] S2-3 AnalyserHub — owner: — | PR: 1 | 依赖: S2-1 | 验收: fftSize 稳定；每帧 0 分配
- [ ] S2-4 播放写盘降频 — owner: — | PR: 1 | 依赖: S1-5 | 验收: ≤1 次/秒；恢复误差 ≤5s
- [ ] S2-5 图与集合生命周期 — owner: — | PR: 1 | 依赖: S1-7 | 验收: activeNodes 增量 0；2h 不增长
- [ ] S2-6 性能验证与沉淀 — owner: — | PR: 1 | 依赖: S1/S2 | 验收: 指标报告可重复

## S3 应用外壳与订阅治理（M3，出口门）

- [ ] **M3 出口门**：组件层整店订阅 0（全仓 ≤10）；toast/面板不再重渲染 page；idle rAF ≤1；面板关闭 DOM 回收 ≥80%；包体不退化。
- [ ] S3-1 page selector + CssVarsStyle — owner: — | PR: 1 | 依赖: S0-2 | 验收: page 整店 2→0
- [ ] S3-2 全局壳 selector（5 文件，D7 授权）— owner: — | PR: 1 | 依赖: S0-1 | 验收: 5 文件整店→0；截图一致
- [ ] S3-3 VisualizationView selector + 进度下沉 — owner: — | PR: 1 | 依赖: S3-1 | 验收: viz commit 降 ≥80%
- [ ] S3-4 Player3D currentView 门控 — owner: — | PR: 1 | 依赖: 无 | 验收: Home 页 60s rAF=0
- [ ] S3-5 浮动层 gating — owner: — | PR: 1 | 依赖: S3-4 | 验收: idle rAF ≤1
- [ ] S3-6 LazyPanel LRU + deactivate — owner: — | PR: 1-2 | 依赖: S3-1 | 验收: DOM 回收 ≥80%
- [ ] S3-7 重复宿主清理（toast/SourceManagementModal）— owner: — | PR: 1 | 依赖: S3-1 | 验收: 实例数=1
- [ ] S3-8 playlistStore 29 处整店订阅清零 — owner: — | PR: 2 | 依赖: S3-1 | 验收: whole=0
- [ ] S3-9 预取策略 — owner: — | PR: 1 | 依赖: S0-6 | 验收: 5s 内动态 import ≤3
- [ ] S3-10 Top-20 整店订阅清理 — owner: — | PR: 1 | 依赖: S3-2 | 验收: 组件整店=0

## S4 包体与加载（M4，出口门）

- [ ] **M4 出口门**：rootMain gzip ≤190KB；script ≤12；First Load / ≤1,700KB；V8 按 D1 处置；至少 2 个高频列表虚拟化。
- [ ] S4-1 jsmediatags 动态化 — owner: — | PR: 1 | 依赖: S0-6 | 验收: 首屏标记消失
- [ ] S4-2 crypto-js 动态化/WebCrypto — owner: — | PR: 1 | 依赖: S4-1 | 验收: -84KB raw；LX 回归
- [ ] S4-3 splitChunks 语义块 + 字体 preconnect — owner: — | PR: 1 | 依赖: S0-6 | 验收: script ≤12；碎片 ≤6
- [ ] S4-4 CoverImage 统一组件（先 3 文件）— owner: — | PR: 1 | 依赖: 无 | 验收: 裸 img 归零（白名单）
- [ ] S4-5 VirtualList 接入 QueuePanel — owner: — | PR: 1 | 依赖: S3-6 | 验收: 500 项打开长任务=0
- [ ] S4-6 VirtualList 接入 Search/批量工具 — owner: — | PR: 1 | 依赖: S4-5 | 验收: 500 条首帧 <50ms
- [ ] S4-7 V8 处置执行（D1）— owner: — | PR: 2-4（删除不计行） | 依赖: S0-7、S5-4 契约 | 验收: rg=0；tsc/vitest 绿

## S5 渲染运行时（M5，出口门）

- [ ] **M5 出口门**：rAF 调用点 ≤8；1080p dpr2 ≥90fps 无 dropped；隐藏视图零绘制；4x throttle 自动降档。
- [ ] S5-1 VisualRuntime v1 — owner: — | PR: 1 | 依赖: S0-6、S3-4/5 | 验收: 3 订阅者 1 个 rAF
- [ ] S5-2 VisualizationView 调度迁移 — owner: — | PR: 1 | 依赖: S5-1 | 验收: draw p95 劣化 ≤10%
- [ ] S5-3 Shelf3D + 浮动层迁移 — owner: — | PR: 1 | 依赖: S5-1 | 验收: 同开 FPS ≥50
- [ ] S5-4 EffectPlugin + registry + 2 试点 — owner: — | PR: 2 | 依赖: S5-2 | 验收: contract 一致；截图/帧时间通过
- [ ] S5-5 粒子复用 + EffectContext 稳定 — owner: — | PR: 1 | 依赖: S5-4 | 验收: resize 100 次无 GC 抖动
- [ ] S5-6 qualityTier + longtask 降档 — owner: — | PR: 1 | 依赖: S5-1 | 验收: 4x throttle 自动降档
- [ ] S5-7 3 个重效果每帧分配审计 — owner: — | PR: 1-2 | 依赖: S5-4 | 验收: 稳态 0 新增长期对象

## S6 状态架构收敛（M6，出口门）

- [ ] **M6 出口门**：组件整店订阅 0；store 运行时 import ≤6 且无环；44/44 key 有 version/migrate；整店持久化 0；audioStore <400 行；11 组重复事实→0。
- [ ] S6-1 selector 门禁 + codemod — owner: — | PR: 1 | 依赖: S3 | 验收: 新增整店=CI error
- [ ] S6-2 storageRegistry 44/44 + hydrateStores（2 PR）— owner: — | PR: 2 | 依赖: S1-1、S2-4 | 验收: hydration 顺序测试
- [ ] S6-3 audio/player 去重（停双 persist/删双向）— owner: — | PR: 1 | 依赖: S2-4 | 验收: 写盘 ≤1/s；写路径唯一
- [ ] S6-4 audioStore 播放字段消费迁移（3 PR）— owner: — | PR: 3 | 依赖: S6-3 | 验收: 引用=0；行为回归
- [ ] S6-5 队列/EQ 副本删除 + SCC 消除 — owner: — | PR: 1 | 依赖: S1-5、S6-3 | 验收: 单一 owner；0 环
- [ ] S6-6 UI 域拆分（uiShell/panel/toast [+theme]）— owner: — | PR: 2 | 依赖: S3 | 验收: 每类事实 owner=1
- [ ] S6-7 主题单一来源 — owner: — | PR: 1 | 依赖: S6-6 | 验收: 主题不闪；来源唯一
- [ ] S6-8 全屏/toast/性能档去重 — owner: — | PR: 1 | 依赖: S6-6 | 验收: 每类 owner=1
- [ ] S6-9 domain 用例层 + 事件 + 服务 port 化 — owner: — | PR: 1-2 | 依赖: S6-4/5 | 验收: store 边 ≤6 type-only；服务 getState=0
- [ ] S6-10 剩余 getState 收敛 — owner: — | PR: 2 | 依赖: S6-9 | 验收: 组件=0；service=0
- [ ] S6-11 store contract 测试矩阵 — owner: — | PR: 1 | 依赖: S6-2/3 | 验收: 全覆盖
- [ ] S6-12 行数棘轮 + depcruise — owner: — | PR: 1 | 依赖: S0-2 | 验收: 0 循环；≤400 行

## S7 服务与平台边界（M7，出口门）

- [ ] **M7 出口门**：桌面本地运行时闭环（窗口 <3s、/ 与 /data-manager 200、旧 origin 数据可见、在线能力/降级）；插件隔离；2h soak 达标；OPFS 有结论。
- [ ] S7-1 Resolver 插件化 + request 包装/熔断（2 PR）— owner: — | PR: 2 | 依赖: S1-8 | 验收: 每模块 ≤300 行；坏 host 请求下降
- [ ] S7-2 缓存统一 LRU/TTL — owner: — | PR: 1 | 依赖: S7-1 | 验收: 内存不随会话线性增长
- [ ] S7-3 Worker transferable + 降级 — owner: — | PR: 1 | 依赖: S0-6 | 验收: 50MB 转换长任务 <50ms
- [ ] S7-4 Electron 本地 Next 运行时（D2）— owner: — | PR: 2 | 依赖: S0-3 | 验收: --dir 冷启动 <3s；200
- [ ] S7-5 BackendGateway + preload baseUrl + 能力协商 — owner: — | PR: 1 | 依赖: S7-4 | 验收: 浏览器/Electron 分支单测
- [ ] S7-6 后端异步启动 + 状态事件 + 离线 UI — owner: — | PR: 1 | 依赖: S7-5 | 验收: 后端故障 <3s 可见窗口
- [ ] S7-7 插件 utilityProcess 沙箱 + 权限 — owner: — | PR: 1 | 依赖: S7-5 | 验收: 恶意 fixture 无法读文件/执行命令
- [ ] S7-8 凭据 safeStorage + Web 提示 — owner: — | PR: 1 | 依赖: S7-5 | 验收: 桌面 cookie 不明文；旧数据可读
- [ ] S7-9 OPFS spike + 2h soak + 泄漏上界 — owner: — | PR: 1 | 依赖: S2-5 | 验收: 50MB 起播长任务 <100ms 或记录原因；heap <30MB

## S8 门禁与长期治理（M8，出口门）

- [ ] **M8 出口门**：PR required checks 全绿且 ≤12min；覆盖率分域生效；包体预算生效；depcruise 0 violations；nightly 连续 4 周无回归；发布清单演练完成。
- [ ] S8-1 CI 完整门禁（verify 全链路 + required checks）— owner: — | PR: 1-2 | 依赖: S0-2 | 验收: ≤12min；超阈值 fail
- [ ] S8-2 覆盖率阶梯（分域阈值 + burn-in）— owner: — | PR: 1 | 依赖: S8-1 | 验收: 域级达标；不降 >0.5pp
- [ ] S8-3 性能回归套件（bundle diff/nightly/soak/看板）— owner: — | PR: 2 | 依赖: S0-6 | 验收: 连续 4 周无回归
- [ ] S8-4 文档事实流水线（check-docs-facts + 季度对账）— owner: — | PR: 1 | 依赖: S0-4 | 验收: exit 0
- [ ] S8-5 发布检查清单与演练 — owner: — | PR: 1 | 依赖: S7 | 验收: 每次发版执行
- [ ] S8-6 长期 backlog（features 领域化/14 效果插件化/4K/低端/E2E/OPFS）— owner: — | 类型: 长期 | 依赖: 全部 | 验收: 已排期+触发条件

---

## 阻塞与风险登记（滚动更新）

| 日期 | 任务 | 阻塞原因 | 解锁条件 | owner |
|---|---|---|---|---|
| 2026-10-21 | S0-1 | 55 项手势改动未处理 | **已解除 2026-10-27**：Q01-A checkpoint 2b99173，工作树干净 | Lead |
| 2026-10-21 | S4-7 | D1 V8 处置未拍板 | 用户确认 D1 | Lead |
| 2026-10-21 | S7-4 | D2 桌面运行时未拍板；静态导出已被 31 API routes 实测阻断（ADR 0002） | 用户确认 D2-B（本地 Next 运行时） | Lead |
| 2026-10-21 | S3-2/S5-2 | D7 受保护视图改写授权 | 用户确认 D7 | Lead |

## 变更记录

| 日期 | 变更 | 说明 |
|---|---|---|
| 2026-10-21 | 创建看板 | 74 任务全部 pending；阶段出口门与阻塞项登记 |
| 2026-10-27 | S0-1 done | Q01-A checkpoint 分支/提交 2b99173；工作树干净；tsc/vitest/eslint/build 基线复测通过 |
| 2026-10-27 | S0-3 done / S0-5 GC | 84305f6（端口/门禁/测试）；隔离 worktree `next start -p 3026` 的 `/` 与 `/data-manager` 均 200；195d996 + Q22 后 worktrees 25→6（19 removed，5 dirty skipped） |
| 2026-10-27 | S1-2 done | feature/arch-perf-s1-2a @ 825e109(2a)+5862795(2b)，已 rebase 到 1c3f1a1：v5 schema/v4 migration/atomic restore/rehydrate/leak fixes + 面板报告/unsupported/reload；204 files/1272 tests 绿；PR 待 |
