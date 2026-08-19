"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface PhotonicParticle {
  radius: number;
  angle: number;
  speed: number;
  height: number;
  size: number;
  brightness: number;
  arm: number;
  trailLength: number;
}

interface DeepStar {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
}

interface WhiteShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

interface SuperstringState {
  particles: PhotonicParticle[];
  stars: DeepStar[];
  shockwaves: WhiteShockwave[];
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  rotationAngle: number;
  singularityPulse: number;
  lastBeatTime: number;
}

export const SuperstringSingularityV8Effect: EffectPlugin = {
  id: "superstring-singularity-v8",
  name: "量子超弦奇点",
  category: "space",
  description: "纯白量子引力奇点黑洞与高维时空曲率塌陷漏斗、4,800+ 颗对数螺旋光子流场的三维空间共振",
  preferredEngine: "canvas",

  parameters: [
    {
      id: "singularityMass",
      name: "引力奇点质量",
      type: "number",
      mode: "basic",
      min: 0.5,
      max: 3.0,
      step: 0.1,
      default: 1.0,
    },
    {
      id: "superstringTension",
      name: "超弦波动张力",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.2,
    },
    {
      id: "stardustDensity",
      name: "量子光子密度",
      type: "number",
      mode: "professional",
      min: 1000,
      max: 8000,
      step: 500,
      default: 4800,
    },
    {
      id: "chromaticAberration",
      name: "光子色散强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 2.0,
      step: 0.1,
      default: 0.8,
    },
    {
      id: "burstSensitivity",
      name: "瞬态爆发灵敏度",
      type: "number",
      mode: "basic",
      min: 0.1,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
    {
      id: "coreGlow",
      name: "光子环光晕",
      type: "number",
      mode: "professional",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.6,
    },
  ],

  init(ctx: RenderContext) {
    const particleCount = 4800;
    const particles: PhotonicParticle[] = [];
    const arms = 4;

    for (let i = 0; i < particleCount; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distRatio = Math.pow(Math.random(), 1.6);
      const radius = 18 + distRatio * 740;
      const spiralAngle = armAngle + Math.log(radius + 1) * 3.2 + (Math.random() - 0.5) * 0.35;
      const orbitSpeed = (0.006 + (1 / Math.sqrt(radius)) * 0.32) * 0.8;

      particles.push({
        radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height: (Math.random() - 0.5) * (10 + distRatio * 60),
        size: 0.4 + Math.random() * 1.8,
        brightness: 0.35 + Math.random() * 0.65,
        arm,
        trailLength: 3 + Math.random() * 8,
      });
    }

    const stars: DeepStar[] = [];
    for (let i = 0; i < 400; i++) {
      stars.push({
        x: (Math.random() - 0.5) * (ctx.width || 1920) * 1.4,
        y: (Math.random() - 0.5) * (ctx.height || 1080) * 1.4,
        z: Math.random() * 800 + 100,
        size: 0.5 + Math.random() * 1.6,
        alpha: 0.2 + Math.random() * 0.8,
        twinkleSpeed: 1 + Math.random() * 3,
      });
    }

    const state: SuperstringState = {
      particles,
      stars,
      shockwaves: [],
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      rotationAngle: 0,
      singularityPulse: 1.0,
      lastBeatTime: 0,
    };

    ctx.private = { state };
  },

  render(ctx: RenderContext, audioData: AudioData, params) {
    if (!ctx.ctx || !ctx.canvas) return;
    const canvas = ctx.canvas;
    const g = ctx.ctx;
    const sw = canvas.width;
    const sh = canvas.height;
    const cx = sw / 2;
    const cy = sh / 2;

    const {
      singularityMass = 1.0,
      superstringTension = 1.2,
      stardustDensity = 4800,
      burstSensitivity = 1.0,
      coreGlow = 1.6,
    } = params;

    let state = ctx.private?.state as SuperstringState | undefined;
    if (!state) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

    // Audio smoothing
    const rawBass = audioData.bass || 0;
    const rawMid = audioData.mid || 0;
    const rawTreble = audioData.treble || 0;
    const rawEnergy = audioData.full || 0.2;

    state.smoothedBass += (rawBass - state.smoothedBass) * 0.18;
    state.smoothedMid += (rawMid - state.smoothedMid) * 0.15;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * 0.14;
    state.smoothedEnergy += (rawEnergy - state.smoothedEnergy) * 0.15;

    const bass = state.smoothedBass;
    const mid = state.smoothedMid;
    const treble = state.smoothedTreble;
    const energy = state.smoothedEnergy;

    const t = ctx.time || Date.now() * 0.0008;

    // 1. Deep Obsidian Background & 3D Starfield
    g.save();
    g.fillStyle = "#010103";
    g.fillRect(0, 0, sw, sh);

    g.globalCompositeOperation = "screen";
    const bgGrd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.8);
    bgGrd.addColorStop(0, `rgba(240, 248, 255, ${0.12 + bass * 0.12})`);
    bgGrd.addColorStop(0.3, `rgba(190, 215, 245, ${0.04 + mid * 0.05})`);
    bgGrd.addColorStop(0.7, "rgba(100, 130, 170, 0.015)");
    bgGrd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = bgGrd;
    g.fillRect(0, 0, sw, sh);

    for (let i = 0; i < state.stars.length; i++) {
      const s = state.stars[i];
      const sx = cx + (s.x / s.z) * 500;
      const sy = cy + (s.y / s.z) * 500;

      if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
        const twinkle = Math.sin(t * s.twinkleSpeed + i) * 0.5 + 0.5;
        const sAlpha = s.alpha * (0.3 + twinkle * 0.7) * (1 - s.z / 1000);
        g.fillStyle = `rgba(235, 245, 255, ${sAlpha.toFixed(3)})`;
        g.fillRect(sx, sy, s.size, s.size);
      }
    }
    g.restore();

    // 2. Beat Triggered Shockwaves
    const now = ctx.time || Date.now() / 1000;
    if (audioData.isBeat && now - state.lastBeatTime > 0.25) {
      state.lastBeatTime = now;
      state.singularityPulse = 1.0 + (audioData.beatImpact || 0.8) * 0.45 * burstSensitivity;

      state.shockwaves.push({
        radius: 15 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.95,
        alpha: 0.95,
        speed: 12 + (audioData.beatImpact || 1.0) * 18 * burstSensitivity,
        lineWidth: 2 + (audioData.beatImpact || 1.0) * 6,
      });
    } else {
      state.singularityPulse += (1.0 - state.singularityPulse) * 0.08;
    }

    state.rotationAngle += 0.004 + energy * 0.012;

    // 3. 3D Camera Projection
    const fov = 540;
    const pitch = 0.65 + Math.sin(t * 0.3) * 0.05;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosR = Math.cos(state.rotationAngle);
    const sinR = Math.sin(state.rotationAngle);

    // 4. 3D Spacetime Curvature Funnel Grid
    g.save();
    g.globalCompositeOperation = "screen";

    const gridRings = 20;
    const gridSpokes = 32;
    const maxGridRadius = Math.max(sw, sh) * 0.8;

    for (let gr = 1; gr <= gridRings; gr++) {
      const ringFrac = gr / gridRings;
      const rRadius = Math.pow(ringFrac, 1.35) * maxGridRadius;
      const depthWarp = -Math.pow(1 - ringFrac, 2.0) * (220 + bass * 160) * singularityMass;
      const ringAlpha = (0.025 + ringFrac * 0.08) * (0.7 + energy * 0.5);

      g.beginPath();
      let first = true;
      for (let s = 0; s <= 64; s++) {
        const theta = (s / 64) * Math.PI * 2;
        const rawX = Math.cos(theta) * rRadius;
        const rawZ = Math.sin(theta) * rRadius;
        const rawY = depthWarp;

        const rx = rawX * cosR - rawZ * sinR;
        const rz = rawX * sinR + rawZ * cosR;
        const ry = rawY * cosP - rz * sinP;
        const finalZ = rawY * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const px = cx + rx * scale;
        const py = cy + ry * scale;

        if (first) {
          g.moveTo(px, py);
          first = false;
        } else {
          g.lineTo(px, py);
        }
      }
      g.strokeStyle = `rgba(215, 235, 255, ${ringAlpha.toFixed(3)})`;
      g.lineWidth = 0.5;
      g.stroke();
    }

    for (let gs = 0; gs < gridSpokes; gs++) {
      const spokeAngle = (gs / gridSpokes) * Math.PI * 2;
      g.beginPath();
      let first = true;

      for (let seg = 1; seg <= 30; seg++) {
        const ringFrac = seg / 30;
        const rRadius = Math.pow(ringFrac, 1.35) * maxGridRadius;
        const depthWarp = -Math.pow(1 - ringFrac, 2.0) * (220 + bass * 160) * singularityMass;

        const rawX = Math.cos(spokeAngle) * rRadius;
        const rawZ = Math.sin(spokeAngle) * rRadius;
        const rawY = depthWarp;

        const rx = rawX * cosR - rawZ * sinR;
        const rz = rawX * sinR + rawZ * cosR;
        const ry = rawY * cosP - rz * sinP;
        const finalZ = rawY * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const px = cx + rx * scale;
        const py = cy + ry * scale;

        if (first) {
          g.moveTo(px, py);
          first = false;
        } else {
          g.lineTo(px, py);
        }
      }
      g.strokeStyle = `rgba(200, 225, 255, ${0.035 + bass * 0.04})`;
      g.lineWidth = 0.5;
      g.stroke();
    }
    g.restore();

    // 5. 3D Spherical Harmonic Resonance Rings
    const sphereRings = 10;
    const ringSegs = 90;
    const waveData = audioData.waveformData || new Uint8Array(ringSegs);
    g.save();
    g.globalCompositeOperation = "screen";

    for (let r = 0; r < sphereRings; r++) {
      const rRatio = (r + 1) / sphereRings;
      const baseR = (50 + rRatio * 280) * singularityMass * (1 + bass * 0.28);
      const ringPhase = t * (1.2 + r * 0.2) * superstringTension;
      const points: { x: number; y: number }[] = [];

      for (let s = 0; s <= ringSegs; s++) {
        const theta = (s / ringSegs) * Math.PI * 2;
        const waveIdx = Math.floor((s / ringSegs) * waveData.length);
        const waveVal = ((waveData[waveIdx] || 128) - 128) / 128;

        const harm1 = Math.sin(theta * 4 + ringPhase + r) * (15 + mid * 45);
        const harm2 = Math.cos(theta * 6 - ringPhase * 0.8) * (8 + treble * 25);
        const audioDisp = waveVal * (25 * superstringTension + bass * 25);

        const curR = baseR + harm1 + harm2 + audioDisp;
        const rawX = Math.cos(theta) * curR;
        const rawY = Math.sin(theta * 2 + ringPhase) * (16 + mid * 35) + waveVal * 15;
        const rawZ = Math.sin(theta) * curR;

        const rx = rawX * cosR - rawZ * sinR;
        const rz = rawX * sinR + rawZ * cosR;
        const ry = rawY * cosP - rz * sinP;
        const finalZ = rawY * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        points.push({
          x: cx + rx * scale,
          y: cy + ry * scale,
        });
      }

      if (points.length > 3) {
        g.beginPath();
        g.moveTo(points[0].x, points[0].y);

        for (let p = 0; p < points.length - 1; p++) {
          const p0 = points[p];
          const p1 = points[p + 1];
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;
          g.quadraticCurveTo(p0.x, p0.y, midX, midY);
        }
        g.closePath();

        const alpha = (0.2 + (1 - rRatio) * 0.6) * (0.6 + mid * 0.45);
        g.strokeStyle = `rgba(240, 248, 255, ${alpha.toFixed(3)})`;
        g.lineWidth = (1.2 + (r % 3) * 0.6 + bass * 1.5) * coreGlow;
        g.shadowColor = "rgba(255, 255, 255, 0.85)";
        g.shadowBlur = (10 + mid * 18) * coreGlow;
        g.stroke();
      }
    }
    g.restore();

    // 6. 4,800+ Photonic Accretion Particles
    const activeCount = Math.min(stardustDensity, state.particles.length);
    g.save();
    g.globalCompositeOperation = "screen";

    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];
      const speedMult = (1 + energy * 2.4 + bass * 1.8) * superstringTension;
      p.angle += p.speed * speedMult;

      const curR = p.radius * (1 + Math.sin(t * 2.5 + p.angle * 3) * (0.04 + bass * 0.18));
      const pxRaw = Math.cos(p.angle) * curR;
      const pyRaw = p.height + Math.sin(t * 3 + p.radius * 0.06) * (12 + treble * 30);
      const pzRaw = Math.sin(p.angle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;

      const tangentAngle = p.angle + Math.PI / 2;
      const streakLen = p.trailLength * scale * (1 + bass * 1.6) * (200 / Math.max(20, curR));
      const streakEndX = screenX + Math.cos(tangentAngle) * streakLen;
      const streakEndY = screenY + Math.sin(tangentAngle) * streakLen * cosP;

      const pAlpha = Math.min(1, p.brightness * (0.4 + energy * 0.75) * (scale * 0.95));
      const pSize = Math.max(0.6, p.size * scale * (1 + treble * 1.4));

      g.strokeStyle = `rgba(235, 245, 255, ${(pAlpha * 0.85).toFixed(3)})`;
      g.lineWidth = pSize * 0.8;
      g.beginPath();
      g.moveTo(screenX, screenY);
      g.lineTo(streakEndX, streakEndY);
      g.stroke();

      g.fillStyle = `rgba(255, 255, 255, ${pAlpha.toFixed(3)})`;
      g.beginPath();
      g.arc(screenX, screenY, pSize, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // 7. Relativistic Polar White Jets
    g.save();
    g.globalCompositeOperation = "screen";
    const jetLen = (360 + treble * 580 + bass * 340) * coreGlow;
    const jetWidth = (12 + mid * 24) * coreGlow;

    const drawWhiteJet = (dir: 1 | -1) => {
      const targetY = cy + dir * jetLen;
      const jGrd = g.createLinearGradient(cx, cy, cx, targetY);
      jGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      jGrd.addColorStop(0.08, "rgba(240, 248, 255, 0.9)");
      jGrd.addColorStop(0.35, "rgba(180, 215, 255, 0.35)");
      jGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

      g.fillStyle = jGrd;
      g.beginPath();
      g.moveTo(cx - jetWidth, cy);
      g.quadraticCurveTo(cx - jetWidth * 0.2, cy + dir * jetLen * 0.4, cx, targetY);
      g.quadraticCurveTo(cx + jetWidth * 0.2, cy + dir * jetLen * 0.4, cx + jetWidth, cy);
      g.closePath();
      g.fill();
    };

    drawWhiteJet(-1);
    drawWhiteJet(1);

    // 8. Soft Anamorphic Flare
    const flareW = sw * (0.7 + bass * 0.3);
    const flareH = (14 + bass * 26) * coreGlow;

    const flareGrd = g.createRadialGradient(cx, cy, 0, cx, cy, flareW);
    flareGrd.addColorStop(0, `rgba(255, 255, 255, ${0.95 + bass * 0.05})`);
    flareGrd.addColorStop(0.12, "rgba(235, 245, 255, 0.75)");
    flareGrd.addColorStop(0.4, "rgba(180, 210, 250, 0.2)");
    flareGrd.addColorStop(0.7, "rgba(120, 160, 220, 0.05)");
    flareGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

    g.fillStyle = flareGrd;
    g.beginPath();
    g.ellipse(cx, cy, flareW, flareH, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 9. Shockwaves
    g.save();
    g.globalCompositeOperation = "screen";
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const swObj = state.shockwaves[i];
      swObj.radius += swObj.speed;
      swObj.alpha *= 0.93;

      if (swObj.alpha < 0.015 || swObj.radius > swObj.maxRadius) {
        state.shockwaves.splice(i, 1);
        continue;
      }

      const swGrd = g.createRadialGradient(
        cx,
        cy,
        Math.max(0, swObj.radius - 45),
        cx,
        cy,
        swObj.radius + 45
      );
      swGrd.addColorStop(0, "rgba(255,255,255,0)");
      swGrd.addColorStop(0.5, `rgba(255, 255, 255, ${(swObj.alpha * 0.95).toFixed(3)})`);
      swGrd.addColorStop(0.7, `rgba(200, 230, 255, ${(swObj.alpha * 0.35).toFixed(3)})`);
      swGrd.addColorStop(1, "rgba(255,255,255,0)");

      g.strokeStyle = swGrd;
      g.lineWidth = swObj.lineWidth;
      g.beginPath();
      g.arc(cx, cy, swObj.radius, 0, Math.PI * 2);
      g.stroke();
    }

    // 10. White-Hot Photonic Core
    const coreRadius = (18 + bass * 26) * singularityMass * state.singularityPulse * coreGlow;

    const coronaGrd = g.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 4.8);
    coronaGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    coronaGrd.addColorStop(0.18, `rgba(240, 250, 255, ${0.9 + bass * 0.1})`);
    coronaGrd.addColorStop(0.45, `rgba(185, 220, 255, ${0.45 + mid * 0.3})`);
    coronaGrd.addColorStop(0.75, "rgba(100, 150, 220, 0.1)");
    coronaGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

    g.fillStyle = coronaGrd;
    g.beginPath();
    g.arc(cx, cy, coreRadius * 4.8, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#FFFFFF";
    g.beginPath();
    g.arc(cx, cy, coreRadius * 0.9, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 1.0)";
    g.lineWidth = 3 + bass * 4;
    g.shadowColor = "#FFFFFF";
    g.shadowBlur = 35 * coreGlow;
    g.stroke();
    g.restore();
  },

  resize(_width: number, _height: number) {},

  destroy(ctx?: RenderContext) {
    if (ctx?.private?.state) {
      ctx.private.state = null;
    }
  },
};
