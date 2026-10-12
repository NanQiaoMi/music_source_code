# Folia 启发的「温光浮字」歌词视觉迁移实施计划

> **状态：已取代。** 本计划实现的是把云阶、浮名、绘光融合的旧方案；用户指出它没有达到 Folia 的 MV 式画面。不要按此计划继续修改。新的唯一实施基线为 [Folia 绘光式歌词 MV 重做计划](./2026-10-12-folia-lyric-mv-implementation.md)。

> **For agentic workers:** REQUIRED SUB-SKILL: 推荐使用 `nbl.parallel-subagent-driven-development` 按任务执行；如用户选择串行方式则使用 `nbl.subagent-driven-development`。每项任务使用复选框追踪。

**Goal:** 将「温光浮字」升级为云阶短行、浮名纵深和绘光暖色光场融合的 Canvas 歌词舞台，并保持 LRC 行时间、播放器状态、现有设置和持久化格式兼容。

**Architecture:** 保留 `cinematicLyricDrift` 的 Canvas 2D 入口和现有效果设置；把纯 LRC 时间线与稳定短行布局抽为无副作用 helper，由效果渲染函数根据 `EffectContext.musicTime`、播放器状态及 RAF 时间绘制背景、远景、当前字素、光束和微尘。歌词内字素时间只由相邻 LRC 行区间估算；画布实例状态按 Canvas context 隔离，seek、切歌、歌词更新和播放状态变化都能从当前歌曲时间重新计算。

**Tech Stack:** Next.js 16、React 19、TypeScript strict、Zustand、Canvas 2D、Vitest/jsdom。

---

## 1. 实施基线和边界

- 已通过的设计规格：`docs/nbl/specs/2026-10-11-folia-inspired-warm-lyrics-design.md`。
- 目标分支：`feature/folia-inspired-lyric-visualizer`；开始实现前重新检查工作区，保留用户已有改动。
- 效果 ID 固定为 `cinematicLyricDrift`；现有 `effectSettings.cinematicLyricDrift` 字段及默认值继续可读，不新增必须迁移的设置键。
- 不改 `Song.lyrics`、localStorage、IndexedDB、歌词服务、播放队列、音频状态格式、`Home View`、`Player View` 或全屏歌词视图。
- 不添加 Pixi、Three.js、Framer Motion、新网络请求或新的歌词同步 API。
- 行内高亮是视觉估算，不展示“逐词精准同步”文案；无可解析 LRC 时只显示曲名/艺人和环境光场，不将标题拆成歌词。
- 设计规格和实施计划已由用户通过；当前按并行方式执行。各任务在实现、验证和双阶段自审完成后再标记完成。

## 2. 文件职责

| 路径                                                          | 实施职责                                                                                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/visualization/effects/lyricTimeline.ts`       | 新建纯函数模块：解析有效 LRC 行、稳定分组相同时间戳、定位当前组，并将行区间分配为估算字素/词组时间单元。                                 |
| `src/components/visualization/effects/lyricTimeline.test.ts`  | 新建纯逻辑回归覆盖：解析边界、同刻重复/并发行、短行区间、字素分段和 seek 定位。                                                          |
| `src/components/visualization/effects/lyricLayout.ts`         | 新建纯布局模块：按测量回调将时间单元稳定编排为 2–5 个短行，保持源顺序、标点粘连和视口安全区。                                            |
| `src/components/visualization/effects/lyricLayout.test.ts`    | 新建布局回归覆盖：稳定种子、中文/拉丁混排、标点、窄视口、过长词组和布局顺序。                                                            |
| `src/components/visualization/effects/cinematicLyricDrift.ts` | 效果整合：按 Canvas context 隔离过渡状态；校正暂停、倍率、seek、切歌和迟到歌词；绘制融合舞台各层，并保留既有底色、色斑、胶片纹理和暗角。 |
| `src/components/visualization/VisualizationView.tsx`          | 页面从隐藏恢复时，通过现有 `audioRef` 读取媒体真实时间/时长并同步既有 store，再恢复 RAF，避免首帧读取被 250ms 节流的旧值。               |
| `src/components/visualization/VisualizationSettingsPanel.tsx` | 保留设置键和值域，修正字体/调色板选项显示与实际效果枚举一致，并让现有滑杆名称表达迁移后的视觉作用。                                      |
| `docs/nbl/CHANGELOG.md`                                       | 实现和验证完成后记录实际交付内容；不能在功能尚未实现时提前记录为已完成。                                                                 |
| `docs/nbl/plans/INDEX.md`                                     | 用户批准实施计划并完成实现后，更新计划状态与索引摘要。                                                                                   |

除页面隐藏恢复处的最小采样外，不修改 `visualizationStore.ts`、`audioStore.ts`、`playerStore.ts` 或 `EffectContext`。代码审查确认 Canvas 只有 store 的低频时间快照，因此 `VisualizationView.tsx` 在恢复可见时使用已经暴露的 `audioRef` 读取一次媒体 `currentTime`/`duration` 并调用现有 store setter；不增加播放状态字段、持久化键或新 API。

## 3. 实施任务

### Task 1：建立确定性的 LRC 时间线和字素节奏模型

**状态**

- [x] 已完成

**Dependencies:** None
**Parallelizable:** Yes（与 Task 2、Task 4 的职责文件互不重叠）

- [x] **Step 1：为纯时间线边界写回归用例**

在 `lyricTimeline.test.ts` 中覆盖以下固定输入和结果：

| 输入场景                                     | 断言                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| 空字符串、纯文本、只有元数据行、无效时间标签 | 返回空时间线，不抛异常。                                                          |
| `[00:01.20]甲` 与 `[00:02.00]乙`             | 两行起点为 1.2 和 2.0 秒，第一行区间终点严格为 2.0 秒。                           |
| 两个标签同文本、同一时间戳                   | 合并一个显示项，不重复绘制。                                                      |
| 同一时间戳的两条不同文本                     | 保持原始源顺序，归入同一并发组。                                                  |
| 同文本有两个不同时间标签                     | 保留两个不同起点。                                                                |
| `<0.18s`、`0.18–0.45s`、`>0.45s` 行区间      | 前者作为单组高亮，中段合并为少量组，较长区间才逐字/逐词分段；所有段都在行区间内。 |
| 末句有歌曲结束时间/没有结束时间              | 有效结束时间不越过曲终；缺少时长时使用 2–5 秒受限尾长。                           |
| 标点串、中英混排、emoji、组合字素            | 标点粘连相邻单位；字素不被拆坏；结果权重总和可归一化。                            |
| `[offset:]` 标签                             | 不做时间偏移，和规格一致。                                                        |

执行命令：`npx vitest run src/components/visualization/effects/lyricTimeline.test.ts`。预期：新用例通过；在实际实现阶段，若用例先行添加，首次运行应针对未实现导出失败，随后实现后通过。该命令只在用户批准实施并要求验证后执行。

- [x] **Step 2：定义稳定、可复用的纯数据接口**

在 `lyricTimeline.ts` 中实现以下导出，后续任务只依赖这些名字：

```ts
export interface ParsedLyricLine {
  start: number;
  text: string;
  ordinal: number;
}

export interface LyricLineGroup {
  start: number;
  lines: ParsedLyricLine[];
}

export interface TimedLyricUnit {
  text: string;
  start: number;
  end: number;
  lineIndex: number;
}

export function parseTimedLyrics(raw: string): ParsedLyricLine[];
export function groupLyricsByStart(lines: readonly ParsedLyricLine[]): LyricLineGroup[];
export function findActiveGroupIndex(groups: readonly LyricLineGroup[], musicTime: number): number;
export function estimateLineUnits(
  text: string,
  start: number,
  end: number,
  lineIndex: number
): TimedLyricUnit[];
```

- [x] **Step 3：实现时间边界与短行降级**

沿用现有元数据行过滤和 `[mm:ss]` / `[mm:ss.xx]` 识别；稳定按起点排序。将相同起点归组，活动组按 `start <= musicTime` 的最后一个起点定位。每条行的有效区间到下一个**严格更晚**的组起点为止；不使用固定 1.2 秒最小区间，不应用 `[offset:]`。末句优先使用曲目时长，时长缺失时使用 2–5 秒的受限尾长。

- [x] **Step 4：实现字素/词组估算和权重归一化**

用 `Intl.Segmenter`（若运行环境缺失则退回安全的 `Array.from` 分段）识别可绘制单位；CJK 按字素分段，拉丁文优先按单词分段，标点附着相邻单位并增加停顿权重。按行有效区间归一化所有权重；极短行和密集时间戳采用 Step 1 的组化规则，不能把活动高亮延长到下一行。seek、反向 seek 和相同歌曲时间都必须返回相同结果。

- [x] **Step 5：运行纯模块用例并提交本任务**

在用户允许验证后运行上面的单文件 Vitest 命令，预期所有时间线用例通过。提交仅包含 `lyricTimeline.ts` 和对应测试，提交信息：`feat(viz): model estimated lyric timing`。

### Task 2：建立稳定错落短行布局

**状态**

- [x] 已完成

**Dependencies:** None
**Parallelizable:** Yes（只依赖 Task 1 定义的 `TimedLyricUnit` 时，合并前统一接口；也可先以本任务文件内的最小本地输入类型开发）

- [x] **Step 1：为布局规则写纯函数测试**

在 `lyricLayout.test.ts` 中固定以下行为：相同输入和稳定种子得到完全一致的行分配；短句不会被拆成过多行；长句只在安全区内增加行数或缩字号；横排阅读顺序与原文一致；后置标点不单独换行；中英混排和 emoji 不被切成非法片段；单个拉丁长词在超宽时降字号但不会裁切；窄画布不会让行块越过左右安全边距。执行命令：`npx vitest run src/components/visualization/effects/lyricLayout.test.ts`。仅在用户批准实施并要求验证后执行。

- [x] **Step 2：定义布局接口**

`lyricLayout.ts` 定义 `LyricLayoutOptions`（`maxWidth`、`fontSize`、`fontFamily`、`seed`、`measureText(text, fontSize)`）和 `LyricLayoutItem`（原 `TimedLyricUnit` 加 `x`、`y`、`rowIndex`、最终 `fontSize`、测量宽度），并提供 `layoutLyricUnits(units, options): LyricLayoutItem[]`。文件不得访问 DOM、Canvas 全局状态或 Zustand store。

- [x] **Step 3：实现顺序不变的错落排布**

将歌词组织成 2–5 个视觉短行，按从上到下、每行从左到右推进；只允许稳定的轻微水平偏移，不允许随机重排。根据测量回调把相邻单位放入可用宽度，标点粘连前一单位；布局使用文本、LRC 起点、字体、字号和视口宽度生成稳定种子。短句少行大字，长句增加行数并在安全区内缩小，超长词组按字素拆分后重试。

- [x] **Step 4：验证并提交布局模块**

在用户允许验证后执行 Step 1 命令，预期布局纯逻辑用例通过。提交仅包含 `lyricLayout.ts` 和对应测试，提交信息：`feat(viz): add stable lyric line layout`。

### Task 3：将模型接入 Canvas 融合舞台

**状态**

- [x] 已完成

**Dependencies:** Task 1, Task 2
**Parallelizable:** No（渲染需要同时消费确定性的时间线和布局接口）

- [x] **Step 1：将逐帧状态限定到画布实例**

在 `cinematicLyricDrift.ts` 中以 `WeakMap<CanvasRenderingContext2D, EffectRuntimeState>` 存放逐画布状态。类型最少包含：

```ts
interface EffectRuntimeState {
  songId: string | null;
  lyricsText: string;
  lastReportedMusicTime: number;
  lastAnchorFrameTime: number;
  lastDrawFrameTime: number;
  playbackRate: number;
  lastProjectedMusicTime: number;
  currentGroupIndex: number;
  transitionAlpha: number;
  layoutKey: string;
  visibleLayout: LyricLayoutItem[];
}
```

删除歌词行、进度和过渡的模块级可变单例；八张 256×256 胶片噪点贴图可继续共享，`CanvasPattern` 则按 context 放入 WeakMap，不能由模块变量强引用旧 context。布局缓存只保留当前曲目和有限可见邻接行，换歌/换歌词/字体/字号/视口/DPR 变化时失效，不累积保存整段播放历史。

- [x] **Step 2：修正歌词钟及播放器边界**

读取 audio/player store 的当前歌曲、当前时间、播放状态、播放倍率和可用曲目时长；对时间字段使用 `??` 而不是 `||`，使 `0` 秒保持有效。以 store 时间为锚点，使用 `EffectContext.time` 作为单调 RAF 时钟；播放时按 `playbackRate` 插值，暂停时冻结。暂停或倍率变化时以最新可用投影时间重新锚定，不能回退到 250ms 节流前的旧值；状态切换不重启歌词入场。检测到 seek 或时间回退时立即重建目标行与字素状态并清掉旧方向余辉。切歌或歌词内容更新时重置实例状态；歌词播放中晚到时按当前歌曲时间直接定位，禁止补播错过的行。正常 250ms store 更新不应被误判为 seek。若同一 context 两次绘制间隔超过 250ms（效果切换或页面隐藏恢复），恢复可见时先由 `VisualizationView` 从现有媒体引用刷新时间/时长，再清除过渡余辉并按最新播放时间重建目标帧，避免把离开前的动效续播。

- [x] **Step 3：绘制融合层级**

保留现有径向暗场、四个色斑、胶片纹理和暗角；之后按固定顺序绘制：有限的前后歌词轨迹（每侧最多两条有效行）、一至两束低亮暖色光场、当前 2–5 个错落短行、未唱/活动/唱过三种字素亮度和边缘柔光、最多 18 个稳定种子的微尘。下一组歌词可在最多 1.2 秒预备窗内显出远景，整行位置过渡目标约 1.5 秒，但不得延迟 LRC 行起点；不足 1.5 秒时按剩余窗口压缩过渡。焦点重定向目标约 0.055–0.13 秒并限制在 0.03–0.30 秒；活动字亮起约 0.3 秒，短于此时按实际字素区间缩短，极短行使用组化规则。微尘只在光束附近可见，亮点约 0.15 秒起亮、0.45 秒衰减。间隔超过 0.9 秒时旧句在交接后留低对比轨迹，5.8–8.5 秒的环境轻浮动不影响歌词计时。当前歌词保持唯一阅读焦点。文字层、光束和字素进度由歌曲时间计算；色斑呼吸和微尘位置由 `EffectContext.time` 的时间纯函数计算，不在每帧累积歌词坐标或创建粒子对象。

- [x] **Step 4：处理无歌词与运动偏好**

没有可解析 LRC 时绘制曲名/艺人和低密度环境光；无当前歌曲时只留环境场。曲名不得经 `estimateLineUnits` 生成假歌词。通过缓存的 `window.matchMedia("(prefers-reduced-motion: reduce)")` 状态抑制尘点漂移、周期摆动和强闪；减少动态效果时仍显示当前句和正确的字素时间位置，并以短淡化完成切换。无 `window`、无分析器、零频谱或不支持 `matchMedia` 时保持可绘制，频谱贡献归零。

- [x] **Step 5：保持绘图资源有界并完成效果自检**

每帧不得创建离屏 Canvas、CanvasPattern、无上限缓存或新的粒子集合；即时渐变仅限当前画面需要的少数光束/背景层。所有绘图分支须以 `ctx.save()` / `ctx.restore()` 配对，且退出时恢复 `globalAlpha`、`globalCompositeOperation`、`filter`、`shadowBlur`、文本对齐和变换，避免污染下一个 V8 效果。

- [x] **Step 6：提交 Canvas 整合**

确认时间线、布局、时钟和页面恢复采样接口在效果中使用一致，减少动态模式下歌词直接绘制静止位置，提交 `cinematicLyricDrift.ts` 与 `VisualizationView.tsx`，提交信息：`feat(viz): render layered warm lyrics`。

实现已提交：`7611487`。

### Task 4：修正温光浮字设置显示语义

**状态**

- [x] 已完成

**Dependencies:** None
**Parallelizable:** Yes（局限在设置面板，不改渲染文件）

- [x] **Step 1：核对显示文案与现有真实枚举**

在 `VisualizationSettingsPanel.tsx` 将字体四项文案与效果实际字体顺序对齐：现代极简、经典雅致、清雅文楷、极简几何；将调色板五项文案与实际颜色顺序对齐：深海极光、丝绒暮霭、苍翠玉石、极简黑曜、银河星云。保留设置键名、最小/最大值、步长、默认值和 `updateEffectSettings` 调用形状。

- [x] **Step 2：让滑杆名对应新的视觉用途**

只更新文字标签，不增删设置项：`heroFontSize` 为歌词字号；`shimmerFeather` 表达字缘柔光范围；`fluidSpeed` 仍控制背景色斑漂移；`ambientGlowIntensity` 控制环境/局部光强；`filmGrain` 只代表胶片颗粒；`vignetteStrength` 控制暗角。标签不得暗示设置控制真实词级同步。

- [x] **Step 3：提交设置映射**

检查面板的每个枚举索引和实际数组顺序一致后，仅提交 `VisualizationSettingsPanel.tsx`，提交信息：`fix(viz): align warm lyric setting labels`。

### Task 5：定向验证、浏览器评审与文档收尾

**状态**

- [ ] 部分完成：自动化检查和无曲目待机画面评审通过；真实音频播放评审待有可用播放会话时完成。

**Dependencies:** Task 1, Task 2, Task 3, Task 4
**Parallelizable:** No（需要完整效果后做跨模块回归和视觉验收）

- [x] **Step 1：运行单元、lint 与类型检查**

在用户授权验证后按项目顺序执行：

```powershell
npx vitest run src/components/visualization/effects/lyricTimeline.test.ts src/components/visualization/effects/lyricLayout.test.ts src/components/visualization/effects/lyricPlaybackClock.test.ts
npx eslint src/components/visualization/effects/lyricTimeline.ts src/components/visualization/effects/lyricTimeline.test.ts src/components/visualization/effects/lyricLayout.ts src/components/visualization/effects/lyricLayout.test.ts src/components/visualization/effects/lyricPlaybackClock.ts src/components/visualization/effects/lyricPlaybackClock.test.ts src/components/visualization/effects/cinematicLyricDrift.ts src/components/visualization/VisualizationView.tsx src/components/visualization/VisualizationSettingsPanel.tsx --max-warnings=99999
npx tsc --noEmit --incremental false --pretty false
npx prettier --check docs/nbl/plans/2026-10-11-folia-inspired-lyric-visualizer.md docs/nbl/specs/2026-10-11-folia-inspired-warm-lyrics-design.md docs/nbl/CHANGELOG.md docs/nbl/plans/INDEX.md src/components/visualization/effects/lyricTimeline.ts src/components/visualization/effects/lyricTimeline.test.ts src/components/visualization/effects/lyricLayout.ts src/components/visualization/effects/lyricLayout.test.ts src/components/visualization/effects/lyricPlaybackClock.ts src/components/visualization/effects/lyricPlaybackClock.test.ts src/components/visualization/effects/cinematicLyricDrift.ts src/components/visualization/VisualizationView.tsx src/components/visualization/VisualizationSettingsPanel.tsx
git diff --check
```

预期：新纯逻辑用例通过、变更文件 lint 无新增错误、strict TypeScript 检查通过。若失败，先区分本分支新增问题与已有基线，再修复本分支问题并重跑失败命令。不要并行运行构建与裸 `tsc`。

- [ ] **Step 2：运行生产构建和本地播放画面评审**

在用户授权验证后，类型检查通过后运行 `npm run build`。然后用现有开发环境逐项观察播放、暂停、0.5×/1×/2×倍率、正向/反向 seek、短行密集切换、同时间戳并发歌词、歌词晚到、切歌、无歌词、无歌曲、窄窗口缩放和系统减少动态效果。检查字序、标点、前后句焦点、余辉、末句收尾和后台恢复；记录未执行设备项，不把静态截图或构建通过表述为实时播放性能证据。

执行记录：生产构建成功（生成 28 个静态页面及 API 路由）；本地 3026 生产预览确认“温光浮字”效果入口可选，并确认无当前播放曲目时显示暗色环境光待机画面。预览没有可用音频会话，播放、暂停、0.5×/1×/2×倍率、正反 seek、真实 LRC、切歌、窄屏及系统减少动态效果的浏览器实播检查未执行。浏览器拒绝全屏权限，画面检查在页面内舞台完成；不能据此声称真实播放同步或设备性能通过。只读复审还提示极矮画布（约低于 113 CSS px）且歌词排为五行时可能发生垂直裁切，常规全屏尺寸不受影响。

- [x] **Step 3：更新交付记录并提交完整功能**

只在实现和验证确实完成后更新 `docs/nbl/CHANGELOG.md` 与 `docs/nbl/plans/INDEX.md`。确认 Home/Player/全屏歌词和歌曲持久化结构没有进入 diff，工作区保留所有用户既有改动。单独提交文档收尾，提交信息：`docs(viz): record warm lyric visualizer delivery`。合并、推送或创建 PR 需按用户后续明确指示执行。

## 4. 验收矩阵

| 维度           | 验收条件                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| 时间线         | 活动行依据 LRC 起点；估算字素段不越过下一严格更晚行起点；末句有界；同刻并发文本稳定并保持源顺序。    |
| 同步状态       | 暂停冻结；0.5×/1×/2×随音乐时间插值；seek/反向 seek 立即重建；切歌/换歌词不显示旧行；迟到歌词不补播。 |
| 排版           | 2–5 个稳定错落短行；CJK、拉丁词、混排、标点、emoji、短句、长句和窄视口均不裁切、不乱序。             |
| 舞台层级       | 当前句优先于近景轨迹、局部光束、背景色斑；光束和微尘数量受限；无歌词只显示元数据和氛围。             |
| 可访问运动偏好 | 开启减少动态效果后，歌词时钟及可读性保留，尘点漂移/强闪/周期摆动受抑制。                             |
| 兼容性         | 效果 ID、所有既有设置键与值域、播放器行为、歌词字段和本地持久化格式不变。                            |
| 资源边界       | 画布状态按 context 隔离；缓存、CanvasPattern、噪点纹理和微尘数量有固定上限；每帧不构建无界对象。     |
| 保护范围       | Home View、Player View、全屏歌词文件、歌曲/播放 store 与持久化 schema 不出现在改动列表中。           |

## 5. 依赖关系与执行方式

任务依赖层级：`Task 1`、`Task 2`、`Task 4` 可分别推进；`Task 3` 等待 Task 1 和 Task 2；`Task 5` 等待全部任务。此实现跨纯算法、Canvas 渲染与设置映射多个文件，不能按简单 inline 变更处理。建议先并行完成 Task 1、Task 2、Task 4，再由单一负责人串行整合 Task 3 和 Task 5。

规格覆盖自查：目标、三种 Folia 视觉语言融合、行内估算和无歌词回退映射到 Task 1–3；暂停/倍率/seek/反向 seek/迟到歌词/同刻行/末句映射到 Task 1 和 Task 3；字体、调色板及现有滑杆含义映射到 Task 4；缓存、DPR、资源上限、减少动态效果、页面隐藏与保护文件映射到 Task 3 和 Task 5。未发现规格要求遗漏。计划不声称任何实现或验证已经完成。

---

**Execution Mode:** parallel（独立的时间线、布局和设置任务可并行；Canvas 整合与最终验证依赖前序结果）
