# CI 门禁（Required Checks）

> 面向 PR 作者与 reviewer。PR/主干工作流：`.github/workflows/deploy.yml`；发布工作流见 §8。
> 触发：`push` / `pull_request` → `master`，以及手动 `workflow_dispatch`。
> 最后核对：2026-10-30（S8-3d 追加 nightly history commit-back；S8-1b 并行拆分；S8-3a 追加 nightly；S8-5 追加 release preflight/draft release）。

## 1. Job 布局（并行，12min 预算）

S8-1a 的单串行 `verify` job（冷缓存 14-17min）在 S8-1b 拆成 3 个并行 job + 1 个聚合
job。三个 job 各自 checkout / setup-node / `npm ci`，**不跨 job 传产物**；只有 `build`
需要 `.next`（`perf:gates` 的 bundle markers 依赖构建产物），所以生产构建与依赖它的门禁
放在同一个 job 内，无需 artifact 依赖。

| Job            | 必过步骤                                         | timeout | 预期耗时（暖 / 冷） |
| -------------- | ------------------------------------------------ | ------: | ------------------: |
| `quality`      | 类型检查 → Lint（0 警告）→ 分层依赖 → 单元测试   |      15 |       6-8 / 9-11min |
| `coverage`     | 覆盖率分域（`test:coverage:domains`，见 §4）     |      15 |        4-5 / 5-7min |
| `build`        | 生产构建 → `perf:gates` → bundle 报告 → 文档事实 |      15 |        3-5 / 5-7min |
| `quality-gate` | 聚合断言：上面三个 job 全部 success              |       5 |             ~15-30s |

wall time = 三个并行 job 的最大值 + 排队/调度开销：暖缓存 ≈ 7-9min，冷缓存 ≈ 10-12min，
目标是 **≤12min**。各 job 的 `timeout-minutes: 15`（聚合 job 为 5）只用于兜住挂死，
不是目标时长。拆分代价是 runner 分钟数上升（3 次 `npm ci`），换来串行链路被削掉约 5min。

耗时依据：本机实测 tsc ≈ 23s、lint ≈ 142s、单测 ≈ 106s、coverage ≈ 80s、build ≈ 115s，
CI 4 vCPU runner 按 1.8-2.5 慢系数估算（S8 计划 Step 2 表）。

## 2. Required checks（分支保护）

branch protection 只勾一个 check：**`Quality gate (required)`**（job id `quality-gate`）。
它 `needs: [quality, coverage, build]` 且 `if: always()`，逐个断言上游 `result == success`：
任一子 job 失败/取消/跳过，`quality-gate` 即失败，PR 立刻变红。因此三个子 job 事实上全部
required，不能用"跳过某个 job"的方式过 CI。三个子 job 的 check 名分别是
`Quality (types/lint/unit)`、`Coverage (domains)`、`Build (production/perf/docs)`，
也会出现在 PR checks 列表里；分支保护只需勾聚合 check。

每个门禁步骤只在一个 job 里运行，对应关系如下：

| 门禁                      | 所属 job   | 预期耗时 |
| ------------------------- | ---------- | -------: |
| 类型检查（tsc）           | `quality`  |   60-90s |
| Lint（0 警告）            | `quality`  |   2-4min |
| 分层依赖（verify:layers） | `quality`  |      ~5s |
| 单元测试（test）          | `quality`  |   2-3min |
| 覆盖率分域                | `coverage` |    ~3min |
| 生产构建（build）         | `build`    |   2-3min |
| 性能门禁（perf:gates）    | `build`    |     ~15s |
| Bundle 报告               | `build`    |      ~5s |
| 文档事实（docs facts）    | `build`    |      ~5s |

逐条命令（与工作流一致）：

```bash
npx tsc --noEmit --incremental false --pretty false
npx eslint src --ext ts,tsx --rulesdir eslint-rules --max-warnings=0 --report-unused-disable-directives
npm run verify:layers
npm run test -- --run
npm run test:coverage:domains
npm run build
npm run perf:gates
node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json
node scripts/check-docs-facts.mjs   # 本地别名：npm run verify:docs
```

## 3. 已知禁用：`report-store-stats.mjs --check`

`perf/store-stats-baseline.json` 已过期（记录 60 stores / 44 persist keys，实测 59 / 43），
`--check` 的"不得比基线更差"会稳定误报，因此**当前不接**。替代兜底是 `perf:gates` 里的
`report-store-stats.mjs --max-whole 10`。重新生成基线并经评审后再打开 `--check`；
`scripts/perf/ci-perf-gates.test.mjs` 断言它保持禁用，工作流里也有对应注释。

## 4. 覆盖率分域门禁（coverage domains）

- 配置：`perf/coverage-domains.json`，五个域：`src/lib/audio`、`src/utils`、`src/store`、
  `src/services`、`src/hooks`；地板 = 实测值 - 5pp burn-in，且只升不降。
- 命令：`vitest run --coverage`（五域 include）+ `node scripts/check-coverage-domains.mjs`。
- 失败处理：优先补测试；确有正当理由时才 `node scripts/check-coverage-domains.mjs --update`
  （会写回 `perf/coverage-domains.json`，必须在 PR 说明里给出依据）。
- 只看数不拦截：`node scripts/check-coverage-domains.mjs --report-only`。

## 5. 修改门禁

增删门禁步骤时，同步更新 `.github/workflows/deploy.yml` 的 job 布局、本文件与
`scripts/ci-required-checks.test.mjs`（断言 ≥3 个并行 job、每个必过步骤只出现在一个
job、coverage 独立于 quality、perf:gates 归 build、预算与 required checks 有记录）。

## 6. Nightly 包体回归（非 required）

`.github/workflows/nightly.yml` 每日 18:00 UTC（北京 02:00）与手动 `workflow_dispatch` 触发，
跑生产构建 → `bundle-budget` 报告 → 全量测试 → `perf:bundle:diff` → 追加
`perf/perf-history.jsonl` → 生成 `perf/perf-dashboard.md` → **history commit-back**；基线为
`perf/bundle-baseline.json`，回归（rootMain gzip > +5KB / 首页 gzip > +10KB）时 job 失败。
报告、历史与看板作为 `perf-bundle-<run_id>` artifact 上传并写入 job summary；阈值、`--update`
重设基线、历史 schema 与看板字段见 `perf/README.md` §8–§9。该工作流不参与分支保护，
PR 必过检查仍是 `Quality gate (required)`。

### 6.1 History commit-back（S8-3d，2026-10-30）

nightly 每个 run 都在干净 checkout 上执行，历史若只进 artifact 就永远只有 1 行，无法判断
「连续 4 周无回归」。因此把当次追加的 `perf/perf-history.jsonl` 直接提交回默认分支。

- **权限最小化**：workflow 级仍是 `permissions: contents: read`；只有 `bundle-nightly` job 加
  job 级 `permissions: contents: write`（其他 job/工作流不受影响）。
- **checkout**：`actions/checkout@v4` + `ref: ${{ github.event.repository.default_branch }}` +
  `persist-credentials: true` + `fetch-depth: 1`。这样即使从功能分支手动 `workflow_dispatch`，
  历史也写回默认分支而不是该分支。
- **身份**：`github-actions[bot]` / `41898282+github-actions[bot]@users.noreply.github.com`。
- **步骤**（紧接 Perf dashboard，`if: always()`，保证回归 run 也留证据）：

  ```bash
  git add perf/perf-history.jsonl perf/reports && git diff --cached --quiet || \
    (git commit -m 'chore(perf): nightly history [skip ci]' && \
     git push origin "HEAD:${{ github.event.repository.default_branch }}")
  ```

- **语义**：每次 run 追加 1 行，`ts` 严格递增（`append-history.mjs --check` 校验）；没有变化
  （例如 bundle report 缺失、append 提前返回）时`git diff --cached --quiet` 为真，不产生空提交。
  nightly 目前只写 `perf/perf-history.jsonl`；`perf/reports` 一并 add 是为将来 nightly 报告
  留槽，当前无新增时该路径不产生 diff。
- **不会自我触发**：`GITHUB_TOKEN` 发起的 push 不触发 workflow；`[skip ci]` 是给其他 token /
  fork / 分支保护场景的兜底标记。
- **失败模式**：默认分支若启用「Require a pull request before merging」且不允许 bot bypass，
  `git push` 会被拒 → 该 run 红、历史不增长（不会伪造数据）。处理：给 `github-actions[bot]`
  开 bypass，或改 PAT/汇总 job。push 竞态（运行期间有人推 master）会导致 non-fast-forward，
  同样红；重跑即可。
- **当前历史**：`perf/perf-history.jsonl` 已入库，2026-10-30 seed **1 行**
  （`5b40fc2`，rootMain 208.4KB / first load 621.5KB / CSS 29.2KB / async 675.9KB / public 89.2MB）。
  4 周窗口自 2026-10-30 起算，达到 ≥28 行（约 2026-11-27）前，M8 的「nightly 连续 4 周无回归」
  保持未达，期间按「累积中」记录。

## 7. 分层依赖门禁（S6-12a）

- `quality` job 在 Lint 之后运行 `npm run verify:layers`（`depcruise src --config config/dependency-cruiser.cjs --output-type err`）；error 即 job 失败，预算 ~5s。单测 `scripts/verify-layers.test.mjs` 用同一命令断言 exit 0，CI 双保险。
- error 规则：`no-circular`；`src/store` 禁 import `components|hooks`；`src/services` 禁 import `components`；`src/lib` 禁 import `components|hooks`；`src/domain` 禁 import react/next、`components|hooks`、`store`；`src` 生产代码禁 import devDependency。
- warn 规则：`no-orphans`（排除 Next 路由/worker 入口、测试与 `.d.ts`），只暴露孤立模块，不阻塞 CI。
- 唯一方向豁免：`src/domain/playback/ports.ts` 作为播放端口适配器可 import store；测试文件与 `import type` 不计入。规则、首跑 8 errors 清零过程与收缩棘轮见 `perf/README.md` §10。

## 8. 发布预检与 draft Release（S8-5，手动）

- 工作流 `.github/workflows/release.yml` **仅** `workflow_dispatch`，不监听 tag push，不自动发布。
- 输入：`version`（无 `v`，必须等于 package.json）、`tag`（`vX.Y.Z`，必须等于 `v`+version）、`package_desktop`（默认 false）。
- Job 布局：
  - `preflight`：`npm ci` → `npm run build` → `node scripts/release/preflight.mjs --tag <tag>`；日志作为 `release-preflight` artifact 保留 30 天。
  - `package-web`：重新构建并打包 `web-next-<tag>.tar.gz`（排除 `.next/cache`）+ `SHA256SUMS.txt`，artifact `release-web` 保留 90 天。
  - `package-desktop`：仅 `package_desktop=true` 时运行（windows-latest，PyInstaller + electron-builder）；S7-4/D2 解锁前 guard 会失败，默认跳过。
  - `draft-release`：下载 artifacts，用 `softprops/action-gh-release@v2` 创建 **draft** Release（`draft: true`、`make_latest: false`）；需要 `contents: write`，配置了 `production` environment 时走人工审批。**不会自动 publish**。
- 本地同口径命令：

```bash
npm run release:preflight -- --tag v0.2.1              # 严格：干净树 + 构建产物
npm run release:preflight -- --allow-dirty --skip-build # 本地无构建/脏树
npm run release:dry-run                                 # 兼容别名，自动加上述安全参数
npm run release:preflight -- --json                     # 机器可读
```

- 退出码：0 = 无 FAIL；1 = 有 FAIL；2 = 参数错误。8 个检查行（version/changelog/git-clean/build-id/build-output/perf-baselines/env-files/docs-facts）与 [RELEASE-CHECKLIST.md §8](./RELEASE-CHECKLIST.md) 一一对应。
- R9（数据兼容 fixture）与 R10（V7 保护视图）仍是缺口；桌面 R7/R8 待 S7-4/D2。该工作流不参与 PR 分支保护，PR 必过检查仍是 `Quality gate (required)`。
