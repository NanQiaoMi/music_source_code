# CI 门禁（Required Checks）

> 面向 PR 作者与 reviewer。工作流：`.github/workflows/deploy.yml`（job `verify`）。
> 触发：`push` / `pull_request` → `master`，以及手动 `workflow_dispatch`。
> 最后核对：2026-10-29（S8-1a）。

## 1. 必过门禁（verify job，串行执行）

下表就是 required checks 的完整清单；任何一步非 0 退出，整条 PR 立刻变红。

| #   | 门禁                   | CI 预期耗时 | 说明                                                |
| --- | ---------------------- | ----------: | --------------------------------------------------- |
| 1   | 类型检查（tsc）        |      60-90s | strict 模式，类型错误直接失败                       |
| 2   | Lint（eslint，0 警告） |      2-4min | `--max-warnings=0`；prettier 规则在内               |
| 3   | 单元测试（test）       |      2-3min | Vitest + jsdom 全量                                 |
| 4   | 覆盖率分域（coverage） |       ~3min | 见 §3；跑在 Unit tests 之后                         |
| 5   | 生产构建（build）      |      2-3min | 产出 `.next`，第 6/7 步依赖它                       |
| 6   | 性能门禁（perf:gates） |        ~15s | store 行数/环依赖、whole-store 预算、bundle markers |
| 7   | Bundle 报告            |         ~5s | 仅报告；S4 重定基线后才改 `--check`                 |
| 8   | 文档事实（docs facts） |         ~5s | store 数、旧结论、触发分支、索引链接、执行包完整性  |

逐条命令（与工作流一致）：

```bash
npx tsc --noEmit --incremental false --pretty false
npx eslint src --ext ts,tsx --rulesdir eslint-rules --max-warnings=0 --report-unused-disable-directives
npm run test -- --run
npm run test:coverage:domains
npm run build
npm run perf:gates
node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json
node scripts/check-docs-facts.mjs   # 本地别名：npm run verify:docs
```

耗时合计：热缓存 ≈ 12min，冷缓存（无 npm/.next 缓存）≈ 14-17min；job 的
`timeout-minutes: 25` 只用于兜住挂死，不是目标时长。要真正压到 12min 以内，需要把
lint/build 拆成并行 job（S8-1b/S8-1c 的范围），当前单 job 串行做不到。

## 2. 已知禁用：`report-store-stats.mjs --check`

`perf/store-stats-baseline.json` 已过期（记录 60 stores / 44 persist keys，实测 59 / 43），
`--check` 的"不得比基线更差"会稳定误报，因此**当前不接**。替代兜底是 `perf:gates` 里的
`report-store-stats.mjs --max-whole 10`。重新生成基线并经评审后再打开 `--check`；
`scripts/perf/ci-perf-gates.test.mjs` 断言它保持禁用，工作流里也有对应注释。

## 3. 覆盖率分域门禁（coverage domains）

- 配置：`perf/coverage-domains.json`，五个域：`src/lib/audio`、`src/utils`、`src/store`、
  `src/services`、`src/hooks`；地板 = 实测值 - 5pp burn-in，且只升不降。
- 命令：`vitest run --coverage`（五域 include）+ `node scripts/check-coverage-domains.mjs`。
- 失败处理：优先补测试；确有正当理由时才 `node scripts/check-coverage-domains.mjs --update`
  （会写回 `perf/coverage-domains.json`，必须在 PR 说明里给出依据）。
- 只看数不拦截：`node scripts/check-coverage-domains.mjs --report-only`。

## 4. 修改门禁

增删 `verify` 步骤时，同步更新本文件与 `scripts/ci-required-checks.test.mjs`
（断言覆盖率步骤在 Unit tests 之后、必过清单与本文件存在）。
