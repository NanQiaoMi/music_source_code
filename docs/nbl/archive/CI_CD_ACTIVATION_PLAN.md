# CI/CD 管道激活与质量门禁实施计划

> **版本**: v1.0
> **创建日期**: 2026-05-10
> **关联**: `docs/DEVELOPMENT_STANDARDS.md`
> **当前状态**: CI 测试步骤被禁用，需要激活并完善

---

## 1. 现状分析

### 1.1 当前 CI 状态

```yaml
# .github/workflows/deploy.yml — 当前状态
jobs:
  build-and-test:
    steps:
      - npm ci
      - npm run lint
      # - name: Run Tests (Vitest)      ← 被注释
      #   run: npm run test:coverage     ← 被注释
  deploy-to-vercel:
    needs: build-and-test
    # 需要 VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID 三个 secrets
```

### 1.2 问题清单

| 问题                  | 严重程度 | 说明                  |
| --------------------- | -------- | --------------------- |
| 测试步骤被禁用        | 🔴 阻塞  | CI 没有质量门禁       |
| 无覆盖率门禁          | 🟡 高    | 无法阻止覆盖率下降    |
| Vercel secrets 未配置 | 🟡 高    | 部署步骤实际不可用    |
| 无 Lint 自动修复检测  | 🟢 低    | Lint 只检查不修复     |
| 分支保护规则未设置    | 🟡 高    | 可直接 push 到 master |
| 无 PR 自动检查        | 🟡 高    | PR 没有自动验证       |
| 无测试缓存优化        | 🟢 中    | 每次全量跑测试较慢    |

---

## 2. 实施步骤

### 步骤 1: 激活 Vitest 测试（已配置，需取消注释）

**修改文件**: `.github/workflows/deploy.yml`

```yaml
# 取消注释测试步骤
- name: Run Tests (Vitest)
  run: npm run test:coverage
```

**预期结果**: 每次 push/PR 自动运行全部 Vitest 测试，测试失败则阻断合并。

### 步骤 2: 确认现有测试能通过

**当前测试文件**:

| 测试文件                             | 测试数     | 状态      |
| ------------------------------------ | ---------- | --------- |
| `src/utils/formatTime.test.ts`       | 3          | ✅        |
| `src/utils/songValidation.test.ts`   | 7 describe | ⚠️ 需验证 |
| `src/lib/audio/DSPProcessor.test.ts` | 8          | ⚠️ 需验证 |

**操作**: 在激活 CI 前，手动运行 `npm run test` 确保全部通过。

```bash
npm run test
# 如果失败 → 先修复测试
# 如果通过 → 激活 CI 步骤
```

### 步骤 3: 新增覆盖率门禁

**修改文件**: `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/audio/**", "src/utils/**"],
      // 新增：覆盖率门禁
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
```

**预期效果**: 覆盖率低于阈值时，`npm run test:coverage` 返回非零退出码，CI 失败。

### 步骤 4: 扩展 CI 工作流

**完整目标配置**:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [master, "feature/**", "fix/**"]
  pull_request:
    branches: [master]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: TypeScript Check
        run: npx tsc --noEmit

      - name: Run Lint
        run: npm run lint

      - name: Run Tests with Coverage
        run: npm run test:coverage

      - name: Check Coverage Threshold
        run: |
          # 如果测试失败或覆盖率低于阈值，此步骤会失败
          echo "✅ Quality gate passed"

  deploy-to-vercel:
    needs: quality-gate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/master'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"
```

### 步骤 5: 配置 GitHub 分支保护规则

在 GitHub 仓库 Settings > Branches > Add rule 中配置:

| 设置项                       | 值             |
| ---------------------------- | -------------- |
| Branch name pattern          | `master`       |
| Require pull request reviews | ✅             |
| Required approvals           | 1              |
| Dismiss stale reviews        | ✅             |
| Require status checks        | ✅             |
| 选择 status check            | `quality-gate` |
| Require branches up to date  | ✅             |
| Include administrators       | ✅             |

### 步骤 6: 配置 GitHub Secrets

在 GitHub 仓库 Settings > Secrets and variables > Actions 中配置:

| Secret 名称         | 说明             | 来源                                |
| ------------------- | ---------------- | ----------------------------------- |
| `VERCEL_TOKEN`      | Vercel API Token | Vercel Account > Settings > Tokens  |
| `VERCEL_ORG_ID`     | Vercel 团队 ID   | Vercel Project > Settings > General |
| `VERCEL_PROJECT_ID` | Vercel 项目 ID   | Vercel Project > Settings > General |

### 步骤 7: 优化 CI 速度

```yaml
# 缓存 node_modules
- name: Cache node_modules
  uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

# 缓存 .next 构建缓存
- name: Cache Next.js build
  uses: actions/cache@v3
  with:
    path: .next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json') }}

# 缓存 Vitest 缓存
- name: Cache Vitest
  uses: actions/cache@v3
  with:
    path: node_modules/.cache/vitest
    key: ${{ runner.os }}-vitest-${{ hashFiles('src/**/*.ts') }}
```

---

## 3. 分阶段执行计划

### 阶段一: 基础激活（优先级 🔴 高）

| 任务                                  | 预计耗时 | 依赖     |
| ------------------------------------- | -------- | -------- |
| 1.1 运行 `npm run test` 确认测试通过  | 10min    | 无       |
| 1.2 取消 CI 中测试步骤注释            | 5min     | 1.1      |
| 1.3 添加覆盖率门禁到 vitest.config.ts | 5min     | 1.1      |
| 1.4 推送并验证 CI 通过                | 10min    | 1.2, 1.3 |

### 阶段二: 进阶完善（优先级 🟡 中）

| 任务                             | 预计耗时 | 依赖   |
| -------------------------------- | -------- | ------ |
| 2.1 添加 TypeScript 类型检查步骤 | 10min    | 阶段一 |
| 2.2 添加依赖缓存优化             | 15min    | 阶段一 |
| 2.3 重命名 job 为 quality-gate   | 5min     | 2.1    |
| 2.4 配置分支保护规则             | 10min    | 2.3    |

### 阶段三: 集成部署（优先级 🟢 低）

| 任务                          | 预计耗时 | 依赖   |
| ----------------------------- | -------- | ------ |
| 3.1 获取并配置 Vercel secrets | 15min    | 阶段二 |
| 3.2 验证自动部署流程          | 15min    | 3.1    |
| 3.3 添加 PR 自动检查          | 10min    | 3.2    |

---

## 4. 预期效果

### 激活前 → 激活后对比

| 场景              | 激活前           | 激活后                    |
| ----------------- | ---------------- | ------------------------- |
| 提交代码到 master | 直接推送，无检查 | CI 自动运行 Lint + 测试   |
| 创建 PR           | 无自动检查       | CI 自动验证，绿色方可合并 |
| 测试失败          | 无人知晓         | CI 阻断，PR 不能合并      |
| 覆盖率下降        | 无人知晓         | CI 警告，PR 不能合并      |
| 类型错误          | 运行时才发现     | CI 阶段阻断               |
| 部署到 Vercel     | 手动触发         | master 合并后自动部署     |

---

## 5. 故障排查

| 问题                | 可能原因      | 解决方案                         |
| ------------------- | ------------- | -------------------------------- |
| CI 测试超时         | 测试文件过多  | 添加 vitest --pool forks 优化    |
| 覆盖率门禁失败      | 新代码未覆盖  | 添加对应测试或调整阈值           |
| Vercel 部署失败     | Secret 未配置 | 检查 GitHub Secrets 配置         |
| TypeScript 检查失败 | 类型不匹配    | 修复类型错误或在 tsconfig 中排除 |
