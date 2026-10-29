# Goal 状态与交接 — 架构与性能优化（74 任务）

> 分析基线：分支 `integration/s2-audio` @ `e6c46d8`（2026-10-29 21:44:24 +0800）；本文件提交在 `docs/goal-status`（父提交即该基线，未 push）
> 生成：2026-10-29 22:03 +08:00（Asia/Shanghai）· worktree `_worktrees/arch-integration-s1-5`
> 上级：[README.md](./README.md) · [TRACKING.md](./TRACKING.md) · [00-decisions.md](./00-decisions.md) · [总计划](../2026-10-21-architecture-performance-optimization.md)
> 口径：**实测** = 本文作者在本 worktree 运行并记录退出码/计数；**TRACKING** = 看板记录（本轮未复跑）；**[未验证]** = 无执行证据，不作为结论。
> 约束：docs-only 单提交；未 push；未合并 master；未修改产品代码；未触发真实 GitHub Actions。
> **2026-10-29 22:55 追记**：本文件的 6 项待决策（§6.1–§6.6）已在同日收口——D1 Accepted/Decided（保留 archive + legacy key）、D7 Accepted（单分辨率 1440x900 基线）、D2/D8 Deferred、Q22 清理执行（worktree 19→9、根文件 33→26）、store-stats 基线重建（62/43，`--check` exit 0）、6 项验收偏差接受；S0-7/S4-7/S6-9/S7-1 已 done，合计 60→64。以下 §1–§6 保留为 **22:03 快照**，最新口径以 `00-decisions.md`、`TRACKING.md`、`evidence/S0-evidence.md` §8 为准。

## 0. 结论摘要

- **进度 60/74（81.1%）**；9 个阶段全部 `in_progress`；**M0–M8 九个阶段出口门全部未关闭**（TRACKING 中 9 个 M 行均为未勾选）。
- 本轮 9 项必查（全量 vitest、tsc、eslint src `--max-warnings=0`、`perf:gates`、`verify:docs`、`verify:layers`、`check-store-budgets`、release preflight、git status）**全部 exit 0**；另加一次全新生产构建（exit 0，28 静态页）。
- **唯一红项**：`report-store-stats --check` exit 1（基线 60 stores / 44 keys，实测 62 / 43）——过期基线，需 `--update` 授权（6.6 节）。
- 剩余 14 个任务中：**8 个卡在用户决策/授权**（D1、D2、D7、D8、Q22、push、基线重建、验收偏差口径），其余卡在真实 CI / 真机 / 浏览器测量。
- 集成树是**单条超集**：102 个 `feature/arch-perf-*` 分支全部是 HEAD 祖先，无需逐分支合并；唯一未并入的架构文档分支是 `docs/architecture-performance-plan`（其 2 份前置文档在 HEAD 中缺失，见 4.2 节）。
- 集成分支**落后本地 master 11 个提交**（master 在手写歌词 MV 收尾上继续前进），合并前必须先同步（4.2 节步骤 1）。

## 1. 快照 Snapshot

### 1.1 分支与提交

| 项                        | 值                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------- |
| 当前分支                  | `integration/s2-audio`                                                                 |
| HEAD                      | `e6c46d8adc903f7568e29f6e138196a482e7c941`（短 `e6c46d8`）                             |
| HEAD 提交                 | `feat(s7-1): introduce resolver plugins and http client`，2026-10-29 21:44:24 +0800    |
| 相对本地 master           | ahead **237** / behind **11**（merge-base `02615a9`，master `90c2152`）                |
| 相对 origin/master        | origin/master `6a211e1`；本地 master 领先 origin **170** 提交（即本轮历史整体未 push） |
| 差异规模（vs merge-base） | 755 files changed，+79,666 / −13,531；其中 `docs/*` 58 文件、`perf/*` 39 文件          |
| 栈内 merge 提交           | 10 个（`master..HEAD`）                                                                |

### 1.2 本轮实测门禁（作者亲自运行，2026-10-29 21:49–22:03）

| #   | 门禁            | 命令                                                                                                      | 实测结果                                                                                                                                             | exit  |
| --- | --------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | 全量单测        | `npx vitest run`                                                                                          | `Test Files 316 passed (316)` · `Tests 2006 passed (2006)` · Duration 90.84s · 0 failed / 0 skipped                                                  | **0** |
| 2   | 类型检查        | `npx tsc --noEmit`                                                                                        | 无诊断输出                                                                                                                                           | **0** |
| 3   | Lint（CI 口径） | `npx eslint src --ext ts,tsx --rulesdir eslint-rules --report-unused-disable-directives --max-warnings=0` | 0 error / 0 warning（无输出）                                                                                                                        | **0** |
| 4   | 性能门禁        | `npm run perf:gates`                                                                                      | store budgets PASS（111 文件 / 19,182 行 / SCC 0）；whole 0 ≤ 10；bundle markers 9 文件、E4-1/E4-6 hits=0；raf-whitelist usages=14 / entries=15 PASS | **0** |
| 5   | 文档事实        | `npm run verify:docs`                                                                                     | 8/8 PASS，`fail=0 warn=0`（store-count actual=62）                                                                                                   | **0** |
| 6   | 分层门禁        | `npm run verify:layers`                                                                                   | 0 errors / 28 warnings（863 modules / 2051 dependencies）                                                                                            | **0** |
| 7   | store 行预算    | `node scripts/check-store-budgets.mjs`（= `npm run verify:filesize`）                                     | PASS：111 files（baseline 111）、19,182 lines、max 400、grandfathered 0、stale 0、SCC 0                                                              | **0** |
| 8   | 发布预检        | `node scripts/release/preflight.mjs --tag v0.2.1`                                                         | PASS：8 passed / 0 failed / 0 skipped / 0 warned                                                                                                     | **0** |
| 9   | 工作树          | `git status --porcelain=v1`                                                                               | 0 行（写入本文件前）                                                                                                                                 | **0** |
| 10  | 附加：生产构建  | `npm run build`                                                                                           | exit 0：Compiled 18.9s、TypeScript 19.0s、28/28 静态页；路由表 3 个 ○ + 30 个 ƒ                                                                      | **0** |
| 11  | 附加：过期基线  | `node scripts/perf/report-store-stats.mjs --check`                                                        | **FAIL**：`stores 62 != baseline 60`；`persistCount 43 < baseline 44`                                                                                | **1** |

> 计数口径说明：vitest 的 316/2006 与 TRACKING 里历史记录（310/1930、311/1933、314/1979）不同；本轮未逐项核对增量来源，以本轮实测为准。
> `.next` 原产物构建于 21:01:12（早于 HEAD 提交 21:44:24），为使 bundle-marker 与 preflight 的 build-output 检查对 HEAD 有效，本轮先做了一次全新构建。

### 1.3 本次未验证（不得当作结论）

- **无真实 CI**：`origin/master` 上只有旧版 `deploy.yml`；`nightly.yml`、`release.yml` 与 S0-2 重写的三段并行 `deploy.yml` 都只存在于本地分支，从未 push/运行；旧版 `deploy.yml` 的历史 run 未查询（本机 `gh` 未登录）。S8-1 的 7–9min（暖）/10–12min（冷）是估算。
- **无 push / 无 PR / 无 required checks**：`git branch -r` 只有 `origin/master` 与一条旧 `origin/codex/animation-function-iteration-plan`。
- **无真机**：没有真实 Windows 桌面包、没有设备听感 A/B、没有 devicechange/合盖 smoke。
- **无浏览器复测**：S2-6 audio-metrics 与 S3-2 截图是历史证据（2026-10-29 早于 HEAD），本轮未重跑；2h soak 为 node-only。
- **无包体数字**：`perf/bundle-report.json` 不存在，`npm run perf:bundle:diff` exit 2（`report not found`），HEAD 的 rootMain / First Load gzip [未验证]。
- **未做 1080p 90fps、未做像素 diff、未做 100 次切歌 / 效果拖动采样**。

## 2. 进度 60/74

进度公式：已完成任务数 / 74（TRACKING 汇总行口径）。`done` 以 TRACKING 勾选为准。

| 阶段                | 任务数 |   done | done 任务 id                     | partial / 未勾选 id                                                                  | 阶段出口门                                                         |
| ------------------- | -----: | -----: | -------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| S0 止血与基线       |      7 |      4 | S0-1、S0-3、S0-4、S0-6           | S0-2（本地完成，待 push）、S0-5（review）、S0-7（partial，5 份 ADR 仍 Proposed）     | M0 未过                                                            |
| S1 数据与播放正确性 |     10 |     10 | S1-1 … S1-10                     | —（缺口：E1-8 firstSound P50/P95 未采样、真机 devicechange/合盖 smoke 未做）         | M1 未关闭                                                          |
| S2 音频图与持久化   |      6 |      6 | S2-1 … S2-6                      | —（缺口：真机听感 A/B、2h soak；effects-drag / soak-100-skip 未采）                  | M2 未关闭                                                          |
| S3 外壳与订阅治理   |     10 |     10 | S3-1 … S3-10（含 S3-10b）        | —（缺口：真实浏览器/CDP 采样；截图矩阵仅 1440x900）                                  | M3 未关闭                                                          |
| S4 包体与加载       |      7 |      6 | S4-1 … S4-6                      | S4-7（partial：7b 已删 4 文件 / 571 行，归档 / key / 契约待 D1）                     | M4 未关闭（S4-3b 实测 rootMain gzip 211.0KB > 190KB；HEAD 未复测） |
| S5 渲染运行时       |      7 |      7 | S5-1 … S5-7                      | —（缺口：rAF 调用点 14 > 8；1080p ≥90fps 未测）                                      | M5 未关闭                                                          |
| S6 状态架构收敛     |     12 |     11 | S6-1 … S6-8、S6-10、S6-11、S6-12 | S6-9（partial：a–e 已交付，store 边 23 > 6，未勾选）                                 | M6 未关闭                                                          |
| S7 服务与平台边界   |      9 |      1 | S7-2                             | S7-1（partial）、S7-3（partial）、S7-9（partial）、S7-4/S7-5/S7-6/S7-7/S7-8（待 D2） | M7 未关闭                                                          |
| S8 门禁与长期治理   |      6 |      5 | S8-1、S8-2、S8-4、S8-5、S8-6     | S8-3（partial：4 周 nightly 历史为 artifact 级，未累积）                             | M8 未关闭                                                          |
| **合计**            | **74** | **60** | —                                | **14 项未 done**                                                                     | **0/9 出口门关闭**                                                 |

补充事实（本轮实测，`report-store-stats`）：**62 stores / 43 persist keys / registry 43/43 / 订阅 1222（whole 0，0%）/ whole-only files 0 / store 图 23 边 SCC 0 / getState domain 15 · lib 4 · store 195**。

## 3. 剩余 14 任务

owner 口径：**user** = 需用户拍板/授权；**CI** = 只能在 GitHub Actions / 分支保护上取得证据；**external** = 需真机、真实浏览器、真实网络或设备测量。纯实现余量标注「user（口径）+ dev」。

| #   | id   | 任务                                                              | 精确阻塞                                                                                                                                                                                                       | 需决策 / 动作                                                                                                                             | owner                  | 证据位置                                                                                            |
| --- | ---- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | S0-2 | CI 复活（master 触发 + tsc/lint/test/build + 三段并行门禁）       | 从未 push；required checks 未配置；Q02（branch protection/PAT）与 Q03（Vercel job 去留）Pending；TRACKING 记「本地完成」但未验证                                                                               | 授权 push 分支/PR → 观察 quality / coverage / build / quality-gate 四个 job → 回填 required checks                                        | user + CI              | TRACKING.md:35；`.github/workflows/deploy.yml`；docs/nbl/CI.md；scripts/ci-required-checks.test.mjs |
| 2   | S0-5 | 死层标记与仓库卫生（coordinator deprecated、GC 脚本、根目录清理） | Q22 未授权；实测 19 个 worktree、184 个本地分支、根目录 33 个文件；E0-5 目标（≤5 / ≤20）未达                                                                                                                   | 批准 Q22 → `scripts/gc-worktrees.ps1` dry-run → 逐项确认 → `-Apply`（只删 clean 且非当前分支）                                            | user                   | TRACKING.md:38；evidence/S0-evidence.md；scripts/gc-worktrees.ps1                                   |
| 3   | S0-7 | ADR D1–D8 评审与归档                                              | 5 份 ADR（0001–0005）全部 `Proposed`；D1/D2/D3/D4/D5/D6/D7/D8 均 Pending                                                                                                                                       | 逐项拍板 → ADR 状态改 Accepted + 记录日期/决策人                                                                                          | user                   | docs/nbl/adr/0001–0005；00-decisions.md:20–29                                                       |
| 4   | S4-7 | V8 处置执行（D1）                                                 | D1 Pending；7b 已删 4 文件 / 571 行，剩余 `archive/visualization-v8/` 去留、`visualization-v8-store` external key、4.7a 契约移植未做，故 E4-9 不判绿                                                           | 选 D1-C（推荐：先把 EffectPlugin/RenderEngineManager 契约移入 `src/runtime/`，S5-4 已有骨架与 2/14 试点，再删实现）；或 A 直接删 / B 接线 | user（D1）+ dev        | TRACKING.md:92；evidence/S4-evidence.md 2.4 节；scripts/dead-v8-leftovers.test.mjs                  |
| 5   | S6-9 | domain 用例层 + 事件 + 服务 port 化                               | a–e 已交付但任务未勾选：store 运行时边 23（目标 ≤6，含 type-only）、无浏览器 smoke；M6 另缺 40 个 store version 声明与 5 个整店持久化                                                                          | 决定口径：接受 a–e 完成并把 M6 目标降级记录，或继续收口 store 边与 version 迁移                                                           | user（口径）+ dev      | TRACKING.md:118；evidence/S6-evidence.md；perf/reports/s6-9d-getstate.\*                            |
| 6   | S7-1 | Resolver 插件化 + request 包装/熔断                               | partial：`platforms.ts` 371 > 300 行、门面 1133 > 450 行、`lxRunner.ts` 3 处裸 fetch、搜索/封面/歌词未插件化、坏 host 实网冒烟未做                                                                             | 决定是否继续 S7-1b/c 拆分，或接受 partial 并登记验收偏差                                                                                  | user（范围）+ dev      | TRACKING.md:126；evidence/S7-evidence.md 8 节；commit `e6c46d8`                                     |
| 7   | S7-3 | Worker transferable + 降级                                        | partial：无 50MB <50ms 主线程内联路径（worker 不可用=显式报错）、FFmpeg core 仍从 unpkg 加载、WorkerPoolManager 未接 DSD/FormatConverter、无浏览器 Performance 证据                                            | 定降级语义 + Q20（FFmpeg 自托管）+ 真机/浏览器测量                                                                                        | external + user（Q20） | TRACKING.md:128；evidence/S7-evidence.md                                                            |
| 8   | S7-4 | Electron 本地 Next 运行时（D2）                                   | D2 Pending；A（静态导出）被 31 个 API route 阻断（2026-10-21 记录，本轮未复跑）                                                                                                                                | 批准 D2-B → standalone/协议桥接 spike：`--dir` 冷启动 <3s、`/` 与 `/data-manager` 200、旧 origin 数据可见                                 | user                   | 00-decisions.md:44–54；docs/nbl/adr/0002-desktop-runtime.md；evidence/S7-evidence.md                |
| 9   | S7-5 | BackendGateway + preload baseUrl + 能力协商                       | 依赖 S7-4；D2 未批                                                                                                                                                                                             | D2-B 批准后排期（浏览器/Electron 分支单测为验收）                                                                                         | user                   | TRACKING.md:130                                                                                     |
| 10  | S7-6 | 后端异步启动 + 状态事件 + 离线 UI                                 | 依赖 S7-5；D2 未批                                                                                                                                                                                             | 同上；验收后端故障 <3s 可见窗口                                                                                                           | user                   | TRACKING.md:131                                                                                     |
| 11  | S7-7 | 插件 utilityProcess 沙箱 + 权限                                   | 依赖 S7-5；D2 未批；Q20（vm 残余风险）待定                                                                                                                                                                     | D2-B 后实现；恶意 fixture 无法读文件/执行命令                                                                                             | user                   | TRACKING.md:132                                                                                     |
| 12  | S7-8 | 凭据 safeStorage + Web 提示                                       | 依赖 S7-5；D8 未批（userAccountStore 明文持久化 5 平台 cookie）                                                                                                                                                | 批准 D8-A：桌面 safeStorage 加密 + Web「仅本地」提示 + 旧数据迁移                                                                         | user                   | TRACKING.md:133；00-decisions.md:95–101                                                             |
| 13  | S7-9 | OPFS spike + 2h soak + 泄漏上界                                   | 2h soak 已跑但为 node-only 合成负载（PASS，heap delta −2.58MB）；无 OPFS spike、无 CDP 播放 soak、未接 CI；50MB 起播未测                                                                                       | 定 Q17（10min 进 PR / 2h 每周）与是否做 OPFS spike；补浏览器 soak                                                                         | external + user（Q17） | TRACKING.md:134；evidence/S7-9-soak-2h-20261029.md；perf/reports/soak-2h-20261029.json              |
| 14  | S8-3 | 性能回归套件（bundle diff / nightly / soak / 看板）               | partial：nightly 已建，但历史是 artifact 级（clean checkout 每次只追加 1 行），需 commit-back / `contents:write` 授权（S8-3d）；无真实 audio-metrics 生产者；hardMax 仍禁用（maxAsyncChunk / public 既有违规） | 批准 nightly commit-back（或改成汇总 job）；定 runner 形态（Q17）                                                                         | user + CI              | TRACKING.md:141；`.github/workflows/nightly.yml`；scripts/perf/perf-dashboard.mjs                   |

## 4. 分支与 worktree 清单

### 4.1 集成链与分支 tip（本轮用 `git merge-base --is-ancestor` 逐一验证）

| 分支                                            | tip                                                                                           | 内容                                                                                                                      | 相对 HEAD                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `integration/s2-audio`                          | `e6c46d8`                                                                                     | **超集**：S1/S6 栈 + S2 音频图 + S3/S4/S5/S8 + 8 份阶段证据 + S7-1a；237 提交 / 755 文件                                  | 当前 HEAD                  |
| `integration/s1-batch`                          | `95424c4`                                                                                     | S1 栈 tip：S1-2 备份 v5、S1-4 VibeMusicDB v3、S1-10b 集成矩阵                                                             | 祖先（落后 30 提交）       |
| `integration/s1-5-into-s6`                      | `2f4dcd6`                                                                                     | S1-5 队列权威并入 S6 栈（10 个栈内 merge 之一）                                                                           | 祖先                       |
| `feature/arch-perf-s7-1`                        | `e6c46d8`                                                                                     | S7-1a + resolver 插件注册表 + http client                                                                                 | 与 HEAD 同一提交           |
| `docs/s0-evidence` … `docs/s8-evidence`（8 条） | `a23f335` / `496186f` / `692f908` / `af09eab` / `52ed67a` / `88ef20b` / `87c8fae` / `00ff8b2` | S0/S1/S3/S4/S5/S6/S7/S8 阶段出口证据                                                                                      | 全部祖先                   |
| `docs/player-playback-motion-sync`              | `8cdec7b`                                                                                     | 播放同步设计与实施计划                                                                                                    | 祖先                       |
| `master`                                        | `90c2152`                                                                                     | 手写歌词 MV 收尾；含 11 个集成树没有的提交（含 `c292c8e` 把 scratch/worktrees 排除出 type checking）                      | **非祖先**（落后 11 提交） |
| `origin/master`                                 | `6a211e1`                                                                                     | 远程最新；本地 master 领先 170                                                                                            | 非祖先                     |
| `docs/architecture-performance-plan`            | `640b291`                                                                                     | 前置审计（198 行）+ 设计（276 行）+ 旧版总计划；**HEAD 缺这两份前置文档**，但总计划第 801 行与 S7 计划第 9 行按分支名引用 | **非祖先**                 |
| `docs/audio-source-switch-flow`                 | `c06f5b8`                                                                                     | 音源切换设计/计划（另一条产品线）                                                                                         | 非祖先（范围外）           |
| `docs/promo-video`                              | `397b8c5`                                                                                     | 宣传片交付（范围外）                                                                                                      | 非祖先（范围外）           |

> 口径澄清：TRACKING 第 6/126 行写「S7-1a 未合并」。实测 `feature/arch-perf-s7-1` 与 `integration/s2-audio` 同指 `e6c46d8` 且该提交就是 HEAD，故 **S7-1a 已在集成栈内**；「未合并」应理解为未合入 master（本轮同样未 push）。

### 4.2 建议合并顺序（经授权后）

1. **先同步 master → 集成树**：`git merge master` 到 `integration/s2-audio`（11 个提交，含手写 MV 与 tsconfig 排除），解冲突后**重跑 1.2 全部门禁**；否则「超集」不包含 master 最新内容。
2. **补架构文档分支**：合并 `docs/architecture-performance-plan`，或只把 `docs/nbl/audits/2026-10-20-architecture-performance-audit.md` 与 `docs/nbl/specs/2026-10-20-architecture-performance-design.md` 复制进集成树并修 `docs/nbl/plans/INDEX.md`；否则总计划的引用在 master 上仍指向不存在的文件。
3. **单次合并超集**：`git merge --no-ff integration/s2-audio` → master（一次带入 237 提交 + 10 个栈内 merge）；**不要**逐分支合并 102 个 feature 分支（全部已被超集覆盖，只会放大冲突）。
4. **push + 触发 CI**：push master（及需要保留的证据分支），让 `deploy.yml` required checks 实跑（S0-2 / S8-1 的验收前提）。
5. **合并后清理**：102 个 `feature/arch-perf-*` 与 8 个 `docs/*-evidence` 均为祖先，可安全删除；保留 dirty worktree、主仓库与 `checkpoint/*`。

### 4.3 worktree 清单（实测 19 个）

|   # | 路径                                                           | 分支                                               | tip       |
| --: | -------------------------------------------------------------- | -------------------------------------------------- | --------- |
|   1 | `music_source_code`（主仓库）                                  | `checkpoint/gesture-air-control-overhaul-20261027` | `11d661e` |
|   2 | `_worktrees/arch-integration-s1-5`（本文件所在）               | `integration/s2-audio`                             | `e6c46d8` |
|   3 | `_worktrees/arch-perf-s1-2a`                                   | `feature/arch-perf-s1-2a`                          | `5862795` |
|   4 | `_worktrees/arch-perf-s1-5`                                    | `feature/arch-perf-s1-5`                           | `1f909d7` |
|   5 | `_worktrees/arch-perf-s1-6a`                                   | `feature/arch-perf-s1-8b`                          | `a84fac0` |
|   6 | `_worktrees/arch-perf-s1-7`                                    | `feature/arch-perf-s1-7`                           | `0861733` |
|   7 | `_worktrees/arch-perf-s1-9`                                    | `feature/arch-perf-playback-marks`                 | `60c6b46` |
|   8 | `_worktrees/arch-perf-s2-1`                                    | `feature/arch-perf-s2-6`                           | `6a25e92` |
|   9 | `_worktrees/arch-perf-s3-1`                                    | `feature/arch-perf-s3-9`                           | `c630434` |
|  10 | `_worktrees/arch-perf-s4-1`                                    | `feature/arch-perf-s4-6`                           | `8c4b980` |
|  11 | `_worktrees/arch-perf-s5-1`                                    | `feature/arch-perf-s5-7`                           | `df95414` |
|  12 | `_worktrees/arch-perf-s6-1`                                    | `feature/arch-perf-s7-9`                           | `1e499f5` |
|  13 | `_worktrees/promo-video`                                       | `docs/promo-video`                                 | `397b8c5` |
|  14 | `_worktrees/promo-video-pipeline`                              | `feature/promo-video-pipeline`                     | `4d35f88` |
|  15 | `_codex_player_sync_verify`（D 盘）                            | detached HEAD                                      | `06bccd8` |
|  16 | `music_source_code/.worktrees/ui-task8-discovery`              | `codex/ui-discovery-settings`                      | `b7743ce` |
|  17 | `music_source_code/.worktrees/ui-task9-tools`                  | `codex/ui-tools-analysis`                          | `b7743ce` |
|  18 | `C:/Users/Legion/.codex/worktrees/audio-source-switch-task4/…` | `feature/audio-source-switch-task4`                | `ea43c0e` |
|  19 | `C:/Users/Legion/.codex/worktrees/folia-webgl-mv-merge/…`      | `feature/folia-webgl-mv-merge`                     | `c367699` |

> 各 worktree 的脏/clean 状态本轮**未逐个检查**（`git worktree list` 不报脏状态），Q22 dry-run 输出为准；不要据此直接删除。

### 4.4 分支规模

- 本地分支 **184** 个：`feature/arch-perf-*` **102**、`integration/*` **3**、`docs/*` **12**，其余为无关产品线（`codex/ui-*`、`folia-*`、`handwritten-*`、`mineradio-*`、`promo-*`、`fix/library-*`、`subagent-*`、`wip/*`、`checkpoint/*`）。
- 远程只有 `origin/master` 与 `origin/codex/animation-function-iteration-plan` → **本轮工作全部只在本地**。

## 5. 证据索引

### 5.1 evidence/\*.md（14 份）

| 文件                                                              | 一句话说明                                                                                         |   规模 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -----: |
| [GOAL-PROGRESS.md](./evidence/GOAL-PROGRESS.md)                   | 2026-10-28 跨会话看板：S1-6/7/8 分支 tip 与「均未合并、需授权」提示；已被本文件取代                |  31 行 |
| [S0-evidence.md](./evidence/S0-evidence.md)                       | M0 出口证据：S0-1…S0-7 逐项提交/命令/退出码；结论 M0 未通过                                        | 300 行 |
| [S1-evidence.md](./evidence/S1-evidence.md)                       | M1 出口证据：S1-1…S1-10 提交、9 组定向 178 passed、全量 301 files / 1874 tests；M1 未关闭          | 311 行 |
| [S1-8b-full-suite.md](./evidence/S1-8b-full-suite.md)             | S1-8b 分支全量回归快照（206 files / 1287 tests，tsc/eslint exit 0）                                |   9 行 |
| [S1-8b-partial.md](./evidence/S1-8b-partial.md)                   | S1-8b 部分交付：coordinator + signal 贯穿清单，hook 接线与连点集成测试未完成                       |  36 行 |
| [S3-evidence.md](./evidence/S3-evidence.md)                       | M3 出口证据：S3-1…S3-10（含 10b/前置 rAF）；whole 0、selector 1222 结构指标                        | 289 行 |
| [S4-evidence.md](./evidence/S4-evidence.md)                       | M4 出口证据：包体/gzip、bundle marker 守卫、S4-7b 死代码清理与 D1 阻塞                             | 402 行 |
| [S5-evidence.md](./evidence/S5-evidence.md)                       | M5 出口证据：visualRuntime 5 订阅者共享 1 循环、质量档、longtask 降档                              | 324 行 |
| [S6-evidence.md](./evidence/S6-evidence.md)                       | M6 出口证据：11 done + S6-9 partial；全量 310 files / 1930 tests；eslint `--max-warnings=0` exit 0 | 447 行 |
| [S6-9d-evidence.md](./evidence/S6-9d-evidence.md)                 | S6-9d hooks getState 84→0 前后对比与分层棘轮说明                                                   |  53 行 |
| [S6-checkpoint-20261029.md](./evidence/S6-checkpoint-20261029.md) | S6-12r 检查点：280 files / 1749 tests，全门禁 exit 0                                               |  15 行 |
| [S7-evidence.md](./evidence/S7-evidence.md)                       | M7 出口证据：1 done / 3 partial / 5 blocked（D2）；含代理加固与 S7-1a 补记                         | 448 行 |
| [S7-9-soak-2h-20261029.md](./evidence/S7-9-soak-2h-20261029.md)   | 2h node-only soak：120 ticks，heap delta −2.58MB，PASS                                             |   9 行 |
| [S8-evidence.md](./evidence/S8-evidence.md)                       | M8 出口证据：本地门禁快照（311 files / 1933 tests）+「需 CI」项清单                                | 273 行 |

### 5.2 截图（D7 受保护视图，1440x900 @1x）

| 文件                                                                                         | 说明                                                                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [home-1440x900.png](./evidence/screenshots/s3-2/home-1440x900.png)                           | Home View（fresh profile，667,110 B，sha256 `8c358354…`，consoleError 0）                   |
| [player-1440x900.png](./evidence/screenshots/s3-2/player-1440x900.png)                       | Player View（ui-store-v2 currentView=player + 稻香 LRC fixture，624,217 B，consoleError 2） |
| [lyrics-fullscreen-1440x900.png](./evidence/screenshots/s3-2/lyrics-fullscreen-1440x900.png) | 全屏歌词（点击 `[title="点击进入全屏歌词"]` 后捕获，299,053 B，consoleError 2）             |
| [manifest.json](./evidence/screenshots/s3-2/manifest.json)                                   | 视口/浏览器/采集 commit `6ac0eba`/逐视图 sha256 与 consoleErrorCount（2,539 B）             |
| [README.md](./evidence/screenshots/s3-2/README.md)                                           | 采集状态构造与复现命令 `npm run perf:screenshots:s3-2`（7,082 B）                           |

### 5.3 perf/reports/\*.json（21 份，Before/After 对比）

| 文件组                                 | 说明                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `s6-5-store-stats.{before,after}.json` | S6-5 删除队列/EQ 副本前后的 store 统计（store 数、图边）                                                      |
| `s6-10-getstate.{before,after}.json`   | service 层 getState 24→0 的分层计数                                                                           |
| `s6-10b-getstate.{before,after}.json`  | component 层 getState 117→0 的分层计数                                                                        |
| `s6-9c-getstate.{before,after}.json`   | lib getState 22→5（bootstrap 2 + gesture 3）                                                                  |
| `s6-9d-getstate.{before,after}.json`   | hooks getState 84→0（store 侧 +41 属动作层）                                                                  |
| `s6-audio-consumers*.json`（10 份）    | 9 字段消费点迁移：主报告 + before，及 mixer / currentSong / isPlaying / progress / services 各自 before/after |
| `soak-2h-20261029.json`                | 2h soak 原始报告（120 tick 采样，15,230 B），与 5.4 节同源                                                    |

### 5.4 Soak

| 证据                                                                                 | 说明                                                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [S7-9-soak-2h-20261029.md](./evidence/S7-9-soak-2h-20261029.md)                      | 120min / 120 ticks，heap start 27.15MB / peak 31.90MB / end 24.57MB / delta −2.58MB（阈值 30MB），PASS |
| [perf/reports/soak-2h-20261029.json](../../../../perf/reports/soak-2h-20261029.json) | 原始 JSON：30,000 sets / 48,000 gets / 17,700 prunes / 480 transitions                                 |

> 注意：node-only 合成负载（TtlLruCache + hydrationStatus），不是浏览器/音频图 soak；不能替代 M2/M7 的真机结论。

### 5.5 浏览器音频指标（S2-6）

| 文件                                                                               | 说明                                                                                                                    |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [perf/audio-metrics/s2-6-report.md](../../../../perf/audio-metrics/s2-6-report.md) | 3 场景 × 60s、每 5s 采样：播放键写盘 1.00/s、all-key 1.63/1.67、节点 85→85（切歌增量 0）、>50ms 长任务 0、rAF p95 6.2ms |
| [s2-6-idle.json](../../../../perf/audio-metrics/s2-6-idle.json)                    | idle 场景 12 采样原始数据（8,875 B）                                                                                    |
| [s2-6-play.json](../../../../perf/audio-metrics/s2-6-play.json)                    | play 场景（100s 静音 WAV blob，9,815 B）                                                                                |
| [s2-6-track-switch.json](../../../../perf/audio-metrics/s2-6-track-switch.json)    | 3 次 Ctrl+N + 2 次 seek 后 60s 采样（11,639 B）                                                                         |

### 5.6 基线与历史快照（perf/）

| 文件                                                                           | 说明                                                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `perf/budget.json`                                                             | 包体/store 预算定义（965 B）                                                                                                   |
| `perf/bundle-baseline.json`                                                    | 包体基线：rootMain 3 files / 689.3KB raw / 211KB gzip；first load 8 scripts / 1,959.8KB raw / 607.2KB gzip（2026-10-29 15:56） |
| `perf/coverage-domains.json`                                                   | 五域覆盖率地板（audio/utils/store/services/hooks）                                                                             |
| `perf/getstate-baseline.json`                                                  | getState 分层棘轮（services 0、components 0、hooks 0、lib 5）                                                                  |
| `perf/store-line-baseline.json`                                                | 111 个 store 文件行数基线（19,182 行，shrink-only）                                                                            |
| `perf/store-stats-baseline.json`                                               | store/订阅基线，**已过期**：60 stores / 44 keys（实际 62 / 43）                                                                |
| `perf/rAF-whitelist.json`                                                      | rAF 调用点白名单（15 条，usages=14）                                                                                           |
| `perf/s4-before.json`、`s4-after-s41/s42/s43a/s43b.json`、`s4-guard-s43b.json` | S4 包体演进 6 个快照（jsmediatags/crypto-js/splitChunks 各阶段）                                                               |
| [perf/README.md](../../../../perf/README.md)                                   | 复现手册（39,295 B）：8/9 bundle diff+history、10 layers、11 soak、13 audio-metrics                                            |
| [evidence/S0-dirty-inventory.txt](./evidence/S0-dirty-inventory.txt)           | S0-1 的 55 项脏改原始清单（历史）                                                                                              |

## 6. 待决策与授权

### 6.1 D1 — V8 可视化处置（Pending）

- 事实：V8 为 38 个非测试文件 / 11,355 行、零挂载（实际挂载 V7 14 效果）；7b 已删 4 个死文件 / 571 行（`98f0da5`）；剩余 `archive/visualization-v8/`、`visualization-v8-store` external key、4.7a 契约移植。
- 选项：**A 直接删除**（净减维护面；丢失 28 效果储备）；**B 完成接线**（成本高，需重测视觉/性能/交互）；**C 冻结→移植契约→删除实现**（推荐；S5-4 已落地 `src/runtime/effectPlugin.ts` + `effectRegistry.ts` 与 2/14 试点，契约基础已在）。
- 需用户：选 A / B / C，并明确 `archive/visualization-v8/` 是否保留一份归档、external key 是否立即清理。
- 影响：S4-7 才能勾选、E4-9 才能判绿；ADR 0001 才能从 Proposed 转 Accepted。

### 6.2 D2 — Windows 桌面运行时形态（Pending）

- 事实：静态导出（A）已被 31 个 API route 实测阻断（2026-10-21 记录，本轮未复跑）；当前桌面包会发陈旧前端、在线能力失效。
- 选项：**A 静态导出 + 在线降级**（不可行）；**B 捆绑本地 Next standalone + app:// 桥接 + BackendGateway**（推荐，ADR 0002 证据倾向 B）；**C 桌面仅本地播放器**（缩小产品范围）。
- 需用户：批准 B，并授权 S7-4 spike 与后续 S7-5/6/7/8 排期。
- 影响：S7 的 5 个任务（S7-4…S7-8）全部依赖此决策；桌面打包链路与 `build:electron` 冻结解除。

### 6.3 D7 — 受保护视图「仅订阅方式」等价改写（Pending，实际已按默认执行）

- 事实：S3-2/S3-3/S5-2 已按 D7-A 的默认假设完成（只改订阅/调度行）；截图证据只有 **1440x900 @1x**，计划要求的 1280x720/1920x1080/2560x1440 改前/改后 pixel diff ≤0.1% **未做**；被保护的是 Home View / Player View / 全屏歌词。
- 需用户：追认 D7-A（等价改写合法），并选择是否补三档分辨率 + 以 `2b99173` 为 before 的 pixel diff。
- 影响：S3-2 才能从「截图证据」升级为「完整 D7 验收」；ADR 0005 转 Accepted。

### 6.4 D8 — 第三方解析源与平台 cookie 边界（Pending）

- 事实：`sourceConfigStore` 内置第三方解析源；`userAccountStore` 明文持久化 5 个平台 cookie（netease/qq/kugou/kuwo/qishui）。
- 选项：**A 明示第三方源 + 桌面 safeStorage 加密 + Web「仅本地」提示**（推荐）；B 只留官方/授权源；C 现状 + 提示。
- 需用户：批准 A；影响 S7-8、SourceManagementModal/AccountCenter 文案与合规说明。

### 6.5 push 与 required checks 授权

- 现状：**零 push**（远程仅 `origin/master` 与一条旧 codex 分支）；本地 master 领先 origin 170 提交；`nightly.yml`、`release.yml` 与重写后的 `deploy.yml` 从未 push 因而从未运行；required checks 未配置。
- 需用户：① 授权 push `integration/s2-audio`（或先开 PR 分支）；② 确认 Q02（branch protection / bot PAT 是否可用）；③ 确认 Q03（Vercel 发布 job 去留）；④ 确认 required checks 集合（quality / coverage / build / quality-gate 是否全部必选）。
- 影响：S0-2 与 S8-1 的验收只能在 push 后完成；CI 真实 wall-clock 也才能测。

### 6.6 store-stats 基线重建批准

- 实测 `node scripts/perf/report-store-stats.mjs --check` **exit 1**：`stores 62 != baseline 60`、`persistCount 43 < baseline 44`。
- 原因：基线生成于 S6-11/S6-12/S4-7 之前的 2026-10-29 13:26；且基线里的 44 是历史假象（真实 persist key 43，registry 43/43）。
- 需用户：批准执行 `node scripts/perf/report-store-stats.mjs --update`（重建为 62 stores / 43 keys），或决定保留红项并把 `--check` 从门禁叙事中移除。
- 影响：不影响 `perf:gates`（它只用 `--max-whole 10`），但影响「基线棘轮生效」这一结论与 CI 文档表述。

### 6.7 Q22 — worktree / 根目录清理授权

- 实测：**19 个 worktree**（目标 ≤5）、**184 个本地分支**、**根目录 33 个文件**（2026-10-27 记录为 31）；根目录含 5 张 `daily_video_editing*.png`、`gemini-svg (3).svg`、`tsconfig.tsbuildinfo` 等可疑残留。
- 需用户：批准 `scripts/gc-worktrees.ps1` 先 dry-run 出清单 → 用户逐项确认 → 再 `-Apply`；明确「只删 clean、非当前、非主仓库」的边界，以及根目录文件白名单（保留 `.env.local` 等本地配置，不删）。
- 影响：S0-5 收口；E0-5 的 ≤5/≤20 目标能否达成。

### 6.8 验收偏差选项（需一次性拍板）

| 偏差      | 计划目标                                        | 实测/现状                                                                                                                     | 选项                                                                         |
| --------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| M4 包体   | rootMain gzip ≤190KB                            | S4-3b 实测 211.0KB（Q10 缺口 21KB）；HEAD 未复测（缺 `perf/bundle-report.json`）                                              | A 接受并重定 215KB / B 继续瘦身（Q10 需用户批准）/ C 先补 bundle report 再判 |
| S2-4 写盘 | ≤0.4 写/秒                                      | 浏览器实测 1.00/s（2s/key 节流边界）                                                                                          | A 接受为边界（记录原因）/ B 改 5s 节流（进度丢失窗口变大）                   |
| M5 rAF    | 调用点 ≤8                                       | `verify:raf` usages=14 / entries=15（scheduler-owner 2、visualRuntime 1、other 7、player3d-pending 4、audio-panel-pending 1） | A 接受分阶段收敛 / B 继续删旧 flag-off 路径 / C 重定白名单口径               |
| M6 状态   | store 边 ≤6、44/44 key 有 version、整店持久化 0 | 边 23（本轮实测，含 type-only）；40 store 无 version、5 个整店持久化（S6-11 记录）                                            | A 降级目标并记录 / B 继续 S6-9 收口 / C 拆新阶段                             |
| S3-2      | 4 档分辨率 pixel diff ≤0.1%                     | 仅 1440x900 当前态截图                                                                                                        | A 接受 / B 补 before（`2b99173`）+ 4 档 diff                                 |
| S8-3      | nightly 连续 4 周无回归                         | 历史 artifact 级、未累积                                                                                                      | A 批准 commit-back / B 改汇总 job / C 延后                                   |
| 真实性    | 真机 1080p ≥90fps、听感 A/B、100 次切歌         | 均为 jsdom/结构/headless 证据                                                                                                 | A 接受自动化口径 + 记录 / B 排真机窗口补齐                                   |

> 以上选项尚未拍板；本文件不代用户做选择，只给出可执行分叉。

## 7. 复现命令（全部在本 worktree 根目录）

| 目的                                       | 命令                                                                                                      | 期望                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 生产构建（bundle marker / preflight 前置） | `npm run build`                                                                                           | exit 0，28/28 静态页                            |
| 全量单测                                   | `npx vitest run`                                                                                          | 316 files / 2006 tests passed，exit 0           |
| 类型                                       | `npx tsc --noEmit`                                                                                        | 无输出，exit 0                                  |
| Lint（CI 口径）                            | `npx eslint src --ext ts,tsx --rulesdir eslint-rules --report-unused-disable-directives --max-warnings=0` | exit 0                                          |
| 性能门禁                                   | `npm run perf:gates`                                                                                      | 4 段全 PASS，exit 0                             |
| 文档事实                                   | `npm run verify:docs`                                                                                     | `fail=0 warn=0`                                 |
| 分层                                       | `npm run verify:layers`                                                                                   | 0 errors / 28 warnings，exit 0                  |
| store 行预算                               | `npm run verify:filesize`                                                                                 | 111 files / SCC 0，exit 0                       |
| 发布预检                                   | `node scripts/release/preflight.mjs --tag v0.2.1`                                                         | 8 PASS / 0 FAIL，exit 0（需 clean tree）        |
| store 统计（棘轮）                         | `node scripts/perf/report-store-stats.mjs --check`                                                        | **当前 exit 1**（过期基线，见 6.6 节）          |
| 包体 diff                                  | `npm run perf:bundle:diff`                                                                                | **当前 exit 2**（缺 `perf/bundle-report.json`） |
| S2-6 报告复算                              | `npm run perf:audio-metrics:s2-6:report`                                                                  | 复用已入库样本，不重跑浏览器                    |
| S2-6 重新采样                              | `npm run perf:audio-metrics:s2-6`                                                                         | 需 dev server + Chrome + Playwright             |
| 2h soak                                    | `node scripts/perf/soak.mjs --duration 120 --interval 60`                                                 | delta ≤30MB，exit 0                             |
| S3-2 截图                                  | `npm run perf:screenshots:s3-2`                                                                           | 需 dev server；输出 3 PNG + manifest            |
| 工作树 GC（dry-run）                       | `powershell -File scripts/gc-worktrees.ps1`                                                               | 只列清单，需 Q22 授权后 `-Apply`                |

## 8. 风险与保留

1. **无真实 CI**：`nightly.yml`、`release.yml` 与重写的并行 `deploy.yml` 从未 push，因而从未运行；旧版 `deploy.yml` 的历史 run 未查询（`gh` 未登录）；required checks、并行 job wall-clock（7–9 / 10–12min 为估算）、actionlint 均未验证；「CI 绿」不可宣称。
2. **无 push / 无合并**：全部成果只在本地；本地 master 领先 origin 170 提交；集成分支领先本地 master 237、落后 11。任何「已交付 master」的说法都不成立。
3. **基线过期**：`store-stats-baseline.json` 60/44 vs 实际 62/43（`--check` 红）；`bundle-baseline.json` 生成于 15:56 且 `bundle-report.json` 缺失，HEAD 包体无法比对；`s4-*.json` 是历史快照，不是 HEAD 实测。
4. **部分任务按 done 记录但缺口明确**：S1-10（E1-8 未采样）、S2-6（effects-drag / soak-100-skip 未采）、S3-2（单分辨率）、S4（211KB > 190KB）、S5（rAF 14 > 8）、S6（边 23 > 6）、S7-1/3/9、S8-3；引用 done 时必须同时引用这些缺口。
5. **证据性质**：大部分性能结论是 jsdom / 静态扫描 / 合成负载；真实浏览器证据只有 S2-6（headless、无声卡/GPU）与 S3-2 截图；2h soak 为 node-only。
6. **环境**：Windows 10.0.26200、Node v24.16.0、npm 11.13.0、Chrome 156.0.8078.49、Playwright 1.64.1；未在其他 OS/CI 上验证。
7. **口径不一致**：persist key 计数 43（实际）vs 44（旧基线/部分文档）；store 数 62（AGENTS/ARCHITECTURE/脚本一致），但历史证据里出现过 59/60/64；引用历史数字需注明日期。
8. **文档引用缺口**：总计划第 801 行与 S7 计划第 9 行引用的两份 2026-10-20 审计/设计文档只存在于 `docs/architecture-performance-plan`，HEAD 中不存在；`verify:docs` 不检查这类跨分支引用，故门禁绿不代表引用可达。
9. **本文件自身**：docs-only 单提交，不改变任何门禁结果；提交后 `git status` 应回到 0 行（已复核）；文中所有「实测」数字来自 2026-10-29 21:49–22:03 的同一台机器。

## 附录 A：本轮原始输出摘录

```
Test Files  316 passed (316)
     Tests  2006 passed (2006)
  Duration  90.84s (transform 76.79s, setup 17.75s, import 228.59s, tests 202.81s, environment 705.74s)

== docs-facts: fail=0 warn=0 ==

x 28 dependency violations (0 errors, 28 warnings). 863 modules, 2051 dependencies cruised.

[store-budgets] PASS: 111 files within budget; SCC 0
[store-stats] OK: wholeCalls 0 <= 10
[bundle-markers] .next: 9 files from rootMainFiles + / + /data-manager
  ok   E4-1 jsmediatags [ID3v2] hits=0
  ok   E4-6 mediapipe [mediapipe.NormalizedRect] hits=0
[bundle-markers] PASS - no initial-bundle markers
[raf-whitelist] PASS scheduler-owner=2 visualRuntime=1 other=7 player3d-pending=4 audio-panel-pending=1

RESULT: PASS - 8 passed, 0 failed, 0 skipped, 0 warned

[store-stats] FAIL: stores 62 != baseline 60; persistCount 43 < baseline 44
```

---

_本文件由 DSH 子 agent 生成；如需更新，请在看板 [TRACKING.md](./TRACKING.md) 与 [00-decisions.md](./00-decisions.md) 同步状态后重新生成本文件。_

---

## 9. 终局收口（2026-10-30 02:07 +08:00）— 74/74，带显式偏差

> 本节为追加记录；§1–§8 仍是 2026-10-29 22:03 的快照（60/74）。触发：用户 2026-10-30 明确「继续完成所有」，并沿用此前批准（D2 deferred、性能偏差接受、允许带偏差收口）。

### 9.1 基线提交与 CI（GitHub Actions API 实测）

| 项           | 值                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 代码基线     | `integration/s2-audio` @ `5b40fc2f85c30cbd8c23774da2dc5d7094baf408`（短 `5b40fc2`，= `origin/master`）                                                                      |
| 本文所在提交 | docs-only 收口提交 `docs(goal): close remaining tasks with user-accepted deviations`，父提交 `5b40fc2`；哈希用 `git log -1 --format=%h` 查询；**不 push**、不改主仓库工作树 |
| 进度         | **74/74（100%）**；S0 7/7、S1 10/10、S2 6/6、S3 10/10、S4 7/7、S5 7/7、S6 12/12、S7 9/9、S8 6/6                                                                             |

CI（workflow `CI` = `deploy.yml`，push master，均为真实 run）：

|   # |                                                                                 run id | commit    | 结论    |  wall | 关键 job                                               |
| --: | -------------------------------------------------------------------------------------: | --------- | ------- | ----: | ------------------------------------------------------ |
|  12 | [40910653833](https://github.com/NanQiaoMi/music_source_code/actions/runs/40910653833) | `098ad9c` | success | 5m16s | Quality 4m35s / Coverage 2m58s / Build 1m35s / gate 3s |
|  13 | [40914041154](https://github.com/NanQiaoMi/music_source_code/actions/runs/40914041154) | `58b5274` | success | 4m47s | 四 job 全 success                                      |
|  14 | [40923220019](https://github.com/NanQiaoMi/music_source_code/actions/runs/40923220019) | `54a5dd9` | success | 3m53s | 四 job 全 success                                      |
|  15 | [40926256098](https://github.com/NanQiaoMi/music_source_code/actions/runs/40926256098) | `5b40fc2` | success | 3m52s | Build 1m25s / Quality 3m33s / Coverage 3m44s / gate 2s |

全部 run 的聚合 `Quality gate (required)` 均为 success，wall 均 ≤ 12min；`Desktop package` / `Deploy to Vercel` 按设计 skipped。
nightly 的首次真实运行尚未发生（下一次 cron `0 18 * * *` = 2026-10-30 18:00 UTC / 2026-10-31 02:00 +08），因此 commit-back 目前只有本地仿真证据（见 9.4）。

### 9.2 本次落地

1. **nightly history commit-back（S8-3d）**：`.github/workflows/nightly.yml` 新增 `Commit perf history` 步骤（`if: always()`，在 append-history/dashboard 之后）：job 级 `permissions: contents: write`（workflow 级仍 `contents: read`）、checkout `ref: ${{ github.event.repository.default_branch }}` + `persist-credentials: true`、bot 身份、`git add perf/perf-history.jsonl perf/reports && git diff --cached --quiet || (git commit -m 'chore(perf): nightly history [skip ci]' && git push origin "HEAD:${{ github.event.repository.default_branch }}")`。无 diff 不产生空提交；push 失败则该 run 红且不伪造数据。
2. **历史 seed**：`perf/perf-history.jsonl` 入库（`append-history.mjs --init` 建 header-less JSONL，当前 **1 行**）：
   `{"ts":"2026-10-30T02:02:00+08:00","commit":"5b40fc2","rootMainGzipKB":208.4,"firstLoadGzipKB":621.5,"cssGzipKB":29.2,"asyncMaxKB":675.9,"publicMB":89.2}`
   `--check` exit 0（1 entry，schema valid，ts strictly increasing）；`perf-dashboard` 可渲染 1 行。
3. **文档**：TRACKING 合计 68→74/74（S7 4→9、S8 5→6）、M7/M8 状态、阻塞登记与变更记录；`00-decisions.md` 追加「2026-10-30 用户授权收口记录」；`docs/nbl/CI.md` §6.1 记录权限/身份/失败模式；`perf/README.md` §8–§9 同步「历史入库」。
4. **性能实测（HEAD `5b40fc2` 全新 build）**：rootMain 208.4KB gzip（baseline 211，**-2.6KB**）、first load 621.5KB（baseline 607.2，**+14.3KB > +10KB 阈值**）、CSS 29.2KB、async max 675.9KB、public 89.2MB（含自托管 ffmpeg-core/mediapipe）。

### 9.3 剩余偏差（收口后仍存在，不得宣称全部达成）

|   # | 项                                                                                 | 现状                                                                                                        | 状态 / 处理                                                                                                           |
| --: | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
|   1 | S7-4..S7-8 桌面运行时（D2/D8）                                                     | **零代码交付**：无 standalone Next、app:// 桥接、BackendGateway、异步后端、utilityProcess 沙箱、safeStorage | **accepted-deferral 2026-10-30**（done-with-deviation）；M7 出口门不勾选；ADR 0002 仍 Proposed+Deferred；桌面发布冻结 |
|   2 | S8-3 nightly 连续 4 周                                                             | 自动化全落地、CI 绿、history **1 行**；时间门自 2026-10-30 起                                               | **time-gate accepted**；≥28 行约 2026-11-27；M8 不勾选                                                                |
|   3 | first-load gzip                                                                    | 621.5KB vs baseline 607.2KB（+14.3KB > +10KB）                                                              | **未接受的新偏差**；nightly 首跑预计在 diff 步骤判红；需评审后 `npm run perf:bundle:diff -- --update` 或先瘦身        |
|   4 | M4 rootMain 190KB / S2-4 0.4 写/s / M5 rAF 8 / M6 边 6 / S3-2 4 档 / S7-1 模块大小 | 2026-10-29 实测值                                                                                           | 用户 **2026-10-29 已接受**（沿用，见 00-decisions.md）                                                                |
|   5 | M6 40 store 无 version / 5 个整店持久化                                            | 未实现                                                                                                      | **未批准**，保持缺口；M6 不关闭                                                                                       |
|   6 | 真机证据：听感 A/B、devicechange/合盖、1080p ≥90fps、播放级 2h soak                | 只有 jsdom/headless/node 合成                                                                               | 外部依赖，保持缺口                                                                                                    |
|   7 | nightly commit-back 真机验证                                                       | 仅本地 bare-repo 仿真（push + no-op 两路径 exit 0）；GitHub 上首次运行待 2026-10-31 02:00 +08               | 观察首个 nightly run；若 push 被 branch protection 拒，按 CI.md §6.1 处理                                             |
|   8 | R9 数据兼容 fixture / R10 保护视图清单                                             | 未脚本化                                                                                                    | S8-5 遗留缺口                                                                                                         |

### 9.4 如何验证（本 worktree 根目录，2026-10-30 实测）

| 命令                                                                                | 期望                                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                  | exit 0，无输出                                                                                             |
| `node scripts/check-docs-facts.mjs`                                                 | `fail=0 warn=0`，exit 0                                                                                    |
| `npx vitest run scripts/ci-required-checks.test.mjs scripts/verify-layers.test.mjs` | 2 files / 12 tests passed，exit 0                                                                          |
| `npm run perf:gates`                                                                | store budgets PASS（111 files / SCC 0）、whole 0、bundle markers PASS、rAF usages=14 PASS，exit 0          |
| `node scripts/check-store-budgets.mjs`                                              | PASS：111 files / 19,182 lines / SCC 0，exit 0                                                             |
| `node scripts/perf/append-history.mjs --check`                                      | `OK: 1 entry, schema valid, ts strictly increasing`，exit 0                                                |
| `npm run perf:dashboard`                                                            | 1 行表格（5b40fc2，2026-10-29 18:02 UTC）                                                                  |
| `npm run perf:bundle:diff`                                                          | **exit 1（已知）**：first-load +14.3KB > +10KB；rootMain -2.6KB PASS                                       |
| `git log --oneline -1`                                                              | docs 收口提交（父 `5b40fc2`）                                                                              |
| GitHub API                                                                          | `curl -s https://api.github.com/repos/NanQiaoMi/music_source_code/actions/runs?per_page=4` 查 #12–#15 结论 |

nightly commit-back 的本地仿真（不 push 真实仓库）：在 `.cache/nightly-commit-sim` 建 bare remote + clone，执行同一段 shell —— 首次运行生成 `chore(perf): nightly history [skip ci]` 并推送成功（远端 2 行）、第二次运行 `git diff --cached --quiet` 为真且不产生空提交（exit 0、工作树干净）。

### 9.5 风险

1. **「done-with-deviation」最容易被误读为已完成**：S7-4..S7-8 完全没有代码，S8-3 的 4 周判据也未达成；任何对外汇报必须同时引用本表，不能只说 74/74。
2. **first-load baseline 偏差会让 nightly 立刻红**：若不 rebaseline，4 周「无回归」永远无法开始；若 rebaseline，需按仓库规则评审并说明 +14.3KB 的来源（S7 功能 + ffmpeg/mediapipe 自托管）。
3. **commit-back 依赖默认分支可被 bot 推送**：branch protection 开启「Require PR」且无 bypass 时 nightly 会红；push 竞态会 non-fast-forward。处理见 `docs/nbl/CI.md` §6.1。
4. **M7/M8 出口门仍未关闭**：74/74 是看板口径（含 6 项 done-with-deviation），不是九个里程碑全部通过。
5. **本次 docs 提交未 push**（按任务约束）；如需让 CI 记录本次文档变更，需另行授权 push。
