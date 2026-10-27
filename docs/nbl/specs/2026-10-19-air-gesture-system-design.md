# 2026-10-19 隔空手势系统设计与修复规格（Air Gesture System Design）

> Status: 已实施；自动化测试 / 严格 TS / 生产构建 / 开发态 HTTP 与 Chrome CDP 冒烟通过。真实摄像头与多设备手工验收待用户执行（checklist 见 §13.3）。实施记录见 plans/2026-10-19-air-gesture-system-repair.md
> Audit baseline: branch feature/gesture-air-control-overhaul, base commit c73a872
> Scope: 手势识别、指针桥、HUD/反馈 UI、设置与持久化、本地模型资产、测试与验证
> 约束: 不修改 V7 核心视图（Home View / Player View / 全屏歌词）的布局与信息结构；不破坏现有 localStorage / IndexedDB 数据格式。

---

## 1. 文档目的

现有“隔空手势”是 V7 遗留实现：单文件 568 行的 GestureController 同时承担模型加载、摄像头、识别、指针合成、快捷键与 HUD 渲染，存在**方向反了、点击/拖拽不可靠、切换骨骼会重启摄像头、断网完全不可用、错误无反馈、类型与 UI 宣称不一致**等问题，且没有任何自动化测试。

本文档给出两件事：

1. **彻底修复**现状缺陷的工程方案（可追溯到具体文件/行号与测试）。
2. **重新设计**一套合理、可解释、可调参、可测试的隔空手势语言与交互系统。

---

## 2. 现状审计

### 2.1 代码地图（改动前）

| 文件 | 行数 | 现状 |
| --- | --- | --- |
| src/components/interaction/GestureController.tsx | 568 | 单体控制器：模型、摄像头、识别、指针事件、快捷键、HUD 全在一起 |
| src/components/interaction/GestureFeedback.tsx | 206 | 音量/倍速/爱心/进度预览面板；**除 seek preview 外没有任何代码设置这些开关** |
| src/store/gestureStore.ts | 119 | 未持久化；GestureType 包含 14 种手势，其中 12 种从未实现 |
| src/hooks/useHandGesture.ts | 129 | 另一套识别逻辑（fist/swipe），**全仓库 0 个引用** |
| src/components/widgets/VirtualCursor.tsx | 47 | 只在 src/app/page.tsx:148 挂载，/data-manager 等路由无光标 |
| src/components/layout/AppleUnifiedNavIsland.tsx | 620 | 仅有一个开关按钮（:103, :539-542, :586-592），无任何设置入口 |
| src/components/layout/GlobalClientComponents.tsx | 59 | 全局挂载 Controller + Feedback（:53-54） |
| 测试 | 0 | 手势相关 0 个测试；visualInteractionStores.test.ts 只断言旧字段 |

### 2.2 缺陷清单（按严重度）

| ID | 严重度 | 现象 | 代码证据 | 影响 |
| --- | --- | --- | --- | --- |
| G-01 | P0 | 滑动方向与光标方向相反：光标做了 1-x 镜像，滑动却直接用原始 wrist.x 判断 dx<0 ? swipe_left | GestureController.tsx:230-245（光标镜像）、:126-165（滑动未镜像） | 用户向左挥手可能切到上一首，与屏幕所见相反 |
| G-02 | P0 | 点击序列不完整：只派发 pointerdown/up/move，不派发 mousedown/mouseup/mousemove，且 move 无 buttons | GestureController.tsx:198-218 | 只监听 onMouseDown 的拖拽（FloatingPlayer 等）完全失效；拖拽状态无按钮信息 |
| G-03 | P0 | 切换“骨骼/摄像头”会重启整个摄像头和模型 | GestureController.tsx:495 把 showSkeleton 放进初始化 effect deps；:441-471 cleanup 会 stop 摄像头并 close 模型 | 点一下按钮黑屏 1-3 秒，反复申请摄像头权限，状态丢失 |
| G-04 | P0 | 外部 CDN 强依赖：WASM 用 @latest，模型用 Google Storage | :342, :353 | 断网/被墙/离线打包后手势直接不可用；@latest 可能和 package 版本不匹配 |
| G-05 | P0 | 失败无用户反馈：错误只 console.error，UI 停在“初始化失败 ✗”且无重试 | :449-455 | 用户无法区分“没权限/没摄像头/模型下载失败/不安全上下文” |
| G-06 | P1 | 手势总开关开启后，输入框里打 c/s/g 会切换摄像头/骨骼/关闭手势 | :318-329 全局 keydown，无 input/textarea 守卫 | 搜索、歌词编辑、重命名等输入场景被破坏；Escape 也冲突 |
| G-07 | P1 | 捏合阈值是绝对像素比例，不随手掌尺度/镜头远近归一化 | :74-75 PINCH_THRESHOLD=0.06 | 远手永远捏不上、近手一直误触 |
| G-08 | P1 | 滑动判定只看腕点、窗口/时间窗混乱；任意姿态（握拳/捏合）都会触发 | :126-165, :276 | 误切歌；慢速滑动永远不触发；快速抖动误触 |
| G-09 | P1 | 每帧 elementFromPoint + 每帧 store set，无节流/可见性暂停 | :198-218, :256-260 | 强制布局抖动、后台标签页仍占用摄像头与推理 |
| G-10 | P1 | 手部丢失 600ms 才清理；拖拽中断只补 pointerup 不补 pointercancel，可能卡住拖拽 | :419-434 | 拖拽悬挂、UI 卡在按下态 |
| G-11 | P1 | 手势方向/命令从未在 UI 说明清楚；HUD 文案乱码（"ر"、" HandLandmarker..."、" ?"） | :347, :392, :528 | 用户不知道能做什么；乱码显得功能未完成 |
| G-12 | P2 | gestureStore 的 12 种手势、4 个反馈面板是死代码，开发者无法判断哪些可用 | gestureStore.ts:9-18,31-39；GestureFeedback.tsx:29-206 | 维护误导；未来接入时容易重复实现 |
| G-13 | P2 | 设置不持久化、无设置面板、无摄像头设备选择、无灵敏度/校准 | gestureStore.ts:69-77 无 persist | 每次刷新重新开启；不同摄像头/光线无法调 |
| G-14 | P2 | HUD 固定右上 208px、z-9999、无 safe-area/移动端适配，与导航岛重叠 | :500-560 | 移动端/小屏遮挡核心 UI |
| G-15 | P2 | 手写 HandLandmarkerInstance 接口、LegacyAny、未使用变量 _getGestureActions | :35-49, :83, useHandGesture.ts | 类型不安全，MediaPipe 升级易静默失败 |
| G-16 | P2 | 无可见性/权限/设备拔出处理；track 结束后无感知 | :373-389 只 catch 初次请求 | 摄像头被占用/拔出后 UI 仍显示“运行中” |
| G-17 | P2 | React StrictMode 下 effect 双执行可能与异步 init 竞争（无 generation token） | :310-498 | 开发环境可能出现重复流/重复模型，偶发状态错乱 |
| G-18 | P2 | 无任何手势测试，改动无回归保护 | — | 任何重构都可能悄悄破坏点击/切歌 |

### 2.3 宣称 vs 实现

| 渠道 | 宣称 | 实际 |
| --- | --- | --- |
| 快捷提示（HUD） | “捏合=点击 · 挥手=切歌” | 点击在部分组件失效；挥手方向反；拖拽不可用 |
| GestureFeedback | 音量面板、倍速面板、爱心、进度预览 | 从未被触发（无可达代码设置开关） |
| gestureStore.GestureType | pinch/fist/swipe/volume/speed/heart/circle/wave/seek | 只实现 pinch/click/swipe |
| 导航岛 | “隔空手势控制” | 只有开关，无任何引导/设置/错误提示 |

### 2.4 修复前基线

- npx tsc --noEmit --incremental false --pretty false：通过（0 error）。
- 手势相关测试：0。
- 依赖：@mediapipe/tasks-vision ^0.10.34、@mediapipe/hands、@mediapipe/camera_utils（后两者为 V7 遗留，未被使用）。
- public/ 下无 MediaPipe 资产；模型 7.8MB 每次运行都要从 Google Storage 下载。

---

## 3. 目标与非目标

### 3.1 目标（Definition of Done 摘要）

1. **可用**：捏合点击、捏合拖拽、双击、张开手掌四向滑动、握拳停顿，全部在真实摄像头下可复现；指针事件同时兼容 pointer/mouse 两类组件。
2. **方向正确**：手势语义以“用户看到的镜像画面”为唯一屏幕坐标；滑动方向与光标方向一致，并有单元测试锁死。
3. **离线可用**：本地 WASM + 本地模型优先，CDN 仅作兜底；Electron 打包后不依赖外网。
4. **可诊断**：权限拒绝、无摄像头、设备占用、不安全上下文、模型失败都有中文错误态 + 重试/去设置入口；HUD 显示 FPS/姿态/捏合比等诊断。
5. **可调**：灵敏度、平滑度、音量步进、摄像头设备、命令绑定、显示开关均持久化，刷新后保留。
6. **可测**：识别引擎纯函数/纯类单测；指针桥 jsdom 事件测试；tracker 回退链 mock 测试；store/UI 静态渲染测试；无摄像头环境可用调试桥做端到端冒烟。
7. **不退化**：不修改核心视图结构；鼠标/键盘/触摸路径完全不受影响；关闭手势时零摄像头、零推理、零全局监听。

### 3.2 非目标

- 不做双手手势、不做隔空滚动/缩放（MVP 之后扩展）。
- 不做心形/圆圈/点赞等识别稳定性差的复杂手势（保留扩展点，不进入 UI）。
- 不做端侧模型训练或云端推理。
- 不重构 audioStore（仅通过公开 action 调用）。
- 不新增 npm 依赖（复用现有 @mediapipe/tasks-vision）。

---

## 4. 设计原则

1. **一个事实源**：手势定义/动作定义/默认绑定只存在于 src/lib/gesture/types.ts。
2. **纯核心**：识别引擎不依赖 React/DOM/Zustand/MediaPipe；可在 Node/jsdom 中确定性测试。
3. **姿态消歧**：手指姿态决定交互模式（食指=指针，张掌=命令，握拳=停顿），从根上解决“移动光标”和“挥手切歌”互相误触。
4. **时间驱动**：所有判定基于传入 timestamp，可回放、无 Date.now 隐藏依赖；滤波使用 One Euro 适配不同 FPS。
5. **本地优先**：资产本地、推理本地、不录制、不上传，HUD 明确隐私说明。
6. **失败可见**：每个失败分支映射到 GestureErrorCode + 中文文案 + 可操作按钮。
7. **弱动作可逆**：默认只绑定播放/切歌/音量/暂停等可逆动作；不绑定删除/关闭页面等破坏性操作。

---

## 5. 手势语言设计

### 5.1 姿态（每帧分类，带滞后稳定）

| 姿态 | 判定（归一化后） | 用途 |
| --- | --- | --- |
| point | 食指伸展，且中指/无名指/小指中至少 2 指收拢；拇指未与食指捏合 | 指针模式：移动光标 |
| pinch（与姿态正交） | dist(拇指尖4, 食指尖8) / handScale < pinchEnterRatio；退出用更大的 pinchExitRatio | 点击/拖拽 |
| open_palm | 5 指中至少 4 指伸展，且拇指-食指距离 > 捏合退出阈值 | 命令模式：四向滑动 |
| fist | 食指/中指/无名指/小指全部收拢 | 停顿命令：播放/暂停 |

- handScale = dist(landmark0 腕, landmark9 中指MCP)，用于抵消镜头远近与手大小差异。
- 姿态切换需要稳定 postureHoldMs（默认 90ms），避免 point↔open_palm 抖动。
- 优先级：**pinch > fist > point > open_palm > unknown**；捏合一旦成立则锁定到松开，期间不切换姿态。

### 5.2 命令手势（可绑定）

| 命令 ID | 姿态 | 判定 | 默认动作 | 冷却 |
| --- | --- | --- | --- | --- |
| swipe_left | open_palm | 屏幕 dx < 0，|dx| ≥ swipeMinDistance，速度 ≥ swipeMinVelocity，|dx| > dominance·|dy| | 下一首 | 700ms + 手势重新武装 |
| swipe_right | open_palm | dx > 0，同上 | 上一首 | 同上 |
| swipe_up | open_palm | 屏幕 dy < 0，|dy| > dominance·|dx| | 音量 + | 同上 |
| swipe_down | open_palm | dy > 0，同上 | 音量 − | 同上 |
| fist_hold | fist | 保持握拳 dwellMs（默认 650ms），HUD/光标显示进度环 | 播放/暂停 | 触发后需松手重装填 |

**方向定义（唯一权威）**：屏幕坐标 x 向右、y 向下；mirror=true 时 screenX = 1 - rawX（与光标一致）。因此用户看到手向屏幕左侧移动 = swipe_left。CDN/摄像头原生镜像差异全部收敛在 mirrorAndMapPoint 一处。

### 5.3 指针语义

| 交互 | 触发 | 事件序列 |
| --- | --- | --- |
| 移动 | point 模式 / pinch 模式 | pointermove + mousemove（hover 目标变化时补 over/enter/out/leave） |
| 单击 | pinch 按下→松开，时长 < 420ms 且位移 < 0.012 | pointerdown/mousedown → pointerup/mouseup → click（down/up 最近公共祖先） |
| 双击 | 320ms 内第二次单击 | 第二次 click 后追加 dblclick |
| 拖拽 | pinch 按住期间移动 > 0.012 | down 后持续 move（buttons=1），松开只 pointerup/mouseup，不 click |
| 中断 | 丢手 / 关闭手势 / 切后台 | pointercancel + pointerup，不 click |

### 5.4 手势-动作默认绑定

| 命令 | 动作 | 可改为 |
| --- | --- | --- |
| 左滑 | next_track | 上一首/音量/播放暂停/静音/快进快退/歌词/不绑定 |
| 右滑 | prev_track | 同上 |
| 上滑 | volume_up | 同上 |
| 下滑 | volume_down | 同上 |
| 握拳停顿 | toggle_play | 同上 |

### 5.5 冲突消解

| 冲突 | 规则 |
| --- | --- |
| 移动光标 vs 挥手切歌 | 由姿态分离：食指=移动，张掌=命令；张掌时不移动光标 |
| 捏合 vs 挥手 | 捏合优先且锁定；张掌状态下不开启捏合（需回到 point 姿态） |
| 捏合点击 vs 拖拽 | 位移阈值 + 时长阈值；移动超过容差则升级为拖拽，松开不 click |
| 连续命令 vs 误触 | 单命令冷却 700ms；滑动后必须离开张掌姿态才重新武装；握拳必须松手 |
| 手势 vs 鼠标/键盘 | 手势模式只“叠加”虚拟指针；真实鼠标键盘仍可用；HUD 可一键关闭 |
| 手势 vs 页面原生触摸 | 合成事件 pointerType=mouse；不修改页面 touch-action |

---

## 6. 系统架构

### 6.1 分层

~~~mermaid
flowchart TD
  subgraph Device["设备层（可替换/可 mock）"]
    CAM[camera.ts<br/>getUserMedia / 设备枚举 / 错误映射]
    TRK[tracker.ts<br/>MediaPipe HandLandmarker<br/>本地 → CDN / GPU → CPU]
  end
  subgraph Core["纯核心（无 React/DOM）"]
    LM[landmarks.ts<br/>尺度归一化 / 姿态特征]
    FLT[filters.ts<br/>One Euro]
    ENG[engine.ts<br/>状态机 / 捏合 / 滑动 / dwell]
  end
  subgraph Bridge["DOM 层"]
    PB[pointerBridge.ts<br/>pointer+mouse 事件合成]
  end
  subgraph State["状态层"]
    SET[gestureSettingsStore<br/>persist]
    RUN[gestureStore<br/>runtime]
  end
  subgraph Act["动作层"]
    ACT[actions.ts<br/>播放/音量/歌词]
  end
  subgraph UI["UI 层"]
    CTL[GestureController<br/>useGestureSession]
    HUD[GestureHUD]
    CUR[VirtualCursor]
    FB[GestureFeedback]
    ST[GestureSettings]
  end
  CAM --> CTL
  TRK --> CTL
  CTL --> ENG
  ENG --> LM
  ENG --> FLT
  ENG --> PB
  ENG --> ACT
  ENG --> RUN
  SET --> CTL
  RUN --> HUD
  RUN --> CUR
  RUN --> FB
  SET --> HUD
  SET --> ST
  RUN --> ST
  ACT -->|audioStore / uiStore| Audio[(播放状态)]
~~~

### 6.2 模块职责

| 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| types.ts | 类型、常量、手势/动作定义、默认设置、tuning 换算、数据校验 | 不做识别、不读 store |
| filters.ts | One Euro 滤波 | 不接触 DOM |
| landmarks.ts | 几何特征、姿态分类、镜像/区域映射 | 不做状态机 |
| engine.ts | 帧级状态机、指针/命令/ dwell 事件 | 不做 I/O、不派发 DOM 事件 |
| camera.ts | 摄像头能力检测、请求、设备枚举、错误分类 | 不碰模型 |
| tracker.ts | MediaPipe 加载/回退/推理/释放 | 不碰 UI |
| pointerBridge.ts | 事件合成、hover、click/drag/dblclick | 不决定手势语义 |
| actions.ts | 命令→播放/UI 动作；边界反馈 | 不碰识别 |
| gestureSettingsStore.ts | 持久化偏好、绑定、sanitize/merge | 不存高频运行时 |
| gestureStore.ts | 运行时状态、反馈事件 seq | 不持久化 |
| useGestureSession.ts | 串联设备/引擎/桥/动作/store；生命周期 | 不渲染 UI |
| GestureController.tsx | 启用开关、会话、快捷键、挂载 HUD/Cursor/Feedback | 不写识别算法 |
| GestureHUD.tsx | 预览、状态、错误、显示开关 | 不直接开摄像头 |
| VirtualCursor.tsx | 光标/捏合/dwell 圆环 | 不处理事件 |
| GestureFeedback.tsx | 动作 toast、音量条、播放徽标 | 不执行业务动作 |
| GestureSettings.tsx | 设置面板 | 不直接启动会话 |

### 6.3 帧流水线

~~~text
requestVideoFrameCallback / rAF（≤30fps，页面隐藏时暂停）
  → tracker.detect(video, timestamp)            // 失败：状态置 error，不吞异常
  → isGestureLandmarks 校验
  → engine.processFrame(landmarks|null, timestamp)
      → landmarks: 镜像/映射/尺度归一化/姿态滞后
      → filters: One Euro 平滑光标
      → 事件流：pointer_move/down/up + command + dwell + tracking
  → session:
      pointer_* → pointerBridge（moveTo/press/release/cancel）
      command   → 绑定表 → actions.execute → runtime.pushEvent
      dwell     → runtime.setDwell
  → runtime store（光标 30fps 上限；只在值变化时 set）
~~~

### 6.4 状态边界

- **settings**：用户偏好，持久化到 localStorage["mimi-gesture-settings-v1"]；变更频率低。
- **runtime**：camera/model/hand/cursor/mode/dwell/feedback；不持久化；关闭时整体 reset。
- 分离原因：光标每帧更新不能触发 persist 序列化；同时避免“刷新后还显示上一帧光标”。

---

## 7. 识别引擎设计

### 7.1 几何特征

~~~text
handScale      = max(ε, dist(L0, L9))                    // 腕 → 中指MCP
pinchRatio     = dist(L4, L8) / handScale                // 拇指尖 → 食指尖
extended(f)    = dist(f.tip, L0) / dist(f.mcp, L0) > 1.25 // 指尖离腕明显更远
palmOpenness   = 伸展手指数 / 5                           // 0-1，HUD 诊断
palmCenter     = 平均(L0, L5, L9, L13, L17)              // 滑动采样点（比腕点稳）
~~~

所有距离先按 handScale 归一化，因此同一姿态在 30cm/80cm 处阈值一致。

### 7.2 One Euro 滤波

~~~text
dx = (x - prevX) / dt
edx = lowpass(dx, alpha(dCutoff))
cutoff = minCutoff + beta * |edx|
xHat = lowpass(x, alpha(cutoff))
~~~

- minCutoff 由“指针平滑度”设置映射（0.45–3.2Hz）；beta 固定 0.02。
- 丢手超过 handLostGraceMs 后重置滤波器，避免手回来时光标瞬移。
- 单测覆盖：阶跃收敛、噪声抑制、dt=0/负数不产生 NaN。

### 7.3 姿态分类与滞后

~~~ts
rawPosture = pinch ? "pinch"
  : fist ? "fist"
  : point ? "point"
  : openPalm ? "open_palm"
  : "unknown"
// 稳定姿态：rawPosture 连续保持 postureHoldMs 才切换
~~~

- 捏合状态单独维护，使用 pinchEnterRatio / pinchExitRatio 双阈值。
- 只有稳定姿态为 point（或已在 pinch/drag 中）才允许开始捏合。

### 7.4 交互模式状态机

~~~mermaid
stateDiagram-v2
  [*] --> idle
  idle --> pointer: 稳定 point 姿态
  idle --> palm: 稳定 open_palm
  idle --> fist: 稳定 fist
  pointer --> pinch: pinchEnter
  pinch --> drag: 位移 > 容差
  pinch --> pointer: pinchExit + 短按(click)
  drag --> pointer: pinchExit
  palm --> cooldown: 触发滑动命令
  fist --> cooldown: dwell 完成
  cooldown --> pointer: 冷却结束且 point
  cooldown --> palm: 冷却结束且 open_palm
  pointer --> idle: 丢手 > grace
  palm --> idle: 丢手 > grace
  fist --> idle: 丢手 > grace
  pinch --> idle: 丢手 > grace（派发 cancel）
~~~

mode 是 UI 可见状态；commandCooldown 是独立计时器，冷却期间仍可移动光标（但不下发命令）。

### 7.5 捏合点击 / 拖拽

| 阶段 | 条件 | 输出 |
| --- | --- | --- |
| press | pinchRatio < enter 且稳定姿态 point | pointer_down，记录时间/位置 |
| move | 按住中 | pointer_move；位移 > pinchClickMoveTolerance 时 mode=drag |
| release-click | 松开，时长 ≤ pinchClickMaxMs，总位移 ≤ 容差 | pointer_up{click:true} |
| release-drag | 松开且已超容差 | pointer_up{click:false} |
| cancel | 丢手/关闭 | tracking:false，session 调 pointerBridge.cancel() |

### 7.6 滑动识别

- 采样：稳定 open_palm 期间，每帧记录 palmCenter 与 timestamp，保留 swipeWindowMs（180ms）。
- 取窗口内最早样本与当前样本：
  - dx_screen = mirror ? -(x_now - x_old) : (x_now - x_old)，dy = y_now - y_old；
  - speed = hypot(dx,dy) / dt（归一化屏幕/秒）；
  - 水平：|dx| ≥ swipeMinDistance 且 speed ≥ swipeMinVelocity 且 |dx| > dominance·|dy|；
  - 垂直同理。
- 触发后：清空历史、进入 cooldown、armed=false；只有姿态离开 open_palm 且保持 postureHoldMs 后才重新武装。
- 握拳/捏合期间的位移不采样，避免误切歌。

### 7.7 握拳停顿

- 稳定 fist 开始计时，每帧发 {type:"dwell", progress}（0→1）；
- 达到 dwellMs 发一次 command:fist_hold，进入 cooldown，armed=false；
- 中途松开或姿态变化 → 进度清零、不发命令；
- 重新触发必须先松开（不再 fist）再握拳。

### 7.8 丢手 / 重连

- handLostGraceMs=350ms：短暂丢帧不清状态，避免抖动导致 click 丢失。
- 超过 grace：tracking:false、光标隐藏、拖拽取消、dwell 清零、滤波器 reset。
- 重新出现：从当前姿态重新建立，不补发离开期间的事件。

### 7.9 帧输出契约

~~~ts
interface GestureFrameResult {
  timestamp: number;
  handPresent: boolean;
  posture: GesturePosture;
  mode: GestureMode;
  cursor: { x: number; y: number } | null;
  pinching: boolean;
  events: GestureFrameEvent[];
  debug: { pinchRatio; palmOpenness; pointerSpeed; posture };
}
~~~

事件类型：pointer_move | pointer_down | pointer_up | command | dwell | mode | tracking。
同一帧内事件顺序稳定：先 tracking/mode，后 pointer，最后 command。

---

## 8. 设备与资源层

### 8.1 摄像头生命周期

~~~text
支持检测（mediaDevices + isSecureContext）
  → getUserMedia({ video: { facingMode:"user", width:640, height:480, deviceId? } })
  → video.srcObject / play()（muted + playsInline）
  → track.onended / devicechange → 状态转 error（camera_busy / camera_not_found）
  → cleanup：stop tracks、srcObject=null、video.pause()
~~~

| 错误 | code | 用户文案 | 可重试 |
| --- | --- | --- | --- |
| NotAllowedError / SecurityError | permission_denied | 摄像头权限被拒绝，请在浏览器/系统设置中允许后重试 | 是 |
| NotFoundError / OverconstrainedError | camera_not_found | 未找到可用摄像头，请检查设备连接或更换摄像头 | 是 |
| NotReadableError / AbortError | camera_busy | 摄像头被其他应用占用，请关闭占用程序后重试 | 是 |
| 非 https/localhost | insecure_context | 当前环境不是安全上下文，浏览器禁止访问摄像头 | 否 |
| 无 getUserMedia | unsupported | 当前浏览器不支持摄像头访问 | 否 |

### 8.2 模型加载策略

1. /mediapipe/wasm + /mediapipe/models/hand_landmarker.task（本地，默认）
2. 本地失败 → CDN：https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm + Google 模型 URL
3. 每档内部 GPU delegate 失败 → CPU 重试
4. 全部失败 → GestureErrorState{code:"model_load_failed"}，HUD 显示“重试/检查本地资产”

资产同步脚本：npm run sync:mediapipe（scripts/sync-mediapipe-assets.mjs）
- 复制 node_modules/@mediapipe/tasks-vision/wasm/* → public/mediapipe/wasm/
- 下载 hand_landmarker.task（7,819,105 bytes）→ public/mediapipe/models/
- 记录 hand_landmarker.source.json（URL/大小/hash 前缀）
- --optional：供 prebuild 使用，失败仅警告（运行时回退 CDN）

### 8.3 性能预算

| 指标 | 预算 | 实现 |
| --- | --- | --- |
| 推理帧率 | ≤ 30fps | maxFps 节流 + 只在 video 新帧推理 |
| 每帧主线程 | 推理之外 ≤ 4ms | 纯计算 + 事件派发；骨骼绘制用缓存 canvas |
| store 更新 | cursor ≤ 30/s；其他字段仅变化时 set | 值比较 + session 层节流 |
| 后台 | 0 推理 / 0 摄像头 | document.visibilityState 暂停；恢复时重置 timestamp |
| 内存 | 关闭后释放 tracker/stream/RAF/rVFC | 会话 cleanup + generation token 防竞态 |

### 8.4 隐私与安全

- 视频帧只在本机内存中推理，不写入磁盘、不上传、不进入 React state。
- HUD 明确文案：“画面仅在本机识别，不录制、不上传”。
- 关闭手势/关闭页面 → 摄像头轨道立即 stop（设备指示灯熄灭）。
- 默认关闭；开启需要用户显式点击导航岛/设置开关。
- 合成指针事件不携带用户输入内容，不会产生键盘事件。

---

## 9. 指针桥（pointerBridge）设计

### 9.1 事件合成序列

真实鼠标输入在浏览器中会产生 pointer + mouse 两套事件。合成器必须复刻该顺序：

~~~text
hover 目标变化: pointerout/pointerleave → mouseout/mouseleave
                 pointerover/pointerenter → mouseover/mouseenter
移动:          pointermove → mousemove
按下:          pointerdown → mousedown（button=0, buttons=1）
拖动移动:      pointermove → mousemove（buttons=1）
松开:          pointerup → mouseup（buttons=0）
点击:          click(detail=1) → [320ms 内第二次] click(detail=2) + dblclick
取消:          pointercancel → pointerup（不 click）
~~~

### 9.2 点击目标与拖拽目标

- hover/移动目标：document.elementFromPoint(clientX, clientY)。
- 按下后：所有 move/up 派发到 **按下目标**（等价 pointer capture；对 window 级拖拽监听同样可见，因为事件冒泡）。
- click 目标：down 与 up 目标的最近公共祖先（LCA），与浏览器原生行为一致。
- 按下前对可聚焦元素调用 focus({preventScroll:true})，保证输入框/按钮可用。
- setPointerCapture 在不可信事件上会抛 NotFoundError，统一 try/catch 忽略。

### 9.3 忽略规则

- 带 data-gesture-ignore 的元素及其祖先不参与命中（HUD 自身）。
- pointer-events:none 元素自然不会被 elementFromPoint 命中（光标层）。
- 光标位置 clamp 到 [0.005, 0.995]，避免贴边抖动。

### 9.4 已知限制（文档化，不隐藏）

- 合成事件 isTrusted=false：少数依赖 isTrusted 或原生滚轮/文本选择的组件不会响应。
- 不支持文本选择、滚动、右键菜单；这些继续用鼠标/触控。
- 对依赖 pointer capture 的第三方拖拽库，若其强制 capture 会在控制台报 NotFoundError；本项目 Framer Motion / 自研拖拽经测试不依赖 capture。
- 拖拽滑杆/进度条：必须派发 window 可见的 pointermove/pointerup（本设计已满足）。

---

## 10. UI / UX 设计

### 10.1 HUD（GestureHUD）

- 位置：右上角 fixed top-4 right-4，z-[80]（低于光标的 90），安全区 env(safe-area-inset-*)。
- 两种形态：
  - 展开：标题“隔空手势” + 状态点；摄像头预览（200×150，镜像）+ 骨骼 canvas；底部提示“食指移动 · 捏合点击/拖拽 · 张掌滑动 · 握拳停顿”；按钮：折叠、预览、骨骼、设置、关闭。
  - 折叠：只显示状态点 + “隔空手势” + 展开按钮（hudCollapsed 持久化）。
- 状态文案：

| status | 文案 |
| --- | --- |
| idle | 已关闭 |
| loading_assets | 正在加载识别模型… |
| requesting_camera | 等待摄像头授权… |
| starting | 正在启动… |
| running + handPresent | 已识别到手 |
| running + !handPresent | 等待手部进入画面 |
| paused | 已暂停（页面不可见） |
| error | 错误卡片：code 对应中文文案 + hint + [重试] [去设置] |

- 错误态禁止静默：所有错误必须渲染 message，控制台只作为开发辅助。
- HUD 根节点 data-gesture-ignore，避免隔空光标误点自身。

### 10.2 光标（VirtualCursor）

- 仅 enabled && showCursor && cursorVisible 时挂载；pointer-events-none。
- 中心点 6px + 外环；捏合时缩小并加实心点；拖拽时外环变实线。
- dwell：SVG 圆环从 0→360° 进度，颜色使用强调色 #0071e3。
- prefers-reduced-motion：移除旋转/脉冲，仅保留透明度变化。
- 坐标更新使用 transform translate3d，避免布局。

### 10.3 动作反馈（GestureFeedback）

| 反馈 | 触发 | 呈现 |
| --- | --- | --- |
| 动作 toast | 任意 command 执行 | 顶部居中玻璃条：图标 + label + detail（如“下一首 · 歌名”），1400ms |
| 音量条 | volume_up/down 后 1200ms | 右侧竖条/顶部横条，数值来自 audioStore.volume，含图标 |
| 播放徽标 | toggle_play | 中央 Play/Pause 图标 700ms |
| dwell 进度 | fist 握拳中 | 光标环 / HUD 内进度（进度来自 runtime.dwell） |
| 错误 toast | action 失败（空队列/无歌曲） | 警告色 + 原因 |

### 10.4 设置面板（GestureSettings）

入口：设置面板 → 交互与手势 → 隔空手势；导航岛开关只负责启用/停用。

| 分区 | 控件 | 默认 |
| --- | --- | --- |
| 隐私 | 说明文案（本地识别/不录制/不上传） | — |
| 总开关 | Switch | 关 |
| 实时状态 | 模型/摄像头/手部/姿态/模式/FPS/后端(local/cdn) | — |
| 识别 | 灵敏度 0.5–2.0、指针平滑 0–1、音量步进 0.01–0.2 | 1.0 / 0.55 / 0.05 |
| 摄像头 | 设备下拉（enumerateDevices）+ 刷新 | 系统默认 |
| 绑定 | 5 个命令手势 → 动作下拉 | 见 5.4 |
| 显示 | HUD / 预览 / 骨骼 / 光标 / 诊断数据 | 开/开/开/开/关 |
| 恢复 | 恢复默认绑定 / 恢复默认设置 | — |

### 10.5 无障碍

- 开关按钮 aria-pressed，HUD role=status aria-live=polite 播报状态变化（不逐帧播报）。
- 所有按钮有中文 aria-label/title。
- 尊重 prefers-reduced-motion。
- 键盘/鼠标完整可用，手势不作为唯一入口。

---

## 11. 状态与持久化

### 11.1 settings（persist）

~~~ts
interface GestureSettings {
  enabled; showHud; showPreview; showSkeleton; showCursor; showDebugStats; hudCollapsed;
  mirror; sensitivity; pointerSmoothing; volumeStep; cameraDeviceId;
  bindings: Record<GestureCommandId, GestureActionId>;
}
~~~

- 存储键：mimi-gesture-settings-v1（version: 1）
- partialize 只写偏好；merge 时用 sanitizeSettings 补默认值/校验范围/补新绑定键，旧数据不会导致崩溃。
- 不持久化：光标、状态、错误、后端的运行数据。

### 11.2 runtime（不持久化）

status, error, cameraActive, modelReady, backend, handPresent, posture, mode, cursor, cursorVisible, pinching, dragging, dwell, lastEvent, eventSeq, fps, debug。

pushEvent 递增 eventSeq，UI 以 seq 作为动画 key，避免同时间戳事件合并。

### 11.3 默认值

见 src/lib/gesture/types.ts 的 createDefaultGestureSettings() 与 DEFAULT_GESTURE_TUNING；测试与文档共用同一常量，禁止在组件里重复写死。

---

## 12. 动作层行为

| action | 行为 | 边界 |
| --- | --- | --- |
| next_track | audioStore.nextSong() | 队列空 → 失败 toast“播放列表为空” |
| prev_track | audioStore.prevSong() | 同上 |
| volume_up / down | setVolume(clamp(volume ± volumeStep)) | 已是 0/1 → 仍成功，detail 显示百分比 |
| toggle_play | togglePlaybackIntent() | 无 currentSong → 失败 toast“请先选择歌曲” |
| toggle_mute | toggleMute() | 成功，detail 显示“已静音/已取消静音” |
| seek_forward / backward | setCurrentTime(clamp(currentTime ± 10, 0, duration)) | duration=0 → 失败 toast“当前没有可跳转的歌曲” |
| toggle_lyrics | uiStore.toggleFullscreenLyrics() | 面板打开时同样可切换（与快捷键一致） |
| none | 不执行 | 静默 success（设置中显式关闭） |

动作成功后由 session 调 runtime.pushEvent，UI 只读反馈，不反向调用业务 action。

---

## 13. 测试策略

### 13.1 单元测试矩阵

| 模块 | 测试文件 | 覆盖点 |
| --- | --- | --- |
| filters | src/lib/gesture/__tests__/filters.test.ts | 收敛、噪声、dt 异常、reset |
| landmarks | landmarks.test.ts | handScale、pinchRatio 尺度不变、手指伸展、姿态分类、镜像/区域映射 |
| engine | engine.test.ts | 姿态滞后、指针移动、捏合 click vs drag、四向滑动+方向正确、dominance、cooldown/rearm、dwell 单次触发、丢手/重连、observeOnly、时间戳异常 |
| camera | camera.test.ts | 能力检测、错误映射、设备枚举、安全上下文 |
| tracker | tracker.test.ts | 本地→CDN 回退、GPU→CPU 回退、结果校验、dispose |
| pointerBridge | pointerBridge.test.ts | hover 目标、click、drag、双击、cancel、data-gesture-ignore、LCA |
| actions | actions.test.ts | 空队列/无歌曲/duration=0/音量 clamp |
| stores | src/store/gestureStore.test.ts（或并入现有 store 测试） | settings persist/sanitize、runtime reset、pushEvent seq |
| UI | GestureHUD.test.tsx / GestureFeedback.test.tsx / GestureSettings.test.tsx | 静态渲染关键文案、错误态、反馈渲染 |

### 13.2 集成/端到端（无摄像头环境）

- 在 NODE_ENV !== "production" 时，session 暴露 window.__gestureDebug：
  - feed(landmarks, timestamp?) 直接注入一帧；
  - replay(frames[]) 按时间回放；
  - state() 读取 runtime。
- 用途：在 jsdom/CDP 中验证 光标移动→hover→捏合点击→按钮 onClick、滑动→切歌、握拳→播放/暂停，无需真实摄像头与模型。
- 生产构建剔除调试桥（process.env.NODE_ENV 分支 + 类型声明）。

### 13.3 手工验收矩阵（需真实硬件，文档记录结果）

| 维度 | 用例 |
| --- | --- |
| 权限 | 允许 / 拒绝后重试 / 系统设置中恢复 |
| 设备 | 内置摄像头 / USB 摄像头 / 无摄像头 / 摄像头被占用 |
| 网络 | 本地资产（断网）/ 删除本地资产后的 CDN 回退 |
| 姿态 | 食指移动、捏合单击、捏合拖拽进度条、双击按钮、张掌四向滑动、握拳停留 |
| 边界 | 快速切换开关、后台再回前台、拔掉摄像头、页面滚动后光标坐标 |
| 环境 | 强光/弱光、左手、远距离 40cm+/近距离 20cm |
| 兼容 | 关闭手势后鼠标/键盘/触摸完全正常；输入框打字不触发 C/S/G |

---

## 14. 兼容性与迁移

- **旧 store 字段**：isEnabled/toggleGestureEnabled 从 runtime store 迁移到 settings store；旧测试改读新 store。
- **旧 UI 字段**：lastGesture/gestureTriggered/gestureIntensity/showVolumePanel/... 删除（无消费方；GestureFeedback 重写后使用 runtime lastEvent + audio store）。
- **旧 hook**：useHandGesture 无引用，删除（在计划中记录证据），避免两套识别逻辑漂移。
- **localStorage**：无历史手势键，新增 mimi-gesture-settings-v1，不影响其他键。
- **依赖**：保留 @mediapipe/tasks-vision；@mediapipe/hands/@mediapipe/camera_utils 标为待清理（不在本次删除，避免 lockfile 波动）。
- **Electron**：本地资产随 public/** 打包；无需主进程权限 handler（Chromium 默认对 localhost/文件协议放行媒体权限；如打包后实测被拦，再补 setPermissionRequestHandler，见风险 R4）。

---

## 15. 风险与缓解

| ID | 风险 | 概率 | 影响 | 缓解 |
| --- | --- | --- | --- | --- |
| R1 | MediaPipe 模型/浏览器差异导致识别阈值不适用 | 中 | 部分用户难触发 | 灵敏度/平滑可调 + HUD 诊断 + 手工矩阵覆盖强/弱光、远近 |
| R2 | 合成事件在个别组件失效 | 中 | 个别按钮/拖拽不可点 | pointer+mouse 双派发；手工冒烟覆盖播放器/队列/设置；文档列出限制 |
| R3 | 本地模型资产 7.8MB 不进 Git 导致其他机器缺文件 | 中 | 首次运行回退 CDN | 同步脚本 + prebuild --optional + HUD 错误提示；文档明确 |
| R4 | Electron 打包后摄像头权限策略不同 | 低 | 无法打开摄像头 | 本地资产与 getUserMedia 走同一路径；必要时补主进程权限 handler；验收矩阵覆盖 |
| R5 | 手势与现有键盘快捷键/触摸冲突 | 低 | 误操作 | 姿态分离 + 默认关闭 + 输入框守卫 + 不绑定破坏性动作 |
| R6 | 高频 store 更新导致掉帧 | 低 | 光标卡顿 | 30fps 上限 + 值比较 + transform 渲染 + 可见性暂停 |
| R7 | React StrictMode/快速开关竞态 | 中 | 重复流/黑屏 | generation token + 幂等 cleanup + 单测覆盖快速重启 |

---

## 16. 验收标准

1. npx eslint src --max-warnings=99999 0 error。
2. npm run test -- --run 全绿（含新增手势测试）。
3. npx tsc --noEmit --incremental false --pretty false 0 error。
4. npm run build 成功。
5. npm run dev 后 / 与 /data-manager HTTP 200，无手势相关控制台错误。
6. CDP/调试桥冒烟：光标移动、hover、捏合点击按钮、滑动切歌、握拳切换播放状态均生效。
7. 关闭手势后无摄像头轨道、无全局监听、无推理循环；再次开启可恢复。
8. 设置持久化：刷新后灵敏度/绑定/摄像头/显示开关保留；错误态可重试。
9. 文档：本规格 + 实施计划 + INDEX/CHANGELOG（如需）可读、无乱码。

---

## 17. 术语表

| 术语 | 含义 |
| --- | --- |
| posture / 姿态 | 单手形状分类：point/open_palm/fist/unknown |
| mode / 模式 | UI 交互状态：idle/pointer/pinch/drag/palm/fist/cooldown |
| command / 命令手势 | 一次触发的离散手势（滑动/握拳停顿） |
| action / 动作 | 命令绑定到的业务操作（切歌/音量/播放…） |
| dwell / 停顿 | 保持某姿态达到阈值时间触发命令 |
| rearm / 重新武装 | 命令触发后必须离开姿态再回来才能再次触发 |
| activeRegion | 摄像头中央映射到屏幕的区域，保证边缘可达 |
| LCA | 两个 DOM 节点的最近公共祖先，作为 click 目标 |

---

## 18. 实施与验证摘要（2026-10-20）

### 18.1 落地模块

| 层 | 文件 |
| --- | --- |
| 契约 | src/lib/gesture/types.ts |
| 纯核心 | filters.ts / landmarks.ts / engine.ts |
| 设备与 IO | camera.ts / tracker.ts / pointerBridge.ts |
| 动作 | actions.ts |
| 状态 | src/store/gestureStore.ts（runtime）/ gestureSettingsStore.ts（persist） |
| 会话 | src/hooks/useGestureSession.ts |
| UI | GestureController / GestureHUD / GestureFeedback / VirtualCursor / GestureSettings |
| 接线 | GlobalClientComponents（原有挂载）、uiStore panel、PanelOrchestrator、SettingsPanel、AppleUnifiedNavIsland |
| 资产 | scripts/sync-mediapipe-assets.mjs + public/mediapipe（6 个 wasm + 7,819,105 bytes 模型） |

### 18.2 验证结果

| 项 | 结果 |
| --- | --- |
| 手势单元/组件测试 | 12 个文件、147 条用例通过（含 engine / pointerBridge / tracker / actions / store / UI / integration） |
| 全量 Vitest | 198 files / 1205 tests passed |
| 严格 TypeScript | npx tsc --noEmit --incremental false --pretty false → exit 0 |
| 生产构建 | npm run build → exit 0（28 静态页；含 Next 内置 TypeScript 检查） |
| 开发态 HTTP | / 与 /data-manager → 200 |
| Chrome CDP 冒烟 | fake camera + 本地模型成功启动；调试桥注入合成手后：光标跟随、捏合点击真实 DOM（click=1）、张掌左滑 → next_track、握拳停顿 → toggle_play、刷新后自动恢复、关闭后 debug/HUD/video 全部清理；0 JS 异常 |
| ESLint | npx eslint src --max-warnings=99999 → 0 error（见实施计划执行记录） |

### 18.3 冒烟期间发现并修复的真实缺陷

- **G-19（P0，新增）**：camera.ts 把 getUserMedia 提取为裸函数调用，真实浏览器抛 "Illegal invocation"，摄像头必然启动失败；单测 mock 未覆盖 this 绑定。已改为 getUserMedia.call(mediaDevices, constraints) 并新增回归测试。
- 同期修正了一个与手势无关的既有测试（DataManagerPlayerDock）：2026-10-12 起播放意图迁移到 playbackRuntimeStore.shouldPlay，旧断言读取 audioStore.isPlaying 已失效；改为断言 shouldPlay 并重置 runtime。

### 18.4 仍待人工验收

真实摄像头下的光线/距离/左右手/设备切换、USB 摄像头、权限拒绝后重试、Electron 打包摄像头权限，这些无法在无摄像头 CI 环境中确证，按 §13.3 矩阵执行。CDP 冒烟使用合成关键点，只证明“引擎→指针桥→DOM/动作”链路，不证明 MediaPipe 在真实手型上的识别率。
