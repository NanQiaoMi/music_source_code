# ADR 0007: 最低配置与质量档位

- 状态: Proposed（**D5 未拍板**；S5-6/S6-8 已按默认档位实现，待用户追认）
- 日期: 2026-10-21（提议）/ 2026-10-29（补录）
- 关联: D5、S5-6、S6-8、S8-3
- 决策人: 待用户

## 背景

- 可视化/3D/glass 效果需要质量档位与降级策略；当前曾有两套档位（`visualSettings.visualMode` 与 `performanceV8Store.activePreset`）。
- 低端机（4 核/8GB/1080p 集显）需要明确默认档与降档触发条件。

## 决策（推荐）

- **low** = 4 核 / 8GB / 1080p 集显：默认 DPR 1、粒子减半、关闭全屏 canvas filter；
- **medium** = 8 核 / 16GB：DPR ≤1.5；
- **high** = 独显：保持现状（DPR 2）；
- 自动判定可用 `deviceMemory`/`hardwareConcurrency`/longtask；降档一次一档、有 cooldown。

## 现状（2026-10-29 补录）

- `VisualRuntime` 已实现 high/medium/low 三档（DPR/粒子缩放）、<50fps 降档、≥58fps×3 升档、50ms longtask 降档（S5-6）。
- `performanceV8Store` 降级为**只读投影**，runtime 为唯一 owner（S6-8）；tier↔config 映射在 `src/lib/visualization/quality.ts`。
- 缺口：无 D5 的 `deviceMemory`/`hardwareConcurrency` 设备检测、无 `?tier=`/`NEXT_PUBLIC_QUALITY_TIER` 手动入口；1080p ≥90fps 真机未测。**D5 仍 Pending**。

## 影响

- S5-6、S6-8（性能档合并）、S8-3（场景矩阵）；M5 出口门的 1080p 90fps 依赖本决策的设备矩阵。

## 验收

4x CPU throttle 自动降档；1080p 主场景 ≥90fps 无 dropped；降档行为有日志与 UI 可观察。
