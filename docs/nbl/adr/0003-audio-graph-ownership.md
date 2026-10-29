# ADR 0003: 音频图单一所有者与 DSP 死代码

- 状态: Proposed
- 日期: 2026-10-21
- 关联: D3、S2-1、S2-5、S6-9
- 决策人: 待用户
- 2026-10-29 复核: **D3 仍 Pending**（不在 2026-10-29 批准范围）；S2-1/S2-2/S2-5 已按本 ADR 的 1–3 条实现（destination 入边=1、音量单点、增量参数），第 4 条 DSPProcessor/AudioGraphManager 去留仍待 D3 拍板。

## 背景

- analyser→destination 常连（AudioEngine.ts:68）后又接效果链（useAudioPlayer.ts:986-1005）→ 干湿叠加。
- element.volume 与 masterGain 同改（useAudioPlayer.ts:1758-1764）→ 音量疑似双重衰减。
- DSPProcessor.ts（452 行）与 AudioGraphManager.ts（300 行）未接播放主链（仅自身/测试引用）。
- AudioEffectsManager 切效果重建整条链（:331-377,620-628），滑杆拖动易爆音/长任务。

## 决策（推荐）

1. 单一所有者：AudioGraphController 拥有 context/EQ/master/analyser/效果链；单入口 destination；提供 dispose。
2. 音量只由 masterGain 控制，audio.volume 固定 1。
3. 效果参数增量更新（setTargetAtTime），仅结构参数重建链。
4. DSPProcessor/AudioGraphManager 先标 @deprecated，一个版本后删除（D3-A）；若产品需要压缩/混响再另立接入计划。

## 验收

destination 入边 = 1；volume=0.5 输出 -6dB；滑杆 100 次 connect=0；100 次切歌节点增量 0；2h soak 无泄漏。
