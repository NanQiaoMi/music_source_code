# 播放动态同步与非线性转场 — 实施计划

> - **状态：** 核心安全范围已实施；主播放器 `Player3D.tsx` 转场仍受保护门约束，真实音源验收待执行
> - **设计依据：** [播放动态同步与非线性转场设计](../specs/2026-10-11-player-playback-motion-sync-design.md)
> - **基线：** `b818db6`
> - **工作分支：** `feature/player-playback-motion-sync`（从 `06bccd8` 创建）

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
Task 1–4 → Task 6 集成验证与文档收尾（Task 5 获准后纳入）
```

任务 1 和任务 2 必须按顺序完成，以免时钟订阅在播放状态契约尚未稳定时接入；任务 3/4 共用胶囊组件，建议串行实施。主视图可在不触及受保护核心时独立评估，否则暂停该项等待明确授权。

---

### Task 0：基线与主视图扩展边界复核

**依赖：** 无
**并行：** 否
**产出：** 实施记录中的基线和主视图决策

- [x] **Step 1：确认工作区与规则**

  检查分支、`git status --short --branch`、最近提交和项目 `AGENTS.md`；确认当前运行的开发服务器来自哪个 checkout，避免清理或重启用户正在使用的实例。

- [x] **Step 2：确认媒体元素所有权**

  阅读 `src/hooks/useAudioPlayer.ts`、`src/context/AudioElementContext.tsx`、`src/lib/audio/CrossfadeMixer.ts`，记录主/副 deck 建立、交换、卸载和 listener 附着点。确认 generation 应在哪个入口递增，且只有当前活动 deck 写共享时钟。

- [x] **Step 3：确认主视图许可边界**

  查找 `PlayerView`/`Player3D` 已有的扩展点、共享子组件或由非核心层配置的 motion props。若能在不修改 `PlayerView.tsx`、`Player3D.tsx`、歌词核心的情况下接入，记录接入文件和节点。若找不到，保持 Task 5 阻塞，提交计划中的其余核心安全任务；编码前请用户选择最小范围授权 `Player3D.tsx` 或把本轮限定为胶囊动效。

- [x] **Step 4：记录验证基线**

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

- [x] **Step 1：实现纯状态转换**

  定义 `idle | loading | playing | buffering | paused | ended | error` 运行时阶段、请求 generation、目标曲目身份和活动音源身份。编写纯转换函数：过期 generation、非活动 deck、错误 `currentSrc` 的事件返回原状态；`play`/`loadstart` 不得将阶段推进为 `playing`。

- [x] **Step 2：实现非持久化运行时 store**

  暴露当前阶段、request generation、target/active identities 和最小动作。该 store 不使用 persist middleware；分析器节点、音源对象不放入响应式状态，只在外部模块中持有引用。

- [x] **Step 3：调整 store action 语义**

  `playSong`、`playQueue`、`nextSong`、`prevSong` 仍立即更新目标曲目信息和 loading，但不再乐观地把真实 `isPlaying` 置 true。审计 `setIsPlaying(true/false)` 的全部调用点，区分播放请求、暂停请求和媒体确认；加载期间的重复播放点击必须幂等。保留旧 store 字段、key 和持久化 schema。

- [x] **Step 4：接入媒体事件与 generation 校验**

  在 `useAudioPlayer.ts` 中接入 request id（现有 `_playbackRequestIdRef` 占位），为加载、`playing`、`waiting/stalled`、`pause`、`ended`、`error` 与 `play()` Promise 结果添加当前请求/活动音源检查。只有当前音源的真实 `playing` 事件写 `isPlaying=true`；旧事件及旧 Promise 结果不写 store、不触发旧歌 toast。

- [x] **Step 5：统一双 store 的播放镜像**

  明确单向状态同步入口，消除胶囊以 `audioIsPlaying || playerIsPlaying` 猜播放态的必要性；同 ID 曲目 metadata/source 更新也要同步。保持外部依赖 `audioStore`/`playerStore` 的现有字段可读。

- [x] **Step 6：运行窄范围验证**

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

- [x] **Step 1：实现时钟快照和订阅 API**

  提供稳定 `getSnapshot/subscribe/attach/detach/resync` API；snapshot 至少有 `currentTime`、有效 `duration`、`playbackRate`、活动音源/generation 与阶段。时钟不维护自增秒数，所有校正都读取活动 `HTMLAudioElement`。

- [x] **Step 2：实现事件校正和唯一帧循环**

  `playing` 时按订阅需求启动至多一个 RAF；暂停、缓冲、页面隐藏或无高频订阅者时停止。处理 seek/rate/duration/source/end/error/visibility 恢复；对 `NaN`、`Infinity`、0 duration、live、seek 过程中读取异常做有限值保护。

- [x] **Step 3：接入 active deck 所有权**

  主/副 audio element 切换时显式 attach 当前 owner；副 deck 只预备或参与 crossfade 时不得覆盖主时钟。切换 owner 时从新媒体元素立即重读，不在两个 deck 之间插值时间。

- [x] **Step 4：提供 React 订阅 hook 和兼容桥**

  `usePlaybackClock` 通过 React 外部 store 订阅同一个 snapshot。`useAudioPlayer` 的 `timeupdate` 仍执行 AB loop/预取逻辑；兼容的 `audioStore.currentTime`/`playerStore.currentTime` 按现有节流写入，并在 seek/pause/ended/source change 立即对齐。高频 snapshot 不触发 persist store 写盘。

- [x] **Step 5：运行时钟验证**

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

- 新建 `src/lib/audio/audioMotionSmoothing.ts`
- 新建 `src/lib/audio/audioMotionSmoothing.test.ts`
- 修改 `src/components/player/floating/FloatingCompactControlsState.tsx`
- 修改 `src/components/player/floating/FloatingProgressScrubber.tsx`
- 修改 `src/components/player/floating/FloatingOneLineLyricPreview.tsx`
- 修改 `src/components/player/floating/FloatingSpectrumGlow.tsx`
- 视现有结构按需修改 `src/components/player/floating/FloatingExpandedState.tsx`

- [x] **Step 1：实现 attack/release 平滑器**

  通过现有 `getAudioAnalyser` 读取频带/响度快照；实现纯 attack/release 平滑和 noise-floor/范围映射。无 AudioContext、无 analyser、非 playing 或 suspended 时输出安静 fallback。不要创建新的 AudioContext/AnalyserNode。

- [x] **Step 2：复用现有分析器读取路径**

  将当前 `FloatingSpectrumGlow` 的数据采样接到共享平滑结果，避免它与主视图/胶囊各读一套不同归一化。若组件可视化循环仍需保留，只允许它负责绘制，不复制分析器节点或状态。

- [x] **Step 3：对齐胶囊的播放状态和时间**

  胶囊改读 playback runtime confirmed phase 和 `usePlaybackClock`；删除 OR 合并猜测。进度填充、时间码、单行歌词索引使用同一 snapshot；只有显示值跟随时钟，不向 clock 回写。暂停/缓冲立刻停止动态并停准媒体位置。

- [x] **Step 4：限制视觉强度**

  将光晕/柱高限制在设计稿范围；连续频谱用有界非线性滤波，曲目切换用小位移短弹簧。保留可点区域、拖动和 seek 手势，transform/opacity 优先，避免触发布局计算。

- [x] **Step 5：运行胶囊与平滑器测试**

  ```powershell
  npm run test -- --run src/lib/audio/audioMotionSmoothing.test.ts src/components/player/floating/FloatingVisualAndAudioModules.test.tsx src/components/player/floating/FloatingVisualAndMicroInteractions.test.tsx
  npx eslint src/lib/audio/audioMotionSmoothing.ts src/components/player/floating/FloatingCompactControlsState.tsx src/components/player/floating/FloatingProgressScrubber.tsx src/components/player/floating/FloatingOneLineLyricPreview.tsx src/components/player/floating/FloatingSpectrumGlow.tsx
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

- [x] **Step 1：设计曲目身份切换动画**

  以 request generation/track identity 驱动标题、封面和辅助文本切换；快速切歌时取消前一段进入动画，只保留最新目标。先显示新目标和 loading，再由 confirmed `playing` 完成播放态动画。

- [x] **Step 2：统一弹簧参数并支持减少动态**

  使用小位移、高阻尼、短收束；不要用线性动画或无限呼吸替代真实播放态。使用 `useReducedMotion` 关闭位移/缩放/频谱弹跳，保留立即可见的按钮、loading、错误状态。

- [ ] **Step 3：验证交互竞态**

  组件级测试通过；浏览器当前未加载音源，拖动、seek 和连续切歌的实际媒体交互尚未验收。

  浏览器检查拖动胶囊、展开/收起、连续 next、seek 时动画取消与手势互不抢占；胶囊始终只有一个实例，不产生旧标题短暂闪回。

---

### Task 5：主播放器切歌转场（受保护文件决策门）

**依赖：** Task 0 和 Task 3
**并行：** 可以与 Task 4 分开评估；未解除门槛前不得改受保护文件
**产出：** 主播放器仅在项目规则允许的接入方式下完成转场

**候选文件：** `src/components/player/Player3D.tsx`；不得修改 `src/components/layout/PlayerView.tsx`、`src/components/lyrics/LyricVisualizer.tsx`、`src/components/lyrics/FullscreenLyrics.tsx`。

- [x] **Step 1：按 Task 0 结果检查扩展点**

  如果找到规则允许的 motion 插槽/可替换子组件，在扩展点中接入共享 clock、confirmed playback phase 和目标曲目 generation；主视图歌词仍使用当前共同 store 快照，不重写 lyric 核心。

- [x] **Step 2：如果只能直接改 `Player3D.tsx`，停止该子任务**

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

- [x] **Step 1：运行相关测试**

  ```powershell
  npm run test -- --run src/lib/audio/playbackStateMachine.test.ts src/store/playbackRuntimeStore.test.ts src/lib/audio/PlaybackClock.test.ts src/lib/audio/audioMotionSmoothing.test.ts src/lib/audio/playbackMediaEventGuard.test.ts src/lib/audio/CrossfadeMixer.test.ts src/store/audioStore.test.ts src/store/playerStore.test.ts src/hooks/useAudioPlayer.test.ts src/components/player/floating/FloatingVisualAndAudioModules.test.tsx src/components/player/floating/FloatingVisualAndMicroInteractions.test.tsx
  ```

  再执行涉及的浮动播放器、store 和 hook 测试。新增覆盖同一 deck/source 上与实时媒体状态不一致的排队事件、快速切歌后旧 crossfade timer、加载期间取消播放意图。不得把被动等待、无退出码或进程中断记录为通过。

- [x] **Step 2：运行静态检查和生产构建**

  ```powershell
  $changedFiles = @((git diff --name-only)) + @((git ls-files --others --exclude-standard))
  $sourceFiles = @($changedFiles | Where-Object { $_ -match '\.(ts|tsx)$' })
  npx eslint $sourceFiles
  npx tsc --noEmit
  npm run build
  ```

  若已有基线错误，按文件/命令对比并说明；任何新增错误必须先修复。检查持久化 key/schema 未变。

- [ ] **Step 3：浏览器手工验收**

  使用隔离端口启动工作分支，验证真实本地音源和可控慢网络音源：首播等待、真实起播、暂停、缓冲、连续 5 次切歌、seek、变速、跨淡入、后台/前台恢复、无 analyser fallback 和 reduced motion。记录媒体时钟与 UI 读数差、播放态事件时序、错误和帧率；不能用静态截图代替运行态证据。

- [x] **Step 4：检查性能与存储边界**

  确认只有一个共享媒体时钟 RAF；没有每帧 `audioStore`/`playerStore` 持久化写入；空闲/暂停/隐藏时 RAF 与 analyser 采样停止；没有重复 AudioContext/AnalyserNode。

- [x] **Step 5：更新文档与交付记录**

  实施记录已更新实际改动、测试/构建/浏览器结果、未执行项和受保护主视图边界。提交与本地合并遵循项目 Git 流程；不推送或创建 PR，除非用户另行要求。

## 验收清单

- [x] 主媒体时钟是所有可接入视图的共同时间源；seek/变速/后台恢复由媒体事件重对齐，legacy store 仍按 250ms 兼容节流更新。
- [x] 点击播放到真实 `playing` 之间只有加载态；胶囊读取 runtime confirmed phase。
- [x] 过期的音源事件、Promise 和非活动 deck 由 request/deck/source 身份门控。
- [x] 高频进度不写入持久化 store；localStorage key 与序列化字段未修改。
- [x] 浮动胶囊切歌/按钮反馈采用短收束的非线性动画，支持 reduced motion。
- [x] 音频响应复用现有 analyser，按帧间隔做 attack/release 平滑；无 analyser 时静态衰减。
- [ ] 主播放器 `Player3D.tsx` 转场：无规则允许的外部 motion 插槽；等待明确解除文件保护。
- [ ] 真实音源下的首播/暂停/缓冲/连续切歌/seek/跨淡入/后台恢复验收；当前仅完成页面 HTTP 200 与组件级检查。
- [x] 相关单测、lint、TypeScript 和生产构建已记录退出码；页面运行检查部分完成。

## 执行模式

本计划为顺序依赖较强的音频状态/时钟改动，按单工作分支顺序执行。Task 1–4 的核心安全实现已完成；Task 5 和真实音源浏览器验收仍待完成。store、hook、事件所有权不可并发改写。

## 实施记录（2026-10-12）

- 工作分支：`feature/player-playback-motion-sync`，基线 `06bccd8`。
- 新增纯播放状态机、非持久化 `playbackRuntimeStore`、media element 驱动的 `PlaybackClock`、`usePlaybackClock` 和帧率无关的 attack/release 平滑器。
- 音频 hook 以 request generation、活动 deck 和规范化 source 过滤事件与异步结果；play/pause/loading 由 intent 与媒体确认分离。兼容 store 继续约 250ms 更新进度，未更改持久化 schema。
- 浮动胶囊复用现有 `FloatingSpectrumGlow`/AudioEngine analyser；封面、曲名、歌词行和播放控件使用短阻尼弹簧。无 analyser 与 reduced motion 时静态衰减。
- 复核后补强：媒体事件先校验元素的实时 paused/ended/readyState/error，再进入 generation/deck/source 状态机；源归属接受请求 `src` 或浏览器最终 `currentSrc`，兼容重定向。CrossfadeMixer 按 deck generation 管理增益曲线：待播请求过期时只清理仍归它所有的 deck；直接播放接管时取消旧曲线并复位增益；暂停时同步停掉并复位两张 deck，避免连续切歌或暂停后静音、旧歌残响。交叉淡入从 `play()` 实际确认后的 AudioContext 时间开始，慢源等待不会消耗缓动时间；延迟清理前同样校验 deck 所有权。统一 `audioStore.togglePlaybackIntent()`，让非受保护的活跃按钮、Space 快捷键、推荐面板和 AI toggle 在 loading 期依据最新意图反转，不会读取尚未确认的 `isPlaying` 来重复播放。加载态主栏仍可点击以取消待播。
- 动画复核：曲名改为同步进退场，最新目标不等旧标题退出；胶囊主按钮在 `prefers-reduced-motion` 下关闭 hover/tap 缩放。保留小位移、高阻尼 spring 和现有布局。
- 自动化验证：11 个文件、87 项测试通过且无未处理错误；全部已改 TypeScript/TSX 文件 ESLint 通过；`npx tsc --noEmit` 通过；最新代码的 `npm run build` 通过。均在 `D:\26project\music_source_code_V1.1_full\_codex_player_sync_verify` 的同盘 detached 验证工作树执行，因为 C 盘 managed worktree 的 `node_modules` 联接会令 Next/Webpack 把 D 盘绝对路径误解为相对模块路径。构建仅提示 Browserslist 数据已 6 个月未更新。
- 页面验证：隔离工作树生产服务器运行于 `http://127.0.0.1:3027`，浏览器确认 Next 页面加载并显示“曲库暂无音乐”；当前没有可播放曲目，因此真实媒体起播、暂停/缓冲、连续切歌、seek、crossfade、后台恢复和动态频谱仍未验收。页面加载只证明生产页面可访问。
- 未修改 `PlayerView.tsx`、`Player3D.tsx`、`LyricVisualizer.tsx`、`FullscreenLyrics.tsx`。主视图没有发现允许的外部动效插槽；如要完成截图主播放器转场，需要用户明确授权对 `Player3D.tsx` 做限定改动。另需加载可控本地音源后完成运行态验收。
- `Player3D.tsx` 与 Home 主视图的 `MusicCardStack` 仍按旧视图状态决定主按钮重复点击语义；它们属于受保护主视图路径，本轮未改。共享时钟可通过 250ms 兼容桥更新这些视图，精细转场仅接入浮动胶囊；若要求受保护主视图的按钮也能在 loading 阶段取消待播，需要先明确其受保护文件的授权范围。
- `FloatingSpectrumGlow` 遇到不具备 `createLinearGradient` 的部分 Canvas 2D context 时会停止该动效循环，避免在 jsdom/受限 WebView 上产生未处理 RAF 异常。
