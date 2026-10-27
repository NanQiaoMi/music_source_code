# S8 门禁与长期治理 — 实现级执行计划

> 文件：**docs/nbl/plans/2026-10-21-arch-perf-execution/S8-quality-governance.md**
> 父计划：**docs/nbl/plans/2026-10-21-architecture-performance-optimization.md**（下称"总计划"）；对应总计划 §5 S8（行 537-546）、§6 质量门禁与性能预算（行 571-656）、§9.5 质量门禁验收（行 769-776）
> 审计依据：**scratch/architecture-audit-2026-10-21/build-quality-audit.md**（下称"D 审计"）§2 基线、§3 P0/P1、§5 门禁提案、§6 Wave0-4、附录 N/O/P；**store-audit.md** §899-909（store 统计脚本口径）；**render-perf-audit.md** §5.5（包体预算）与行 144-162（rootMain 实测）
> 适用分支：**master**（稳定基线）；前置脏树处理见 S0-1
> 状态：规划完成，**未开始实现**。本文所有"现状"数字来自 2026-10-21 实测或总计划已核实数据；标注 **[待核实]** 的项需实施时复核。
> 版本：v1.0（2026-10-21）｜作者：build-quality-auditor（审计 D）｜关联共享任务：task-11

---

## 1. 元信息

S8 是"持续阶段"：不改变产品行为，只建立**可执行、可失败、可追溯**的质量门禁与长期治理节奏。它把总计划 §6 的门禁分层从"文档提案"变成"CI 上会失败的检查"，并为 S1-S7 的每个出口提供回归护栏。

### 1.2 关键输入与已核实现状（引用均亲自核实）

| # | 事实 | 证据（文件:行 / 命令） |
|---|---|---|
| 1 | CI 只在 **main** 触发，仓库默认 **master**，无 main → 从未运行 | **.github/workflows/deploy.yml:3-9**；git symbolic-ref refs/remotes/origin/HEAD → origin/master |
| 2 | CI 只有 lint + test，无 tsc/build/coverage/budget/docs | **.github/workflows/deploy.yml:27-31** |
| 3 | 覆盖率 include 仅 audio+utils，阈值 30/20/30/30 | **vitest.config.ts:11-21** |
| 4 | 本机实测：tsc 23.3s/0；eslint src 142.4s/0；eslint 根 56.5s/0；vitest 205 文件 1267 用例/0 failed/106s；coverage 52.64/50.08/66.2/53.19；build 114.9s/exit 0 | D 审计 §2.1；scratch/architecture-audit-2026-10-21/logs-d/*.meta |
| 5 | 当前产物：rootMainFiles **23 文件 / 969.3KB raw / 296.8KB gzip**；**/** 首屏 1996.7KB JS + 227.4KB CSS；**/_not-found** 1524.7KB；CSS 单文件 227.4KB；最大 async chunk three 333.5KB（159 chunk） | 本次复测：.next/build-manifest.json + zlib 求和（2026-10-21 22:15）；总计划 §6.2 行 607-612 |
| 6 | 代码规模：src ts/tsx **693**（生产 490 / 测试 203），**169,409 行**（生产 139,373 / 测试 30,036）；store **60** 模块、**44** 处 persist | 本次 Node 实测（2026-10-21 22:10） |
| 7 | 行数热点（棘轮基线）：cinematicLyricDrift.ts 2,653；Shelf3DView.tsx 2,521；useAudioPlayer.ts 1,824；PosterTemplates.tsx 1,698；OrientalLandscapeV8.ts 1,652（>700 行共 20+ 文件） | 本次 Node 实测（完整 Top10 见 §5.1 Step 3 表格） |
| 8 | lint 依赖未在 package.json 声明（phantom deps）；eslint-config-next 未 extend | **.eslintrc.json:2-11** vs **package.json:59-85**；D 审计 P1-5 |
| 9 | 端口不一致：dev 3025 / start 3024 / Docker 3025 | **package.json:9,19**；**Dockerfile:25,37**；**docker-compose.yml:11**；**scripts/clean-port.js:7**；**electron/main/index.js:172,200,239** |
| 10 | 文档失真：AGENTS 44 stores/19,790 lint/--no-verify/CI 注释；ARCHITECTURE 29/91=44、149 totemStore、154=46、177=Static Export | **AGENTS.md:31,74,75,77**；**docs/nbl/ARCHITECTURE.md:29,91,149,154,177** |
| 11 | 发布流程与 checklist 仅 6 项、无自动化 | **docs/nbl/PROCESS.md:233-271**（7.3 在 264-271）；现有 checklist **docs/nbl/checklists/existing-feature-release-checklist.md** |
| 12 | 性能 harness 已有：**scratch/perf/measure.py**（Python Playwright + Chrome channel，行 170-206）与 **scratch/perf/BASELINE.md**，但非仓库正式脚本、无 CI；现有 scripts 无 perf/quality/release 目录；仓库 origin=NanQiaoMi/music_source_code，默认 master | 本次核实（Get-ChildItem scripts；git remote -v；git symbolic-ref） |

---

## 2. 阶段目标与出口

1. **门禁可信**：PR 上的 required checks 能在 ≤12min 内拦住 tsc/lint/test/build/覆盖率/包体/边界/文档事实八类回退；push master 必触发。
2. **回归可见**：每个 PR 有 bundle diff；nightly 有性能/桌面/后端报告；周度有 soak；连续 4 周可证明"无回归"。
3. **文档不腐化**：文档中的关键数字与路径由脚本生成/校验；季度对账制度化；过期计划不再以 Active 误导。

### 2.1 出口（对应总计划 §9.5 行 769-776，逐条量化）

| # | 总计划出口 | 本计划量化验收 | 证据 |
|---|---|---|---|
| E1 | required checks 全绿 ≤12min；push master 触发 | 首次全绿 run 的 wall time ≤12min；master push 触发 run；required check 名=quality-gate | Actions run URL + 截图存档 docs/nbl/quality/evidence/s8-e1.md |
| E2 | 覆盖率分域阈值生效；PR 不降低 >0.5pp | coverage-gate.mjs --enforce exit 0；人为删测试的 fixture PR 被 fail | CI run + 负向 fixture 测试 |
| E3 | 包体预算脚本在 PR 运行；超阈值 fail | 把 rootMain gzip 基线人为改小 10% 的 fixture run fail；正常 PR 通过 | CI run + bundle-diff 输出 |
| E4 | depcruise 0 violations；文件行数棘轮生效 | depcruise --validate 0 violations（例外清单显式）；新增 500 行文件 fixture 被 fail | 本地+CI 日志 |
| E5 | docs-facts 0 失败；过期数字不再出现 | check-docs-facts.mjs exit 0；向 AGENTS.md 注入 19,790 的 fixture fail | 负向测试 + CI |
| E6 | nightly desktop/backend 报告可查；连续 4 周无回归 | 4 周 × 7 天 nightly run 成功；周报表格含全部看板字段 | docs/nbl/quality/perf-history.jsonl 行数 ≥28；周报 4 份 |

---

## 3. 前置与不变量

### 3.1 前置（缺一不可，按依赖排序）

| 前置 | 内容 | 满足判定 | 若未满足 |
|---|---|---|---|
| P1 | **S0-1**：55 项未提交手势改动已 commit/拆 PR；基线在干净树复测 | git status --porcelain 为空或仅预期项；基线 commit 记录在计划 | S8 只读脚本可先行，但 CI required checks 无意义（拒绝开启 branch protection） |
| P2 | **S0-2**：CI 最小版（master 触发 + tsc/lint/test/build）先落地 | master push 有一次绿色 run | S8-1 在 S0-2 基础上扩展，不重复创建 |
| P3 | **S0-3**：build:static / 端口统一 / out 新鲜度断言 | npm run build:static 产出 out；端口矩阵一致 | S8-5 发布门禁无法验证"新鲜 out" |
| P4 | **S0-4**：文档首轮纠偏（60 stores/真实链路/CI 状态） | 总计划 §10.4 的失真项已改 | S8-4 的负向测试无基线（会先把旧错误判红） |
| P5 | **S0-6**：测量基座 v1（scripts/perf/bundle-budget.mjs、scripts/report-store-stats.mjs、scripts/check-docs-facts.mjs 雏形） | 一条命令输出 baseline JSON | S8-1/S8-3/S8-4 需自带脚本，成本 +2 天 |
| P6 | **S6-1/S6-12**：selector 门禁、文件行数棘轮、depcruise 配置 | .dependency-cruiser.cjs 存在且 baseline 记录 | S8-1 只做 CI 接线，不重写规则 |
| P7 | **S7-4/S7-6**：桌面本地 Next 运行时 + 冒烟脚本 | scripts/release/smoke-electron.ps1 可运行 | S8-5 的 Electron 冒烟降级为"产物结构断言 + 人工 checklist" |
| P8 | **GitHub 管理员权限**：branch protection / required checks / secrets | 可在仓库 Settings 配置 | E1 无法达成，只能"CI 红但不阻塞合并" [待授权] |
| P9 | **性能运行环境决策**：自托管 Windows GPU runner 或本机手动 nightly | 决策记录（见 §8 Q1） | S8-3 的 runtime/soak 退化为"本机手动 + 结果入库" |

### 3.2 不变量（S8 自身约束）

- **S8 不改产品代码**：仅允许改 **.github/workflows/**、**scripts/quality/**、**scripts/perf/**、**scripts/release/**、**package.json 的 scripts 段**、**vitest.config.ts coverage 段**、**docs/nbl/quality/**、**docs/nbl/checklists/**、本目录文档。产品 src/、electron/ 由各自阶段维护。
- 引用总计划硬不变量 I1-I7（总计划行 86-97）：用户数据兼容、播放连续性、单一事实源、资源有 owner、受保护界面、PR≤400 行、验证顺序。
- **阈值只降不升**：包体/覆盖率阈值调整必须同时提交 **docs/nbl/quality/CHANGELOG.md** 一行，并在 PR 描述说明是"优化后下调"还是"经批准的例外放宽（≤14 天，需 Lead 签字）"。
- **不新增 npm 重型依赖**（总计划 §1.1 行 78）：S8 新增脚本仅用 Node 内置模块（fs/zlib/child_process）+ 已有 devDeps；浏览器测量复用 Python Playwright（本地 .venv 已装 [待核实版本]）与 scratch/perf/measure.py，是否进 CI 由 Q1 决策。
- **门禁 fail-fast，禁止静默跳过**：任何 continue-on-error 仅允许出现在 P9 未决前的 nightly，且必须带 TEMP-UNTIL 注释与到期日。
- **S8 的每个子 PR ≤400 行**：按"脚本 + 配置 + 文档"拆分（S8-1a..d 等），测试/文档不计行（总计划行 95、PROCESS.md:131-135）。

---

## 4. 任务总表

| ID | 任务 | 交付物 | 子 PR（行数估算） | 依赖 | 量化验收 |
|---|---|---|---|---|---|
| S8-1 | CI 完整门禁 | .github/workflows/ci.yml、scripts/quality/{validate-workflow,check-file-size,required-checks}.mjs、docs/nbl/quality/gate-policy.json | S8-1a ~180、S8-1b ~120、S8-1c ~150、S8-1d ~40 | P2、P5、P6、P8 | §5.1 验收 |
| S8-2 | 覆盖率阶梯 | vitest.config.ts coverage 段、scripts/quality/coverage-gate.mjs、docs/nbl/quality/{coverage-thresholds.json,coverage-baseline.json} | S8-2a ~150、S8-2b ~80、S8-2c ~40 | P5、S8-1 | §5.2 验收 |
| S8-3 | 性能回归套件 | scripts/perf/{bundle-diff,perf-summary,soak}.mjs、.github/workflows/{perf-nightly,perf-soak}.yml、docs/nbl/quality/{bundle-baseline.json,perf-history.jsonl} | S8-3a ~130、S8-3b ~110、S8-3c ~140、S8-3d ~50 | P5、S8-1、P9、S5（harness） | §5.3 验收 |
| S8-4 | 文档事实流水线 | scripts/quality/check-docs-facts.mjs、scripts/quality/gen-docs-baseline.mjs、docs/nbl/quality/doc-facts.config.json、季度流程文档 | S8-4a ~180、S8-4b ~100、S8-4c ~40 | P4、P5、S8-1 | §5.4 验收 |
| S8-5 | 发布检查清单 | scripts/release/{preflight.mjs,protected-paths.json,smoke-electron.ps1 接线}、.github/workflows/release.yml、新 checklist 文档 | S8-5a ~150、S8-5b ~120、S8-5c ~60 | P3、P7、S1、S8-1 | §5.5 验收 |
| S8-6 | 长期 backlog | 本节文档 + docs/nbl/quality/quarterly-YYYY-QN.md 模板 | S8-6a ~80（文档） | 全部 | §5.6 验收 |

> S8 首批（1/2/4）1-2 周落地，S8-3/5 依赖 S5/S7 后接线（约第 6-8 周），S8-6 每季度评审；总新增约 1,300-1,700 行 + CI/文档，均可独立 revert。TRACKING.md 的 PR 数（如 S8-1 约 1-2）是任务粒度估算，本文子 PR 是其实现拆分，合并时可 squash 为 1-2 个阶段 PR，但每次实际变更仍 ≤400 行。

---

## 5. 逐任务步骤

### S8-1 CI 完整门禁

**目标**：把 .github/workflows/deploy.yml（当前只在 main 触发、无 tsc/build）替换为 master 触发、覆盖八类检查、wall time ≤12min 的 CI；分支保护只要求一个聚合 check。

**前置**：P2/P5/P6/P8；S0-2 已完成最小版（若未完成，S8-1a 同时承担 S0-2）。

**写作用域**：.github/workflows/ci.yml（新增）、.github/workflows/deploy.yml（保留但改造为 release 用，见 S8-5）、scripts/quality/validate-workflow.mjs、scripts/quality/check-file-size.mjs、scripts/quality/required-checks.mjs、docs/nbl/quality/gate-policy.json、package.json scripts 段（仅新增 verify:* 别名，与 S0-6 协调，避免重复定义）。

**Step 1（S8-1a，~180 行）**：新建 ci.yml。关键片段（可直接落地；GitHub 表达式以 EXPR 占位，落地时替换为双花括号语法）：

~~~
name: ci
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  workflow_call:            # 供 S8-5 release.yml 复用
concurrency:
  group: ci-ref
  cancel-in-progress: true
permissions:
  contents: read
  pull-requests: write      # 仅用于写入 PR 注释（覆盖率/包体 diff）

jobs:
  type:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit --incremental false --pretty false

  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx eslint src --max-warnings=0 --report-unused-disable-directives

  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix: { shard: [1, 2] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx vitest run --reporter=dot --shard=SHARD_EXPR/2
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: test-report-shard-SHARD_EXPR, path: test-results/ }

  build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - uses: actions/cache@v4
        with:
          path: |
            .next/cache
            tsconfig.tsbuildinfo
          key: next-cache-HASH_EXPR
      - run: npm ci
      - run: npx next build --webpack
      - run: node scripts/perf/bundle-budget.mjs --out perf/build-report.json
      - run: node scripts/perf/bundle-diff.mjs --check --report perf/bundle-diff.json
      - uses: actions/upload-artifact@v4
        with: { name: build-metrics, path: perf/ }

  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx vitest run --coverage
      - run: node scripts/quality/coverage-gate.mjs --enforce
      - run: node scripts/quality/check-docs-facts.mjs
      - run: npx depcruise --config .dependency-cruiser.cjs src
      - run: node scripts/quality/check-file-size.mjs --check

  quality-gate:            # 唯一 required check（branch protection 只勾它）
    if: always()
    needs: [type, lint, test, build, quality]
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "type=NEEDS_TYPE_RESULT lint=NEEDS_LINT_RESULT test=NEEDS_TEST_RESULT"
          test "$NEEDS_TYPE" = success
          test "$NEEDS_LINT" = success
          test "$NEEDS_TEST" = success
          test "$NEEDS_BUILD" = success
          test "$NEEDS_QUALITY" = success
~~~

注：落地时把 SHARD_EXPR/HASH_EXPR/NEEDS_* 替换为对应 GitHub 上下文表达式；HASH_EXPR = hashFiles(package-lock.json, next.config.js, src/**)。若对 src/** 求哈希过慢，退化为 package-lock.json + next.config.js 两项 [待实测]。

**Step 2（S8-1a 续）**：耗时预算与依据（本机实测 × CI 慢系数 1.8-2.5，4 vCPU runner）：

| Job | 本机实测 | CI 估算 | timeout | 说明 |
|---|---:|---:|---:|---|
| type | 23.3s | 60-90s | 10min | tsc 冷启动 |
| lint | 142.4s | 300-360s | 15min | prettier 规则主导；必要时按目录 2 分片（未来优化） |
| test（每片） | 106s 全量 | 150-210s/片 | 15min | 2 片并行 |
| build | 114.9s | 240-330s | 20min | 含 budget/diff 静态解析（各 <10s） |
| quality | coverage 80s + docs 5s + depcruise 30-60s + file-size 5s | 200-260s | 20min | coverage 重跑全量测试 |
| **wall（并行）** | — | **≈ max(360, 210, 330, 260) + setup 60 ≈ 7min** | ≤12min | 失败重跑不计 |

**Step 3（S8-1c，~150 行）**：文件行数棘轮 scripts/quality/check-file-size.mjs + docs/nbl/quality/file-size-baseline.json。规则：
- 新增/修改文件：>400 行 fail（测试/文档/JSON/生成物白名单）；>300 行 warn；
- 存量文件：以基线为上限，只减不增（超过 fail）；基线记录本次实测 >700 行文件（下表为 Top10，完整 Top20 存 baseline JSON）；
- 删除大文件（如 S4-7 V8 删除）后运行 --update 降低基线，只降不升。

棘轮基线（本次 Node 实测，2026-10-21）：

| 文件 | 行数 |
|---|---:|
| src/components/visualization/effects/cinematicLyricDrift.ts | 2,653 |
| src/components/library/Shelf3DView.tsx | 2,521 |
| src/hooks/useAudioPlayer.ts | 1,824 |
| src/components/social/PosterTemplates.tsx | 1,698 |
| src/components/visualization-v8/effects/OrientalLandscapeV8.ts | 1,652 |
| src/components/visualization/effects/orientalLandscape.ts | 1,550 |
| src/components/library/hub/LxMusicSearchTab.tsx | 1,511 |
| src/components/visualization/effects/handwrittenDoodles.ts | 1,490 |
| src/services/MultiSourceResolver.ts | 1,367 |
| src/components/visualization/effects/lyricFilmStage.ts | 1,189 |

**Step 4（S8-1b，~120 行）**：scripts/quality/validate-workflow.mjs（零依赖，字符串级断言 ci.yml 含：master 触发、至少 5 个 job、timeout-minutes、permissions、concurrency、quality-gate）与 required-checks.mjs（校验 docs/nbl/quality/gate-policy.json 中列出的 check 名与 workflow 一致）。CI 中作为 quality job 的一步运行（防止 workflow 被误改）。

**Step 5（S8-1d，~40 行）**：docs/nbl/quality/README.md：门禁分层表（总计划 §6.1 行 573-601 的落地映射）、本地命令、失败处理 SOP、豁免流程（coverage-waiver / budget-waiver label，≤14 天）。

**测试/自检**
- 负向 fixture：临时把 file-size-baseline.json 阈值改到 1KB → 脚本必须 exit 1；临时分支加 unused var → lint job fail（本地复现，不污染仓库）。
- 本地预演：node scripts/quality/validate-workflow.mjs exit 0；node scripts/quality/check-file-size.mjs --check exit 0（基于当前树）。
- YAML 语法：优先 npx --yes actionlint（网络拉取，非依赖）[Q5]；不可用则用 validate-workflow.mjs 的保守断言。

**验证命令与预期输出**
~~~
npx tsc --noEmit --incremental false --pretty false   # exit 0，无输出
npx eslint src --max-warnings=0 --report-unused-disable-directives   # exit 0
npx vitest run --reporter=dot                          # 205 files / 1267 tests / 0 failed
npx next build --webpack                               # exit 0；3 static + 31 API
node scripts/quality/validate-workflow.mjs             # WORKFLOW_OK（exit 0）
node scripts/quality/check-file-size.mjs --check       # FILESIZE_OK（exit 0）
~~~

**验收（量化）**：E1；首次 required run wall ≤12min；negative fixtures 全部 fail；quality-gate 为唯一 required check 且 branch protection 已配置（截图入库）。

**回滚**：删除 ci.yml → 恢复 deploy.yml 的旧触发即可；branch protection 只需取消 required check，无代码影响。**风险**：lint 300s+ 可能超时（timeout 已给 15min）；缓存 key 对 src/** 哈希开销大；P8 权限缺失导致 E1 不可达；CI 成本增加（约 5 job × minutes/PR）。**行数**：S8-1a 180 / 1b 120 / 1c 150 / 1d 40，均 ≤400。

---

### S8-2 覆盖率阶梯

**目标**：把覆盖率门禁从"2 域 30%"扩展到 8 个域，并按"实测-5pp 锁定 → 每 2 周 +2pp → 阶段目标"的 burn-in 规则收紧，防止忽高忽低。

**前置**：P5、S8-1（coverage job）；首次全域测量（S8-2b 第 1 天完成）。

**写作用域**：vitest.config.ts（仅 coverage 段）、scripts/quality/coverage-gate.mjs、docs/nbl/quality/coverage-thresholds.json、docs/nbl/quality/coverage-baseline.json、package.json（仅新增 verify:coverage 别名，与 S0-6 协调）。

**Step 1（S8-2a，~150 行）**：扩展 include 并接入脚本。
- vitest.config.ts:11-21 改为 include: ["src/lib/**","src/utils/**","src/store/**","src/services/**","src/hooks/**","src/workers/**"]，排除 **/*.test.*、src/lib/gesture/**（新功能，S1 后纳入 [待核实归属]）与 src/lib/perf/**（dev-only）。
- reporter 增加 json-summary（供脚本读 coverage/coverage-summary.json）。
- 已核实：vitest 4.1.5 的 coverage.thresholds 类型为全局 Threshold 映射（无按目录配置），因此**分域阈值由 coverage-gate.mjs 实现**，vitest 内保留全局兜底 50/45/55/50。
- coverage-gate.mjs 能力：--report-only（只看不改）/--enforce（低于阈值 exit 1）/--update-baseline（仅 master 合并后运行）；读取 coverage-summary.json 与 thresholds JSON；输出 markdown 表格（PR 注释与 job summary）；PR delta 对比 coverage-baseline.json 的 >0.5pp 下降判定（有 GITHUB_BASE_REF 时以基线为准）。

**Step 2（S8-2b，~80 行）**：首次全域测量与 burn-in。
- 第 1 天：跑 npx vitest run --coverage，把 8 域实测写入 coverage-baseline.json 并提交（带 measuredAt/commit）。
- burn-in 阶段（2 周或 ≥10 个 PR）：CI 以 --report-only 运行，不 fail，只在 PR 输出域表与 delta；每周把"实测最低周"更新进 baseline。
- 解锁条件：连续 2 周无 >1pp 抖动；解锁 PR 把 gate 切为 --enforce。

**Step 3（S8-2c，~40 行）**：棘轮与豁免。
- 每 2 周（与 nightly 同一天）由 bot/值班人运行 --update-baseline --bump，阈值按 §5.2 表 +2pp，PR 只改 JSON+CHANGELOG；只升不降。
- 豁免：coverage-waiver label + PR 描述原因；同一个域连续 2 个豁免 PR 后自动 fail（脚本读 docs/nbl/quality/waivers.json 计数，过期自动清理）。

**分域阈值表（实现值；现状为实测或首测后回填）**

| 域 | include | 现状（Stmts/Branch/Funcs/Lines） | burn-in v0 = 现状-5pp | Phase 2（S2-S4 出口） | 最终目标（总计划 S8-2） |
|---|---|---|---|---|---|
| audio | src/lib/audio/** | 46.35/44.92/62.04/47.00 [已实测] | 45/44/60/45 | 55/50/60/55 | 60/55/65/60 |
| utils | src/utils/** | 65.93/57.76/73.41/66.97 [已实测] | 65/57/72/66 | 70/63/77/70 | 75/65/80/75 |
| store | src/store/** | 待测（41/60 有测试，推断 ≥55）[待核实] | 实测-5pp | 55/50/60/55 | 65/60/70/65 |
| lib（其他） | src/lib/{queue,lyrics,playback,library,netease,smart-playlist,visualization}/** | 待测 [待核实] | 实测-5pp（不足 35 按 35 起） | 50/45/55/50 | 60/55/65/60 |
| services | src/services/** | 待测 [待核实] | 实测-5pp（不低于 35） | 50/45/55/50 | 55/50/60/55 |
| hooks | src/hooks/** | 待测 [待核实] | 实测-5pp（不低于 35） | 50/45/55/50 | 55/50/60/55 |
| workers | src/workers/** | 待测 [待核实] | 实测-5pp | 45/40/50/45 | 55/50/60/55 |
| global（兜底） | 上述全部 | 首次全域待测 | 50/45/55/50 | 55/50/60/55 | 65/60/70/65 |

**测试/自检**
- fixture：临时分支删除 src/lib/audio/AudioEngine.test.ts → --enforce 必须 exit 1；--report-only 必须 exit 0 且输出含下降行；阈值 JSON schema 校验（域全覆盖、0-100、只升不降）。

**验证命令与预期输出**
~~~
npx vitest run --coverage                               # exit 0；coverage/coverage-summary.json 生成
node scripts/quality/coverage-gate.mjs --report-only    # exit 0；输出 8 行域表
node scripts/quality/coverage-gate.mjs --enforce        # exit 0（达标时）
node scripts/quality/coverage-gate.mjs --enforce --simulate-drop 10   # fixture：exit 1
~~~

**验收**：E2；coverage-baseline.json 有 8 域数值；连续 2 周 report-only 无 fail；切 enforce 后 main 绿；负向 fixture 被拦截。

**回滚**：把 vitest.config.ts coverage 段与 gate 脚本一起 revert（coverage 数据可保留）；CI 中删掉 coverage-gate 步骤。**风险**：扩域后覆盖率骤降导致 enforcement 长期红 → 已用"现状-5pp + burn-in"缓冲；components 域暂不纳入（S5 后另行）；新增 include 会显著拉低全局（评估时用域表而非全局）。

---

### S8-3 性能回归套件

**目标**：把 D 审计/B 审计的包体实测变成每 PR 的 diff 门禁；把 scratch/perf/measure.py 变成 nightly 可重复运行；把 2h soak 变成周度自动报告。

**前置**：P5（bundle-budget v1）、S8-1（build job artifact）、P9（运行环境）、S5（runtime harness 路由 /dev/lyric-stage 是否存在 [待核实]）、B 审计 §5.5 预算表（行 728-735）与 rootMain 实测（行 144-162）。

**写作用域**：scripts/perf/bundle-diff.mjs、scripts/perf/perf-summary.mjs、scripts/perf/soak.mjs、.github/workflows/perf-nightly.yml、.github/workflows/perf-soak.yml、docs/nbl/quality/{bundle-baseline.json,perf-history.jsonl,scenarios.md}、scratch/perf/measure.py（复制为 scripts/perf/measure.py 并固化 CLI，保留原 scratch 文件不删）。

**Step 1（S8-3a，~130 行）**：bundle diff（每 PR，静态，无浏览器）。
- 输入：S0-6 的 perf/build-report.json（rootMainFiles raw/gzip/count、每路由 First Load、CSS、chunks、public）与 docs/nbl/quality/bundle-baseline.json。
- 输出：markdown 表（指标 / baseline / 当前 / delta / 阈值 / 结果）+ JSON；写 job summary；超阈值 exit 1。
- 阈值（总计划 §6.2 行 607-612 的硬阈值）：rootMain gzip >230KB、rootMain raw >800KB、script count >16、First Load **/** >2,000KB、**/_not-found** >1,500KB、CSS >230KB、单 async chunk >400KB、public >45MB → fail；软告警 >baseline+10%。
- --update-baseline 仅在 push master 的 post-merge job 运行（或人工在 master 上跑），并提交 baseline 变更（bot commit 需 contents: write 与 PAT，Q2 [待授权]）。

**Step 2（S8-3b，~110 行）**：.github/workflows/perf-nightly.yml（成本：Bundle ~3min×30/月、Runtime ~10-15min×30，[推断]）。
- 触发：schedule 0 18 * * *（北京 02:00）+ workflow_dispatch。
- Job A bundle-nightly（ubuntu-latest，必跑，~3min）：npm ci → build → bundle-budget → bundle-diff vs baseline → 产物入 artifact → 追加 perf-history.jsonl artifact。
- Job B runtime-perf-nightly（runs-on 由 Q1 决定；默认 self-hosted, windows, gpu [待核实是否存在]，否则本机手动 scripts/perf/run-nightly.ps1）：pip install playwright + playwright install chrome（若用 channel=chrome 则复用系统 Chrome）→ 启动 npm start（3025）或 dev harness → python scripts/perf/measure.py --cases spec --out scripts/perf/out/YYYYMMDD.json → 与 scratch/perf/BASELINE.md / 最近 4 周中位数比较（draw p95 劣化 >15%、dropped >0、FPS 中位降 >10% → 建 issue）。

**Step 3（S8-3c，~140 行）**：.github/workflows/perf-soak.yml（周度，周日 03:00，2h）。
- 脚本 scripts/perf/soak.mjs（Node + CDP，或 .py 复用 Playwright [Q8]）：启动应用 → 固定场景循环（Home→Player→Viz→Queue→Search→切换 20 轮）→ 每 5min 采样：heap（CDP HeapProfiler.collectGarbage 后 usedSize）、DOM 节点数、listeners 计数、AudioContext/activeAudioNodes、长任务数 → 2h 对比 30min 基线（heap 增长 <30MB 为达标、>60MB 建 issue）。
- 采样字段即看板字段（见 Step 4）。
- 成本：2h 运行/周 + artifact 存储（JSON <2MB/次，保留 12 周）。

**Step 4（S8-3d，~50 行）**：看板与汇总。docs/nbl/quality/perf-history.jsonl 每行一次运行，字段固定：

| 字段组 | 字段 |
|---|---|
| 标识 | date / commit / scenario / trigger(pr/nightly/soak/manual) / runner |
| 构建 | rootMain_raw_kb / rootMain_gzip_kb / firstLoad_home_kb / firstLoad_notfound_kb / css_kb / chunk_max_kb / chunk_count / public_mb |
| 运行时 | fps_p50 / fps_p95 / dropped / draw_p50_ms / draw_p95_ms / longtask_count / inp_p75_ms / lcp_ms |
| 内存 | heap_start_mb / heap_end_mb / heap_delta_mb / dom_nodes / listeners / audio_contexts |
| 结论 | status(pass/warn/fail) / notes |

perf-summary.mjs 生成周报 markdown（最近 4 周中位数、与基线 delta、fail 次数），供 Lead 在周会引用。

**测试/自检**
- 用当前 .next 人为把 baseline 的 rootMain_gzip_kb 改小 10% → bundle-diff 必须 fail；改回 → pass。
- measure.py 本机跑 1 个 case（python scripts/perf/measure.py --cases spec --headed；参数以脚本 argparse 为准，已核实存在 argparse/--channel）→ 产出 JSON 且 exit 0（若 harness 路由已删则跳过并记录 [待核实]）。
- soak 试跑 5min（--duration 300）→ 字段齐全。

**验证命令与预期输出**
~~~
node scripts/perf/bundle-budget.mjs --out perf/build-report.json     # exit 0；JSON 含 rootMain/firstLoad/css/chunks/public
node scripts/perf/bundle-diff.mjs --check --report perf/bundle-diff.json  # exit 0；markdown 表 8 行
node scripts/perf/perf-summary.mjs --weeks 4                          # 生成周报（exit 0）
python scripts/perf/measure.py --cases spec --out perf/out/smoke.json # exit 0；JSON 含 fps/draw 分位
~~~

**验收**：E3/E6；PR 上 bundle-diff 必跑；nightly 连续 4 周 ≥28 份 JSON；soak 4 次成功；看板字段 100% 覆盖；负向 fixture fail。

**回滚**：nightly/soak workflow 可直接 disable（GitHub UI）或 revert；baseline JSON revert；measure.py 副本删除不影响产品。**风险**：无稳定 GPU runner 导致数据不可比 → 阈值先只对 bundle 硬性、runtime 先 report-only；harness 路由属 S5，未就绪前 runtime job 不启用（if: vars.PERF_RUNTIME_ENABLED == '1'）。

---

### S8-4 文档事实流水线

**目标**：数字由脚本生成（AUTO 块）或校验（check-docs-facts）；路径/命令/端口/分支引用可验证；季度对账制度化。

**前置**：P4（文档首轮纠偏）；P5（S0-6 的 check-docs-facts 雏形）；S8-1（CI 执行位）。

**写作用域**：scripts/quality/check-docs-facts.mjs、scripts/quality/gen-docs-baseline.mjs、docs/nbl/quality/doc-facts.config.json、docs/nbl/quality/quarterly-audit.md、本文（后续数字块可由脚本生成）。

**Step 1（S8-4a，~180 行）**：check-docs-facts.mjs + config。校验项（10 条，全部可实现、零依赖）：

| # | 检查 | 实现口径 | 失败示例（当前若未修） |
|---|---|---|---|
| D1 | store 数量 | src/store/*.ts 非测试计数 = 60；匹配 AGENTS/ARCHITECTURE 中"N 个 Zustand Store" | AGENTS.md:31 写 44 → fail |
| D2 | store 名单 | 解析 ARCHITECTURE 分类表 store 名（行 142-154）⊆ 实际 store 文件名 | totemStore（ARCHITECTURE.md:149）不存在 → fail |
| D3 | persist key 数 | 扫描 src 中 persist 调用 name 字段计数 = 44 | 数量漂移未更新文档 → fail |
| D4 | 端口一致 | package.json:9,19 与 Dockerfile:25,37、compose:11、clean-port.js:7、electron main:172,200,239 全部为 3025（S0-3 后） | 当前 start=3024 [S0-3 修复前预期 fail，CI 先 warn-until] |
| D5 | CI 触发分支 | workflow 中 branches 仅 master 且仓库存在该分支 | 当前 main（deploy.yml:6,9,79）→ fail |
| D6 | 脚本引用存在 | 文档中 scripts/** 的 .mjs/.py/.ps1 路径必须存在 | 总计划引用 S0-6 未建脚本 → S0 完成后检查 |
| D7 | npm run 引用存在 | 文档中 npm run X 的 X ∈ package.json scripts | 历史文档引用已删除脚本 → fail |
| D8 | 过期数字/字样（enforced 文件） | 禁用词：19,790 / 44 个 Zustand / totemStore / --no-verify / branches: main | AGENTS.md:74,75；ARCHITECTURE:149 → fail |
| D9 | 构建模式描述 | 文档声称 Static Export 时，package.json 必须有 build:static 且 out 新鲜度断言脚本存在 | ARCHITECTURE.md:177 vs package.json:13 [S0-3 后检查] |
| D10 | INDEX 完整性 | 近 30 天新增 docs/nbl/plans/*.md 必须在 INDEX.md 有行（或标记 archived） | 总计划 2026-10-21 尚未登记 [待核实当前 INDEX] |

doc-facts.config.json 字段：enforced（精确文件列表）、ignoredGlobs、checks（开关+expect 值）、bannedPhrases。**enforced 文件（只查这些，避免历史噪声）**：AGENTS.md、README.md、docs/nbl/ARCHITECTURE.md、ROADMAP.md、PROCESS.md、CODING_STANDARDS.md、docs/nbl/plans/INDEX.md、docs/nbl/plans/2026-10-21-*.md、docs/nbl/plans/2026-10-21-arch-perf-execution/*.md、.github 模板。**白名单/忽略**：docs/nbl/archive/**、docs/nbl/specs/**（历史设计）、docs/nbl/plans/2026-05-*/** 与更早（S0-4 标 Superseded 后不强制）、docs/nbl/CHANGELOG.md（历史条目，只查最新版本段）、scratch/**、node_modules/**、.worktrees/**、代码块内文本（解析时跳过 ~~~ 围栏内容，避免示例命令误报）。

**Step 2（S8-4b，~100 行）**：gen-docs-baseline.mjs。在文档中维护 AUTO 块（HTML 注释 marker 包围）：
- 生成内容：store 数、persist 数、src 文件/行数、测试文件/用例数、门禁耗时（引用最后一次 CI run 的 artifact）、包体当前值（bundle-report）；
- --write 更新，--check 与生成结果逐行比较（有差异 exit 1）。总计划 §2 与本文 §1.3 的数字块在 S8-4 后改为 AUTO 生成；过渡期允许手工维护但 CI 只 warn。

**Step 3（S8-4c，~40 行）**：季度对账流程 docs/nbl/quality/quarterly-audit.md（模板 + 4 步：跑 scripts 全量 → 复核 [待核实] 项 → 归档过期 plan（INDEX 状态改 Superseded/Archived）→ 输出 1 页报告）；PR 模板（.github/pull_request_template.md，当前中文乱码需 S0-4 重写）加两条 checkbox：文档事实校验通过、AUTO 块已更新。

**测试/自检**
- 负向 fixture：临时副本 AGENTS.md 注入 19,790 与 44 个 Zustand → 必须 exit 1 并列出 2 条；修正后 exit 0；AUTO 块 --check 未更新时 exit 1、--write 后 exit 0。

**验证命令与预期输出**
~~~
node scripts/quality/check-docs-facts.mjs                 # exit 0（S0-4 完成后）；输出 "10/10 checks OK"
node scripts/quality/check-docs-facts.mjs --json          # 机器可读结果
node scripts/quality/gen-docs-baseline.mjs --check        # exit 0；无 diff
~~~

**验收**：E5；D1-D10 全绿；负向 fixture 拦截；季度报告 1 份入库；INDEX 与 plans 文件一致。**回滚**：删除脚本/config 与 CI 步骤；文档不自动改。**风险**：误报（文档代码块/示例）→ 用 fenced 跳过 + 白名单；历史文档无法全清 → enforced 列表最小化；D4/D9 依赖 S0-3，未完成前 CI 以 warn 记录（带到期日）。

---

### S8-5 发布检查清单

**目标**：把 PROCESS.md §7.3（行 264-271，仅 6 项）升级为"可自动执行的 14 项 release 门禁"，tag 触发、产物可追溯、失败可回滚。

**前置**：P3（build:static/新鲜度）、P7（桌面 smoke）、S1（数据 fixture）、S8-1（verify:ci/workflow_call）。

**写作用域**：scripts/release/preflight.mjs、scripts/release/protected-paths.json、.github/workflows/release.yml、docs/nbl/checklists/release-checklist-2026q4.md、docs/nbl/PROCESS.md（仅 §7.3 表与链接，S0-4 后）、package.json（新增 release:preflight 别名）。

**Step 1（S8-5a，~150 行）**：preflight.mjs（本地与 CI 共用；--tag v0.3.0 参数）。14 项检查：

| # | 检查 | 命令/实现 | 通过标准 |
|---|---|---|---|
| R1 | 版本语义 | package.json:2 版本 == tag 去掉 v；SemVer 校验 | 一致 |
| R2 | CHANGELOG 最新段 | docs/nbl/CHANGELOG.md 存在对应版本段 | 存在且日期 ≤ 今天 |
| R3 | 分支/提交 | 当前分支 master；HEAD == origin/master；工作树干净 | 全部满足 |
| R4 | verify:ci 证据 | 本地执行 verify:ci（或校验 release workflow 上游 job 成功） | exit 0 |
| R5 | out 新鲜度 | scripts/perf/build-stamp.json 的 buildStart < out/index.html mtime；out 存在 | 新鲜 |
| R6 | 静态产物结构 | out/index.html、out/data-manager.html、out/_next/static 存在 | 齐全 |
| R7 | 桌面产物结构 | dist-electron/*.exe ≥2、SHA256SUMS.txt、win-unpacked/resources/{app.asar,backend.exe} | 齐全 |
| R8 | 后端 binary | backend/dist/backend.exe 存在且 size > 30MB | 存在 |
| R9 | 数据兼容 fixture | npx vitest run src/test/persistence（S1 提供，路径 [待核实]） | 0 failed |
| R10 | V7 保护视图 | git diff --name-only <lastTag>..HEAD 与 protected-paths.json 求交；有交集时需 env V7_APPROVED=1 | 通过或显式批准 |
| R11 | 文档事实 | node scripts/quality/check-docs-facts.mjs | exit 0 |
| R12 | 包体预算 | node scripts/perf/bundle-diff.mjs --check | exit 0（或已批准 waiver） |
| R13 | 依赖健康 | npm ls --depth=0 无 extraneous/missing；npm audit --omit=dev --audit-level=high（先 report-only） | exit 0 / 报告存档 |
| R14 | 回滚点 | git tag -l 存在上一个 tag；release notes 含回滚命令 | 存在 |

protected-paths.json 初版（S0-4 定稿，[待核实精确清单]）：Home View / Player View / 全屏歌词相关文件（总计划 §1.3 I5、PROCESS.md:46-54 的禁令范围）。

**Step 2（S8-5b，~120 行）**：.github/workflows/release.yml：
- 触发：push tag v*；workflow_dispatch 允许 dry-run；
- 步骤：checkout（fetch-depth 0）→ setup node 24 → npm ci → uses: ./.github/workflows/ci.yml（workflow_call，S8-1a 已声明）→ build:static → backend.exe 构建（windows-latest 单 job，PyInstaller）→ electron-builder --win --x64 → preflight --tag → 生成 SHA256SUMS → upload artifact（exe/asar/backend.exe/checksums）→ gh release create（draft，附 artifacts 与 checksums）→ environment: production（手动审批）。
- 产物保留 90 天；失败不自动删 tag。

**Step 3（S8-5c，~60 行）**：更新 docs/nbl/PROCESS.md:264-271 为 14 项表 + 引用 preflight 命令；新增 docs/nbl/checklists/release-checklist-2026q4.md（人读版，含 Electron/离线/音频听感人工项）；docs/nbl/plans/INDEX.md 保持一行（若新增）。

**测试/自检**：在临时 tag v0.0.0-preflight-test 上跑 node scripts/release/preflight.mjs --tag v0.0.0-preflight-test --dry-run，预期 R1/R2 失败并给出修复提示；修复一个再跑，观察逐项通过；R5/R7/R8 在无产物时应 fail-fast。release.yml 先用 workflow_dispatch dry-run（不创建 release）。

**验证命令与预期输出**
~~~
node scripts/release/preflight.mjs --tag v0.3.0 --dry-run
# 期望：R1..R14 逐项输出 PASS/FAIL；有 FAIL 时 exit 1
git tag v0.0.0-preflight-test && node scripts/release/preflight.mjs --tag v0.0.0-preflight-test
# 期望：exit 1，R1/R2 FAIL
~~~

**验收**：E1/E6 联动；dry-run 全 PASS；负向 tag 被拦；真实 release（下一版本）一次跑通且 artifact 可下载；CHECKLIST 14 项与 preflight 一一对应。**回滚**：删除 release.yml/tag 本地；产物重新构建；数据无迁移。**风险**：electron-builder 在 CI windows 上签名/UPX 差异 [待核实]；gh release 需要 token 权限（Q2）；R9 路径由 S1 决定，未就绪前降级为"人工勾选 + 跳过注明"。

---

### S8-6 长期 backlog

**目标**：给"不阻塞本次 10-12 周主线、但必须有人管"的事项定义优先级与触发条件，避免腐烂成"永远没时间"。

**写作用域**：docs/nbl/quality/backlog.md（新）+ 季度报告模板。每季度第一周评审，产出 docs/nbl/quality/quarterly-YYYY-QN.md 并更新 INDEX。

| # | 事项 | 来源 | 优先级 | 触发条件（满足即排期） | 预估 | 验收 |
|---|---|---|---|---|---|---|
| L1 | features 目录领域化（渐进，不一次性迁移） | 总计划 §4.7；A 审计 W13 | P2 | S6 完成 + 目录结构稳定 1 个月 | ~5,000 行 / 6-8 PR | import 边界（S6-12）绿；无行为变化 |
| L2 | V7 14 个效果全部插件化（EffectPlugin/RenderRuntime） | 总计划 S5-4；B 审计 §4 | P1 | S5 契约稳定 + 试点 3 个效果迁移通过 | ~2,500 行 / 6 PR | 新效果接入不改中心 switch；契约测试覆盖 100% |
| L3 | 4K/低端场景验收（D5 质量档位） | 总计划 D5；B 审计 §5.5 | P2 | 1080p 基线连续 2 周稳定 | 真机 1-2 天 | 4K dpr2 FPS 达标；low 档自动降 |
| L4 | Playwright E2E（桌面+Web 冒烟） | B/D 审计缺口；总计划 §1.1 非目标约束 | P2 | S1/S2/S3 关键路径修复完成；Q1 runner 决策 | ~1,200 行（单独立项评估依赖） | 6 条核心场景 nightly 绿 |
| L5 | OPFS 二进制缓存落地 | 总计划 §4.5/§7.3 | P3 | IDB 二进制迁移 spike 通过 + 用户磁盘配额问题出现 | ~800 行 | 迁移可回滚；旧数据可读 |
| L6 | 依赖升级节奏（Node 24 对齐、ESLint 9 flat、Next/Vitest minor） | 总计划 §10.4；D 审计 P1-5 | P1 | 每季度首周 | 1-2 天/季 | verify:ci 绿；无新 phantom deps |
| L7 | mutation testing（Stryker）评估 | A 审计测试质量 | P3 | store/services 域覆盖率 ≥65% 后 | 试点 2 天 | 关键 store 突变分数 ≥70% |
| L8 | 质量看板（coverage/perf/CI 时长趋势） | S8-3 数据积累 | P2 | S8-3 数据 ≥8 周 | ~300 行 | 周报自动生成；回归可见 |
| L9 | 仓库卫生季度 GC（worktree/dist-electron/out/coverage） | D 审计 P2-3 | P2 | 每季度 | 0.5 天 | worktree ≤5；磁盘回收 ≥5GB |
| L10 | 插件沙箱与第三方源安全审计 | 总计划 S7-8 后续；D 审计 P2-11 | P2 | 在线源 >3 个或安全事件 | 2 天 | 恶意 fixture 无法越权 |

**触发条件执行规则**：季度评审逐项判定触发/未触发；未触发写原因并顺延；连续 2 季度未触发且无人认领 → 归档并记录。任何 L 项启动前按总计划 I6 拆 PR（≤400 行）。

---

## 6. 阶段验证命令与证据

### 6.1 本地一键验证（S8 自身脚本，无需 CI）

~~~
node scripts/quality/validate-workflow.mjs          # WORKFLOW_OK（exit 0）
node scripts/quality/check-file-size.mjs --check    # FILESIZE_OK（exit 0）
node scripts/quality/check-docs-facts.mjs           # 10/10 checks OK（exit 0）
node scripts/quality/coverage-gate.mjs --report-only# 8 域表（exit 0）
node scripts/perf/bundle-budget.mjs --out perf/build-report.json   # exit 0
node scripts/perf/bundle-diff.mjs --check           # BUDGET_OK（exit 0）
node scripts/release/preflight.mjs --tag vX.Y.Z --dry-run          # 14 项 PASS
~~~

### 6.2 CI 证据（E1-E6 对应）

| 出口 | 证据 | 存档位置 |
|---|---|---|
| E1 | 首次绿色 ci run（wall time、job 列表、required check 配置截图） | docs/nbl/quality/evidence/s8-e1.md + Actions URL |
| E2 | coverage-gate 输出表 + 负向 fixture run | s8-e2.md |
| E3 | bundle-diff 表 + 负向 fixture run | s8-e3.md |
| E4 | depcruise 输出 + file-size 负向 fixture | s8-e4.md |
| E5 | docs-facts 输出 + 注入过期数字的 fixture run | s8-e5.md |
| E6 | 连续 4 周 nightly/soak 报告 + perf-history 行数 | s8-e6.md + perf-history.jsonl |

---

## 7. 与相邻阶段接口

| 阶段/任务 | 提供方 | S8 消费方式 | 避免重复的边界 |
|---|---|---|---|
| S0-2 | CI 最小版 | S8-1 在当前 ci.yml 上扩展 job，不重建触发/权限骨架 | S0 建骨架，S8 加完整检查与 required 聚合 |
| S0-4 | 文档首轮纠偏 | S8-4 以纠偏后的 enforced 文件为基线；负向测试基于已修状态 | S0 改内容，S8 建检查 |
| S0-6 | scripts/perf/bundle-budget.mjs、scripts/report-store-stats.mjs、check-docs-facts 雏形 | S8-1 接线；S8-3 扩展 bundle-diff；S8-4 扩展校验项；S8 负责长期维护（owner 交接写入 README） | S0 造 v1，S8 造门禁与扩展，不重写 v1 口径 |
| S1 | 数据兼容 fixtures（44 key / 备份 envelope） | S8-5 R9 在 release 前跑；S8-2 覆盖率基线包含 store 域 | S1 提供 fixture 路径与命令，S8 只接线 |
| S5 | runtime harness 路由（measure.py 依赖）、渲染运行时 | S8-3 runtime job 依赖 harness 存在；S8-6 L2 效果插件化 | S5 提供 harness/契约，S8 只做测量编排 |
| S6-1/S6-12 | selector 门禁、depcruise 规则、文件行数棘轮初版 | S8-1c 复用其 baseline；S8 负责 CI required 与棘轮收紧 | S6 定义规则，S8 强制执行 |
| S7-4/S7-6 | Electron 本地运行时、启动冒烟脚本 | S8-5 R7/Electron smoke 接线；S8-3 soak 可选 Electron 模式 | S7 提供可运行 smoke，S8 编排 release |
| 审计 A/B/D | store 统计口径（A §899-909）、包体预算（B §5.5、D §5.5/§6） | S8-3 阈值直接继承 B/D 数字；S8-2 阈值继承 D 实测 | 审计给数字，S8 给门禁 |

---

## 8. 未决问题（需 Lead/授权人决策）

| # | 问题 | 选项 | 推荐 | 阻塞项 |
|---|---|---|---|---|
| Q1 | runtime 性能环境 | A 自托管 Windows GPU runner；B ubuntu + Chrome headless（FPS 数据不可信）；C 本机手动跑、结果入库 | **A**（无则 C 过渡） | S8-3 runtime/soak |
| Q2 | GitHub 权限与 token | A repo admin 配置 branch protection + PAT 供 bot 提交 baseline；B 仅 CI 红不阻塞 | **A** | S8-1 E1、S8-3 baseline 自动更新 |
| Q3 | release workflow 是否保留 Vercel 部署 | A 删除（与桌面无关）；B 保留但独立 workflow | **A**（当前 deploy.yml:76-90 与产品发布无关） | S8-5 |
| Q4 | components 域是否纳入覆盖率 | A S5 后纳入（渲染运行时稳定后）；B 永久排除 | **A** | S8-2 阈值表最终版 |
| Q5 | 是否允许 CI 使用 actionlint（非 npm 依赖） | A 允许（npx 临时）；B 只用零依赖校验 | **B**（先零依赖，网络稳定后再 A） | S8-1 Step 5 |
| Q6 | measure.py harness 路由归属 | A S5 提供 /dev 路由；B 独立 harness 页面随 S8-3 入库 | **A** | S8-3 runtime job |
| Q7 | 保护视图精确文件清单 | A S0-4/PROCESS 定稿；B 由 git 历史+人工确认 | **A** | S8-5 R10 |
| Q8 | 阈值豁免签字人 | A Lead；B 架构 owner 轮值 | **A** | S8-1d/S8-2c 流程 |

---

*本文为 S8 实现级执行计划，所有"现状"数字均标注来源；实施时按子 PR 顺序落地，每 PR ≤400 行，完成后回填 §6 证据。*
