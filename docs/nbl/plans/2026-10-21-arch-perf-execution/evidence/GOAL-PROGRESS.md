# 优化 Goal 进度看板（2026-10-28）

> 用途：跨轮次/会话交接。Goal：S0–S8 共 74 项优化任务，完成标准见 goal 描述。

## 当前分支（均未合并，需用户授权后 push/PR）

| 分支                      | Commit  | 内容                                                                       | 状态           |
| ------------------------- | ------- | -------------------------------------------------------------------------- | -------------- |
| `feature/arch-perf-s1-7`  | 0861733 | Watchdog 懒 attach/detach + 15 tests                                       | done（未合并） |
| `feature/arch-perf-s1-6a` | 0988bc2 | PlaybackMediaBridge 核心 + 7 tests                                         | done           |
| `feature/arch-perf-s1-6b` | 72cb4f0 | useAudioPlayer 接入 bridge + 全量回归                                      | done           |
| `feature/arch-perf-s1-8a` | 7ff38da | PlaybackRequestCoordinator + 7 tests                                       | done           |
| `feature/arch-perf-s1-8b` | a48c857 | resolver/audioSource/cache/prefetch 可选 signal + 16 tests + 全量 206/1287 | **部分**       |
| checkpoint 主干           | 41b51e3 | S1-1/S1-2/S1-3 已并入 checkpoint                                           | 基线           |

## 已验证

- S1-6b 分支全量：203 files / 1,274 tests passed（当时分支）
- S1-8b 分支全量：206 files / 1,287 tests passed；tsc 0；eslint 0
- 文档事实：`node scripts/check-docs-facts.mjs` exit 0

## 待办（按优先级）

1. S1-8b：resolver 内部 30+ fetch 透传 signal；`useAudioPlayer.managePlayback` begin/complete + throwIfAborted；连点 5 首集成测试。
2. S1-8 完成后：S1-5 队列唯一权威 → S1-4 VibeMusicDB（需 Q04）→ S1-9 首声并行 → S1-10 集成矩阵。
3. S2–S8 按总计划推进。

## 需用户决策/授权

- 合并/push 上述分支（当前均本地）。
- Q04 fake-indexeddb；Q10 包体缺口；S0-7 ADR/D1/D2/D7。
