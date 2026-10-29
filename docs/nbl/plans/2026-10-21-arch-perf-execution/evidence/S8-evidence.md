# S8 阶段退出证据（M8 出口门）

> 计划依据：[S8-quality-governance.md](../S8-quality-governance.md) §2.1 出口 E1–E6（行 41–51）、§4 任务总表（行 81–92）、§5 逐任务（行 96–490）、§6 验证与证据（行 492–516）
> 看板：[TRACKING.md](../TRACKING.md) §S8（行 136–144）、M8 出口门（行 138）、汇总 S8 行（行 20）
> 生成时间：2026-10-29 19:20（Asia/Shanghai）
> worktree：`D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`
> 分支：`docs/s8-evidence`（自 `87c8fae` 创建；该提交同时是 `integration/s2-audio` 的 HEAD，即 docs(s7) 证据提交）
> 约束：仅新增本文档；未 push；未改动主工作区 `D:/26project/music_source_code_V1.1_full/music_source_code`；未触发任何真实 CI run。
> 标注约定：**实测** = 本轮在本 worktree 执行并捕获 exit code；**历史** = TRACKING/提交时记录；**未运行** = 无任何执行证据（不推断、不补写结果）；**需 CI** = 只能在 GitHub Actions / branch protection 上取得证据。

## 0. 结论（先看这里）

- **任务完成度**：S8 共 6 个任务——**3 done（S8-1、S8-4、S8-6，本地口径）**；**2 partial（S8-2：5 域 enforce 已 PASS，但缺 3 域与 PR delta；S8-5：清单 + dry-run，无 release workflow）**；**1 partial/blocked（S8-3：4 周历史 blocked）**。`git log --all --oneline --grep='s8-'` 实测 **14 条**提交（全部 2026-10-29）；另有 1 条 S8-4 文档纠偏提交 `6300fe8`（`docs: sync store count to 59`）不含 "s8" 字样，按 TRACKING 引用补记。
- **本地门禁快照（本轮实测，全部 exit 0）**：全量 vitest **311 files / 1933 tests passed**（110.82s）；`tsc --noEmit` **0 errors**；`npm run lint` **0 diagnostics**；`perf:gates` PASS（111 个 store 文件、19,182 行、SCC 0；62 stores / 43 persist keys；whole-store 订阅 **0**）；`verify:docs` **fail=0 warn=0（8/8 PASS）**；`check-store-budgets` PASS（111 files / 19,182 行 / SCC 0）；`verify:layers` **0 errors / 27 warnings**（852 modules / 2031 dependencies）；覆盖率五域 **5/5 PASS**；`bundle-diff` PASS；`release:dry-run --skip-build` **3 PASS / 1 SKIP**。
- **不能声明（未运行）**：① CI required checks 全绿与 ≤12min wall——**未运行**，本分支领先 `origin/master` **389 个提交**且未 push，仓库 CI 只在 `master` 触发；② nightly 连续 4 周无回归——**0 次运行**，`perf/perf-history.jsonl` **不存在**；③ 包体 hardMax 拦截——`bundle-budget` 本轮报 **2 个 hardMax 违规仍 exit 0**；④ PR 覆盖率 delta >0.5pp 对比——未实现。
- **S8-1 出口 E1 blocked on push 授权**；**S8-3 的 4 周回归历史 blocked on CI 运行 + commit-back 授权**；其余按"本地完成 / CI 未运行"如实分列（§2、§5）。
- **本轮新发现（诚实登记）**：
  1. `perf/perf-history.jsonl` **完全不存在**（0 行，验收要求 ≥28 行）；nightly 用 `actions/checkout` 的干净树，`permissions: contents: read`（`.github/workflows/nightly.yml:8-9`），**没有 commit-back**，因此即使每天跑成功，历史也只在单次 artifact 里追加 1 行，不跨 run 累积。
  2. nightly 的 "Audio metrics (optional)" 步骤条件 `hashFiles('scripts/perf/audio-metrics.mjs') != ''`（`:40-43`）**会命中**（脚本存在，1.7KB），但该脚本是**浏览器 DevTools console recipe**：Node 下只打印粘贴说明、不写 `perf/audio-metrics.json`（`scripts/perf/audio-metrics.mjs:16-22`），因此 `append-history` 永远走"无 metrics"分支——CI 里这一步是 **no-op**，不产生 runtime/FPS/heap 数据。
  3. CI `build` job 只跑 `bundle-budget --json`（report-only，`.github/workflows/deploy.yml:95-96`），没有 `--check`；`bundle-diff` 只出现在 nightly 且非 required。本地实测 `bundle-budget` 报 `maxAsyncChunkKB=675.9 > 400`、`publicMB=58.4 > 45` 两个 FAIL，**进程仍 exit 0**——"超阈值 fail" 在 CI 上不成立。
  4. 计划指定的落盘路径大面积未采用：`docs/nbl/quality/**`、`scripts/quality/**`、`scripts/release/preflight.mjs`、`.github/workflows/release.yml` **均不存在**；实现分别落在 `perf/coverage-domains.json`、`scripts/check-*.mjs`、`scripts/perf/*.mjs`、`docs/nbl/CI.md`、`docs/nbl/RELEASE-CHECKLIST.md`、`docs/nbl/BACKLOG.md`。
  5. 覆盖率分域只有 **5 个域**（audio/utils/store/services/hooks），计划 8 域中的 `lib-others`/`workers`/`global` 未建；`components` 未纳入；`perf/coverage-domains.json` 的 `commit` 仍记录 `86dc844`、`measuredAt` 2026-10-28（历史快照，当前实测已高于地板）。
  6. **口径漂移**：TRACKING S8-4 条写 "59/43"，当前实测为 **62 stores / 43 persist keys**（`perf:gates` 与 `verify:docs` 均报 62；`AGENTS.md` 已同步 62）。TRACKING 该行是提交时快照，未随 S6/S4-7 后续变化回填。

## 1. 环境与统计口径

| 项           | 值                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------- |
| OS / shell   | Windows / Windows PowerShell 5.1（本环境无 `pwsh` 7）                                             |
| Node / npm   | v24.16.0 / 11.13.0（本轮 `node -v` / `npm -v`）                                                   |
| 测试框架     | Vitest 4.1.5（jsdom，`vitest run`）                                                               |
| 分支 / 基点  | `docs/s8-evidence` ← `87c8fae`（`integration/s2-audio` HEAD）                                     |
| 与远端关系   | `origin/master` = `6a211e1`；`git rev-list --count origin/master..HEAD` = **389**                 |
| S8 提交数    | `git log --all --grep='s8-' -i` = **14**；另有 `6300fe8`（S8-4 文档纠偏）                         |
| 变更行数来源 | `git show --numstat` 按任务分组求和（代码/测试/文档合并计）                                       |
| 构建产物     | `.next/BUILD_ID = 14Aloa_KTN-1GpcBiPK1R`，mtime 2026-10-29 18:30（**非本轮构建**）；`out/` 不存在 |

> 行数口径：S8-1 等任务的 "文件 / 行" 为该任务全部提交的 `numstat` 求和，同一文件跨提交会重复计入行数、去重后计文件数；与计划里 "子 PR ≤400 行" 的按 PR 口径不同，仅用于规模参考。

## 2. S8-1..S8-6 交付与验证

### 2.0 `git log --all --oneline --grep='s8-'`（实测 14 条）

```text
f508e4c 2026-10-29 docs(s8-6): add long-term backlog with triggers
f2104b0 2026-10-29 docs(s8-3): record perf history and dashboard
3b7c9b8 2026-10-29 perf(s8-3b): add perf history and dashboard
a7da509 2026-10-29 docs(s8-5): mark release checklist done
b33c8ce 2026-10-29 docs(s8-5): add release checklist and dry-run
1f74dd9 2026-10-29 docs(s8-3): record bundle diff and nightly partial
dba8e6e 2026-10-29 perf(s8-3): add bundle diff and nightly regression workflow
da68c5e 2026-10-29 docs(s8-1): mark parallel CI gates done
f399eef 2026-10-29 ci(s8-1b): parallelize verify jobs to meet 12min budget
13ae6d3 2026-10-29 docs(s8-1): record CI coverage gate and required checks
da94769 2026-10-29 ci(s8-1): wire coverage gate and required checks
7e2acb2 2026-10-29 docs(s8-2): mark coverage thresholds done
c4ce42b 2026-10-29 test(s8-2): enforce per-domain coverage thresholds
86dc844 2026-10-29 docs(s8-4): add local docs-facts script and mark done
```

> 补充：`6300fe8 docs: sync store count to 59 (43 persisted)`（AGENTS.md 1/1、ARCHITECTURE.md 3/3）是 TRACKING 引用的 S8-4 提交，但提交信息不含 "s8"。全部 14 条均为当前 HEAD 的祖先（`git merge-base --is-ancestor` 逐条校验 exit 0）。

### 2.1 任务表

| ID   | 状态（诚实口径）                                                     | 提交（`--grep='s8-'`）           | 文件 / 行（numstat 汇总） | 定向测试（本轮实测）                                                                                                                   | exit | 证据 / 缺口                                                                                                                                                                              |
| ---- | -------------------------------------------------------------------- | -------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S8-1 | **done（本地门禁）/ 出口 E1 未运行（blocked：push 授权）**           | `da94769`、`f399eef`（+ docs 2） | 6 文件 / +392 −82         | `scripts/ci-required-checks.test.mjs` **9**、`scripts/perf/ci-perf-gates.test.mjs` **3** → 2 文件 / **12 passed**                      | 0    | CI 三并行 job + `quality-gate` 聚合、coverage 域接入、CI.md 到位；**无真实 wall 数据**（7-9/10-12min 为估算）、未跑 actionlint、无 branch protection 证据、无绿 run URL。                |
| S8-2 | **done（本地 enforce）/ CI 未运行；缺 3 域与 PR delta**              | `c4ce42b`（+ docs `7e2acb2`）    | 6 文件 / +321 −4          | `scripts/perf/check-coverage-domains.test.mjs` **6 passed**；`npm run test:coverage:domains` **PASS 5/5 域**（311 files / 1933 tests） | 0    | 地板 = 实测 −5pp、只升不降、缺失 summary exit 2；**未做**：`lib-others/workers/global` 域、PR >0.5pp 历史对比、burn-in 周报、负向 fixture 的 CI 化。                                     |
| S8-3 | **partial — 4 周回归历史 blocked（CI 运行 + commit-back）**          | `dba8e6e`、`3b7c9b8`（+ docs 2） | 12 文件 / +740 −57        | `bundle-diff` **4**、`perf-history` **4**、`soak` **4** → 3 文件 / **12 passed**；`scripts/perf` 全目录 **8 文件 / 34 passed**         | 0    | bundle-diff CLI **PASS**（rootMain −2.6KB、first-load +9.5KB ≤ +10KB）；nightly 工作流在；**4 周历史 0/28 行**、无 commit-back、无 runtime/FPS/heap 生产者、2h soak 未做、hardMax 未拦。 |
| S8-4 | **done（本地）**                                                     | `6300fe8`、`86dc844`             | 4 文件 / +8 −7            | 无专属单测；门禁即 `npm run verify:docs` → **fail=0 warn=0（8/8 PASS）**                                                               | 0    | 8 项事实校验（store 数、4 类禁用词、CI 分支、端口、INDEX 链接、执行包文件）；**无** `doc-facts.config.json`、无 AUTO 块生成器、无负向 fixture 用例、季度对账仅流程约定。                 |
| S8-5 | **partial（清单 + dry-run；无 release workflow / 14 项 preflight）** | `b33c8ce`（+ docs `a7da509`）    | 6 文件 / +415 −3          | `scripts/release-dry-run.test.mjs` **9 passed**；`npm run release:dry-run -- --skip-build` **3 PASS / 1 SKIP**                         | 0    | 清单 163 行（10 章）、dry-run 仅覆盖 R4（部分）与 R11；**缺** `release.yml`、`preflight.mjs`、`protected-paths.json`，R1-R3/R5-R10/R12-R14 人工。                                        |
| S8-6 | **done（backlog 已排期）**                                           | `f508e4c`                        | 6 文件 / +190 −3          | `scripts/docs-backlog.test.mjs` **8 passed**                                                                                           | 0    | `docs/nbl/BACKLOG.md`（L1–L12，触发条件可测量、7 列、季度评审 6 步）；**缺** `docs/nbl/quality/` 目录与 `quarterly-YYYY-QN.md` 模板；L 项本身 0 启动。                                   |

- 合计：**14 条 grep 命中 + 1 条补记提交，40 个文件触点，+2,066 −156 行**；定向测试 **8 文件 / 47 passed**（另有 `scripts/perf` 汇总 34 passed 作为交叉验证）。
- 状态判定：**done** = 计划验收项有可复跑本地证据且 TRACKING 勾选；**partial** = 有交付但验收门槛未达；**blocked** = 需外部授权/CI 才能产生证据。S8-1 列表里虽写 done，但**出口 E1 明确未运行**，不能据此判 M8 绿。

### 2.2 定向测试明细（本轮实测）

| 任务 | 命令（`npx vitest run <file> --reporter=dot`） | 结果                     | exit |
| ---- | ---------------------------------------------- | ------------------------ | ---- |
| S8-1 | `scripts/ci-required-checks.test.mjs`          | 1 文件 / 9 passed        | 0    |
| S8-1 | `scripts/perf/ci-perf-gates.test.mjs`          | 1 文件 / 3 passed        | 0    |
| S8-2 | `scripts/perf/check-coverage-domains.test.mjs` | 1 文件 / 6 passed        | 0    |
| S8-3 | `scripts/perf/bundle-diff.test.mjs`            | 1 文件 / 4 passed        | 0    |
| S8-3 | `scripts/perf/perf-history.test.mjs`           | 1 文件 / 4 passed        | 0    |
| S8-3 | `scripts/perf/soak.test.mjs`                   | 1 文件 / 4 passed        | 0    |
| S8-5 | `scripts/release-dry-run.test.mjs`             | 1 文件 / 9 passed        | 0    |
| S8-6 | `scripts/docs-backlog.test.mjs`                | 1 文件 / 8 passed        | 0    |
| 合计 | 8 文件                                         | **47 passed / 0 failed** | 0    |

> 口径：全部为 Node/jsdom 单测与静态文件断言；**没有** GitHub Actions、branch protection、真实 nightly 调度、浏览器/FPS/heap 或 2h soak 执行。`npx vitest run a b` 传多个位置参数在本仓库会报 "No test files found"（vitest 4 只取单个过滤式），故逐文件运行。

### 2.3 逐任务判定说明

**S8-1（done 本地 / E1 未运行）** — `.github/workflows/deploy.yml`（188 行）已是 `push/pull_request → master` + `workflow_dispatch`（`:3-8`），三个并行 job：`quality`（`:22-45`：tsc → eslint src `--max-warnings=0` → `verify:layers` → `npm run test -- --run`）、`coverage`（`:47-64`：`test:coverage:domains`）、`build`（`:66-102`：`npm run build` → `perf:gates` → bundle report → docs facts），加聚合 `quality-gate`（`:105-126`，`if: always()`、`needs: [quality, coverage, build]`、逐项断言 `needs.*.result == success` 并写 `$GITHUB_STEP_SUMMARY`）。`desktop-windows` 与 `deploy-to-vercel` 均 `needs: quality-gate`。**未运行**：无 GitHub Actions run（本分支未 push，CI 只在 master 触发），因此 "required checks 全绿 + ≤12min" 无证据；CI.md 的 7-9min（暖）/10-12min（冷）是"本机实测 × 1.8-2.5"估算（`docs/nbl/CI.md:21-26`）。另：CI 用 `node-version: '20'`，与计划写的 Node 24 不同。

**S8-2（done 本地）** — `perf/coverage-domains.json`（89 行，5 域，`burnInMarginPp: 5`，地板 = 实测 −5pp）+ `scripts/check-coverage-domains.mjs`（137 行；默认 enforce，`--report-only`/`--update`（只升不降），summary 缺失 exit 2）+ `package.json:36` 的 `test:coverage:domains`。`vitest.config.ts` 仅新增 `json-summary` reporter（1 行），全局阈值仍 30/20/30/30（未按计划提高到 50/45/55/50）。本轮 5 域全部高于地板（§4.1）。

**S8-3（partial，4 周历史 blocked）** — 交付：`scripts/perf/bundle-diff.mjs`（115 行，阈值 rootMain gzip +5KB / first-load gzip +10KB，`--update` 显式重建基线）、`scripts/perf/append-history.mjs`（111 行，schema/ts 严格递增校验）、`scripts/perf/perf-dashboard.mjs`（86 行）、`scripts/perf/perf-history-lib.mjs`（51 行）、`.github/workflows/nightly.yml`（76 行，cron `0 18 * * *` = 北京 02:00 + dispatch）。**未达成**：E6 要求"4 周 × 7 天 nightly 成功、`perf-history.jsonl` ≥28 行"——当前 **0 行、0 次运行**；nightly 只读 checkout（`contents: read`）且无 commit-back，历史不跨 run 累积；"audio metrics" 在 CI 是 no-op（§0-2）；runtime FPS/heap/2h soak 无生产者；hardMax（`maxAsyncChunkKB` 400、`publicMB` 45）未进入阻断路径。

**S8-4（done）** — `scripts/check-docs-facts.mjs`（134 行）8 项检查全部 PASS：store 计数与文档一致（actual=62 documented=[62]）、`19,790` 清零、CI 注释步骤清零、`44 个 Zustand Store` 清零、CI 触发分支 master-only、端口矩阵 3025（package dev/start、Dockerfile EXPOSE/ENV、compose）、INDEX 链接无断链、执行包文件齐全。**缺口**：无 `docs/nbl/quality/doc-facts.config.json`（enforced 文件/禁用词写在脚本里）、无 AUTO 块 `gen-docs-baseline.mjs`、无负向 fixture 测试（计划要求注入 19,790 必须 exit 1，未执行）、季度对账无模板文件。

**S8-5（partial）** — `docs/nbl/RELEASE-CHECKLIST.md`（163 行，§0 快速演练 → §8 门禁覆盖与缺口）+ `scripts/release-dry-run.mjs`（165 行：tsc/docs-facts/perf-gates + build 默认 SKIP，`--build/--skip-build/--json/--check-only`；失败 exit 1、非法参数 exit 2）。清单 §8 自认：R1/R2/R3/R5-R10/R12-R14 仍人工；R9 `src/test/persistence` 不存在、R10 无 `protected-paths.json`、R7/R8 无 `release.yml`。**未做**：S8-5b 的 `.github/workflows/release.yml`、S8-5a 的 `preflight.mjs` 14 项、tag dry-run 演练。

**S8-6（done）** — `docs/nbl/BACKLOG.md`（46 行，L1–L12：L1–L10 来自计划 + L11 字体自托管 + L12 两路由 entry 拆分；7 列：id/事项/理由/触发条件/优先级/owner/计划链接；季度评审 6 步 + 连续 2 季度未触发归档）；`scripts/docs-backlog.test.mjs`（133 行，8 例：表头列数、L1-L10 覆盖与唯一、触发条件非占位含数字、理由/优先级/owner、12 个要素 token、计划链接存在、季度流程含归档、ROADMAP/PROCESS 反链）；ROADMAP/PROCESS/AGENTS 已加入口。**缺口**：不新增 CI 步骤（随全量 vitest 跑）；`docs/nbl/quality/quarterly-YYYY-QN.md` 仅约定路径，目录/模板未建。

## 3. 质量门禁证据（文件/测试 + 本地 vs 需 CI）

| 门禁                 | 实现 / 配置（文件:行）                                                                                                                                                | 断言口径                                                                                                                                                                                                                                                     | 本地（本轮）                                                         | CI 证据                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| required checks 结构 | `scripts/ci-required-checks.test.mjs`（165 行，9 例，`:62-164`）                                                                                                      | ≥3 并行 job、9 条必过命令各只出现在 1 个 job、coverage 独立于 quality、build 拥有 build/perf:gates/bundle/docs、每 job 有 timeout、quality-gate 聚合 + summary、desktop/vercel 依赖它、CI.md 覆盖 token 与 12min、store-stats --check 禁用有据、PROCESS 链接 | **9 passed，exit 0**                                                 | 随 `quality` job 的全量 vitest 运行；**未运行**            |
| quality-gate 聚合    | `.github/workflows/deploy.yml:105-126`                                                                                                                                | `if: always()` + `needs: [quality, coverage, build]` + 三个 `needs.*.result = success` + step summary；唯一建议 required check                                                                                                                               | 结构由上述测试断言                                                   | **需 CI**（workflow 语义与 branch protection）；**未运行** |
| 覆盖率分域           | `perf/coverage-domains.json`（89 行）+ `scripts/check-coverage-domains.mjs`（137 行）+ `package.json:36`                                                              | 5 域地板 = 实测 −5pp、只升不降、缺失 summary exit 2、默认 enforce                                                                                                                                                                                            | **PASS 5/5，exit 0**（§4.1）                                         | `coverage` job；**未运行**                                 |
| 文档事实             | `scripts/check-docs-facts.mjs`（134 行）+ `npm run verify:docs`                                                                                                       | 8 项：store 计数、`19,790`、CI 注释步骤、`44 个 Zustand`、CI 分支、端口矩阵、INDEX 链接、执行包文件                                                                                                                                                          | **fail=0 warn=0（8/8 PASS）**                                        | `build` job 的 Docs facts 步骤；**未运行**                 |
| 性能/包体门禁        | `package.json:38` `perf:gates`；`scripts/check-store-budgets.mjs`（166 行）、`scripts/perf/report-store-stats.mjs`（258 行）、`scripts/perf/check-bundle-markers.mjs` | store 行预算 ≤400/文件、SCC 0、whole-store 订阅 ≤10、初始 bundle 标记（jsmediatags/mediapipe）0 命中                                                                                                                                                         | **PASS**（111 files/19,182 行/SCC 0；62/43；whole 0；9 文件 0 标记） | `build` job；**未运行**                                    |
| bundle 回归          | `scripts/perf/bundle-diff.mjs`（115 行）+ `perf/bundle-baseline.json` + `nightly.yml:38-39`                                                                           | rootMain gzip ≤ baseline+5KB、first-load gzip ≤ baseline+10KB；`--update` 仅显式                                                                                                                                                                             | **PASS，exit 0**（−2.6KB / +9.5KB）                                  | 仅 nightly（非 required）；**未运行**                      |
| 发布演练             | `scripts/release-dry-run.mjs`（165 行）+ `docs/nbl/RELEASE-CHECKLIST.md`（163 行）                                                                                    | 4 项（tsc/docs-facts/build/perf-gates），PASS/FAIL/SKIP 表，失败 exit 1                                                                                                                                                                                      | **3 PASS / 1 SKIP，exit 0**                                          | 无 release workflow；**需人工/未来 CI**                    |
| nightly 性能回归     | `.github/workflows/nightly.yml`（76 行）                                                                                                                              | cron 02:00 CST + dispatch：build→bundle report→全量 vitest→diff→history→dashboard→artifact                                                                                                                                                                   | 结构已核对；**未 dispatch**                                          | **需 CI**；**0 次运行**                                    |

补充事实：

- **required check 名**：`Quality gate (required)`（job id `quality-gate`，`deploy.yml:106`）；三个子 job 名为 `Quality (types/lint/unit)`、`Coverage (domains)`、`Build (production/perf/docs)`（`docs/nbl/CI.md:28-35`）。branch protection 只能勾聚合 check，本地无配置证据。
- **本地 lint 与 CI lint 口径不同**：本地 `npm run lint` = `eslint . --ext ts,tsx --max-warnings 100`（含测试）；CI = `eslint src ... --max-warnings=0`（仅 src、零容忍）。本轮本地 0 诊断，但两者不是同一条命令。
- **CI 未启用 `report-store-stats --check`**：`deploy.yml:97-100` 明写基线过期（60/44 vs 59/43）会误报，改由 `--max-whole 10` 兜底；`ci-perf-gates.test.mjs`（48 行，3 例）断言它保持禁用。
- **nightly 的 audio-metrics 是死路**：`hashFiles` 条件命中但脚本在 Node 下无输出文件（§0-2），`append-history` 的 metrics 分支在 CI 永不触发；该步骤 `continue-on-error: true`，失败也不会红。
- **nightly 无 commit-back**：`permissions: contents: read`，`perf-history.jsonl` 只进 artifact；`--check` 校验 schema 与严格递增 ts，但无跨 run 载体。

## 4. 当前本地门禁快照（2026-10-29 本轮实测）

| 命令                                                        | 结果（精确数字）                                                                                                                                                                                                          | exit | 耗时（实测/未计时）                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------- |
| `npx vitest run --reporter=dot`                             | **311 test files / 1933 tests passed / 0 failed**                                                                                                                                                                         | 0    | 110.82s（内部）/ 113.6s（wall）          |
| `npx tsc --noEmit`                                          | **0 errors**，无输出                                                                                                                                                                                                      | 0    | 未单独计时（release:dry-run 内部 15.8s） |
| `npm run lint`                                              | **0 errors / 0 warnings**（无任何诊断输出；范围 `.`、`--max-warnings 100`）                                                                                                                                               | 0    | 126.8s（wall，与 vitest 并发，偏高）     |
| `npm run perf:gates`                                        | store 行预算 **111 files / 19,182 行 / max 400 / SCC 0**；store 统计 **62 stores / 43 persist keys**，registry 43/43，订阅 **1222（whole 0）**，store graph 23 边 SCC 0；bundle markers **9 files，2 项检查 0 命中**      | 0    | 未单独计时                               |
| `npm run verify:docs`                                       | **fail=0 warn=0**，8 项全 PASS（store-count actual=62、四条禁用词、CI 分支 master、端口 3025×5、INDEX、执行包）                                                                                                           | 0    | 未单独计时（脚本内 0.1s）                |
| `node scripts/check-store-budgets.mjs`（`verify:filesize`） | **PASS：111 files within budget；SCC 0**；grandfathered 0、stale 0                                                                                                                                                        | 0    | 未单独计时                               |
| `npm run verify:layers`                                     | **0 errors / 27 warnings**（`no-orphans`），**852 modules / 2031 dependencies**                                                                                                                                           | 0    | 未单独计时                               |
| `npm run test:coverage:domains`                             | **5/5 域 PASS**；311 files / 1933 tests；`[coverage-domains] PASS: 5 domains at or above burn-in floors`                                                                                                                  | 0    | 111.24s（vitest 内部），checker 未计时   |
| `node scripts/perf/bundle-budget.mjs --json …`              | rootMain 3 files **681.8KB raw / 208.4KB gzip**；first load 8 scripts **1976.2KB / 616.7KB gzip**；CSS **226.1KB / 29.2KB gzip**；async max **675.9KB**（121 chunks）；public **58.4MB**；**violations 2**（report-only） | 0    | 未单独计时                               |
| `node scripts/perf/bundle-diff.mjs …`                       | **PASS**：rootMain gzip 211→208.4（−2.6，阈值 +5）；first-load gzip 607.2→616.7（**+9.5**，阈值 +10）；其余 info                                                                                                          | 0    | 未单独计时                               |
| `npm run release:dry-run -- --skip-build`                   | **3 PASS（tsc 15.8s / docs-facts 0.1s / perf-gates 1.1s）/ 1 SKIP（build）**，0 failed                                                                                                                                    | 0    | 总时长未计时（脚本内三项已列）           |

### 4.1 覆盖率五域（本轮实测 vs 地板）

| 域              | files | stmts | branch | funcs | lines | 地板（s/b/f/l）               |
| --------------- | ----: | ----: | -----: | ----: | ----: | ----------------------------- |
| `src/lib/audio` |    30 | 71.94 |  61.38 | 75.99 | 73.42 | 41.85 / 40.27 / 58.87 / 42.34 |
| `src/utils`     |    10 | 65.87 |  58.99 | 73.42 | 66.78 | 61.08 / 52.77 / 68.42 / 62.13 |
| `src/store`     |   116 | 59.59 |  50.73 | 57.52 | 61.48 | 52.46 / 44.02 / 51.76 / 54.09 |
| `src/services`  |    18 | 46.95 |  39.68 | 42.59 | 48.74 | 40.80 / 32.58 / 35.73 / 42.47 |
| `src/hooks`     |    23 | 20.33 |  13.73 | 26.27 | 20.58 | 14.30 / 8.79 / 18.71 / 14.63  |

> 全部高于地板；audio 与 store 相对基线（46.85 / 57.46）明显提升，但未执行 `--update` 抬升地板（棘轮未收紧）。

## 5. M8 出口门 checklist（TRACKING 行 138）与计划 E1–E6

### 5.1 M8 六项

| #   | M8 出口项                        | 状态                     | 证据                                                                                       | 阻塞原因 / 下一步                                                                                                                                               |
| --- | -------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PR required checks 全绿且 ≤12min | **未运行（blocked）**    | 工作流与 9 条结构断言齐备（`deploy.yml`、`ci-required-checks` 9 passed）；耗时仅估算       | **push 授权**：本分支领先 `origin/master` 389 提交未 push；CI 只在 master 触发；无 run URL、无 wall 实测、无 branch protection 配置证据                         |
| 2   | 覆盖率分域生效                   | **本地达成 / CI 未运行** | 5/5 域 PASS、地板只升不降、CI coverage job 已接线；测试 6 passed                           | 需 CI 首次 enforce 绿；缺 3 域（lib-others/workers/global）与 PR delta >0.5pp、burn-in 周报                                                                     |
| 3   | 包体预算生效                     | **partial**              | bundle-diff 本地 PASS；nightly 已接线                                                      | CI build job 仅 report-only（`deploy.yml:95-96`）；`bundle-budget` 报 2 个 hardMax 违规仍 exit 0（async 675.9>400、public 58.4>45）；diff 只在 nightly 且未运行 |
| 4   | depcruise 0 violations           | **达成（0 errors）**     | `verify:layers` **0 errors / 27 warnings**，852 modules / 2031 deps；CI quality job 已接线 | 27 个 `no-orphans` 为 warn（计划口径 "0 violations" 若含 warn 则不成立）；需 CI 复跑                                                                            |
| 5   | nightly 连续 4 周无回归          | **未达成（blocked）**    | `nightly.yml` 结构完整；本地 bundle-diff PASS                                              | **0 次运行**；`perf/perf-history.jsonl` **不存在（0 行 vs ≥28）**；无 commit-back（`contents: read`）；无 runtime FPS/heap 生产者；无 runner 决策（Q1/P9）      |
| 6   | 发布清单演练完成                 | **partial**              | 清单 163 行 + dry-run **3 PASS/1 SKIP**；9 个 fixture 测试通过                             | 无 `release.yml`、无 14 项 `preflight.mjs`、无 `protected-paths.json`；R1-R14 仅 R4(部分)/R11 自动化；桌面打包仍被 S7-4/D2 冻结                                 |

### 5.2 计划 §2.1 E1–E6

| ID  | 出口                                                                    | 状态                     | 证据 / 缺口                                                                                                                      |
| --- | ----------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| E1  | 首次全绿 run wall ≤12min；master push 触发；required check=quality-gate | **未运行**               | 工作流在、聚合 check 在；无 Actions run、无 wall、无 branch protection 截图；CI.md 7-9/10-12min 为估算                           |
| E2  | coverage-gate --enforce exit 0；PR 不降 >0.5pp；负向 fixture 被拦       | **partial**              | enforce 本地 PASS（5 域）；**无** PR delta 实现、**无** 负向 fixture 执行；CI 未跑                                               |
| E3  | bundle 预算 PR 运行；超阈值 fail；负向 fixture fail                     | **partial**              | nightly diff 在、本地 PASS；CI 无 `--check`；hardMax 2 项既有违规未拦；负向 fixture 仅单测层面（4 例）                           |
| E4  | depcruise 0 violations；文件行数棘轮；新增 500 行 fixture 被 fail       | **partial**              | depcruise 0 errors / 27 warns；**无** `check-file-size.mjs` 与 `file-size-baseline.json`（替代为 store 行预算 111 files/400 行） |
| E5  | docs-facts exit 0；注入 19,790 的 fixture fail；季度报告 1 份           | **本地达成（负向未做）** | 8/8 PASS、fail=0 warn=0；**无** 负向 fixture run；季度报告/模板未建                                                              |
| E6  | 4 周 × 7 天 nightly 成功；`perf-history.jsonl` ≥28 行；周报 4 份        | **未达成（blocked）**    | 0 行历史、0 次运行、无 commit-back、无周报                                                                                       |

## 6. 缺失产物清单（计划 vs 现状）

| 计划产物（S8 计划 §5）                                                                      | 现状                                                                                                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/ci.yml`（S8-1a 新建）                                                    | **未新建**；在既有 `deploy.yml` 上扩展（计划 §7 S0-2 行写的是"在当前 ci.yml 上扩展"，仓库实际文件名是 deploy.yml） |
| `scripts/quality/validate-workflow.mjs`                                                     | **不存在**（`scripts/quality/` 目录不存在）；等价字符串断言在 `scripts/ci-required-checks.test.mjs`                |
| `scripts/quality/required-checks.mjs`                                                       | **不存在**                                                                                                         |
| `scripts/quality/check-file-size.mjs` + `docs/nbl/quality/file-size-baseline.json`          | **不存在**；替代为 `scripts/check-store-budgets.mjs`（store 文件 ≤400 行 + SCC，覆盖 111 文件，非全 src）          |
| `docs/nbl/quality/gate-policy.json`                                                         | **不存在**                                                                                                         |
| `docs/nbl/quality/README.md`（门禁分层/豁免 SOP）                                           | **不存在**；门禁说明落在 `docs/nbl/CI.md`（102 行）                                                                |
| `scripts/quality/coverage-gate.mjs` + `coverage-thresholds.json` + `coverage-baseline.json` | **不存在**；实际 `scripts/check-coverage-domains.mjs` + `perf/coverage-domains.json`（含 measured/thresholds）     |
| `scripts/perf/perf-summary.mjs`                                                             | **不存在**；实际 `scripts/perf/perf-dashboard.mjs`                                                                 |
| `docs/nbl/quality/perf-history.jsonl`（≥28 行）                                             | **不存在**；`perf/perf-history.jsonl` 同样不存在（0 行）                                                           |
| `.github/workflows/perf-nightly.yml` / `perf-soak.yml`                                      | **未建**；合并为 `nightly.yml`（仅 bundle + 全量测试），**无 soak workflow**                                       |
| `scripts/perf/soak.mjs`（周度 2h，CDP）                                                     | 存在但是 S7-9 的 **node 合成负载**（TtlLruCache + hydration），非播放/CDP 采样；未接 CI                            |
| `scripts/perf/measure.py`（从 scratch 固化）                                                | **不存在**（`scripts/perf/` 无 .py）                                                                               |
| `scripts/quality/check-docs-facts.mjs` 的 `doc-facts.config.json`                           | **不存在**；8 项检查与禁用词硬编码在 `scripts/check-docs-facts.mjs`                                                |
| `scripts/quality/gen-docs-baseline.mjs` + AUTO 块 `--check/--write`                         | **不存在**                                                                                                         |
| `docs/nbl/quality/quarterly-audit.md` / `quarterly-YYYY-QN.md`                              | **不存在**；仅 BACKLOG/PROCESS 写流程约定                                                                          |
| `docs/nbl/quality/backlog.md`                                                               | **路径不同**：实际 `docs/nbl/BACKLOG.md`（46 行，L1–L12）                                                          |
| `scripts/release/preflight.mjs`（14 项）+ `protected-paths.json`                            | **不存在**；替代为 `scripts/release-dry-run.mjs`（4 项，安全子集）                                                 |
| `.github/workflows/release.yml`（tag 触发、workflow_call、draft release）                   | **不存在**（`git tag` 流程无自动化）                                                                               |
| `docs/nbl/checklists/release-checklist-2026q4.md`                                           | **不存在**；实际 `docs/nbl/RELEASE-CHECKLIST.md`                                                                   |
| `docs/nbl/quality/evidence/s8-e1.md` … `s8-e6.md`                                           | **目录不存在**（本文件即 `evidence/S8-evidence.md`，未拆分 6 份）                                                  |
| `docs/nbl/quality/CHANGELOG.md` + `waivers.json`（阈值调整/豁免）                           | **不存在**；阈值变更记录与豁免机制未落地                                                                           |
| `perf/store-stats-baseline.json` 重新生成（60/44 → 62/43）                                  | **未重生成**（仍 60/44，`--check` 因此保持禁用）                                                                   |
| 可用 CI 的 audio-metrics 生产者（`perf/audio-metrics.json`）                                | **不存在**；`scripts/perf/audio-metrics.mjs` 是浏览器 console recipe，Node/CI 下 no-op                             |
| bundle hardMax 阻断（`--check`）                                                            | **未启用**（2 项既有违规：async chunk 675.9 > 400、public 58.4 > 45）                                              |
| `docs/nbl/quality/` 目录整体                                                                | **不存在**                                                                                                         |

## 7. 复现命令

在 `D:/26project/music_source_code_V1.1_full/_worktrees/arch-integration-s1-5`（分支 `docs/s8-evidence`）执行：

```bash
# 1) 提交清单与变更量
git log --all --oneline --grep='s8-' -i
git show --numstat --format='COMMIT %h %s' da94769 f399eef 13ae6d3 da68c5e \
  c4ce42b 7e2acb2 dba8e6e 1f74dd9 3b7c9b8 f2104b0 6300fe8 86dc844 b33c8ce a7da509 f508e4c

# 2) 定向测试（8 文件 / 47 passed，逐条 exit 0）
npx vitest run scripts/ci-required-checks.test.mjs --reporter=dot        # 9
npx vitest run scripts/perf/ci-perf-gates.test.mjs --reporter=dot        # 3
npx vitest run scripts/perf/check-coverage-domains.test.mjs --reporter=dot  # 6
npx vitest run scripts/perf/bundle-diff.test.mjs --reporter=dot          # 4
npx vitest run scripts/perf/perf-history.test.mjs --reporter=dot         # 4
npx vitest run scripts/perf/soak.test.mjs --reporter=dot                 # 4
npx vitest run scripts/release-dry-run.test.mjs --reporter=dot           # 9
npx vitest run scripts/docs-backlog.test.mjs --reporter=dot              # 8
npx vitest run scripts/perf --reporter=dot                               # 8 文件 / 34 passed（交叉验证）

# 3) 全量门禁（本轮全部 exit 0）
npx vitest run --reporter=dot                                            # 311 files / 1933 tests
npx tsc --noEmit
npm run lint
npm run perf:gates                                                       # store 预算 + 统计 + bundle markers
npm run verify:docs                                                      # fail=0 warn=0（8/8）
node scripts/check-store-budgets.mjs                                     # 111 files / SCC 0
npm run verify:layers                                                    # 0 errors / 27 warnings
npm run test:coverage:domains                                            # 5/5 域 PASS

# 4) 包体与发布演练（report-only 语义要注意 exit code）
node scripts/perf/bundle-budget.mjs --json .tmp-s8-build-report.json     # violations 2，仍 exit 0
node scripts/perf/bundle-diff.mjs --report .tmp-s8-build-report.json --json .tmp-s8-diff.json --md .tmp-s8-diff.md
npm run release:dry-run -- --skip-build                                  # 3 PASS / 1 SKIP

# 5) 4 周历史现状（预期：文件不存在 / 0 行）
test -f perf/perf-history.jsonl && wc -l perf/perf-history.jsonl || echo "MISSING perf/perf-history.jsonl"
```

计划 §5/§6 中**当前不可执行**或**未运行**的命令（如实登记）：

```text
node scripts/quality/validate-workflow.mjs        # 目录不存在
node scripts/quality/check-file-size.mjs --check  # 脚本不存在
node scripts/quality/coverage-gate.mjs --enforce  # 脚本不存在（等价：npm run test:coverage:domains）
node scripts/release/preflight.mjs --tag v0.3.0   # 脚本不存在
node scripts/quality/gen-docs-baseline.mjs --check  # 脚本不存在
node scripts/perf/perf-summary.mjs --weeks 4      # 脚本不存在（等价：npm run perf:dashboard）
python scripts/perf/measure.py --cases spec       # 脚本不存在
gh run list --workflow=nightly.yml                # 未 push，无 run
```

> 本轮未执行：`npm run build`（沿用 18:30 的 `.next` 构建产物做 bundle 报告）、`npm run dev`、CI push/dispatch、nightly 手动触发、2h soak 重跑、负向 fixture（删测试/改阈值/注入 19,790）、Electron/桌面打包。未 push，未触碰主工作区。

## 8. 风险、下一步与回退

- **三类硬阻塞（不解决则 M8 不能判绿）**：
  1. **CI run / push 授权**：需要把 `integration/s2-audio`（389 提交）推到远端并让 CI 在 master 触发一次，才能拿到 E1 的 wall time、job 结果与 required check 名；否则 `quality-gate` 只是"纸面 required"。
  2. **4 周历史 / commit-back**：nightly 需要 `contents: write` + 受控 bot commit（或外部存储）才能让 `perf-history.jsonl` 跨 run 累积；同时需要真实 runtime 指标生产者（FPS/heap/audio nodes），否则 E6 的 "≥28 行" 只是 bundle 数据，仍不能证明"无回归"。
  3. **包体 hardMax**：`maxAsyncChunkKB`（675.9 > 400）与 `publicMB`（58.4 > 45）是既有违规，若直接开 `--check` 会立刻红；需先决定"rebaseline 到现状 + 逐步收紧"还是"先降 public/拆 vendor"。
- **次级缺口**：覆盖率 3 域与 PR delta、`store-stats-baseline.json` 重生成（解锁 `--check`）、`release.yml`/`preflight.mjs`、docs-facts 负向 fixture 与季度模板、文件行数棘轮（计划版）。
- **建议顺序**：① 用户授权 push → 观察首次 CI（记录 wall/job）→ 配置 branch protection 只勾 `Quality gate (required)`；② 重新生成 store-stats 基线并开 `--check`；③ nightly 加 commit-back（或 artifact 汇总 job）跑满 4 周；④ 补 3 个覆盖域 + PR delta；⑤ 最后补 release workflow 与 preflight 14 项（依赖 S7-4/D2 解冻）。
- **回退**：S8 全部改动是 CI/脚本/文档，无产品行为变更；按提交粒度 revert 即可（`da94769`/`f399eef` 回退即恢复串行 verify；`c4ce42b` 回退后 coverage job 需同时删步骤，否则缺脚本；`dba8e6e`/`3b7c9b8` 回退即删 nightly；`f508e4c` 回退需同删 ROADMAP/PROCESS/AGENTS 的 3 处入口链接）。
