# S0 止血与基线 — 执行计划

> 上级计划：[架构与性能优化总计划](../2026-10-21-architecture-performance-optimization.md) §5 S0 / §6 / §8
> 执行包：[README](./README.md) · [决策记录](./00-decisions.md) · [进度看板](./TRACKING.md)
> 阶段：S0（7 个任务，约 9-10 个 PR）；预估：1-2 人日（单人）/ 2-3 人并行约 1 日；状态：**未开始**
> 规划快照：feature/gesture-air-control-overhaul @ `c73a872`（含 55 项未提交改动）；实施基线：master=`90c2152`，S0-1 处理后回到干净树
> 规范依据：PROCESS.md:131-134（单 PR ≤400 行）、AGENTS.md、ROADMAP.md、总计划 §1.3 不变量

---

## 1. 阶段目标与出口条件

**目标**：让后续所有阶段有可复现基线、真实 CI、可信文档和可量化测量；在补安全网之前不做任何产品逻辑重构。

| 出口 | 指标 | 现状（2026-10-21 实测） | 目标 | 测量方式 |
|---|---|---|---|---|
| E0-1 基线可信 | 干净树 + 基线 commit 记录；与总计划 §2.2 偏差 | 55 项脏改 / 17.3k 行；基线不可复现 | git status 仅剩预期文档；同一 commit 复测 tsc/lint/test/build 全绿，耗时偏差 ≤20% | S0-1 证据 + 4 条命令 |
| E0-2 CI 真实 | PR 触发；required checks；push master 触发 | deploy.yml:3-9 只监听不存在的 `main`；仅 lint+test | 4 个 required checks（lint/vitest/tsc/build）连续 3 个 PR 绿；单次 ≤20min | GitHub Actions 运行记录 |
| E0-3 发布止血 | 陈旧 `out/` 不得进入桌面包；端口单一 | out/ mtime 2026-07-30；`start` 3024 vs dev 3025 | `build:electron*` 在 out 缺失/过期时 exit≠0；3024 引用=0；本地 3025 返回 200 | `assert-static-export.mjs` + curl |
| E0-4 文档事实 | 文档数字与代码/脚本一致 | AGENTS:31 写 44 store（实测 60 模块）；ARCHITECTURE:3,29,91,177 过时；ROADMAP:14 "28 static pages" | `check-docs-facts.mjs` exit 0，违规=0 | 脚本输出 |
| E0-5 死层与卫生 | coordinator 0 外部引用；死文件清理；worktree/根目录收敛 | coordinator 12 处引用全部在自身目录；`page.tsx.v7`、`VisualizationView.tsx.fix` 存在；27 worktree | 外部 import=0 且 ESLint 禁入；死文件删除；worktree ≤5；根目录文件 ≤20 | 脚本 + `git worktree list` |
| E0-6 测量基座 | 一条命令产出 baseline JSON；可复现 | 仅 scratch/perf 手工脚本，无入库脚本 | 2 次运行 JSON diff=0；数字复现审计 A/D（counts 精确、bytes ±0.5%） | 两条命令 + diff |
| E0-7 决策 | 8 个 ADR 状态明确；D1/D2/D7 有用户结论 | 00-decisions.md 全部 Pending | D1/D2/D7 用户拍板；D3-D8 有 Proposed/Accepted 与默认值；ADR 文件 8 个 | 文档评审 |

**出口门（M0）**：以上 E0-1..E0-7 全部满足才能进入 S1；未达标项写原因并降级为 S1 阻塞债务，不允许静默跳过。

---

## 2. 前置条件、依赖与不变量

**前置条件**
1. **用户授权 S0-1**：55 项手势改动的处置方式（checkpoint / 拆 PR / 冻结 worktree）必须由用户确认，任一方式都会改变后续所有 PR 的基线。
2. GitHub 仓库管理员权限（branch protection required checks）——需 Lead 持有，否则 E0-2 只能做到 report-only。
3. Node 版本待核实：本地/CI 需一致（建议 CI Node 24，本地 `node -v` 记录到证据）。
4. 本阶段**不运行** `npm install` 新增运行时依赖；新增 devDependency（如 S1-4 的 `fake-indexeddb`）单独评审。

**依赖关系**
```
S0-1（脏改） ─→ S0-2（CI required 需干净树）
S0-3（发布止血） ── 独立，但形态受 D2 影响
S0-4（文档） ── 独立；其校验由 S0-6b 的 docs-facts 收口
S0-5（死层） ─→ 依赖 S0-1（避免删文件与脏改冲突）
S0-6（测量） ── 独立；S0-6a 先于 6b
S0-7（ADR） ── 独立；D2 结论回写 S0-3
```

**硬不变量（全阶段）**：I1 用户数据兼容（不删/不改 44 个 persist key 与 IDB 字段）；I2 播放连续性（S0 不改播放逻辑）；I3 单一事实源；I4 资源有 owner；I5 受保护视图 Home/Player/全屏歌词视觉与交互不变；I6 每 PR ≤400 行；I7 验证顺序 `eslint → vitest → tsc → build → clean-port/dev → smoke`，禁止并行 build 与 tsc、禁止 dev 存活时清理 `.next`。

**本阶段明确不做**：不改产品运行时逻辑；不删/改 44 个 key；不执行耗时打包（build:electron）作为门禁；不动用户 55 项脏改内容本身（S0-1 只做版本控制操作）。

---

## 3. 任务总表

| ID | 任务 | 写作用域（精确文件） | 子 PR | 依赖 | 风险 | 验收（可量化） |
|---|---|---|---|---|---|---|
| S0-1 | 处理 55 项未提交手势改动，锁定干净基线 | 无文件；仅 git refs/分支（**Lead 执行，需用户授权**） | 1 次操作 | 无 | **高**（17.3k 行，误操作可丢代码） | `git status --porcelain` 仅剩本计划包；基线 SHA 记录；复测 4 命令全绿 |
| S0-2 | CI 复活：master 触发 + tsc/lint/vitest/build + 缓存/超时/并发 | `.github/workflows/ci.yml`（新）、`deploy.yml`（收缩为手动发布） | 1 | S0-1 | 低-中（首跑暴露既有问题） | required checks 3 连绿；≤20min |
| S0-3 | 构建产物与端口明确化：陈旧 out 阻断 + 端口统一 3025 | `package.json`、`scripts/assert-static-export.mjs`（新）、`scripts/assert-static-export.test.mjs`（新）、`Dockerfile`、`docker-compose.yml`、`scripts/build-desktop-win.ps1`、`docs/nbl/ARCHITECTURE.md`（构建模式行） | 1 | 无（D2 影响形态） | 中（误改发布链） | out 缺失/过期 exit≠0；3024 引用=0；`npm start` 3025 返回 200 |
| S0-4 | 文档事实修正 | `AGENTS.md`、`docs/nbl/ARCHITECTURE.md`、`docs/nbl/ROADMAP.md`、`docs/nbl/plans/2026-05-10-phase1-store-decoupling.md`、`.github/pull_request_template.md`、`docs/nbl/plans/INDEX.md` | 1 | 无 | 低 | docs-facts 违规=0（S0-6b 后）；人工对照清单全勾 |
| S0-5 | 死层标记与仓库卫生 | `src/store/coordinator/{index,audioCoordinator,queueCoordinator,types}.ts`（注释）、`.eslintrc.json`、删除 `src/app/page.tsx.v7`、`src/components/visualization/VisualizationView.tsx.fix`、`scripts/gc-worktrees.ps1`（新） | 1 | S0-1 | 中（删文件需确认非保护视图） | coordinator 外部 import=0 且 ESLint 拦截；worktree ≤5；根文件 ≤20 |
| S0-6 | 测量基座 v1 | **6a**：`scripts/perf/bundle-budget.mjs`、`scripts/perf/bundle-budget.test.mjs`、`scripts/report-store-stats.mjs`、`scripts/report-store-stats.test.mjs`、`perf/budget.json`；**6b**：`scripts/check-docs-facts.mjs`、`scripts/docs-facts.config.mjs`、`src/lib/perf/playbackMarks.ts`、`src/lib/perf/playbackMarks.test.ts` | 2（6a/6b） | 无 | 低 | 一条命令产出 JSON；2 次 diff=0；数字复现审计 A/D；≤10s |
| S0-7 | ADR D1-D8 与决策归档 | `docs/nbl/adr/README.md` + `0001-v8-visualization.md`…`0008-third-party-sources.md`（8 个新文件） | 1 | 无（D2 回写 S0-3） | 低 | 8 个 ADR 存在、状态明确、默认值可执行；D1/D2/D7 有用户签字结论 |

**子 PR 拆分规则**：S0-6 必须拆 6a/6b（文件集合不相交，6a 只新增 scripts/perf 与 perf/，6b 只新增 docs-facts 与 src/lib/perf）；其余任务单 PR。共享文件 `package.json` 只有 S0-3 一个 owner，S0-2/S0-6 不允许改它（如需 `verify:*` 别名，推迟到 S8-1 或由 Lead 串行追加）。

---

## 4. 逐任务执行步骤

### S0-1 处理 55 项未提交手势改动（**需用户授权；Lead 执行**）

**目标**：把不可复现的 55 项脏改变成可追溯 commit/worktree，后续所有测量与 PR 从干净树开始。
**前置**：用户确认方式；Lead 拿到操作授权。
**写作用域**：仅 git（新建/推送 checkpoint 分支、commit）。不改任何源码内容。

**Step 1｜盘点（只读）**
```powershell
git status --porcelain=v1 | Measure-Object -Line          # 期望 55 项左右
git diff --stat | Select-Object -Last 1                    # 记录变更行数（总计划报 17.3k）
git branch --show-current; git rev-parse HEAD
git worktree list
```
把输出写 `docs/nbl/plans/2026-10-21-arch-perf-execution/evidence/S0-dirty-inventory.txt`（证据，不提交源码）。

**Step 2｜确认处置方式（用户决策，三选一）**
- A（推荐）：创建 `checkpoint/gesture-air-control-overhaul-20261021` 分支并 commit 全部改动 → 保留完整现场；后续按模块拆 ≤400 行 PR 合入 master。
- B：不 commit，先冻结 worktree（`git worktree add` 另建干净目录做 S1+），脏改留在主工作区不碰。
- C：分模块拆 PR 序列（每 PR ≤400 行）合入 master；成本最高，但主线最早干净。
> 禁止 `git checkout --` / `git reset --hard` / `git clean -fd` 处理用户改动；禁止 force push。

**Step 3｜执行（以 A 为例）**
```powershell
git switch -c checkpoint/gesture-air-control-overhaul-20261021
git add -A
git commit -m "chore: checkpoint gesture air control overhaul (55 files, pre-arch-perf baseline)"
git rev-parse HEAD                                        # 记录 baseline SHA
```
若用户选 B：从 master 建干净 worktree `.worktrees/arch-perf-main`，所有后续 PR 在该 worktree 工作，主工作区脏改冻结。

**Step 4｜干净树复测基线**
在干净 commit/worktree 上按 I7 顺序执行（本阶段只记录，不优化）：
```powershell
npx eslint src --max-warnings=0
npm run test -- --run
npx tsc --noEmit --incremental false --pretty false
npm run build
```
与总计划 §2.2 基线对比（205 文件/1267 用例、tsc 23.3s、lint 142.4s、build 114.9s）。**偏差 >20% 或任一非绿 → 暂停 S0-2，先定位环境差异**（Node 版本/npm ci 状态）。

**测试**：无代码测试；验收靠命令输出与 commit 记录。
**验证**：`git status --porcelain` 为空（或仅本计划包未跟踪文件）。预期输出：空。
**验收标准**：(1) baseline SHA 写入 S0 证据与 TRACKING；(2) 4 命令 exit 0；(3) 脏改清单 55±2 项与总计划一致，差异逐条说明。
**回滚**：checkpoint 分支可随时 `git branch -a` 找回；不涉及数据与产品逻辑。
**风险**：R1（总计划 §7.1）——误操作丢代码。缓解：只 commit 不 reset；先记录 SHA；分支名含日期。

---

### S0-2 CI 复活（1 PR，~120 行 YAML）

**目标**：让每个 PR 有真实门禁；push master 触发；保留发布 job 但不阻塞。
**前置**：S0-1 完成（否则首次跑的就是脏树）；确认本地 4 命令全绿（总计划 §2.2 已实测，但需在 baseline commit 复测）。
**写作用域**：`.github/workflows/ci.yml`（新增）、`.github/workflows/deploy.yml`（删除 dead main 触发，保留手动发布）。

**Step 1｜新建 ci.yml**
```yaml
name: ci
on:
  push: { branches: [master] }
  pull_request: { branches: [master] }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
permissions: { contents: read }
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci --legacy-peer-deps
      - name: Lint (src, 0 warnings)
        run: npx eslint src --max-warnings=0
      - name: Unit tests
        run: npx vitest run --reporter=dot
      - name: Type check (after tests per PROCESS order)
        run: npx tsc --noEmit --incremental false --pretty false
      - name: Build
        run: npm run build
      - name: Docs facts (S0-6b 后启用)
        run: node scripts/check-docs-facts.mjs
        continue-on-error: true
```
执行顺序按项目 I7（lint→vitest→tsc→build），**不要**按审计 D 草稿的 tsc-first。docs-facts 在 6b 合入后去掉 `continue-on-error`。

**Step 2｜收缩 deploy.yml**
把 `on:` 改为 `workflow_dispatch:`（发布保留人工触发）；删除 `branches: [main]` 与 `:79 if: github.ref == 'refs/heads/main'`；文件保留以便回滚。注意：**不要**在本 PR 同时改 electron 打包 job（属 S7-4）。

**Step 3｜本地等价验证（CI 无网络时）**
逐条执行 Step 1 的四个命令，记录 exit code、耗时、输出摘要。YAML 语法：`npx prettier --check .github/workflows/ci.yml`（prettier 3.2.5 在 devDeps）。
**预期**：eslint exit 0（总计划 §2.2：src 0 problems）；vitest 205 文件/1267 用例 0 failed；tsc exit 0；build exit 0（3 静态页 + 31 API route）。若 eslint `--max-warnings=0` 失败：说明基线有 warning，本 PR 先改 `--max-warnings=100` 并在 PR 记录欠账（不得隐瞒）。

**Step 4｜上线策略**
首次合并后 3 个 PR 设为 report-only（不 required）→ 观察 3 次全绿 → Lead 在仓库设置中把 `verify` 设为 required（需要 admin）。把截图/链接写证据文件。

**测试**：无单测；验证 = 命令 + Actions 运行记录。
**验收**：(1) push/PR 到 master 触发；(2) 3 连绿；(3) 单次 ≤20min；(4) required check 生效截图。
**回滚**：删除 ci.yml、恢复 deploy.yml 的 `on:`（revert 单 PR）。
**风险**：R10 首跑暴露既有问题 → report-only 策略；缓存未命中导致首跑 >20min → `npm ci` 缓存 + 首次跑不设硬门禁。

---

### S0-3 构建产物与端口明确化（1 PR，~80 行）

**目标**：阻断"陈旧 out/ 进桌面包"；端口单一事实源 3025。**不修复桌面运行时**（D2 未定，S7-4 负责）。
**前置**：D2 推荐值 B（捆绑本地 Next）未拍板 → 本任务按"**桌面发布冻结 + fail-fast**"执行，不承诺 build:static 可用。
**写作用域**：`package.json`、`scripts/assert-static-export.mjs`（新）、`scripts/assert-static-export.test.mjs`（新）、`scripts/build-desktop-win.ps1`、`Dockerfile`、`docker-compose.yml`、`docs/nbl/ARCHITECTURE.md:177`（构建模式行）。

**已核实的现状（作为改动依据）**
- `next.config.js:3`：`output: process.env.STATIC_EXPORT ? "export" : undefined`；全仓无脚本设置 `STATIC_EXPORT`。
- `package.json:13` build 只产 `.next`；`:14-17` build:electron* 均只 `npm run build`；`:19` `start` 用 3024，而 `:9` dev 用 3025。
- `electron/main/index.js:36,40` 从 `../../out` 读静态文件；`:198` 生产 `loadURL("app://app/")`；`:200` dev 用 3025。
- `Dockerfile:25,37,39`：`ENV PORT=3025`、`EXPOSE 3025`、`CMD npm start` → 与 `next start -p 3024` 冲突。
- `scripts/clean-port.js:7` DEFAULT_PORT=3025；`scripts/start-full.js:119` 打印 3025。
- 桌面发布链：`scripts/build-desktop-win.ps1:45` 调 `npm run build`（未设置 STATIC_EXPORT）；`package.json:92-97` electron-builder files 只含 `out/**`。

**Step 1｜新增断言脚本** `scripts/assert-static-export.mjs`
```js
// 导出纯函数便于单测；CLI 行为：exit 0=可用，2=缺失，3=过期，1=冻结/未知
export function evaluateOutFreshness({ outMtimeMs, buildIdMtimeMs, nowMs }) {
  if (outMtimeMs == null) return { code: 2, reason: "missing" };
  if (buildIdMtimeMs != null && outMtimeMs < buildIdMtimeMs) return { code: 3, reason: "stale" };
  return { code: 0, reason: "fresh" };
}
// CLI: node scripts/assert-static-export.mjs [--require-fresh] [--out <dir>] [--ref <file>]
// 默认 ref = .next/BUILD_ID 的 mtime；--require-fresh 时缺失/过期均 exit≠0 并打印：
// "[assert-static-export] out/ 缺失或早于本次构建：桌面发布已冻结（D2 未定；修复见 S7-4）"
```
**不要**在本 PR 里设置 `STATIC_EXPORT=1` 依赖：`output:"export"` 与 31 个 `src/app/api/**/route.ts` 很可能不兼容（**待核实**，S7-4 spike 验证）。本任务只做"阻断"。

**Step 2｜接入发布链**
- `package.json`：`:14-17` 的 build:electron* 在 electron-builder 前加 `node scripts/assert-static-export.mjs --require-fresh &&`。
- `scripts/build-desktop-win.ps1:45`：改为 `Invoke-Step "Assert static export" { node scripts/assert-static-export.mjs --require-fresh }`，保留后续步骤（一旦 D2=B，S7-4 替换为构建本地 Next 运行时）。
- 可选：新增 `"build:static": "cross-env STATIC_EXPORT=1 next build --webpack"`（cross-env 已在 `:68`），但**不接入** electron 链，仅作为 S7-4 spike 入口；若执行后失败，把输出记入证据并注明"待 S7-4"。

**Step 3｜端口统一**
- `package.json:19`：`"start": "next start -p 3025"`。
- 复核 `Dockerfile`（`CMD npm start` + `PORT=3025` 即一致）、`docker-compose.yml:10-14`（3025:3025 不变）、`package.json:9-10`（dev 3025 不变）、`electron/main/index.js:200`（dev 3025 不变）。
- 若 `Dockerfile` 使用 `PORT` 环境变量而 `-p 3025` 固定，保持固定值与 ENV 一致并在注释说明（避免容器内 PORT 覆盖产生第二种真值）。

**Step 4｜文档**
`docs/nbl/ARCHITECTURE.md:177`：`构建模式 Static Export → Web=next build（.next，服务端）；Electron=STATIC_EXPORT 静态导出（build:static，当前冻结待 D2/S7-4）`。该行同时属 S0-4，由本任务先改、S0-4 复核，避免两 PR 争同一文件（S0-4 只改其他行；如冲突，Lead 串行）。

**测试** `scripts/assert-static-export.test.mjs`（vitest，参照现有 `scripts/clean-port.test.js` 模式）：
- `"missing out returns code 2"`：`expect(evaluateOutFreshness({outMtimeMs:null, buildIdMtimeMs:1, nowMs:2})).toMatchObject({code:2,reason:"missing"})`
- `"stale out returns code 3"`：out=100 < ref=200 → `{code:3,reason:"stale"}`
- `"fresh out returns code 0"`：out=300 ≥ ref=200 → `{code:0,reason:"fresh"}`
- `"CLI exits non-zero for missing out"`：`spawnSync(process.execPath, [script, "--require-fresh", "--out", tmpMissingDir])` → `status === 2`

**验证命令与预期**
```powershell
node scripts/assert-static-export.mjs; echo "exit=$LASTEXITCODE"   # 当前 out/ 为 2026-07-30 陈旧 → exit=3（符合预期"阻断"）
npx vitest run scripts/assert-static-export.test.mjs               # 4 passed
git grep -n "3024" -- package.json Dockerfile docker-compose.yml   # 无匹配（exit 1）
npm run build; npm start &                                         # 构建后启动
curl -s -o NUL -w "%{http_code}" http://localhost:3025/            # 200
curl -s -o NUL -w "%{http_code}" http://localhost:3025/data-manager# 200
```
**验收**：(1) out 缺失/过期时 `build:electron*` 与 assert 非 0；(2) `3024` 引用=0；(3) 3025 HTTP 200；(4) 不改 electron 主进程运行时代码。
**回滚**：revert 单 PR；assert 是纯新增，不影响 `npm run build`/`dev`。
**风险**：误把发布永久堵死 → 在脚本输出中明确"冻结是临时措施，解冻条件=D2 拍板+S7-4 完成"；`build:static` spike 失败不得阻塞本 PR（不接入链）。

---

### S0-4 文档事实修正（1 PR，文档不计行数）

**目标**：消除会误导工程师/Agent 的数字与链路描述；为 S0-6b 的 docs-facts 建立"可校验"的基准。
**写作用域**：`AGENTS.md`、`docs/nbl/ARCHITECTURE.md`、`docs/nbl/ROADMAP.md`、`docs/nbl/plans/2026-05-10-phase1-store-decoupling.md`、`.github/pull_request_template.md`、`docs/nbl/plans/INDEX.md`。

**Step 1｜逐项核对后修改**（每项改完在 PR 描述贴 before/after）
| 文件:行 | 现状（已核实） | 改为 |
|---|---|---|
| AGENTS.md:31 | `**44 个 Zustand Store**` | `60 个 Zustand Store（2026-10-21 实测；src/store 60 模块 + coordinator 4 文件，后者 0 外部引用）` |
| AGENTS.md:74 | "ESLint 当前 19,790 行问题（…）" | `eslint src 当前 0 problems（2026-10-21 实测）；历史 19,790 行问题已随基线修复，见 CHANGELOG` |
| AGENTS.md:75 | "需 --no-verify 绕过" | `pre-commit 运行 lint-staged（eslint --fix + prettier）；无 tsc/test hook（S8-1 前）` |
| AGENTS.md:77 | "测试步骤被注释" | `CI workflow 存在但历史触发分支 main 不存在（默认 master）→ 2026-10-21 前不生效；S0-2 改为 master 触发` |
| AGENTS.md:84 | 当前实施计划指向 2026-05-10 phase0 | 指向 `docs/nbl/plans/2026-10-21-architecture-performance-optimization.md` + 本执行包 README |
| ARCHITECTURE.md:3 | "SPA + Static Export + Electron" | `SPA + Next server（Web）/ Electron 静态导出（冻结，D2/S7-4）` |
| ARCHITECTURE.md:25-26 | "Coordinator Layer (Phase 1) … 管理跨 Store 事务" | 同处加注：`当前未接线（外部引用 0，2026-10-21 核实）；目标态见总计划 §4.1/§4.3 与 S6-9` |
| ARCHITECTURE.md:29,91 | 44 stores | 60（以 `src/store/*.ts` 非测试模块数为准，S0-6a 脚本输出） |
| ARCHITECTURE.md:142-154 | 分类表含 `totemStore`，缺 15 个 | 以审计 A §2.2 的 60 模块清单与审计 D 附录 E 为输入逐条核对后增删；**核对不出的条目标「待核实」不得臆造** |
| ROADMAP.md:14 | "（28 static pages）" | `3 个真实页面 + 31 个 API route；28 为 Next 生成计数，不是页面数` |
| phase1-store-decoupling.md 顶部 | 未标 superseded，含 `--no-verify` | 加 banner：`> **Superseded（2026-10-21）**：本计划不再执行；store 架构工作见 2026-10-21 总计划 S1/S6。` |
| pull_request_template.md | 审计报乱码（**待核实**：打开确认编码） | UTF-8 重写，含：任务 ID、写作用域、≤400 行声明、数据兼容/fixture、V7 禁令、验证证据、回滚方式 |
| INDEX.md | 缺本次计划包条目 | 增加 2026-10-21 总计划 + 执行包 9 份文件链接 |

**Step 2｜交叉一致性检查**
- `rg -n "44 个 Zustand|44 stores|28 static|19,790" AGENTS.md docs/nbl/ARCHITECTURE.md docs/nbl/ROADMAP.md` → 只允许历史/迁移说明中出现。
- 所有被引用的文件路径必须存在：`Test-Path` 逐条验证（避免写不存在的脚本/计划）。

**测试/验证**：本轮 S0-4 用人工清单；S0-6b 合入后执行 `node scripts/check-docs-facts.mjs` exit 0。
**验收**：上表 13 项全改；`git diff --stat` 只涉及列出的 6 个文件；无源码改动。
**回滚**：revert 单 PR。
**风险**：改错保护视图描述 → 只改事实描述，不改 UX/流程要求；不确定条目保留原文并标记「待核实」。

---

### S0-5 死层标记与仓库卫生（1 PR，~80 行 + 删除）

**目标**：消除误导性架构（coordinator 像"已落地"）、清理确定无用的死文件与历史 worktree。
**前置**：S0-1 完成；`src/store/coordinator` 外部引用=0（已核实：全仓 `Coordinator` 大小写合计 12 处，全部在自身目录）。
**写作用域**：`src/store/coordinator/index.ts`、`audioCoordinator.ts`、`queueCoordinator.ts`、`types.ts`（仅注释/banner）、`.eslintrc.json`、`src/app/page.tsx.v7`（删除）、`src/components/visualization/VisualizationView.tsx.fix`（删除）、`scripts/gc-worktrees.ps1`（新）、`.gitignore`/根目录垃圾（仅确定产物）。

**Step 1｜coordinator 标记**
在 4 个文件顶部加：
```ts
/**
 * @deprecated since 2026-10-21 — 本目录无任何外部 import（全仓核实 12 处引用均在自身目录）。
 * 不要新增引用。替代：src/lib/playback/{queueNavigator,mediaBridge,requestCoordinator}.ts（S1）
 * 与 domain 用例层（S6-9）。删除条件：S6-12 行数棘轮/依赖门禁落地后整体删除。
 */
```
**Step 2｜ESLint 禁入**
`.eslintrc.json`（**待核实**文件名/格式：仓库当前为 eslint 8 风格）加 `no-restricted-imports` 规则：
`"@/store/coordinator", "@/store/coordinator/*"` → message `"coordinator 是死层（0 引用），新代码请用 src/lib/playback/* 或 domain 用例；见 ADR/总计划 S6-9"`。
验证：`npx eslint src --max-warnings=0` exit 0；临时在 `/tmp` 写一个 import 该目录的文件（不提交）验证规则触发。

**Step 3｜删除死文件**
逐个确认后删除：
```powershell
git ls-files src/app/page.tsx.v7 src/components/visualization/VisualizationView.tsx.fix   # 若被跟踪则 git rm；未跟踪则直接删
git log --oneline -3 -- src/app/page.tsx.v7
rg -n "page\.tsx\.v7|VisualizationView\.tsx\.fix" src scripts docs || echo "0 引用"
```
预期：0 引用；两文件是历史副本，不属于保护视图本体（保护对象是 `HomeView.tsx`/`PlayerView.tsx`/`FullscreenLyrics.tsx`）。若任一文件被引用或含用户手改，**不删**，改为 `.gitignore` + 标记。

**Step 4｜worktree GC 脚本**
`scripts/gc-worktrees.ps1`（默认 dry-run，`-Apply` 才删除）：
1. `git worktree list --porcelain` 解析路径与分支；
2. 跳过主工作区、`arch-perf-main`、checkpoint 分支 worktree；
3. 对每个候选执行 `git -C <path> status --porcelain`：**非空跳过**（不删用户未提交工作）；
4. dry-run 打印 `[gc] would remove <path> (clean)`；`-Apply` 时 `git worktree remove --force` + `git worktree prune`；
5. 末尾报告 before/after 数量，目标 ≤5。
**禁止**直接 `Remove-Item -Recurse` 删 worktree 目录。

**Step 5｜根目录垃圾（保守）**
只处理确定产物：`coverage/`、`test-results/`、根目录 `*.log`（>7 天）、`node_modules/pixi.js` extraneous junction（如存在，见审计 D P1-5；**待核实**是否影响构建）。用户文件、.env、credentials 一律不动。

**测试**：无单测；验证 = grep/ESLint/worktree 计数。
**验证命令与预期**
```powershell
git grep -n "@/store/coordinator" -- src; echo "exit=$LASTEXITCODE"   # exit=1（无匹配）
npx eslint src --max-warnings=0                                        # exit 0
git worktree list | Measure-Object -Line                              # ≤5
(Get-ChildItem -File | Measure-Object).Count                          # ≤20
```
**验收**：coordinator 外部 import=0 + ESLint 拦截；死文件 0 引用后删除；worktree ≤5；根文件 ≤20；**无视觉/行为改动**（本任务不改任何渲染代码）。
**回滚**：`git revert` 恢复删除文件与规则；worktree 删除不可逆 → 脚本默认 dry-run 且只删 clean worktree。
**风险**：误删用户未提交内容 → 步骤 4 的 clean 检查；V7 禁令 → 只删副本不删保护视图。

---

### S0-6 测量基座 v1（2 个 PR）

**目标**：用一条命令产出可入库的 baseline JSON，覆盖构建产物、store 统计、文档事实；为 S1/S2/S3 及 S8-3 的 before/after 提供同一口径。
**写作用域**：6a = `scripts/perf/bundle-budget.mjs`、`scripts/perf/bundle-budget.test.mjs`、`scripts/report-store-stats.mjs`、`scripts/report-store-stats.test.mjs`、`scripts/perf/__fixtures__/**`、`perf/budget.json`；6b = `scripts/check-docs-facts.mjs`、`scripts/docs-facts.config.mjs`、`src/lib/perf/playbackMarks.ts`、`src/lib/perf/playbackMarks.test.ts`。**不得修改 package.json**（别名推迟到 S8-1；本阶段用 `node scripts/...` 直接调用）。

**S0-6a｜构建与 store 统计脚本**

接口（导出纯函数供测试；CLI 只做 I/O）：
```js
// scripts/perf/bundle-budget.mjs
export function gzipSize(buf)                          // zlib.gzipSync(...).length
export function sumRootMainFiles(buildManifest, appBuildManifest, nextDir) // -> {count, rawBytes, gzipBytes}
export function firstLoadBytes(htmlPath, nextDir)      // 解析 <script src> 去重求和 -> {files, rawBytes}
export function cssBytes(cssDir)                       // .next/static/css/**/*.css 求和
export function asyncChunkTop(chunksDir, limit = 10)   // [{name, bytes}]
// CLI: node scripts/perf/bundle-budget.mjs --out perf/s0-baseline-2026-10-21.json
// 输出 JSON schema v1：
// { schemaVersion:1, generatedAt, commit, build:{rootMainFiles:{count,rawBytes,gzipBytes},
//   firstLoad:{"/":rawBytes,"/data-manager":rawBytes,"/_not-found":rawBytes},
//   css:{rawBytes,files}, asyncChunks:[...], publicBytes, outExists, outMtime},
//   budget:{thresholds, violations:[{metric,value,threshold}]} }
```
```js
// scripts/report-store-stats.mjs
export function scanStoreModules(storeDir)             // 文件/行数/模块名 -> 60
export function collectPersistKeys(storeDir)           // name:"..." -> 44（含 3 个常量拼接 key → 报告 unknownKeys 待核实清单）
export function countWholeStoreSubscriptions(srcDir)   // useXStore() 无参调用 -> 160；wholeOnlyFiles -> 59
export function countGetState(srcDir)                  // 分层：components/services/other -> 126/29/16
export function buildStoreGraph(storeDir)              // 静态 import 边 -> 21；Tarjan SCC -> 1
export function coordinatorExternalImports(srcDir)     // -> 0
// CLI: node scripts/report-store-stats.mjs --out perf/s0-store-stats.json
```
实现口径必须与审计 A §1.2 一致：whole = `use\w+Store\(\)`（无 selector 参数/无参数），排除 `.test.`、`.worktrees`、`node_modules`、`.next`。

**Step 1｜先写 fixture 测试，再实现**
`scripts/perf/__fixtures__/` 放 3 个最小 fixture：`build-manifest.json`、`app-build-manifest.json`、`index.html`（3 个 script）、`stores/`（2 文件：1 个 whole 订阅、1 个 selector + 1 条 import 边 + 人工构造 1 个环用于 SCC=1 用例）。
`scripts/perf/bundle-budget.test.mjs` 用例：
- `"gzipSize matches zlib for fixture bytes"`
- `"sumRootMainFiles counts unique files once"`：manifest 重复引用同一文件 → count=去重数
- `"firstLoadBytes ignores external and data URLs"`
- `"budget violations flag rootMain gzip > 230KB"`（注入超阈值 fixture）
`scripts/report-store-stats.test.mjs` 用例：
- `"whole-store subscription detected without selector"` / `"selector call not counted as whole"`
- `"persist key scanner finds name literal and reports dynamic keys as unknown"`
- `"store graph detects one SCC for a↔b fixture"`
- `"coordinator external imports ignored when only self references"`

**Step 2｜实机运行并对账审计**
```powershell
node scripts/perf/bundle-budget.mjs --out perf/s0-baseline-2026-10-21.json
node scripts/report-store-stats.mjs --out perf/s0-store-stats.json
node scripts/perf/bundle-budget.mjs --out perf/s0-baseline-2026-10-21.rerun.json
# diff 两个 JSON 的数值字段（generatedAt/commit 除外）
```
**预期数字**（审计 A/D 实测，允许 bytes ±0.5%、counts 精确）：rootMain 23 文件 / 969.3KB raw / 296.8KB gzip；First Load `/` 1,996.7KB、`/data-manager` 1,857.7KB、`/_not-found` 1,524.7KB；CSS 227.4KB；store 模块 60；persist key 44；whole 160；wholeOnly 59；getState 171（126/29/16）；store 边 21；SCC 1；coordinator 外部 0。**任何不符先查口径，不得改数字凑审计**。

**S0-6b｜docs-facts + 播放 mark**

`scripts/docs-facts.config.mjs`：
```js
export const DOC_FACTS = [
  { file: "AGENTS.md", rule: "storeCountMatchesCode" },       // 断言写入 60 且来自脚本口径
  { file: "docs/nbl/ARCHITECTURE.md", rule: "storeCountMatchesCode" },
  { file: "docs/nbl/ROADMAP.md", rule: "forbidPattern", pattern: "28 static pages" },
  { file: "docs/nbl/ROADMAP.md", rule: "forbidPattern", pattern: "19,790" },
  { file: "package.json", rule: "portsConsistent" },          // dev/start/docker/electron dev 全 3025
  { file: "docs/nbl/plans/INDEX.md", rule: "linkedFilesExist" }
];
```
`scripts/check-docs-facts.mjs`：逐条执行；输出 `<file>:<line>: violation ...`；exit 1 若有违规；退出信息含 `docs-facts: 0 violations`。
`src/lib/perf/playbackMarks.ts`（dev-only，运行时零成本）：
```ts
export const PLAYBACK_MARKS = {
  intent: "playback:intent",
  sourceReady: "playback:source-ready",
  playing: "playback:playing",
  firstSound: "playback:first-sound",
} as const;
export type PlaybackMarkName = keyof typeof PLAYBACK_MARKS;
export function markPlayback(name: PlaybackMarkName): void;      // NODE_ENV!=="development" 或 performance 缺失 → no-op
export function measureFirstSound(): number | null;             // 返回 intent→playing 的 duration，缺失返回 null
export function clearPlaybackMarks(): void;                     // 测试清理
```
单测 `src/lib/perf/playbackMarks.test.ts`：`"marks are no-op outside development"`、`"first sound duration is non-negative in development"`（vi.stubEnv + performance mock）。
**接线点（S0-6b 只接线不改变行为；S1-9 强化）**：`useAudioPlayer.ts:1305 managePlayback` 开头 `markPlayback("intent")`；设置 `audio.src` 前 `markPlayback("sourceReady")`；`useAudioPlayer.ts:947 onPlaying` 内 `markPlayback("playing")`。三处均在 dev 分支内无副作用。

**验证命令与预期**
```powershell
node scripts/perf/bundle-budget.mjs --out perf/s0-baseline-2026-10-21.json   # exit 0，JSON 存在
node scripts/report-store-stats.mjs --out perf/s0-store-stats.json           # exit 0
node scripts/check-docs-facts.mjs                                            # S0-4 合入后 exit 0，打印 0 violations
npx vitest run scripts/perf/bundle-budget.test.mjs scripts/report-store-stats.test.mjs src/lib/perf/playbackMarks.test.ts  # 全 passed
```
**验收**：(1) 两脚本各 ≤10s 完成；(2) 数字复现审计（口径见上）；(3) rerun diff=0（数值字段）；(4) docs-facts exit 0；(5) 播放 mark 仅在 dev 生效且无行为变化。
**回滚**：纯新增脚本与 dev-only 模块，删除/回退无数据影响；若不希望仓库出现 `perf/`，改为 CI artifact（需 Lead 决策）。
**风险**：Next 16 manifest 结构与我方假设不同（**待核实** `.next/app-build-manifest.json` 字段）→ 实现前用 `Get-Content .next/build-manifest.json` 实读一次，fixture 以真实结构为准；扫描口径漂移 → 在脚本 README 头部固化口径并与审计 A §1.2 对齐。

---

### S0-7 ADR D1-D8 与决策归档（1 PR，文档）

**目标**：把 8 个决策从"Pending 表格"升级为可执行、可回滚、可引用的 ADR；D1/D2/D7 必须由用户拍板。
**写作用域**：`docs/nbl/adr/README.md`、`docs/nbl/adr/0001-v8-visualization.md`、`0002-desktop-runtime.md`、`0003-dsp-chain.md`、`0004-backup-scope.md`、`0005-quality-tiers.md`、`0006-theme-owner.md`、`0007-protected-view-subscription-rewrite.md`、`0008-third-party-sources.md`、`00-decisions.md`（状态回写）。

**Step 1｜模板** `adr/README.md`：状态（Proposed/Accepted/Superseded）、Context、Decision、Consequences（正/负）、Alternatives、Affected tasks、Rollback、Date、Owner、Links。
**Step 2｜逐条 ADR**：内容以 `00-decisions.md` D1-D8 为底稿，但必须补充：影响任务 ID、验收命令/指标、回滚方式、数据兼容影响（D4 尤其：默认不含音频二进制 → S1-2 v5 备份范围）。
**Step 3｜状态回写**：D1/D2/D7 用户拍板后改 `Accepted` 并记日期；未拍板保持 `Proposed` 且写明"按推荐默认值执行"——**不得伪造 Accepted**。
**Step 4｜交叉链接**：总计划 §8、本执行包 `00-decisions.md`、各阶段计划引用同一 ADR 编号。

**测试/验证**：`node scripts/check-docs-facts.mjs` 可扩展校验 ADR 链接存在（S0-6b 后）；人工评审 8 份。
**验收**：8 个文件存在且各自 ≤1 页；每份含 Decision/Consequences/Rollback/Affected tasks；D1/D2/D7 有用户结论；links 可打开。
**回滚**：纯文档，revert 无影响。
**风险**：决策未拍板导致 S0 出口门不满足 → 在 TRACKING 登记阻塞项，S0 以"D3-D8 默认值可执行 + D1/D2/D7 阻塞 S4/S7/S3"收口，不伪造。

---

## 5. 阶段级验证命令与证据清单

**顺序固定（I7）**：eslint → vitest → tsc → build → clean-port/dev → HTTP smoke → 专项脚本。

| # | 命令 | 预期输出 | 证据 |
|---|---|---|---|
| 1 | `npx eslint src --max-warnings=0` | exit 0；0 problems；冷跑约 142s | 耗时 + exit code |
| 2 | `npm run test -- --run` | exit 0；205 文件 / 1267+ 用例；0 failed；约 106s | 摘要行 |
| 3 | `npx tsc --noEmit --incremental false --pretty false` | exit 0；0 errors；约 23s | 输出 |
| 4 | `npm run build` | exit 0；3 静态页 + 31 API route；`.next` 生成 | 构建摘要 |
| 5 | `npm run clean:port; npm run dev` → `curl http://localhost:3025/`、`/data-manager` | 均 200；dev ready；随后 kill 进程 | HTTP code + 截图 |
| 6 | `npm run build; npm start` → `curl http://localhost:3025/` | 200（验证 S0-3 端口） | HTTP code |
| 7 | `node scripts/assert-static-export.mjs` | exit=3（陈旧 out 被阻断）| exit code + stderr |
| 8 | `node scripts/perf/bundle-budget.mjs --out perf/s0-baseline-2026-10-21.json` | exit 0；JSON；第二次 diff 数值=0 | 两个 JSON + diff |
| 9 | `node scripts/report-store-stats.mjs --out perf/s0-store-stats.json` | exit 0；60/44/160/59/171/21/1/0 对账 | JSON |
| 10 | `node scripts/check-docs-facts.mjs` | exit 0；`docs-facts: 0 violations` | 输出 |
| 11 | `git worktree list; (Get-ChildItem -File).Count` | worktree ≤5；根文件 ≤20 | 计数 |

**证据文件**：`docs/nbl/plans/2026-10-21-arch-perf-execution/evidence/S0-evidence.md`，必含：baseline SHA、脏改清单、11 条命令的 exit code/耗时/关键日志、baseline JSON 路径、CI 运行链接/截图、ADR 状态、未执行项（如未推送/无 admin 权限）。
**禁止**：并行跑 build 与 tsc；dev 存活时 `npm run clean`；把 `--no-verify` 当默认；未记录环境（Node/npm 版本）就跑基线。

---

## 6. 与相邻阶段的接口/交接物

**S0 → S1（必须交付）**
| 交接物 | 路径 | 消费方 |
|---|---|---|
| 干净基线 commit SHA + 复测数据 | evidence/S0-evidence.md | S1 所有 PR 的 diff 基线 |
| CI required checks | `.github/workflows/ci.yml` | S1 每个 PR 门禁 |
| 构建/预算脚本 | `scripts/perf/bundle-budget.mjs`、`perf/budget.json` | S2-6、S4、S8-3 |
| store 统计脚本 | `scripts/report-store-stats.mjs` | S1-1（44 key 对账）、S3（整店订阅阈值）、S6-1 |
| 文档事实校验 | `scripts/check-docs-facts.mjs` | S1-4/S1-6 文档更新后回归 |
| 播放 mark | `src/lib/perf/playbackMarks.ts` | S1-9（firstSound P50/P95） |
| 发布止损 | `scripts/assert-static-export.mjs` | S7-4 替换前保持阻断 |
| 决策 | D4（备份范围）影响 S1-2 v5 schema；D7 影响 S3-2 | S1/S3 启动前确认 |

**S0 ← 前置阶段**：无（首个阶段）。**S0-1 的授权结论**是所有阶段的前置输入。

---

## 7. 未决问题 / 需用户决策

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| Q1 | 55 项手势改动如何处理（A checkpoint / B 冻结 worktree / C 拆 PR 合 master） | 阻塞 S0-1 与全部基线 | 推荐 A（保现场）+ 后续按模块拆 PR；**必须用户授权** |
| Q2 | D1 V8 处置、D2 桌面运行时、D7 受保护视图改写授权 | S0-3 形态、S4-7、S7-4、S3-2 | 推荐 C/B/A（见 00-decisions.md）；S0 期间需 D2 结论解冻发布 |
| Q3 | GitHub branch protection 权限是否可用 | E0-2 required checks | Lead 确认；不可用则 CI 保持 report-only 并登记 |
| Q4 | `build:static` 与 31 个 API route 是否兼容（output:"export"） | S0-3 是否可提供构建路径、S7-4 | 本阶段不承诺；S7-4 spike 实测，**待核实** |
| Q5 | 是否允许新增 devDependency（后续 S1-4 的 IndexedDB mock） | S1-4 测试方案 | S0 不引入；S1-4 前评审 |
| Q6 | `deploy.yml` 中 Vercel 发布 job 是否保留/移除 | 发布链归属 | 保留手动触发，移除 dead main 条件；归属由 Lead 定 |
| Q7 | worktree GC 是否允许删除/迁移用户历史 worktree（27 个 / 5.19GB） | E0-5 | 先 dry-run 出清单交用户确认，只删 clean 且非当前分支的 |
| Q8 | `perf/` baseline JSON 是否入库 | 证据可追溯性 | 推荐入库（小文件）；如仓库策略禁止，改 CI artifact |

**「后续补充」位置**：若时间不足，S0-6a 的 manifest fixture 结构、S0-4 的 ARCHITECTURE 分类表 60 条逐项名单可先以「待核实」占位并在 PR 描述列出待核对项，不得编造。

---

## 8. 实施进展（2026-10-21）

### 已完成 / 部分完成

| 任务 | 产出 | 验证 |
|---|---|---|
| S0-2（本地完成，待 push） | .github/workflows/deploy.yml 重写：master push/PR 触发、concurrency、Node 20、.next/cache+tsbuildinfo 缓存、verify job（tsc → eslint src 0-warning → vitest → build → bundle report → store stats gate → docs-facts）、desktop/vercel 改为手动或 tag 触发 | python yaml.safe_load 通过；jobs = verify / desktop-windows / deploy-to-vercel；尚未 push，required checks 未验证 |
| S0-4（完成） | AGENTS.md、docs/nbl/ARCHITECTURE.md 按实测修正（60 stores / 19 hooks / 18 services / 4 workers；真实音频链；coordinator 死层；构建模式；AI 桩；V7/V8 事实） | node scripts/check-docs-facts.mjs exit 0（ports 仅 WARN） |
| S0-5（部分） | src/store/coordinator 4 文件加 @deprecated 头；.eslintrc.json 增加 no-restricted-imports 禁止 @/store/coordinator | npx eslint src/store/coordinator exit 0；npx tsc --noEmit exit 0 |
| S0-6（v1 完成） | scripts/perf/bundle-budget.mjs、scripts/perf/report-store-stats.mjs、scripts/check-docs-facts.mjs；perf/budget.json、bundle-baseline.json、store-stats-baseline.json、README.md | 实测 rootMain 969.3KB raw / 296.8KB gzip；首页 37 script / 1,996.7KB / 615.7KB gzip；CSS 227.4KB；public 58.4MB；store 60 / persist 44 / whole 161 / whole-only 59 / edges 25 / SCC 1 / getState 358 |

### 验证命令与结果

    npx tsc --noEmit --incremental false --pretty false          # exit 0
    npx eslint src/store/coordinator --max-warnings=99999        # exit 0
    node scripts/check-docs-facts.mjs                            # exit 0, ports WARN
    node scripts/perf/bundle-budget.mjs                           # 报表：4 项超 hardMax（S4 前只报告）
    node scripts/perf/report-store-stats.mjs --check              # OK（不比基线差）
    python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"  # ok

### 仍未完成 / 阻塞

- **S0-1**：55 项未提交手势改动未处理（需 Q01 授权：checkpoint / 拆 PR / 冻结 worktree）。
- **S0-3**：package.json（npm start 3024）被脏改占用；out/ 仍是 2026-07-30 陈旧产物，需 S0-1 后统一端口并加 fail-fast/build:static。
- **S0-5 剩余**：跟踪死文件（VisualizationView.tsx.fix、page.tsx.v7）删除、worktree GC（27 个/5.19GB）需用户授权。
- **S0-7**：D1-D8 拍板后写 docs/nbl/adr/*；目前决策记录在 00-decisions.md 中为 Pending。

### 2026-10-21 追加（S0-3 / S0-7 / S1-1）

**S0-3（部分完成，结论：静态导出被 API routes 阻断）**

- 新增 scripts/verify-static-export.mjs：检查 out/index.html 存在且新于 src/next.config/package.json；对当前 out（2026-07-30）实测 exit 1，符合 fail-fast 预期。
- 新增 scripts/build-static.mjs：STATIC_EXPORT=1 构建 + 自动 verify。
- **实测阻塞**：STATIC_EXPORT=1 next build 失败，Next 16 报 /api/audio/proxy、/api/kugou/login/status 等 31 个 route 缺少 force-static/revalidate（output: export 与 API routes 不兼容）。→ 静态导出方案不可作为桌面发布路径，D2-B（本地 Next 运行时）获得直接证据。
- 新增 scripts/verify-desktop-release-ready.mjs：默认 exit 1 并说明原因（桌面发布冻结）；build-desktop-win.ps1 与 CI desktop job 已接入该门禁，避免发陈旧前端。
- 未改 package.json（脏改占用），build:static 脚本接入待 S0-1 后补。

**S0-7（部分完成）**

- 新建 docs/nbl/adr/：README + 0001 V8 处置、0002 桌面运行时、0003 音频图所有权、0004 持久化注册表、0005 受保护视图；状态均 Proposed，等待用户批准。

**S1-1 提前落地（依赖 S0-6，不依赖脏改）**

- 新增 src/lib/storage/storageRegistry.ts：44 个 persist key（owner/version/group/backup/quotaPolicy）+ EXTERNAL_KEYS + 完整性校验。
- 新增 src/lib/storage/storageRegistry.test.ts：5 个用例（44 key 一致、owner 文件存在、8 个 backup key、完整性/查找、external key 隔离）全部通过。
- 验证：npx vitest run src/lib/storage/storageRegistry.test.ts → 5 passed。

### 本次未执行

- 未 push / 未创建 PR / 未运行 GitHub Actions（无远程操作授权）。
- 未执行 npm run build / 全量 vitest（当前 .next 基线沿用 2026-10-21 01:22 产物；TS/ESLint 已通过）。
- 未修改 package.json（脏改）、ROADMAP.md / CHANGELOG.md（脏改）。