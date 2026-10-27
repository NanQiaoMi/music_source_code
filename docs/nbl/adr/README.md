# Architecture Decision Records (ADR)

> 创建: 2026-10-21（S0-7）
> 上级: [架构与性能优化总计划](../plans/2026-10-21-architecture-performance-optimization.md) · [执行计划包](../plans/2026-10-21-arch-perf-execution/README.md) · [决策记录 D/Q](../plans/2026-10-21-arch-perf-execution/00-decisions.md)

## 规则

1. 每个影响架构、数据或发布形态的决定一个文件：docs/nbl/adr/NNNN-short-title.md。
2. 状态：Proposed（提议）/ Accepted（已批准）/ Rejected / Superseded。
3. Accepted 必须记录决策人、日期、影响任务；实现后在文末补"结果"。
4. 未批准的 ADR 不得作为实现依据；默认值见 00-decisions.md。
5. 变更历史只追加，不覆盖。

## 索引

| ADR | 主题 | 关联决策 | 状态 |
|---|---|---|---|
| [0001](./0001-v8-visualization.md) | V8 可视化处置（冻结→移植契约→删除） | D1 | Proposed |
| [0002](./0002-desktop-runtime.md) | Windows 桌面运行时（本地 Next，不用静态导出） | D2 | Proposed |
| [0003](./0003-audio-graph-ownership.md) | 音频图单一所有者与 DSP 死代码处置 | D3 | Proposed |
| [0004](./0004-persistence-registry.md) | 持久化注册表、版本与备份范围 | D4/Q05/Q07 | Proposed |
| [0005](./0005-protected-views.md) | 受保护视图的等价改写边界 | D7 | Proposed |
