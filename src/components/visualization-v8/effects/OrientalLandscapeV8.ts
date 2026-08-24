/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext } from "@/lib/visualization/types";

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
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

export const OrientalLandscapeV8Effect: EffectPlugin = {
  id: "oriental-landscape-v8",
  name: "青绿千里 · 电影画卷",
  category: "shapes",
  description: "东方水墨重彩与电影级丁达尔神光远山画卷，专为纯音乐与国风设计",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "lightRays",
      name: "丁达尔神光强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 2,
      step: 0.1,
      default: 1.0,
      audioDriven: {
        enabled: true,
        band: "bass",
        multiplier: 0.6,
      },
    },
    {
      id: "mountainBreath",
      name: "远山呼吸感",
      type: "number",
      mode: "basic",
      min: 0.5,
      max: 2.5,
      step: 0.1,
      default: 1.0,
      audioDriven: {
        enabled: true,
        band: "bass",
        multiplier: 0.5,
      },
    },
    {
      id: "waterRipple",
      name: "水面涟漪灵敏度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 2,
      step: 0.1,
      default: 1.0,
      audioDriven: {
        enabled: true,
        band: "treble",
        multiplier: 0.8,
      },
    },
    {
      id: "scrollUnroll",
      name: "画轴锦绫与宣纸透光",
      type: "number",
      mode: "basic",
      min: 0.5,
      max: 1.5,
      step: 0.05,
      default: 1.0,
    },
    {
      id: "colorTheme",
      name: "东方配色主题",
      type: "select",
      mode: "basic",
      default: "peacock",
      options: [
        { label: "青绿千载 (千里江山)", value: "peacock" },
        { label: "暮色烟紫 (苍茫云海)", value: "sunset" },
        { label: "霜雪霁月 (水墨清虚)", value: "silver" },
      ],
    },
    {
      id: "filmGrain",
      name: "电影胶片与光晕",
      type: "number",
      mode: "professional",
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.35,
    },
  ],

  init() {
    (this as any).private = {
      time: 0,
      smoothBass: 0,
      smoothMid: 0,
      smoothTreble: 0,
      smoothEnergy: 0,
      unrollProgress: 0,
      ripples: [] as Ripple[],
      particles: [] as DustParticle[],
      lastRippleSpawn: 0,
      // 预生成金粉落英粒子
      initParticles: false,
    };
  },

  render(ctx, audioData, params) {
    if (!ctx.ctx || !ctx.canvas) return;

    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const width = canvas.width;
    const height = canvas.height;

    const priv = (this as any).private || {
      time: 0,
      smoothBass: 0,
      smoothMid: 0,
      smoothTreble: 0,
      smoothEnergy: 0,
      unrollProgress: 0,
      ripples: [],
      particles: [],
      lastRippleSpawn: 0,
      initParticles: false,
    };
    (this as any).private = priv;

    priv.time += 0.016;

    // 音频平滑处理（避免突兀跳变，保证悠扬大方的呼吸质感）
    const rawBass = audioData.bass || 0;
    const rawMid = audioData.mid || 0;
    const rawTreble = audioData.treble || 0;
    const rawEnergy = (rawBass * 0.4 + rawMid * 0.4 + rawTreble * 0.2);

    priv.smoothBass += (rawBass - priv.smoothBass) * 0.08;
    priv.smoothMid += (rawMid - priv.smoothMid) * 0.1;
    priv.smoothTreble += (rawTreble - priv.smoothTreble) * 0.12;
    priv.smoothEnergy += (rawEnergy - priv.smoothEnergy) * 0.08;

    // 卷轴平滑展开进度 (0 -> 1)
    if (priv.unrollProgress < 1) {
      priv.unrollProgress = Math.min(1, priv.unrollProgress + 0.02);
    }

    // 初始化金粉微尘粒子
    if (!priv.initParticles) {
      priv.particles = [];
      for (let i = 0; i < 40; i++) {
        priv.particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -Math.random() * 0.5 - 0.2,
          size: Math.random() * 2.5 + 1,
          alpha: Math.random() * 0.7 + 0.3,
          phase: Math.random() * Math.PI * 2,
        });
      }
      priv.initParticles = true;
    }

    // 泛音高频涟漪生成
    if (priv.smoothTreble > 0.35 && priv.time - priv.lastRippleSpawn > 0.25) {
      priv.lastRippleSpawn = priv.time;
      if (priv.ripples.length < 8) {
        priv.ripples.push({
          x: width * (0.3 + Math.random() * 0.4),
          y: height * (0.65 + Math.random() * 0.1),
          radius: 4,
          maxRadius: Math.min(width, height) * 0.25,
          alpha: 0.8 * (params.waterRipple ?? 1),
          speed: 1.5 + priv.smoothTreble * 2.0,
        });
      }
    }

    context.save();

    // ─── 1. 外部暗夜环境底色与环境光晕 (Ambient Cinema Backdrop) ───
    context.fillStyle = "#08090c";
    context.fillRect(0, 0, width, height);

    // 柔和环境弥散极光
    const ambientGlow = context.createRadialGradient(
      width * 0.5,
      height * 0.45,
      width * 0.1,
      width * 0.5,
      height * 0.45,
      width * 0.65
    );
    if (params.colorTheme === "sunset") {
      ambientGlow.addColorStop(0, "rgba(88, 28, 135, 0.22)");
      ambientGlow.addColorStop(0.5, "rgba(180, 83, 9, 0.12)");
      ambientGlow.addColorStop(1, "rgba(8, 9, 12, 0)");
    } else if (params.colorTheme === "silver") {
      ambientGlow.addColorStop(0, "rgba(51, 65, 85, 0.25)");
      ambientGlow.addColorStop(0.5, "rgba(30, 41, 59, 0.15)");
      ambientGlow.addColorStop(1, "rgba(8, 9, 12, 0)");
    } else {
      // 默认青绿千载
      ambientGlow.addColorStop(0, "rgba(13, 79, 108, 0.28)");
      ambientGlow.addColorStop(0.5, "rgba(26, 93, 87, 0.15)");
      ambientGlow.addColorStop(1, "rgba(8, 9, 12, 0)");
    }
    context.fillStyle = ambientGlow;
    context.fillRect(0, 0, width, height);

    // ─── 2. 2.35:1 宽银幕东方宣纸画卷剪裁区 (Scroll Inset) ───
    const maxScrollW = width * 0.88;
    const targetAspect = 2.35; // 宽银幕电影比例
    let scrollW = maxScrollW * priv.unrollProgress;
    let scrollH = scrollW / targetAspect;

    if (scrollH > height * 0.72) {
      scrollH = height * 0.72;
      scrollW = scrollH * targetAspect * priv.unrollProgress;
    }

    const scrollX = (width - scrollW) / 2;
    const scrollY = (height - scrollH) / 2;

    // 绘制画卷锦绫外框柔和阴影
    context.shadowColor = "rgba(0, 0, 0, 0.85)";
    context.shadowBlur = 48;
    context.shadowOffsetY = 16;
    context.fillStyle = "rgba(16, 20, 26, 0.95)";
    roundRect(context, scrollX, scrollY, scrollW, scrollH, 18);
    context.fill();
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;

    // 限制在画卷内部绘制
    context.save();
    context.beginPath();
    roundRect(context, scrollX, scrollY, scrollW, scrollH, 18);
    context.clip();

    // 宣纸底色渐变 (Antique Chinese Rice Paper Sky)
    const skyGrad = context.createLinearGradient(scrollX, scrollY, scrollX, scrollY + scrollH);
    if (params.colorTheme === "sunset") {
      skyGrad.addColorStop(0, "#20132b");
      skyGrad.addColorStop(0.4, "#3a2139");
      skyGrad.addColorStop(0.65, "#5c3335");
      skyGrad.addColorStop(1, "#1c1124");
    } else if (params.colorTheme === "silver") {
      skyGrad.addColorStop(0, "#0f172a");
      skyGrad.addColorStop(0.45, "#1e293b");
      skyGrad.addColorStop(0.7, "#334155");
      skyGrad.addColorStop(1, "#090d16");
    } else {
      // 青绿千载
      skyGrad.addColorStop(0, "#091722");
      skyGrad.addColorStop(0.35, "#0d2b38");
      skyGrad.addColorStop(0.65, "#153b3d");
      skyGrad.addColorStop(1, "#07141b");
    }
    context.fillStyle = skyGrad;
    context.fillRect(scrollX, scrollY, scrollW, scrollH);

    // 水面分界线 Y 坐标（位于画卷下方 38% 处）
    const waterY = scrollY + scrollH * 0.62;

    // ─── 3. 5 重远山叠嶂与水墨视差起伏 (5-Layer Parallax Mountain Ranges) ───
    const breathFactor = (params.mountainBreath ?? 1.0) * priv.smoothBass;
    const midVibe = priv.smoothMid * 8;

    // 山峰调色板配置
    const mountainColors =
      params.colorTheme === "sunset"
        ? [
            { fill: "#311c38", rim: "#c084fc", alpha: 0.4 },
            { fill: "#44213f", rim: "#e879f9", alpha: 0.6 },
            { fill: "#5b273d", rim: "#fb7185", alpha: 0.8 },
            { fill: "#4c1d2f", rim: "#f43f5e", alpha: 0.9 },
            { fill: "#2e0f1e", rim: "#fbbf24", alpha: 1.0 },
          ]
        : params.colorTheme === "silver"
        ? [
            { fill: "#1e293b", rim: "#94a3b8", alpha: 0.4 },
            { fill: "#334155", rim: "#cbd5e1", alpha: 0.6 },
            { fill: "#475569", rim: "#e2e8f0", alpha: 0.8 },
            { fill: "#1e293b", rim: "#f8fafc", alpha: 0.9 },
            { fill: "#0f172a", rim: "#e0f2fe", alpha: 1.0 },
          ]
        : [
            // 青绿千载
            { fill: "#0e313d", rim: "#38bdf8", alpha: 0.4 },
            { fill: "#11454a", rim: "#34d399", alpha: 0.65 },
            { fill: "#155e5b", rim: "#4ade80", alpha: 0.85 },
            { fill: "#164e43", rim: "#a3e635", alpha: 0.95 },
            { fill: "#0b2c28", rim: "#fbbf24", alpha: 1.0 },
          ];

    // 依次绘制 5 重远山
    for (let layer = 0; layer < 5; layer++) {
      const layerDepth = (layer + 1) / 5;
      const baseHeight = scrollH * (0.28 + layer * 0.08);
      const waveSpeed = 0.3 + layer * 0.15;
      const layerTime = priv.time * waveSpeed;
      const layerAmp = (baseHeight * 0.35 + breathFactor * 25 * layerDepth) * (1 + (layer === 4 ? midVibe * 0.04 : 0));

      context.beginPath();
      context.moveTo(scrollX, waterY);

      const step = 4;
      for (let x = scrollX; x <= scrollX + scrollW; x += step) {
        const normX = (x - scrollX) / scrollW;
        // 多八度谐波叠加塑造山峦起伏
        const s1 = Math.sin(normX * (3 + layer * 1.5) + layerTime + layer * 2.1);
        const s2 = Math.cos(normX * (7 + layer * 2) - layerTime * 0.6);
        const s3 = Math.sin(normX * 14 + layerTime * 1.2) * 0.25;
        const mountainCurve = (s1 * 0.6 + s2 * 0.3 + s3 * 0.1);

        const y = waterY - baseHeight - mountainCurve * layerAmp;
        context.lineTo(x, y);
      }

      context.lineTo(scrollX + scrollW, waterY);
      context.closePath();

      // 山体水墨渐变填充
      const mtnGrad = context.createLinearGradient(scrollX, waterY - baseHeight * 1.4, scrollX, waterY);
      mtnGrad.addColorStop(0, mountainColors[layer].fill);
      mtnGrad.addColorStop(1, "rgba(7, 20, 27, 0.95)");
      context.fillStyle = mtnGrad;
      context.globalAlpha = mountainColors[layer].alpha;
      context.fill();

      // 最前两重山脊勾金线 (Gold Rim Stroke)
      if (layer >= 3) {
        context.strokeStyle = mountainColors[layer].rim;
        context.lineWidth = layer === 4 ? 1.5 : 1.0;
        context.globalAlpha = 0.45 + priv.smoothMid * 0.55;
        context.stroke();
      }
    }
    context.globalAlpha = 1.0;

    // ─── 4. 丁达尔神光体积光束 (Volumetric Tyndall God Rays) ───
    const rayStrength = (params.lightRays ?? 1.0) * (0.6 + priv.smoothBass * 0.8 + priv.smoothEnergy * 0.4);
    if (rayStrength > 0.05) {
      context.save();
      context.globalCompositeOperation = "screen";

      const rayOriginX = scrollX + scrollW * 0.22;
      const rayOriginY = scrollY - 20;

      // 绘制 5 束穿透斜射光
      for (let r = 0; r < 5; r++) {
        const rayAngle = Math.PI * 0.28 + (r - 2) * 0.12 + Math.sin(priv.time * 0.4 + r) * 0.04;
        const rayLength = scrollH * 1.4;
        const raySpread = scrollW * (0.06 + r * 0.02);

        const rayGrad = context.createRadialGradient(
          rayOriginX,
          rayOriginY,
          10,
          rayOriginX + Math.cos(rayAngle) * rayLength * 0.6,
          rayOriginY + Math.sin(rayAngle) * rayLength * 0.6,
          rayLength
        );

        rayGrad.addColorStop(0, `rgba(251, 191, 36, ${0.45 * rayStrength})`);
        rayGrad.addColorStop(0.35, `rgba(245, 158, 11, ${0.2 * rayStrength})`);
        rayGrad.addColorStop(0.7, `rgba(56, 189, 248, ${0.08 * rayStrength})`);
        rayGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        context.fillStyle = rayGrad;
        context.beginPath();
        context.moveTo(rayOriginX, rayOriginY);
        context.lineTo(
          rayOriginX + Math.cos(rayAngle - 0.14) * rayLength - raySpread,
          rayOriginY + Math.sin(rayAngle - 0.14) * rayLength
        );
        context.lineTo(
          rayOriginX + Math.cos(rayAngle + 0.14) * rayLength + raySpread,
          rayOriginY + Math.sin(rayAngle + 0.14) * rayLength
        );
        context.closePath();
        context.fill();
      }

      // 横向宽银幕电影金光 (Anamorphic Gold Streak)
      if (priv.smoothBass > 0.45) {
        const streakY = waterY - scrollH * 0.25;
        const streakGrad = context.createLinearGradient(scrollX, streakY, scrollX + scrollW, streakY);
        streakGrad.addColorStop(0, "rgba(251, 191, 36, 0)");
        streakGrad.addColorStop(0.5, `rgba(251, 191, 36, ${(priv.smoothBass - 0.3) * 0.7})`);
        streakGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
        context.fillStyle = streakGrad;
        context.fillRect(scrollX, streakY - 1.5, scrollW, 3);
      }

      context.restore();
    }

    // ─── 5. 水镜实时微波倒影与泛音涟漪 (Water Specular Reflection & Ripples) ───
    // 水面底色
    const waterGrad = context.createLinearGradient(scrollX, waterY, scrollX, scrollY + scrollH);
    waterGrad.addColorStop(0, "rgba(7, 20, 27, 0.85)");
    waterGrad.addColorStop(0.4, "rgba(10, 32, 42, 0.95)");
    waterGrad.addColorStop(1, "rgba(5, 12, 16, 1.0)");
    context.fillStyle = waterGrad;
    context.fillRect(scrollX, waterY, scrollW, scrollH - (waterY - scrollY));

    // 水面水平高光微波 (Water Shimmer Waves)
    context.save();
    context.globalCompositeOperation = "lighter";
    const shimmerCount = 12;
    for (let w = 0; w < shimmerCount; w++) {
      const lineY = waterY + ((w + 1) / (shimmerCount + 1)) * (scrollY + scrollH - waterY);
      const wavePhase = priv.time * 1.2 + w * 0.8;
      const lineAlpha = (0.06 + Math.sin(wavePhase) * 0.04 + priv.smoothTreble * 0.1) * (w > 6 ? 0.6 : 1.0);

      context.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, lineAlpha)})`;
      context.lineWidth = 1.0;
      context.beginPath();
      context.moveTo(scrollX, lineY);
      for (let x = scrollX; x <= scrollX + scrollW; x += 16) {
        const dy = Math.sin((x - scrollX) * 0.04 + wavePhase) * (1.5 + priv.smoothBass * 2);
        context.lineTo(x, lineY + dy);
      }
      context.stroke();
    }

    // 同心圆声波涟漪渲染
    priv.ripples.forEach((rip: Ripple, idx: number) => {
      rip.radius += rip.speed;
      rip.alpha *= 0.96;

      if (rip.alpha > 0.02) {
        context.strokeStyle = `rgba(56, 189, 248, ${rip.alpha * 0.7})`;
        context.lineWidth = 1.5;
        context.beginPath();
        // 压扁为椭圆模拟透视水面
        context.ellipse(rip.x, rip.y, rip.radius, rip.radius * 0.35, 0, 0, Math.PI * 2);
        context.stroke();

        // 内层金光微晕
        context.strokeStyle = `rgba(251, 191, 36, ${rip.alpha * 0.4})`;
        context.beginPath();
        context.ellipse(rip.x, rip.y, rip.radius * 0.6, rip.radius * 0.22, 0, 0, Math.PI * 2);
        context.stroke();
      } else {
        priv.ripples.splice(idx, 1);
      }
    });
    context.restore();

    // ─── 6. 浮空微尘金粉落英 (Golden Petal Dust with Bokeh Glow) ───
    context.save();
    context.globalCompositeOperation = "lighter";
    priv.particles.forEach((p: DustParticle) => {
      p.x += p.vx + Math.sin(priv.time + p.phase) * 0.3;
      p.y += p.vy;
      if (p.y < scrollY) {
        p.y = scrollY + scrollH + 10;
        p.x = scrollX + Math.random() * scrollW;
      }
      if (p.x < scrollX) p.x = scrollX + scrollW;
      if (p.x > scrollX + scrollW) p.x = scrollX;

      const particleAlpha = p.alpha * (0.6 + Math.sin(priv.time * 2 + p.phase) * 0.4);
      context.fillStyle = `rgba(251, 191, 36, ${particleAlpha})`;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();

    // ─── 7. 宣纸锦绫金丝装裱边缘 (Silk Brocade Gold Border) ───
    context.restore(); // 退出剪裁

    // 绘制画轴金丝双线边框
    context.strokeStyle = "rgba(251, 191, 36, 0.4)";
    context.lineWidth = 1.5;
    roundRect(context, scrollX, scrollY, scrollW, scrollH, 18);
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.12)";
    context.lineWidth = 1;
    roundRect(context, scrollX + 3.5, scrollY + 3.5, scrollW - 7, scrollH - 7, 15);
    context.stroke();

    // 画卷四角东方雅致暗纹
    const cornerSize = 14;
    context.strokeStyle = "rgba(251, 191, 36, 0.75)";
    context.lineWidth = 2;
    // 左上
    context.beginPath();
    context.moveTo(scrollX + 8, scrollY + 8 + cornerSize);
    context.lineTo(scrollX + 8, scrollY + 8);
    context.lineTo(scrollX + 8 + cornerSize, scrollY + 8);
    context.stroke();
    // 右上
    context.beginPath();
    context.moveTo(scrollX + scrollW - 8 - cornerSize, scrollY + 8);
    context.lineTo(scrollX + scrollW - 8, scrollY + 8);
    context.lineTo(scrollX + scrollW - 8, scrollY + 8 + cornerSize);
    context.stroke();
    // 左下
    context.beginPath();
    context.moveTo(scrollX + 8, scrollY + scrollH - 8 - cornerSize);
    context.lineTo(scrollX + 8, scrollY + scrollH - 8);
    context.lineTo(scrollX + 8 + cornerSize, scrollY + scrollH - 8);
    context.stroke();
    // 右下
    context.beginPath();
    context.moveTo(scrollX + scrollW - 8 - cornerSize, scrollY + scrollH - 8);
    context.lineTo(scrollX + scrollW - 8, scrollY + scrollH - 8);
    context.lineTo(scrollX + scrollW - 8, scrollY + scrollH - 8 - cornerSize);
    context.stroke();

    context.restore();
  },

  resize(width: number, height: number) {
    console.log(`OrientalLandscapeV8 resized to ${width}x${height}`);
  },

  destroy(ctx?: RenderContext) {
    (this as any).private = null;
    if (ctx && ctx.private) {
      ctx.private.orientalState = null;
    }
  },
};

/**
 * 辅助绘制平滑圆角矩形路径
 */
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

export default OrientalLandscapeV8Effect;
