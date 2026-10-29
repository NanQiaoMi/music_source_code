# 决策记录（D1-D8）— 2026-10-21

> 上级：[架构与性能优化总计划](../2026-10-21-architecture-performance-optimization.md) §8
> 用法：每个决策由用户在阶段启动前拍板；未拍板时按"推荐"默认值执行，并在 TRACKING 中标注假设。拍板后把状态改为 Accepted 并记录日期/决策人/影响任务。需要正式 ADR 的（D1/D2）另建 docs/nbl/adr/000x-\*.md。
> **2026-10-29 收口**：D1 Accepted/Decided、D7 Accepted、D2/D8 Deferred；Q22 工单清理与 store-stats 基线重建获批准；6 项验收偏差一次性接受（见文末「2026-10-29 用户批准记录」）。ADR 现状：0001/0005 Accepted，0002/0008 Proposed（Deferred），0003/0004/0006/0007 Proposed。
> **2026-10-30 最终收口**：用户「继续完成所有」授权 → S7-4..S7-8 记 **done-with-deviation**（D2 无代码延期）、S8-3 记 **done-with-deviation**（4 周时间门自 2026-10-30 累积）、合计 **74/74**；详见文末「2026-10-30 用户授权收口记录」。

---

## 决策流程

1. 提出：任务受阻或存在方案分叉时，在本文追加决策项（ID 递增）。
2. 评估：至少列出 2 个选项、影响面、风险、回滚方式、推荐项。
3. 拍板：用户/产品负责人确认；Lead 记录 Accepted/Rejected 与日期。
4. 执行：更新受影响阶段计划与 TRACKING 的依赖/范围。
5. 复盘：实现后回填实际结果（若与预期不符，追加 Superseded 记录）。

---

## 决策状态总览

| ID  | 决策                                | 推荐                          | 状态                                                                                                                        | 阻塞任务        | 截止      |
| --- | ----------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------- | --------- |
| D1  | V8 可视化（11,355 行、零引用）处置  | C：冻结→复制契约→删除实现     | **Accepted 2026-10-29（Decided）**：保留 `archive/visualization-v8/` + legacy key `visualization-v8-store`，不删实现/不接线 | S4-7、S5-4      | S4 启动前 |
| D2  | Windows 桌面运行时形态              | B：捆绑本地 Next 运行时       | **Deferred 2026-10-29**（用户暂缓；桌面发布继续冻结）                                                                       | S0-3、S7-4/5/6  | S0 启动前 |
| D3  | DSPProcessor/AudioGraphManager 去留 | A：标 deprecated 后删除       | Pending                                                                                                                     | S2-5、S6-9      | S2 启动前 |
| D4  | 备份是否包含音频二进制              | A：默认不含，另立完整导出计划 | Pending                                                                                                                     | S1-2、S6-2      | S1 启动前 |
| D5  | 最低配置与质量档位                  | low=4核/8GB/1080p 集显        | Pending（代码按默认实现，ADR 0007 待追认）                                                                                  | S5-6            | S5 启动前 |
| D6  | 主题 owner                          | A：新建 themeStore            | Pending（代码按 A 实现，ADR 0006 待追认）                                                                                   | S6-6/S6-7       | S6 启动前 |
| D7  | 受保护视图是否允许订阅方式等价改写  | A：允许，截图对比+Lead 复核   | **Accepted 2026-10-29**（视觉基线按单一分辨率 1440x900 接受）                                                               | S3-2/S3-3、S5-2 | S3 启动前 |
| D8  | 第三方解析源/平台 cookie 产品边界   | A：明示第三方源+用户确认      | **Deferred 2026-10-29**（S7-8 不启动）                                                                                      | S7-8            | S7 启动前 |

---

## D1 — V8 可视化处置

- **背景**：src/components/visualization-v8（38 非测试文件 / 11,355 行、7 测试文件）在 src 全仓仅自身与自身测试引用；实际挂载的是 V7（src/app/page.tsx:29-32,133-135）。V8 的 RenderEngineManager 生命周期设计正确（DPR/resize/contextlost/FPS 降档），但系统未接线。
- **选项**：
  - A 直接删除：净 -12k 行，维护性最好；不减少首屏包体（webpack 不打包未引用代码）；失去 28 效果储备。
  - B 完成接线：产品可获得 28+ 效果与更完整引擎；成本高（需重测视觉/性能/交互），且 V7 的 14 效果已承载当前体验。
  - C 冻结 V8 → 先把 EffectPlugin/RenderEngineManager 契约移植到 src/runtime/ → 再删除 V8 实现（推荐）。
- **推荐**：C。收益是长期维护性与可插拔效果契约，风险最低；若产品明确需要 28 效果，再在 S8 评估 B。
- **2026-10-29 用户决定（D1 = Accepted / Decided；不选 A/B/C 的删除路径）**：**保留** `archive/visualization-v8/`（47 文件 / 12,304 行，由 `1e7ffbc` 于 2026-10-27 归档）与 legacy persist key `visualization-v8-store`（`src/lib/storage/storageRegistry.ts` 的 EXTERNAL_KEYS 保留，不删除/不改名）；**不删除** V8 实现、**不接线**。7b 死代码清理已于 2026-10-29 完成（4 文件 / 571 行）；EffectPlugin 契约已由 S5-4 落到 `src/runtime/effectPlugin.ts` + `effectRegistry.ts`（2/14 试点），RenderEngineManager 不再移植。
- **影响**：S4-7（按"保留归档 + 清理死代码"收口）、S5-4（契约来源，已完成）、文档 ARCHITECTURE/AGENTS。
- **验收（2026-10-29 口径）**：`src/components/visualization-v8` 组件树 = 0（目录已不在 src）；legacy key 保留 1 处（D1 批准，E4-9 的"rg=0"按偏差豁免）；V7 代码未改动；tsc/vitest 绿。

## D2 — Windows 桌面运行时形态

- **背景**：build 默认不产 out/（next.config.js:3 仅在 STATIC\*EXPORT=1 时 export，全仓无设置），但 electron/main/index.js:36,197-202 从 out/ 加载 app://app/，package.json:92-97 只打包 out/\*\*；渲染层 /api/\_ 走 location.origin（MultiSourceResolver.ts:227-231）→ 当前桌面包会发陈旧前端且在线能力失效。前置审计/设计已确认方向：Windows 桌面捆绑本地 Next 运行时，并保留 app:// origin 以避免 44 个 key/IndexedDB 迁移。
- **选项**：
  - A 静态导出 out/ + 在线能力降级（最快止血，但桌面在线音乐不可用）。
  - B 捆绑本地 Next standalone 运行时 + app:// 协议桥接 + BackendGateway（推荐，符合前置决策）。
  - C 桌面仅本地播放器（放弃在线能力，产品范围缩小）。
- **推荐**：B。S0-3 先阻断陈旧 out 发布；S7-4 做 standalone/协议桥接 spike，验证通过再替换打包链路。
- **2026-10-29 用户决定：Deferred（暂缓，未批准）**。桌面发布保持冻结（`npm run build:electron*` 的 `verify-desktop-release-ready` 仍 fail-fast），S7-4..S7-8 不启动，S0-3 的 out/ 不回填。恢复讨论时仍以 B 为唯一保留在线能力的路径。
- **2026-10-21 新证据**：STATIC_EXPORT=1 next build 实测失败（/api/audio/proxy、/api/kugou/login/status 等 31 个 API route 与 output: export 不兼容）→ 选项 A（静态导出）不可行，B 是唯一保留在线能力的路径；S0-3 已加 desktop release guard（默认冻结）。
- **影响**：S0-3、S7-4/5/6、API 归属（Next vs FastAPI）。
- **验收**：打包 --dir 冷启动窗口 <3s；/ 与 /data-manager 200；旧 origin 数据可见；在线搜索/解析/歌词/封面可用或明确降级。

## D3 — DSPProcessor / AudioGraphManager 去留

- **背景**：DSPProcessor.ts（452 行）与 AudioGraphManager.ts（300 行）未接入播放主链（仅自身/测试引用，见 runtime-audio-audit P2-1）；ARCHITECTURE 宣称的 DSP 链并非现状。
- **选项**：A 标 deprecated 一个版本后删除；B 真正接入（需产品确认压缩/混响/失真需求）。
- **推荐**：A。当前 30-band EQ + 17 effects 已覆盖主要能力；若后续需要扩展再另立接入计划。
- **影响**：S2-5（图生命周期收尾）、S6-9（用例层清理）、文档。
- **验收**：删除后无引用（rg=0）；tsc/vitest/build 绿；听感 A/B 无差异。

## D4 — 备份是否包含音频二进制

- **背景**：backupRestoreStore 当前只备份 localStorage 10 个槽位（其中 5 个 key 错配），IndexedDB 中的本地音频二进制未纳入；备份正文存 localStorage（backup-data-\* key 泄漏）。
- **选项**：A 默认仅设置+元数据（推荐）；B 含 IndexedDB 音频文件（体积/耗时/恢复事务复杂，另立"完整导出"计划）。
- **推荐**：A。先修正确性与恢复闭环；B 作为后续可选能力，明确体积预算、取消、断点续传与存储配额。
- **影响**：S1-2、S6-2、BackupRestorePanel UI 文案。
- **验收**：备份→恢复→重载闭环测试；includedStores 与实际 key 一致；旧备份可导入。

## D5 — 最低配置与质量档位

- **背景**：可视化/3D/glass 效果需要质量档位与降级策略；当前无统一档位（visualSettings.visualMode 与 performanceV8Store.activePreset 两套）。
- **推荐**：low=4 核/8GB/1080p 集显（默认 DPR 1、粒子减半、关闭全屏 canvas filter）；medium=8 核/16GB（DPR ≤1.5）；high=独显（保持现状）。可用 deviceMemory/hardwareConcurrency/longtask 自动判定。
- **影响**：S5-6、S6-8（性能档合并）、S8-3（场景矩阵）。
- **验收**：4x CPU throttle 自动降档；1080p 主场景 ≥90fps 无 dropped；降档行为有日志与 UI 可观察。

## D6 — 主题 owner

- **背景**：主题状态有 3 条来源（uiStore.themeColors/themeMode/isDynamicTheme、visualSettingsStore.currentTheme 等、CSS 变量），且 layout.tsx:20 固定 dark；切换时可能多写/闪烁。
- **选项**：A 新建 themeStore（推荐）；B uiStore 独占，visualSettingsStore 只留视觉参数。
- **推荐**：A。语义清晰、可单测；迁移约 ±150 行。
- **影响**：S6-6/S6-7、S3-2（theme 订阅）。
- **验收**：主题来源唯一；切歌/切换主题不闪；旧 visual-settings-v4 主题字段迁移后删除。

## D7 — 受保护视图是否允许"仅订阅方式"的等价改写

- **背景**：PROCESS.md 禁止修改 Home View / Player View / 全屏歌词；但 S3-2（page/壳 selector 化）需要改这些文件的订阅行，S5-2 需要改 VisualizationView 调度（不属于三大保护视图，但属视觉核心）。
- **选项**：A 允许"仅订阅方式/调度门控"的等价改写（不改 JSX 结构、样式、交互），需截图对比 + Lead 复核（推荐）；B 完全禁止，只能通过 wrapper 间接优化（收益大幅下降）。
- **推荐**：A。把"技术性无行为变化"的白名单写进 PR 模板；改前/改后截图 + Profiler 证据。
- **2026-10-29 用户决定（D7 = Accepted）**：批准"仅订阅方式/调度门控"的等价改写；视觉基线按**单一分辨率 1440x900 @1x** 接受（Home / Player / 全屏歌词 3 张截图 + manifest，`evidence/screenshots/s3-2/`），计划原 1280x720/1920x1080/2560x1440 的改前/改后 pixel diff ≤0.1% **豁免**。
- **影响**：S3-2/S3-3、S5-2。
- **验收（2026-10-29 口径）**：单分辨率截图 + 交互与基线一致；diff 只含订阅/门控行。

## D8 — 第三方解析源与平台登录 cookie 的边界

- **背景**：sourceConfigStore 内置第三方解析源配置；userAccountStore 明文持久化 5 个平台 cookie（netease/qq/kugou/kuwo/qishui）。属于产品/合规风险。
- **选项**：A 明示"第三方源"并让用户确认；桌面用 safeStorage 加密凭据；Web 明示"仅本地"（推荐）。B 只保留官方/授权源。C 现状不改，仅加提示。
- **推荐**：A。S7-8 实现凭据加密与提示；源配置与内置源分离；UI 增加风险说明。
- **2026-10-29 用户决定：Deferred（暂缓，未批准）**。第三方源/cookie 边界未拍板，S7-8 保持未启动（ADR 0008 保持 Proposed 并标注 Deferred）。
- **影响**：S7-8、SourceManagementModal/AccountCenter、文档与合规说明。
- **验收**：桌面 cookie 不再明文；旧数据可读并迁移；用户可见风险提示。

---

## 决策记录模板（追加新决策时复制）

    ## Dx — <标题>
    - 背景：
    - 选项：A ...；B ...；C ...
    - 推荐：
    - 影响任务：
    - 决策人/日期：
    - 状态：Pending / Accepted / Rejected / Superseded
    - 验收：

---

## 状态更新（2026-10-21，9 份阶段执行计划完成后）

阶段计划编写过程中形成以下默认假设（可被用户后续否决并回退）；**2026-10-29 收口后 D1/D7 已 Accepted、D2/D8 Deferred，下表保留为历史默认记录**：

| 决策 | 阶段计划采用的默认                                                                                                              | 依据                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| D2   | S0-3 采用"桌面发布冻结 + 构建 fail-fast 检查 out 新鲜度"，不在 S0 承诺 build:static；S7-4 再做本地 Next standalone 运行时 spike | S0/S7 计划；D2 仍 Pending  |
| D4   | S1-2 按 A：备份仅设置+元数据，不含 IndexedDB 音频                                                                               | S1 计划；D4 仍 Pending     |
| D5   | S5-6 按 low=4核/8GB/1080p 集显默认档实现                                                                                        | S5 计划                    |
| D6   | S6-7 新建 themeStore（D6-A）                                                                                                    | S6 计划                    |
| D7   | S3-2/S3-3/S5-2 按"仅订阅/调度等价改写 + 截图/Profiler 证据"推进                                                                 | S3/S5 计划；需用户最终授权 |
| D8   | S7-7/S7-8 按 A（第三方源明示+用户确认，凭据加密）                                                                               | S7 计划                    |
| D1   | S4-7 按 C：先把 EffectPlugin/RenderEngineManager 契约移植到 runtime/，再删除 V8 实现；同时重定向 5 处 store 引用                | S4 计划；见下方修正        |

---

## 执行期待确认项（Q 系列）

> 这些项不阻塞计划编写，但会阻塞具体实现。默认可按"推荐默认"执行；涉及权限/依赖/预算/产品体验的项需用户或 Lead 明确。完成确认后把状态改为 Accepted 并记录日期。

| ID  | 问题                                                                                                                | 推荐默认                                                               | 阻塞任务                    | 需谁确认        | 状态                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q01 | 55 项手势改动如何处置（checkpoint / 拆 PR / 冻结 worktree）                                                         | checkpoint 保现场，再按模块拆 PR 合 master                             | S0-1 及全部基线             | 用户授权        | **Accepted 2026-10-27：A（checkpoint）** — 分支 checkpoint/gesture-air-control-overhaul-20261027 @ 2b99173（123 files / +27,294/−1,967）；未 push；主工作区已干净                                                                                     |
| Q02 | GitHub branch protection / required checks / bot PAT 是否可用                                                       | 可用则开 required checks；不可用则 CI 先 report-only                   | S0-2、S8-1                  | 用户/仓库 owner | Pending                                                                                                                                                                                                                                               |
| Q03 | deploy.yml 中 Vercel 发布 job 去留                                                                                  | 保留手动触发；移除 main 条件；归属由发布策略定                         | S0-2、S8-5                  | 用户/Lead       | Pending                                                                                                                                                                                                                                               |
| Q04 | 新增 devDependency：fake-indexeddb（S1-4 测试）、dependency-cruiser（S6-12）、actionlint（S8 可选）                 | 批准（dev-only，不影响运行时/包体）                                    | S1-4、S6-12、S8-1           | Lead            | Pending                                                                                                                                                                                                                                               |
| Q05 | 允许新增 persist key：theme-store-v1、quality-store-v1（44→46）                                                     | 允许新增；旧 key 保留一版；同步 S1-2 备份与文档计数                    | S6-7、S6-8、S1-2            | Lead/用户       | Pending                                                                                                                                                                                                                                               |
| Q06 | audioStore 迁移终点：改名 audioSettingsStore vs 保留名只留设置                                                      | 保留名（减少 104 个 import 改动），S8 再评估改名                       | S6-5、S6-9                  | Lead            | Pending                                                                                                                                                                                                                                               |
| Q07 | 旧 key/字段删除窗口 + 删除 src/store/coordinator/ 的 AGENTS 例外                                                    | 迁移合入后下一个 minor 删除；coordinator 标 deprecated 一版后删除      | S6-2/3/7/9c                 | 用户/Lead       | Pending                                                                                                                                                                                                                                               |
| Q08 | storageRegistry 是否接管非 zustand 裸 key（mimimusic_active_view、mimimusic_offline_downloads 等）                  | 纳入 registry 但标 external:true，不接管读写                           | S6-2                        | Lead            | Pending                                                                                                                                                                                                                                               |
| Q09 | V8 的 5 处 store 引用处置（导航岛 2 动作、aiAgentTools 1 处写入、performanceV8Store 被 V7 3 文件使用）              | 导航岛/AI 写入重定向到 V7；performanceV8Store 保留并并入 qualityStore  | S4-7、S6-8                  | 用户/Lead       | Pending                                                                                                                                                                                                                                               |
| Q10 | S4 预算缺口：按实测推算 S4 后 rootMain gzip ≈219KB，距 190KB 约 29KB                                                | 先做 S4-3b 泄漏治理；缺口 ≤10KB 可重定基线（≤200KB），>10KB 需用户批准 | S4-3、S4 出口 M4            | 用户/Lead       | **Accepted 2026-10-29：接受 S4-3b 实测 211.0KB（≤230 hardMax）为当前基线，190KB target 豁免（缺口 21KB）**                                                                                                                                            |
| Q11 | dev-only 测量路由（/dev/viz-harness）是否允许入库；measure.py 修改归属                                              | 允许 dev-only+生产 404；measure.py 由 S5-1b 独占修改，S0-6 只入库脚本  | S5-1b/S5-2b、S0-6           | Lead            | Pending                                                                                                                                                                                                                                               |
| Q12 | 音量修复后约 +3dB、效果更明显是否接受为修复；17 效果参数曲线听审                                                    | 接受并在 Changelog 说明；PR 前完成 17 效果试听                         | S2-1、S2-2                  | 用户/产品       | Pending                                                                                                                                                                                                                                               |
| Q13 | 播放进度检查点存储：sessionStorage（刷新恢复、关闭即清）vs localStorage                                             | sessionStorage 默认；跨会话恢复另立 key+预算                           | S2-4                        | Lead            | Pending                                                                                                                                                                                                                                               |
| Q14 | 面板 keepAlive 默认档（never 面板重开 1-2s）                                                                        | never 必须有骨架屏且重开 ≤300ms，否则放宽 lru                          | S3-6                        | 用户/产品       | Pending                                                                                                                                                                                                                                               |
| Q15 | toast 单宿主放 layout 级（/data-manager 也可收）还是 page 级                                                        | layout 级，silent error boundary 一并迁移                              | S3-7                        | Lead            | Pending                                                                                                                                                                                                                                               |
| Q16 | 浮动层 hidden 停帧 vs 条件挂载                                                                                      | hidden + active 停帧，保留拖拽位置                                     | S3-5                        | 用户/产品       | Pending                                                                                                                                                                                                                                               |
| Q17 | 性能 runner 形态（自托管 Windows GPU / 本机手动 nightly）；soak 是否进 PR 门禁                                      | 本机手动 nightly 起步；soak 10min 进 PR、2h 每周                       | S8-3、S7-9                  | 用户/Lead       | Pending                                                                                                                                                                                                                                               |
| Q18 | electron-builder files 自定义后是否含 node_modules（pluginManager 依赖 axios/crypto-js；standalone server.js 依赖） | S7-4a 先 --dir 解包审计；缺依赖用 extraResources/asarUnpack            | S7-4                        | 平台 owner      | Pending                                                                                                                                                                                                                                               |
| Q19 | 自定义 app scheme 的 Cookie/重定向/SSE/背压语义                                                                     | 先按 S7 §6.2 验证；失败走 origin 迁移 ADR 或主进程代理                 | S7-4/S7-5/S7-6              | Lead/平台       | Pending                                                                                                                                                                                                                                               |
| Q20 | FFmpeg core 自托管体积（~30MB）、Electron AI 路径（FastAPI vs Next）、vm 残余风险                                   | FFmpeg 默认自托管；AI 默认"有 backend 用 backend"；vm 接受+ADR         | S7-3、S7-5、S7-7            | 用户/Lead       | Pending                                                                                                                                                                                                                                               |
| Q21 | 新增生产路由 /api/runtime/health（桌面健康探针）                                                                    | 允许，仅返回 pid/buildId 等非敏感字段                                  | S7-4                        | Lead            | Pending                                                                                                                                                                                                                                               |
| Q22 | worktree GC（27 个/5.19GB）、跟踪死文件、根目录垃圾清理授权                                                         | 先 dry-run 清单交用户确认；只删 clean 且非当前分支                     | S0-5、S8-6                  | 用户授权        | **Accepted 2026-10-29（cleanup 已执行）**：worktree 19→9（删 10 个 clean，7 个 dirty 保留，分支全部保留）；根目录 33→26（6 个散落图片归档至 `docs/nbl/archive/root-artifacts/`，删除生成的 `tsconfig.tsbuildinfo`）；悬空 ESLint coordinator 禁入已删 |
| Q23 | 文档/统计口径统一：44→46 key、PR 数（任务级 vs 子 PR）、模块数量                                                    | 以 S0-6 脚本输出为唯一口径；文档引用脚本生成数字                       | S0-4、S8-4                  | Lead            | Pending                                                                                                                                                                                                                                               |
| Q24 | store-stats 基线过期（60/44 vs 实测 62/43，`--check` exit 1）                                                       | 批准后用 `--json perf/store-stats-baseline.json` 重建，不放宽比较项    | S0-6、S6-12b、CI store gate | 用户授权        | **Accepted 2026-10-29：已重建 62 stores / 43 persist keys / whole 0 / edges 23 / SCC 0；`--check` exit 0**                                                                                                                                            |

---

## 2026-10-29 用户批准记录（决策收口）

> 批准人：用户 · 记录：Lead / DSH agent · 证据：本文件 + [TRACKING.md](./TRACKING.md) 变更记录 + [evidence/S0-evidence.md](./evidence/S0-evidence.md) §8

| 项              | 用户决定                                                                                                     | 落地动作                                                                                                                                                                                          | 日期       |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D1              | **Decided（Accepted）**：保留 `archive/visualization-v8/` 与 legacy key `visualization-v8-store`，不删除实现 | S4-7 done（7a 保留归档/key + 7b 已删 4 文件 / 571 行，契约由 S5-4 承接）；ADR 0001 → Accepted；E4-9 "rg=0" 按偏差豁免                                                                             | 2026-10-29 |
| D2              | **Deferred**（暂缓，未批准）                                                                                 | 桌面发布继续冻结（`verify-desktop-release-ready` fail-fast）；S7-4..S7-8 不启动；ADR 0002 保持 Proposed                                                                                           | 2026-10-29 |
| D7              | **Accepted**：允许"仅订阅/调度"等价改写；视觉基线按**单一分辨率 1440x900 @1x** 接受                          | ADR 0005 → Accepted；S3-2 偏差记录；4 档 pixel diff 豁免                                                                                                                                          | 2026-10-29 |
| D8              | **Deferred**（暂缓，未批准）                                                                                 | S7-8 不启动；ADR 0008 保持 Proposed（Deferred）                                                                                                                                                   | 2026-10-29 |
| Q22             | **Approved cleanup**                                                                                         | worktree 19→9（删 10 个 clean，7 个 dirty 保留，分支全部保留）；根目录 33→26；悬空 ESLint coordinator 禁入已删                                                                                    | 2026-10-29 |
| 基线重建（Q24） | **Approved**                                                                                                 | `perf/store-stats-baseline.json` 重建为 62 stores / 43 persist keys / whole 0 / edges 23 / SCC 0；`--check` exit 0（未削弱 stores 相等、whole/edges 不增、persist 不减、registry 全覆盖的比较项） | 2026-10-29 |

### 已接受的验收偏差（2026-10-29）

| ID             | 计划目标                     | 实测 / 现状                                                                              | 用户裁定                                                  | 影响          |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------- |
| M4 包体（Q10） | rootMain gzip ≤190KB         | **211.0KB**（S4-3b，缺口 21KB；hardMax 230 未破）                                        | 接受 211KB 为当前基线，190KB target 豁免                  | M4、Q10       |
| S2-4 写盘      | ≤0.4 写/秒                   | **1.00/s**（player-store + audio-store-v4 各 0.5/s，2s/key 节流边界；all-key 1.63/1.67） | 接受为节流边界，不改 5s 节流                              | S2-4、M2 / E4 |
| M5 rAF         | 调用点 ≤8                    | **usages 14 / entries 15**（`verify:raf`）                                               | 接受分阶段收敛，白名单保留                                | M5            |
| M6 store 图    | 运行时边 ≤6                  | **23**（SCC 0）                                                                          | 接受 23 为当前基线；version / 整店持久化缺口另记          | S6-9、M6      |
| S3-2 视觉      | 4 档分辨率 pixel diff ≤0.1%  | **仅 1440x900 @1x** 3 视图截图（Home / Player / 全屏歌词）                               | 接受单分辨率基线，改前/改后 diff 豁免                     | S3-2、D7      |
| S7-1 模块大小  | 每模块 ≤300 行；门面 ≤450 行 | **platforms.ts 371 行；MultiSourceResolver.ts 1,133 行**                                 | 模块大小目标豁免（裸 fetch 16→0、插件注册表、熔断已达成） | S7-1          |

> 未在本次批准范围、仍按缺口记录：M6 的 40 个 store 无 version / 5 个整店持久化；M1/M2/M7 的真机听感 A/B、devicechange/合盖、1080p ≥90fps、2h 浏览器 soak；S8-3 的 nightly 连续 4 周（blocked on CI）；S0-2 的 push / required checks。

---

## 2026-10-30 用户授权收口记录（最终，74/74）

> 用户 2026-10-30 明确指令「**继续完成所有**」，并沿用此前批准：D2 deferred、性能偏差接受、允许带偏差收口。以下是本次收口的正式记录；"done-with-deviation" = **透明延期**：任务在 TRACKING 勾选仅为关闭看板，不代表计划验收已执行。

| 项                       | 用户决定                                                                                                          | 落地与证据                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2（S7-4..S7-8）         | **defer accepted**：维持 Deferred，5 项任务记 done-with-deviation，**不交付任何桌面运行时代码**                   | TRACKING 每行写明未交付内容（standalone runtime / app:// 桥接 / BackendGateway / 异步后端 / utilityProcess 沙箱 / safeStorage）；M7 记 **accepted-deferral**、出口门不勾选；ADR 0002 保持 Proposed+Deferred；桌面发布继续冻结（`verify-desktop-release-ready` fail-fast）                                                                               |
| S8-3（性能回归套件）     | **time-gate deviation accepted**：自动化已完成且 CI 绿；4 周历史**无法压缩**，自 2026-10-30 起累积                | nightly 新增 commit-back（job 级 `contents: write`、`github-actions[bot]`、`persist-credentials`、`[skip ci]`）；`perf/perf-history.jsonl` 入库并 seed **1 行**（`5b40fc2`，2026-10-30T02:02+08:00，rootMain 208.4KB / first load 621.5KB / CSS 29.2KB / async 675.9KB / public 89.2MB）；M8 保持未勾选、记 **time-gate accruing**，≥28 行约 2026-11-27 |
| 性能偏差                 | **沿用 2026-10-29 已接受项**（M4 rootMain 211KB、S2-4 1.00/s、M5 rAF 14、M6 边 23、S3-2 单分辨率、S7-1 模块大小） | 不改代码、不改基线；本次实测 rootMain 208.4KB（-2.6KB，改善），但 **first-load 621.5KB vs baseline 607.2KB（+14.3KB > +10KB）为新偏差，未接受**，登记为风险：nightly 首跑预计在 diff 步骤判红，需评审后 `perf:bundle:diff -- --update` 或先瘦身                                                                                                         |
| done-with-deviation 口径 | 接受                                                                                                              | 每条任务在 TRACKING 写明「无代码交付 / 验收未执行 / 缺口」；计入 74/74 分子只为关闭看板，**不改变 M7/M8 出口门状态**                                                                                                                                                                                                                                    |

**不纳入本次批准（仍为缺口）**：M6 的 40 个 store 无 version / 5 个整店持久化；M1/M2/M7 的真机听感 A/B、devicechange/合盖、1080p ≥90fps、播放级 2h soak；S8-3 的「连续 4 周绿」（时间门）与 first-load baseline 偏差；R9/R10 发布演练缺口。

---

## 阶段计划对总计划的修订汇总（需回写总计划）

1. **S6 顺序修订**：拆出 S6-9a（domain 骨架 + playSong 用例）前置到 S6-5 之前；否则 audioStore→playlistStore SCC 无法消除（audioStore.ts:6,529-540）。
2. **S7 子 PR 数上浮**：S7 由总计划估计 9 PR/~2.8k 行调整为 19 个子 PR/~4.3k 行（≤400 行硬约束），S7 开工时修订总计划 §10.2。
3. **S4 预算缺口**：按实测推算 S4 后 rootMain gzip ≈219KB，与 190KB 目标差约 29KB；需 Q10 决策。
4. **审计 B 两处更正**（S4 复核）：
   - Google Fonts preconnect 不是死代码（globals.css:1 有 @import 真实加载 5 个字体族）；正确做法是迁到 link，而不是删除。
   - V8 不是"零引用"：VisualizationViewV8/组件树确实未接线，但 visualizationV8Store 被 AppleUnifiedNavIsland.tsx:36,151,168 与 aiAgentTools.ts:7,726 引用（当前为空操作）；performanceV8Store 被 V7 的 VisualSettings.tsx、NowPlayingHalo.tsx、PlayerSkinsPanel.tsx 使用。删除前必须重定向/保留。
5. **PR 计数口径**：总计划 §10.2 的"60-65 PR"是**逻辑 PR**估计；执行计划按 ≤400 行拆成约 129 个子 PR（S0 10、S1 15、S2 6、S3 12、S4 10、S5 17、S6 28、S7 19、S8 ~12）。同一任务的子 PR 可在阶段收口时 squash 为逻辑 PR。
