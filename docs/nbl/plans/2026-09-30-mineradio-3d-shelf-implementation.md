# Mineradio 3D 空间唱片架暗黑剧场改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `nbl.parallel-subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Mineradio 3D 空间唱片架改造成封面优先的暗黑剧场，同时保持共享播放状态、队列和进度连续。

**Architecture:** Three.js 场景仍由 `Shelf3DView` 管理；帧率无关的弹簧和音频频带摘要放入纯函数模块；WebGL 失败时使用独立 DOM 唱片舞台。场景创建只依赖面板可见和尺寸，播放状态通过 refs 进入动画循环，不触碰全局音频生命周期。

**Tech Stack:** Next.js 16、React 19、TypeScript、Zustand、Three.js、Tailwind CSS、Web Audio API 共享 `AudioAnalyser`。

---

## 已确认规格

- 使用暗黑剧场：石墨黑/黑曜石、单束暖柔主光、极淡远景雾、主卡下柔和反光池和 1–2 条极淡缝线。
- 移除大网格、强白环、放射刻度、彩色星云、大散景和大面积分类渐变。
- 桌面显示 1 张中心主卡和左右各 2 张清晰邻卡；更远卡片从偏移 ±2 外单调沉入雾中，队列逻辑保持不变。
- 卡片通过指针交互和 dt 驱动的阻尼弹簧移动；不再持续整排漂浮。
- 低频只驱动地台反光池，高频只驱动主卡窄边光。暂停、无当前歌曲、分析器无效或音频上下文 suspended 时频谱归零。
- 暂停等静止状态只保留极慢余晖/雾呼吸；减少动态设置关闭周期呼吸、漂浮和音频律动。
- 页面隐藏/面板关闭时停止 RAF；播放/暂停不重建 renderer，不影响当前歌曲、进度、队列和共享音频。
- 桌面保留完整舞台；笔记本降低 DPR 和粒子；窄屏保留主卡、最近邻与触控浏览；WebGL 失败时提供可操作静态舞台。

## 文件职责

| 文件 | 职责 |
|---|---|
| `src/components/library/shelf3dMotion.ts` | 无副作用的弹簧步进、频带归一化和平滑包络计算。 |
| `src/components/library/Shelf3DStaticFallback.tsx` | WebGL 不可用/丢失时呈现可访问的 DOM 卡片舞台，播放逻辑由父组件传入。 |
| `src/components/library/Shelf3DView.tsx` | Three.js 场景、卡片状态、共享分析器接线、Pointer Events、质量档、响应式 HUD 和资源生命周期。 |
| `docs/nbl/plans/2026-09-30-mineradio-3d-shelf-implementation.md` | 记录本次实施顺序与完成状态。 |
| `docs/nbl/specs/2026-09-30-mineradio-3d-shelf-design.md` | 已批准设计基准；本次实现不修改其中的视觉决定。 |

## 执行模式与依赖

执行模式使用用户此前选择的 `parallel`。Task 1 与 Task 2 修改不同文件，可并行；Task 3 可独立实现 DOM 回退组件。最多同时运行 2 个实现子代理，因此三个独立任务分两批执行。Task 4 与 Task 5 都会改 `Shelf3DView.tsx`，按依赖串行执行，避免同文件并发冲突。

```text
Level 0 / batch 1: Task 1 (physics/audio math) + Task 2 (scene visual composition)
Level 0 / batch 2: Task 3 (static fallback component)
Level 1:           Task 4 (scene lifecycle, analyzer, input, responsive integration)
Level 2:           Task 5 (global spec/quality review, fixes, static validation)
```

## 测试与验证约束

本次未获用户明确授权新增或运行测试，因此本计划不新增测试文件、不运行 Vitest。最终仅执行格式差异检查、针对修改文件的 ESLint、TypeScript 类型检查和生产构建；未执行测试会在交付报告中明确列出。若用户在实施中另行明确要求测试，应先补充聚焦测试计划，再按先红后绿执行。

## 任务

### Task 1: 建立帧率无关的运动与频谱纯函数

**状态**
- [ ] 任务完成

**Dependencies:** None
**Parallelizable:** Yes，与 Task 2 / Task 3 并行；本任务只修改 `shelf3dMotion.ts`。

**文件：** 新建 `src/components/library/shelf3dMotion.ts`。

- [ ] **Step 1: 定义无副作用 API。** 新增 `SpringState { position: number; velocity: number }`、`stepCriticalSpring(state, target, dtSeconds, omega?)`、`readBandEnergy(data, sampleRate, fftSize, lowHz, highHz)`、`approachEnvelope(current, target, dtMs, attackMs, releaseMs)`。输入无效、数组为空或频带上下界无有效 bin 时返回稳定的有限值；不得在函数内分配大型数组。
- [ ] **Step 2: 实现临界阻尼的闭式步进。** 将 `dtSeconds` 限制在 `[0, 0.032]`，默认 `omega = 18`。令 `d = position - target`、`c = velocity + omega * d`、`decay = exp(-omega * dt)`；返回 `position = target + (d + c * dt) * decay`、`velocity = (velocity - omega * c * dt) * decay`。这使状态按真实时间变化，不依赖帧调用次数。
- [ ] **Step 3: 实现频带采样。** 将频率边界映射到 `floor(hz * fftSize / sampleRate)`，限制到 `data.length`，求有效字节的平均值并归一化到 `[0, 1]`；不修改 analyser 的 `fftSize`。
- [ ] **Step 4: 实现平滑包络。** 用 `alpha = 1 - exp(-clamp(dtMs, 0, 32) / max(tauMs, 1))`，根据目标高于或低于当前值选择 attack/release 时间，输出限制在 `[0, 1]` 的结果。
- [ ] **Step 5: 静态检查。** 运行 `npx eslint src/components/library/shelf3dMotion.ts --max-warnings=99999`；预期退出码为 0。

### Task 2: 重做暗黑剧场场景与卡片材质

**状态**
- [ ] 任务完成

**Dependencies:** None
**Parallelizable:** Yes，与 Task 1 / Task 3 并行；本任务只修改 `Shelf3DView.tsx` 的纹理/场景创建、卡片位置衰减和背景/HUD 样式，不改动画状态架构和输入 handler。

**文件：** `src/components/library/Shelf3DView.tsx`。

- [ ] **Step 1: 简化 2D 纹理生成器。** 删除不再使用的强环、放射刻度、星云和大型散景生成器及其资源；只保留柔暖聚光纹理、柔和反光池与必要的中性占位纹理。对 Canvas `getContext` 失败时走占位纹理/安全返回，不能让整个场景初始化崩溃。
- [ ] **Step 2: 重调 Three.js 灯光与地面。** 将高强白/蓝补光改成暖中性主光和轻微中性补光；将近镜面材质改成高粗糙度/低金属感；移除 `GridHelper` 与强环贴图；加入单片椭圆柔边反光池和最多两道低对比地面线。
- [ ] **Step 3: 降低卡片白色高光。** 在 `getOrCreateCardTexture` 里缩窄 active 描边、减弱纯白高光和斜向 sheen，卡片底板转为中性哑光；封面仍是卡片最强颜色。
- [ ] **Step 4: 调整焦点衰减。** 保留 11 个虚拟槽位与现有索引/模式转换；偏移 ±2 内维持邻卡可识别，偏移超过 2 后平滑、单调降低 opacity/scale/亮度。禁止仅靠 CSS 模糊模拟远卡并保留高不透明度。
- [ ] **Step 5: 收敛 DOM 背景与玻璃 HUD。** 用固定暗场、极淡暖中性氛围光和轻暗角替代按 `browseType` 变化的整屏彩色梯度及大尺寸模糊椭圆；青蓝色仅保留为交互提示，降低顶部/底部玻璃白光。
- [ ] **Step 6: 静态检查。** 运行 `npx eslint src/components/library/Shelf3DView.tsx --max-warnings=99999`；预期无新增 lint error。

### Task 3: 增加可操作的非 WebGL 舞台

**状态**
- [ ] 任务完成

**Dependencies:** None
**Parallelizable:** Yes；新建文件，组件 props 约定固定为 items、activeIndex、onSelect、onPlay、onPrevious、onNext；不得导入 `Shelf3DView` 以避免循环依赖。

**文件：** 新建 `src/components/library/Shelf3DStaticFallback.tsx`。

- [ ] **Step 1: 定义结构化 props。** Item 使用结构类型 `{ id: string; title: string; subtitle: string; cover: string; }`；回调由父组件传入。不得直接读写 Zustand 或创建音频实例。
- [ ] **Step 2: 绘制静态暗黑剧场。** 中心卡最大、左右邻卡较小并降低明度，远卡隐藏或淡化；以 CSS perspective 和轻微 `transform` 保留空间感；不依赖 WebGL、Canvas 2D、远程背景图或动画循环。
- [ ] **Step 3: 保持操作可达。** 使用语义化按钮显示前后切换和播放操作；图片失败时显示中性默认封面；没有 items 时显示空状态。可见焦点、键盘和触屏点击都可用。
- [ ] **Step 4: 静态检查。** 运行 `npx eslint src/components/library/Shelf3DStaticFallback.tsx --max-warnings=99999`；预期退出码为 0。

### Task 4: 集成音频状态、稳定场景生命周期和适配行为

**状态**
- [ ] 任务完成

**Dependencies:** Task 1, Task 2, Task 3
**Parallelizable:** No；修改同一个组件入口并整合三个前置任务。

**文件：** `src/components/library/Shelf3DView.tsx`。

- [ ] **Step 1: 将播放状态移出场景创建依赖。** 引入 `getAudioAnalyser`、`getAudioContext` 和 motion helpers；同步 `isAudioPlaying`、`currentPlayingSong`、display mode 到 refs。Three.js 创建/清理 effect 只随 `isOpen` 和实际容器/renderer 生命周期变化，禁止依赖 `isAudioPlaying`。
- [ ] **Step 2: 实现真实频谱门控。** 只有 `isAudioPlaying && currentPlayingSong && analyser && context?.state === "running"` 时读取频谱；低频值传给反光池强度，高频值传给主卡边缘光。复用 `Uint8Array`；无效或失败时 `fill(0)` 并把 envelope 目标设为 0；不可新建 `AudioContext` 或更改共享 analyser 设置。
- [ ] **Step 3: 切断自动漂浮并使用 spring。** 删除 `floatPhase` 驱动的卡片持续漂浮、背景光环旋转和全屏正弦脉冲。保留明确的模式转换、指针视差小幅跟随和低频局部余晖；运动 helper 使用 `dt` 处理 scroll/snap，并在页面恢复时限制首帧 dt。
- [ ] **Step 4: 增加动画可见性管理。** `document.visibilitychange` 隐藏时取消唯一 RAF，显示且 `isOpen` 时重新启动；`prefers-reduced-motion` 用 `matchMedia` 订阅，开启时关闭周期性呼吸/粒子/音频响应；cleanup 移除监听并只 dispose 当前场景拥有的资源。
- [ ] **Step 5: 实现 Pointer Events。** 用 `onPointerDown/Move/Up/Cancel`、`setPointerCapture/releasePointerCapture` 管理鼠标和触控；保留点击/拖动阈值；raycast 坐标相对 canvas `getBoundingClientRect()`；交互 HUD 内不启动拖拽。
- [ ] **Step 6: 修正键盘输入冲突。** `keydown` 检查 `target` 是否为 `input`、`textarea`、`select` 或 `[contenteditable=true]`，只有非编辑焦点时才处理 Space/Enter/方向键快捷键。
- [ ] **Step 7: 响应式画布和质量档。** 通过 `ResizeObserver` 更新相机 aspect 与 renderer size；高/中/低档 DPR 上限为 1.75/1.35/1.0，粒子数量逐档下降；以 5 秒帧率均值和 45fps/55fps 滞回变更档位，DPR 不逐帧设置。
- [ ] **Step 8: 接入静态回退。** 捕获 `WebGLRenderer` 初始化异常并监听 `webglcontextlost/restored`；失败/丢失时渲染 `Shelf3DStaticFallback`，将现有选中、播放和队列回调传入；关闭/恢复后不得重复创建 RAF 或遗留监听器。
- [ ] **Step 9: 收敛小屏 HUD。** 根容器用 `100dvh` 和安全区内边距；1024px 以下让顶栏折叠为两层或可横向访问，窄屏减少非主要标签占位，底栏保持播放/切歌入口可见；canvas 不得覆盖控件点击。
- [ ] **Step 10: 约束缓存所有权。** 图片加载检查 `naturalWidth`；失败图不进入成功缓存；缓存只保留 11 个显示槽位与少量邻近预热纹理；场景 cleanup 逐项 dispose 自己持有的 texture，不清空仍被其他组件使用的模块级缓存。

### Task 5: 全局规格与代码质量审查

**状态**
- [ ] 任务完成

**Dependencies:** Task 4
**Parallelizable:** No；必须审阅合并后的最终 diff。

**文件：** `Shelf3DView.tsx`、`shelf3dMotion.ts`、`Shelf3DStaticFallback.tsx` 与本计划。

- [ ] **Step 1: 逐条对照规格。** 检查第 2、5、6、7、8、10 节每项要求在代码中有对应实现；确认 11 槽队列与原有 play/queue 语义保留、三种空/暂停/分析器异常状态不会调用自动播放。
- [ ] **Step 2: 质量审查。** 检查 hooks 依赖、ref 与 cleanup 对称性、renderer 创建/释放计数、键盘输入焦点过滤、pointer capture、频谱数组复用、cache 上限和 try/catch 降级路径；修复发现的问题后再复查。
- [ ] **Step 3: 检查差异与静态质量。** 运行 `git diff --check`、`npx eslint src/components/library/Shelf3DView.tsx src/components/library/shelf3dMotion.ts src/components/library/Shelf3DStaticFallback.tsx --max-warnings=99999`、`npx tsc --noEmit --incremental false --pretty false`、`npm run build`。预期 diff check、lint、类型检查和 build 均退出码为 0；Vitest 不运行。
- [ ] **Step 4: 更新本计划状态。** 只将实际完成的任务勾选为完成，记录静态命令实际结果和未运行的测试项；不要把设计规格或源码审阅写成浏览器/设备验收已通过。

---
**Execution Mode:** parallel
