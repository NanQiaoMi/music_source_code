# MIMI Music Player 开发规范与流程手册

> **版本**: v1.0
> **创建日期**: 2026-05-10
> **适用范围**: 前端 (Next.js/React/TypeScript) + 后端 (Python FastAPI) + 桌面端 (Electron)

---

## 目录

1. [工作流概览](#1-工作流概览)
2. [分支策略](#2-分支策略)
3. [提交信息规范](#3-提交信息规范)
4. [Pull Request 流程](#4-pull-request-流程)
5. [Code Review 标准](#5-code-review-标准)
6. [Changelog 管理](#6-changelog-管理)
7. [编码规范](#7-编码规范)
8. [测试规范](#8-测试规范)
9. [文档规范](#9-文档规范)
10. [发布流程](#10-发布流程)

---

## 1. 工作流概览

```
[Issue/需求] → [feature/xxx 分支] → [开发 + 测试] → [PR → Code Review]
                                                          ↓
[发布] ← [release/x.x.x] ← [staging 验收] ← [合并到 master]
```

### 核心原则

- **master 分支始终可部署** — 任何时刻 master 的代码都是生产就绪的
- **功能分支驱动开发** — 禁止在 master 上直接提交功能代码
- **PR 必经 Code Review** — 至少 1 人 Review 后方可合并
- **CI 必须全绿** — 测试、Lint 未通过不得合并
- **提交即文档** — 提交信息清晰描述变更意图

---

## 2. 分支策略

### 2.1 分支命名规范

| 分支类型  | 命名格式             | 示例                             | 来源   | 合并目标             |
| --------- | -------------------- | -------------------------------- | ------ | -------------------- |
| 主分支    | `master`             | `master`                         | —      | —                    |
| 功能分支  | `feature/<简短描述>` | `feature/viz-spectrum-refine`    | master | master               |
| Bug 修复  | `fix/<简短描述>`     | `fix/audio-engine-memory-leak`   | master | master               |
| 发布分支  | `release/<版本号>`   | `release/v0.3.0`                 | master | master + tag         |
| 热修复    | `hotfix/<简短描述>`  | `hotfix/crash-on-empty-playlist` | master | master               |
| 实验/重构 | `experiment/<描述>`  | `experiment/webgpu-renderer`     | master | 废弃或合并到 feature |

### 2.2 分支生命周期

```
master ───●────────────●────────────●────────────●
          \            /            /            /
feature   ●──●──●────●             /            /
                                 /            /
fix                          ●──●────●       /
                                            /
release                              ●────●
```

**功能分支流程:**

1. 从 `master` 创建 `feature/xxx`
2. 日常开发提交到 `feature/xxx`
3. 开发完成 → 创建 PR → Code Review
4. 合并回 `master`（使用 squash merge）
5. 删除 `feature/xxx`

### 2.3 V7.0 核心禁令（持续有效）

以下核心界面文件**禁止修改**:

- 资料库界面（Home View）
- 播放器界面（Player View）
- 全屏歌词界面

所有新增功能通过独立视图、弹窗、面板实现。

---

## 3. 提交信息规范

### 3.1 格式

```
<type>(<scope>): <subject>

<body> (可选)

<footer> (可选)
```

### 3.2 Type 类型

| Type       | 含义      | 示例                                            |
| ---------- | --------- | ----------------------------------------------- |
| `feat`     | 新功能    | `feat(player): add crossfade transition`        |
| `fix`      | Bug 修复  | `fix(audio): fix memory leak in AudioEngine`    |
| `refactor` | 重构      | `refactor(viz): extract common effect pipeline` |
| `perf`     | 性能优化  | `perf(three): add object pooling for particles` |
| `test`     | 测试相关  | `test(utils): add formatTime edge cases`        |
| `docs`     | 文档      | `docs: add CI/CD setup guide`                   |
| `style`    | 代码格式  | `style: fix indentation in GlassCard`           |
| `chore`    | 构建/工具 | `chore: update eslint config`                   |
| `ci`       | CI/CD     | `ci: enable test step in pipeline`              |

### 3.3 Scope 类型

| Scope      | 对应模块        |
| ---------- | --------------- |
| `player`   | 播放器核心      |
| `audio`    | 音频引擎/处理   |
| `viz`      | 可视化系统      |
| `emotion`  | 情感矩阵/AI     |
| `ui`       | 通用 UI 组件    |
| `store`    | 状态管理        |
| `electron` | Electron 桌面端 |
| `backend`  | Python 后端     |
| `lib`      | 工具库/服务     |
| `lyrics`   | 歌词系统        |
| `gesture`  | 手势控制        |
| `settings` | 设置面板        |

### 3.4 提交规范

```bash
# ✅ 好的提交信息
feat(viz): add aurora wave effect with audio reactivity
fix(audio): prevent AnalyserNode disconnect on track change
refactor(store): extract playlist persistence logic

# ❌ 不好的提交信息
fix bug
update code
wip
asdf
```

---

## 4. Pull Request 流程

### 4.1 PR 创建模板

```markdown
## 变更说明

<!-- 简要描述本次 PR 的变更内容 -->

## 关联 Issue

Closes #123

## 变更类型

- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 性能优化 (perf)
- [ ] 测试 (test)
- [ ] 文档 (docs)
- [ ] CI/CD (ci)

## 核心禁令检查

<!-- V7.0 核心界面是否被修改 -->

- [ ] 资料库界面（Home View）未修改
- [ ] 播放器界面（Player View）未修改
- [ ] 全屏歌词界面未修改

## 测试验证

- [ ] 新增测试已通过
- [ ] 现有测试未回归
- [ ] 手动测试覆盖主要场景

## 截图（UI 变更时必填）

<!-- 新增或修改 UI 时，请附上截图 -->

## 检查清单

- [ ] 代码遵循项目编码规范
- [ ] 无 TypeScript 类型错误
- [ ] Lint 检查通过
- [ ] 已添加/更新相关文档
- [ ] 无未处理的 TODO/FIXME
```

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

- **善意推定**: 假设对方做了合理的选择
- **关注代码而非人**: "这个函数需要边界检查" 而非 "你忘了加边界检查"
- **解释原因**: 给出建议时说明理由
- **区分主次**: 标注 blocking vs. nitpicking

| 标签       | 含义             | 处理方式         |
| ---------- | ---------------- | ---------------- |
| blocking   | 必须修复才能合并 | 作者必须处理     |
| suggestion | 建议优化         | 作者可自行决定   |
| nitpick    | 细微风格问题     | 可忽略或后续处理 |

---

## 6. Changelog 管理

### 6.1 文件位置

`docs/CHANGELOG.md`

### 6.2 格式

```markdown
# Changelog

## [v0.3.0] - 2026-06-01

### ✨ 新功能

- `feat(player)`: 新增交叉淡入淡出过渡效果
- `feat(viz)`: 新增极光波动画效果（音频响应式）

### 🐛 Bug 修复

- `fix(audio)`: 修复切歌时 AnalyserNode 断开问题
- `fix(electron)`: 修复托盘图标在 Linux 下不显示

### 🔧 重构与优化

- `refactor(store)`: 提取播放列表持久化逻辑
- `perf(three)`: 粒子系统对象池化，性能提升 40%

### 📚 文档

- `docs`: 新增 CI/CD 配置指南
- `docs`: 更新开发规范手册

### 🧪 测试

- `test(utils)`: 新增 formatTime 边界情况测试

### 🔨 CI/CD

- `ci`: 激活 GitHub Actions 测试步骤
- `ci`: 新增覆盖率门禁（≥60%）

## [v0.2.0] - 2026-05-09

### ✨ 新功能

...
```

### 6.3 更新时机

- **每合并一个 feature/fix 后**更新 Changelog
- **发布前**统一整理
- 使用 `keepachangelog.com` 格式

---

## 7. 编码规范

### 7.1 TypeScript

```typescript
// ✅ 优先使用 interface 而非 type（定义对象时）
interface UserPreferences {
  theme: "dark" | "light";
  volume: number;
}

// ✅ 使用 type 定义联合类型、工具类型
type ViewType = "home" | "player" | "lyrics" | "visualization";

// ✅ 显式声明函数返回值
function formatTime(seconds: number): string {
  // ...
}
```

### 7.2 React 组件

```typescript
// ✅ 使用函数组件 + hooks
// ✅ 文件名 = 组件名 (PascalCase)
// ✅ 默认导出组件
const GlassCard: React.FC<GlassCardProps> = ({ children, className }) => {
  return (
    <div className={`glass-card ${className}`}>
      {children}
    </div>
  );
};

export default GlassCard;
```

### 7.3 状态管理 (Zustand)

```typescript
// ✅ Store 按功能模块拆分（已有 44 个 store）
// ✅ 使用 persist 中间件持久化
// ✅ 使用 partialize 选择性持久化
interface AudioState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  play: (track: Track) => void;
  pause: () => void;
  setVolume: (volume: number) => void;
}
```

### 7.4 样式

- 使用 Tailwind CSS 类名（优先）
- 复杂样式封装为 `GlassCard`, `GlassButton` 等组件
- 设计 token 定义在 `src/lib/tokens.ts`
- 颜色使用 OKLCH 色值

### 7.5 导入顺序

```typescript
// 1. 外部库
import React from "react";
import { motion } from "framer-motion";

// 2. 内部模块（按层级）
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { useAudioStore } from "@/store/audioStore";

// 3. 组件
import GlassCard from "@/components/shared/Glass/GlassCard";

// 4. 类型
import type { Track } from "@/types";
```

---

## 8. 测试规范

### 8.1 测试层级

| 层级        | 覆盖范围         | 工具           | 目标覆盖率 |
| ----------- | ---------------- | -------------- | ---------- |
| Unit        | 工具函数、纯逻辑 | Vitest         | ≥80%       |
| Component   | 组件渲染、交互   | Vitest + jsdom | ≥60%       |
| Integration | Store + 组件联动 | Vitest         | ≥40%       |
| E2E         | 核心用户流程     | Playwright     | 关键路径   |

### 8.2 命名规范

```
src/
├── utils/
│   ├── formatTime.ts
│   └── formatTime.test.ts     # ✅ 测试文件与源文件同级
├── lib/
│   ├── audio/
│   │   ├── AudioEngine.ts
│   │   └── AudioEngine.test.ts  # ✅
└── components/
    ├── shared/
    │   ├── GlassCard.tsx
    │   └── GlassCard.test.tsx    # ✅
```

### 8.3 测试结构 (AAA 模式)

```typescript
describe("formatTime", () => {
  describe("正常输入", () => {
    it("将秒数格式化为 MM:SS", () => {
      // Arrange
      const input = 125;

      // Act
      const result = formatTime(input);

      // Assert
      expect(result).toBe("02:05");
    });
  });

  describe("边界情况", () => {
    it("处理 0 秒", () => {
      expect(formatTime(0)).toBe("00:00");
    });

    it("处理 NaN", () => {
      expect(formatTime(NaN)).toBe("00:00");
    });
  });
});
```

---

## 9. 文档规范

### 9.1 文档位置

| 文档类型           | 位置                |
| ------------------ | ------------------- |
| 开发计划/技术设计  | `docs/`             |
| API 文档           | `docs/api/`         |
| 架构决策记录 (ADR) | `docs/adr/`         |
| 用户指南           | `docs/guides/`      |
| Changelog          | `docs/CHANGELOG.md` |

### 9.2 技术设计文档模板

使用 `skills/tech-design/template.md` 模板，包含:

- 需求背景
- 整体架构设计（Mermaid 图）
- 技术设计（流程图/时序图）
- API 设计
- 模型设计

### 9.3 注释规范

```typescript
// ❌ 避免：明显废话注释
const age = 25; // 设置年龄为 25

// ✅ 好的：解释"为什么"而非"是什么"
// 使用固定延迟避免快速切歌导致的 AudioContext 状态冲突
const SWITCH_DELAY_MS = 50;

// ✅ 好的：复杂逻辑需要注释
// 使用 FFT 算法将时域信号转换为频域，
// 结果数组的前半部分包含正频率分量
```

---

## 10. 发布流程

### 10.1 版本号规范

遵循 SemVer: `主版本.次版本.补丁`

| 版本变更 | 条件               | 示例          |
| -------- | ------------------ | ------------- |
| 主版本   | 破坏性变更         | 1.0.0 → 2.0.0 |
| 次版本   | 新功能（向后兼容） | 0.2.0 → 0.3.0 |
| 补丁     | Bug 修复           | 0.2.0 → 0.2.1 |

### 10.2 发版步骤

```bash
# 1. 从 master 创建 release 分支
git checkout master
git pull
git checkout -b release/v0.3.0

# 2. 更新版本号
# 修改 package.json version 字段

# 3. 更新 Changelog
# 编辑 docs/CHANGELOG.md

# 4. 创建 PR → Code Review → 合并到 master

# 5. 在 master 上打 tag
git checkout master
git pull
git tag v0.3.0
git push origin v0.3.0

# 6. CI/CD 自动构建和发布
```

### 10.3 发布检查清单

- [ ] Changelog 已更新
- [ ] package.json 版本号已更新
- [ ] CI/CD 测试全部通过
- [ ] 核心界面未修改（V7.0 禁令检查）
- [ ] 新增功能文档已更新
- [ ] 数据库/数据格式兼容性检查

---

## 附录 A: 参考文档

| 文档                             | 说明                |
| -------------------------------- | ------------------- |
| `README.md`                      | 项目概览和快速开始  |
| `DESIGN.md`                      | 设计系统 tokens     |
| `PRODUCT.md`                     | 产品策略            |
| `STARTUP_GUIDE.md`               | 启动指南            |
| `docs/V7.0_DEVELOPMENT_PLAN.md`  | V7.0 开发计划       |
| `docs/V8.0_DEVELOPMENT_PLAN.md`  | V8.0 可视化开发计划 |
| `docs/MODEL_INTEGRATION_PLAN.md` | AI 模型整合计划     |
| `docs/CHANGELOG.md`              | 变更日志            |

## 附录 B: 快速参考命令

```bash
# 创建功能分支
git checkout master
git pull
git checkout -b feature/my-feature

# 提交规范
git commit -m "feat(viz): add aurora wave effect"

# 运行测试
npm run test
npm run test:coverage
npm run lint

# 构建
npm run build
npm run build:electron:win

# 完整启动
npm run dev:full
```
