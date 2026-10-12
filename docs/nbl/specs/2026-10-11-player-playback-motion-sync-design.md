# 播放动态同步与非线性转场设计

> - 状态：设计稿已按用户审阅意见通过（2026-10-11）；2026-10-12 用户确认按最小范围实施 Player3D 动效
> - 日期：2026-10-11
> - 基线：`b818db6`（当前稳定提交；文档分支从该提交建立）
> - 需求来源：用户对播放同步、真实播放态、音频响应、布局和转场的六轮确认

## 1. 目标与范围

在保留截图现有布局的前提下，统一音频、进度、歌词和各播放控件使用的时间与播放状态；修复快速切歌、慢音源、缓冲和异步媒体事件造成的旧状态覆盖；为截图中的主播放器和浮动胶囊增加克制、收束快的非线性转场与微交互。封面光晕/胶囊频谱优先复用当前 AudioEngine 分析器，并对响度和频谱变化做平滑。

已确认的体验要求：

- 共享媒体时钟作为所有现有视图的时间基准；不让不同组件各自推算播放时间。
- 新曲目标信息立即显示并进入加载态；只有收到当前目标音源的真实 `playing` 事件后，播放动效和播放图标才显示为播放中。
- 快速连续切歌时，最新请求拥有 UI；旧请求的 `playing`、`waiting`、错误和完成事件不能覆盖它。
- 保留封面、歌词、底部控制栏、左侧浮动胶囊的布局；动效限于主播放器和胶囊，不改全屏歌词的视觉动效。
- 切歌/切页采用小幅位移、快速收束的阻尼弹簧；不让进度条通过弹簧追赶真实时间。
- 不新增节拍检测或第二套音频分析器；减少动态强度，不改变本地持久化数据格式。

## 2. 当前实现与可验证事实

| 观察 | 代码证据 | 设计含义 |
| --- | --- | --- |
| 媒体时间来自 HTMLAudioElement 的 `currentTime`，`timeupdate` 写入两个 store 的频率被限制为约 4Hz。 | `src/hooks/useAudioPlayer.ts` 的 `onTimeUpdate`，约第 294–310 行 | 媒体元素应继续作为权威时钟；高频显示不能通过 60Hz 写入两个持久化 store 来实现。 |
| 两个 store 的持久化都包含 `currentTime`；每次 Zustand 状态写入会触发 persist 序列化/存储。 | `src/store/audioStore.ts`、`src/store/playerStore.ts` 的 `partialize` | 高分辨率时钟应是运行时、非持久化数据；保留现有 key 与序列化字段。 |
| 切歌的 store action 会先把 `isPlaying` 置为 `true` 并置 `isLoading`，早于对应音源确认播放。 | `src/store/audioStore.ts` 的 play/next/playQueue action（约第 390–658 行）；媒体 `playing` 监听在 `src/hooks/useAudioPlayer.ts` | 将“请求播放”与“真实正在播放”分成不同语义；加载不能触发播放动效。 |
| 胶囊将两个 store 的播放状态用 OR 合并，并优先用 audioStore 曲目。 | `src/components/player/floating/FloatingCompactControlsState.tsx` 约第 114–120 行 | 双 store 暂时不一致时 OR 会保留过期的播放中状态；控件需改读规范化播放快照。 |
| Player3D 的封面/背景包含固定循环呼吸动画；现有内容进入动画主要是首次挂载时播放。 | `src/components/player/Player3D.tsx` 约第 121–145、231–285、373–404 行 | 需要依据真实播放态和曲目身份驱动有限的状态转场，避免固定循环假装音乐响应。 |
| PlayerView 本身配置了弹簧过场，但切离时同时立即设置 isibility: hidden，可能让退出动画不可见。 | src/components/layout/PlayerView.tsx 约第 25–43 行 | 页面切换现象要先区分曲目转场和视图退出；该核心文件仍受保护，不直接修改。 |
| 频谱组件已经读取共享音频分析器；共享 getter 与 AudioEngine 已存在。 | `src/components/player/floating/FloatingSpectrumGlow.tsx`、`src/hooks/useAudioPlayer.ts` 第 1488–1489 行、`src/lib/audio/AudioVisualizerManager.ts` | 优先抽取或复用当前分析数据读取，不创建并行 AudioContext/AnalyserNode。 |
| 歌词视图读取共享 store 的 `currentTime`；跨淡入使用主/副音源。 | `src/components/lyrics/LyricVisualizer.tsx`；`src/hooks/useAudioPlayer.ts` 的双音源引用 | 所有视图对齐同一媒体时钟；副 deck 和旧曲事件不得写入当前曲目的时钟。 |

以上是代码静态观察，不等同于已经复现或测量了运行时卡顿。实际误差、浏览器音源差异和切歌竞态需要在实施验收时用运行时日志测量。

## 3. 设计方案

### 3.1 单一媒体时钟与低频兼容快照

1. 当前激活的 HTMLMediaElement 是时间唯一真源。`currentTime`、`duration`、`playbackRate`、`paused`、`readyState` 和 `currentSrc` 从它读取；不根据 `Date.now()` 自行累计时间作为真相。
2. 新增轻量运行时 `PlaybackClock`（名称可在实现阶段按现有命名约定调整），维护活动音源身份、请求代次和最近的媒体快照。播放期间最多使用一个共享 `requestAnimationFrame` 采样循环，并让可视进度订阅者读取该快照；暂停、缓冲、页面隐藏或无订阅者时停止循环。
3. 时钟由 `playing`、`pause`、`waiting`、`seeking`、`seeked`、`ratechange`、`durationchange`、`loadedmetadata`、`ended`、`error`、音源切换及页面恢复事件校正。恢复前后台页面时直接重读媒体元素，绝不补算被浏览器节流的帧。
4. 所有现有视图仍使用同一个时钟源。兼容层把一致的时间快照同步到现有 audioStore/playerStore 字段，沿用目前受控的低频写入节奏并在 seek/pause/ended/切歌等关键点立即写入；主播放器和胶囊可从同一个非持久化时钟取帧级进度与动效采样；歌词和其他兼容视图读取由该时钟同步出的同一低频快照，不各自累计时间。这样避免两个 persist store 每帧 JSON 序列化。
5. 同一曲目发生 seek、变速或 duration 更新时重置插值基准；duration 为 `NaN`、`Infinity`、0 或 live source 时不产生除零、负进度或虚假的结束时间。
6. AB 循环、预取仍以媒体元素的真实 `currentTime` 判断，不改播放语义。

### 3.2 播放请求和真实播放状态

运行时状态使用明确的阶段语义：

| 阶段 | UI 表现 | 允许进入条件 |
| --- | --- | --- |
| `idle` | 无曲目/静止 | 初始化、清空曲目 |
| `loading` | 显示最新请求曲目与加载指示；播放图标保持未播放 | 新请求开始、尚未收到当前音源 `playing` |
| `playing` | 播放控件、歌词时钟、音频响应动效同步运行 | 当前请求、当前活动音源触发 `playing` 且媒体未暂停 |
| `buffering` | 保留当前曲目信息；停止/衰减响应动效，保留准确的媒体位置 | 活动音源在播放意图期间触发 `waiting`/`stalled` |
| `paused` | 静止；进度停在媒体元素位置 | 当前活动音源确认暂停，或用户暂停且媒体暂停完成 |
| `ended` | 依现有队列/循环规则处理 | 当前活动音源触发 `ended` |
| `error` | 停止播放动效，显示现有错误反馈 | 当前请求加载/播放失败且错误未过期 |

每个播放/切歌操作分配单调递增的 request generation。媒体监听器除检查事件目标外，还要检查 generation、活动 deck 和 `currentSrc`；同曲不同源、重复 id、旧副 deck 事件同样不能穿透。过期的 Promise reject、`playing`、`waiting`、`ended` 和错误一律忽略。

UI 的目标曲目与媒体当前活动曲目需要可区分：请求开始后标题/封面立即对应最新目标并显示加载；媒体确认开始后将其标记为当前活动曲。对慢源失败时保留最新目标信息并显示错误，不能伪造播放成功或悄悄回退到前一个请求。播放按钮点击代表用户意图，语义状态仍以媒体事件确认；等待 `playing` 的窗口内提供加载反馈和可再次取消/暂停的确定行为。

### 3.3 非线性动效编排

动效只附着于离散交互/状态变化；持续播放进度直接追随共享时钟，避免 easing 造成字幕、时间码、进度条互相漂移。

| 场景 | 动效 | 建议边界 |
| --- | --- | --- |
| 切歌封面 | 旧封面轻微缩小/淡出，新封面淡入并回弹收束 | 位移 6–10px；缩放最多约 1.5%；弹簧目标 180–320ms 内收束 |
| 标题/歌手/专辑信息 | 交叉淡变，短距离纵向错位；先标题、后辅助信息 | 单项错开 25–45ms；避免整块大幅飞入 |
| 加载→播放 | loading 指示淡出，真实播放图标/光晕弹簧淡入 | 仅响应当前请求真实 `playing`，加载期间不启动呼吸循环 |
| 播放/暂停 | 图标轻微缩放与交叉淡变；光晕快速收束 | 以 confirmed phase 为终态；减少运动时直接换态 |
| 主视图/胶囊 hover、favorite、seek | 轻量按压回弹/颜色过渡 | 不移动布局、不抢拖动/滑杆手势 |
| 页面切换 | 保持现有视图布局与导航语义，微调出入场速度/曲线 | 受保护视图仅经允许的扩展点；不能直接修改受保护核心文件 |

优先使用现有 Framer Motion 弹簧配置习惯：阻尼较高、轻微回弹、小位移、短收束；避免通用线性 timing。数值需在浏览器视觉验收中调整，不把表格中的建议值当作最终定标。尊重 `prefers-reduced-motion`：去掉位移、缩放、连续光晕和频谱弹跳，保留必要的状态/颜色变化。

### 3.4 音频响应光晕与胶囊波形

- 从现有 AnalyserNode 在一个共享采样循环读取低/中频能量与整体响度，做噪声门、0–1 归一化及有时间常数的 attack/release 平滑；根据帧间隔计算平滑，避免设备帧率影响感觉。
- 映射限制在很小的视觉范围：封面光晕透明度/模糊度轻微变化，封面缩放建议不超过 1.012；胶囊波形/柱高度只做柔和起伏，不改变胶囊布局与点击区域。
- 可复用 `FloatingSpectrumGlow` 的分析器读取逻辑；如其渲染循环与共享时钟冲突，先抽出纯数据采样/平滑单元，再让显示层各自绘制。不要重复创建 AudioContext，也不要由 UI 随机数生成“假频谱”。
- `AudioContext` 不存在、暂停、被挂起或跨域音源无法提供有效分析数据时，退回静态低亮度，不阻断音频播放。buffering 时将强度快速衰减到静止，避免旧频谱继续跳动。

## 4. 持久化、边界与兼容约束

- 保持 `audio-store-v4`、`player-store` 的 key、现有持久化字段和曲目数据结构兼容；request generation、活动 deck、阶段细分和分析器缓存只放内存，不持久化，不迁移 localStorage/IndexedDB。
- 保留两个 store 的兼容字段，但限定一个规范写入方向；每次时间快照不得触发两个 store 的双向回写循环。禁止每帧持久化。
- 覆盖：连续快切、同 id 不同 metadata/source、play Promise reject、自动播放被浏览器拒绝、`waiting/stalled`、seek 与切歌竞争、`ended` 与手动 next 同时到达、跨淡入副 deck、缺封面、无 duration/live stream、页面后台恢复、AudioContext suspended、减少动态偏好。
- 对用户播放意图与播放成功分开记录；任何未知/过期事件都不能把 UI 推进到 `playing`。

## 5. 文件边界和规则冲突

项目规则明确禁止直接改 V7 Home View、Player View 和全屏歌词核心。当前截图主视图的实际装配链是 `src/components/layout/PlayerView.tsx → src/components/player/Player3D.tsx`；歌词组件为 `src/components/lyrics/LyricVisualizer.tsx`，全屏歌词为 `src/components/lyrics/FullscreenLyrics.tsx`。因此：

- 时钟/媒体状态设计优先落在音频 hook、AudioEngine 周边及运行时 clock adapter；现有 store 字段作为兼容快照。
- 浮动胶囊范围在 `src/components/player/FloatingPlayer.tsx` 和 `src/components/player/floating/*`，可在不改 PlayerView/全屏歌词核心前提下实现。
- 歌词同步通过共同时间源和原有 store 兼容接口改善，不在本设计中重构歌词视图；全屏歌词不增加本地动效。
- 截图主视图的切歌编排需要作用到 `Player3D`，但 `Player3D` 是受保护 PlayerView 的子树。实施计划应先查明项目认可的外部 extension point；如果不存在，主视图动画部分必须在编码前由用户明确选择“授权对 Player3D 做最小范围修改”或“本轮只做胶囊动画”。不得以改全局 CSS/DOM 注入绕开禁令。

这是设计约束，不是已经获得的核心视图修改许可。用户对动效范围的确认支持计划目标，但不自动解除上述文件保护规则。

## 6. 验收指标与验证顺序

### 体验验收

1. 点击播放但尚无真实 `playing` 事件时，最新目标曲显示加载；播放按钮与动态光晕不进入播放态。
2. 当前音源开始播放后，主视图与胶囊的播放/暂停状态来自同一 confirmed phase；不存在两个 store 一真一假时由 OR 显示错误状态。
3. 主视图、胶囊、歌词和其余现有时间消费者来自同一媒体时钟；活跃进度显示相对 `HTMLMediaElement.currentTime` 的误差目标不超过一帧，非高频兼容视图看到的是同一快照，不出现分叉累计时间。
4. 连续快速切换时最终停留在最后一个目标曲；之前音源晚到的 `playing`/错误/缓冲事件不改变最新目标曲的 UI。
5. seek、变速、暂停、缓冲、结束、后台恢复都与媒体元素重新对齐；不出现进度倒退、时间码错配或恢复后追赶动画。
6. 切歌转场小幅、非线性、快速收束；频谱随真实音源平滑变化但幅度克制；无分析器时安静降级。
7. 开启减少动态时无持续呼吸/频谱跳动，按钮仍有清晰状态反馈。
8. 现有 localStorage key 和字段结构不变；时间更新不会以显示帧率写盘。

### 实施时验证

- 先增加/调整针对状态 reducer、时钟事件、generation 过期事件、边界时长及双 store 兼容的单元/组件测试；本次设计阶段不运行测试。
- 再运行项目 lint、相关 Vitest、TypeScript/build；记录当前基线问题与新增问题边界。
- 最后在浏览器中验证真实音频起播/暂停/缓冲/连续切歌/seek/后台恢复/减少动态，记录媒体 `currentTime` 与 UI 快照误差和频谱帧率。没有设备或真实慢源时须明确标记未执行，不能把静态构建当作播放验收。

## 7. 非目标

不重新设计截图布局；不重写队列、推荐、播放器整套架构；不新增 beat detector、额外音频图或第三方动画库；不触碰全屏歌词核心、不修改持久化 schema；不把 UI 动效当作音频时间源；不声称当前运行时问题已被复现。

## 8. 审阅结论与实施前决策

- 用户已确认共享时钟分层和整体体验方向，按本稿继续编制实施计划。
- 设计审阅阶段，用户尚未授权直接修改受保护的 `Player3D.tsx`；随后用户确认按最小范围完成。授权仅覆盖截图主界面的封面/曲目信息转场、confirmed-playing 音频响应和播放意图反馈，不覆盖布局重构、歌词核心、队列或 `PlayerView.tsx`。
- 验收目标作为实施起点；实际浏览器误差和性能阈值需要根据运行设备测量后记录，不据此宣称已经通过。

实施计划按可独立验证的阶段推进：先完成音频状态/时钟，再完成浮动胶囊；主视图转场按第 5 节边界执行。
