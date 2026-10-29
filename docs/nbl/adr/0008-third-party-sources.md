# ADR 0008: 第三方解析源与平台凭据边界

- 状态: Proposed（**D8 于 2026-10-29 由用户暂缓 / Deferred，未批准**）
- 日期: 2026-10-21（提议）/ 2026-10-29（Deferred）
- 关联: D8、S7-8、SourceManagementModal/AccountCenter
- 决策人: 待用户

## 背景

- `sourceConfigStore` 内置第三方解析源配置（用户可增删）。
- `userAccountStore` 明文持久化 5 个平台 cookie（netease/qq/kugou/kuwo/qishui）——属产品/合规风险。
- Web 端只在本机 localStorage 保存，但无"仅本地"明示；桌面端同样明文。

## 选项

- **A（推荐）**：明示"第三方源"并让用户确认；桌面用 safeStorage 加密凭据；Web 明示"仅本地"；源配置与内置源分离；UI 增加风险说明。
- B：只保留官方/授权源（产品能力收缩）。
- C：现状不改，仅加提示（风险仍在）。

## 决策（推荐）

A。由 S7-8 实现凭据加密与提示；旧数据可读并迁移；不破坏现有 cookie 使用路径。

## 现状（2026-10-29）

**未实现**：D8 被用户暂缓（Deferred），S7-8 保持未启动；`userAccountStore` 仍明文持久化 5 平台 cookie；本 ADR 保持 Proposed。

## 影响

S7-8、SourceManagementModal/AccountCenter、文档与合规说明。

## 验收

桌面 cookie 不再明文；旧数据可读并迁移；用户可见风险提示；Web 明示"仅本地"。
