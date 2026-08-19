"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface StardustParticle {
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  verticalAmplitude: number;
  verticalFreq: number;
  size: number;
  baseAlpha: number;
  hueShift: number;
  armIndex: number;
}

interface ShockwaveRing {
  radius: number;
  maxRadius: number;
  opacity: number;
  speed: number;
  color: string;
  lineWidth: number;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  hue: number;
  alpha: number;
  speed: number;
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
      default: 3600,
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
      default: 1.6,
    },
    {
      id: "colorTheme",
      name: "星系色彩风格",
      type: "select",
      mode: "basic",
      default: "quantum",
      options: [
        { label: "量子霓虹 (紫蓝粉)", value: "quantum" },
        { label: "深空极光 (青绿金)", value: "celestial" },
        { label: "超新星 (赤红琥珀)", value: "supernova" },
        { label: "暗物质 (冰蓝幽紫)", value: "darkmatter" },
      ],
    },
  ],

  init(ctx: RenderContext) {
    const particleCount = 3600;
    const particles: StardustParticle[] = [];
    const arms = 4;

    for (let i = 0; i < particleCount; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distRatio = Math.pow(Math.random(), 1.6);
      const radius = 60 + distRatio * 620;
      const spiralAngle = armAngle + radius * 0.015 + (Math.random() - 0.5) * 0.6;
      const orbitSpeed = (0.008 + (1 / Math.sqrt(radius)) * 0.22) * 0.6;

      particles.push({
        orbitRadius: radius,
        orbitAngle: spiralAngle,
        orbitSpeed,
        verticalAmplitude: 15 + Math.random() * 45 * distRatio,
        verticalFreq: 1 + Math.random() * 3,
        size: 0.6 + Math.random() * 2.4,
        baseAlpha: 0.25 + Math.random() * 0.75,
        hueShift: (Math.random() - 0.5) * 60,
        armIndex: arm,
      });
    }

    const nebulae: NebulaCloud[] = [];
    for (let i = 0; i < 9; i++) {
      nebulae.push({
        x: (Math.random() - 0.5) * (ctx.width || 1920) * 0.8,
        y: (Math.random() - 0.5) * (ctx.height || 1080) * 0.8,
        radius: 200 + Math.random() * 400,
        hue: i % 2 === 0 ? 275 : i % 3 === 0 ? 335 : 190,
        alpha: 0.04 + Math.random() * 0.06,
        speed: (Math.random() - 0.5) * 0.002,
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
      stardustDensity = 3600,
      chromaticAberration = 0.8,
      burstSensitivity = 1.0,
      coreGlow = 1.6,
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

    state.smoothedBass += (rawBass - state.smoothedBass) * 0.18;
    state.smoothedMid += (rawMid - state.smoothedMid) * 0.14;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * 0.2;
    state.smoothedEnergy += (rawEnergy - state.smoothedEnergy) * 0.15;

    const bass = state.smoothedBass;
    const mid = state.smoothedMid;
    const treble = state.smoothedTreble;
    const energy = state.smoothedEnergy;

    const t = ctx.time || Date.now() * 0.0008;

    // Background clearing
    g.fillStyle = "#020108";
    g.fillRect(0, 0, sw, sh);

    // Color theme palette
    let baseHue = 275;
    let secondaryHue = 190;
    let accentHue = 335;

    if (colorTheme === "celestial") {
      baseHue = 165;
      secondaryHue = 205;
      accentHue = 45;
    } else if (colorTheme === "supernova") {
      baseHue = 15;
      secondaryHue = 345;
      accentHue = 48;
    } else if (colorTheme === "darkmatter") {
      baseHue = 240;
      secondaryHue = 285;
      accentHue = 180;
    }

    // Volumetric Nebula Gas Clouds
    g.save();
    g.globalCompositeOperation = "screen";
    for (let i = 0; i < state.nebulae.length; i++) {
      const neb = state.nebulae[i];
      const nx = cx + neb.x + Math.sin(t * neb.speed + i) * 60;
      const ny = cy + neb.y + Math.cos(t * neb.speed + i) * 40;
      const nRadius = neb.radius * (1 + bass * 0.25);

      const nebGrad = g.createRadialGradient(nx, ny, 0, nx, ny, nRadius);
      const nAlpha = neb.alpha * (0.8 + energy * 0.6);
      nebGrad.addColorStop(0, `hsla(${baseHue}, 90%, 55%, ${nAlpha.toFixed(3)})`);
      nebGrad.addColorStop(0.45, `hsla(${(baseHue + 25) % 360}, 85%, 40%, ${(nAlpha * 0.4).toFixed(3)})`);
      nebGrad.addColorStop(1, "rgba(0,0,0,0)");

      g.fillStyle = nebGrad;
      g.beginPath();
      g.arc(nx, ny, nRadius, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // Beat impact detection for Shockwaves
    const now = ctx.time || Date.now() / 1000;
    if (audioData.isBeat && now - state.lastBeatTime > 0.22) {
      state.lastBeatTime = now;
      state.singularityPulse = 1.0 + (audioData.beatImpact || 0.8) * 0.45 * burstSensitivity;

      state.shockwaves.push({
        radius: 45 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.85,
        opacity: 0.9,
        speed: 9 + (audioData.beatImpact || 1.0) * 14 * burstSensitivity,
        color: `hsla(${accentHue + (Math.random() - 0.5) * 30}, 95%, 72%, `,
        lineWidth: 2 + (audioData.beatImpact || 1.0) * 5,
      });
    } else {
      state.singularityPulse += (1.0 - state.singularityPulse) * 0.08;
    }

    state.rotationAngle += 0.004 + energy * 0.014;

    // Draw Shockwaves
    g.save();
    g.globalCompositeOperation = "screen";
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const swObj = state.shockwaves[i];
      swObj.radius += swObj.speed;
      swObj.opacity *= 0.94;

      if (swObj.opacity < 0.02 || swObj.radius > swObj.maxRadius) {
        state.shockwaves.splice(i, 1);
        continue;
      }

      const swGrad = g.createRadialGradient(
        cx,
        cy,
        Math.max(0, swObj.radius - swObj.lineWidth * 4),
        cx,
        cy,
        swObj.radius + swObj.lineWidth * 4
      );
      swGrad.addColorStop(0, "rgba(0,0,0,0)");
      swGrad.addColorStop(0.5, `${swObj.color}${swObj.opacity.toFixed(3)})`);
      swGrad.addColorStop(1, "rgba(0,0,0,0)");

      g.strokeStyle = swGrad;
      g.lineWidth = swObj.lineWidth;
      g.beginPath();
      g.arc(cx, cy, swObj.radius, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    // 3D Camera Projection Settings
    const fov = 480;
    const pitch = 0.58 + Math.sin(t * 0.35) * 0.06;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosR = Math.cos(state.rotationAngle);
    const sinR = Math.sin(state.rotationAngle);

    // Relativistic Polar Plasma Jets
    g.save();
    g.globalCompositeOperation = "screen";
    const jetLength = (220 + treble * 380 + bass * 240) * coreGlow;
    const jetBaseWidth = (14 + mid * 26) * coreGlow;

    // Upward Jet
    const jetUpGrad = g.createLinearGradient(cx, cy, cx, cy - jetLength);
    jetUpGrad.addColorStop(0, `hsla(${accentHue}, 100%, 95%, 0.95)`);
    jetUpGrad.addColorStop(0.15, `hsla(${baseHue}, 95%, 75%, 0.75)`);
    jetUpGrad.addColorStop(0.55, `hsla(${secondaryHue}, 90%, 60%, 0.3)`);
    jetUpGrad.addColorStop(1, "rgba(0,0,0,0)");

    g.fillStyle = jetUpGrad;
    g.beginPath();
    g.moveTo(cx - jetBaseWidth, cy);
    g.quadraticCurveTo(cx - jetBaseWidth * 0.3, cy - jetLength * 0.5, cx, cy - jetLength);
    g.quadraticCurveTo(cx + jetBaseWidth * 0.3, cy - jetLength * 0.5, cx + jetBaseWidth, cy);
    g.closePath();
    g.fill();

    // Downward Jet
    const jetDownGrad = g.createLinearGradient(cx, cy, cx, cy + jetLength);
    jetDownGrad.addColorStop(0, `hsla(${accentHue}, 100%, 95%, 0.95)`);
    jetDownGrad.addColorStop(0.15, `hsla(${baseHue}, 95%, 75%, 0.75)`);
    jetDownGrad.addColorStop(0.55, `hsla(${secondaryHue}, 90%, 60%, 0.3)`);
    jetDownGrad.addColorStop(1, "rgba(0,0,0,0)");

    g.fillStyle = jetDownGrad;
    g.beginPath();
    g.moveTo(cx - jetBaseWidth, cy);
    g.quadraticCurveTo(cx - jetBaseWidth * 0.3, cy + jetLength * 0.5, cx, cy + jetLength);
    g.quadraticCurveTo(cx + jetBaseWidth * 0.3, cy + jetLength * 0.5, cx + jetBaseWidth, cy);
    g.closePath();
    g.fill();
    g.restore();

    // Gravitational Lensing: Upper & Lower Photon Arches
    g.save();
    g.globalCompositeOperation = "screen";
    const coreRadius = 52 * singularityMass * state.singularityPulse * (1 + bass * 0.45);

    const lensedArchGrad = g.createRadialGradient(
      cx,
      cy - coreRadius * 0.4,
      coreRadius * 0.8,
      cx,
      cy - coreRadius * 0.4,
      coreRadius * 3.2 * coreGlow
    );
    lensedArchGrad.addColorStop(0, `hsla(${accentHue}, 100%, 88%, 0.9)`);
    lensedArchGrad.addColorStop(0.25, `hsla(${baseHue}, 95%, 70%, 0.65)`);
    lensedArchGrad.addColorStop(0.6, `hsla(${secondaryHue}, 90%, 55%, 0.25)`);
    lensedArchGrad.addColorStop(1, "rgba(0,0,0,0)");

    g.fillStyle = lensedArchGrad;
    g.beginPath();
    g.ellipse(cx, cy - coreRadius * 0.4, coreRadius * 2.8 * coreGlow, coreRadius * 1.8 * coreGlow, 0, Math.PI, 0);
    g.fill();

    g.beginPath();
    g.ellipse(cx, cy + coreRadius * 0.4, coreRadius * 2.5 * coreGlow, coreRadius * 1.4 * coreGlow, 0, 0, Math.PI);
    g.fill();
    g.restore();

    // Superstring Silk Harmonic Ribbons
    const ribbonCount = 9;
    const ribbonSteps = 120;
    const waveData = audioData.waveformData || new Uint8Array(ribbonSteps);

    g.save();
    g.globalCompositeOperation = "screen";

    for (let r = 0; r < ribbonCount; r++) {
      const ribbonPhase = (r / ribbonCount) * Math.PI * 2 + t * 1.6 * superstringTension;
      const ribbonRadius = (75 + r * 42) * singularityMass * (1 + bass * 0.35);
      const ribbonHue = (baseHue + r * 22 + state.rotationAngle * 30) % 360;

      g.beginPath();
      let firstPoint = true;

      for (let s = 0; s <= ribbonSteps; s++) {
        const theta = (s / ribbonSteps) * Math.PI * 2;
        const waveIdx = Math.floor((s / ribbonSteps) * waveData.length);
        const waveVal = ((waveData[waveIdx] || 128) - 128) / 128;

        const harm1 = Math.sin(theta * 5 + ribbonPhase) * (22 + mid * 55);
        const harm2 = Math.cos(theta * 8 - ribbonPhase * 1.5) * (12 + treble * 35);
        const harm3 = Math.sin(theta * 12 + t * 3) * (6 + energy * 20);
        const audioDisplacement = waveVal * (40 * superstringTension + bass * 35);

        const currentR = ribbonRadius + harm1 + harm2 + harm3 + audioDisplacement;
        const rawX = Math.cos(theta) * currentR;
        const rawY = Math.sin(theta * 4 + ribbonPhase) * (26 + mid * 45) + waveVal * 25;
        const rawZ = Math.sin(theta) * currentR;

        const rx = rawX * cosR - rawZ * sinR;
        const rz = rawX * sinR + rawZ * cosR;
        const ry = rawY * cosP - rz * sinP;
        const finalZ = rawY * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const projScale = fov / finalZ;
        const px = cx + rx * projScale;
        const py = cy + ry * projScale;

        if (firstPoint) {
          g.moveTo(px, py);
          firstPoint = false;
        } else {
          g.lineTo(px, py);
        }
      }

      g.strokeStyle = `hsla(${ribbonHue}, 92%, ${65 + mid * 25}%, ${0.45 + mid * 0.45})`;
      g.lineWidth = (1.6 + (r % 3) * 0.9 + bass * 2.0) * coreGlow;
      g.shadowColor = `hsla(${ribbonHue}, 98%, 75%, 0.9)`;
      g.shadowBlur = (14 + mid * 26) * coreGlow;
      g.stroke();
    }
    g.restore();

    // Accretion Disk Stardust Particles
    const activeCount = Math.min(stardustDensity, state.particles.length);
    g.save();
    g.globalCompositeOperation = "screen";

    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];
      const speedMult = (1 + energy * 2.2 + bass * 1.5) * superstringTension;
      p.orbitAngle += p.orbitSpeed * speedMult;

      const currentRadius = p.orbitRadius * (1 + Math.sin(t * 2.5 + p.orbitAngle * 4) * (0.06 + bass * 0.2));
      const pxRaw = Math.cos(p.orbitAngle) * currentRadius;
      const pyRaw = Math.sin(t * p.verticalFreq + p.orbitRadius * 0.08) * (p.verticalAmplitude * (1 + treble * 1.6));
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
      const dopplerBrightness = 1 + doppler * 0.45;
      const dopplerHueShift = doppler * 25;

      const particleSize = p.size * projScale * (1 + treble * 1.4);
      const alpha = Math.min(1, p.baseAlpha * (0.35 + energy * 0.75) * (projScale * 0.9) * dopplerBrightness);
      const hue = (baseHue + p.hueShift + dopplerHueShift + p.orbitRadius * 0.18 + energy * 45) % 360;

      g.fillStyle = `hsla(${hue}, 95%, ${72 + treble * 25}%, ${alpha.toFixed(3)})`;
      g.beginPath();
      g.arc(screenX, screenY, Math.max(0.6, particleSize), 0, Math.PI * 2);
      g.fill();

      if (chromaticAberration > 0.2 && p.size > 1.6) {
        const offset = chromaticAberration * 3 * projScale;
        g.fillStyle = `hsla(${secondaryHue}, 90%, 65%, ${(alpha * 0.45).toFixed(3)})`;
        g.beginPath();
        g.arc(screenX + offset, screenY, Math.max(0.4, particleSize * 0.8), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();

    // Anamorphic Lens Flare
    g.save();
    g.globalCompositeOperation = "screen";
    const flareWidth = sw * (0.6 + bass * 0.35);
    const flareHeight = (8 + bass * 22) * coreGlow;

    const flareGrad = g.createRadialGradient(cx, cy, 0, cx, cy, flareWidth);
    flareGrad.addColorStop(0, `hsla(${accentHue}, 100%, 95%, ${0.75 + bass * 0.25})`);
    flareGrad.addColorStop(0.15, `hsla(${baseHue}, 100%, 75%, 0.45)`);
    flareGrad.addColorStop(0.45, `hsla(${secondaryHue}, 90%, 60%, 0.15)`);
    flareGrad.addColorStop(1, "rgba(0,0,0,0)");

    g.fillStyle = flareGrad;
    g.beginPath();
    g.ellipse(cx, cy, flareWidth, flareHeight, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Central Photon Ring & Event Horizon
    g.save();
    g.globalCompositeOperation = "screen";

    const coronaGrad = g.createRadialGradient(
      cx,
      cy,
      coreRadius * 0.6,
      cx,
      cy,
      coreRadius * 3.4 * coreGlow
    );
    coronaGrad.addColorStop(0, `hsla(${accentHue}, 100%, 92%, 0.95)`);
    coronaGrad.addColorStop(0.2, `hsla(${baseHue}, 100%, 75%, 0.75)`);
    coronaGrad.addColorStop(0.55, `hsla(${secondaryHue}, 95%, 55%, 0.3)`);
    coronaGrad.addColorStop(1, "rgba(0,0,0,0)");

    g.fillStyle = coronaGrad;
    g.beginPath();
    g.arc(cx, cy, coreRadius * 3.4 * coreGlow, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Void Black Event Horizon
    g.save();
    g.fillStyle = "#010003";
    g.beginPath();
    g.arc(cx, cy, coreRadius * 0.94, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = `hsla(${accentHue}, 100%, 92%, ${0.85 + bass * 0.15})`;
    g.lineWidth = (3.2 + bass * 4.0) * coreGlow;
    g.shadowColor = `hsla(${accentHue}, 100%, 80%, 1)`;
    g.shadowBlur = (24 + bass * 35) * coreGlow;
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
