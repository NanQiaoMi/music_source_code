# Architecture Decision Records (ADR)

> 创建: 2026-10-21（S0-7）· 2026-10-29 收口：补齐 8/8 份 ADR，D1/D7 转 Accepted，D2/D8 记 Deferred
> 上级: [架构与性能优化总计划](../plans/2026-10-21-architecture-performance-optimization.md) · [执行计划包](../plans/2026-10-21-arch-perf-execution/README.md) · [决策记录 D/Q](../plans/2026-10-21-arch-perf-execution/00-decisions.md)

## 规则

1. 每个影响架构、数据或发布形态的决定一个文件：docs/nbl/adr/NNNN-short-title.md。
2. 状态：Proposed（提议）/ Accepted（已批准）/ Rejected / Superseded。"Deferred（暂缓）"作为 Proposed 的附注使用，不单列状态。
3. Accepted 必须记录决策人、日期、影响任务；实现后在文末补"结果"。
4. 未批准的 ADR 不得作为实现依据；默认值见 00-decisions.md。
5. 变更历史只追加，不覆盖。
6. **编号说明（2026-10-29）**：S0 计划曾把 0005 定为质量档、0006 主题、0007 受保护视图、0008 第三方源；实际实现把 0005 用于受保护视图（D7，2026-10-21 已建）。本次按实际顺序补录 **0006 主题 owner（D6）/ 0007 质量档（D5）/ 0008 第三方源（D8）**，总数达到计划要求的 8 份。

## 索引

| ADR                                     | 主题                                             | 关联决策   | 状态                                              |
| --------------------------------------- | ------------------------------------------------ | ---------- | ------------------------------------------------- |
| [0001](./0001-v8-visualization.md)      | V8 可视化处置（保留归档 + legacy key，不删实现） | D1         | **Accepted 2026-10-29**                           |
| [0002](./0002-desktop-runtime.md)       | Windows 桌面运行时（本地 Next，不用静态导出）    | D2         | Proposed（**Deferred 2026-10-29**）               |
| [0003](./0003-audio-graph-ownership.md) | 音频图单一所有者与 DSP 死代码处置                | D3         | Proposed（D3 Pending）                            |
| [0004](./0004-persistence-registry.md)  | 持久化注册表、版本与备份范围                     | D4/Q05/Q07 | Proposed（D4 Pending；口径校正 43 key）           |
| [0005](./0005-protected-views.md)       | 受保护视图的等价改写边界                         | D7         | **Accepted 2026-10-29**（单分辨率 1440x900 基线） |
| [0006](./0006-theme-owner.md)           | 主题单一所有者（themeStore）                     | D6         | Proposed（S6-7 已按 A 实现，待追认）              |
| [0007](./0007-quality-tiers.md)         | 最低配置与质量档位                               | D5         | Proposed（S5-6/S6-8 已按默认实现，待追认）        |
| [0008](./0008-third-party-sources.md)   | 第三方解析源与平台凭据边界                       | D8         | Proposed（**Deferred 2026-10-29**）               |

## 2026-10-29 决策收口摘要

- **D1 Accepted / Decided**：保留 `archive/visualization-v8/` 与 legacy key `visualization-v8-store`，不删除实现；7b 死代码已删（4 文件 / 571 行）。→ 0001 Accepted。
- **D7 Accepted**：允许"仅订阅/调度"等价改写，视觉基线按单一分辨率 1440x900 @1x 接受（4 档 pixel diff 豁免）。→ 0005 Accepted。
- **D2 Deferred**：桌面发布继续冻结，S7-4..S7-8 不启动。→ 0002 保持 Proposed。
- **D8 Deferred**：S7-8 不启动。→ 0008 保持 Proposed。
- **D3/D4/D5/D6 仍 Pending**：对应 ADR 保持 Proposed（0003/0004/0007/0006），其中 0006/0007 的默认方案已在 S6-7/S5-6/S6-8 落地，等待追认。

完整裁定与 6 项验收偏差见 [00-decisions.md](../plans/2026-10-21-arch-perf-execution/00-decisions.md) 的「2026-10-29 用户批准记录」。
