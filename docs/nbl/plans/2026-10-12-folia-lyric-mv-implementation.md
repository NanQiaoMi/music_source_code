# 「温光浮字」Folia 绘光式歌词 MV 重做实施计划

> 状态：实现与合并前静态验证完成；真实歌词播放动态核验未完成。唯一设计基线：[2026-10-12 重做规格](../specs/2026-10-12-folia-lyric-mv-design.md)。
>
> 目标分支：feature/folia-faithful-visualizer；开始时基于当前本地 master 提交 424685b，工作树干净。

## 目标与架构

将现有「温光浮字」从中心整句与水平扫光改成一支由全曲时间线、分镜、舞台灯光、局部歌词和转场组成的程序化 MV。保留 cinematicLyricDrift ID、Canvas 2D、LRC 数据、既有设置字段与播放器接口。

采用纯函数编译器：LRC 时间线与歌曲 ID 生成段落、歌词镜头、间奏镜头、灯位和转场。渲染器每帧按音乐时间解析当前镜头；Canvas 只承担画面绘制。现有歌词播放时钟继续处理暂停、倍速、seek、回退和长帧间隔。整段播放状态不只依赖 RAF 增量。

## 约束

- 只动正式可视化效果及它的设置；不动 V7.0 首页、播放器、全屏歌词和歌词/歌曲持久化链路。
- 同刻多条 LRC 作为独立行保留；不再合并为带斜杠文本。
- 用户已批准的逐字时间策略为按 LRC 行区间估算；不扩展为真实词级时间 API。
- 不加 Pixi/Three.js/视频依赖；舞台场景用 Canvas 2D 程序化绘制。
- 实现前先写目标行为测试，并观察一次预期失败；没有失败证据不先写对应生产逻辑。
- 项目要求在独立功能分支提交后再合并。完成前不得合并；合并后在 master 再跑回归检查。

## 文件职责

| 文件                                                           | 职责                                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| src/components/visualization/effects/lyricFilmProgram.ts       | 纯函数编译段落、短镜头、间奏、场景类型和转场；提供按音乐时间定位镜头的辅助函数。                            |
| src/components/visualization/effects/lyricFilmProgram.test.ts  | 验证空/坏歌词、并行行、前奏、短间奏、长行、镜头时限、稳定种子、转场不重复和 seek 定位。                     |
| src/components/visualization/effects/lyricFilmStage.ts         | 解析确定性镜头构图/运镜/转场帧，并绘制追光、棱镜、窗隙、焦散、植物线稿、星象、雾尘等舞台美术。              |
| src/components/visualization/effects/lyricFilmStage.test.ts    | 验证纯帧解析在边界、seek、暂停/减少动态效果下稳定；若画布辅助支持，将关键图层绘制限制作为可测试纯数据约束。 |
| src/components/visualization/effects/cinematicLyricDrift.ts    | 接入分镜程序、歌词窗口、估算字素显影、舞台 renderer、片尾卡；修复本效果的同刻行合并与状态失效问题。         |
| src/components/visualization/VisualizationSettingsPanel.tsx    | 维持设置键和值域，更新文字使其对应舞台灯光、字号、辉光、运镜速度和颗粒。                                    |
| docs/nbl/specs/2026-10-12-folia-lyric-mv-design.md             | 记录当前设计基线与边界。                                                                                    |
| docs/nbl/plans/2026-10-12-folia-lyric-mv-implementation.md     | 记录任务状态、验证证据及后续限制。                                                                          |
| docs/nbl/specs/2026-10-11-folia-inspired-warm-lyrics-design.md | 顶部标明旧融合设计已被取代，保留历史记录。                                                                  |
| docs/nbl/plans/2026-10-11-folia-inspired-lyric-visualizer.md   | 顶部标明旧实施计划已被取代，保留历史记录。                                                                  |
| docs/nbl/plans/INDEX.md、docs/nbl/CHANGELOG.md                 | 更新计划索引和实际交付记录。                                                                                |

## 任务与依赖

### Task 1：为全曲镜头编译器建立测试并实现

- [x] **Step 1: 先写测试**：覆盖空数据与纯音乐时长分片；前奏、歌词、长行、明显间奏；两条同刻行独立保留；每镜头行数与时长限制；同种子输出稳定；转场不连续重复；seek 在首尾边界的镜头索引正确。
- [x] **Step 2: 观察 RED**：运行目标测试并确认在编译器导出缺失时失败。
- [x] **Step 3: 实现最小编译器**：实现确定性 program、shot grouping、transition choice 和按绝对时间定位；边界值不产生负时长或空歌词镜头。
- [x] **Step 4: 观察 GREEN**：编译器测试通过，包含 7 秒以上间奏切镜边界回归。

**Dependencies:** None. **Parallelizable:** Yes，与 Task 2 的独立 stage 文件和 Task 4 的设置文案可并行。

### Task 2：构建舞台镜头帧和 Canvas 场景

- [x] **Step 1: 先写镜头帧解析测试**：覆盖镜头起始/中段/结束、连续 seek 得到相同帧、交叉淡化进度钳制、减少动态效果冻结运镜。
- [x] **Step 2: 观察 RED**：目标测试在 stage 导出缺失时失败。
- [x] **Step 3: 实现帧解析和图层**：实现镜头推拉/平移、灯束变换、薄雾与受限微粒；桥段使用无字舞台。不同 profile 由歌曲种子稳定选取。
- [x] **Step 4: 观察 GREEN**：舞台测试通过；追加测试验证运动速度与光强滑杆影响连续灯效，不改变交叉淡化透明度。

**Dependencies:** None for pure frame types; must align with Task 1’s shot/profile types before integration. **Parallelizable:** Yes after the shared type contract is agreed.

### Task 3：接入渲染器并实现歌词 MV 流程

- [x] **Step 1: 使用 program 输出**：按 Canvas context 缓存歌曲编译结果；歌曲 ID、歌词文本、时长或迟到歌词变化时重编译。
- [x] **Step 2: 保留独立歌词行**：每条源行单独估算时间和绘制；并行时间戳不拼成斜杠。主歌词按镜头构图放大，邻近行用低亮度层次辅助阅读。
- [x] **Step 3: 绘制阶段化流程**：前奏/桥段灯光舞台、歌词镜头、段落转场、歌词结束后的片尾卡，以及无歌词/纯音乐舞台。
- [x] **Step 4: 接播放时钟**：从音乐时间定位镜头；复用既有时钟处理暂停、倍速、seek/回退、切歌和隐藏页恢复。
- [x] **Step 5: 处理响应式与性能边界**：resize 重算文本；窄视口缩字号/减层；粒子和图层有固定上限；reduced motion 移除持续运镜、粒子漂移和强闪。
- [x] **Step 6: 代码自审**：未修改受保护视图、歌曲 schema 或外部依赖；同刻歌词保持独立，稀疏 LRC 由整曲镜头程序补足。

**Dependencies:** Tasks 1 and 2. **Parallelizable:** No; renderer integration owns the existing effect file.

### Task 4：设置与文档核对

- [x] **Step 1: 更新设置文案**：现有滑杆含义改为新舞台效果，不改变字段、默认值或范围。
- [x] **Step 2: 自审旧文档状态**：旧融合设计和旧计划标注 Superseded；新规格和计划进入 INDEX。
- [x] **Step 3: 完成时更新 CHANGELOG**：记录本次实现、静态验证和动态播放证据边界。

**Dependencies:** None for settings text; changelog completion depends on Tasks 1–3 and validation. **Parallelizable:** Settings and supersession/index edits can run independently of renderer code.

### Task 5：验证与交付

- [x] **Step 1: 运行聚焦测试**：6 个目标测试文件共 79 项通过（包括歌词行解析测试）。
- [x] **Step 2: lint 与格式检查**：本次变更的 TS/TSX 文件 ESLint 通过；Prettier 与 `git diff --check` 通过。
- [x] **Step 3: 构建**：Next.js 16 webpack 生产构建通过并生成 28 个静态页面；随后串行运行 `npx tsc --noEmit --pretty false` 通过。
- [ ] **Step 4: 本地动态核验**：通过实际歌曲观察至少前奏/歌词镜头/行交接/桥段/seek/暂停；能取到屏幕结果时记录证据。没有可播放歌曲则记为未执行，不做同步通过声明。
- [ ] **Step 5: 完成分支生命周期**：审查最终 diff，提交功能分支；在稳定 master worktree 验证干净后做 `--no-ff` 合并，随后在 master 串行复跑受影响测试与生产构建。

**Dependencies:** Tasks 1–4. **Parallelizable:** No.

## 风险与验收重点

- LRC 只提供行起点，分字点亮与间奏边界均为视觉估算；不能声称与歌手真实发音逐字同步。
- 当前没有歌曲段落/人声轨标注；分段和 mood 只按可用时间线启发式生成。
- Canvas 阴影与渐变在高 DPR 下开销较大；必须限制昂贵图层，窗口缩放后不得叠加多个未释放纹理。
- 运行态视觉比静态图更重要；构建或离线测试通过不代表动态 MV 播放已验证。

## 验证记录

- 本地 3025 页面在构建后仍返回 HTTP 200。浏览器里已有歌曲播放会在观察期间自然推进并自动切歌；为了不改动用户播放位置，本次没有 seek 到中段，因此前奏、歌词镜头进度、暂停/倍速/回退和尾卡的动态画面仍记为未验证。
- 生产构建使用项目当前 Next 配置的 `.next` 目录；没有运行 `npm run clean`，也没有删除或重建既有 `out` 目录。

## 自审清单

- [x] 每条设计要求均对应任务和验收项。
- [x] 明确真实词级数据缺失并采用已确认的估算回退。
- [x] 歌曲 ID/歌词/时长变化与 seeking 可由绝对时间重算。
- [x] 用户既有设置和本地数据保持兼容。
- [x] 最终报告列出变更文件、分支/提交、验证结果、未执行项和已知限制。
