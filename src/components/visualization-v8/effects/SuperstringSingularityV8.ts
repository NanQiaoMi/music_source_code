"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface StardustParticle {
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  verticalAmp: number;
  verticalFreq: number;
  size: number;
  alpha: number;
  hueOffset: number;
  depth: number;
}

interface ShockwaveRing {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  hue: number;
  energy: number;
}

interface NebulaCloud {
  x: number;
  y: number;
  r: number;
  hue: number;
  alpha: number;
  vx: number;
  vy: number;
}

interface SuperstringState {
  particles: StardustParticle[];
  nebulae: NebulaCloud[];
  shockwaves: ShockwaveRing[];
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
  description: "引力奇点黑洞与高维超弦光带、量子星尘吸积流场的三维空间共振",
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
      name: "量子星尘密度",
      type: "number",
      mode: "professional",
      min: 1000,
      max: 8000,
      step: 500,
      default: 4200,
    },
    {
      id: "chromaticAberration",
      name: "全息色散强度",
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
      default: 1.5,
    },
    {
      id: "colorTheme",
      name: "星系色彩风格",
      type: "select",
      mode: "basic",
      default: "quantum",
      options: [
        { label: "量子极光 (极光蓝/紫/金)", value: "quantum" },
        { label: "星际深空 (深空青/绿/金)", value: "celestial" },
        { label: "黑洞原力 (赤红琥珀/金)", value: "supernova" },
        { label: "暗物质 (冰蓝/钛银/幽紫)", value: "darkmatter" },
      ],
    },
  ],

  init(ctx: RenderContext) {
    const particleCount = 4200;
    const particles: StardustParticle[] = [];
    const arms = 3;

    for (let i = 0; i < particleCount; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distRatio = Math.pow(Math.random(), 1.8);
      const radius = 55 + distRatio * 680;
      const spiralAngle = armAngle + radius * 0.012 + (Math.random() - 0.5) * 0.5;
      const orbitSpeed = (0.006 + (1 / Math.sqrt(radius)) * 0.18) * 0.7;

      particles.push({
        orbitRadius: radius,
        orbitAngle: spiralAngle,
        orbitSpeed,
        verticalAmp: 12 + Math.random() * 38 * distRatio,
        verticalFreq: 1 + Math.random() * 2.5,
        size: 0.5 + Math.random() * 2.0,
        alpha: 0.2 + Math.random() * 0.75,
        hueOffset: (Math.random() - 0.5) * 40,
        depth: Math.random(),
      });
    }

    const nebulae: NebulaCloud[] = [];
    for (let i = 0; i < 7; i++) {
      nebulae.push({
        x: (Math.random() - 0.5) * (ctx.width || 1920) * 0.7,
        y: (Math.random() - 0.5) * (ctx.height || 1080) * 0.6,
        r: 250 + Math.random() * 350,
        hue: i % 2 === 0 ? 295 : 192,
        alpha: 0.035 + Math.random() * 0.045,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.05,
      });
    }

    const state: SuperstringState = {
      particles,
      nebulae,
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
      stardustDensity = 4200,
      chromaticAberration = 0.8,
      burstSensitivity = 1.0,
      coreGlow = 1.5,
      colorTheme = "quantum",
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

    state.smoothedBass += (rawBass - state.smoothedBass) * 0.16;
    state.smoothedMid += (rawMid - state.smoothedMid) * 0.14;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * 0.12;
    state.smoothedEnergy += (rawEnergy - state.smoothedEnergy) * 0.15;

    const bass = state.smoothedBass;
    const mid = state.smoothedMid;
    const treble = state.smoothedTreble;
    const energy = state.smoothedEnergy;

    const t = ctx.time || Date.now() * 0.0006;

    // Palette Configuration
    let baseHue = 265;
    let cyanHue = 192;
    let goldHue = 42;
    let purpleHue = 295;

    if (colorTheme === "celestial") {
      baseHue = 165;
      cyanHue = 175;
      goldHue = 48;
      purpleHue = 210;
    } else if (colorTheme === "supernova") {
      baseHue = 18;
      cyanHue = 38;
      goldHue = 48;
      purpleHue = 345;
    } else if (colorTheme === "darkmatter") {
      baseHue = 230;
      cyanHue = 200;
      goldHue = 260;
      purpleHue = 280;
    }

    // 1. Deep Space Obsidian Background & Volumetric Nebula
    g.save();
    const bgGrad = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.85);
    bgGrad.addColorStop(0, `hsla(${baseHue}, 50%, 6%, 1)`);
    bgGrad.addColorStop(0.6, `hsla(${baseHue}, 40%, 3%, 1)`);
    bgGrad.addColorStop(1, "#020105");
    g.fillStyle = bgGrad;
    g.fillRect(0, 0, sw, sh);

    g.globalCompositeOperation = "screen";
    for (let i = 0; i < state.nebulae.length; i++) {
      const neb = state.nebulae[i];
      neb.x += neb.vx;
      neb.y += neb.vy;
      const nx = cx + neb.x + Math.sin(t * 0.4 + i) * 50;
      const ny = cy + neb.y + Math.cos(t * 0.3 + i) * 35;
      const nRadius = neb.r * (1 + bass * 0.3);

      const nebGrd = g.createRadialGradient(nx, ny, 0, nx, ny, nRadius);
      const nAlpha = neb.alpha * (0.8 + energy * 0.7);
      nebGrd.addColorStop(0, `hsla(${neb.hue}, 85%, 55%, ${nAlpha.toFixed(3)})`);
      nebGrd.addColorStop(0.5, `hsla(${(neb.hue + 30) % 360}, 80%, 35%, ${(nAlpha * 0.35).toFixed(3)})`);
      nebGrd.addColorStop(1, "rgba(0,0,0,0)");

      g.fillStyle = nebGrd;
      g.beginPath();
      g.arc(nx, ny, nRadius, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // 2. Beat Impact & Shockwaves
    const now = ctx.time || Date.now() / 1000;
    if (audioData.isBeat && now - state.lastBeatTime > 0.25) {
      state.lastBeatTime = now;
      state.singularityPulse = 1.0 + (audioData.beatImpact || 0.8) * 0.45 * burstSensitivity;

      state.shockwaves.push({
        radius: 40 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.9,
        alpha: 0.75,
        speed: 8 + (audioData.beatImpact || 1.0) * 12 * burstSensitivity,
        hue: cyanHue,
        energy: bass,
      });
    } else {
      state.singularityPulse += (1.0 - state.singularityPulse) * 0.08;
    }

    state.rotationAngle += 0.003 + energy * 0.01;

    // Draw Shockwaves
    g.save();
    g.globalCompositeOperation = "screen";
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const swObj = state.shockwaves[i];
      swObj.radius += swObj.speed;
      swObj.alpha *= 0.945;

      if (swObj.alpha < 0.015 || swObj.radius > swObj.maxRadius) {
        state.shockwaves.splice(i, 1);
        continue;
      }

      const swGrd = g.createRadialGradient(
        cx,
        cy,
        Math.max(0, swObj.radius - 35),
        cx,
        cy,
        swObj.radius + 35
      );
      swGrd.addColorStop(0, "rgba(0,0,0,0)");
      swGrd.addColorStop(0.45, `hsla(${swObj.hue}, 95%, 75%, ${(swObj.alpha * 0.7).toFixed(3)})`);
      swGrd.addColorStop(0.55, `hsla(${goldHue}, 100%, 85%, ${(swObj.alpha * 0.9).toFixed(3)})`);
      swGrd.addColorStop(1, "rgba(0,0,0,0)");

      g.strokeStyle = swGrd;
      g.lineWidth = 3 + swObj.energy * 4;
      g.beginPath();
      g.arc(cx, cy, swObj.radius, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    // 3. 3D Camera Projection
    const fov = 520;
    const pitch = 0.62 + Math.sin(t * 0.3) * 0.05;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosR = Math.cos(state.rotationAngle);
    const sinR = Math.sin(state.rotationAngle);

    // 4. Relativistic Polar Plasma Quasar Jets
    g.save();
    g.globalCompositeOperation = "screen";
    const jetLength = (280 + treble * 450 + bass * 260) * coreGlow;
    const jetWidth = (10 + mid * 22) * coreGlow;

    const drawJet = (dir: 1 | -1) => {
      const targetY = cy + dir * jetLength;
      const jGrad = g.createLinearGradient(cx, cy, cx, targetY);
      jGrad.addColorStop(0, `hsla(${goldHue}, 100%, 95%, 0.9)`);
      jGrad.addColorStop(0.12, `hsla(${cyanHue}, 95%, 80%, 0.7)`);
      jGrad.addColorStop(0.45, `hsla(${purpleHue}, 90%, 65%, 0.25)`);
      jGrad.addColorStop(1, "rgba(0,0,0,0)");

      g.fillStyle = jGrad;
      g.beginPath();
      g.moveTo(cx - jetWidth, cy);
      g.quadraticCurveTo(cx - jetWidth * 0.25, cy + dir * jetLength * 0.5, cx, targetY);
      g.quadraticCurveTo(cx + jetWidth * 0.25, cy + dir * jetLength * 0.5, cx + jetWidth, cy);
      g.closePath();
      g.fill();
    };

    drawJet(-1);
    drawJet(1);
    g.restore();

    // 5. Kerr Metric Gravitational Lensing Arches
    const coreRadius = 48 * singularityMass * state.singularityPulse * (1 + bass * 0.4);
    g.save();
    g.globalCompositeOperation = "screen";

    const upperLensedGrad = g.createRadialGradient(
      cx,
      cy - coreRadius * 0.35,
      coreRadius * 0.7,
      cx,
      cy - coreRadius * 0.35,
      coreRadius * 3.6 * coreGlow
    );
    upperLensedGrad.addColorStop(0, `hsla(${goldHue}, 100%, 90%, 0.95)`);
    upperLensedGrad.addColorStop(0.2, `hsla(${cyanHue}, 95%, 75%, 0.7)`);
    upperLensedGrad.addColorStop(0.55, `hsla(${purpleHue}, 90%, 55%, 0.22)`);
    upperLensedGrad.addColorStop(1, "rgba(0,0,0,0)");

    g.fillStyle = upperLensedGrad;
    g.beginPath();
    g.ellipse(cx, cy - coreRadius * 0.35, coreRadius * 2.9 * coreGlow, coreRadius * 1.7 * coreGlow, 0, Math.PI, 0);
    g.fill();

    g.beginPath();
    g.ellipse(cx, cy + coreRadius * 0.35, coreRadius * 2.6 * coreGlow, coreRadius * 1.3 * coreGlow, 0, 0, Math.PI);
    g.fill();
    g.restore();

    // 6. Smooth Calabi-Yau Superstring Waveform Ribbons (Cubic Splines)
    const ribbonCount = 7;
    const ribbonSegments = 72;
    const waveData = audioData.waveformData || new Uint8Array(ribbonSegments);
    g.save();
    g.globalCompositeOperation = "screen";

    for (let r = 0; r < ribbonCount; r++) {
      const ribbonPhase = (r / ribbonCount) * Math.PI * 2 + t * 1.4 * superstringTension;
      const ribbonRadius = (80 + r * 48) * singularityMass * (1 + bass * 0.32);
      const ribbonHue = r % 2 === 0 ? (cyanHue + r * 15) % 360 : (purpleHue + r * 10) % 360;

      const points: { x: number; y: number }[] = [];

      for (let s = 0; s <= ribbonSegments; s++) {
        const theta = (s / ribbonSegments) * Math.PI * 2;
        const waveIdx = Math.floor((s / ribbonSegments) * waveData.length);
        const waveVal = ((waveData[waveIdx] || 128) - 128) / 128;

        const harm1 = Math.sin(theta * 4 + ribbonPhase) * (18 + mid * 45);
        const harm2 = Math.cos(theta * 6 - ribbonPhase * 1.2) * (10 + treble * 28);
        const audioDisp = waveVal * (32 * superstringTension + bass * 26);

        const currentR = ribbonRadius + harm1 + harm2 + audioDisp;
        const rawX = Math.cos(theta) * currentR;
        const rawY = Math.sin(theta * 3 + ribbonPhase) * (20 + mid * 36) + waveVal * 18;
        const rawZ = Math.sin(theta) * currentR;

        const rx = rawX * cosR - rawZ * sinR;
        const rz = rawX * sinR + rawZ * cosR;
        const ry = rawY * cosP - rz * sinP;
        const finalZ = rawY * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const projScale = fov / finalZ;
        points.push({
          x: cx + rx * projScale,
          y: cy + ry * projScale,
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

        g.strokeStyle = `hsla(${ribbonHue}, 95%, ${70 + mid * 20}%, ${0.5 + mid * 0.4})`;
        g.lineWidth = (1.8 + (r % 3) * 0.8 + bass * 1.6) * coreGlow;
        g.shadowColor = `hsla(${ribbonHue}, 100%, 75%, 0.85)`;
        g.shadowBlur = (12 + mid * 20) * coreGlow;
        g.stroke();
      }
    }
    g.restore();

    // 7. Accretion Disk Stardust Particles
    const activeCount = Math.min(stardustDensity, state.particles.length);
    g.save();
    g.globalCompositeOperation = "screen";

    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];
      const speedMult = (1 + energy * 2.0 + bass * 1.4) * superstringTension;
      p.orbitAngle += p.orbitSpeed * speedMult;

      const currentRadius = p.orbitRadius * (1 + Math.sin(t * 2.2 + p.orbitAngle * 3) * (0.05 + bass * 0.18));
      const pxRaw = Math.cos(p.orbitAngle) * currentRadius;
      const pyRaw = Math.sin(t * p.verticalFreq + p.orbitRadius * 0.06) * (p.verticalAmp * (1 + treble * 1.5));
      const pzRaw = Math.sin(p.orbitAngle) * currentRadius;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const projScale = fov / finalZ;
      const screenX = cx + rx * projScale;
      const screenY = cy + ry * projScale;

      const doppler = Math.sin(p.orbitAngle + state.rotationAngle);
      const dopplerBrightness = 1 + doppler * 0.4;
      const pHue = doppler > 0 ? (cyanHue + p.hueOffset) % 360 : (purpleHue + p.hueOffset) % 360;

      const particleSize = p.size * projScale * (1 + treble * 1.2);
      const alpha = Math.min(1, p.alpha * (0.3 + energy * 0.7) * (projScale * 0.9) * dopplerBrightness);

      g.fillStyle = `hsla(${pHue}, 95%, ${72 + treble * 22}%, ${alpha.toFixed(3)})`;
      g.beginPath();
      g.arc(screenX, screenY, Math.max(0.5, particleSize), 0, Math.PI * 2);
      g.fill();

      if (chromaticAberration > 0.2 && p.size > 1.7) {
        g.fillStyle = `hsla(${goldHue}, 100%, 85%, ${(alpha * 0.4).toFixed(3)})`;
        g.beginPath();
        g.arc(screenX, screenY, particleSize * 2.4, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();

    // 8. Anamorphic Horizontal Lens Flare
    g.save();
    g.globalCompositeOperation = "screen";
    const flareWidth = sw * (0.65 + bass * 0.35);
    const flareHeight = (12 + bass * 28) * coreGlow;

    const flareGrd = g.createRadialGradient(cx, cy, 0, cx, cy, flareWidth);
    flareGrd.addColorStop(0, `hsla(${goldHue}, 100%, 96%, ${0.85 + bass * 0.15})`);
    flareGrd.addColorStop(0.15, `hsla(${cyanHue}, 95%, 80%, 0.55)`);
    flareGrd.addColorStop(0.45, `hsla(${purpleHue}, 90%, 65%, 0.18)`);
    flareGrd.addColorStop(1, "rgba(0,0,0,0)");

    g.fillStyle = flareGrd;
    g.beginPath();
    g.ellipse(cx, cy, flareWidth, flareHeight, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 9. Central Photon Capture Ring & Event Horizon
    g.save();
    g.globalCompositeOperation = "screen";

    const coronaGrd = g.createRadialGradient(
      cx,
      cy,
      coreRadius * 0.5,
      cx,
      cy,
      coreRadius * 3.5 * coreGlow
    );
    coronaGrd.addColorStop(0, `hsla(${goldHue}, 100%, 95%, 0.95)`);
    coronaGrd.addColorStop(0.22, `hsla(${cyanHue}, 100%, 75%, 0.75)`);
    coronaGrd.addColorStop(0.55, `hsla(${purpleHue}, 95%, 55%, 0.28)`);
    coronaGrd.addColorStop(1, "rgba(0,0,0,0)");

    g.fillStyle = coronaGrd;
    g.beginPath();
    g.arc(cx, cy, coreRadius * 3.5 * coreGlow, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Void Black Event Horizon
    g.save();
    g.fillStyle = "#010003";
    g.beginPath();
    g.arc(cx, cy, coreRadius * 0.95, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = `hsla(${goldHue}, 100%, 92%, ${0.88 + bass * 0.12})`;
    g.lineWidth = (3.5 + bass * 4.5) * coreGlow;
    g.shadowColor = `hsla(${cyanHue}, 100%, 80%, 1)`;
    g.shadowBlur = (26 + bass * 38) * coreGlow;
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
