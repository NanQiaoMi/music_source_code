# Handwritten MV Aesthetic Pass 3（纸页的生气与排版修复）

**日期**：2026-10-27
**状态**：Done（本地验证通过，未提交）
**依据**：`scratch/viz/handwriting-research.md`（真实手书/手账调研）与上一轮 `2026-10-20-handwritten-mv-editorial-refinement.md` 的交付状态。

## 1. 问题诊断（来自实际渲染抽查 t=8–219）

1. **插画单一**：每个镜头都是同一支 sprig/wheat/ripple，页面像模板重复；
2. **纸色偏冷**：主调色名为「暖阳米纸」，实际纸底是冷灰白（#efefeb），与「温光」的身份不符；
3. **中文断行生硬**：「小时候的梦」被拆成「…小时候 / 的梦…」，「萤火虫」被拆成「萤火 / 虫…」，「乡间的 / 歌谣…」等；
4. **页面没有"被使用过"的痕迹**：没有日期/页码/边注，胶带只出现在页角且很淡，实体页饰只有一个胶带；
5. **层叠竞争**：future 行以 0.5 透明度、与正文同字号叠在下方，抢视觉焦点；
6. **图标感**：小尺寸的邮票/纸片物体看起来像通用图标。

## 2. 本轮改动

### 2.1 纸与暖光（handwrittenPalette.ts）

- 主调色「暖阳米纸」恢复低饱和暖米色：paperBase `#f1ece2`、paperLight `#faf6ee`、paperDeep `#ded5c4`、`lightWarm: #fff2d6`；墨色同步转暖（`#2a2724`）。
- 断言改为"红通道高于蓝通道 8–24、最暗通道 ≥220"，防止退回冷灰白或过黄滤镜。

### 2.2 插画系统（handwrittenScene.ts）

- 7 个 profile 的插画池从 2 种扩到 5 种，去掉星/星团这类几何图标：sprig、wheat、window、rain、cloud、paperplane、coffeeRing、ripple、leaf、flower、mountain、moon。
- 位置/旋转/尺幅加入稳定随机（横屏 2.15–2.55×unit，器乐 3.55–4.05，竖屏 4.55–4.9）。

### 2.3 页边小字与实体页饰（handwrittenScene.ts + cinematicLyricDrift.ts）

- 每页 2 条固定页边小字：右上日期（`2026.MM.DD`）、右下页码；歌词页 55% 概率再加一条边注（夜航手记 / 第 3 次听 / 慢一点…）。
- 胶带改为"压住文字块上沿或纸边"（62% 压字），旋转/位置稳定变化；58% 概率追加第二件实体：印章 34%、邮票 22%、纸片 20%、拍立得 16%、回形针 8%。单页 ≤2 件。
- 新增 `drawMarginalia()`，用纸笔色 + 手写字体渲染小字；密度提高但仍是"浅痕"。
- 插画先铺一层极淡水彩晕（highlight ≤7%）。

### 2.4 中文断行（handwrittenLayout.ts）

- 行首 weak 字符（的/地/得/着/了/过/把/被/让/给/和/与/及/或/而/就/才…）罚 1.35；
- 行尾 weak 字符（的/地/得/着）罚 0.5；
- 悬挂前缀（小/老/阿/第/初）罚 1.2；后缀字（虫/子/儿/们/头）作行首罚 1.1；
- 非词边界拆分罚从 0.72 提到 1.9（拉丁词 1.7），自然空格/标点断行保持 0；
- 保留 DP 全局平衡与强调块不拆分约束。

### 2.5 层次（cinematicLyricDrift.ts）

- future 行透明度 0.5 → 0.32，past 0.26 → 0.24，避免旧/未来句与主句抢焦点；
- 插画铅笔稿透明度 0.68 → 0.74，水彩晕作为焦点色。

## 3. 验证

- 截图：`scratch/perf/round3/v3-sheet.png`（20 个时间点）、`final-sheet.png`（5 调色板 / 手机 / 超宽）、`v3/` 单帧。
- 测试：effects 16 文件 / 172 tests 通过；`tsc --noEmit` 0 error；改动文件 ESLint 0 error。
- 临时 QA：`/dev/lyric-stage` harness 已删除，3025 主应用返回 200、harness 404。
- 性能：harness 内实测 draw 中位 8.3ms（headed，1080p）/13.5ms（headless 软渲染）；由于采样被浏览器节流（2.6s 仅 27–29 帧）且缺少同环境交付基线，不能与历史 1.1ms 数字直接比较，性能需在 S5 渲染任务中重新立基。
- 确定性：同一 `t` 连续两张截图像素差 2.3%（浮尘/光斑按真实时间更新，属既有设计）；版式、字位、页饰组成由 seed + musicTime 决定，稳定。

## 4. 验收补丁 3.1（2026-10-27 晚）

继续同一轮时补掉 §4 里的第 3 条与"咖啡环/邮票图标感"：

- **竖屏行数上限**：`wrapHandwrittenPhrase` 新增可选 `maxLines`，`balanceHandwrittenLines` 在可放下时把行数压到调用方要求的上限；runtime 对 `height/width > 1.3` 传 `maxLines: 2`，缓存 key 带上该参数。390×844 的「回家吧 回到最初的美好」由 3 行（173/107/280px）变为 2 行（280.8/280.5px）。
- **竖屏胶带**：`resolveDecorations` 接收 `isTall`；竖屏不再"压字"（会盖住上一行/未来行），固定页边。
- **插画池去图标**：coffeeRing 退出全部插画池（窗、叶、纸飞机、月、云、涟漪、麦穗、花、山保留），移动端/桌面不再出现"巨大咖啡环"；实体页饰池移除 postageStamp（小尺寸仍像图标），改为印章/纸片/拍立得/回形针，并补充一种"顶部纸片"位。
- 新增 layout 单测：`maxLines` 上限生效且不丢字；effects 16 文件 / **173 tests** 通过，`tsc --noEmit` 0 error，改动文件 ESLint 0 error。
- 截图：`scratch/perf/round4/mobile-compare.png`（390×844 前后）、`round4/desktop2-sheet.png`（t=44/60/104/219）。
- 仍未解决：插画笔压/水彩铺色、语义化配图、S5 性能基线、内置字体决策（第 1/2 条图标感只解决了咖啡环与邮票，云/叶仍偏简单）。

## 5. 插画质感补丁 3.2（2026-10-27 晚）

继续同一轮时补掉 §5 第 1 条里最显眼的"空线框"感：

- **水彩铺底**：`ILLUSTRATION_WASH` 对 leaf/cloud/window/flower/moon/mountain/sun/heart 的首笔闭合轮廓填 8–16% 淡彩（强调色/高光色），铅笔稿不再只是空心线；插画区域另叠一块偏移的淡淡强调色晕，避免水彩晕是完美圆。
- **炭笔颗粒**：`StrokeStyle.grain` 只对大幅插画开启，沿笔画撒 ≤18 个 0.45–1.25px 暗色颗粒，弱化"矢量描边"；低画质档（quality ≥ 2）自动跳过。
- **笔压加粗**：插画基准线宽 `unit×0.042` → `unit×0.056`（1080p 约 3.6px→4.8px），配合已有的起收笔 taper ribbon，远看有轻重。
- 水彩色量刻意压低（leaf 0.16 / cloud 0.10 / window 0.14 / sun 0.10），避免又回到"米黄滤镜"。
- 证据：`scratch/perf/round5/illustration-crops.png`（窗/叶/云/麦穗局部 前后对比）、`round5/illustration-after.png`；effects 16 文件 / **173 tests** 通过，`tsc --noEmit` 0 error，改动文件 ESLint 0 error，临时 harness 已删除（3025 主应用 200，`/dev/lyric-stage` 404）。
- 仍未解决：云/叶仍是折线拼合、没有真正的笔刷纹理；S5 性能基线、内置字体决策未动。

## 6. 语义配图 3.3（2026-10-27 深夜）

把"插画按 profile 轮换"改成"优先生画这一句里的具体意象"：

- `resolveSemanticIllustrationKind(text, seed)`：9 条确定性规则——纸飞机/飞/风→paperplane；雨/泪/哭→rain；家/回/城堡/窗→window；阳光/晴/笑→sun；梦/星/夜/月光→moon；稻/麦/田/乡→wheat；草/花/树/山→sprig/flower；海/河/流/水→ripple；云/天/远→cloud。未命中返回 null，仍用 profile 池。
- 取词：先看镜头首句（`resolveShotFocusText`，锁在 shot.startTime，整页不变）；首句没有意象时取该镜头前 3 句合并文本兜底（`resolveShotAllText`）。
- 运行时只在 `drawShotIllustrations` 覆盖 `illustration.kind`，不改变位置/尺幅/水彩铺底逻辑；插画主体因此随歌词变化，同时保持每页 eng 只有一个主体。
- 顺手改进 `rain` 笔画：从 5 条斜线改为 8 滴长短不一 + 底部积水弧，`哭→雨` 时不再像刮痕。
- 新增 2 条 scene 单测（意象映射、无意象 null 且确定性）；effects 16 文件 / **175 tests** 通过，`tsc --noEmit` 0 error，改动文件 ESLint 0 error。
- 证据：`scratch/perf/round6/semantic-after.png`（家→窗、稻→麦、哭→雨、纸飞机→纸飞机、回家→窗）、`round6/semantic-compare2.png`（同时间点前后）。
- 仍未解决：语义只取镜头前 3 句、不跨镜头组合；interlude/纯器乐没有语义（用 profile 池）；S5 性能基线、内置字体决策未动。

## 7. 速写质感 3.4（2026-10-27 深夜）

补 §7 第 1 条里最影响"像不像手绘"的部分——云/叶的折线拼合与单遍轮廓：

- **leaf 几何**：2 笔（轮廓+直叶脉）扩到 9 笔：略弯主脉、三对侧脉、叶柄；轮廓内已有水彩铺底，近看是一枚速写叶子。
- **cloud 几何**：2 笔扩到 7 笔：内部两道体积线 + 下方 3 条短雨线；轮廓内保留淡彩，云不再只是一个带底的轮廓。
- **第二遍找形**：大幅插画在 `quality < 2` 时，用 variant1 草稿线整体偏移 1–2px、`globalAlpha≈0.26` 再铺一遍，再做正式描边，形成"双线/重描"的手绘感；弱机档自动跳过。
- 只影响插画（`isLargeIllustration`），不增加涂鸦/文字负担；effects 16 文件 / **175 tests** 通过，`tsc --noEmit` 0 error，改动文件 ESLint 0 error，临时 harness 已删除（3025 应用 200、`/dev/lyric-stage` 404）。
- 证据：`scratch/perf/round7/sketch-compare.png`（云/雨局部前后）、`round7/after-sheet.png`（片头/窗/语义/云/雨）。
- 仍未解决：云/叶仍是折线+近似水彩，没有真正的笔刷纹理；S5 性能基线、内置字体决策未动。

## 8. 语义配套笔触 3.5（2026-10-27 深夜）

把"语义插画"从"换一个主体"推进到"主体带动作/环境"：

- **语义规则补全**：新增 leaf（落叶/树叶/树/叶/枝）与 mountain（山/峰/坡）；规则顺序保证"风"仍优先画纸飞机、"远"不会被云抢走山景。
- **配套笔触**（`resolveIllustrationAccent`）：纸飞机 → 3 条速度线；雨 → 3 个落滴；月亮 → 2 个闪点；窗 → 窗台线 + 一道短影。只在语义插画上出现，普通 profile 插画不叠加，避免噪音。
- **实现位置**：`handwrittenScene` 里做可测的纯映射（accent 类型），`cinematicLyricDrift` 只在插画绘制后追加几笔短铅笔线；确定性、无随机历史，弱机档同样很便宜（≤5 条短线段）。
- 新增 1 条 scene 测试（叶/山主题 + accent 映射）；effects 16 文件 / **176 tests** 通过，`tsc --noEmit` 0 error，改动文件 ESLint 0 error，临时 harness 已删除（3025 应用 200、`/dev/lyric-stage` 404）。
- 证据：`scratch/perf/round8/accents-compare.png`（窗/雨/纸飞机/窗局部前后）。
- 仍未解决：accents 只是几根线，还缺真正的笔刷纹理；窗的 sill 在部分裁切下不明显；S5 性能基线、内置字体决策未动。

## 9. 插画几何 3.6（2026-10-28 凌晨）

继续同一轮，处理实际渲染里最"出戏"的两处几何插画，并修掉颗粒在绘制过程中的两个缺陷：

- **窗（window）重绘**：竖长双线窗框（外框 + 内框）+ 一横一竖窗棂 + 窗台两道线 + 窗台小盆栽；删掉原来的斜穿窗格光线、两侧窗帘褶和风铃挂绳（渲染出来像"篮筐/灯笼"）。roughness 单独降到 0.009–0.015，水彩铺底 alpha 0.14 → 0.05，不再像被填满的灯笼。
- **涟漪（ripple）重绘**：三条压扁的同心弧（半径 0.92 / 0.64 / 0.38，纵向压扁 0.3 / 0.21 / 0.13）+ 两道水面反光短线；roughness 与麦穗同级（0.012–0.021）。原来三条完整同心圆弧在页面上读成"面碗"。
- **几何插画不再铺圆形水彩晕**：drawShotIllustrations 对 window / rain / ripple 跳过径向水彩晕与第二块强调色晕（这两层是"色块感"的来源）；叶/云/日光等有机形状保留。
- **炭笔颗粒两处修复**（3.5 收尾）：颗粒只落在已经完全画出的笔画上（否则出笔阶段会出现漂浮黑点）；颗粒半径/抖动按 specScale 反缩放，1080p 下大插画颗粒回到 0.4–1.9px（此前被 ctx.scale 放大成 1–5px 粗黑点）。
- **干笔飞白复核**：上一段工作（3.5 之后被上下文打断的那一轮）加入的纸色"飞白"短划保留——仅在大插画完全画出后叠加、弱机档跳过；1080p 下很轻，属于"近看有断墨"的细节，不改变页面整体。
- 验证：effects 16 文件 / **176 tests** 通过，tsc --noEmit 0 error，改动文件 ESLint 0 error；harness 暂停模式截图 scratch/perf/round10/final-sheet.png（20 个时间点：片头/窗/雨/麦穗/云/水纹/片尾）、round10/geometry-compare.png（几何前后对比）、round10/win-window-_、round10/win-ripple-_（局部）。
- 仍未解决：插画仍是折线 + 双线 + 水彩近似，没有真正的笔刷纹理；124s 之后的器乐/片尾段页面仍偏空；S5 性能基线、内置字体决策未动。

## 10. 收束编排 3.7（2026-10-28 凌晨）

补上「翻页 → 落款 → 合上本子」的最后一段：原来歌曲最后 7 秒是落款页（`drawEndingCredits`，三种排版 + 手写署名 + 印章），但画面停在落款页不动，没有「合上」的动作。

- **合上本子（新）**：`drawClosingBook`，歌曲最后 `CLOSING_BOOK_DURATION = 3.4s` 内连续两段：
  1. **折页 0–2.7s**：一页纸从右侧翻过来，纸背（不透明纸色渐变 + 折痕外侧细影/内侧亮边/压痕线 + 极淡纸纤维）自右向左盖住页面；折痕位置由 `easeInOutCubic(progress/0.8)` 驱动，盖完后折痕扫出画布。
  2. **封面 2.1–3.0s 起淡入**：暖深色封皮（`palette.desk`）+ 左上受光、左侧书脊阴影、压印内框、书签带、竖排书名 / 艺人、右下角「完」印章；完成后作为最终定格帧（不做黑场）。
- **确定性**：折痕、封面淡入、印章进度全部由 `musicTime` 与 `program.duration` 派生；暂停 / seek / 倍速一致，不依赖墙钟或随机历史（`stableRandom` 固定 seed）。
- **reducedMotion**：直接跳过合上动画，保留原落款页，不产生新的持续动画。
- **尾段长度的说明**：QA harness 的合成 LRC 只写到 124s（歌曲 223s），因此看起来有约 90s 空尾；真实 LRC 通常写到接近歌曲结束，实际「器乐尾段」只有几秒到十几秒。合上动画按「距歌曲结束的时间」触发，所以两种情况下都成立；超长器乐尾段仍走既有的「余韵 echo + 插画」页，未改成便笺回看（列入下一轮）。
- 验证：effects 16 文件 / **176 tests** 通过，`tsc --noEmit` 0 error，改动文件 ESLint 0 error；harness 暂停模式截图 `scratch/perf/round11/closing4-sheet.png`（t=220.2→222.98：落款 → 折页 → 纸背 → 封面）与 `round11/closing4/` 单帧。
- 仍未解决：落款页被折页遮住的时间偏早（约 3.6s 可读，封面上停留 1.5s）；封面配色只用调色板 desk，未做多主题封皮。

## 11. 插画笔刷质感 3.8（2026-10-28 凌晨）

把 3.6 里"验证后保留但几乎看不见"的干笔飞白，改成按笔画长度分配、可读的毛边与断墨：

- **按长度分配**：遍历每根 `length >= 0.9` 的笔画，按长度给 3–18 个飞白点（长笔画密、短笔画少），不再是从 24 个随机点里撞运气。
- **两种落点**：45% 落在笔道边缘外侧（宽度 0.45–0.8 倍线宽）做**毛边**，55% 落在笔道中间做**断墨**；单个飞白是 1.1–3.2 倍线长、0.26–0.6 倍线宽的纸色椭圆（`paperLight`，alpha 0.84–0.9）。
- **短线保护**：`length < 0.9` 的笔画（雨滴、闪光、叶脉碎笔）不打断，避免被切成两截（3.6 的雨滴白断就是这个问题）。
- **收笔干痕**：前 4 根笔画的收笔处压一小段 `paperBase` 细痕，模拟抬笔时笔毛蹭过。
- **画质与确定性**：只在 `isLargeIllustration && quality < 2` 生效（弱机档跳过）；全部由 `stableRandom(spec.kind:dry, …)` 与 `musicTime` 派生，同一 `t` 两帧像素差 **0.0%**；reducedMotion 不受影响（静态几何）。
- 验证：effects 16 文件 / **176 tests** 通过，`tsc --noEmit` 0 error，改动文件 ESLint 0 error；证据 `scratch/perf/round11/brush-compare3.png`（窗/麦穗/雨/云/叶 前后）、`round11/brush-zoom.png`（3x 局部）、`round11/brush-pal2|pal4`（樱粉/夜航调色板下同样成立）、`round11/det-a|det-b`（确定性对照）。
- 仍未解决：小涂鸦（scale < 1.2）仍是均匀细线，只有大幅插画有笔刷质感；飞白密度对不同形状（云 vs 窗框）仍是同一套参数。

## 12. S5 性能基线 3.9（2026-10-28 凌晨）

把"性能需复核"补成可回归的数字：

- **方法**：dev harness 里给 `drawCinematicLyricDrift` 外包 `performance.now()` 计时，新增 `window.__viz.perf.reset()/stats()`；`play=1` 时音乐时间按真实播放推进（不是静态暂停帧）。headed Chrome（关闭 headless）、1920×1080 dpr1、每点 4s、三个页面类型 t=30（歌词页）/62.5（窗插画页）/110.5（窗+文字页），各 3 轮。
- **结果**（draw JS 时间，ms）：**p50 中位 1.0 / 最大 1.3；p95 中位 1.5 / 最大 1.9**；p99 2–6.9（GC / 纸纹缓存抖动）；总样本 1277；0 报错。→ 满足目标 p50 ≤ 1.6、p95 ≤ 2.5。
- **dpr2 压力**（等效 4K 画布，t=62.5，2 轮）：p50 1.4、p95 2.35–2.5、p99 ≤ 3.9。
- **口径说明**：数字来自 dev server（未压缩、含 React dev 开销）+ headed Chrome 且窗口可能被后台节流（fps ≈ 35，掉帧不等于绘制预算），用于回归对比而非对外出厂指标；测量脚本 `scratch/perf/measure_s5.py`，原始数据 `scratch/perf/s5/baseline.json`、`scratch/perf/s5/stress-dpr2.json`。
- 仍未解决：未测生产构建（`next build` + 独立端口）下的数字；S5 若对外发布应补一次 prod 基线。

## 13. 内置中文手写字体决策 4.0（2026-10-28 凌晨）

现状：`HANDWRITTEN_FONT_STACKS` 只用系统字体（行楷 → 华文行楷/STXingkai、楷体/STKaiti、仿宋、圆体），不打包任何字体。**Windows / macOS / iOS 都有楷体或行楷**，Android / 部分 Linux 没有 → 回落到宋体/衬线，手写感丢失但可读。

候选（均为 SIL OFL 1.1，可自托管；文件已下载到本地仅作对比、未入库）：

| 字体                      | 风格                                | TTF     | woff2 分片合计   | 按需一歌粗估 | 测试歌词覆盖率 |
| ------------------------- | ----------------------------------- | ------- | ---------------- | ------------ | -------------- |
| Long Cang（龙藏体）       | 细笔行楷，最接近当前 STXingkai 观感 | 5.15 MB | 3.22 MB（92 片） | ~0.3–0.8 MB  | 40/40          |
| Zhi Mang Xing（志莽行书） | 毛笔行书，比当前更随意              | 4.05 MB | 2.57 MB（92 片） | ~0.3–0.8 MB  | 40/40          |
| Ma Shan Zheng（马善政）   | 毛笔楷书，明显更粗更重              | 5.86 MB | 3.57 MB（92 片） | ~0.3–0.8 MB  | 40/40          |

对比渲染见 `scratch/viz/fonts/font-candidates.png`（与 STXingkai / 楷体 同字号并排）与 `font-compare.png`；数据 `scratch/viz/fonts/candidates.json`。

**结论（推荐 A，需产品确认）**：

- **A（推荐，0 字节）**：继续用系统字体栈 + 补全回退名（行楷/楷体/仿宋/宋体/Noto Serif CJK）。桌面端（Windows/macOS）与 iOS 观感已经成立；Android/Linux 退化为衬线但可读。**当前发布不做内置**，避免为单个效果增加 2.6–3.6MB 资源与字体异步加载/重绘复杂度。
- **B（若产品要求 Android/Linux 也保持手写观感）**：自托管 **Long Cang**（最接近现状，woff2 92 分片 + `unicode-range` 按需加载，一首歌实际只拉 0.3–0.8MB；OFL 允许打包，需随附 OFL 文本；实现需 `next/font/local`/`@font-face` + `document.fonts.load` 后重绘 + 字体键加入缓存 key）。次选 Zhi Mang Xing。
- **C 不推荐**：Ma Shan Zheng 过粗，会把现有"克制手账"气质改成"重墨海报"。

**待用户拍板**：选 A（本次不内置）还是 B（内置 Long Cang）。选定前不影响其余交付；若选 B，另开一轮实现字体加载与回退。

## 14. 未解决 / 下一轮

1. 插画仍是折线拼合，水彩/双线/飞白只是近似；云/叶等简单形状仍偏"图标"（窗/涟漪已重绘，窗的框线在特写下仍略圆）；
2. 语义已能按句选物并带动作线，但只取首句/前 3 句，没有"整首叙事"层面的配图编排；
3. 超长器乐尾段（真实 LRC 缺失或纯器乐曲）仍是"余韵 + 循环插画"，可考虑用便笺/拍立得回看前文意象；落款页可再延长 1–2s；
4. 内置字体：等产品确认 A/B（见 §13）；若选 B 需实现字体按需加载与缓存重绘；
5. 生产构建性能基线未测；S5 对外发布前补一次。

## 15. 交付清单（2026-10-28）

- **代码**：`src/components/visualization/effects/` 下 cinematicLyricDrift / handwrittenDoodles / handwrittenScene / handwrittenPalette / handwrittenLayout（含对应测试）。效果 ID `cinematicLyricDrift`、名称「温光浮字」、全部设置字段与持久化未变。
- **文档**：本计划（§1–§8 为 3.0–3.5，§9–§13 为 3.6–4.0 收尾记录）、`docs/nbl/plans/INDEX.md`、`docs/nbl/specs/2026-10-19-handwritten-lyric-mv-design.md`。
- **证据（`scratch/`，未入库）**：`perf/round10/final-sheet.png`、`round10/geometry-compare.png`；`perf/round11/closing4-sheet.png`、`brush-compare3.png`、`brush-zoom.png`、`brush-pal2|pal4/`；`perf/s5/baseline.json`、`perf/s5/stress-dpr2.json`；`viz/fonts/font-candidates.png`、`viz/fonts/candidates.json`。
- **验证**：effects 16 文件 / 176 tests 通过；`npx tsc --noEmit` 0 error（前提：已删临时路由后清掉 `.next/dev/types/app/dev` 的旧类型缓存）；改动文件 ESLint 0 error；Prettier 通过；3025 主应用返回 200，临时 harness `/dev/lyric-stage` 已删除（404）。
- **性能**：1080p dpr1 draw p50 1.0ms / p95 1.5ms（最大 1.3 / 1.9），dpr2 压力 p50 1.4 / p95 2.35–2.5ms；方法见 §12。
- **待确认 / 后续**：内置字体 A/B（§13，默认按 A 不内置交付，B 的实现路径与体积已备）；生产构建性能基线；超长器乐尾段的"回看便笺"为可选后续。
- **范围说明**：临时 QA harness 已删除；`scratch/` 证据不入库；并行工作线的 `src/app/layout.tsx`、`docs/MIMI_MUSIC_PLAYER_FULL_MANUAL.md` 未纳入本次改动。
