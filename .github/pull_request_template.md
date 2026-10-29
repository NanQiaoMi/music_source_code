## 变更摘要

<!-- 必填：一句话说明改了什么、为什么改；列出关键文件/模块 -->

**关联任务 ID**: <!-- 必填：如 S0-4 / S5-2d / E5-1；无任务填 "none" -->

**关联 Issue**: Closes #

**写作用域**: <!-- 必填：本次改动的目录/文件；作用域外的改动必须说明原因 -->

**变更行数**: <!-- 必填：净增/净删；超过 400 行需说明拆分计划 -->

### 变更类型

- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 性能优化 (perf)
- [ ] 测试 (test)
- [ ] 文档 (docs)
- [ ] CI/CD (ci)

---

### 核心禁令检查（V7.0）

- [ ] 资料库界面（Home View）未修改
- [ ] 播放器界面（Player View）未修改
- [ ] 全屏歌词界面未修改

---

### 测试执行记录（必填）

| 命令                                | 结果（文件 / 用例 / exit） |
| ----------------------------------- | -------------------------- |
| `npx tsc --noEmit`                  |                            |
| `npm run test -- --run`             |                            |
| `npm run lint`                      |                            |
| `node scripts/check-docs-facts.mjs` |                            |

<!-- 其他定向测试请补充命令与结果；未执行的检查写明原因，不得留空 -->

### 性能 / 门禁证据（必填）

- [ ] `npm run verify:raf`（rAF 白名单；新增直接 rAF 已登记并写明理由）
- [ ] `npm run perf:gates`（store 预算 / store 统计 / bundle markers / rAF 审计）
- [ ] 涉及包体、帧率或分配时附 before/after 数据与测量命令

<!-- 贴命令输出、perf/*.json 路径或 "不适用 + 原因" -->

### 数据兼容

- [ ] 未改动 localStorage / IndexedDB 的 key 或持久化结构
- [ ] 若改动：附迁移/回滚说明与 fixture

### 回滚方式（必填）

<!-- 例：revert <commit>；或 NEXT_PUBLIC_VISUAL_RUNTIME=off 回到旧路径；或恢复上一版基线文件 -->

### 截图（UI 变更时必填）

<!-- 贴图位置 -->

---

### 检查清单

- [ ] 代码遵循项目编码规范
- [ ] 无 TypeScript 类型错误
- [ ] Lint 检查通过
- [ ] 已添加/更新相关文档
- [ ] 无未处理的 TODO/FIXME（存量 TODO 已关联任务 ID）
- [ ] Changelog 已更新（如适用）
- [ ] 关联 AGENTS.md/docs/nbl 文档已更新（如适用）
