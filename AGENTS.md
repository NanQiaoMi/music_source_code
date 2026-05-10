# AGENTS.md — MIMI Music Player (Vibe Player) v0.2

> AI Worker Entry Point — 所有 AI 工作者（Claude Code / Cursor / Windsurf）的项目级入口。

---

## 快速定位

| 你需要 | 查看 |
|--------|------|
| 当前要做什么 | `docs/nbl/ROADMAP.md` |
| 开发流程规范 | `docs/nbl/PROCESS.md` |
| 编码/测试规范 | `docs/nbl/CODING_STANDARDS.md` |
| 系统架构 | `docs/nbl/ARCHITECTURE.md` |
| 当前迭代实施计划 | `docs/nbl/plans/` 目录 |
| 技术设计方案 | `docs/nbl/specs/` 目录 |
| 设计系统 | `DESIGN.md` |
| 产品策略 | `PRODUCT.md` |
| 启动指南 | `STARTUP_GUIDE.md` |
| 历史文档（已归档） | `docs/nbl/archive/` 目录 |

---

## 项目概况

次世代沉浸式音乐播放器，核心亮点：

- **V8 可视化系统**: 28 个 Canvas 2D + WebGL 效果引擎
- **情感矩阵 AI**: 2D 坐标情感分析 + AI 歌词笔记
- **玻璃拟态 UI**: Apple 风格 Glass 组件库
- **44 个 Zustand Store**（需架构解耦优化）

### 技术栈

| 领域 | 方案 |
|------|------|
| 核心框架 | Next.js 16 + React 19 + TypeScript 5.4 (strict) |
| 状态管理 | Zustand 5（部分 persist 中间件） |
| 动画 | Framer Motion 12 + Spring Physics |
| 3D 渲染 | Three.js 0.183 |
| 样式 | Tailwind CSS 3.4 + OKLCH Tokens |
| 音频引擎 | Web Audio API（AudioContext Singleton） |
| AI 分析 | Python FastAPI + ModelScope |

---

## 禁止操作

- 不要在 `master` 分支上直接开发功能
- 不要修改 V7.0 核心视图（Home View / Player View / 全屏歌词）
- 不要引入破坏现有 localStorage/IndexedDB 数据格式的变更
- 不要提交 `.env`、`credentials.json` 等密钥文件
- 不要删除不确定的代码（优先标记后保留）

---

## 开发命令速查

```bash
npm run dev              # 开发服务器 (port 3025)
npm run build            # 生产构建
npm run test             # 运行测试
npm run test:coverage    # 测试 + 覆盖率
npm run lint             # ESLint 检查
npm run format           # Prettier 格式化
npm run clean            # 清理 .next 缓存
```

---

## 关键约束

- **类型检查**: strict 模式，类型错误阻止构建（`next.config.js` 中 `ignoreBuildErrors: false`）
- **ESLint**: 当前 19,790 行问题（18,954 prettier / 431 no-explicit-any / 325 no-unused-vars）
- **Pre-commit**: husky + lint-staged，当前需 `--no-verify` 绕过
- **测试**: Vitest + jsdom，覆盖率无门禁阈值
- **CI**: GitHub Actions，测试步骤被注释

---

## 当前迭代

参见 `docs/nbl/ROADMAP.md` → Phase 0
当前实施计划: `docs/nbl/plans/2026-05-10-phase0-infrastructure.md`