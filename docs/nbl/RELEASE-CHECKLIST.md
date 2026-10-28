# 发布检查清单（Release Checklist）

> 适用：每个版本发布（Web + Windows 桌面）。发版前按 §1 → §7 顺序执行，全部勾选后才打 tag。
> 关联：[CI.md](./CI.md)（required checks 与命令口径）、[PROCESS.md](./PROCESS.md) §7.2/§7.3（发版步骤）、
> [existing-feature-release-checklist.md](./checklists/existing-feature-release-checklist.md)（产品功能手工项）、
> [S8-5 计划](./plans/2026-10-21-arch-perf-execution/S8-quality-governance.md)。
> 最后核对：2026-10-29（S8-5；当前版本 0.2.1，最近 tag v0.2.5）。

## 0. 快速演练（本地，约 3-5 分钟）

```bash
npm ci
npm run release:dry-run                 # 安全子集：tsc + docs-facts + perf:gates
npm run release:dry-run -- --build      # 追加生产构建（写 .next，较慢）
node scripts/release-dry-run.mjs --json  # 机器可读结果（直接调用，避开 npm banner）
```

脚本逐项打印 PASS/FAIL/SKIP 表，任一执行项失败即 exit 1；`--skip-build` 会强制跳过构建并在表中标注原因。
它**不替代** §2 的完整验证，也不执行 lint/test/coverage/bundle diff。

## 1. 版本与变更记录

- [ ] `package.json` 的 `version` 是合法 SemVer，且与待发布 tag 去掉 `v` 后一致。
- [ ] `docs/nbl/CHANGELOG.md` 顶部已新增本次发布的日期段（现有格式为 `## YYYY-MM-DD`，无版本标题；若改用版本标题，写 `## vX.Y.Z - YYYY-MM-DD`），日期不晚于今天。
- [ ] 桌面版若单独交付，`docs/releases/vX.Y.Z-*.md` 已写明范围、环境要求、已知限制与回滚方式。
- [ ] 变更说明覆盖 Added/Fixed/Changed/Verified，且 `Verified` 记录实际跑过的命令与结果（不要写计划值）。
- [ ] 无未提交改动、无 `.env`/`credentials.json`/日志等本地文件进入暂存区。

```powershell
node -p "require('./package.json').version"
git status --short
git tag --sort=-v:refname | Select-Object -First 3
```

## 2. 自动化验证（与 CI 对齐）

命令口径与 [CI.md](./CI.md) §2 一致；CI 的 required 聚合 check 是 `Quality gate (required)`，发版前确认 master 最近一次 run 为绿。

| 门禁       | 命令                                                                                                      | 通过标准                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 类型检查   | `npx tsc --noEmit --incremental false --pretty false`                                                     | exit 0                                                                               |
| Lint       | `npx eslint src --ext ts,tsx --rulesdir eslint-rules --max-warnings=0 --report-unused-disable-directives` | 0 error / 0 warning（注意 `npm run lint` 当前允许 100 warning，不作发布口径）        |
| 单元测试   | `npm run test -- --run`                                                                                   | 0 failed                                                                             |
| 覆盖率分域 | `npm run test:coverage:domains`                                                                           | 五域不低于 `perf/coverage-domains.json` 地板                                         |
| 生产构建   | `npm run build`                                                                                           | exit 0，页面数正常                                                                   |
| 性能门禁   | `npm run perf:gates`                                                                                      | store 预算 + `--max-whole 10` + bundle markers（无 `.next` 时 marker 步骤自动 skip） |
| 文档事实   | `node scripts/check-docs-facts.mjs`（别名 `npm run verify:docs`）                                         | `fail=0`                                                                             |
| 包体回归   | `node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json` 后 `npm run perf:bundle:diff`        | 无 gzip 回归（rootMain > +5KB / first-load > +10KB 即失败）                          |
| 一键预检   | `npm run release:dry-run`                                                                                 | tsc + docs-facts + perf:gates 全 PASS                                                |

```bash
npx tsc --noEmit --incremental false --pretty false
npx eslint src --ext ts,tsx --rulesdir eslint-rules --max-warnings=0 --report-unused-disable-directives
npm run test -- --run
npm run test:coverage:domains
npm run build
npm run perf:gates
node scripts/check-docs-facts.mjs
node scripts/perf/bundle-budget.mjs --json perf/bundle-report.json
npm run perf:bundle:diff
```

- [ ] 上表全部通过；失败项修复后**重跑整条链**，不跳过。
- [ ] 若 `perf:bundle:diff` 失败，先定位增量来源；确需放宽时在 release notes 记录 waiver 依据，不直接改 baseline。
- [ ] 覆盖率地板需要调整时，只允许 `node scripts/check-coverage-domains.mjs --update`（实测 -5pp、只升不降），并在 PR/release notes 说明原因。

## 3. 桌面就绪门禁

当前桌面打包被 **S0-3 guard 冻结**：静态导出与 31 个 API routes 不兼容，需等 S7-4 本地 Next 运行时。发版前先跑 guard，不要设置 `MIMI_DESKTOP_RUNTIME=next-local` 绕过未完成的运行时。

```powershell
node scripts/verify-desktop-release-ready.mjs
# 现状（2026-10-29）预期：exit 1，打印 [desktop-release-guard] BLOCKED
```

- [ ] 若 guard 为 BLOCKED：本次只发 Web，或明确延期桌面产物；在 release notes 写明"桌面未发布/原因"，**不得**强行打包陈旧 `out/`。
- [ ] 若 S7-4 已解锁：`npm run build:backend:win` 成功，`backend/dist/backend.exe` 存在且大于 30MB。
- [ ] 桌面产物结构齐全（S7-4/S8-5b 接线后由 release workflow 自动断言）：
  - `dist-electron/*.exe` 至少 2 个（portable + NSIS）
  - `dist-electron/SHA256SUMS.txt`
  - `dist-electron/win-unpacked/resources/app.asar` 与 `backend.exe`
- [ ] `out/` 的新鲜度与结构（仅当打包链路仍消费静态导出时）：`node scripts/verify-static-export.mjs --max-age-minutes 120`，要求 `out/index.html` 与 `out/data-manager.html` 存在且不早于源码。
- [ ] 数据兼容：无破坏性 localStorage/IndexedDB 结构变更；升级前备份，安装后确认队列、歌词、设置可读（R9 fixture 尚未落地，见 §8）。

```powershell
(Get-ChildItem dist-electron -Filter *.exe).Count
Test-Path dist-electron/SHA256SUMS.txt
Test-Path dist-electron/win-unpacked/resources/app.asar
Test-Path dist-electron/win-unpacked/resources/backend.exe
(Get-Item backend/dist/backend.exe).Length -gt 30MB
```

## 4. 冒烟（Web + Electron）

```powershell
npm run build
npm run start   # 另一个终端；端口 3025
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3025/
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3025/data-manager
```

- [ ] `/` 返回 200，首屏可见，控制台 0 个未捕获异常。
- [ ] `/data-manager` 返回 200，矩阵/备份等入口可打开。
- [ ] 播放/暂停、队列增删、歌词面板各走一遍（细项见 [existing-feature-release-checklist.md](./checklists/existing-feature-release-checklist.md)）。
- [ ] 刷新后队列、设置、导入记录仍在；无 localStorage 读取报错。
- [ ] 桌面包（若本次发布）：冷启动可见窗口、内置后端 `/api/health` 就绪、离线启动不崩、卸载不删除用户数据。
- [ ] V7 保护视图人工比对：`git diff --name-only <lastTag>..HEAD` 中不得含 Home View / Player View / 全屏歌词相关文件（范围见 [PROCESS.md](./PROCESS.md) 禁止操作）；确需修改时获得显式批准并记录在 release notes（R10 尚未脚本化）。

## 5. 打包、校验与发布

- [ ] 发布分支已合入 master，`git status` 干净，HEAD 与远端一致。
- [ ] 在 master 上打 annotated tag 并推送：`git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`。
- [ ] 产物校验和已生成并复核（`Get-FileHash dist-electron/* -Algorithm SHA256` 与 `SHA256SUMS.txt` 对齐）。
- [ ] GitHub Release 为 draft，附件含 exe/asar/backend.exe/checksums；release notes 含本清单 §6 的回滚命令。
- [ ] 发布按钮由人工审批（production environment），失败不自动删 tag、不自动重发。

> S8-5b 的 tag 触发 `release.yml` 尚未创建（见 §8）；在它落地前，本步骤为手工执行并保留命令记录。

## 6. 回滚预案

发布前先确认上一个可用 tag，并把回滚命令写进 release notes。

```powershell
git describe --tags --abbrev=0 HEAD
git tag --sort=-v:refname | Select-Object -First 3
```

- [ ] 确认上一个绿色版本 tag 存在（当前为 `v0.2.5`），且其产物仍可下载。
- [ ] Web 回滚：重新部署上一个 tag/commit 的构建产物，不回滚用户本地数据。
- [ ] 桌面回滚：下架本次产物，按上一 tag 重新执行构建与校验和发布（`git checkout <lastTag>` 后重新打包）。
- [ ] 代码回滚：`git revert <release-merge-sha>` 走正常 PR；不要用 force-push 覆盖 master。
- [ ] 只有在 Release 尚未发布、确认无人下载时才删 tag：
      `git tag -d vX.Y.Z; git push origin :refs/tags/vX.Y.Z`（破坏性操作，需双人确认）。
- [ ] 数据无迁移时明确写"无需回滚数据"；有 schema 变更时必须先备份并验证旧版本可读。

## 7. 发布后监控（24-72 小时）

- [ ] GitHub Actions：master 的 deploy/quality run 绿；[nightly.yml](../../.github/workflows/nightly.yml) 次日 bundle 回归绿。
- [ ] Release 附件可下载、校验和匹配；安装/便携版各启动一次。
- [ ] 收集安装失败、SmartScreen、后端启动失败、播放无声音等反馈，登记 issue 并标注版本。
- [ ] 盯 48h 内新增 crash/console error 与数据损坏报告；出现回归立即执行 §6，并补一条 CHANGELOG/事故记录。
- [ ] 发布后回填 `docs/nbl/CHANGELOG.md`、`ROADMAP.md`/TRACKING 状态与本次实际验证证据。

## 8. 门禁覆盖与已知缺口（2026-10-29）

`release:dry-run` 只覆盖 S8-5 计划的 R4（部分）与 R11；其余仍为人工或未实现：

| 编号  | 检查                      | 当前状态                                                                           |
| ----- | ------------------------- | ---------------------------------------------------------------------------------- |
| R1/R2 | 版本语义 / CHANGELOG 段   | 人工（§1）                                                                         |
| R3    | master / 工作树干净       | 人工（§5）                                                                         |
| R4    | verify 全链路             | dry-run 覆盖 tsc/docs/perf，lint/test/coverage/build 需手动跑 §2                   |
| R5/R6 | out 新鲜度 / 静态产物结构 | `verify-static-export` 可用，但桌面链路冻结（§3）                                  |
| R7/R8 | 桌面产物 / backend.exe    | 人工；`release.yml` 未创建                                                         |
| R9    | 数据兼容 fixture          | **缺口**：`src/test/persistence` 不存在，暂以手工冒烟替代                          |
| R10   | V7 保护视图               | **缺口**：无 `protected-paths.json`，暂以人工 diff 替代                            |
| R11   | 文档事实                  | dry-run 自动执行                                                                   |
| R12   | 包体预算                  | 需先 build，再手动跑 `perf:bundle:diff`（dry-run 不含）                            |
| R13   | 依赖健康                  | 人工：`npm ls --depth=0`、`npm audit --omit=dev --audit-level=high`（report-only） |
| R14   | 回滚点                    | 人工确认上一 tag（§6）                                                             |
| —     | tag 触发 release workflow | **缺口**：S8-5b 的 `.github/workflows/release.yml` 未创建                          |

这些缺口不阻塞 Web 发布，但桌面正式发布前必须补齐 R7/R8/R9/R10 与 release workflow；补齐后同步更新本表与 [CI.md](./CI.md)。
