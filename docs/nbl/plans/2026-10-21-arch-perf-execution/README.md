# 架构与性能优化 — 执行计划包（2026-10-21）

> **上级计划**：[架构与性能优化总计划](../2026-10-21-architecture-performance-optimization.md)（74 个任务，S0-S8）
> **状态**：执行计划编写完成，产品代码尚未修改。本包用于把总计划落到"工程师/Agent 可直接逐任务开工"的粒度。
> **适用基线**：master = 90c2152；规划的代码快照 = feature/gesture-air-control-overhaul @ c73a872（含 55 项未提交改动）。实施必须从干净分支开始（S0-1）。

---

## 1. 本包是什么

本包把总计划的 9 个阶段拆成 9 份执行计划，每份包含：阶段目标与出口、前置/不变量、任务总表、逐任务执行步骤（文件/接口/测试/命令/验收/回滚）、阶段验证清单、相邻阶段接口、未决问题。

| 文件 | 阶段 | 任务 | 预估工期（单人） |
|---|---|---|---|
| [S0-baseline.md](./S0-baseline.md) | S0 止血与基线 | S0-1..S0-7 | 1-2 天 |
| [S1-data-playback.md](./S1-data-playback.md) | S1 数据与播放正确性 | S1-1..S1-10 | 1.5-2 周 |
| [S2-audio-persistence.md](./S2-audio-persistence.md) | S2 音频图与持久化性能 | S2-1..S2-6 | 1 周 |
| [S3-shell-subscriptions.md](./S3-shell-subscriptions.md) | S3 应用外壳与订阅治理 | S3-1..S3-10 | 1-1.5 周 |
| [S4-bundle-loading.md](./S4-bundle-loading.md) | S4 包体与加载 | S4-1..S4-7 | 1 周 |
| [S5-render-runtime.md](./S5-render-runtime.md) | S5 渲染运行时与效果契约 | S5-1..S5-7 | 1.5-2 周 |
| [S6-state-architecture.md](./S6-state-architecture.md) | S6 状态架构收敛 | S6-1..S6-12 | 2-3 周 |
| [S7-platform-runtime.md](./S7-platform-runtime.md) | S7 服务与平台边界 | S7-1..S7-9 | 2 周 |
| [S8-quality-governance.md](./S8-quality-governance.md) | S8 门禁与长期治理 | S8-1..S8-6 | 持续 |
| [TRACKING.md](./TRACKING.md) | 进度看板 | 全部 74 项 | — |
| [00-decisions.md](./00-decisions.md) | 决策记录（D1-D8）+ 执行期确认 Q01-Q23 | 8 + 23 项 | — |

### 1.1 实际产出与规模（2026-10-21）

- 9 份阶段计划合计约 4,580 行；加 README/TRACKING/决策记录共约 5,300 行。
- 74 个逻辑任务拆成 **约 129 个执行子 PR**（S0 10、S1 15、S2 6、S3 12、S4 10、S5 17、S6 28、S7 19、S8 ~12），每个子 PR ≤400 行；同一任务的子 PR 可在阶段收口时 squash 为逻辑 PR。
- 每份阶段计划含 7-8 节（元信息/目标与出口/前置与不变量/任务总表/逐任务步骤/阶段验证/接口/未决问题）；S0/S1 将元信息并入目标节。
- 状态：**规划完成，产品代码未修改**；D1-D8 与 Q01-Q23 待确认；实施从 S0-1 开始。
- 已知修订（相对总计划）：S4 复核发现 Google Fonts preconnect 非死代码、V8 组件树零引用但 store 有 5 处引用；S4 预算缺口约 29KB（Q10）；S6-9a 前置到 S6-5；S7 子 PR 上浮到 19 个。详见 [00-decisions.md](./00-decisions.md) 的修订汇总。

---

## 2. 如何使用本包

1. **先读总计划**（问题诊断、目标架构、预算/验收），再读对应阶段计划。
2. **按 S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 顺序推进**；S6 可与 S5 并行（文件集合不相交），S7 依赖 S2/S3 完成。
3. **每个任务从 TRACKING.md 领取**：认领 → 在独立 worktree/分支实现 → 按阶段计划中的 Step 执行 → 跑测试/验证命令 → 提 PR（≤400 行）→ Lead/Reviewer 复核 → 合入 → 更新 TRACKING 与证据。
4. **阶段出口必须先满足**再进入下一阶段；未达标项记录原因并降级为下一阶段债务，不允许静默跳过。

---

## 3. 全局执行原则

| # | 原则 | 说明 |
|---|---|---|
| P1 | 正确性优先于性能 | S0/S1 未闭环前，不做 S5 渲染重写或 S6 大规模迁移 |
| P2 | 数据格式是硬约束 | 不重命名/删除现有 44 个 persist key 与 IndexedDB 字段；改结构必须 version+1 + migrate + 旧 fixture 测试；旧 key 保留一个版本 |
| P3 | 受保护视图 | Home View / Player View / 全屏歌词的视觉与交互不变；仅允许 D7 授权的"订阅方式等价改写"，改前截图、改后对比 |
| P4 | 小步可回滚 | 每 PR ≤400 行（测试/文档不计）；每 PR 独立可 revert；数据迁移与删除旧 key 分开 |
| P5 | 单一事实源 | 每个事实一个可写 owner；其它位置只能 selector 派生或单向只读投影 |
| P6 | 先测量后优化 | 每个性能任务必须有 before/after 与固定场景；没有测量的"优化"不得合并 |
| P7 | 验证顺序固定 | eslint → vitest → tsc --noEmit → build → clean-port/dev → HTTP smoke → 专项（CDP/Electron）；禁止并行 build 与 tsc；禁止在 dev 存活时 clean .next |
| P8 | 不扩大范围 | 不做一次性目录大迁移，不换技术栈，不引入重型依赖；新依赖单独评审 |

---

## 4. 角色、并行与写作用域

### 4.1 角色

| 角色 | 职责 |
|---|---|
| Lead / Integrator | 拆任务、守门禁、复核 diff、维护 TRACKING/决策、处理跨轨冲突、最终验收 |
| Implementer（人或 Agent） | 按阶段计划实现 + 测试 + 证据；每 PR 只碰自己的写作用域 |
| Reviewer | 独立复核：行为等价性、数据兼容、测试有效性、性能证据；至少 1 人 |

### 4.2 并行轨道（最多 3 条同时写 + 1 Lead）

| 轨道 | 写作用域 | 可承接阶段 |
|---|---|---|
| A 状态/持久化 | src/store/**、src/lib/storage/**、src/store/selectors/** | S1-1/2/3、S6-2/3/6/7/8 |
| B 播放/音频 | src/lib/playback/**、src/lib/audio/**、src/hooks/useAudioPlayer.ts、src/services/**（播放相关） | S1-5..S1-9、S2、S7-1/2/3 |
| C 渲染/UI | src/runtime/**、src/components/**、next.config.js、src/app/page.tsx | S3、S4、S5 |

共享文件（package.json、next.config.js、eslint 配置、uiStore、page.tsx、PanelOrchestrator）同一时间只允许一个 owner；跨轨改动必须由 Lead 排期串行。

### 4.3 工作方式

1. 从 master 建独立 worktree/分支：feature/arch-perf-sX-<task>（不要在主工作区直接做，主工作区保留用户 55 项脏改）。
2. 每日节奏：领取 1-2 个任务 → 实现 + 自测 → npm run verify:fast（S0-6 后可用）→ 提 PR（模板含任务 ID、写作用域、验收证据）→ Reviewer/Lead 复核 → 合入 → 更新 TRACKING。
3. 每阶段结束：跑阶段验证清单 + 出口指标复测 → 打阶段 tag（如 arch-perf-s1）→ 更新总计划/CHANGELOG/ROADMAP。
4. 每个 PR 证据：变更文件、命令与退出码、关键日志、指标 before/after、未执行项、回滚方式。

---

## 5. 里程碑与排期

### 5.1 单人时间线（10-12 周）

| 周 | 阶段 | 里程碑 | 出口摘要 |
|---|---|---|---|
| W1 | S0 + S1 启动 | M0 | CI 在 master 绿；基线 JSON；文档纠偏；ADR 定稿；脏改已处理 |
| W2 | S1 | M1 | 数据/备份/本地音源/队列/媒体桥全闭环；集成测试绿 |
| W3 | S1 收尾 + S2 | M2 | 单入口混音/写盘 ≤1/s/节点不泄漏；听感 A/B 通过 |
| W4 | S3 | M3 | 整店订阅 0；idle rAF ≤1；面板可回收；包体不退化 |
| W5 | S4 | M4 | rootMain gzip ≤190KB；首屏 script ≤12；V8 按 D1 处置 |
| W6-W7 | S5 | M5 | VisualRuntime 上线；rAF ≤8；1080p ≥90fps 无 dropped |
| W8-W9 | S6 | M6 | 44/44 key 注册；store 无环；audioStore <400 行；重复事实 0 |
| W10 | S7 | M7 | 桌面本地运行时闭环；在线能力/降级；插件隔离；2h soak 达标 |
| W11 | S8 | M8 | CI 完整门禁；覆盖率/包体/性能回归生效；发布清单演练 |
| W12 | 缓冲/发布 | — | 未达标项清单；发布评审 |

### 5.2 2-3 人并行（5-6 周）

- W1：S0（Lead）+ S1 数据轨 + S1 播放轨并行。
- W2：S1 收尾 + S2 音频轨 + S3 外壳轨。
- W3：S3 收尾 + S4 包体轨 + S6-1/S6-2 持久化轨启动。
- W4：S4/S5 渲染轨 + S6 状态轨并行（文件不相交）。
- W5：S5 收尾 + S6 收尾 + S7 平台轨启动。
- W6：S7 收尾 + S8 门禁收尾 + 全量回归。

### 5.3 20% 缓冲

每阶段预留 20% 时间处理：数据迁移意外、测试不稳定、桌面打包差异、V7 保护视图回归。缓冲耗尽即上报 Lead 调整范围，不允许压缩验证。

---

## 6. 全局依赖图

    S0 ──┬─> S1 ──> S2 ──┬─> S3 ──> S4 ──> S5
         │               │
         ├─> D1/D2/D7 ───┴─> S4-7（V8 处置，先复制契约）
         └─> S6-1（selector 门禁可在 S3 后启动）
    S1/S2/S3 内部任务可并行（写作用域不相交）
    S5 与 S6 可并行；S7 依赖 S2/S3；S8 从 S0 起持续

**关键路径**：S0 → S1 → S2 → S3 → S4 → S5。任何关键路径任务延期，优先砍 S6/S7 中的非 P0 子项，而不是压缩 S1-S3 的验证。

---

## 7. 质量门禁（每 PR / 每阶段）

### 7.1 每 PR

- [ ] 只改声明过的写作用域；无跨轨共享文件冲突。
- [ ] 新增/修改测试覆盖行为与边界；测试名可读。
- [ ] eslint/tsc/vitest 通过；不新增整店订阅、不新增白名单外 rAF、不新增裸 img（按阶段门禁）。
- [ ] 数据兼容：涉及持久化时附旧 JSON/旧备份 fixture 测试。
- [ ] 性能任务附 before/after 数据与测量命令。
- [ ] PR ≤400 行（测试/文档不计）；超过则拆分。

### 7.2 每阶段

- [ ] 阶段出口指标全部复测（固定场景、样本数、环境记录）。
- [ ] V7 保护界面截图/人工对照通过。
- [ ] 全量验证：npm run verify:ci（S0-6/S8-1 后）或等价手工顺序。
- [ ] 文档更新：阶段计划勾选、总计划进度、CHANGELOG、INDEX。
- [ ] 回滚演练：至少验证一个功能开关或 revert 路径。
- [ ] 未执行项（真机/听感/打包/4K）明确记录，不写成已完成。

---

## 8. 进度与证据管理

- **TRACKING.md** 是唯一进度事实源：任务级 checkbox + 子 PR + 状态 + owner + 验收证据链接。
- 状态流转：pending → in_progress → review → done / blocked（blocked 必须写原因与解锁条件）。
- 每个阶段结束生成一个阶段证据文件，放在 docs/nbl/plans/2026-10-21-arch-perf-execution/evidence/ 目录（文件名 Sx-evidence.md），包含：命令/退出码/日志摘要/指标 before-after/截图/未执行项。
- 计划变更：任务范围/顺序/验收变化必须走 00-decisions.md 或阶段计划修订，不允许口头变更。

---

## 9. 决策门（D1-D8）

见 [00-decisions.md](./00-decisions.md)。未拍板前按推荐默认值执行；D1/D2/D7 阻塞 S4-7/S7-4/S3-2 的具体方案，必须在对应阶段启动前确认。执行期另有 Q01-Q23 授权/依赖/预算/体验确认项，其中 Q01/Q02/Q04/Q05/Q07/Q10 为关键阻塞项。

---

## 10. "完成所有任务"的判定（Definition of Done）

程序完成需同时满足：

1. TRACKING.md 中 74 个任务全部 done（S8-6 为长期项，允许以"已排期+触发条件"收口）。
2. S0-S8 阶段出口指标全部达标；未达标项有书面豁免与后续计划。
3. 正确性验收（总计划 §9.2）全部通过；数据迁移有旧格式 fixture 证据。
4. 性能验收（总计划 §9.3）全部达标；预算硬阈值不被突破。
5. 桌面验收（总计划 §9.4）通过或明确降级并记录。
6. 质量门禁（总计划 §9.5）在 CI 生效并连续 4 周无回归。
7. 文档事实一致：ARCHITECTURE/AGENTS/ROADMAP/CHANGELOG/INDEX 与代码/脚本输出一致。
8. 回滚与发布清单完成演练；无未解释的失败测试/未记录风险。

---

## 11. 快速开始（前 3 天）

### Day 1（S0）
1. S0-1：与用户确认 55 项手势改动处理方式（commit checkpoint / 拆 PR / 冻结 worktree）——**需授权**。
2. S0-2：CI 触发改 master，加 tsc/lint/test/build（先 report-only 再 required）。
3. S0-3：构建产物与端口明确化；桌面发布暂冻结或 build:static。
4. S0-4：文档事实修正（AGENTS/ARCHITECTURE/ROADMAP/PR 模板/phase1）。
5. S0-5：coordinator 标 deprecated + 死文件/卫生。
6. S0-6：测量基座 v1（bundle/stat/measure.py/docs-facts）。
7. S0-7：ADR D1-D8 评审。

### Day 2（S1 启动）
1. S1-1 storageRegistry v1（44 key 清单 + 一致性测试）。
2. S1-3 启动压缩/配额修复（最高数据风险）。
3. S1-4 VibeMusicDB 统一 open（本地音源不可播 P0）。

### Day 3（S1 并行）
1. S1-2 备份恢复修复（依赖 S1-1）。
2. S1-5 队列唯一权威 + QueueNavigator。
3. S1-6 PlaybackMediaBridge（播放监听 P0）。

---

## 12. 非目标与不变量（再次强调）

- 不重写框架/播放器/渲染引擎；不做一次性目录迁移；不引入重型依赖。
- 不修改 V7 核心界面视觉与交互（D7 授权除外）。
- 不破坏 44 个 persist key、备份 envelope、IndexedDB 现有字段。
- 不在 master 上直接开发功能；不从 55 项脏改直接开始重构。
- 不把"测试通过"当作用户体验验收；真机/听感/摄像头/打包各自记录。

---

## 13. 计划包状态与后续动作

| 项 | 状态 | 说明 |
|---|---|---|
| 9 份阶段执行计划 | Done | 2026-10-21 交付；均含任务表/逐任务步骤/测试/验收/回滚 |
| README / TRACKING / 决策记录 | Done | 使用方式、进度看板、D1-D8 + Q01-Q23 |
| 产品代码 | 未修改 | 本轮仅规划；git 工作树保持 55 项手势改动 + 文档新增 |
| 实施前置 | 待用户 | Q01 脏改授权、Q02 branch protection、Q04 devDeps、Q05 新增 key、Q07 旧 key 删除、Q10 S4 预算 |
| 下一步 | 建议 | ① 确认 Q01/Q02/Q04/Q05/Q07/Q10；② 批准 S0 开工；③ 按 TRACKING 领取 S0-2..S0-7 |

> 本包不代表任何任务已完成实现；完成所有任务的判定见 §10。
