"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface StardustParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  verticalOffset: number;
  size: number;
  brightness: number;
  hueOffset: number;
}

interface ShockwaveRing {
  radius: number;
  maxRadius: number;
  opacity: number;
  speed: number;
  color: string;
  lineWidth: number;
}

interface SuperstringState {
  particles: StardustParticle[];
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
      default: 3500,
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
        { label: "量子霓虹 (紫蓝粉)", value: "quantum" },
        { label: "深空极光 (青绿金)", value: "celestial" },
        { label: "超新星 (赤红琥珀)", value: "supernova" },
        { label: "暗物质 (冰蓝幽紫)", value: "darkmatter" },
      ],
    },
  ],

  init(ctx: RenderContext) {
    const particleCount = 3500;
    const particles: StardustParticle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 60 + Math.pow(Math.random(), 1.8) * 520;
      const angle = Math.random() * Math.PI * 2;
      const orbitSpeed = (0.004 + (1 / Math.sqrt(radius)) * 0.12) * (Math.random() > 0.1 ? 1 : -1);

      particles.push({
        x: Math.cos(angle) * radius,
        y: (Math.random() - 0.5) * (radius * 0.35),
        z: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        vz: 0,
        orbitRadius: radius,
        orbitAngle: angle,
        orbitSpeed,
        verticalOffset: (Math.random() - 0.5) * 40,
        size: 0.8 + Math.random() * 2.4,
        brightness: 0.3 + Math.random() * 0.7,
        hueOffset: (Math.random() - 0.5) * 60,
      });
    }

    const state: SuperstringState = {
      particles,
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
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    const {
      singularityMass = 1.0,
      superstringTension = 1.2,
      stardustDensity = 3500,
      chromaticAberration = 0.8,
      burstSensitivity = 1.0,
      coreGlow = 1.5,
      colorTheme = "quantum",
    } = params;

    // Get or initialize state
    let state = ctx.private?.state as SuperstringState | undefined;
    if (!state) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

    // Audio Smoothing
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

    // Background clearing with cosmic trail fade
    g.fillStyle = "rgba(4, 3, 10, 0.32)";
    g.fillRect(0, 0, w, h);

    // Color theme palette
    let baseHue = 270;
    let secondaryHue = 195;
    let accentHue = 330;

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

    // Beat impact detection for Relativistic Jet & Shockwave
    const now = ctx.time || Date.now() / 1000;
    if (audioData.isBeat && now - state.lastBeatTime > 0.22) {
      state.lastBeatTime = now;
      state.singularityPulse = 1.0 + (audioData.beatImpact || 0.8) * 0.45 * burstSensitivity;

      // Spawn gravitational shockwave
      state.shockwaves.push({
        radius: 40 * singularityMass,
        maxRadius: Math.max(w, h) * 0.75,
        opacity: 0.85,
        speed: 8 + (audioData.beatImpact || 1.0) * 12 * burstSensitivity,
        color: `hsla(${accentHue + (Math.random() - 0.5) * 30}, 95%, 68%, `,
        lineWidth: 2 + (audioData.beatImpact || 1.0) * 4,
      });
    } else {
      state.singularityPulse += (1.0 - state.singularityPulse) * 0.08;
    }

    state.rotationAngle += 0.003 + energy * 0.012;

    // 1. Draw Shockwaves
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.radius += sw.speed;
      sw.opacity *= 0.94;

      if (sw.opacity < 0.02 || sw.radius > sw.maxRadius) {
        state.shockwaves.splice(i, 1);
        continue;
      }

      g.save();
      g.beginPath();
      g.arc(cx, cy, sw.radius, 0, Math.PI * 2);
      g.strokeStyle = `${sw.color}${sw.opacity.toFixed(3)})`;
      g.lineWidth = sw.lineWidth * (1 - sw.radius / sw.maxRadius);
      g.shadowColor = `${sw.color}1)`;
      g.shadowBlur = 15 * coreGlow;
      g.stroke();
      g.restore();
    }

    // 2. 3D Camera Projection Settings
    const fov = 420;
    const pitch = 0.52 + Math.sin(now * 0.25) * 0.08; // 3D tilt
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosR = Math.cos(state.rotationAngle);
    const sinR = Math.sin(state.rotationAngle);

    // 3. Superstring Harmonic Ribbons (3D Calabi-Yau Parametric Wave Ribbons)
    const ribbonCount = 7;
    const ribbonSteps = 96;
    const waveData = audioData.waveformData || new Uint8Array(ribbonSteps);

    g.save();
    g.globalCompositeOperation = "screen";

    for (let r = 0; r < ribbonCount; r++) {
      const ribbonPhase = (r / ribbonCount) * Math.PI * 2 + now * 0.8 * superstringTension;
      const ribbonRadius = (90 + r * 38) * singularityMass * (1 + bass * 0.35);
      const ribbonHue = (baseHue + r * 22 + state.rotationAngle * 30) % 360;

      g.beginPath();
      let firstPoint = true;

      for (let s = 0; s <= ribbonSteps; s++) {
        const theta = (s / ribbonSteps) * Math.PI * 2;
        const waveIdx = Math.floor((s / ribbonSteps) * waveData.length);
        const waveVal = ((waveData[waveIdx] || 128) - 128) / 128; // -1 to 1

        // Harmonic modulation
        const harm1 = Math.sin(theta * 4 + ribbonPhase) * (20 + mid * 45);
        const harm2 = Math.cos(theta * 7 - ribbonPhase * 1.4) * (10 + treble * 30);
        const audioDisplacement = waveVal * (35 * superstringTension + bass * 30);

        const currentR = ribbonRadius + harm1 + harm2 + audioDisplacement;
        const rawX = Math.cos(theta) * currentR;
        const rawY = Math.sin(theta * 3 + ribbonPhase) * (25 + mid * 35) + waveVal * 20;
        const rawZ = Math.sin(theta) * currentR;

        // Apply 3D Rotation & Tilt
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

      g.strokeStyle = `hsla(${ribbonHue}, 88%, ${60 + mid * 25}%, ${0.35 + mid * 0.45})`;
      g.lineWidth = (1.4 + (r % 3) * 0.8 + bass * 1.5) * coreGlow;
      g.shadowColor = `hsla(${ribbonHue}, 95%, 70%, 0.8)`;
      g.shadowBlur = (10 + mid * 20) * coreGlow;
      g.stroke();
    }
    g.restore();

    // 4. Quantum Stardust Accretion Particles
    const activeCount = Math.min(stardustDensity, state.particles.length);
    g.save();
    g.globalCompositeOperation = "screen";

    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];

      // Keplerian orbit acceleration
      const speedMultiplier = (1 + energy * 1.8 + bass * 1.2) * superstringTension;
      p.orbitAngle += p.orbitSpeed * speedMultiplier;

      // Gravitational breathing
      const currentRadius = p.orbitRadius * (1 + Math.sin(now * 2 + p.orbitAngle * 3) * (0.05 + bass * 0.15));
      const pxRaw = Math.cos(p.orbitAngle) * currentRadius;
      const pyRaw = p.y + Math.sin(now * 3 + p.orbitRadius * 0.05) * (p.verticalOffset * (1 + treble * 1.5));
      const pzRaw = Math.sin(p.orbitAngle) * currentRadius;

      // 3D projection
      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const projScale = fov / finalZ;
      const screenX = cx + rx * projScale;
      const screenY = cy + ry * projScale;

      const particleSize = p.size * projScale * (1 + treble * 1.2);
      const alpha = Math.min(1, p.brightness * (0.3 + energy * 0.7) * (projScale * 0.8));
      const hue = (baseHue + p.hueOffset + p.orbitRadius * 0.2 + energy * 40) % 360;

      g.fillStyle = `hsla(${hue}, 92%, ${70 + treble * 25}%, ${alpha.toFixed(3)})`;
      g.beginPath();
      g.arc(screenX, screenY, Math.max(0.5, particleSize), 0, Math.PI * 2);
      g.fill();

      // Chromatic dispersion ghost particle if enabled
      if (chromaticAberration > 0.2 && p.brightness > 0.6) {
        const offset = chromaticAberration * 3 * projScale;
        g.fillStyle = `hsla(${secondaryHue}, 90%, 65%, ${(alpha * 0.45).toFixed(3)})`;
        g.beginPath();
        g.arc(screenX + offset, screenY, Math.max(0.4, particleSize * 0.8), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();

    // 5. Gravitational Singularity Core (Event Horizon & Photon Ring)
    const coreRadius = (42 * singularityMass * state.singularityPulse * (1 + bass * 0.4)) / 1;

    // Relativistic Jet Beams (Top & Bottom polar light cones)
    if (treble > 0.35 || audioData.isBeat) {
      g.save();
      g.globalCompositeOperation = "screen";
      const jetLength = (160 + treble * 280 + bass * 200) * coreGlow;
      const jetWidth = (8 + mid * 18) * coreGlow;

      const gradTop = g.createLinearGradient(cx, cy, cx, cy - jetLength);
      gradTop.addColorStop(0, `hsla(${accentHue}, 95%, 85%, 0.85)`);
      gradTop.addColorStop(0.3, `hsla(${baseHue}, 90%, 65%, 0.4)`);
      gradTop.addColorStop(1, "rgba(0,0,0,0)");

      g.fillStyle = gradTop;
      g.beginPath();
      g.moveTo(cx - jetWidth, cy);
      g.lineTo(cx, cy - jetLength);
      g.lineTo(cx + jetWidth, cy);
      g.closePath();
      g.fill();

      const gradBottom = g.createLinearGradient(cx, cy, cx, cy + jetLength);
      gradBottom.addColorStop(0, `hsla(${accentHue}, 95%, 85%, 0.85)`);
      gradBottom.addColorStop(0.3, `hsla(${baseHue}, 90%, 65%, 0.4)`);
      gradBottom.addColorStop(1, "rgba(0,0,0,0)");

      g.fillStyle = gradBottom;
      g.beginPath();
      g.moveTo(cx - jetWidth, cy);
      g.lineTo(cx, cy + jetLength);
      g.lineTo(cx + jetWidth, cy);
      g.closePath();
      g.fill();
      g.restore();
    }

    // Outer Photon Ring Glow
    g.save();
    g.globalCompositeOperation = "screen";
    const photonRingGrad = g.createRadialGradient(cx, cy, coreRadius * 0.6, cx, cy, coreRadius * 2.8 * coreGlow);
    photonRingGrad.addColorStop(0, `hsla(${accentHue}, 100%, 80%, 0.9)`);
    photonRingGrad.addColorStop(0.25, `hsla(${baseHue}, 95%, 65%, 0.65)`);
    photonRingGrad.addColorStop(0.65, `hsla(${secondaryHue}, 90%, 50%, 0.25)`);
    photonRingGrad.addColorStop(1, "rgba(0,0,0,0)");

    g.fillStyle = photonRingGrad;
    g.beginPath();
    g.arc(cx, cy, coreRadius * 2.8 * coreGlow, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Dark Matter Event Horizon (Absolute Void Black)
    g.save();
    g.fillStyle = "#010103";
    g.beginPath();
    g.arc(cx, cy, coreRadius * 0.92, 0, Math.PI * 2);
    g.fill();

    // Event Horizon Lensing Edge
    g.strokeStyle = `hsla(${accentHue}, 100%, 88%, ${0.75 + bass * 0.25})`;
    g.lineWidth = (2.2 + bass * 3.0) * coreGlow;
    g.shadowColor = `hsla(${accentHue}, 100%, 75%, 1)`;
    g.shadowBlur = (18 + bass * 25) * coreGlow;
    g.stroke();
    g.restore();
  },

  resize(_width: number, _height: number) {
    // Dynamic resize handled gracefully in render
  },

  destroy(ctx?: RenderContext) {
    if (ctx?.private?.state) {
      ctx.private.state = null;
    }
  },
};
