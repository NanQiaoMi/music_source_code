# 播放动态同步与非线性转场 — 实施计划

> - **状态：** 待执行（用户已审阅并认可设计稿；本计划不代表开始代码实施）
> - **设计依据：** [播放动态同步与非线性转场设计](../specs/2026-10-11-player-playback-motion-sync-design.md)
> - **基线：** `b818db6`
> - **工作分支：** `docs/player-playback-motion-sync`（实施时另建 `feature/player-playback-motion-sync`）

## 目标

修复主媒体时钟、歌词/进度/控件状态、切歌竞态和音频响应动效之间的不同步；让播放态由当前媒体元素的真实事件确认；使用现有 AudioEngine 分析器驱动克制、平滑的光晕/胶囊频谱；保留截图布局和已有持久化格式。

## 架构与约束

- `HTMLAudioElement.currentTime` 是唯一时间真源。
- 新增非持久化播放运行时状态和共享时钟；原 `audio-store-v4`、`player-store` 的 key、现有序列化字段保持不变。
- legacy store 继续接收低频兼容快照；帧级进度只由主播放器/浮动胶囊订阅共享时钟，不把 60Hz 数据写入 Zustand persist。
- 播放请求、加载/缓冲、真实播放、暂停和错误使用不同运行时阶段；只有当前请求、当前活动音源的 `playing` 事件能进入 `playing`。
- UI 动效使用 Framer Motion 弹簧或有界指数平滑；时间轴本身直接采样媒体时钟，不使用缓动追赶。
- 保留 `PlayerView.tsx`、Home View、`FullscreenLyrics.tsx` 和 `LyricVisualizer.tsx` 核心边界。主视图 `Player3D.tsx` 的切歌动画单独受第 5 项决策门控制，不能通过全局 CSS/DOM 注入绕过。
- 实施前重新检查当前分支、`git status`、`AGENTS.md`、测试基线和音频元素主/副 deck 关系；不清理或覆盖已有工作。

## 任务依赖

```text
Task 0 边界/基线确认
   ├── Task 1 真实播放态与请求代次
   │      └── Task 2 共享媒体时钟
   │             ├── Task 3 浮动胶囊进度与音频响应
   │             └── Task 4 胶囊转场和微交互
   └── Task 5 主视图动效决策门（需符合项目规则）
Task 1–5 完成后 → Task 6 集成验证与文档收尾
```

任务 1 和任务 2 必须按顺序完成，以免时钟订阅在播放状态契约尚未稳定时接入；任务 3/4 共用胶囊组件，建议串行实施。主视图可在不触及受保护核心时独立评估，否则暂停该项等待明确授权。

---

### Task 0：基线与主视图扩展边界复核

**依赖：** 无
**并行：** 否
**产出：** 实施记录中的基线和主视图决策

- [ ] **Step 1：确认工作区与规则**

  检查分支、`git status --short --branch`、最近提交和项目 `AGENTS.md`；确认当前运行的开发服务器来自哪个 checkout，避免清理或重启用户正在使用的实例。

- [ ] **Step 2：确认媒体元素所有权**

  阅读 `src/hooks/useAudioPlayer.ts`、`src/context/AudioElementContext.tsx`、`src/lib/audio/CrossfadeMixer.ts`，记录主/副 deck 建立、交换、卸载和 listener 附着点。确认 generation 应在哪个入口递增，且只有当前活动 deck 写共享时钟。

- [ ] **Step 3：确认主视图许可边界**

  查找 `PlayerView`/`Player3D` 已有的扩展点、共享子组件或由非核心层配置的 motion props。若能在不修改 `PlayerView.tsx`、`Player3D.tsx`、歌词核心的情况下接入，记录接入文件和节点。若找不到，保持 Task 5 阻塞，提交计划中的其余核心安全任务；编码前请用户选择最小范围授权 `Player3D.tsx` 或把本轮限定为胶囊动效。

- [ ] **Step 4：记录验证基线**

  对将要涉及的 store/hook/UI 测试和 lint/build 记录已有失败，不在这一步大范围修复历史问题。

---

### Task 1：建立真实播放态与过期请求保护

**依赖：** Task 0
**并行：** 否
**产出：** 一个非持久化的 confirmed playback phase 和可测试的请求代次判断

**计划文件：**

- 新建 `src/lib/audio/playbackStateMachine.ts`
- 新建 `src/lib/audio/playbackStateMachine.test.ts`
- 新建 `src/store/playbackRuntimeStore.ts`
- 新建 `src/store/playbackRuntimeStore.test.ts`
- 修改 `src/store/audioStore.ts`
- 修改 `src/store/playerStore.ts`
- 修改 `src/hooks/useAudioPlayer.ts`

- [ ] **Step 1：实现纯状态转换**

  定义 `idle | loading | playing | buffering | paused | ended | error` 运行时阶段、请求 generation、目标曲目身份和活动音源身份。编写纯转换函数：过期 generation、非活动 deck、错误 `currentSrc` 的事件返回原状态；`play`/`loadstart` 不得将阶段推进为 `playing`。

- [ ] **Step 2：实现非持久化运行时 store**

  暴露当前阶段、request generation、target/active identities 和最小动作。该 store 不使用 persist middleware；分析器节点、音源对象不放入响应式状态，只在外部模块中持有引用。

- [ ] **Step 3：调整 store action 语义**

  `playSong`、`playQueue`、`nextSong`、`prevSong` 仍立即更新目标曲目信息和 loading，但不再乐观地把真实 `isPlaying` 置 true。审计 `setIsPlaying(true/false)` 的全部调用点，区分播放请求、暂停请求和媒体确认；加载期间的重复播放点击必须幂等。保留旧 store 字段、key 和持久化 schema。

- [ ] **Step 4：接入媒体事件与 generation 校验**

  在 `useAudioPlayer.ts` 中接入 request id（现有 `_playbackRequestIdRef` 占位），为加载、`playing`、`waiting/stalled`、`pause`、`ended`、`error` 与 `play()` Promise 结果添加当前请求/活动音源检查。只有当前音源的真实 `playing` 事件写 `isPlaying=true`；旧事件及旧 Promise 结果不写 store、不触发旧歌 toast。

- [ ] **Step 5：统一双 store 的播放镜像**

  明确单向状态同步入口，消除胶囊以 `audioIsPlaying || playerIsPlaying` 猜播放态的必要性；同 ID 曲目 metadata/source 更新也要同步。保持外部依赖 `audioStore`/`playerStore` 的现有字段可读。

- [ ] **Step 6：运行窄范围验证**

  ```powershell
  npm run test -- --run src/lib/audio/playbackStateMachine.test.ts src/store/playbackRuntimeStore.test.ts
  npx eslint src/lib/audio/playbackStateMachine.ts src/store/playbackRuntimeStore.ts src/store/audioStore.ts src/store/playerStore.ts src/hooks/useAudioPlayer.ts
  ```

  覆盖：真实 `playing` 才确认播放、连续切歌旧事件被丢弃、旧 reject 不覆盖最新状态、重复点击幂等、缓冲/错误/结束状态、同 ID metadata 更新及持久化快照兼容。

---

### Task 2：新增共享媒体时钟与低频 store 兼容桥

**依赖：** Task 1
**并行：** 否
**产出：** 一个 media element 驱动、可订阅、可停止的非持久化时间源

**计划文件：**

- 新建 `src/lib/audio/PlaybackClock.ts`
- 新建 `src/lib/audio/PlaybackClock.test.ts`
- 新建 `src/hooks/usePlaybackClock.ts`
- 修改 `src/hooks/useAudioPlayer.ts`
- 修改 `src/store/audioStore.ts`、`src/store/playerStore.ts`（仅时钟桥需要时）

- [ ] **Step 1：实现时钟快照和订阅 API**

  提供稳定 `getSnapshot/subscribe/attach/detach/resync` API；snapshot 至少有 `currentTime`、有效 `duration`、`playbackRate`、活动音源/generation 与阶段。时钟不维护自增秒数，所有校正都读取活动 `HTMLAudioElement`。

- [ ] **Step 2：实现事件校正和唯一帧循环**

  `playing` 时按订阅需求启动至多一个 RAF；暂停、缓冲、页面隐藏或无高频订阅者时停止。处理 seek/rate/duration/source/end/error/visibility 恢复；对 `NaN`、`Infinity`、0 duration、live、seek 过程中读取异常做有限值保护。

- [ ] **Step 3：接入 active deck 所有权**

  主/副 audio element 切换时显式 attach 当前 owner；副 deck 只预备或参与 crossfade 时不得覆盖主时钟。切换 owner 时从新媒体元素立即重读，不在两个 deck 之间插值时间。

- [ ] **Step 4：提供 React 订阅 hook 和兼容桥**

  `usePlaybackClock` 通过 React 外部 store 订阅同一个 snapshot。`useAudioPlayer` 的 `timeupdate` 仍执行 AB loop/预取逻辑；兼容的 `audioStore.currentTime`/`playerStore.currentTime` 按现有节流写入，并在 seek/pause/ended/source change 立即对齐。高频 snapshot 不触发 persist store 写盘。

- [ ] **Step 5：运行时钟验证**

  ```powershell
  npm run test -- --run src/lib/audio/PlaybackClock.test.ts
  npx eslint src/lib/audio/PlaybackClock.ts src/hooks/usePlaybackClock.ts src/hooks/useAudioPlayer.ts
  ```

  覆盖：播放/暂停/seek/变速/缓冲/结束/隐藏恢复、一个 RAF 生命周期、卸载清理、deck 切换、无效 duration、旧 generation 不发布、兼容快照不超过设计节流频率。

---

### Task 3：把胶囊进度与音频分析接到共享时钟

**依赖：** Task 2
**并行：** 否
**产出：** 浮动胶囊进度准确追随媒体、歌词预览读取共同时间源、频谱基于现有 analyser 平滑变化

**计划文件：**

- 新建 `src/lib/audio/AudioReactiveSampler.ts`
- 新建 `src/lib/audio/AudioReactiveSampler.test.ts`
- 修改 `src/components/player/floating/FloatingCompactControlsState.tsx`
- 修改 `src/components/player/floating/FloatingProgressScrubber.tsx`
- 修改 `src/components/player/floating/FloatingOneLineLyricPreview.tsx`
- 修改 `src/components/player/floating/FloatingSpectrumGlow.tsx`
- 视现有结构按需修改 `src/components/player/floating/FloatingExpandedState.tsx`

- [ ] **Step 1：实现共享分析器平滑器**

  通过现有 `getAudioAnalyser` 读取频带/响度快照；实现纯 attack/release 平滑和 noise-floor/范围映射。无 AudioContext、无 analyser、非 playing 或 suspended 时输出安静 fallback。不要创建新的 AudioContext/AnalyserNode。

- [ ] **Step 2：复用采样结果**

  将当前 `FloatingSpectrumGlow` 的数据采样接到共享平滑结果，避免它与主视图/胶囊各读一套不同归一化。若组件可视化循环仍需保留，只允许它负责绘制，不复制分析器节点或状态。

- [ ] **Step 3：对齐胶囊的播放状态和时间**

  胶囊改读 playback runtime confirmed phase 和 `usePlaybackClock`；删除 OR 合并猜测。进度填充、时间码、单行歌词索引使用同一 snapshot；只有显示值跟随时钟，不向 clock 回写。暂停/缓冲立刻停止动态并停准媒体位置。

- [ ] **Step 4：限制视觉强度**

  将光晕/柱高限制在设计稿范围；连续频谱用有界非线性滤波，曲目切换用小位移短弹簧。保留可点区域、拖动和 seek 手势，transform/opacity 优先，避免触发布局计算。

- [ ] **Step 5：运行胶囊与平滑器测试**

  ```powershell
  npm run test -- --run src/lib/audio/AudioReactiveSampler.test.ts src/components/player/floating/FloatingVisualAndAudioModules.test.tsx src/components/player/floating/FloatingVisualAndMicroInteractions.test.tsx
  npx eslint src/lib/audio/AudioReactiveSampler.ts src/components/player/floating/FloatingCompactControlsState.tsx src/components/player/floating/FloatingProgressScrubber.tsx src/components/player/floating/FloatingOneLineLyricPreview.tsx src/components/player/floating/FloatingSpectrumGlow.tsx
  ```

  验证无分析器降级、attack/release 无突跳、播放态不误亮、进度与时钟一致、seek/拖动保持可用、reduced motion 下停止连续视觉响应。

---

### Task 4：浮动胶囊切歌和微交互

**依赖：** Task 3
**并行：** 否
**产出：** 保留位置/尺寸/布局但有清楚、短促、受状态驱动的转场

**计划文件：**

- 修改 `src/components/player/FloatingPlayer.tsx`
- 修改 `src/components/player/floating/FloatingCompactControlsState.tsx`
- 修改 `src/components/player/floating/FloatingProgressScrubber.tsx`
- 视测试结构更新 `src/components/player/floating/FloatingVisualAndMicroInteractions.test.tsx`

- [ ] **Step 1：设计曲目身份切换动画**

  以 request generation/track identity 驱动标题、封面和辅助文本切换；快速切歌时取消前一段进入动画，只保留最新目标。先显示新目标和 loading，再由 confirmed `playing` 完成播放态动画。

- [ ] **Step 2：统一弹簧参数并支持减少动态**

  使用小位移、高阻尼、短收束；不要用线性动画或无限呼吸替代真实播放态。使用 `useReducedMotion` 关闭位移/缩放/频谱弹跳，保留立即可见的按钮、loading、错误状态。

- [ ] **Step 3：验证交互竞态**

  浏览器检查拖动胶囊、展开/收起、连续 next、seek 时动画取消与手势互不抢占；胶囊始终只有一个实例，不产生旧标题短暂闪回。

---

### Task 5：主播放器切歌转场（受保护文件决策门）

**依赖：** Task 0 和 Task 3
**并行：** 可以与 Task 4 分开评估；未解除门槛前不得改受保护文件
**产出：** 主播放器仅在项目规则允许的接入方式下完成转场

**候选文件：** `src/components/player/Player3D.tsx`；不得修改 `src/components/layout/PlayerView.tsx`、`src/components/lyrics/LyricVisualizer.tsx`、`src/components/lyrics/FullscreenLyrics.tsx`。

- [ ] **Step 1：按 Task 0 结果检查扩展点**

  如果找到规则允许的 motion 插槽/可替换子组件，在扩展点中接入共享 clock、confirmed playback phase 和目标曲目 generation；主视图歌词仍使用当前共同 store 快照，不重写 lyric 核心。

- [ ] **Step 2：如果只能直接改 `Player3D.tsx`，停止该子任务**

  不用全局选择器、DOM 查找/注入、CSS 旁路或修改 PlayerView 来达成相同效果。先向用户呈现最小改动路径与精确文件，再由用户明确授权后继续。没有授权时，本轮交付 shared clock + 胶囊动画，主视图保留原转场。

- [ ] **Step 3：获准后实现主视图动效**

  若用户明确解除 `Player3D.tsx` 保护，仅修改封面/标题/专辑信息的曲目切换包裹与呼吸动效数据源；不改布局、歌词核心、队列和控制逻辑。封面 aura 只读取共享 analyzer snapshot；非 playing 状态停止呼吸。

- [ ] **Step 4：验证 reduced motion 和快速切歌**

  检查首次打开、加载失败、连续 next、上一曲、暂停/缓冲/恢复、减少动态；任何旧曲退场都不能遮盖最新曲目或拦截控件点击。

---

### Task 6：集成回归、性能和文档收尾

**依赖：** Task 1–4；Task 5 若获准则纳入
**并行：** 否
**产出：** 已验证分支、变更文档、明确的运行时证据

- [ ] **Step 1：运行相关测试**

  ```powershell
  npm run test -- --run src/lib/audio/playbackStateMachine.test.ts src/store/playbackRuntimeStore.test.ts src/lib/audio/PlaybackClock.test.ts src/lib/audio/AudioReactiveSampler.test.ts
  ```

  再执行涉及的浮动播放器、store 和 hook 测试。不得把被动等待、无退出码或进程中断记录为通过。

- [ ] **Step 2：运行静态检查和生产构建**

  ```powershell
  npx eslint src/lib/audio/playbackStateMachine.ts src/lib/audio/playbackStateMachine.test.ts src/store/playbackRuntimeStore.ts src/store/playbackRuntimeStore.test.ts src/lib/audio/PlaybackClock.ts src/lib/audio/PlaybackClock.test.ts src/hooks/usePlaybackClock.ts src/lib/audio/AudioReactiveSampler.ts src/lib/audio/AudioReactiveSampler.test.ts src/store/audioStore.ts src/store/playerStore.ts src/hooks/useAudioPlayer.ts src/components/player/floating/FloatingCompactControlsState.tsx src/components/player/floating/FloatingProgressScrubber.tsx src/components/player/floating/FloatingOneLineLyricPreview.tsx src/components/player/floating/FloatingSpectrumGlow.tsx src/components/player/FloatingPlayer.tsx
  npx tsc --noEmit
  npm run build
  ```

  若已有基线错误，按文件/命令对比并说明；任何新增错误必须先修复。检查持久化 key/schema 未变。

- [ ] **Step 3：浏览器手工验收**

  使用隔离端口启动工作分支，验证真实本地音源和可控慢网络音源：首播等待、真实起播、暂停、缓冲、连续 5 次切歌、seek、变速、跨淡入、后台/前台恢复、无 analyser fallback 和 reduced motion。记录媒体时钟与 UI 读数差、播放态事件时序、错误和帧率；不能用静态截图代替运行态证据。

- [ ] **Step 4：检查性能与存储边界**

  确认只有一个共享媒体时钟 RAF；没有每帧 `audioStore`/`playerStore` 持久化写入；空闲/暂停/隐藏时 RAF 与 analyser 采样停止；没有重复 AudioContext/AnalyserNode。

- [ ] **Step 5：更新文档与交付记录**

  实施完成后更新设计稿的决策结果，记录实际涉及文件、测试/构建/浏览器结果、未执行项和受保护主视图是否获准。提交使用 `feat(audio): synchronize playback state and clock`、`feat(player): add restrained track transitions` 等清晰提交说明；按项目 Git 流程完成分支验证与本地合并，不推送或创建 PR，除非用户另行要求。

## 验收清单

- [ ] 主媒体时钟是所有视图的共同时间源，seek/变速/后台恢复后重对齐。
- [ ] 点击播放到真实 `playing` 之间只有加载态；所有控件的 confirmed playback phase 一致。
- [ ] 过期的音源事件、Promise 和副 deck 不会覆盖最新目标曲。
- [ ] 高频进度不写入持久化 store；localStorage key 和已有字段结构保持兼容。
- [ ] 浮动胶囊切歌/按钮反馈采用短收束的非线性动画，reduced motion 正常。
- [ ] 音频响应复用当前 analyser，平滑、有界且缺失时静态降级。
- [ ] 主视图动画遵守 PlayerView 核心文件边界；若需改 `Player3D.tsx`，已有明确授权记录。
- [ ] 相关测试、lint、TypeScript/build 和运行时验收逐项记录真实退出码/证据。

## 执行模式

本计划为顺序依赖较强的音频状态/时钟改动，默认单工作分支逐任务实施；先由用户选择开始执行，再使用 `nbl.executing-plans`。只有用户明确要求并行或技能规则适用时，才将纯模块任务拆给子智能体；store、hook、事件所有权不可并发改写。当前回合只产出计划，不执行上述代码步骤、不运行测试。
