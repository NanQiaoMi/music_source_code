# Handwritten MV Aesthetic Pass 4（速写的体量与纸的材质）

**日期**：2026-10-28
**状态**：Done（本地验证通过）
**依据**：Pass 3 §14「未解决 / 下一轮」第 1 条（"插画仍是折线拼合，水彩/双线/飞白只是近似；云/叶等简单形状仍偏图标"）与用户连续「继续」迭代。

## 1. 问题诊断（来自 Pass 3 交付后的实际渲染抽查）

1. **大插画只有轮廓**：水彩是均匀 alpha 的平涂多边形，铅笔线是一条等宽闭合曲线，没有明暗、没有压重，近看像矢量图标；
2. **几何角点被磨圆**：旧渲染对所有折线做 Catmull-Rom 平滑 + 法线抖动，窗框被磨成"圆角八边形"、纸飞机/山脊没有尖角；
3. **水彩不像水彩**：单层均匀填充，没有颜料沉积、没有干燥后的水痕边，看起来像荧光笔色块；
4. **纸面在 100% 缩放下几乎不可见**：纤维/茶渍/折痕烘焙得很淡，全屏看仍像均匀渐变底；文字是纯矢量字形，墨与纸没有交互；
5. **和纸胶带是"橙色矩形"**：只有轮廓锯齿，缺厚度、纹理、褶痕与投影。

## 2. 本轮改动

### 2.1 逐笔锐角笔触（handwrittenDoodles.ts）

- `roughen()` 新增 `sharp` 模式：线性细分 + 法线抖动，**角点原样保留**，不再把矩形磨成八边形；
- 锐角是**逐笔**判定而不是按 kind 整体：`SHARP_CORNER_KINDS`（window / paperplane / mountain / radio / cassette）里点数 ≤8 的骨架线走直线（窗框、窗棂、窗台、花盆、山脊），点数多的有机形状（叶片 12 点、云、山弧）仍走平滑曲线；
- 几何缓存 key 带上逐笔模式签名，同一 spec 不重复烘焙。

### 2.2 铅笔排线明暗（handwrittenDoodles.ts）

- 新增 `ILLUSTRATION_HATCH`：按 kind 配「闭合裁剪轮廓 + 排线角度/间距 + 光向 + 可选交叉排线」，在背光侧用一组平行短线压出体积；
- 排线透明度沿光向从 0 渐变到目标值（`createLinearGradient`），暗部再叠一层反向交叉排线（leaf/mountain/paperplane 有 cross）；
- **性能**：所有排线合并成一个 `Path2D` 并缓存在几何对象上，每帧成本 = 1 次 clip + 1–2 次 stroke（不是 20–40 次 stroke）；
- 只在形状基本画完（visible ≥0.72）后出现，避免出笔阶段出现漂浮排线；弱机档（quality ≥2）跳过；
- 覆盖 kind：leaf / cloud / flower / moon / window / mountain / paperplane / heart（sun 不加排线——太阳的体积靠水彩晕，压线会像毛线球）。

### 2.3 水彩铺底升级（handwrittenDoodles.ts）

- 从"一层均匀色块"改为：底色 + 2 团不规则沉积（位置/尺寸由 kind + 固定 seed 决定）+ 轮廓内侧一圈**水痕**（水彩干燥后颜料在边缘堆积的深边）；
- 新增`innerStroke/innerAlpha`：窗玻璃/月晕这类"内部还有一层光"的插画，在内层轮廓里再铺一层更淡的暖色，窗不再是空框；
- 轮廓 `Path2D` 按几何缓存，避免每帧新建路径；叶子水彩 alpha 0.16→0.12，避免高光笔感。

### 2.4 大插画几何重绘（新文件 handwrittenIllustration.ts）

- 新增独立模块（Lead 建骨架并接入 `drawHandwrittenDoodle`：只有 `specScale ≥1.2` 的大插画优先使用，返回 null 回落旧几何），由队友完成 11 个 kind 的真实几何：
  window 12 根/75 点、paperplane 3/11、sun 10/39、cloud 4/30、mountain 4/29、leaf 7/28、ripple 5/34、rain 10/33、flower 9/65、moon 5/30、wheat 12/127；
- window：竖长双线框（内框改 **U 形**，底边交给窗台）+ 十字窗棂（竖棂止于横棂，不穿盆栽）+ 外挑窗台 + 窗台小盆栽 + **窗外地平线/远山折线**；窗台板顶边对齐渲染端 accent 的 sill 压线（y=0.39），花盆不再被横线穿过；
- paperplane：远翼/近翼/主折痕/龙骨缺口（侧视飞镖，不是菱形）；sun：起伏圆 + 9 根不等分长短射线；cloud：多鼓包；mountain：2–3 层山脊 + 峰尖；
- 约束：纯数据、无随机、模块加载时构建一次；单 kind ≤12 根折线、≤24 点/根；带水彩的 kind 首笔闭合；新增 6 条单测（非空/闭合/坐标与点数/不自交/确定性/辨识度）。

### 2.5 纸面材质 + 纸牙覆盖层（handwrittenPaper.ts）

- 纸面材质**全部烘焙进原缓存画布**（每帧仍只有 1 次 drawImage）：多尺度斑驳（大晕染 8 处 + 中尺度絮团 24 处 + 云状值噪声两层，soft-light 只改明度）、96 cells 纸牙噪声瓦片（1 设备像素/颗粒，棋盘双 seed 平铺）、纤维 620 根/1920、微颗粒 520、纸屑/深色纸屑各 30、压痕 1 条、橡皮浅痕 1 处；全局亮度偏差 −0.16%、色相偏差 <0.2（不脏不黄），纸边/桌面/光照/暗角/主色未动；
- 新导出 `drawHandwrittenPaperTooth()`：在**帧末**把同一张纸的极淡微纹理叠到文字/插画上（overlay 合成），让墨与铅笔线"长在纸上"；默认 **baked** 方案（预烘整屏覆盖层 + 每帧 1 次 drawImage，LRU 2 条/6M 像素预算），保留 `mode:"pattern"` 可选；quality2 跳过、quality1 减半；无 DOM 安全返回；
- 接入点：`cinematicLyricDrift.renderFrame` 末尾（合上本子之后），strength 0.6（alpha 0.072，ink 像素 ±2 级，不糊字）。

### 2.6 和纸胶带实物化（handwrittenDoodles.ts）

- 撕口改为两端各自的不规则锯齿 + 上下边轻微起伏（不再是圆角矩形）；增加投影、和纸斜纹、纵向褶痕（亮/暗成对）、外圈压暗 + 内侧受光亮边；强调色胶带用 highlightLine 偏朱红。

### 2.7 性能收口

- 排线路径 / 水彩轮廓 Path2D 缓存（省掉每帧新建路径与 20–40 次 stroke）；
- 干笔飞白单笔 ≤8 个、炭粒预算 ≤12（视觉几乎不变，填充调用明显减少）；
- 纸牙覆盖层由 pattern 全屏 fillRect（headed 实测 ~0.5ms/帧）改为 baked drawImage（~0.2–0.3ms/帧）。

## 3. 验证

### 3.1 视觉证据（scratch/perf/round12/，未入库）

- before / after 各 18 个时间点（14.5→221.2s，paused 定格）+ 竖屏 390×844@2 两帧；
- 整页 |after−before| 像素差 mean 2.45–3.57/255、max 138–164（纸纹 + 笔迹变化），收尾帧 t=221.2 mean 0.75 最小；
- 无黑帧/白帧、无文字消失（含淡出帧）、插画无错位/越界裁切、翻页收尾正常；
- 文字区对比度不变：ink_ratio 0.1437→0.1429、ink_p10 48→48（纸面材质没有抢字）；
- 证据索引：[REPORT.md](scratch/perf/round12/REPORT.md)、[before-sheet](scratch/perf/round12/before-sheet.png)、[after-sheet](scratch/perf/round12/after-sheet.png)、[compare-final](scratch/perf/round12/compare-final.png)、[diff-final](scratch/perf/round12/diff-final.png)、[pairs-final/](scratch/perf/round12/pairs-final/)。

### 3.2 测试与静态检查（FINAL FREEZE 源码）

- `npx vitest run src/components/visualization/effects`：**17 files / 188 tests 通过**（新增 12 条：doodles +3、handwrittenIllustration +6、handwrittenPaper +3）；
- `npx tsc --noEmit`：exit 0；
- `npx eslint`（4 个改动源文件 + 4 个测试）：0 error / 0 warning；
- Prettier：改动文件全部符合。

### 3.3 确定性与冒烟

- FINAL FREEZE 源码重抓 18 帧与已入档 after 逐像素一致（frames=18 identical=18 diff=0），同一 t 可复现；
- `GET http://localhost:3025/` → 200；临时 QA 页 `/dev/lyric-stage` 提交前已删除并确认 404。

### 3.4 性能（1080p dpr1，headed Chrome，measure_s5.py，runs=3 / 4s / t=30,62.5,110.5）

| 指标（aggregate）              | before（s5/baseline.json，Pass4 前） | after | Δ      |
| ------------------------------ | ------------------------------------ | ----- | ------ |
| p50_median                     | 1.0ms                                | 1.2ms | +0.2ms |
| p50_max                        | 1.3ms                                | 2.0ms | +0.7ms |
| p95_median                     | 1.5ms                                | 2.6ms | +1.1ms |
| p95_max                        | 1.9ms                                | 3.4ms | +1.5ms |
| fps_median（rAF 受限，仅参考） | 35.1                                 | 36.9  | +1.8   |

分时间点 p50：t=30 0.8→0.9ms、t=62.5 **1.3→1.9ms**、t=110.5 1.0→1.2ms。
预算判定（1080p p50 ≤1.6ms）：**aggregate 达标**；最重的窗插画页 t=62.5 超预算 +0.6ms（p95 尾部 +1.4ms）是已知回退点，已保留数据（perf-after.json / perf-compare.json / perf-after-confirm-62_5.json），后续若要严格回预算可优先降大插画路径的填充次数。

## 4. 未解决 / 下一轮

1. **云/山/花/月的真机截图未覆盖**：QA 歌词采样集没有这些页（t=54.5 实际是"哭→雨"），目前只有骨架预览 + 单测校验，需真实歌曲验证；
2. 纸牙覆盖层是屏幕空间静态层，镜头 zoom≤1.05 / rotate≤0.6° 时与纸纹有亚像素级错位（肉眼不可辨）；若要严格对齐需传相机做反向偏移；
3. 4K CSS / 高 dpr 下纤维与颗粒密度线性上升，未设上限；
4. 生产构建性能基线仍未测（Pass 3 §12 / S5 遗留）；
5. 内置中文手写字体 A/B 仍未拍板（Pass 3 §13，默认 A 不内置交付）；
6. 超长器乐尾段的"便笺回看前文意象"（Pass 3 §14-3）未做；
7. paperplane 仍是最难辨识的一类，若视觉验收仍偏"燕子"可再压一版；
8. **性能已知回退**：最重的窗插画页（t=62.5）p50 1.3→1.9ms、p95 1.9→3.3ms（新增排线/水彩/纸牙覆盖层的成本），aggregate p50 1.2ms 仍达标；若后续要严格回到 1.6ms 预算，优先减少大插画路径的大面积 path 填充（ghost 重描/spray 颗粒）。

## 5. 交付清单（2026-10-29）

- **代码**：新增 `src/components/visualization/effects/handwrittenIllustration.ts`（+ 单测）；修改 `handwrittenDoodles.ts`（+ 单测）、`handwrittenPaper.ts`（+ 单测）、`cinematicLyricDrift.ts`（+ 测试 mock）。效果 ID `cinematicLyricDrift`、显示名「温光浮字」、全部设置字段与持久化未变；未改 Home / Player / 全屏歌词等核心视图，未改歌曲/歌词/存储格式。
- **文档**：本计划、`docs/nbl/plans/INDEX.md`。
- **证据（`scratch/`，未入库）**：`perf/round12/`（before/after 各 18 帧、竖屏 2 帧、compare/diff/pairs、perf-before/after/compare、REPORT.md）；`perf/round12/geometry/`（11 kind 骨架预览与前后对比）；`perf/round12/paper/`（纸面/纸牙局部对比与 metrics）。
- **范围说明**：临时 QA harness 已删除；并行工作线的 `src/app/layout.tsx`、`docs/MIMI_MUSIC_PLAYER_FULL_MANUAL.md` 未纳入本次改动。
- **已知回退 / 待办**：窗插画页（t=62.5）p50 1.9ms 超 1.6ms 预算；纸纹近看有灰绿颗粒感、叶 t=14.5 斜排线偏均匀且尺寸 +26%、太阳几何未重绘、云/山未做真机截图——均记入 §4，等产品/视觉验收再决定是否回调。
