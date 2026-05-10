# Mimimusic AI 功能说明文档

## 1. AI 乐评与“灵魂摘要” (Emotional Liner Notes)

### 功能概述
利用 GPT-4o-mini 对歌曲的元数据（歌词、标题、艺术家）进行深度语义分析，生成具有“通感的”、极简风格的音乐评论。

### 技术实现
- **Store**: `src/store/linerNotesStore.ts`
  - 使用 Zustand + Persist 实现本地持久化缓存。
  - 接入 OpenAI 兼容接口，支持 Base URL 自定义。
- **UI 组件**: `src/components/widgets/AILinerNotes.tsx`
  - 基于 Framer Motion 的动效系统。
  - 衬线斜体排版，追求顶级音乐杂志的审美。
- **集成点**: `src/components/layout/GlobalClientComponents.tsx`

### 核心 Prompt (灵魂所在)
```text
你是一位拥有 20 年经验的高级音乐评论家，为《Pitchfork》或《The Wire》等前卫音乐杂志撰稿。
你的任务是为一首歌生成一段极简的“灵魂摘要”。
风格要求：
1. 抽象且富有感官色彩：关注质感（texture）、色彩（color）、温度（temperature）和空间感（space）。
2. 措辞高级：使用如“铝制触感”、“余烬中的回响”、“极简主义的脉冲”、“流动的深蓝”等词汇。
3. 字数极简：20-40 个字。
```

## 2. 如何管理与测试
- **设置面板**: `src/components/settings/AISettingsPanel.tsx`
- **调试工具**: `scratch/api_checker.html` (独立诊断工具)

## 3. 后续扩展建议
- **Resonance Totem (共鸣图腾)**: 将 AI 返回的 0-1 情绪参数映射至 `totemStore`，驱动 3D 视觉。
- **Vision Integration**: 利用 GPT-4o-mini 的 Vision 能力自动根据封面生成 UI 配色。
