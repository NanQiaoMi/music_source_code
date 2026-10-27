# 2026-10-19 隔空手势功能彻底修复实施计划（Air Gesture Repair Plan）

> Status: **Done**（代码已落地；自动化测试 / 严格 TS / 生产构建 / 开发态 HTTP 与 Chrome CDP 冒烟通过；真实摄像头手工验收待用户按 §7.3 执行）
> Branch: feature/gesture-air-control-overhaul（基于 c73a872，禁止直接落 master）
> Design spec: docs/nbl/specs/2026-10-19-air-gesture-system-design.md
> 变更范围: src/lib/gesture/**、src/store/gesture*.ts、src/hooks/useGestureSession.ts、
> src/components/interaction/**、src/components/widgets/VirtualCursor.tsx、
> src/components/settings/**、src/components/layout/**（仅接线）、scripts/sync-mediapipe-assets.mjs、public/mediapipe/**、docs/**

---

## 1. 背景

手势功能自 V7 起存在但长期“看起来有、实际不可用”：识别方向与镜像语义相反、点击序列不完整导致拖拽失效、切换骨骼会重启摄像头、模型/WASM 依赖外网、错误无反馈、无设置无持久化、无测试。2026-05 的代码健康计划曾把 gestureStore 列为待补测试，但手势整体仍停留在原型状态。

本计划的目标不是“小修小补”，而是：

1. 把识别核心从 React 组件中拆成可测试的纯逻辑；
2. 重新定义一套用户能理解、误触可控的手势语言；
3. 修复所有 P0/P1 缺陷并用测试锁死；
4. 让手势在离线/Electron/无网络环境可用；
5. 建立可诊断、可调参、可回归的长期维护面。

---

## 2. 目标 / 非目标

### 2.1 目标

- 捏合点击、捏合拖拽、双击、张掌四向滑动、握拳停顿在真实硬件可用。
- 滑动方向与光标方向一致（镜像语义单点收敛）。
- 本地 MediaPipe 资产优先，CDN 兜底；Electron 离线可用。
- 所有失败有中文错误态 + 重试/去设置入口。
- 设置持久化（灵敏度/平滑/音量步进/摄像头/绑定/显示）。
- 关闭手势后零摄像头、零推理、零全局监听。
- 新增测试覆盖引擎、设备回退、指针桥、动作边界、UI 静态渲染。

### 2.2 非目标

- 双手手势、滚动/缩放、圆圈/爱心/点赞等低稳定性手势。
- 重构 audioStore / uiStore 主体。
- 修改 V7 核心视图布局（Home / Player / 全屏歌词）。
- 删除 @mediapipe/hands、@mediapipe/camera_utils（仅标为后续清理，避免 lockfile 波动）。

---

## 3. 约束与纪律

1. 禁止在 master 开发；所有改动在当前 feature 分支。
2. 不修改受保护视图结构；GestureController/Feedback 属独立交互层。
3. 不破坏现有 localStorage / IndexedDB 键；新增键仅 mimi-gesture-settings-v1。
4. 不新增依赖；复用 @mediapipe/tasks-vision@^0.10.34。
5. Windows 验证顺序固定：eslint → vitest → tsc → build → 停旧 dev → clean-port → dev → HTTP 冒烟。不要并行跑 build 与裸 tsc，不要在 dev 存活时清 .next。
6. 单 PR 建议 ≤ 400 行；本次为完整功能重写，按阶段拆分提交（见 §6）。

---

## 4. 缺陷 → 任务 → 测试 追溯

| 缺陷 | 修复任务 | 关键改动 | 回归测试 |
| --- | --- | --- | --- |
| G-01 滑动方向反 | T4 引擎 | 屏幕坐标统一在 landmarks/engine 内完成镜像，swipe 使用 screenDx | engine.test：4 方向 + 镜像开关 |
| G-02 点击/拖拽事件不完整 | T5 指针桥 | pointer + mouse 双派发、buttons、LCA、dblclick、cancel | pointerBridge.test |
| G-03 切骨骼重启摄像头 | T7 Controller | effect 只依赖 enabled/deviceId；显示开关走 runtime/settings | 手工 + 快速切换用例 |
| G-04 外部 CDN 强依赖 | T6 资产 + tracker | 本地 wasm/模型优先，固定 CDN 兜底，GPU→CPU 回退 | tracker.test + 断网手工 |
| G-05 失败无反馈 | T6/T8 | GestureErrorCode 映射 + HUD 错误卡 + 重试 | camera.test + HUD.test |
| G-06 输入框快捷键冲突 | T7 Controller | 输入/可编辑元素守卫；去掉裸 C/S/G，保留 Esc 仅在输入外 | 手工 + 键盘捷径测试不回归 |
| G-07 捏合阈值不归一化 | T4 引擎 | pinchRatio = dist(4,8)/handScale + 双阈值滞后 | landmarks/engine.test 尺度不变 |
| G-08 滑动姿态/窗口混乱 | T4 引擎 | 仅 open_palm 采样 palmCenter，180ms 窗口 + 速度/优势 | engine.test |
| G-09 每帧布局/无暂停 | T5/T7 | 30fps 上限、值比较、visibility 暂停、move 节流 | 手工性能观察 + 代码审查 |
| G-10 丢手/拖拽悬挂 | T4/T5 | grace 350ms、tracking:false → cancel() | engine.test + pointerBridge.test |
| G-11 乱码/无说明 | T8 UI | 全部中文文案，HUD 提示手势清单 | HUD.test 静态断言 |
| G-12 死代码/伪功能 | T1/T9 | types 单一事实源；删除旧字段与 12 种未实现手势 | tsc/eslint + store.test |
| G-13 无持久化/无设置 | T2/T8 | settings store + GestureSettings 面板 | settings store test + 静态渲染 |
| G-14 HUD 现代布局 | T8 | z-80、safe-area、折叠、mobile 尺寸 | HUD.test + 手工响应式 |
| G-15 类型不安全 | T3/T4/T5 | MediaPipe 官方类型、去掉 LegacyAny、清理未用变量 | tsc 0 error |
| G-16 设备拔出无感知 | T5/T6 | track.onended + devicechange → error 状态 | camera.test/手工 |
| G-17 StrictMode 竞态 | T7 | generation token + 幂等 cleanup | 手工快速开关 |
| G-18 无测试 | 全部 | 新增测试矩阵（见 §7） | npm run test -- --run |

---

## 5. 阶段与任务

### Phase 0 — 审计与契约（已完成）

| 任务 | 内容 | 产出 | 状态 |
| --- | --- | --- | --- |
| T0 | 逐文件审计旧实现，记录 G-01~G-18 | 设计规格 §2 | ✅ |
| T1 | 冻结公共契约：类型/手势/动作/默认值/store 形状 | src/lib/gesture/types.ts、src/store/gestureStore.ts、src/store/gestureSettingsStore.ts | ✅ |

### Phase 1 — 纯识别核心（并行 A）

| 任务 | 内容 | 文件 | 验收 | 状态 |
| --- | --- | --- | --- | --- |
| T2 | One Euro 滤波 | src/lib/gesture/filters.ts | 收敛/噪声/dt 异常测试 | ✅ |
| T3 | 几何特征 + 姿态分类 + 镜像/区域映射 | src/lib/gesture/landmarks.ts | 尺度不变/姿态/映射测试 | ✅ |
| T4 | 状态机（pointer/pinch/drag/palm/fist/cooldown） | src/lib/gesture/engine.ts | engine.test 全场景 | ✅ |

### Phase 2 — 设备与 DOM（并行 B）

| 任务 | 内容 | 文件 | 验收 | 状态 |
| --- | --- | --- | --- | --- |
| T5 | 摄像头能力/请求/设备/错误映射 | src/lib/gesture/camera.ts | 错误矩阵测试 | ✅ |
| T6 | MediaPipe 加载本地→CDN、GPU→CPU、dispose | src/lib/gesture/tracker.ts | 回退链 mock 测试 | ✅ |
| T7 | pointer+mouse 事件桥（click/drag/dblclick/cancel） | src/lib/gesture/pointerBridge.ts | jsdom 事件测试 | ✅ |
| T8 | 动作层（切歌/音量/播放/seek/静音/歌词） | src/lib/gesture/actions.ts | 边界测试 | ✅ |

### Phase 3 — UI（并行 C）

| 任务 | 内容 | 文件 | 验收 | 状态 |
| --- | --- | --- | --- | --- |
| T9 | HUD（预览/骨骼/状态/错误/折叠） | src/components/interaction/GestureHUD.tsx | 静态渲染测试 | ✅ |
| T10 | 动作反馈（toast/音量条/播放徽标/dwell） | src/components/interaction/GestureFeedback.tsx | 静态渲染测试 | ✅ |
| T11 | 光标（捏合/dwell 圆环/reduced motion） | src/components/widgets/VirtualCursor.tsx | 静态渲染测试 | ✅ |
| T12 | 设置面板（开关/灵敏度/摄像头/绑定/恢复默认） | src/components/settings/GestureSettings.tsx | 静态渲染测试 | ✅ |

### Phase 4 — 集成（Lead）

| 任务 | 内容 | 文件 | 验收 | 状态 |
| --- | --- | --- | --- | --- |
| T13 | 会话编排：设备→引擎→桥→动作→store；生命周期/可见性/竞态 | src/hooks/useGestureSession.ts | tsc + 手工快速开关 | ✅ |
| T14 | 重写 Controller：只依赖 enabled/deviceId，挂 HUD/Cursor/Feedback，输入守卫，dev 调试桥 | src/components/interaction/GestureController.tsx | 手工 + CDP | ✅ |
| T15 | 接线：uiStore panel + PanelOrchestrator + SettingsPanel 入口 + 导航岛开关 | src/store/uiStore.ts、src/components/layout/PanelOrchestrator.tsx、src/components/settings/SettingsPanel.tsx、AppleUnifiedNavIsland.tsx | tsc + 面板注册测试 | ✅ |
| T16 | 本地资产脚本 + prebuild optional | scripts/sync-mediapipe-assets.mjs、package.json、public/mediapipe/** | 脚本执行成功 | ✅ |
| T17 | 旧代码/旧测试清理（useHandGesture、旧 store 字段、visualInteractionStores.test） | src/hooks/useHandGesture.ts 等 | eslint/vitest 全绿 | ✅ |

### Phase 5 — 验证与文档

| 任务 | 内容 | 验收 | 状态 |
| --- | --- | --- | --- |
| T18 | eslint src 0 error | 命令结果 | ✅ |
| T19 | vitest run 全绿（含新增） | 命令结果 | ✅ |
| T20 | tsc --noEmit 0 error | 命令结果 | ✅ |
| T21 | next build 成功 | 命令结果 | ✅ |
| T22 | dev + HTTP 冒烟（/、/data-manager） | 200 + 无手势相关控制台错误 | ✅ |
| T23 | CDP/调试桥冒烟：光标→hover→点击、滑动→切歌、握拳→播放 | 手动/脚本记录 | ✅ |
| T24 | 更新 INDEX / CHANGELOG / ROADMAP（按需） | 文档可读 | ✅ |

---

## 6. 提交拆分建议

1. feat(gesture): add pure gesture engine and local MediaPipe assets
2. feat(gesture): add gesture settings/runtime stores and camera/tracker layer
3. feat(gesture): add pointer bridge and action layer with tests
4. feat(gesture): rebuild HUD, cursor, feedback and settings UI
5. refactor(gesture): wire controller/session and remove legacy hand hook
6. test(gesture): cover engine, device fallback, pointer bridge, actions, UI
7. docs(gesture): add design spec and repair plan

> 每个提交前跑对应范围的 eslint + vitest；合并前跑完整验证链。

---

## 7. 测试与验收

### 7.1 必须通过的自动化

~~~bash
npx eslint src --max-warnings=99999
npm run test -- --run
npx tsc --noEmit --incremental false --pretty false
npm run build
node scripts/clean-port.js 3025
npm run dev
# HTTP 冒烟
Invoke-WebRequest http://127.0.0.1:3025/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3025/data-manager -UseBasicParsing
~~~

### 7.2 手势专项测试文件

- src/lib/gesture/__tests__/filters.test.ts
- src/lib/gesture/__tests__/landmarks.test.ts
- src/lib/gesture/__tests__/engine.test.ts
- src/lib/gesture/__tests__/camera.test.ts
- src/lib/gesture/__tests__/tracker.test.ts
- src/lib/gesture/__tests__/pointerBridge.test.ts
- src/lib/gesture/__tests__/actions.test.ts
- src/components/interaction/GestureHUD.test.tsx
- src/components/interaction/GestureFeedback.test.tsx
- src/components/settings/GestureSettings.test.tsx
- src/store/gestureStore.test.ts（settings/runtime 状态）

### 7.3 手工验收（真实摄像头）

| 项 | 期望 |
| --- | --- |
| 开启手势 | 摄像头灯亮，HUD 显示“等待手部进入画面”，2 秒内识别到手 |
| 食指移动 | 光标平滑跟随，屏幕四角可达，无明显抖动 |
| 捏合单击 | 按钮被按下并触发 onClick；HUD/设置面板可点 |
| 捏合拖拽 | 播放器进度条/音量条可拖动，松手 seek 生效 |
| 双击 | 需要双击的按钮触发 dblclick |
| 张掌左滑 | 下一首；右滑上一首（与屏幕方向一致） |
| 张掌上/下滑 | 音量 ±5%，反馈条出现 |
| 握拳停顿 | 进度环走满后播放/暂停，只触发一次 |
| 输入框 | 聚焦搜索框打 c/s/g 不会切换摄像头/骨骼/关闭手势 |
| 关闭手势 | 摄像头灯灭、光标消失、HUD 移除、输入/鼠标完全正常 |
| 刷新 | 上次开关/灵敏度/绑定保留（浏览器权限允许时自动恢复） |
| 错误态 | 拒绝权限后 HUD 显示中文原因 + 重试按钮；重试可再次弹权限 |

### 7.4 无摄像头环境

- 使用 dev 调试桥 window.__gestureDebug.feed()/replay() 注入合成 21 点，验证引擎→指针桥→DOM 动作全链路；这不是替代真实摄像头验收，但可进 CI/CDP。

---

## 8. 回滚策略

- 代码回滚：本功能集中在独立文件与 4 处接线（GlobalClientComponents 已挂载、uiStore panel、PanelOrchestrator、SettingsPanel/nav 开关）。回滚时恢复旧 Controller/Feedback/store 三项即可，其他模块不受影响。
- 数据回滚：settings 存在独立键 mimi-gesture-settings-v1，删除该键即恢复默认；不影响任何播放/资料库数据。
- 资产回滚：public/mediapipe 为生成产物（已加入 .gitignore），可整体删除，运行时自动回退 CDN；打包/离线部署前执行 npm run sync:mediapipe（npm run build 的 prebuild 也会尝试同步）。

---

## 9. 风险

见设计规格 §15。额外工程风险：

- MediaPipe 模型在 jsdom 无法真实推理：CI 只保证纯逻辑/回退/事件层，最终可用性依赖手工验收；因此保留 HUD 诊断数据与调试桥。
- 本地模型 7.8MB 不纳入版本控制时需要每台机器执行 sync 脚本；HUD 模型失败态会给出明确提示。
- 手势识别对光线/手型敏感，默认灵敏度与阈值必须允许用户调整，不能写死。

---

## 10. 执行记录

<!-- 完成验证后在此追加命令、结果、时间与遗留问题 -->

- 2026-10-19：完成 G-01~G-18 审计；冻结 types/store 契约；启动三个并行实现任务（engine/device/UI）。
- 2026-10-19：新增 scripts/sync-mediapipe-assets.mjs，已复制 6 个 wasm 文件并下载 hand_landmarker.task（7,819,105 bytes）。
- 2026-10-19：完成 3 个并行实现（引擎 47 tests、设备层 73 tests、UI 15 tests、集成 5 tests、store 7 tests，手势合计 147 tests / 12 files）与 Lead 集成（会话/控制器/接线/资产/文档）；删除无引用的 useHandGesture.ts。
- 2026-10-20：**CDP 冒烟发现并修复 G-19（P0 真实浏览器缺陷）**——camera.ts 将 getUserMedia 提取为裸函数调用，浏览器抛 "Illegal invocation"，摄像头 100% 启动失败；改为 getUserMedia.call(mediaDevices, constraints)，并新增 this 绑定回归测试。仅靠 mock 单测无法发现该类 WebIDL 绑定错误。
- 2026-10-20：补充 engine → pointerBridge → actions 的端到端集成测试（5 tests：捏合点击真实 DOM、左右滑动方向与绑定、握拳 dwell、丢手 cancel）。
- 2026-10-20：修正上游 2026-10-12 playback intent 迁移后失效的既有测试 DataManagerPlayerDock.test.tsx（与手势无关，仅为让全量测试恢复可信的绿色基线；未改生产代码）。
- 2026-10-20：验证结果：
  - npx eslint src --max-warnings=99999 → 0 error（整包单进程在本机异常缓慢，等价拆为 src/components 与 src/lib+store+hooks+utils+types+services+test+app 两个 chunk 覆盖全部 src，均 exit 0）
  - npm run test -- --run → 198 files / 1205 tests passed
  - npx tsc --noEmit --incremental false --pretty false → exit 0
  - npm run build → exit 0（28 static pages；Next 内置 TypeScript 通过；仅有既有 Browserslist 数据陈旧告警与多 lockfile 根目录告警）
  - dev server 3025：/ 与 /data-manager → HTTP 200
  - Chrome CDP 冒烟（fake camera + window.__gestureDebug 注入 21 点合成手）：开启手势并持久化、本地模型启动、手部/光标识别、捏合点击注入按钮（真实 DOM click=1）、张掌左滑→next_track、握拳停顿→toggle_play、刷新后自动恢复手势、关闭后 __gestureDebug/HUD/video 全部清理；0 JS 异常，控制台仅 headless GL 与 MediaPipe NORM_RECT 警告（非应用错误）。
- 2026-10-20：工作区同时存在其它并行任务的非手势改动（handwritten MV / visualization 文件、相关 docs），本任务未修改这些文件；上述验证在合并工作树上执行。
- 2026-10-20：仍待用户真机验收：真实摄像头、权限拒绝/设备占用、USB 摄像头、强/弱光、远近、左右手、Electron 打包摄像头权限（见规格 §13.3 矩阵）。
