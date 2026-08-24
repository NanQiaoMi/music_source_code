/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

interface GoldenPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  rotation: number;
  vRot: number;
  aspect: number;
  phase: number;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

interface CraneEntity {
  relX: number;
  relY: number;
  scale: number;
  speed: number;
  wingFreq: number;
  phase: number;
  floatPhase: number;
}

let localRipples: WaterRipple[] = [];
let localPetals: GoldenPetal[] = [];
let localParticles: DustParticle[] = [];
let localCranes: CraneEntity[] = [];
let lastRippleTime = 0;
let initialized = false;

// 平滑阻尼追踪器 (EMA Damping: 32 带来空灵大气的呼吸感)
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
let smoothEnergy = 0;

// 预分配用于山体渲染的静态 Float32 顶点缓存 (支持高达 2048 采样点，零堆内存分配)
const MAX_MOUNTAIN_POINTS = 2048;
const mountainPointsX: Float32Array[] = [];
const mountainPointsY: Float32Array[] = [];
const mountainPointCounts = new Int32Array(6);

for (let i = 0; i < 6; i++) {
  mountainPointsX.push(new Float32Array(MAX_MOUNTAIN_POINTS));
  mountainPointsY.push(new Float32Array(MAX_MOUNTAIN_POINTS));
}

function initLivingElements(width: number, height: number) {
  localParticles = [];
  for (let i = 0; i < 45; i++) {
    localParticles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: -Math.random() * 0.32 - 0.08,
      size: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.45 + 0.15,
      phase: Math.random() * Math.PI * 2,
    });
  }

  localPetals = [];
  for (let i = 0; i < 14; i++) {
    localPetals.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.28 + 0.12,
      vy: Math.random() * 0.24 + 0.12,
      size: Math.random() * 3.5 + 1.8,
      alpha: Math.random() * 0.22 + 0.1,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.02,
      aspect: 0.35 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
    });
  }

  localCranes = [
    { relX: 0.25, relY: 0.15, scale: 0.72, speed: 0.00042, wingFreq: 2.2, phase: 0.0, floatPhase: 0.0 },
    { relX: 0.19, relY: 0.19, scale: 0.60, speed: 0.00042, wingFreq: 2.3, phase: 1.2, floatPhase: 1.5 },
    { relX: 0.14, relY: 0.23, scale: 0.52, speed: 0.00042, wingFreq: 2.1, phase: 2.4, floatPhase: 3.1 },
    { relX: 0.09, relY: 0.18, scale: 0.45, speed: 0.00042, wingFreq: 2.4, phase: 3.6, floatPhase: 4.8 },
  ];

  initialized = true;
}

/**
 * 120 FPS 宋画清幽 · 电影级柔焦水墨长卷 (Oriental Serene Landscape)
 * 极致清幽优雅：
 * 1. 宋画非对称险峻山势与泥金微皴，山峦层次纵深如诗如画；
 * 2. 远山轻拂流体丝绢烟岚，拉开宏阔空气景深；
 * 3. 晴空翱翔瑞鹤编队，长颈展开双翼与丹顶朱砂；
 * 4. 乌篷孤舟与水面随波荡漾之动态流金长倒影；
 * 5. 千里江山经典题跋与金石朱砂“清音”小印。
 */
export function drawOrientalLandscape(context: EffectContext): void {
  const { ctx, width, height, data, time, params } = context;
  if (!width || !height || width <= 0 || height <= 0) return;

  const mountainBreath = params?.mountainBreath ?? 1.0;
  const waterRipple = params?.waterRipple ?? 1.0;
  const goldGlow = params?.goldGlow ?? 1.0;
  const filmVignette = params?.filmVignette ?? 0.65;

  // 1. 低通音频平滑滤波 (EMA Filtering, Damping: 32 带来空灵大气的呼吸感)
  let bassSum = 0;
  let midSum = 0;
  let trebleSum = 0;
  const bassEnd = Math.max(1, Math.floor(data.length * 0.12));
  const midEnd = Math.max(bassEnd + 1, Math.floor(data.length * 0.48));
  const trebleEnd = Math.max(midEnd + 1, Math.floor(data.length * 0.92));

  for (let i = 0; i < bassEnd; i++) bassSum += data[i] || 0;
  for (let i = bassEnd; i < midEnd; i++) midSum += data[i] || 0;
  for (let i = midEnd; i < trebleEnd; i++) trebleSum += data[i] || 0;

  const rawBass = bassSum / (bassEnd * 255 || 1);
  const rawMid = midSum / ((midEnd - bassEnd) * 255 || 1);
  const rawTreble = trebleSum / ((trebleEnd - midEnd) * 255 || 1);
  const rawEnergy = rawBass * 0.4 + rawMid * 0.4 + rawTreble * 0.2;

  smoothBass += (rawBass - smoothBass) * 0.032;
  smoothMid += (rawMid - smoothMid) * 0.052;
  smoothTreble += (rawTreble - smoothTreble) * 0.072;
  smoothEnergy += (rawEnergy - smoothEnergy) * 0.042;

  if (context.refs.smoothBass) context.refs.smoothBass.current = smoothBass;
  if (context.refs.smoothMid) context.refs.smoothMid.current = smoothMid;
  if (context.refs.smoothTreble) context.refs.smoothTreble.current = smoothTreble;

  const t = time * 0.00065;

  // ─── 2. 2.35:1 宽银幕电影绢帛画幅尺寸计算 ───
  const maxScrollW = width * 0.92;
  const targetAspect = 2.35;
  let scrollW = maxScrollW;
  let scrollH = scrollW / targetAspect;

  if (scrollH > height * 0.78) {
    scrollH = height * 0.78;
    scrollW = scrollH * targetAspect;
  }

  const scrollX = (width - scrollW) / 2;
  const scrollY = (height - scrollH) / 2;
  const waterY = scrollY + scrollH * 0.62; // 水面基线适度下移，天地更开阔
  const bottomY = scrollY + scrollH + 30;

  if (!initialized || localParticles.length === 0) {
    initLivingElements(width, height);
  }

  // 泛音微波涟漪生成
  if (smoothTreble > 0.36 && t - lastRippleTime > 0.30) {
    lastRippleTime = t;
    if (localRipples.length < 5) {
      localRipples.push({
        x: width * (0.36 + Math.random() * 0.36),
        y: waterY + 15 + Math.random() * 35,
        radius: 4,
        maxRadius: Math.min(width, height) * 0.25,
        alpha: 0.65 * waterRipple,
        speed: 1.2 + smoothTreble * 1.8,
      });
    }
  }

  ctx.save();

  // ─── 1. 外部暗夜背景 ───
  ctx.fillStyle = "#020508";
  ctx.fillRect(0, 0, width, height);

  const ambientGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.46,
    width * 0.05,
    width * 0.5,
    height * 0.46,
    width * 0.75
  );
  ambientGlow.addColorStop(0, "rgba(14, 60, 75, 0.28)");
  ambientGlow.addColorStop(0.5, "rgba(10, 42, 48, 0.14)");
  ambientGlow.addColorStop(1, "rgba(2, 5, 8, 0)");
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(0, 0, width, height);

  // ─── 2. 画卷内部裁剪 ───
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, scrollX, scrollY, scrollW, scrollH, 16);
  ctx.clip();

  // 宣纸天际古色渐变 (沉静典雅宋代绢帛天青 ➔ 澄碧江水)
  const skyGrad = ctx.createLinearGradient(scrollX, scrollY, scrollX, scrollY + scrollH);
  skyGrad.addColorStop(0, "#05131c");
  skyGrad.addColorStop(0.28, "#092330");
  skyGrad.addColorStop(0.52, "#0f3744");
  skyGrad.addColorStop(0.70, "#0c2e38");
  skyGrad.addColorStop(0.86, "#082027");
  skyGrad.addColorStop(1, "#030f13");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(scrollX, scrollY, scrollW, scrollH);

  // 天际远景柔和宋画天青漫射氛晕 (Subtle Celestial Bloom)
  const skyBloom = ctx.createRadialGradient(
    scrollX + scrollW * 0.48,
    scrollY + scrollH * 0.18,
    20,
    scrollX + scrollW * 0.48,
    scrollY + scrollH * 0.32,
    scrollW * 0.60
  );
  skyBloom.addColorStop(0, "rgba(28, 105, 125, 0.18)");
  skyBloom.addColorStop(0.45, "rgba(18, 72, 85, 0.08)");
  skyBloom.addColorStop(1, "rgba(5, 19, 28, 0)");
  ctx.fillStyle = skyBloom;
  ctx.fillRect(scrollX, scrollY, scrollW, scrollH);

  // ─── 2.1 宋代写意白玉素月与月华氛晕 (Ethereal Song Dynasty Moon) ───
  const moonX = scrollX + scrollW * 0.82;
  const moonY = scrollY + scrollH * 0.15;
  const moonR = Math.min(scrollW, scrollH) * 0.040;
  drawSongDynastyMoon(ctx, moonX, moonY, moonR, t, smoothMid);

  // ─── 3. 晴空白鹭 · 仙鹤群飞 (Flock of Soaring Cranes) ───
  drawFlockOfCranes(ctx, localCranes, scrollX, scrollY, scrollW, scrollH, t, smoothTreble);

  // ─── 4. 6 重宋画《千里江山》重彩矿物青绿层峦 (错落穿插 · 高远深远 · 泥金微光) ───
  const breathFactor = mountainBreath * smoothBass;
  const midVibe = smoothMid * 5;

  // 远山高远如黛出云，近峦平缓蜿蜒入水，六层峰峦错落交织
  const mountainPalette = [
    { fillTop: "#1c586a", fillBottom: "#0b252e", alpha: 0.60, baseY: 0.28, speed: 0.16, freq: 1.8, phase: 0.0 },
    { fillTop: "#186576", fillBottom: "#092e38", alpha: 0.72, baseY: 0.24, speed: 0.24, freq: 2.6, phase: 1.8 },
    { fillTop: "#13746c", fillBottom: "#073934", alpha: 0.82, baseY: 0.20, speed: 0.36, freq: 3.4, phase: 3.5 },
    { fillTop: "#10806e", fillBottom: "#064035", alpha: 0.90, baseY: 0.17, speed: 0.48, freq: 4.2, phase: 5.2 },
    { fillTop: "#0d6e57", fillBottom: "#05362a", alpha: 0.96, baseY: 0.14, speed: 0.62, freq: 5.0, phase: 6.9 },
    { fillTop: "#0a5a44", fillBottom: "#04291e", alpha: 1.00, baseY: 0.11, speed: 0.78, freq: 5.8, phase: 8.6 },
  ];

  for (let layer = 0; layer < 6; layer++) {
    const config = mountainPalette[layer];
    const layerDepth = (layer + 1) / 6;
    const basePeakHeight = scrollH * (config.baseY * 0.95);
    const layerTime = t * config.speed;
    const layerAmp = (basePeakHeight * 0.34 + breathFactor * 12 * layerDepth) * (1 + (layer >= 3 ? midVibe * 0.02 : 0));

    ctx.beginPath();
    ctx.moveTo(scrollX, bottomY);

    const ptsX = mountainPointsX[layer];
    const ptsY = mountainPointsY[layer];
    let ptIndex = 0;
    const step = 4;

    for (let x = scrollX; x <= scrollX + scrollW; x += step) {
      if (ptIndex >= MAX_MOUNTAIN_POINTS) break;
      const normX = (x - scrollX) / scrollW;

      // 多八度连绵优雅正弦叠加 (错落起伏，无突兀断层)
      const h1 = Math.sin(normX * config.freq + layerTime + config.phase);
      const h2 = Math.cos(normX * (config.freq * 2.2) - layerTime * 0.5 + config.phase * 1.3);
      const h3 = Math.sin(normX * (config.freq * 4.5) + layerTime * 0.8) * 0.20;
      const h4 = Math.cos(normX * 18.0 - layerTime * 1.2) * 0.06;
      const mountainCurve = (h1 * 0.58 + h2 * 0.30 + h3 + h4);

      const y = waterY - basePeakHeight - mountainCurve * layerAmp;
      ptsX[ptIndex] = x;
      ptsY[ptIndex] = y;
      ptIndex++;
      ctx.lineTo(x, y);
    }
    mountainPointCounts[layer] = ptIndex;

    ctx.lineTo(scrollX + scrollW, bottomY);
    ctx.closePath();

    // 山体从山峰石青/石绿自然向下过渡入幽雅江水色
    const mtnGrad = ctx.createLinearGradient(
      scrollX + scrollW * 0.22,
      waterY - basePeakHeight * 1.35,
      scrollX + scrollW * 0.35,
      waterY + scrollH * 0.32
    );
    mtnGrad.addColorStop(0, config.fillTop);
    mtnGrad.addColorStop(0.42, config.fillBottom);
    mtnGrad.addColorStop(0.85, "#061c22");
    mtnGrad.addColorStop(1, "#030f13");

    ctx.fillStyle = mtnGrad;
    ctx.globalAlpha = config.alpha;
    ctx.fill();

    // 泥金描边（温润内敛，如丝如缕勾勒山脊骨线）
    if (layer >= 2) {
      ctx.save();
      const goldAlpha = layer === 5 
        ? (0.36 + smoothMid * 0.35) * goldGlow 
        : layer === 4 
          ? (0.28 + smoothMid * 0.28) * goldGlow 
          : (0.18 + smoothMid * 0.20) * goldGlow;

      ctx.strokeStyle = layer === 5 
        ? "rgba(245, 210, 85, 0.78)" 
        : layer === 4 
          ? "rgba(240, 188, 65, 0.62)" 
          : "rgba(95, 210, 170, 0.45)";
      ctx.lineWidth = layer === 5 ? 0.95 : 0.75;
      ctx.globalAlpha = Math.min(1.0, goldAlpha);
      ctx.stroke();
      ctx.restore();
    }

    // 在远景层（Layer 1）与中景层（Layer 3）后方分别穿插流体丝绢烟岚
    if (layer === 1) {
      drawSilkMistRibbon(ctx, scrollX, scrollY, scrollW, scrollH * 0.44, scrollH * 0.055, t * 1.2, 0.22, smoothTreble, goldGlow);
    } else if (layer === 3) {
      drawSilkMistRibbon(ctx, scrollX, scrollY, scrollW, scrollH * 0.54, scrollH * 0.045, t * 1.6 + 2.0, 0.16, smoothTreble, goldGlow);
    }
  }
  ctx.globalAlpha = 1.0;

  // ─── 4.1 山脚水汀洲渚与水面晨雾岚气 (Shoals & Water Mist) ───
  drawWaterShoals(ctx, scrollX, scrollW, waterY, t, smoothBass);
  drawWaterHorizonMist(ctx, scrollX, scrollW, waterY, t, smoothTreble);

  // ─── 5. 水天融界 · 水面镜像倒影与碎金微澜 ───
  const waterH = scrollY + scrollH - waterY;

  // 倒影自然翻折 (零堆内存分配)
  ctx.save();
  ctx.beginPath();
  ctx.rect(scrollX, waterY, scrollW, waterH);
  ctx.clip();

  for (let l = 5; l >= 1; l--) {
    const count = mountainPointCounts[l];
    if (count <= 0) continue;
    const ptsX = mountainPointsX[l];
    const ptsY = mountainPointsY[l];
    const mColor = mountainPalette[l].fillTop;
    const mAlpha = mountainPalette[l].alpha;

    ctx.beginPath();
    ctx.moveTo(scrollX, waterY);
    for (let i = 0; i < count; i++) {
      const px = ptsX[i];
      const py = ptsY[i];
      const distFromWater = waterY - py;
      const waveShift = Math.sin((px - scrollX) * 0.03 + t * 1.8 + l) * (1.2 + smoothBass * 2.0);
      const reflectY = waterY + distFromWater * 0.45 + waveShift;
      ctx.lineTo(px, reflectY);
    }
    ctx.lineTo(scrollX + scrollW, waterY);
    ctx.closePath();

    ctx.fillStyle = mColor;
    ctx.globalAlpha = mAlpha * 0.22;
    ctx.fill();
  }
  ctx.restore();

  // 水面月华银波倒影 (Moon Specular Reflection)
  drawMoonWaterReflection(ctx, moonX, waterY, waterH, t, smoothTreble, smoothBass);

  // 有机多八度微波与碎金粼粼 (两端余弦渐隐)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const waveCount = 12;
  for (let w = 0; w < waveCount; w++) {
    const waveY = waterY + ((w + 1) / (waveCount + 1)) * waterH;
    const wavePhase = t * 1.1 + w * 0.75;
    const waveAlpha = (0.06 + Math.sin(wavePhase) * 0.03 + smoothTreble * 0.08) * (w > 6 ? 0.5 : 1.0);

    ctx.strokeStyle = `rgba(253, 224, 71, ${Math.max(0, waveAlpha) * goldGlow})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    let started = false;
    for (let x = scrollX + 30; x <= scrollX + scrollW - 30; x += 14) {
      const normX = (x - scrollX) / scrollW;
      const windowEdge = Math.sin(normX * Math.PI);
      const dy = Math.sin((x - scrollX) * 0.03 + wavePhase) * (0.9 + smoothBass * 1.5) * windowEdge;
      if (!started) {
        ctx.moveTo(x, waveY + dy);
        started = true;
      } else {
        ctx.lineTo(x, waveY + dy);
      }
    }
    ctx.stroke();
  }

  // 同心圆涟漪
  localRipples.forEach((rip: WaterRipple, idx: number) => {
    rip.radius += rip.speed;
    rip.alpha *= 0.965;

    if (rip.alpha > 0.02) {
      ctx.strokeStyle = `rgba(110, 231, 183, ${rip.alpha * 0.65})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(rip.x, rip.y, rip.radius, rip.radius * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      localRipples.splice(idx, 1);
    }
  });

  // ─── 6. 孤舟蓑笠与水面动态流金长倒影 ───
  const boatX = scrollX + scrollW * 0.75;
  const boatY = waterY + 14 + Math.sin(t * 1.5) * 2.0;
  drawDetailedBoatWithLongReflection(ctx, boatX, boatY, t, smoothBass, smoothMid, goldGlow);

  ctx.restore();

  // ─── 7. 半透明落英与金粉微尘 ───
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  localParticles.forEach((p: DustParticle) => {
    p.x += p.vx + Math.sin(t + p.phase) * 0.25;
    p.y += p.vy;
    if (p.y < scrollY) {
      p.y = scrollY + scrollH + 6;
      p.x = scrollX + Math.random() * scrollW;
    }
    if (p.x < scrollX) p.x = scrollX + scrollW;
    if (p.x > scrollX + scrollW) p.x = scrollX;

    const particleAlpha = p.alpha * (0.5 + Math.sin(t * 2.0 + p.phase) * 0.35);
    ctx.fillStyle = `rgba(253, 224, 71, ${particleAlpha * 1.3})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  localPetals.forEach((petal: GoldenPetal) => {
    petal.x += petal.vx + Math.sin(t * 1.2 + petal.phase) * 0.35;
    petal.y += petal.vy;
    petal.rotation += petal.vRot;

    if (petal.y > scrollY + scrollH + 10) {
      petal.y = scrollY - 10;
      petal.x = scrollX + Math.random() * scrollW;
    }
    if (petal.x > scrollX + scrollW + 10) petal.x = scrollX - 10;

    ctx.save();
    ctx.translate(petal.x, petal.y);
    ctx.rotate(petal.rotation);

    const petalGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, petal.size);
    petalGrad.addColorStop(0, `rgba(254, 240, 215, ${petal.alpha * 1.5})`);
    petalGrad.addColorStop(0.6, `rgba(251, 210, 175, ${petal.alpha * 0.9})`);
    petalGrad.addColorStop(1, "rgba(245, 180, 140, 0)");
    ctx.fillStyle = petalGrad;

    ctx.beginPath();
    ctx.ellipse(0, 0, petal.size, petal.size * petal.aspect, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.restore();

  // ─── 8. 东方长卷极简淡金诗意留白与朱砂小印 ───
  ctx.save();
  const textX = scrollX + 36;
  const textY = scrollY + 36;

  ctx.fillStyle = "rgba(254, 243, 199, 0.45)";
  ctx.font = "13px serif";
  ctx.textAlign = "center";
  ctx.fillText("千", textX, textY);
  ctx.fillText("里", textX, textY + 18);
  ctx.fillText("江", textX, textY + 36);
  ctx.fillText("山", textX, textY + 54);

  // 金石古法熟朱砂“清音”篆书印
  drawCinnabarSeal(ctx, textX - 8, textY + 68, 16);
  ctx.restore();

  // 电影级胶片暗角 (Film Vignette)
  if (filmVignette > 0) {
    const vigGrd = ctx.createRadialGradient(
      scrollX + scrollW / 2,
      scrollY + scrollH / 2,
      scrollW * 0.45,
      scrollX + scrollW / 2,
      scrollY + scrollH / 2,
      scrollW * 0.78
    );
    vigGrd.addColorStop(0, "rgba(0,0,0,0)");
    vigGrd.addColorStop(1, `rgba(0,0,0,${filmVignette * 0.38})`);
    ctx.fillStyle = vigGrd;
    ctx.fillRect(scrollX, scrollY, scrollW, scrollH);
  }

  // ─── 9. 绢帛羽化微边 ───
  ctx.restore(); // 退出剪裁

  ctx.strokeStyle = `rgba(251, 191, 36, ${0.22 * goldGlow})`;
  ctx.lineWidth = 1.0;
  roundRect(ctx, scrollX, scrollY, scrollW, scrollH, 16);
  ctx.stroke();

  ctx.restore();
}

/**
 * 晴空白鹭 · 仙鹤群飞 (Flock of Soaring Cranes)
 */
function drawFlockOfCranes(
  ctx: CanvasRenderingContext2D,
  cranes: CraneEntity[],
  scrollX: number,
  scrollY: number,
  scrollW: number,
  scrollH: number,
  t: number,
  smoothTreble: number
) {
  ctx.save();
  for (let i = 0; i < cranes.length; i++) {
    const c = cranes[i];
    c.relX += c.speed;
    if (c.relX > 1.15) c.relX = -0.15;

    const normX = c.relX;
    let craneAlpha = 0.85;
    if (normX < 0.1) craneAlpha *= normX / 0.1;
    if (normX > 0.9) craneAlpha *= (1.0 - normX) / 0.1;

    const cx = scrollX + normX * scrollW;
    const cy = scrollY + (c.relY + Math.sin(t * 1.5 + c.floatPhase) * 0.02) * scrollH;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(c.scale, c.scale);
    ctx.globalAlpha = Math.max(0, craneAlpha);

    const wingAngle = Math.sin(t * c.wingFreq * 4.0 + c.phase + smoothTreble * 2.5) * 0.34;

    // 1. 躯干与细长脖颈 (象牙白)
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.beginPath();
    ctx.moveTo(8, -1);
    ctx.quadraticCurveTo(15, -4, 20, -2); // 鹤喙
    ctx.quadraticCurveTo(12, 1, 0, 0);    // 身躯
    ctx.quadraticCurveTo(-6, 2, -10, 0);  // 尾羽
    ctx.fill();

    // 2. 丹顶 (朱砂点)
    ctx.fillStyle = "#c2352b";
    ctx.beginPath();
    ctx.arc(17, -3, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // 3. 上扬左翼
    ctx.save();
    ctx.translate(2, -1);
    ctx.rotate(-wingAngle - 0.2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-6, -14, -14, -18);
    ctx.quadraticCurveTo(-8, -8, 0, 0);
    ctx.fill();
    // 翼尖黑羽
    ctx.fillStyle = "rgba(10, 24, 30, 0.85)";
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(-14, -18);
    ctx.lineTo(-11, -11);
    ctx.fill();
    ctx.restore();

    // 4. 下覆右翼
    ctx.save();
    ctx.translate(2, 1);
    ctx.rotate(wingAngle * 0.7 + 0.1);
    ctx.fillStyle = "rgba(240, 245, 250, 0.75)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4, 10, -11, 14);
    ctx.quadraticCurveTo(-6, 6, 0, 0);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
  ctx.restore();
}

/**
 * 流体丝绢烟岚云带绘制 (Silk Mist Ribbon)
 */
function drawSilkMistRibbon(
  ctx: CanvasRenderingContext2D,
  scrollX: number,
  scrollY: number,
  scrollW: number,
  baseYNorm: number,
  thickness: number,
  t: number,
  alphaBase: number,
  smoothTreble: number,
  goldGlow: number
) {
  ctx.save();
  const yCenter = scrollY + baseYNorm;

  const grad = ctx.createLinearGradient(0, yCenter - thickness, 0, yCenter + thickness);
  grad.addColorStop(0, "rgba(215, 238, 242, 0)");
  grad.addColorStop(0.5, `rgba(225, 245, 248, ${alphaBase * (1 + smoothTreble * 0.45 * goldGlow)})`);
  grad.addColorStop(1, "rgba(215, 238, 242, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();

  const step = 8;
  // 上边界曲线 (左 -> 右)
  for (let x = scrollX; x <= scrollX + scrollW; x += step) {
    const normX = (x - scrollX) / scrollW;
    const env = Math.sin(normX * Math.PI);
    const wave = Math.sin(normX * 3.5 + t * 0.6) * 6 + Math.cos(normX * 7.2 - t * 0.3) * 3;
    const h = thickness * env * (0.65 + 0.35 * Math.sin(normX * 4.5 + t));
    const y = yCenter + wave - h;
    if (x === scrollX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // 下边界曲线 (右 -> 左)
  for (let x = scrollX + scrollW; x >= scrollX; x -= step) {
    const normX = (x - scrollX) / scrollW;
    const env = Math.sin(normX * Math.PI);
    const wave = Math.sin(normX * 3.5 + t * 0.6) * 6 + Math.cos(normX * 7.2 - t * 0.3) * 3;
    const h = thickness * env * (0.65 + 0.35 * Math.sin(normX * 4.5 + t));
    const y = yCenter + wave + h;
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 乌篷孤舟与水面动态流金长倒影
 */
function drawDetailedBoatWithLongReflection(
  ctx: CanvasRenderingContext2D,
  boatX: number,
  boatY: number,
  t: number,
  smoothBass: number,
  smoothMid: number,
  goldGlow: number
) {
  ctx.save();

  // 1. 水面动态拉伸流金倒影 (Specular Elongated Reflection)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const lanternX = boatX + 11;
  const lanternY = boatY - 2;
  const reflLength = 48;
  const slices = 10;

  for (let i = 0; i < slices; i++) {
    const frac = i / slices;
    const curY = boatY + 3 + frac * reflLength;
    const waveShift = Math.sin(curY * 0.18 + t * 3.0) * (2.2 + smoothBass * 3.2);
    const reflWidth = (6.0 + i * 2.2) * (1.0 + smoothMid * 0.6);
    const reflAlpha = 0.38 * (1.0 - frac * 0.85) * (0.8 + 0.2 * Math.sin(t * 3.5)) * goldGlow;

    ctx.fillStyle = `rgba(251, 191, 36, ${reflAlpha})`;
    ctx.beginPath();
    ctx.ellipse(lanternX + waveShift, curY, reflWidth, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 2. 船身 (优雅木质古舟)
  ctx.fillStyle = "rgba(8, 20, 26, 0.98)";
  ctx.beginPath();
  ctx.moveTo(boatX - 18, boatY);
  ctx.quadraticCurveTo(boatX, boatY + 4.5, boatX + 18, boatY);
  ctx.quadraticCurveTo(boatX, boatY + 0.8, boatX - 18, boatY);
  ctx.fill();

  // 3. 乌篷 (双层竹席篷)
  ctx.fillStyle = "rgba(12, 28, 36, 0.95)";
  ctx.beginPath();
  ctx.arc(boatX - 1, boatY - 1.5, 6.5, Math.PI, 0);
  ctx.fill();
  // 篷顶内沿暗影
  ctx.fillStyle = "rgba(4, 10, 14, 0.95)";
  ctx.beginPath();
  ctx.arc(boatX - 1, boatY - 1.0, 4.5, Math.PI, 0);
  ctx.fill();

  // 4. 蓑笠翁与鱼竿
  // 斗笠
  ctx.fillStyle = "rgba(20, 42, 50, 0.95)";
  ctx.beginPath();
  ctx.moveTo(boatX - 10, boatY - 4);
  ctx.lineTo(boatX - 6, boatY - 8);
  ctx.lineTo(boatX - 2, boatY - 4);
  ctx.closePath();
  ctx.fill();
  // 蓑衣身形
  ctx.beginPath();
  ctx.arc(boatX - 6, boatY - 2.5, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // 细韧鱼竿与钓丝
  ctx.strokeStyle = "rgba(200, 220, 230, 0.65)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(boatX - 6, boatY - 4);
  ctx.lineTo(boatX - 19, boatY - 12);
  ctx.lineTo(boatX - 21, boatY + 2); // 垂入水中的钓丝
  ctx.stroke();

  // 5. 暖金八角风灯
  const lanternPulse = 0.82 + Math.sin(t * 3.2) * 0.18 + smoothMid * 0.35;
  const lanternGlow = ctx.createRadialGradient(lanternX, lanternY, 0.5, lanternX, lanternY, 22);
  lanternGlow.addColorStop(0, `rgba(255, 248, 220, ${0.98 * lanternPulse})`);
  lanternGlow.addColorStop(0.3, `rgba(245, 158, 11, ${0.60 * lanternPulse * goldGlow})`);
  lanternGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = lanternGlow;
  ctx.beginPath();
  ctx.arc(lanternX, lanternY, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 金石古法熟朱砂“清音”篆书印
 */
function drawCinnabarSeal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  // 1. 印泥基底与金石微晕
  const sealGrad = ctx.createLinearGradient(x, y, x + size, y + size);
  sealGrad.addColorStop(0, "#c83b32");
  sealGrad.addColorStop(1, "#861814");
  ctx.fillStyle = sealGrad;

  roundRect(ctx, x, y, size, size, 1.8);
  ctx.fill();

  // 2. 金石边线（微带磨蚀残缺感）
  ctx.strokeStyle = "rgba(254, 243, 199, 0.35)";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 3. “清音”二字古篆阴刻骨架
  ctx.strokeStyle = "rgba(254, 243, 199, 0.88)";
  ctx.lineWidth = 0.85;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const half = size / 2;
  const pad = 2.5;

  // ─── 右半部：“清” (Qing) ───
  ctx.beginPath();
  ctx.moveTo(x + pad + 1.2, y + pad + 1.5);
  ctx.lineTo(x + pad + 0.8, y + pad + 3.5);
  ctx.moveTo(x + pad + 0.8, y + pad + 5.5);
  ctx.lineTo(x + pad + 1.6, y + pad + 8.5);

  ctx.moveTo(x + pad + 3.2, y + pad + 1.5);
  ctx.lineTo(x + half - 1.2, y + pad + 1.5);
  ctx.moveTo(x + pad + 4.5, y + pad + 1.0);
  ctx.lineTo(x + pad + 4.5, y + pad + 5.0);
  ctx.moveTo(x + pad + 3.2, y + pad + 3.2);
  ctx.lineTo(x + half - 1.2, y + pad + 3.2);

  ctx.moveTo(x + pad + 3.0, y + pad + 5.5);
  ctx.lineTo(x + pad + 3.0, y + size - pad - 1.0);
  ctx.lineTo(x + half - 1.2, y + size - pad - 1.0);
  ctx.lineTo(x + half - 1.2, y + pad + 5.5);
  ctx.moveTo(x + pad + 3.0, y + pad + 8.0);
  ctx.lineTo(x + half - 1.2, y + pad + 8.0);
  ctx.stroke();

  // ─── 左半部：“音” (Yin) ───
  ctx.beginPath();
  ctx.moveTo(x + half + 1.5, y + pad + 1.5);
  ctx.lineTo(x + size - pad - 1.5, y + pad + 1.5);
  ctx.moveTo(x + half + 4.0, y + pad + 0.8);
  ctx.lineTo(x + half + 4.0, y + pad + 3.5);
  ctx.moveTo(x + half + 2.5, y + pad + 3.5);
  ctx.lineTo(x + size - pad - 2.5, y + pad + 3.5);

  ctx.moveTo(x + half + 1.8, y + pad + 5.5);
  ctx.lineTo(x + half + 1.8, y + size - pad - 1.0);
  ctx.lineTo(x + size - pad - 1.8, y + size - pad - 1.0);
  ctx.lineTo(x + size - pad - 1.8, y + pad + 5.5);
  ctx.closePath();
  ctx.moveTo(x + half + 1.8, y + pad + 8.2);
  ctx.lineTo(x + size - pad - 1.8, y + pad + 8.2);
  ctx.stroke();

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 山脚水汀洲渚与沙洲微波 (Shoals & Sandbars)
 */
function drawWaterShoals(
  ctx: CanvasRenderingContext2D,
  scrollX: number,
  scrollW: number,
  waterY: number,
  t: number,
  smoothBass: number
) {
  ctx.save();
  // 3 组自然水渚 (左、中偏左、右)
  const shoals = [
    { x: scrollX + scrollW * 0.12, w: scrollW * 0.22, h: 7.5, color: "#0d3b36", alpha: 0.65 },
    { x: scrollX + scrollW * 0.46, w: scrollW * 0.18, h: 5.5, color: "#0a2f2b", alpha: 0.55 },
    { x: scrollX + scrollW * 0.78, w: scrollW * 0.26, h: 8.5, color: "#0e423a", alpha: 0.70 },
  ];

  for (let i = 0; i < shoals.length; i++) {
    const s = shoals[i];
    const waveY = waterY + Math.sin(t * 1.2 + i * 1.8) * (0.8 + smoothBass * 1.0);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(s.x, waveY, s.w * 0.5, s.h, 0, 0, Math.PI * 2);

    const shoalGrad = ctx.createLinearGradient(s.x, waveY - s.h, s.x, waveY + s.h * 1.5);
    shoalGrad.addColorStop(0, s.color);
    shoalGrad.addColorStop(0.6, "#061a1a");
    shoalGrad.addColorStop(1, "rgba(4, 16, 18, 0)");
    ctx.fillStyle = shoalGrad;
    ctx.globalAlpha = s.alpha;
    ctx.fill();

    // 汀渚水岸微金碎浪边缘
    ctx.strokeStyle = "rgba(110, 231, 183, 0.35)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(s.x, waveY + 0.5, s.w * 0.48, s.h * 0.7, 0, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();
}

/**
 * 宋代写意白玉素月与月华氛晕 (Ethereal Song Dynasty Moon)
 */
function drawSongDynastyMoon(
  ctx: CanvasRenderingContext2D,
  moonX: number,
  moonY: number,
  moonR: number,
  t: number,
  smoothMid: number
) {
  ctx.save();

  // 1. 广域清辉月晕
  const outerHalo = ctx.createRadialGradient(moonX, moonY, moonR * 0.8, moonX, moonY, moonR * 4.2);
  outerHalo.addColorStop(0, "rgba(254, 250, 225, 0.18)");
  outerHalo.addColorStop(0.35, "rgba(220, 245, 240, 0.07)");
  outerHalo.addColorStop(1, "rgba(5, 19, 28, 0)");
  ctx.fillStyle = outerHalo;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 4.2, 0, Math.PI * 2);
  ctx.fill();

  // 2. 玉润月轮本体 (柔焦白玉透青)
  const moonGrad = ctx.createLinearGradient(moonX - moonR * 0.7, moonY - moonR * 0.7, moonX + moonR * 0.8, moonY + moonR * 0.8);
  moonGrad.addColorStop(0, "rgba(255, 254, 245, 0.94)");
  moonGrad.addColorStop(0.55, "rgba(242, 250, 248, 0.82)");
  moonGrad.addColorStop(0.85, "rgba(218, 238, 238, 0.55)");
  moonGrad.addColorStop(1, "rgba(180, 215, 218, 0.25)");

  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  // 3. 写意素娥微影 (淡墨隐现)
  ctx.fillStyle = "rgba(160, 200, 205, 0.14)";
  ctx.beginPath();
  ctx.arc(moonX + moonR * 0.25, moonY + moonR * 0.15, moonR * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // 4. 月华微风轻岚 (月边拂过一缕细丝轻云)
  const cloudPhase = t * 0.4;
  const cloudY = moonY + moonR * 0.35 + Math.sin(cloudPhase) * 1.5;
  const cloudGrad = ctx.createLinearGradient(moonX - moonR * 2.0, cloudY, moonX + moonR * 2.0, cloudY);
  cloudGrad.addColorStop(0, "rgba(220, 245, 248, 0)");
  cloudGrad.addColorStop(0.5, `rgba(235, 250, 252, ${0.18 + smoothMid * 0.12})`);
  cloudGrad.addColorStop(1, "rgba(220, 245, 248, 0)");

  ctx.fillStyle = cloudGrad;
  ctx.beginPath();
  ctx.ellipse(moonX + Math.sin(cloudPhase) * 4, cloudY, moonR * 1.8, moonR * 0.22, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 水面月华银波倒影 (Moon Specular Ripple Reflection)
 */
function drawMoonWaterReflection(
  ctx: CanvasRenderingContext2D,
  moonX: number,
  waterY: number,
  waterH: number,
  t: number,
  smoothTreble: number,
  smoothBass: number
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const reflLength = Math.min(waterH * 0.75, 55);
  const slices = 12;

  for (let i = 0; i < slices; i++) {
    const frac = i / slices;
    const curY = waterY + 4 + frac * reflLength;
    const waveShift = Math.sin(curY * 0.16 + t * 2.4) * (2.0 + smoothBass * 2.5);
    const reflWidth = (14.0 + i * 3.5) * (1.0 + smoothTreble * 0.5);
    const reflAlpha = 0.22 * (1.0 - frac * 0.82) * (0.8 + 0.2 * Math.sin(t * 3.0 + i * 0.5));

    ctx.fillStyle = `rgba(220, 245, 248, ${reflAlpha})`;
    ctx.beginPath();
    ctx.ellipse(moonX + waveShift, curY, reflWidth * 0.5, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 水天交界处晨雾岚气 (Water Horizon Mist Ribbon)
 */
function drawWaterHorizonMist(
  ctx: CanvasRenderingContext2D,
  scrollX: number,
  scrollW: number,
  waterY: number,
  t: number,
  smoothTreble: number
) {
  ctx.save();
  const mistGrad = ctx.createLinearGradient(0, waterY - 8, 0, waterY + 14);
  mistGrad.addColorStop(0, "rgba(215, 240, 245, 0)");
  mistGrad.addColorStop(0.45, `rgba(225, 245, 248, ${0.12 + smoothTreble * 0.08})`);
  mistGrad.addColorStop(1, "rgba(215, 240, 245, 0)");

  ctx.fillStyle = mistGrad;
  ctx.beginPath();

  const step = 10;
  for (let x = scrollX; x <= scrollX + scrollW; x += step) {
    const normX = (x - scrollX) / scrollW;
    const env = Math.sin(normX * Math.PI);
    const wave = Math.sin(normX * 4.0 + t * 0.8) * 4.0;
    const y = waterY - 6 + wave * env;
    if (x === scrollX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  for (let x = scrollX + scrollW; x >= scrollX; x -= step) {
    const normX = (x - scrollX) / scrollW;
    const env = Math.sin(normX * Math.PI);
    const wave = Math.sin(normX * 4.0 + t * 0.8) * 4.0;
    const y = waterY + 12 + wave * env;
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

