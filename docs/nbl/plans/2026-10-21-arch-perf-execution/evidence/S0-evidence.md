# S0 阶段出口证据（M0 出口门）

> 阶段计划：[S0-baseline.md](../S0-baseline.md) · 决策：[00-decisions.md](../00-decisions.md) · 看板：[TRACKING.md](../TRACKING.md)
> 采集：2026-10-29 19:21–19:35 +08:00（DSH 子 agent，docs-only；不 push、不动主仓库、不改产品代码）
> 工作树：`D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`
> 分支 / HEAD：`integration/s2-audio` @ `00ff8b2` — `docs(s8): add stage exit evidence`（2026-10-29 19:20:44 +0800）
> 基线 commit（不可变）：`2b991731a1e48d5b3ba8084cc2b18276fb5b1e7d`（2026-10-27 13:39:42），已核实是当前 HEAD 的祖先。
> 本文只记录**可复核事实**；历史 checkpoint 日志原文见[附录 A](#附录-a历史-checkpoint-日志原文保留)，本次复核命令/退出码见 §7。

**状态口径**：`done` 达成 · `partial` 部分达成（缺口逐条列出） · `blocked` 决策/授权阻塞 · `local-done` 本地完成但未 push · `stale` 基线过期 · `missing` 产物缺失。

**结论：M0 出口门未通过。** S0-1 done；S0-2 本地完成、阻塞于 push 授权；S0-3 partial；S0-4 工具口径 done / 人工清单 partial；S0-5 partial；S0-6 v1 done 但基线 stale；S0-7 blocked（D1/D2/D7/D8 pending）。

---

## 1. 任务表（S0-1..S0-7）

| ID   | 任务                            | 状态                              | 提交 / 关键文件                                                                                                                                                                             | 行数                                       | 测试 / 退出码                                                                                       |
| ---- | ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| S0-1 | 处理脏改，锁定干净基线          | **done**                          | `2b99173`（checkpoint 快照）；`evidence/S0-dirty-inventory.txt`                                                                                                                             | 123 files，+27,294 / −1,967；脏改 122 路径 | tsc 0 · vitest 208 files/1284 tests · eslint 0/0 · build 0（均记录于 2026-10-27，未在本 pass 重跑） |
| S0-2 | CI 复活（master 触发 + 四门禁） | **local-done**（阻塞 push/Q02）   | `.github/workflows/deploy.yml`（188 行）；无 `ci.yml`；无独立提交（随 `2b99173` 入库）                                                                                                      | YAML 重写（未单独计行）                    | YAML 可解析（prettier 仅格式告警）；`verify:docs` ci-branch PASS · 无 Actions 运行记录              |
| S0-3 | 构建产物与端口明确化            | **partial**                       | `84305f6`；`scripts/verify-static-export.mjs`、`scripts/verify-desktop-release-ready.mjs`、`package.json`、`scripts/build-static.mjs`、ARCHITECTURE                                         | 5 files，+163 / −46                        | 5 tests exit 0 · `verify-static-export` exit 2（out 缺失）· guard exit 1（冻结）· 3024 引用 0       |
| S0-4 | 文档事实修正                    | **done（工具）/ partial（清单）** | `AGENTS.md`、`docs/nbl/ARCHITECTURE.md`、`docs/nbl/plans/INDEX.md`、`.github/pull_request_template.md`（随 `2b99173`）                                                                      | 文档不计行                                 | `npm run verify:docs` exit 0，fail=0 warn=0                                                         |
| S0-5 | 死层标记与仓库卫生              | **partial**                       | `195d996`（删 2 死文件 + gc 脚本）；coordinator 层后由 `1e7ffbc` 整体删除                                                                                                                   | 3 files，+82 / −113（含删 113 行）         | 死文件 0 引用 · worktree 19（目标 ≤5）· 根文件 33（目标 ≤20）                                       |
| S0-6 | 测量基座 v1                     | **done（v1）/ 基线 stale**        | `scripts/perf/bundle-budget.mjs`、`scripts/perf/report-store-stats.mjs`(+test)、`scripts/check-docs-facts.mjs`、`perf/{budget,bundle-baseline,store-stats-baseline}.json`、`perf/README.md` | 脚本 + 3 份基线 JSON                       | `report-store-stats.test.mjs` 2 tests exit 0 · store-stats `--check` **exit 1**（60/44 vs 62/43）   |
| S0-7 | ADR D1-D8 评审与归档            | **blocked**（D1/D2/D7/D8）        | `docs/nbl/adr/`：README + 0001..0005（5/8）                                                                                                                                                 | 计划 8 个 ADR，实际 5                      | 全部 `Proposed`，决策人“待用户”                                                                     |

### 1.1 S0-1 处理 55 项未提交手势改动 — done

- 执行：Q01-A，checkpoint 分支 `checkpoint/gesture-air-control-overhaul-20261027`，commit `2b99173`；`git show --shortstat` = **123 files changed, 27,294 insertions(+), 1,967 deletions(-)**。
- 盘面：`evidence/S0-dirty-inventory.txt`（133 行）记录 HEAD `c73a872`、master `90c2152`、落后 11 commits、**122 个 dirty paths（`git status -uall`）**、已跟踪差异 37 files / +3,595 / −1,967（其余为未跟踪文件）。
- 基线复测（干净树 @ `2b99173`，2026-10-27 记录）：`npx tsc --noEmit --incremental false` exit 0；`npm run test -- --run` 208 files / 1284 tests passed（77.52s）exit 0；`eslint src` 分块 exit 0（0 errors / 0 warnings）；`npm run build` 在隔离 worktree exit 0（28 static pages + 31 API routes，TS 16.1s）。
- 本 pass 复核：`git merge-base --is-ancestor 2b99173 HEAD` exit 0 → checkpoint 仍在集成线上；上述 4 条命令**未**在 `2b99173` 重跑（docs-only 任务，避免长时间 build）。当前 HEAD 的 `npx tsc --noEmit` exit 0 见 §7。
- ⚠ 分支指针已漂移：`checkpoint/gesture-air-control-overhaul-20261027` 现指向 `11d661e`（2026-10-29 03:06，比 `2b99173` 多 15 个提交），主仓库工作区当前检出该分支。**基线只能引用不可变 commit `2b99173`，不能引用分支名**（详见 §2 #2）。

### 1.2 S0-2 CI 复活 — local-done，阻塞于 push 授权

- 落地：`.github/workflows/deploy.yml`（`name: CI`，188 行）。计划原拟新增 `ci.yml`，实际**改写 `deploy.yml`**，仓库内无 `ci.yml`。
- 触发（已核实）：`push: branches [master]`、`pull_request: branches [master]`、`workflow_dispatch`；`concurrency` group `ci-<workflow>-<ref>`、`cancel-in-progress: true`；`permissions: contents: read`。
- 作业：`quality`（tsc → lint `--rulesdir eslint-rules --max-warnings=0` → verify:layers → unit）、`coverage`、`build`（build + perf:gates + bundle markers + docs facts）、`quality-gate`（聚合，S8-1b）、`desktop-windows`、`deploy-to-vercel`（后两者改为手动/tag 条件）。
- 版本：CI **Node '20'**（`deploy.yml:33`），而本机基线为 Node **v24.16.0** → 环境不一致，记入 §4 E0-2。
- 提交归属：`git log --all -- .github/workflows/deploy.yml` 共 9 条，S0 期间唯一条目是 `2b99173`（checkpoint 快照）→ **S0-2 无独立提交**（当时改动在脏树里被 S0-1 一起快照）。
- 已复核：YAML 可被解析（`npx prettier --check` exit 1 仅格式告警）；`npm run verify:docs` 的 `ci-branch` PASS（master=true、mainOnly=false）。
- **未复核 / 阻塞**：没有任何 Actions 运行记录；4 个 required checks 未在 GitHub 配置（Q02 Pending，需仓库 owner 权限）；3 连绿与 ≤20min 无数据。**阻塞原因：push 授权 + 仓库 admin**（本任务未 push，遵守任务约束与 Q02）。

### 1.3 S0-3 构建产物与端口明确化 — partial

- 提交 `84305f6`：5 files，+163 / −46 — `docs/nbl/ARCHITECTURE.md`(2)、`package.json`(11)、`scripts/build-static.mjs`(5)、`scripts/verify-static-export.mjs`(140)、`scripts/verify-static-export.test.mjs`(51)。
- 已达成（本 pass 复核）：
  - 端口单点：`start = next start -p 3025`、`dev = ... -p 3025`；`git grep -n 3024 -- package.json Dockerfile docker-compose.yml` exit 1（无匹配）；`verify:docs` ports PASS（dev/start/Dockerfile EXPOSE/ENV PORT/compose 全为 3025）。
  - 陈旧 out 阻断：`node scripts/verify-static-export.mjs` → **exit 2**（`out/` 缺失；脚本语义 2=缺失 / 3=过期 / 0=新鲜）。
  - 桌面发布 fail-fast：`node scripts/verify-desktop-release-ready.mjs` → **exit 1**（`[desktop-release-guard] BLOCKED ... frozen until S7-4`，D2 未定）。
  - 测试：`npx vitest run scripts/verify-static-export.test.mjs` 5 passed（并入 7 tests / 2 files exit 0）。
- **缺口（partial）**：
  - `npm start`（3025）HTTP 200 **未直接取证**。历史冒烟在隔离 worktree @ `1be849f` 用 `next start -p 3026`（`/` 与 `/data-manager` 200），因 3025 被用户 dev server 占用。本 pass 探测 `http://localhost:3025/` 返回 200，但无法证明是该 `next start` 产物（无 Server 头、无法区分进程）→ 不计为证据；3026 无监听。
  - 计划文件名 `scripts/assert-static-export.mjs` 实际为 `scripts/verify-static-export.mjs`（计划文档未同步，属文档债）。
  - `build:electron*` 全链路未在执行前重放（guard 已单独验证 exit 1）。

### 1.4 S0-4 文档事实修正 — done（工具口径）/ partial（人工清单）

- 已达成：`npm run verify:docs` → **exit 0，`fail=0 warn=0`**：`store-count actual=62 documented=[62]`；三条 stale token（`19,790`、`测试步骤被注释`、`44 个 Zustand Store`）0 hits；`ci-branch` PASS；`ports` PASS；`index-links` broken=[]；`execution-pack` missing=[]。
- 复核到的具体项：`AGENTS.md:34` 写 **62 个 Store**；`ARCHITECTURE.md:157` 构建模式已改（server build + STATIC_EXPORT 条件导出，桌面待 S7）；`plans/INDEX.md:24-25` 已收录总计划与执行包；`.github/pull_request_template.md` 为合法 UTF-8（47 行）。
- **缺口（partial，对照 S0-baseline.md §S0-4 的 13 项清单）**：
  - `docs/nbl/plans/2026-05-10-phase1-store-decoupling.md` **无 Superseded banner**（`Select-String 'Superseded'` 无输出）。
  - `docs/nbl/ROADMAP.md:14` 仍含 “28 static pages”（历史验证记录语境，未按计划改为“3 真实页面 + 31 API route”）。
  - `pull_request_template.md` 缺计划要求的字段（任务 ID、写作用域、≤400 行声明、数据兼容/fixture、回滚方式）。
  - CHANGELOG 未动（TRACKING 已记“因脏改暂未动”）。

### 1.5 S0-5 死层标记与仓库卫生 — partial

- 提交 `195d996`：3 files，+82 / −113 — 新增 `scripts/gc-worktrees.ps1`(82)，`git rm` `src/app/page.tsx.v7`(102 行)、`src/components/visualization/VisualizationView.tsx.fix`(11 行)。
- 已达成：两死文件已删除且 0 引用；coordinator 层**已被 `1e7ffbc`（refactor: isolate v8 legacy code and remove dead coordinator layer）整体删除**（`src/store/coordinator/index.ts` 不存在，`git log --diff-filter=D` 指向该提交），比计划“标 deprecated”更彻底。
- **缺口（partial）**：
  - worktree **19 个**（`git worktree list`，目标 ≤5）。历史记录显示 Q22 后曾 25→6，此后 S1-S8 并行分支重新增长。
  - 根目录文件 **33 个**（目标 ≤20）。
  - `.eslintrc.json` 的 `no-restricted-imports` 仍指向 `@/store/coordinator` 等**已不存在**的路径 → 规则空转（低风险残留，建议 S6-12 或 S8-6 清理）。
  - Q22 在 `00-decisions.md` 仍为 **Pending**，但 GC 已按其推荐执行 → 决策状态与实际执行不一致（§3 备注）。

### 1.6 S0-6 测量基座 v1 — done（v1），基线 stale

- 产物：`scripts/perf/bundle-budget.mjs`、`scripts/perf/report-store-stats.mjs` + `report-store-stats.test.mjs`（2 tests）、`scripts/check-docs-facts.mjs`、`perf/budget.json`、`perf/bundle-baseline.json`、`perf/store-stats-baseline.json`、`perf/README.md`。
- 已达成：一条命令产出 JSON；`bundle-baseline.json` rootMain **3 files / 689.3KB raw / 211KB gzip**；`docs-facts` 可执行（exit 0）；`report-store-stats --check` 路径存在且能报差异；`report-store-stats --max-whole 10` 已接入 `npm run perf:gates`。
- **缺口 / stale**：
  - `perf/store-stats-baseline.json`（2026-10-21）为 **60 stores / 44 persist keys**；当前 **62 / 43** → `--check` **exit 1**（`stores 62 != baseline 60; persistCount 43 < baseline 44`）。44 含非 key 标记 `Hi-Res标识` 与外部 key `visualization-v8-store`，43 才是 S6-2 校正后的真实口径 → 需**批准后** `--json` 重建（见 §5、§6）。
  - 计划要求 `scripts/perf/bundle-budget.test.mjs`、`scripts/docs-facts.config.mjs` **不存在**（配置内联在 `check-docs-facts.mjs`）。
  - 计划输出路径 `perf/s0-baseline-2026-10-21.json` 不存在；`bundle-baseline.json` 的 `source` 指向的 `perf/bundle-report.json` 也不在库内。
  - “2 次运行 JSON diff=0”未复核（`generatedAt` 每次不同，需排除时间戳后比对）。

### 1.7 S0-7 ADR 与决策归档 — blocked（D1/D2/D7/D8）

- 实际：`docs/nbl/adr/README.md` + `0001-v8-visualization.md`、`0002-desktop-runtime.md`、`0003-audio-graph-ownership.md`、`0004-persistence-registry.md`、`0005-protected-views.md` → **5/8**（计划要求 0001..0008）。
- 状态均为 **`Proposed`**，`决策人: 待用户`；`0002` 额外标注“证据倾向 B”。
- **阻塞原因**：D1/D2/D7/D8 未拍板（§3）。D1 阻塞 S4-7 剩余（archive/key/契约）；D2 阻塞 S0-3 形态与 S7-4；D7 阻塞 S3-2/S3-3/S5-2；D8 阻塞 S7-8。缺 `0006/0007/0008` 三份 ADR。

---

## 2. 基线证据（verified / stale / missing）

| #   | 基线项                             | 值                                                                                                                                                     | 来源 / 命令                                                                                                       | 标签                                    | 说明                                                                                                      |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | S0 checkpoint commit               | `2b99173`，123 files / +27,294 / −1,967                                                                                                                | `git show --shortstat 2b99173`                                                                                    | **verified**                            | 当前 HEAD 的祖先（`merge-base --is-ancestor` exit 0）；不可变基线                                         |
| 2   | checkpoint 分支指针                | `11d661e`（2026-10-29 03:06，`2b99173` +15 commits）                                                                                                   | `git rev-parse` / `git rev-list --count`                                                                          | **stale**                               | 分支被后续可视化提交推进；主仓库工作区检出该分支；不能当 S0 基线                                          |
| 3   | 脏改盘点                           | 122 paths（`-uall`）；37 tracked files +3,595/−1,967；落后 master 11                                                                                   | `evidence/S0-dirty-inventory.txt`                                                                                 | **verified**（文件在库）                | 与 2026-10-27 记录一致                                                                                    |
| 4   | store-stats 基线                   | 60 stores / 44 keys；whole 161（25%）、whole-only 59；edges 25、SCC 1                                                                                  | `perf/store-stats-baseline.json`（2026-10-21）                                                                    | **stale**                               | 被 S4-7/S6 系列改变；`--check` exit 1                                                                     |
| 5   | store-stats 现状                   | 62 stores / 43 keys；registry 43/43；whole **0**；edges 23、SCC 0；getState `{domain:15, lib:4, store:195}`                                            | `node scripts/perf/report-store-stats.mjs --check`                                                                | **verified**（本次）                    | 与任务给的“62/43”一致                                                                                     |
| 6   | bundle 基线 rootMain               | 3 files / 689.3KB raw / **211KB gzip**；first load 8 scripts / 1,959.8KB / 607.2KB gzip；css 29KB gzip；async max 683.5KB；public 58.4MB               | `perf/bundle-baseline.json`（2026-10-28）                                                                         | **verified**（文件）                    | 任务给的 rootMain 211 = 该值                                                                              |
| 7   | bundle 现状检查                    | rootMain 3 files / 681.8KB raw / **208.4KB gzip**；`--check` **exit 1**（2 violations：maxAsyncChunk 675.9 > hardMax 400、publicMB 58.4 > hardMax 45） | `node scripts/perf/bundle-budget.mjs --check`（`.next` BUILD_ID `14Aloa_KTN-1GpcBiPK1R`，mtime 2026-10-29 18:31） | **verified（命令）**；provenance 未验证 | 构建产物未记录 commit，不能断言来自 HEAD；rootMain 未超 hardMax 230                                       |
| 8   | 包体预算                           | rootMain target 190 / hardMax 230；script 12/16；firstLoad 1700/2000；public 40/45；maxAsync 350/400                                                   | `perf/budget.json`                                                                                                | **verified**                            | rootMain 208.4–211 仍高于 190 target（Q10 缺口）                                                          |
| 9   | 文档基线（docs facts）             | `fail=0 warn=0`；store-count 62/62；ports 全 3025；ci-branch master；index-links 0 broken                                                              | `npm run verify:docs`                                                                                             | **verified**（本次，exit 0）            | store 数已从 S8-4 时的 59 更新为 62（S4-7 删除死 store 后统计口径变化）；docs-facts 不校验 persist key 数 |
| 10  | CI 触发配置                        | `push/PR → master` + `workflow_dispatch`；nightly `cron '0 18 * * *'`（02:00 +08）                                                                     | `.github/workflows/{deploy,nightly}.yml`                                                                          | **verified**（静态）                    | 无 `ci.yml`；Node 20                                                                                      |
| 11  | CI 运行记录 / required checks      | 无                                                                                                                                                     | —                                                                                                                 | **missing**                             | 未 push；Q02 Pending；`docs/nbl/CI.md` 只描述期望                                                         |
| 12  | `out/` 产物                        | 不存在                                                                                                                                                 | `node scripts/verify-static-export.mjs` → exit 2                                                                  | **verified**（缺失符合冻结预期）        | 桌面发布冻结（D2）                                                                                        |
| 13  | `perf/bundle-report.json`          | 不存在                                                                                                                                                 | 目录列举                                                                                                          | **missing**                             | `bundle-baseline.json.source` 指向它                                                                      |
| 14  | `perf/s0-baseline-2026-10-21.json` | 不存在                                                                                                                                                 | 目录列举                                                                                                          | **missing**                             | S0-6a 计划输出路径未落库                                                                                  |
| 15  | ADR 集                             | 5/8，全 `Proposed`                                                                                                                                     | `docs/nbl/adr/`                                                                                                   | **partial**                             | 缺 0006/0007/0008；无 Accepted                                                                            |

---

## 3. 决策登记（D1..D8）

来源：`00-decisions.md`（2026-10-21，状态总览未更新）。**D1-D8 全部 Pending，无一条 Accepted**。

| ID  | 决策                                   | 推荐                      | 当前状态                  | 阻塞任务（计划） | 对 S0/M0 的影响                                                                  |
| --- | -------------------------------------- | ------------------------- | ------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| D1  | V8 可视化处置                          | C：冻结→移植契约→删除实现 | **Pending**               | S4-7、S5-4       | S0-7 ADR 0001 仅 Proposed；S4-7 仍 partial（archive/key/契约未处置）             |
| D2  | Windows 桌面运行时形态                 | B：捆绑本地 Next 运行时   | **Pending**（证据倾向 B） | S0-3、S7-4/5/6   | **直接阻塞 S0-3 出口**：桌面发布保持冻结，`build:electron` fail-fast，out 不回填 |
| D3  | DSPProcessor / AudioGraphManager 去留  | A：deprecated 后删除      | **Pending**               | S2-5、S6-9       | 不在 S0 门内；ADR 0003 Proposed                                                  |
| D4  | 备份是否含音频二进制                   | A：默认不含               | **Pending**               | S1-2、S6-2       | 不在 S0 门内；ADR 0004 Proposed                                                  |
| D5  | 最低配置与质量档位                     | low=4核/8GB/1080p 集显    | **Pending**               | S5-6             | 不在 S0 门内；无 ADR                                                             |
| D6  | 主题 owner                             | A：新建 themeStore        | **Pending**               | S6-6/S6-7        | 不在 S0 门内；无 ADR                                                             |
| D7  | 受保护视图是否允许“仅订阅方式”等价改写 | A：允许，截图+Lead 复核   | **Pending**               | S3-2/S3-3、S5-2  | S0-7 ADR 0005 仅 Proposed；S3-2 仅采当前态截图                                   |
| D8  | 第三方解析源/平台 cookie 边界          | A：明示第三方源+用户确认  | **Pending**               | S7-8             | S0-7 无 0008 ADR；S7-8 未启动                                                    |

**执行期确认项（与 S0 相关）**：Q01 **Accepted 2026-10-27**（checkpoint 2b99173，未 push）；Q02 **Pending**（required checks / PAT，阻塞 S0-2 验证）；Q03 **Pending**（deploy.yml 的 Vercel job 去留）；Q22 **Pending**，但 `scripts/gc-worktrees.ps1 -Apply` 已执行（25→6）→ **状态与实际不一致，需回填 Accepted/部分**。

---

## 4. M0 出口门清单（E0-1..E0-7）

判定依据：S0-baseline.md §1 的出口指标 + 本次复核。

| 出口            | 指标                                                      | 判定                 | 证据                                                               | 阻塞原因 / 缺口                                                                           | 需要谁做什么                                                                                            |
| --------------- | --------------------------------------------------------- | -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| E0-1 基线可信   | 干净树 + 基线 commit + 4 命令复测                         | **达成（记录）**     | `2b99173`（祖先）、脏改清单、2026-10-27 四命令 exit 0              | 本 pass 未在 `2b99173` 重跑 4 命令（只验证 tsc@HEAD）                                     | 无（如需强证据：在 `2b99173` 的 worktree 重跑 4 命令）                                                  |
| E0-2 CI 真实    | PR/master 触发、required checks、3 连绿 ≤20min            | **partial**          | `deploy.yml` 触发已改；`verify:docs` ci-branch PASS                | 无 push、无 Actions 运行、无 required checks 配置、CI Node 20 ≠ 本地 Node 24              | **用户/仓库 owner**：授权 push + 配置 required checks（Q02）；决定 Q03                                  |
| E0-3 发布止血   | out 缺失/过期 exit≠0；3024=0；3025 返回 200               | **partial**          | guard exit 1；verify-static-export exit 2；3024 grep 0；ports PASS | `next start -p 3025` 的 200 未直接取证（历史用 3026）                                     | Lead：在空闲端口/停 dev 后补一次 3025 冒烟并留日志；D2 拍板后解冻                                       |
| E0-4 文档事实   | docs-facts exit 0、违规 0                                 | **达成（工具口径）** | `verify:docs` exit 0 fail=0 warn=0                                 | 人工清单 3 项未做（phase1 banner/ROADMAP:14/PR 模板字段）                                 | Lead：补 3 项或明确降级为 S1 文档债（Q23）                                                              |
| E0-5 死层与卫生 | coordinator 外部 0 + ESLint 禁入；worktree ≤5；根文件 ≤20 | **partial**          | 死文件已删、coordinator 层已删、gc 脚本在库                        | worktree **19**、根文件 **33**；ESLint 规则指向已删目录                                   | **用户授权 Q22 剩余项**（只删 clean worktree）；Lead 清理规则空转                                       |
| E0-6 测量基座   | 一条命令出 JSON；2 次 diff=0；数字复现                    | **partial**          | 3 个基线 JSON + 脚本；docs-facts exit 0                            | store-stats baseline stale（`--check` exit 1）；bundle 基线源 JSON 缺失；2 次 diff 未记录 | **Lead/用户批准**重建 `store-stats-baseline.json`；补 `bundle-report.json` 或改 baseline 的 source 字段 |
| E0-7 决策       | 8 ADR 状态明确；D1/D2/D7 有结论                           | **blocked**          | 5 ADR 全 Proposed                                                  | D1/D2/D7/D8 Pending；缺 3 份 ADR                                                          | **用户**：拍板 D1/D2/D7/D8；Lead 转 Accepted 并补 0006-0008                                             |

**M0 出口门：未通过（1 项达成、1 项工具口径达成、4 项 partial、1 项 blocked）。** 按 S0-baseline.md “未达标项写原因并降级为 S1 阻塞债务，不允许静默跳过”——本文件即该原因的正式记录。

---

## 5. 缺失产物清单

| #   | 产物                                         | 期望来源       | 现状                              | 影响                                                           |
| --- | -------------------------------------------- | -------------- | --------------------------------- | -------------------------------------------------------------- |
| 1   | CI 首次运行记录 / required checks 截图       | S0-2           | 无（未 push）                     | E0-2 无法判定；3 连绿无证据                                    |
| 2   | `perf/bundle-report.json`                    | S0-6a          | 缺失                              | `bundle-baseline.json.source` 断链；bundle diff 无法从基线复现 |
| 3   | `perf/s0-baseline-2026-10-21.json`           | S0-6a 计划路径 | 缺失                              | 计划与实现路径不一致（实际 `bundle-baseline.json`）            |
| 4   | `scripts/perf/bundle-budget.test.mjs`        | S0-6a          | 缺失                              | 预算脚本无单测（仅 `report-store-stats.test.mjs` 2 例）        |
| 5   | `scripts/docs-facts.config.mjs`              | S0-6b          | 缺失（配置内联）                  | 口径分散在 `check-docs-facts.mjs`                              |
| 6   | ADR 0006 / 0007 / 0008                       | S0-7           | 缺失                              | D5/D6/D8 无 ADR；S0-7 达不到“8 个 ADR”                         |
| 7   | D1/D2/D7/D8 签字结论                         | S0-7           | 缺失                              | S0-7 blocked；S0-3/S7-4/S3-2/S7-8 连带阻塞                     |
| 8   | `next start -p 3025` HTTP 200 日志           | S0-3           | 缺失（历史为 3026）               | E0-3 的“3025 返回 200”只能算间接                               |
| 9   | `store-stats-baseline.json` 的 43-key 口径   | S0-6 / S6-2    | 仍为 44-key 旧基线                | `perf:gates` 无法启用 `--check`；`--max-whole` 单独可用        |
| 10  | worktree ≤5 / 根文件 ≤20 的达成证据          | S0-5           | 未达成（19 / 33）                 | E0-5 不关闭                                                    |
| 11  | 2 次基线运行 diff=0 记录                     | S0-6           | 未记录                            | E0-6 的“可复现”仅部分成立                                      |
| 12  | `scripts/assert-static-export.mjs`（计划名） | S0-3           | 实际为 `verify-static-export.mjs` | 计划文档命名不一致（文档债，非功能缺口）                       |

---

## 6. 复现命令

在仓库根目录（任意 worktree）执行；退出码为 2026-10-29 本 pass 实测。

```powershell
# 文档事实（S0-4 / E0-4）
npm run verify:docs                                        # exit 0；fail=0 warn=0

# 类型（S0-1 基线项）
npx tsc --noEmit                                           # exit 0

# store 统计（S0-6 / E0-6）：当前应失败，因为基线过期
node scripts/perf/report-store-stats.mjs --check           # exit 1：62!=60、43<44
node scripts/perf/report-store-stats.mjs --json perf/store-stats-baseline.json   # 重建基线（需 Lead/用户批准）
node scripts/perf/report-store-stats.mjs --max-whole 10    # exit 0（perf:gates 实际使用的口径）

# 包体（S0-6）：需要 .next 构建产物
node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json
node scripts/perf/bundle-budget.mjs --check                # 当前 exit 1：maxAsyncChunk 675.9>400、publicMB 58.4>45
node scripts/perf/bundle-diff.mjs                          # 与 perf/bundle-baseline.json 比较（需 bundle-report.json）
npm run perf:gates                                         # store budgets + whole≤10 + bundle markers

# 构建产物与桌面冻结（S0-3 / E0-3）
node scripts/verify-static-export.mjs                      # 当前 exit 2（out 缺失）；过期=3；新鲜=0
node scripts/verify-desktop-release-ready.mjs              # 当前 exit 1（D2 未定，发布冻结）
git grep -n "3024" -- package.json Dockerfile docker-compose.yml   # exit 1（无匹配）
npm start                                                  # 需空闲 3025；期望 / 与 /data-manager 200（本 pass 未取证）

# 针对性测试
npx vitest run scripts/verify-static-export.test.mjs scripts/perf/report-store-stats.test.mjs  # 2 files / 7 tests passed
npm run test -- --run                                      # 全量（本 pass 未跑；最近记录 310 files / 1930 passed + 1 skipped）

# 卫生与基线可追溯性（S0-1 / S0-5）
git merge-base --is-ancestor 2b99173 HEAD; echo $LASTEXITCODE          # 0
git rev-list --count 2b99173..checkpoint/gesture-air-control-overhaul-20261027   # 15（分支已漂移）
git worktree list | Measure-Object -Line                   # 19（目标 ≤5）
(Get-ChildItem -File | Measure-Object).Count               # 33（目标 ≤20）
node scripts/check-store-budgets.mjs                       # exit 0：111 files / 19,182 lines / SCC 0
```

---

## 7. 本次复核命令与退出码（2026-10-29）

| 命令                                                                                            | 退出码 | 结果摘要                                                       | 时间  |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------- | ----- |
| `npm run verify:docs`                                                                           | **0**  | fail=0 warn=0；store-count 62/62；ports 全 3025                | 19:24 |
| `npx tsc --noEmit`                                                                              | **0**  | 无输出                                                         | 19:24 |
| `node scripts/perf/report-store-stats.mjs --check`                                              | **1**  | stores 62≠60、persist 43<44；whole 0、edges 23、SCC 0          | 19:23 |
| `node scripts/perf/bundle-budget.mjs --check`                                                   | **1**  | rootMain 208.4KB gzip；2 violations（maxAsyncChunk、publicMB） | 19:29 |
| `node scripts/verify-static-export.mjs`                                                         | **2**  | `out/index.html` 不存在                                        | 19:27 |
| `node scripts/verify-desktop-release-ready.mjs`                                                 | **1**  | 发布冻结（D2/S7-4）                                            | 19:28 |
| `npx vitest run scripts/verify-static-export.test.mjs scripts/perf/report-store-stats.test.mjs` | **0**  | 2 files / 7 tests passed（2.32s）                              | 19:25 |
| `node scripts/check-store-budgets.mjs`                                                          | **0**  | 111 files / 19,182 lines / SCC 0                               | 19:27 |
| `npx prettier --check .github/workflows/{deploy,nightly}.yml`                                   | **1**  | 仅格式告警（YAML 可解析）                                      | 19:28 |
| `git grep -n "3024" -- package.json Dockerfile docker-compose.yml`                              | **1**  | 无匹配（预期）                                                 | 19:26 |
| `git merge-base --is-ancestor 2b99173 HEAD`                                                     | **0**  | checkpoint 在集成线上                                          | 19:26 |
| `Invoke-WebRequest http://localhost:3025/ -Method Head`                                         | 200    | 有服务在监听，但无法证明是 `next start` 产物                   | 19:26 |

未执行：全量 `npm run test -- --run`、`npm run build`、`npm run lint`（docs-only 任务；这些结果分别记录于 2026-10-29 S2 栈合入与 S8 证据文件）。

---

## 附录 A：历史 checkpoint 日志（原文保留）

> 以下为 2026-10-27 至 2026-10-29 期间本文件的历史内容，逐字保留；其中 “Branch: checkpoint/... @ 2b99173” 在 2026-10-29 已漂移为 `11d661e`（见 §2 #2）。

# S0-1 checkpoint & baseline evidence

- Date: 2026-10-27 13:39–13:52 +08:00
- Operator: DSH agent (Lead)
- Branch: checkpoint/gesture-air-control-overhaul-20261027
- Checkpoint commit: 2b991731a1e48d5b3ba8084cc2b18276fb5b1e7d
- Original branch: feature/gesture-air-control-overhaul @ c73a872 (untouched)
- master: 90c2152 (+11 commits ahead of snapshot base)
- Dirty inventory: 122 paths (git status -uall); checkpoint diff: 123 files changed, +27,294 / −1,967
- Snapshot contents: gesture air-control overhaul; handwritten lyric MV; arch-perf S0/S1 baseline work (docs/plans/scripts/perf/storage); handover package docs/scripts.
- Git safety: no reset/clean/push; original feature branch untouched; checkpoint commit used --no-verify because lint-staged would reformat the whole snapshot. Follow-up PRs must use normal hooks.

## Baseline verification (clean tree @ 2b99173)

| Command                                                                                                              | Result                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| npx tsc --noEmit --incremental false --pretty false                                                                  | exit 0                                                                                                                             |
| npm run test -- --run                                                                                                | 208 files / 1284 tests passed, 77.52s                                                                                              |
| npx eslint src (chunks: src/components; src/lib+store+hooks+utils+types+services+test+app+workers, --max-warnings=0) | both exit 0, 0 errors / 0 warnings                                                                                                 |
| npm run build                                                                                                        | isolated worktree @2b99173 + node_modules junction: next build --webpack exit 0; 28 static pages + 31 API routes; TypeScript 16.1s |

Environment: Windows 11, Node v24.16.0 (same as HANDOVER §2/§7).

## Deviations vs plan baseline

- Plan baseline (§2.2) expected 205 test files / 1267 tests; actual 208 / 1284 (+3 files / +17 tests: gesture integration + handwritten MV coverage).
- Dirty count 122 vs plan's ~55: snapshot accumulated handwritten MV, S0/S1 baseline, handover docs between 2026-10-21 and 2026-10-27.
- Snapshot base c73a872 is 11 commits behind master; a rebase/merge to master is required before splitting PRs.
- Build ran in an isolated worktree because the user's dev server (PID 6656) was serving :3025; main .next was not cleaned and the dev server stayed healthy.

## Open items after S0-1

- Q02 (push/required checks) and GitHub admin permissions remain pending.
- D1/D2/D7 decisions remain pending (V8 dispose / desktop runtime / protected-view subscription rewrite).
- S0-3 port unification and S0-5/S0-7 partially complete; see TRACKING.
- Checkpoint --no-verify is documented; first split PR should run husky/lint-staged normally.

## S0-3 / S0-5 follow-up (2026-10-27)

- S0-3 commit 84305f6: start port 3025 (3024 refs = 0); build:electron\* now runs verify-desktop-release-ready guard first (exit 1 while frozen); added build:static; verify-static-export refactored to an exported pure evaluateOutFreshness + 5 vitest cases; CLI exits 2 for missing out, 3 for stale; observed exit 2 in main worktree; guard observed exit 1. Deferred: npm start:3025 HTTP 200 (dev server still serving 3025).
- S0-5 commit 195d996: removed tracked dead files src/app/page.tsx.v7 and src/components/visualization/VisualizationView.tsx.fix (0 code references); added scripts/gc-worktrees.ps1 (dry-run default; observed 25 worktrees, 5 dirty skipped, clean candidates listed). Worktree <=5 and root-file cleanup remain blocked on Q22 authorization.
- Concurrency note: src/app/dev/lyric-stage/page.tsx was recreated at 13:47 by another active session (temporary handwritten-MV QA route); intentionally left untracked and not committed.

## S0-3 HTTP smoke + S0-5 worktree GC (2026-10-27 evening)

- S0-3 production smoke: isolated worktree @ 1be849f, node_modules junction; `npx next build --webpack` exit 0; `next start -p 3026` (3025 occupied by the user's dev server, PID 6656) returned HTTP 200 for `/` and `/data-manager`; server stopped and worktree removed. Config source of truth remains port 3025.
- S0-5 worktree GC: `scripts/gc-worktrees.ps1 -Apply` reduced worktrees 25 → 6 (19 clean removed, 5 dirty skipped; branches/commits untouched). Remaining 6 = main + 5 dirty worktrees. Root-file cleanup (31 files vs <=20 target) still pending; no user files were deleted.
- NOTE: another session had uncommitted handwritten-MV changes in the main worktree during this pass; they were not staged/committed.

---

## 附录 B：修订记录

| 日期       | 变更                                                                      | 提交                                         |
| ---------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| 2026-10-27 | 记录 S0-1 checkpoint 与基线复测                                           | `7156f8b`                                    |
| 2026-10-27 | 追加 S0-3/S0-5 复核证据                                                   | `1be849f`                                    |
| 2026-10-27 | 关闭 S0-3 并记录 worktree GC                                              | `6f7a3bc`                                    |
| 2026-10-29 | 重构为 S0 阶段出口证据（任务表/基线/决策/M0/缺失/复现），原文保留于附录 A | 本次提交 `docs(s0): add stage exit evidence` |
