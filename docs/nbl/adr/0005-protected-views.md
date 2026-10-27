# ADR 0005: 受保护视图的等价改写边界

- 状态: Proposed
- 日期: 2026-10-21
- 关联: D7、S3-2/S3-3、S5-2
- 决策人: 待用户

## 背景

- AGENTS.md/PROCESS.md 禁止修改 V7 核心视图（Home View / Player View / 全屏歌词）的视觉与交互。
- 但 page.tsx/GlobalClientComponents/HomeView/PlayerView 的整店订阅是重渲染主因；不触及这些文件无法完全清理。

## 决策（推荐）

允许"仅订阅方式/调度门控"的等价改写（A）：
- 不改 JSX 结构、CSS、交互与文案；diff 只含 useEffect/selector/门控行；
- 改前改后截图对照 + Profiler/指标证据；
- Lead 逐文件复核，PR 描述引用本 ADR。
禁止：布局重排、样式改版、行为变化、动画曲线调整。
若否决，则 S3-2/S3-3 只能做 wrapper，E2/E3 目标下调。

## 验收

视觉回归通过；交互与基线一致；diff 仅订阅/门控；Profiler 证据入 PR。
