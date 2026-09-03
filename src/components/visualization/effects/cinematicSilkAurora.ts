/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface BokehOrb {
  x: number;
  y: number;
  z: number;
  radius: number;
  baseAlpha: number;
  vx: number;
  vy: number;
  hueShift: number;
  pulsePhase: number;
  shimmerPhase: number;
}

interface Firefly {
  x: number;
  y: number;
  baseX: number;
  prevX: number;
  prevY: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  vy: number;
  spiralSpeed: number;
  spiralRadius: number;
  phase: number;
  hueOffset: number;
  life: number;
  maxLife: number;
}

// 专属独立内存对象池 (0 GC 垃圾回收卡顿)
let localBokehPool: BokehOrb[] | null = null;
let localFirefliesPool: Firefly[] | null = null;

// EMA 亚像素平滑寻峰追踪器状态 (彻底根除高光斑跳跃瞬移)
let smoothedPeakX = 0;
let smoothedPeakY = 0;
let isPeakInitialized = false;

// 预分配静态顶点缓冲区 (避免每帧 new Array 内存开销)
interface Point2D {
  x: number;
  y: number;
  twistAngle?: number;
}
const MAX_SEGMENTS = 64;
const topPointsBuffer: Point2D[] = Array.from({ length: MAX_SEGMENTS }, () => ({
  x: 0,
  y: 0,
  twistAngle: 0,
}));
const bottomPointsBuffer: Point2D[] = Array.from({ length: MAX_SEGMENTS }, () => ({ x: 0, y: 0 }));

// 预烘焙 128x128 极微质感胶片纹理 (1.5% 微透明度)
let grainPatternCanvas: HTMLCanvasElement | null = null;
let grainPattern: CanvasPattern | null = null;

function getOrCreateGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (grainPattern) return grainPattern;
  if (!grainPatternCanvas && typeof document !== "undefined") {
    grainPatternCanvas = document.createElement("canvas");
    grainPatternCanvas.width = 128;
    grainPatternCanvas.height = 128;
    const gCtx = grainPatternCanvas.getContext("2d")!;
    const imgData = gCtx.createImageData(128, 128);
    const buf = imgData.data;
    for (let i = 0; i < buf.length; i += 4) {
      const val = Math.random() * 255;
      buf[i] = val;
      buf[i + 1] = val;
      buf[i + 2] = val;
      buf[i + 3] = 4;
    }
    gCtx.putImageData(imgData, 0, 0);
    grainPattern = ctx.createPattern(grainPatternCanvas, "repeat");
  }
  return grainPattern;
}

// 电影级多色温色彩矩阵 (柔和流光金织：香槟金 + 琥珀金 + 幽兰薄紫)
function getCinematicColorMatrix(rawHue: number): {
  highHue: number;
  midHue: number;
  shadowHue: number;
  sat: number;
  light: number;
} {
  const normHue = ((rawHue % 360) + 360) % 360;

  if (normHue >= 80 && normHue <= 175) {
    return {
      highHue: 42, // 波峰高光：暖金琥珀
      midHue: 156, // 受光面：深空翡翠与冰川极光
      shadowHue: 218, // 背光阴影：深邃午夜群青
      sat: 64,
      light: 48,
    };
  }

  if (normHue < 80 || normHue >= 340) {
    return {
      highHue: 42, // 香槟暖白金
      midHue: 36, // 温润琥珀金
      shadowHue: 268, // 幽兰薄紫微阴影
      sat: 68,
      light: 50,
    };
  }

  return {
    highHue: 42,
    midHue: normHue,
    shadowHue: (normHue + 45) % 360,
    sat: 65,
    light: 50,
  };
}

// 初始化失焦光斑池
function initBokehPool(width: number, height: number): BokehOrb[] {
  const pool: BokehOrb[] = [];
  const count = 45;
  for (let i = 0; i < count; i++) {
    const z = Math.random();
    pool.push({
      x: Math.random() * width,
      y: Math.random() * height,
      z,
      radius:
        z > 0.7
          ? 40 + Math.random() * 40
          : z > 0.3
            ? 16 + Math.random() * 22
            : 5 + Math.random() * 8,
      baseAlpha:
        z > 0.7
          ? 0.05 + Math.random() * 0.06
          : z > 0.3
            ? 0.07 + Math.random() * 0.1
            : 0.14 + Math.random() * 0.16,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.06 - Math.random() * 0.2,
      hueShift: (Math.random() - 0.5) * 26,
      pulsePhase: Math.random() * Math.PI * 2,
      shimmerPhase: Math.random() * Math.PI * 2,
    });
  }
  return pool;
}

// 初始化逸散流萤池
function initFirefliesPool(width: number, height: number, count: number): Firefly[] {
  const pool: Firefly[] = [];
  for (let i = 0; i < count; i++) {
    const maxLife = 220 + Math.random() * 260;
    const startX = Math.random() * width;
    const startY = height * 0.35 + Math.random() * height * 0.32;
    pool.push({
      x: startX,
      y: startY,
      baseX: startX,
      prevX: startX,
      prevY: startY + 6,
      size: 1.4 + Math.random() * 1.8,
      alpha: 0,
      maxAlpha: 0.34 + Math.random() * 0.34,
      vy: -0.4 - Math.random() * 0.55,
      spiralSpeed: 0.016 + Math.random() * 0.022,
      spiralRadius: 10 + Math.random() * 20,
      phase: Math.random() * Math.PI * 2,
      hueOffset: (Math.random() - 0.5) * 22,
      life: Math.random() * maxLife,
      maxLife,
    });
  }
  return pool;
}

/**
 * 120 FPS 满帧极速电影级可视化：流金星际·电影级丝绸极光 (Cinematic Silk Aurora)
 * 极致性能优化：彻底拔除 CPU shadowBlur、EMA 亚像素高光平滑追踪、无多边形高斯光束、零 GC 顶点复用
 */
export function drawCinematicSilkAurora(context: EffectContext): void {
  const { ctx, width, height, data, time, theme, params } = context;

  if (!width || !height || width <= 0 || height <= 0) return;

  const silkCount = Math.round(params?.silkCount ?? 6);
  const flowSpeed = params?.flowSpeed ?? 1.0;
  const glowIntensity = params?.glowIntensity ?? 1.15;
  const bokehDensity = params?.bokehDensity ?? 1.0;
  const firefliesCount = Math.round(params?.firefliesCount ?? 25);
  const godRaysIntensity = params?.godRaysIntensity ?? 1.0;
  const spatialDepth = params?.spatialDepth ?? 1.2;
  const anamorphicFlare = params?.anamorphicFlare ?? 1.0;

  // 1. 低通平滑阻尼滤波器 (Low-Pass Filter, Damping: 45)
  let bassSum = 0;
  let midSum = 0;
  let trebleSum = 0;

  const bassEnd = Math.max(1, Math.floor(data.length * 0.1));
  const midEnd = Math.max(bassEnd + 1, Math.floor(data.length * 0.45));
  const trebleEnd = Math.max(midEnd + 1, Math.floor(data.length * 0.9));

  for (let i = 0; i < bassEnd; i++) bassSum += data[i] || 0;
  for (let i = bassEnd; i < midEnd; i++) midSum += data[i] || 0;
  for (let i = midEnd; i < trebleEnd; i++) trebleSum += data[i] || 0;

  const rawBass = bassSum / (bassEnd * 255 || 1);
  const rawMid = midSum / ((midEnd - bassEnd) * 255 || 1);
  const rawTreble = trebleSum / ((trebleEnd - midEnd) * 255 || 1);

  if (context.refs.smoothBass) {
    context.refs.smoothBass.current += (rawBass - context.refs.smoothBass.current) * 0.035;
  }
  if (context.refs.smoothMid) {
    context.refs.smoothMid.current += (rawMid - context.refs.smoothMid.current) * 0.03;
  }
  if (context.refs.smoothTreble) {
    context.refs.smoothTreble.current += (rawTreble - context.refs.smoothTreble.current) * 0.025;
  }

  const bass = Number.isFinite(context.refs.smoothBass?.current)
    ? context.refs.smoothBass.current
    : 0;
  const mid = Number.isFinite(context.refs.smoothMid?.current) ? context.refs.smoothMid.current : 0;
  const treble = Number.isFinite(context.refs.smoothTreble?.current)
    ? context.refs.smoothTreble.current
    : 0;

  // 永恒微风有机待机流动时钟 (更平缓从容的巡航速率)
  const t = time * 0.00045 * flowSpeed;

  // 电影摄影机导轨极慢微巡游 (±2.5° 平滑慢平移与俯仰)
  const camTiltX = Math.sin(t * 0.3) * (width * 0.025);
  const camTiltY = Math.cos(t * 0.25) * (height * 0.018);

  // 2. 电影级多色温色彩矩阵
  const rawThemeHue = theme.primary || 38;
  const colorMatrix = getCinematicColorMatrix(rawThemeHue);
  const { highHue, midHue, shadowHue, sat, light } = colorMatrix;

  ctx.save();

  // 3. 深邃纯净的宇宙夜空背景 (高纯度黑底)
  ctx.fillStyle = "#020409";
  ctx.fillRect(0, 0, width, height);

  // 3.1 东方意境温润星云雾气漫射 (双区柔光弥散，消除死黑)
  const nebulaGrad = ctx.createRadialGradient(
    width * 0.5 + camTiltX,
    height * 0.46 + camTiltY,
    height * 0.04,
    width * 0.5 + camTiltX,
    height * 0.46 + camTiltY,
    width * 0.72
  );
  const nebulaAlpha = (0.13 + bass * 0.08) * glowIntensity;
  nebulaGrad.addColorStop(0.0, `hsla(${midHue}, ${sat}%, 20%, ${nebulaAlpha})`);
  nebulaGrad.addColorStop(0.38, `hsla(${shadowHue}, ${sat * 0.85}%, 14%, ${nebulaAlpha * 0.75})`);
  nebulaGrad.addColorStop(0.72, `hsla(${shadowHue}, 50%, 8%, ${nebulaAlpha * 0.25})`);
  nebulaGrad.addColorStop(1.0, "rgba(2, 4, 9, 0)");

  // 批处理 Screen 渲染通道
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = nebulaGrad;
  ctx.fillRect(0, 0, width, height);

  // 4. 丁达尔晨暮柔雾体积光柱 (宽域高斯过渡，去除生硬斜向切片感)
  if (godRaysIntensity > 0.05) {
    const rayCount = 3;
    for (let r = 0; r < rayCount; r++) {
      const rayCenterX = width * (0.22 + r * 0.28) + Math.sin(t * 0.35 + r) * 60;
      const rayAlpha = Math.max(
        0,
        Math.min(1, (0.032 + Math.sin(t * 0.45 + r) * 0.012 + bass * 0.02) * godRaysIntensity)
      );

      // 使用超宽对角线双向柔和羽化渐变 (无生硬边界)
      const raySpan = Math.max(260, width * 0.22);
      const rayGrad = ctx.createLinearGradient(
        rayCenterX - raySpan,
        0,
        rayCenterX + raySpan,
        height
      );
      rayGrad.addColorStop(0.0, "rgba(0,0,0,0)");
      rayGrad.addColorStop(0.28, `hsla(42, 75%, 84%, ${rayAlpha * 0.4})`);
      rayGrad.addColorStop(0.5, `hsla(${midHue}, 60%, 54%, ${rayAlpha * 0.6})`);
      rayGrad.addColorStop(0.72, `hsla(${shadowHue}, 50%, 36%, ${rayAlpha * 0.25})`);
      rayGrad.addColorStop(1.0, "rgba(0,0,0,0)");

      ctx.fillStyle = rayGrad;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 5. 电影大光圈高斯弥散圆 (Airy Gaussian Bokeh，彻底移除彩虹硬外环)
  if (!localBokehPool || localBokehPool.length === 0) {
    localBokehPool = initBokehPool(width, height);
  }
  const activeBokehCount = Math.min(
    localBokehPool.length,
    Math.floor(localBokehPool.length * Math.min(1.5, Math.max(0.3, bokehDensity)))
  );

  for (let i = 0; i < activeBokehCount; i++) {
    const orb = localBokehPool[i];
    if (!orb) continue;

    orb.x += orb.vx * (1 + bass * 0.25);
    orb.y += orb.vy * (1 + mid * 0.2);
    orb.pulsePhase += 0.012 + treble * 0.018;
    orb.shimmerPhase += 0.025 + treble * 0.045;

    if (orb.y < -orb.radius * 2) {
      orb.y = height + orb.radius;
      orb.x = Math.random() * width;
    }
    if (orb.x < -orb.radius * 2) orb.x = width + orb.radius;
    if (orb.x > width + orb.radius * 2) orb.x = -orb.radius;

    const trebleShimmer = Math.max(0, Math.sin(orb.shimmerPhase)) * treble * 0.2;
    const dynamicRadius = Math.max(
      1,
      orb.radius * (1 + Math.sin(orb.pulsePhase) * 0.08 + treble * 0.14)
    );
    const orbAlpha = Math.max(
      0,
      Math.min(
        1,
        orb.baseAlpha *
          (0.75 + Math.sin(orb.pulsePhase) * 0.12 + bass * 0.2 + trebleShimmer) *
          glowIntensity
      )
    );
    const orbHue = (midHue + orb.hueShift + 360) % 360;

    const drawX = orb.x + camTiltX * 0.2;
    const drawY = orb.y + camTiltY * 0.2;

    if (Number.isFinite(drawX) && Number.isFinite(drawY) && Number.isFinite(dynamicRadius)) {
      const orbGrad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, dynamicRadius);

      if (orb.z > 0.45) {
        // 前景大景深虚焦光斑：集成温润平滑光学色散 (无硬边缘同心环)
        orbGrad.addColorStop(0.0, `hsla(42, 85%, 92%, ${orbAlpha * 1.05})`);
        orbGrad.addColorStop(0.25, `hsla(${orbHue}, ${sat}%, 72%, ${orbAlpha * 0.7})`);
        orbGrad.addColorStop(0.55, `hsla(${orbHue}, ${sat}%, 52%, ${orbAlpha * 0.35})`);
        orbGrad.addColorStop(0.8, `hsla(${shadowHue}, 70%, 38%, ${orbAlpha * 0.1})`);
        orbGrad.addColorStop(1.0, `hsla(${shadowHue}, 50%, 20%, 0)`);
      } else {
        // 背景微弱焦外散斑：纯高斯自然融入深空
        orbGrad.addColorStop(0.0, `hsla(${orbHue}, ${sat}%, 80%, ${orbAlpha * 0.85})`);
        orbGrad.addColorStop(0.35, `hsla(${orbHue}, ${sat}%, 54%, ${orbAlpha * 0.4})`);
        orbGrad.addColorStop(0.7, `hsla(${shadowHue}, ${sat * 0.7}%, 28%, ${orbAlpha * 0.08})`);
        orbGrad.addColorStop(1.0, `hsla(${shadowHue}, 45%, 15%, 0)`);
      }

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(drawX, drawY, dynamicRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 6. 核心：真 3D 空间透视穿梭与莫比乌斯曲面扭转 (GPU 硬件原生多重笔触发光)
  const count = Math.max(3, Math.min(8, silkCount));
  const segments = 56;
  const segmentWidth = width / (segments - 1);

  let framePeakX = width * 0.5;
  let framePeakY = height * 0.44;
  let frameMinY = Infinity;

  for (let r = 0; r < count; r++) {
    const layerDepth = r / (count - 1);
    const layerSpeed = 0.75 + r * 0.25;

    const zDepth = (-120 + layerDepth * 380) * spatialDepth;
    const perspectiveScale = Math.max(0.5, 1.0 + zDepth / 1000);

    const baseY =
      height * (0.43 + (r - (count - 1) / 2) * 0.036) + camTiltY * (1 + layerDepth * 0.5);

    let minY = Infinity;
    let maxY = -Infinity;

    for (let s = 0; s < segments; s++) {
      const px = s * segmentWidth + camTiltX * (1 + layerDepth * 0.5);
      const nx = s / (segments - 1);

      const twistAngle = Math.sin(nx * 3.5 + t * layerSpeed * 0.8 + r * 1.3) * 0.65;

      const wave1 =
        Math.sin(nx * 2.8 + t * layerSpeed + r * 1.1) *
        (40 + bass * 85 * (1 - layerDepth * 0.2)) *
        perspectiveScale;
      const wave2 =
        Math.cos(nx * 5.8 - t * layerSpeed * 1.1 + r * 1.9) * (20 + mid * 45) * perspectiveScale;
      const wave3 = Math.sin(nx * 10.5 + t * 1.7 + r) * (7 + treble * 18) * perspectiveScale;

      const envelope = Math.sin(nx * Math.PI);
      const topY = baseY + (wave1 + wave2 + wave3) * envelope;

      const twistFactor = Math.cos(twistAngle);
      const thickness = Math.max(
        8,
        (50 + (1 - layerDepth * 0.2) * 48 + bass * 32 + Math.sin(nx * 4.5 + t + r) * 15) *
          envelope *
          Math.max(0.35, Math.abs(twistFactor)) *
          perspectiveScale
      );
      const bottomY = topY + thickness;

      topPointsBuffer[s].x = px;
      topPointsBuffer[s].y = topY;
      topPointsBuffer[s].twistAngle = twistAngle;

      bottomPointsBuffer[s].x = px;
      bottomPointsBuffer[s].y = bottomY;

      if (topY < minY) {
        minY = topY;
        if (topY < frameMinY && layerDepth > 0.4) {
          frameMinY = topY;
          framePeakX = px;
          framePeakY = topY;
        }
      }
      if (bottomY > maxY) maxY = bottomY;
    }

    if (Number.isFinite(minY) && Number.isFinite(maxY) && maxY > minY) {
      // 绘制闭合独立丝绸曲面
      ctx.beginPath();
      ctx.moveTo(topPointsBuffer[0].x, topPointsBuffer[0].y);

      for (let i = 0; i < segments - 1; i++) {
        const xc = (topPointsBuffer[i].x + topPointsBuffer[i + 1].x) / 2;
        const yc = (topPointsBuffer[i].y + topPointsBuffer[i + 1].y) / 2;
        ctx.quadraticCurveTo(topPointsBuffer[i].x, topPointsBuffer[i].y, xc, yc);
      }
      ctx.lineTo(topPointsBuffer[segments - 1].x, topPointsBuffer[segments - 1].y);
      ctx.lineTo(bottomPointsBuffer[segments - 1].x, bottomPointsBuffer[segments - 1].y);

      for (let i = segments - 1; i > 0; i--) {
        const xc = (bottomPointsBuffer[i].x + bottomPointsBuffer[i - 1].x) / 2;
        const yc = (bottomPointsBuffer[i].y + bottomPointsBuffer[i - 1].y) / 2;
        ctx.quadraticCurveTo(bottomPointsBuffer[i].x, bottomPointsBuffer[i].y, xc, yc);
      }
      ctx.lineTo(bottomPointsBuffer[0].x, bottomPointsBuffer[0].y);
      ctx.closePath();

      // 6. 次表面散射 (SSS) 连续色阶填充 (香槟暖金 -> 暖琥珀 -> 极光主色 -> 灰玫粉 -> 幽兰暮光紫)
      const ribbonGrad = ctx.createLinearGradient(0, minY, 0, maxY);
      const coreAlpha = Math.max(
        0,
        Math.min(1, (0.13 + layerDepth * 0.15 + bass * 0.08) * glowIntensity)
      );

      ribbonGrad.addColorStop(0.0, `hsla(42, 85%, 92%, 0)`);
      ribbonGrad.addColorStop(0.12, `hsla(42, 85%, 86%, ${coreAlpha * 0.85})`);
      ribbonGrad.addColorStop(0.28, `hsla(32, 90%, 66%, ${coreAlpha * 0.95})`);
      ribbonGrad.addColorStop(0.5, `hsla(${midHue}, ${sat}%, ${light}%, ${coreAlpha})`);
      ribbonGrad.addColorStop(0.72, `hsla(342, 65%, 52%, ${coreAlpha * 0.68})`);
      ribbonGrad.addColorStop(0.88, `hsla(${shadowHue}, ${sat * 0.85}%, 26%, ${coreAlpha * 0.38})`);
      ribbonGrad.addColorStop(1.0, `hsla(${shadowHue}, 60%, 14%, 0)`);

      ctx.fillStyle = ribbonGrad;
      ctx.fill();

      // 6.1 动态计算波峰菲涅尔受光权重 (0 GC 纯数值累加)
      let sumFresnel = 0;
      const ySpan = Math.max(1, maxY - minY);
      for (let s = 0; s < segments; s++) {
        const pt = topPointsBuffer[s];
        const snx = s / (segments - 1);
        const env = Math.sin(snx * Math.PI);
        const twFactor = Math.abs(Math.sin(pt.twistAngle || 0));
        const crestH = (maxY - pt.y) / ySpan;
        sumFresnel += env * (0.22 + 0.48 * Math.pow(twFactor, 1.6) + 0.5 * crestH * crestH);
      }
      const avgFresnel = Math.max(0.35, Math.min(1.25, sumFresnel / segments));

      // 6.2 5 阶指数高斯羽化香槟金波峰描边 (彻底告别生硬单像素纯白钢丝线)
      ctx.beginPath();
      ctx.moveTo(topPointsBuffer[0].x, topPointsBuffer[0].y);
      for (let i = 0; i < segments - 1; i++) {
        const xc = (topPointsBuffer[i].x + topPointsBuffer[i + 1].x) / 2;
        const yc = (topPointsBuffer[i].y + topPointsBuffer[i + 1].y) / 2;
        ctx.quadraticCurveTo(topPointsBuffer[i].x, topPointsBuffer[i].y, xc, yc);
      }
      ctx.lineTo(topPointsBuffer[segments - 1].x, topPointsBuffer[segments - 1].y);

      // 阶 4：空间大气弥散 (22.0px)
      ctx.strokeStyle = `hsla(${highHue}, 70%, 65%, ${0.035 * glowIntensity * avgFresnel})`;
      ctx.lineWidth = Math.max(1.5, 22.0 * perspectiveScale);
      ctx.stroke();

      // 阶 3：广域色散晕 (10.5px)
      ctx.strokeStyle = `hsla(38, 76%, 74%, ${0.08 * glowIntensity * avgFresnel})`;
      ctx.lineWidth = Math.max(1.2, 10.5 * perspectiveScale);
      ctx.stroke();

      // 阶 2：中域高光带 (4.8px)
      ctx.strokeStyle = `hsla(40, 80%, 82%, ${0.18 * glowIntensity * avgFresnel})`;
      ctx.lineWidth = Math.max(1.0, 4.8 * perspectiveScale);
      ctx.stroke();

      // 阶 1：次表面薄晕 (2.2px)
      ctx.strokeStyle = `hsla(41, 84%, 88%, ${0.32 * glowIntensity * avgFresnel})`;
      ctx.lineWidth = Math.max(0.8, 2.2 * perspectiveScale);
      ctx.stroke();

      // 阶 0：温润香槟暖白金内核 (1.0px - 彻底告别生硬刺眼纯白 #FFFFFF)
      ctx.strokeStyle = `hsla(42, 85%, 92%, ${(0.45 + layerDepth * 0.28 + mid * 0.2) * glowIntensity * avgFresnel})`;
      ctx.lineWidth = Math.max(0.6, 1.0 * perspectiveScale);
      ctx.stroke();

      // 6.3 纳米级真丝折射温润细闪 (0 GC 纯数学哈希)
      if (treble > 0.15 || bass > 0.2) {
        for (let s = 4; s < segments - 4; s += 5) {
          const pt = topPointsBuffer[s];
          const hashSeed = Math.sin(s * 127.1 + r * 311.7 + t * 4.0);
          if (hashSeed > 0.7 && pt) {
            const sparkleAlpha = Math.max(
              0,
              Math.min(1, ((hashSeed - 0.7) / 0.3) * (treble * 0.6 + 0.15) * coreAlpha * 2.2)
            );
            const sparkleSize = Math.max(0.6, (1.0 + Math.sin(t * 7 + s) * 0.7) * perspectiveScale);

            ctx.fillStyle = `hsla(42, 85%, 94%, ${sparkleAlpha})`;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y + 5, sparkleSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  // 7. EMA 亚像素平滑寻峰追踪器 (阻尼 0.08，彻底消灭红框瞬移闪烁)
  if (!isPeakInitialized) {
    smoothedPeakX = framePeakX;
    smoothedPeakY = framePeakY;
    isPeakInitialized = true;
  } else {
    smoothedPeakX += (framePeakX - smoothedPeakX) * 0.08;
    smoothedPeakY += (framePeakY - smoothedPeakY) * 0.08;
  }

  // 智能局域高斯宽银幕镜头耀斑 (彻底消除全屏横贯硬切直线)
  if (anamorphicFlare > 0.05 && Number.isFinite(smoothedPeakX) && Number.isFinite(smoothedPeakY)) {
    const flareAlpha = Math.max(
      0,
      Math.min(1, (0.08 + bass * 0.12 + mid * 0.07) * anamorphicFlare * glowIntensity)
    );
    const sigmaX = Math.max(70, width * (0.15 + bass * 0.07));
    const spanX = sigmaX * 3.0; // 3-sigma 99.7% 局域高斯截断
    const beamHeight = Math.max(2.2, 3.4 * (1 + mid * 0.5));

    const flareStartX = smoothedPeakX - spanX;
    const flareEndX = smoothedPeakX + spanX;

    // 7.1 局域高斯狭缝流光 (以波峰为中心对称羽化衰减)
    const flareGrad = ctx.createLinearGradient(
      flareStartX,
      smoothedPeakY,
      flareEndX,
      smoothedPeakY
    );
    flareGrad.addColorStop(0.0, "rgba(0,0,0,0)");
    flareGrad.addColorStop(0.18, `hsla(${shadowHue}, 75%, 68%, ${flareAlpha * 0.12})`);
    flareGrad.addColorStop(0.35, `hsla(${midHue}, 80%, 72%, ${flareAlpha * 0.5})`);
    flareGrad.addColorStop(0.5, `hsla(42, 85%, 92%, ${flareAlpha * 1.05})`); // 香槟金高光核心
    flareGrad.addColorStop(0.65, `hsla(${midHue}, 80%, 72%, ${flareAlpha * 0.5})`);
    flareGrad.addColorStop(0.82, `hsla(${shadowHue}, 75%, 68%, ${flareAlpha * 0.12})`);
    flareGrad.addColorStop(1.0, "rgba(0,0,0,0)");

    ctx.fillStyle = flareGrad;
    ctx.fillRect(flareStartX, smoothedPeakY - beamHeight * 0.5, spanX * 2, beamHeight);

    // 7.2 局域变形椭圆晕斑 (Anamorphic Elliptical Halo)
    ctx.save();
    ctx.translate(smoothedPeakX, smoothedPeakY);
    ctx.scale(2.6, 1.0); // 水平宽银幕拉宽

    const haloRadius = 40 + bass * 22;
    const centerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, haloRadius);
    centerGlow.addColorStop(0.0, `hsla(42, 85%, 94%, ${flareAlpha * 1.0})`);
    centerGlow.addColorStop(0.35, `hsla(36, 85%, 76%, ${flareAlpha * 0.35})`);
    centerGlow.addColorStop(0.7, `hsla(${midHue}, 75%, 62%, ${flareAlpha * 0.1})`);
    centerGlow.addColorStop(1.0, "rgba(0,0,0,0)");

    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, haloRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 8. 逸散流萤微光星火系统 (柔光浮游星火：双层柔化发光微核，去除棍状线段尾迹)
  if (!localFirefliesPool || localFirefliesPool.length !== firefliesCount) {
    localFirefliesPool = initFirefliesPool(width, height, firefliesCount);
  }

  for (let i = 0; i < localFirefliesPool.length; i++) {
    const f = localFirefliesPool[i];
    if (!f) continue;

    f.prevX = f.x;
    f.prevY = f.y;

    f.life += 1;
    f.phase += f.spiralSpeed || 0.02;
    f.y += (f.vy || -0.5) * (1 + bass * 0.4);
    f.x = (f.baseX || width * 0.5) + Math.sin(f.phase) * (f.spiralRadius || 15) + camTiltX * 0.35;

    const maxLife = f.maxLife || 250;
    const lifeRatio = f.life / maxLife;
    const maxAlpha = f.maxAlpha || 0.34;

    if (lifeRatio < 0.2) {
      f.alpha = (lifeRatio / 0.2) * maxAlpha;
    } else if (lifeRatio > 0.65) {
      f.alpha = ((1 - lifeRatio) / 0.35) * maxAlpha;
    } else {
      f.alpha = maxAlpha;
    }

    if (f.life >= maxLife || f.y < -20) {
      f.life = 0;
      f.baseX = Math.random() * width;
      f.x = f.baseX;
      f.prevX = f.baseX;
      f.y = height * (0.36 + Math.random() * 0.25);
      f.prevY = f.y + 6;
      f.maxLife = 180 + Math.random() * 240;
    }

    const fHue = (midHue + (f.hueOffset || 0) + 360) % 360;
    const fAlpha = Math.max(
      0,
      Math.min(1, f.alpha * (0.75 + Math.sin(f.phase * 2) * 0.2 + treble * 0.35) * glowIntensity)
    );
    const fSize = Math.max(0.5, (f.size || 1.5) * 3.0);

    if (Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(fSize)) {
      // 双层柔化发光微核 (微光中心 + 柔和呼吸弥散光晕，去除棍状线段尾迹)
      const fGrad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, fSize * 2.2);
      fGrad.addColorStop(0.0, `hsla(42, 85%, 94%, ${fAlpha})`);
      fGrad.addColorStop(0.35, `hsla(${fHue}, 80%, 70%, ${fAlpha * 0.45})`);
      fGrad.addColorStop(0.7, `hsla(${shadowHue}, 70%, 50%, ${fAlpha * 0.12})`);
      fGrad.addColorStop(1.0, "rgba(0,0,0,0)");

      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, fSize * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 9. 预烘焙 1.5% 极微胶片微质感 (overlay 模式)
  const pattern = getOrCreateGrainPattern(ctx);
  if (pattern) {
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }

  // 10. 2.39:1 宽银幕温润暗角 (非生硬死黑，保留边角透气感)
  ctx.globalCompositeOperation = "multiply";
  const vigInner = Math.max(10, Math.min(width, height) * 0.38);
  const vigOuter = Math.max(vigInner + 10, Math.max(width, height) * 0.78);

  if (Number.isFinite(vigInner) && Number.isFinite(vigOuter)) {
    const vigGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      vigInner,
      width * 0.5,
      height * 0.5,
      vigOuter
    );
    vigGrad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
    vigGrad.addColorStop(0.7, "rgba(240, 242, 248, 0.98)");
    vigGrad.addColorStop(1.0, "rgba(8, 10, 18, 0.68)");

    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}
