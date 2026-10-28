# 长期 Backlog（S8-6）

> 来源：`docs/nbl/plans/2026-10-21-arch-perf-execution/S8-quality-governance.md` §5 S8-6（L1-L10）+ 其他阶段计划显式登记项（L11-L12）。
> 上级：[架构与性能优化总计划](./plans/2026-10-21-architecture-performance-optimization.md) · 进度事实源：[TRACKING.md](./plans/2026-10-21-arch-perf-execution/TRACKING.md) · 流程规范：[PROCESS.md](./PROCESS.md) · 路线图：[ROADMAP.md](./ROADMAP.md)
> 状态：**已排期（trigger-gated）**，不是承诺工期。每季度第一周评审；未触发必须写原因并顺延。
> 落地说明：计划写作用域为 `docs/nbl/quality/backlog.md`，实际落在 `docs/nbl/BACKLOG.md`（与 ROADMAP/PROCESS/AGENTS 同级，便于入口索引），内容与验收口径不变。

## 1. 使用规则

- **触发性排期**：只有「触发条件」列全部满足才进入迭代；条件未满足时不得以"顺手做一下"插队，避免主线被打断。
- **可测量**：触发条件必须能用仓库内数据判定（脚本输出、TRACKING 勾选、perf-history 行数、CI 结果），不写"等有时间"。
- **先测量后优化**（总计划 I6/P6）：任何 L 项启动前先出 before/after 与固定场景，再拆 PR（≤400 行，测试/文档不计）。
- **优先级**：P1 = 影响正确性/安全或阻塞后续阶段；P2 = 结构性收益（包体/架构/可维护性）；P3 = 机会性优化。
- **单一事实源**：本表是长期事项的唯一清单；ROADMAP/PROCESS/AGENTS 只放指向本文件的入口链接。

## 2. Backlog 表

| ID  | 事项                                                         | 理由                                                                       | 触发条件（可测量）                                                                                               | 优先级 | Owner                | 计划链接                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | features 目录领域化（渐进迁移，不一次性搬目录）              | 一次性迁移会同时打断状态/播放/UI 三条轨道；旧 API 需先 deprecated 再退场   | S6 全部 12 项 done 且 `npm run verify:filesize` 连续 30 天绿；`src/features` 30 天内跨目录移动提交 = 0           | P2     | TBD（架构 owner）    | [S8-6 L1](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog) · [§4.7 目标目录](./plans/2026-10-21-architecture-performance-optimization.md#47-目标目录渐进不做一次性迁移)            |
| L2  | V7 14 个效果全部插件化（EffectPlugin / RenderRuntime）       | S5-4 只迁移 2 个试点，其余 12 个仍在中心 switch；新增效果必须改中心分支    | `effectPlugins` 默认 on 且 2 个试点连续 28 天 0 revert；14/14 效果有截图基线；新效果接入对中心 switch 的改动 = 0 | P1     | TBD（渲染 owner）    | [S8-6 L2](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog) · [S5-4](./plans/2026-10-21-architecture-performance-optimization.md#s5-渲染运行时与可视化契约15-2-周7-个-pr约-1800-行) |
| L3  | 4K / 低端设备适配（D5 质量档位真机验收）                     | 本轮只覆盖 Windows 1080p；4K dpr2 与 D5 low 档均无真机证据                 | `perf-history.jsonl` 连续 14 天 1080p dpr2 status=pass 且 fps_p50 ≥90；或可复现的 <60fps 真机报告 ≥1 份          | P2     | TBD（性能 owner）    | [S8-6 L3](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog) · [D5](./plans/2026-10-21-architecture-performance-optimization.md#8-需要拍板的决策按阻塞程度排序)                      |
| L4  | Playwright E2E 套件（桌面 + Web 冒烟）                       | 关键路径只有单测与手工/CDP 冒烟，无跨浏览器回归；B/D 审计均记为缺口        | S1/S2/S3 出口门全通过（TRACKING 中 S1-4..S1-10、S2、S3 全绿）+ 6 条核心场景清单确认 + 运行环境决策落定           | P2     | TBD（质量 owner）    | [S8-6 L4](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog) · [§1.1 范围](./plans/2026-10-21-architecture-performance-optimization.md#11-范围)                                      |
| L5  | OPFS 二进制缓存落地                                          | 50MB 级音频走 IDB，起播长任务与磁盘配额是已知硬约束；迁移不可逆需先 spike  | S7-9 OPFS spike 通过（50MB 起播长任务 <100ms 或原因已记录）+ 磁盘配额告警 ≥1 次                                  | P3     | TBD（存储 owner）    | [S8-6 L5](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog) · [§4.5 持久化](./plans/2026-10-21-architecture-performance-optimization.md#45-持久化基础设施srclibstorage)             |
| L6  | 依赖升级节奏（Node 24 / ESLint 9 flat / Next/Vitest minor）  | phantom deps 与 EOL 依赖会以 CI 红灯形式突然打断主线                       | 每季度首周固定窗口执行；或 CI 出现 ≥1 次依赖 EOL / 安全告警                                                      | P1     | TBD（构建 owner）    | [S8-6 L6](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog) · [§10.4 已知限制](./plans/2026-10-21-architecture-performance-optimization.md#104-未覆盖与已知限制诚实声明)            |
| L7  | mutation testing（Stryker）评估                              | 覆盖率不等于断言有效性；核心 store 的"假绿"风险未被度量                    | store 与 services 域 lines ≥65%（`perf/coverage-domains.json` 地板之上）+ 试点 2 天预算获批                      | P3     | TBD（质量 owner）    | [S8-6 L7](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog)                                                                                                                         |
| L8  | 质量看板（coverage / perf / CI 时长趋势）                    | 当前只有 markdown 摘要与 JSONL，趋势与回归仍需人工比对                     | `perf-history.jsonl` ≥56 行（约 8 周 × 7 天）且 nightly 连续 4 周成功                                            | P2     | TBD（质量 owner）    | [S8-6 L8](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog) · [S8-3 看板](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-3-性能回归套件)                        |
| L9  | 仓库卫生季度 GC（worktree / dist-electron / out / coverage） | worktree 与构建产物持续增长，回收动作没有固定节奏就会拖到磁盘告警          | 每季度首周执行；或 worktree >5 个 / 可回收空间 ≥5GB                                                              | P2     | TBD（release owner） | [S8-6 L9](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog)                                                                                                                         |
| L10 | 插件沙箱与第三方源安全审计                                   | 在线源脚本可触达文件与网络，权限边界未验证；S7-8 只覆盖凭据                | 在线音源 >3 个，或出现 1 起恶意 source / 越权事件                                                                | P2     | TBD（安全 owner）    | [S8-6 L10](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md#s8-6-长期-backlog) · [S7-8](./plans/2026-10-21-arch-perf-execution/S7-platform-runtime.md#s7-8-凭据-safestorage--web-提示)                |
| L11 | 字体 self-host（离线 / 合规）                                | 当前 Google Fonts 走 link，离线首屏会缺字；S4-1 Q4-2 明确"单列 S8 backlog" | 离线发布需求出现 ≥1 次（用户/发布评审），或字体请求失败 ≥1%/周                                                   | P3     | TBD（UI owner）      | [S4-1 Q4-2](./plans/2026-10-21-arch-perf-execution/S4-bundle-loading.md#7-未决问题--需用户决策)                                                                                                                      |
| L12 | `/` 与 `/data-manager` 两路由 entry 拆分                     | 两路由共享模块可能只被其一需要，直接压 rootMain 与首屏脚本数               | bundle-diff 出现两路由共享模块 ≥1 个且 gzip ≥10KB，或 rootMain gzip 再破 230KB 硬线                              | P2     | TBD（包体 owner）    | [S4-2 §5.3](./plans/2026-10-21-arch-perf-execution/S4-bundle-loading.md#53-e4-4-缺口处理预置不许静默)                                                                                                                |

## 3. 季度评审（how to review quarterly）

1. **时间**：每季度第一周（1/4/7/10 月第一个工作周）由 Lead 召集，30-60 分钟；不在季度窗口内的临时插队必须走本表新增行。
2. **逐项判定**：对照「触发条件」列用当前数据判定「已触发 / 未触发 / 已失效」；未触发必须写原因与下次复核季度，不写"以后再说"。
3. **产出**：`docs/nbl/quality/quarterly-YYYY-QN.md`，每项一行（ID / 判定 / 数据来源 / Owner / 下一步），并在本表更新 Owner 与触发条件。
4. **触发后动作**：按总计划 I6 拆 PR（≤400 行，测试/文档不计），在 TRACKING 登记子任务；范围不清楚时先做一个 spike，spike 结论回写本表。
5. **归档规则**：连续 2 个季度未触发且无人认领 → 标记 Archived 并写明原因；需求再出现时重新建行，不复用旧 ID，避免历史与现状混淆。
6. **回归保护**：修改本表后运行 `npx vitest run scripts/docs-backlog.test.mjs`；表结构、触发条件、计划链接任一缺失都会失败。

## 4. 与其他文档的关系

- 本表**只记录尚未排期**的长期事项；已进入迭代的事项应回到 [TRACKING.md](./plans/2026-10-21-arch-perf-execution/TRACKING.md) 与阶段执行计划，不在此重复。
- 已完成的长期事项在本表删除行，并在 [ROADMAP.md](./ROADMAP.md) / [CHANGELOG.md](./CHANGELOG.md) 留一条完成记录。
- 优先级/触发条件发生变化时，同一 PR 内同时改表与计划章节，避免两处数字打架。
