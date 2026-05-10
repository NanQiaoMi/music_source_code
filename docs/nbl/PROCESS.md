# MIMI Music Player 开发流程规范

> **版本**: v1.0 | **创建日期**: 2026-05-10 | **适用范围**: 前端 (Next.js/React/TypeScript) + 后端 (Python FastAPI) + 桌面端 (Electron)

---

## 1. 工作流概览

```
[Issue/需求] → [feature/xxx 分支] → [开发 + 测试] → [PR → Code Review]
                                                          ↓
[发布] ← [release/x.x.x] ← [staging 验收] ← [合并到 master]
```

### 核心原则

- **master 分支始终可部署**
- **功能分支驱动开发** — 禁止在 master 上直接提交功能代码
- **PR 必经 Code Review** — 至少 1 人 Review 后方可合并
- **CI 必须全绿** — 测试、Lint 未通过不得合并
- **提交即文档** — 提交信息清晰描述变更意图

---

## 2. 分支策略

### 2.1 分支命名规范

| 分支类型 | 命名格式 | 示例 | 来源 | 合并目标 |
|----------|----------|------|------|----------|
| 主分支 | `master` | `master` | — | — |
| 功能分支 | `feature/<scope>-<desc>` | `feature/store-audio-decouple` | master | master |
| Bug 修复 | `fix/<scope>-<desc>` | `fix/player-memory-leak` | master | master |
| 发布分支 | `release/v<版本>` | `release/v0.3.0` | master | master + tag |
| 热修复 | `hotfix/<desc>` | `hotfix/crash-empty-queue` | master | master |
| 实验/重构 | `experiment/<desc>` | `experiment/webgpu-renderer` | master | 废弃或合并到 feature |

### 2.2 功能分支生命周期

1. 从 `master` 创建 `feature/xxx`
2. 日常开发提交到 `feature/xxx`
3. 开发完成 → 创建 PR → Code Review
4. 合并回 `master`（使用 squash merge）
5. 删除 `feature/xxx`

### 2.3 V7.0 核心禁令（持续有效）

以下核心界面文件**禁止修改**：

- 资料库界面（Home View）
- 播放器界面（Player View）
- 全屏歌词界面

所有新增功能通过独立视图、弹窗、面板实现。

---

## 3. 提交信息规范

### 3.1 格式

```
<type>(<scope>): <subject>

<body>（可选）
<footer>（可选）
```

### 3.2 Type 类型

| Type | 含义 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(player): add crossfade transition` |
| `fix` | Bug 修复 | `fix(audio): fix memory leak in AudioEngine` |
| `refactor` | 重构 | `refactor(store): extract coordinator layer` |
| `perf` | 性能优化 | `perf(viz): add object pooling for particles` |
| `test` | 测试相关 | `test(utils): add formatTime edge cases` |
| `docs` | 文档 | `docs: add AGENTS.md entry point` |
| `style` | 代码格式 | `style: fix prettier formatting in audioStore` |
| `chore` | 构建/工具 | `chore: update eslint config` |
| `ci` | CI/CD | `ci: enable test step in pipeline` |

### 3.3 Scope 类型

| Scope | 对应模块 |
|-------|----------|
| `player` | 播放器核心 |
| `audio` | 音频引擎/处理 |
| `viz` | 可视化系统 |
| `emotion` | 情感矩阵/AI |
| `ui` | 通用 UI 组件 |
| `store` | 状态管理 |
| `coordinator` | 中间协调层 |
| `electron` | Electron 桌面端 |
| `backend` | Python 后端 |
| `lib` | 工具库/服务 |
| `lyrics` | 歌词系统 |
| `gesture` | 手势控制 |
| `settings` | 设置面板 |

### 3.4 提交规范

```bash
# 好的提交信息
feat(viz): add aurora wave effect with audio reactivity
fix(audio): prevent AnalyserNode disconnect on track change
refactor(store): extract coordinator layer for audioStore

# 不好的提交信息
fix bug
update code
wip
```

---

## 4. Pull Request 流程

### 4.1 PR 创建

从 `feature/xxx` → `master`，使用仓库已有的模板（`.github/pull_request_template.md`）。

### 4.2 PR 操作流程

1. **创建 PR**: 从 `feature/xxx` → `master`
2. **自动检查**: CI 自动运行 Lint + Test
3. **Code Review**: 至少 1 人 Review
4. **合并**: 使用 **Squash and Merge**（保持 master 历史清洁）
5. **清理**: 合并后自动删除源分支

### 4.3 PR 尺寸规范

- 单个 PR 建议 ≤ 400 行变更
- 超过 400 行应拆分
- 纯测试/文档不在此限

---

## 5. Code Review 标准

### 5.1 Review Checklist

#### 功能性

- [ ] 功能是否按预期工作？
- [ ] 是否处理了边界情况和错误状态？
- [ ] 是否有潜在的性能问题？

#### 代码质量

- [ ] 命名是否清晰、一致？
- [ ] 是否有重复代码可以抽象？
- [ ] 组件职责是否单一？
- [ ] TypeScript 类型是否正确？

#### 安全性

- [ ] 用户输入是否经过验证？
- [ ] API Key 等敏感信息是否安全？
- [ ] 是否存在 XSS/注入风险？

#### 性能

- [ ] 是否有不必要的重渲染？
- [ ] 大型列表是否使用虚拟滚动？
- [ ] Canvas/WebGL 是否有内存泄漏？

#### 测试

- [ ] 新功能是否包含测试？
- [ ] 测试是否覆盖了关键路径和边界情况？
- [ ] 是否破坏了现有测试？

### 5.2 Review 态度

| 标签 | 含义 | 处理方式 |
|------|------|----------|
| blocking | 必须修复才能合并 | 作者必须处理 |
| suggestion | 建议优化 | 作者可自行决定 |
| nitpick | 细微风格问题 | 可忽略或后续处理 |

---

## 6. Changelog 管理

### 6.1 文件位置

`docs/nbl/CHANGELOG.md`

### 6.2 格式

```markdown
# Changelog

## [v0.3.0] - 2026-06-01

### ✨ 新功能

- feat(player): 新增交叉淡入淡出过渡效果
- feat(viz): 新增极光波动画效果（音频响应式）

### 🐛 Bug 修复

- fix(audio): 修复切歌时 AnalyserNode 断开问题
- fix(electron): 修复托盘图标在 Linux 下不显示

### 🔧 重构与优化

- refactor(store): 提取协调器层
- perf(viz): 粒子系统对象池化，性能提升 40%

### 📚 文档

- docs: 新增开发规范与流程手册
- docs: 更新 ROADMAP.md

### 🧪 测试

- test(utils): 新增 formatTime 边界情况测试

### 🔨 CI/CD

- ci: 激活 GitHub Actions 测试步骤
```

### 6.3 更新时机

- **每合并一个 feature/fix 后**更新 Changelog
- **发布前**统一整理

---

## 7. 发布流程

### 7.1 版本号规范

遵循 SemVer: `主版本.次版本.补丁`

| 版本变更 | 条件 | 示例 |
|----------|------|------|
| 主版本 | 破坏性变更 | 1.0.0 → 2.0.0 |
| 次版本 | 新功能（向后兼容） | 0.2.0 → 0.3.0 |
| 补丁 | Bug 修复 | 0.2.0 → 0.2.1 |

### 7.2 发版步骤

```bash
# 1. 从 master 创建 release 分支
git checkout master && git pull
git checkout -b release/v0.3.0

# 2. 更新版本号和 Changelog

# 3. 创建 PR → Code Review → 合并到 master

# 4. 在 master 上打 tag
git checkout master && git pull
git tag v0.3.0
git push origin v0.3.0

# 5. CI/CD 自动构建
```

### 7.3 发布检查清单

- [ ] Changelog 已更新
- [ ] package.json 版本号已更新
- [ ] 测试全部通过
- [ ] 核心界面未修改（V7.0 禁令检查）
- [ ] 新增功能文档已更新
- [ ] 数据格式兼容性检查

---

## 附录: 快速参考命令

```bash
# 创建功能分支
git checkout master && git pull
git checkout -b feature/my-feature

# 提交规范
git commit -m "feat(viz): add aurora wave effect"

# 运行测试
npm run test
npm run test:coverage
npm run lint

# 构建
npm run build
```