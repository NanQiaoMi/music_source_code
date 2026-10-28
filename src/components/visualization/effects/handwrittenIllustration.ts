/**
 * 大幅插画的几何底稿（与涂鸦几何分开维护，方便单独迭代）。
 *
 * 调用方：handwrittenDoodles.drawHandwrittenDoodle —— 只有当 `specScale >= 1.2`
 * （页面上占据主要面积的大插画）时才优先使用这里返回的几何；返回 null 时
 * 回落到 handwrittenDoodles 里的小涂鸦几何。
 *
 * 约定：
 * - 坐标是局部单位坐标，形状大致落在 ±1 以内；渲染端会按 unit 与 spec.scale 缩放。
 * - 每个元素是一根折线（Point[]），相邻点连成线；渲染端会自动做手抖、笔压、
 *   双线找形、干笔飞白，这里只需要给出"骨架形状"。
 * - 若该 kind 带水彩铺底（ILLUSTRATION_WASH），stroke[0] 必须是**闭合轮廓**
 *   （首尾点相同），水彩色会填在这个轮廓里；排线（ILLUSTRATION_HATCH）也用
 *   stroke[0] 做裁剪，因此窗/纸飞机/山/太阳等同样用闭合外形打头。
 * - 纯数据、无副作用、无随机：同一 kind 永远返回同一份几何。
 *
 * 迭代要点（2026-10-28 pass4）：大插画在 1080p 上约 200–400px，先保证
 * "一眼认得出是什么"，再谈手绘细节。因此：
 * - window 给的是竖长矩形窗框（锐角笔触模式下角点保持直角，不会磨成八边形），
 *   双线框 + 窗棂 + 外挑窗台 + 窗台上的小盆栽，比例按真实窗（高 ≈ 1.75 宽）。
 * - paperplane 用「侧视飞镖」：机头、上翼前缘、后缘的折角缺口、下翼后缘，
 *   再加一道与脊线平行的折边，避免画成菱形/飞鸟。
 * - sun 是手绘的"不均整圆"：半径随角度起伏明显，轮廓 23 点（>8 点走平滑，
 *   不会被逐笔锐角规则削成多边形）；10 根射线角度不等分、长短/收笔各异，其中一根断笔。
 * - cloud / mountain 走多层体积：云是数个鼓包 + 平缓底边，山是 2–3 层山脊 + 峰尖。
 * - leaf / ripple / rain / wheat / flower / moon 一并补齐，避免大插画回落到小涂鸦。
 * - 每 kind ≤12 根折线、每根 ≤24 点，控制几何缓存与渲染成本（1080p p50 ≤1.6ms）。
 *
 * round13 微调（2026-10-29）：leaf 整组几何 ×0.88（bbox -12%，回到 Pass3 的页边体量），
 * sun 重绘（半径起伏更明显 + 断笔射线）；其余 kind 保持 pass4 的几何不动。
 */
import type { HandwrittenDoodleKind } from "./handwrittenScene";

export interface IllustrationPoint {
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

/** 需要为大插画单独提供几何的 kind；其余 kind 继续用涂鸦几何。 */
const LARGE_ILLUSTRATION_KINDS: ReadonlySet<HandwrittenDoodleKind> = new Set([
  "window",
  "paperplane",
  "mountain",
  "sun",
  "cloud",
  "flower",
  "leaf",
  "moon",
  "wheat",
  "ripple",
  "rain",
]);

/** 椭圆弧采样（局部单位坐标），返回 count + 1 个点，端点闭合时首尾重合。 */
function arcPoints(
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  from: number,
  to: number,
  count: number
): IllustrationPoint[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / count;
    return { x: cx + Math.cos(angle) * radiusX, y: cy + Math.sin(angle) * radiusY };
  });
}

/**
 * 有生气的小叶片轮廓：从 base 长到 tip，两侧宽度不同（背光侧更鼓），
 * 首尾闭合。用于叶子上的侧叶、窗台盆栽、麦穗的谷粒。
 */
function leafOutline(
  base: IllustrationPoint,
  tip: IllustrationPoint,
  halfWidth: number
): IllustrationPoint[] {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const contour: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [0.12, 0.34],
    [0.32, 0.78],
    [0.55, 0.98],
    [0.78, 0.72],
    [0.92, 0.3],
    [1, 0],
    [0.86, -0.34],
    [0.62, -0.68],
    [0.36, -0.52],
    [0.14, -0.24],
    [0, 0],
  ];
  return contour.map(([along, across]) => ({
    x: base.x + dx * along + normalX * halfWidth * across,
    y: base.y + dy * along + normalY * halfWidth * across,
  }));
}

/** 大幅插画里叶的体量系数：1.0 是 Pass4 画的大小，0.88 回到 Pass3 附近的观感。 */
const LEAF_SCALE = 0.88;

/** 按比例缩放整组几何（绕局部原点，形状、叶脉与首笔闭合关系都不变）。 */
function scaleStrokes(
  strokes: ReadonlyArray<ReadonlyArray<IllustrationPoint>>,
  factor: number
): IllustrationPoint[][] {
  return strokes.map((stroke) =>
    stroke.map((point) => ({ x: point.x * factor, y: point.y * factor }))
  );
}

/**
 * 窗：竖长双线框 + 十字窗棂 + 外挑窗台 + 窗台上的小盆栽，玻璃外还有地平线与远山。
 *
 * 结构要点（避免"花盆被线条穿过"）：
 * - 外框闭合，是水彩铺底/排线的轮廓；内框做成 U 形（左+上+右），底边交给窗台，
 *   否则内框底边会从花盆中间横穿过去。
 * - 窗台板顶边落在 y = 0.39：这正好是渲染端 window 的"窗台压线"位置
 *   （drawIllustrationAccent 的 sill，半径 0.85*0.62 比例），两者重合后不会
 *   有横线从花盆中间穿过去；盆底也压在同一条线上，花盆看起来是"坐在窗台前"。
 * - 竖窗棂只画到横窗棂为止：下半扇是一整块玻璃，被盆栽挡住，不再穿盆。
 */
function windowIllustration(): IllustrationPoint[][] {
  return [
    // 1. 外框：竖长矩形（高约 1.5 倍宽），像真窗而不是圆镜框。
    [
      { x: -0.46, y: -0.98 },
      { x: 0.445, y: -0.965 },
      { x: 0.465, y: 0.39 },
      { x: -0.45, y: 0.4 },
      { x: -0.46, y: -0.98 },
    ],
    // 2. 内框 U 形：左、上、右三边，底边交给窗台线（否则内框底边会横穿花盆）
    [
      { x: -0.4, y: 0.39 },
      { x: -0.4, y: -0.91 },
      { x: 0.385, y: -0.895 },
      { x: 0.405, y: 0.39 },
    ],
    // 3. 窗外景物暗示：一道地平线，玻璃后面不是空的
    [
      { x: -0.36, y: -0.52 },
      { x: -0.1, y: -0.515 },
      { x: 0.12, y: -0.522 },
      { x: 0.37, y: -0.512 },
    ],
    // 4. 远山：一小段山脊折线立在地平线上（玻璃外不是一面空墙）
    [
      { x: -0.33, y: -0.52 },
      { x: -0.23, y: -0.64 },
      { x: -0.13, y: -0.53 },
      { x: -0.03, y: -0.66 },
      { x: 0.08, y: -0.53 },
      { x: 0.18, y: -0.61 },
      { x: 0.3, y: -0.515 },
    ],
    // 5-6. 十字窗棂：竖棂只到横棂（下扇被盆栽挡住），横棂全宽
    [
      { x: 0.005, y: -0.89 },
      { x: 0.015, y: -0.28 },
    ],
    [
      { x: -0.395, y: -0.28 },
      { x: 0.4, y: -0.27 },
    ],
    // 7. 窗台板：顶边与窗框底边同高（y = 0.39，正好接住渲染端的"窗台压线"），
    //    盆底压在这条线上，花盆才是"坐在窗台前"而不是被线穿过。
    [
      { x: -0.62, y: 0.39 },
      { x: 0.615, y: 0.4 },
      { x: 0.555, y: 0.47 },
      { x: -0.56, y: 0.46 },
      { x: -0.62, y: 0.39 },
    ],
    // 8. 花盆：上宽下窄，盆口带沿，盆底压在窗台顶边上（一笔闭合）
    [
      { x: -0.15, y: 0.07 },
      { x: 0.15, y: 0.075 },
      { x: 0.135, y: 0.105 },
      { x: 0.085, y: 0.39 },
      { x: -0.085, y: 0.39 },
      { x: -0.135, y: 0.105 },
      { x: -0.15, y: 0.07 },
    ],
    // 9. 茎：从盆口往上略弯
    [
      { x: -0.005, y: 0.07 },
      { x: -0.03, y: 0.0 },
      { x: 0.005, y: -0.07 },
    ],
    // 10-12. 两片横展的叶子 + 顶端小芽：窗台上才有"活着"的东西
    leafOutline({ x: -0.02, y: 0.02 }, { x: -0.21, y: -0.04 }, 0.05),
    leafOutline({ x: 0.015, y: -0.04 }, { x: 0.2, y: -0.13 }, 0.046),
    leafOutline({ x: 0.0, y: -0.05 }, { x: -0.02, y: -0.19 }, 0.032),
  ];
}

/**
 * 纸飞机：侧视飞镖形。关键是尾部那条又深又窄的缺口——缺口根点靠近机头，
 * 两侧各留一片长薄机翼，才不会画成回旋镖/飞鸟；再用机头到缺口根点的折痕
 * 把上下两翼分开，表达"折纸"的厚度。
 */
function paperplaneIllustration(): IllustrationPoint[][] {
  return [
    // 1. 外形：机头（右上）→ 远翼后尖（左）→ 龙骨尖（下）→ 尾部缺口 → 机头（闭合）
    [
      { x: 0.95, y: -0.55 },
      { x: -0.9, y: 0.05 },
      { x: 0.02, y: 0.88 },
      { x: -0.25, y: 0.3 },
      { x: 0.95, y: -0.55 },
    ],
    // 2. 主折痕：机头沿机身中线压到尾部缺口，是"折纸"最关键的脊线
    [
      { x: 0.95, y: -0.55 },
      { x: 0.36, y: -0.14 },
      { x: -0.25, y: 0.3 },
    ],
    // 3. 远翼上的第二道折边：与机头上缘平行的一条窄线，暗示机翼对折过
    [
      { x: 0.6, y: -0.36 },
      { x: 0.12, y: -0.16 },
      { x: -0.3, y: 0.02 },
    ],
  ];
}

/**
 * 太阳：手绘感的"圆"——半径随角度明显起伏（不是几何圆），边缘 22 段采样保证
 * 不会被逐笔锐角规则（≤8 点走直线）削成多边形；一圈 10 根射线角度不等分、
 * 长短各异、收笔方向各不相同，其中一根是断笔（笔毛刷过纸面的断墨感）。
 */
function sunIllustration(): IllustrationPoint[][] {
  const body: IllustrationPoint[] = [];
  const steps = 22;
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * TAU;
    const radius =
      0.45 +
      Math.sin(angle * 3 + 0.7) * 0.032 +
      Math.sin(angle * 5 + 2.1) * 0.02 +
      Math.sin(angle * 7 - 0.4) * 0.012;
    body.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  // 采样到一圈时首尾理论上重合，这里显式抹平浮点误差，保证轮廓严格闭合。
  body[body.length - 1] = body[0]!;

  const rays: ReadonlyArray<{
    angle: number;
    inner: number;
    length: number;
    tipDrift: number;
    bow: number;
    broken?: boolean;
  }> = [
    { angle: -2.95, inner: 0.6, length: 0.32, tipDrift: -0.05, bow: 0.012 },
    { angle: -2.4, inner: 0.66, length: 0.2, tipDrift: 0.04, bow: -0.02 },
    { angle: -1.82, inner: 0.58, length: 0.28, tipDrift: -0.03, bow: 0.018 },
    { angle: -1.24, inner: 0.64, length: 0.26, tipDrift: 0.05, bow: -0.015 },
    { angle: -0.55, inner: 0.59, length: 0.33, tipDrift: -0.04, bow: 0.02 },
    // 断笔：一根射线断成起笔 / 收笔两截，中间留白。
    { angle: 0.08, inner: 0.65, length: 0.22, tipDrift: 0.03, bow: -0.018, broken: true },
    { angle: 0.72, inner: 0.58, length: 0.3, tipDrift: -0.06, bow: 0.016 },
    { angle: 1.38, inner: 0.64, length: 0.24, tipDrift: 0.04, bow: -0.02 },
    { angle: 2.02, inner: 0.6, length: 0.31, tipDrift: -0.03, bow: 0.014 },
    { angle: 2.66, inner: 0.66, length: 0.19, tipDrift: 0.05, bow: -0.016 },
  ];

  const strokes: IllustrationPoint[][] = [body];
  for (const ray of rays) {
    const { angle, inner, length, tipDrift, bow } = ray;
    const polar = (radians: number, radius: number): IllustrationPoint => ({
      x: Math.cos(radians) * radius,
      y: Math.sin(radians) * radius,
    });
    if (ray.broken) {
      // 断笔前半段（起笔到中段）与后半段（中后段到收笔）错开一点角度。
      strokes.push([polar(angle, inner), polar(angle + bow * 0.6, inner + length * 0.42)]);
      strokes.push([
        polar(angle + tipDrift * 0.4, inner + length * 0.64),
        polar(angle + tipDrift, inner + length),
      ]);
      continue;
    }
    strokes.push([
      polar(angle, inner),
      polar(angle + bow, inner + length * 0.55),
      polar(angle + tipDrift, inner + length),
    ]);
  }
  return strokes;
}

/** 云：三个大小不同的鼓包 + 平缓底边（闭合外形），内部两道体积线。 */
function cloudIllustration(): IllustrationPoint[][] {
  return [
    // 1. 外形：底边从右往左，绕左侧小鼓包、中间大鼓包、右侧小鼓包回到右下角
    [
      { x: 0.9, y: 0.2 },
      { x: 0.45, y: 0.25 },
      { x: -0.05, y: 0.26 },
      { x: -0.5, y: 0.24 },
      { x: -0.88, y: 0.18 },
      { x: -1.0, y: -0.02 },
      { x: -0.94, y: -0.24 },
      { x: -0.72, y: -0.37 },
      { x: -0.5, y: -0.43 },
      { x: -0.3, y: -0.31 },
      { x: -0.24, y: -0.12 },
      { x: -0.1, y: -0.06 },
      { x: 0.02, y: -0.32 },
      { x: 0.2, y: -0.53 },
      { x: 0.44, y: -0.55 },
      { x: 0.6, y: -0.4 },
      { x: 0.68, y: -0.2 },
      { x: 0.8, y: -0.16 },
      { x: 0.92, y: -0.08 },
      { x: 0.98, y: 0.06 },
      { x: 0.9, y: 0.2 },
    ],
    // 2. 底部的体积线（云不是空壳，底边有一层压暗的轮廓）
    [
      { x: -0.72, y: 0.1 },
      { x: -0.3, y: 0.03 },
      { x: 0.12, y: 0.08 },
      { x: 0.54, y: 0.04 },
    ],
    // 3. 中间大鼓包的内部弧
    [
      { x: -0.06, y: -0.2 },
      { x: 0.18, y: -0.36 },
      { x: 0.4, y: -0.3 },
    ],
    // 4. 右侧小鼓包的内部弧
    [
      { x: 0.62, y: -0.04 },
      { x: 0.78, y: 0.02 },
    ],
  ];
}

/** 山：一道闭合的主山脊（含地面）＋前方一层低山脊＋两个峰尖的雪线。 */
function mountainIllustration(): IllustrationPoint[][] {
  return [
    // 1. 主山脊：三个峰（左低、中高、右中），左右落到地面后闭合
    [
      { x: -1.0, y: 0.4 },
      { x: -0.78, y: 0.1 },
      { x: -0.6, y: -0.22 },
      { x: -0.46, y: -0.06 },
      { x: -0.3, y: 0.04 },
      { x: -0.12, y: -0.3 },
      { x: 0.1, y: -0.62 },
      { x: 0.3, y: -0.24 },
      { x: 0.48, y: -0.04 },
      { x: 0.66, y: -0.34 },
      { x: 0.84, y: 0.02 },
      { x: 1.0, y: 0.34 },
      { x: 1.0, y: 0.58 },
      { x: -1.0, y: 0.58 },
      { x: -1.0, y: 0.4 },
    ],
    // 2. 前面的低山脊：与主山脊交错，形成两层空间
    [
      { x: -1.0, y: 0.58 },
      { x: -0.66, y: 0.34 },
      { x: -0.36, y: 0.16 },
      { x: -0.06, y: 0.3 },
      { x: 0.24, y: 0.1 },
      { x: 0.56, y: 0.3 },
      { x: 0.86, y: 0.46 },
      { x: 1.0, y: 0.55 },
    ],
    // 3. 主峰雪线（折线帽）
    [
      { x: -0.02, y: -0.44 },
      { x: 0.1, y: -0.3 },
      { x: 0.23, y: -0.44 },
    ],
    // 4. 左峰雪线
    [
      { x: -0.68, y: -0.1 },
      { x: -0.6, y: 0.02 },
      { x: -0.53, y: -0.1 },
    ],
  ];
}

/**
 * 叶：闭合的尖头叶形 + 主脉 / 侧脉 + 叶柄，叶形随光照一侧更鼓。
 * 整组几何再乘 0.88（round13 微调）：Pass4 后叶在页面上比 Pass3 大了 26%，
 * 缩到当前几何的 0.88（bbox -12%）后回到"页边插图"的体量。
 */
function leafIllustration(): IllustrationPoint[][] {
  return scaleStrokes(
    [
      [
        { x: -0.9, y: 0.34 },
        { x: -0.66, y: 0.06 },
        { x: -0.34, y: -0.14 },
        { x: 0.04, y: -0.29 },
        { x: 0.42, y: -0.35 },
        { x: 0.72, y: -0.28 },
        { x: 0.92, y: -0.1 },
        { x: 0.74, y: 0.1 },
        { x: 0.38, y: 0.28 },
        { x: 0.0, y: 0.43 },
        { x: -0.38, y: 0.48 },
        { x: -0.7, y: 0.43 },
        { x: -0.9, y: 0.34 },
      ],
      // 主脉：落笔粗、收笔细，略弯
      [
        { x: -0.84, y: 0.36 },
        { x: -0.5, y: 0.18 },
        { x: -0.12, y: 0.06 },
        { x: 0.28, y: -0.04 },
        { x: 0.66, y: -0.12 },
      ],
      // 侧脉：上两对下两对，长短不一
      [
        { x: -0.46, y: 0.14 },
        { x: -0.66, y: -0.02 },
      ],
      [
        { x: -0.28, y: 0.22 },
        { x: -0.46, y: 0.38 },
      ],
      [
        { x: 0.16, y: 0.0 },
        { x: -0.02, y: 0.24 },
      ],
      [
        { x: 0.36, y: -0.08 },
        { x: 0.28, y: 0.18 },
      ],
      // 叶柄
      [
        { x: -0.88, y: 0.34 },
        { x: -1.0, y: 0.5 },
      ],
    ],
    LEAF_SCALE
  );
}

/** 涟漪：四条压扁且不同心的水上弧线 + 两道反光短线，避免读成"碗"。 */
function rippleIllustration(): IllustrationPoint[][] {
  return [
    arcPoints(0.02, 0.08, 0.98, 0.27, Math.PI * 0.04, Math.PI * 1.04, 10),
    arcPoints(-0.08, -0.01, 0.7, 0.17, Math.PI * 0.2, Math.PI * 1.14, 9),
    arcPoints(0.06, -0.06, 0.42, 0.1, Math.PI * 0.34, Math.PI * 1.28, 8),
    // 水面反光：两道短线，方向与水纹略有错位
    [
      { x: -0.24, y: -0.02 },
      { x: 0.1, y: 0.02 },
    ],
    [
      { x: -0.02, y: 0.14 },
      { x: 0.24, y: 0.17 },
    ],
  ];
}

/** 雨：疏密不匀的雨脚 + 两道积水弧。 */
function rainIllustration(): IllustrationPoint[][] {
  const drops: ReadonlyArray<readonly [number, number, number, number]> = [
    // x, 起点 y, 长度, 倾斜
    [-0.86, -0.9, 0.5, -0.14],
    [-0.64, -0.74, 0.4, -0.18],
    [-0.44, -0.88, 0.58, -0.12],
    [-0.18, -0.7, 0.44, -0.17],
    [0.06, -0.9, 0.54, -0.13],
    [0.28, -0.76, 0.38, -0.19],
    [0.54, -0.86, 0.56, -0.14],
    [0.78, -0.7, 0.46, -0.16],
  ];
  const strokes: IllustrationPoint[][] = drops.map(([x, startY, length, slant]) => [
    { x, y: startY },
    { x: x + slant * 0.55, y: startY + length * 0.55 },
    { x: x + slant, y: startY + length },
  ]);
  // 积水：右下一长条主水洼 + 左上一小块错开的水面，水洼不是一条直线
  strokes.push([
    { x: -0.52, y: 0.62 },
    { x: -0.2, y: 0.7 },
    { x: 0.14, y: 0.72 },
    { x: 0.46, y: 0.68 },
    { x: 0.76, y: 0.6 },
    { x: 0.92, y: 0.52 },
  ]);
  strokes.push([
    { x: -0.84, y: 0.74 },
    { x: -0.62, y: 0.78 },
    { x: -0.38, y: 0.76 },
  ]);
  return strokes;
}

/** 花：五瓣花冠（闭合轮廓，水彩铺底/排线用）+ 花心 + 五条花瓣脉络 + 茎与叶。 */
function flowerIllustration(): IllustrationPoint[][] {
  // 花冠外形：极坐标 r(θ) = 谷底 + 花瓣凸起，五个瓣形由 |cos(2.5θ)| 决定。
  const crown: IllustrationPoint[] = [];
  const crownSteps = 22;
  for (let index = 0; index <= crownSteps; index += 1) {
    const angle = (index / crownSteps) * TAU;
    const lobe = Math.abs(Math.cos(angle * 2.5)) ** 0.7;
    const radius = 0.3 + 0.44 * lobe;
    crown.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }

  const strokes: IllustrationPoint[][] = [crown];
  // 五条花瓣脉络：从花心指向每个花瓣尖
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = (petal / 5) * TAU;
    strokes.push([
      { x: Math.cos(angle) * 0.1, y: Math.sin(angle) * 0.1 },
      { x: Math.cos(angle) * 0.36, y: Math.sin(angle) * 0.36 },
      { x: Math.cos(angle) * 0.62, y: Math.sin(angle) * 0.62 },
    ]);
  }
  // 花心
  strokes.push(arcPoints(0, 0, 0.13, 0.12, 0, TAU, 11));
  // 茎
  strokes.push([
    { x: 0.02, y: 0.6 },
    { x: -0.04, y: 0.8 },
    { x: 0.03, y: 0.98 },
  ]);
  // 茎上的小叶
  strokes.push(leafOutline({ x: -0.02, y: 0.82 }, { x: 0.26, y: 0.7 }, 0.055));
  return strokes;
}

/** 月亮：右开口的月牙（闭合）+ 四颗闪烁十字。 */
function moonIllustration(): IllustrationPoint[][] {
  const crescent: IllustrationPoint[] = [];
  const outerSteps = 10;
  const outerFrom = -0.85;
  const outerTo = 0.95 - TAU;
  for (let index = 0; index <= outerSteps; index += 1) {
    const angle = outerFrom + ((outerTo - outerFrom) * index) / outerSteps;
    crescent.push({ x: Math.cos(angle) * 0.92, y: Math.sin(angle) * 0.92 });
  }
  // 内弧：以偏移圆心的大圆切出月牙的凹边，首尾正好接上外弧端点
  const innerSteps = 9;
  const innerFrom = 1.38;
  const innerTo = -1.29 + TAU;
  for (let index = 0; index <= innerSteps; index += 1) {
    const angle = innerFrom + ((innerTo - innerFrom) * index) / innerSteps;
    crescent.push({ x: 0.4 + Math.cos(angle) * 0.74, y: 0.02 + Math.sin(angle) * 0.74 });
  }
  crescent.push(crescent[0]!);

  const stars = (cx: number, cy: number, size: number): IllustrationPoint[][] => [
    [
      { x: cx - size, y: cy },
      { x: cx + size, y: cy },
    ],
    [
      { x: cx, y: cy - size },
      { x: cx, y: cy + size },
    ],
  ];
  return [...[crescent], ...stars(0.66, -0.56, 0.1), ...stars(0.82, -0.1, 0.06)];
}

/** 麦穗：主茎 + 五对谷粒 + 一根麦芒，粒形方向左右交替。 */
function wheatIllustration(): IllustrationPoint[][] {
  const strokes: IllustrationPoint[][] = [
    [
      { x: -0.1, y: 0.98 },
      { x: -0.06, y: 0.56 },
      { x: -0.02, y: 0.18 },
      { x: 0.03, y: -0.18 },
      { x: 0.06, y: -0.52 },
    ],
  ];
  for (let index = 0; index < 5; index += 1) {
    const y = -0.4 + index * 0.16;
    const lean = (index % 2) * 0.02;
    strokes.push(
      leafOutline({ x: -0.03, y: y + 0.03 }, { x: -0.31 - lean, y: y - 0.09 }, 0.045),
      leafOutline({ x: 0.02, y: y + 0.07 }, { x: 0.3 + lean * 0.5, y: y + 0.0 }, 0.042)
    );
  }
  // 顶端的麦芒
  strokes.push([
    { x: 0.06, y: -0.52 },
    { x: 0.1, y: -0.9 },
  ]);
  return strokes;
}

/** 每个大插画 kind 的几何；模块加载时构建一次，渲染层只读。 */
const LARGE_ILLUSTRATION_GEOMETRY: Readonly<
  Partial<Record<HandwrittenDoodleKind, IllustrationPoint[][]>>
> = {
  window: windowIllustration(),
  paperplane: paperplaneIllustration(),
  mountain: mountainIllustration(),
  sun: sunIllustration(),
  cloud: cloudIllustration(),
  flower: flowerIllustration(),
  leaf: leafIllustration(),
  moon: moonIllustration(),
  wheat: wheatIllustration(),
  ripple: rippleIllustration(),
  rain: rainIllustration(),
};

/**
 * 返回大插画的几何；未覆写的 kind 返回 null（调用方回落到小涂鸦几何）。
 * 传入非大插画 kind 或未知 kind 一律返回 null。
 */
export function getLargeIllustrationStrokes(kind: string): IllustrationPoint[][] | null {
  if (!LARGE_ILLUSTRATION_KINDS.has(kind as HandwrittenDoodleKind)) return null;
  return LARGE_ILLUSTRATION_GEOMETRY[kind as HandwrittenDoodleKind] ?? null;
}
