/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

// ==========================================
// 🌌 5 大宏观神经中枢星团 (Primary Synaptic Clusters)
// ==========================================
interface MasterCluster {
  id: number;
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  hueOffset: number;
  freqBand: number; // 绑定频段
}

const MASTER_CLUSTERS: MasterCluster[] = [
  { id: 0, name: "Nexus Prime Singularity", x: 0, y: 0, z: 0, radius: 16, hueOffset: 0, freqBand: 1 }, // 中心低音主脑
  { id: 1, name: "Alpha Synapse Spiral", x: -480, y: -260, z: 220, radius: 11, hueOffset: 30, freqBand: 8 }, // 左上中低频中枢
  { id: 2, name: "Cygnus Axon Arm", x: 520, y: -220, z: -200, radius: 10, hueOffset: 160, freqBand: 18 }, // 右上中频中枢
  { id: 3, name: "Vela Deep Lattice", x: -420, y: 320, z: -160, radius: 10, hueOffset: 240, freqBand: 32 }, // 左下中高频中枢
  { id: 4, name: "Orion Pulsar Stream", x: 460, y: 280, z: 240, radius: 12, hueOffset: 60, freqBand: 48 }, // 右下高频中枢
];

export const drawCyberpunkParticles = ({
  ctx,
  width,
  height,
  data,
  params,
  time,
  refs,
  theme,
}: EffectContext) => {
  const effectParams = params || {
    speed: 1.0,
    particleCount: 240,
    particleSize: 1.2,
    glowIntensity: 1.0,
    gravityLens: 1.0,
    pulseSpeed: 1.0,
    accretionSpin: 1.0,
    bokehAmount: 0.6,
  };

  // --- 1. 高精度音频三频能量与平滑流分析 ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawMid = data && data[14] ? (data[14] + data[18] + data[22]) / 3 / 255 : 0;
  const rawTreble = data && data[45] ? (data[45] + data[55] + data[65]) / 3 / 255 : 0;

  refs.smoothBass.current = Math.max(
    0,
    Math.min(1, refs.smoothBass.current * 0.88 + (isFinite(rawBass) ? rawBass : 0) * 0.12)
  );
  const smoothMidVal =
    (refs.smoothMid ? refs.smoothMid.current : 0) * 0.90 + (isFinite(rawMid) ? rawMid : 0) * 0.10;
  if (!refs.smoothMid) (refs as any).smoothMid = { current: smoothMidVal };
  else refs.smoothMid.current = Math.max(0, Math.min(1, smoothMidVal));
  refs.smoothTreble.current = Math.max(
    0,
    Math.min(1, refs.smoothTreble.current * 0.93 + (isFinite(rawTreble) ? rawTreble : 0) * 0.07)
  );

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;

  const t = time * 0.001;
  const cx = width / 2;
  const cy = height / 2;

  // 电影级调色板 (星际穿越白金曜石 + 专辑色智能融合)
  const platinumWhiteHue = 48; // 炽热白金
  const amberGoldHue = 38; // 温暖琥珀金
  const albumHue = theme.primary || 260; // 专辑主题色
  const _ionCyanHue = (albumHue + 150) % 360; // 极光电离青

  // 环境自律呼吸与主速度 (恢复全速原貌)
  const _ambientBreathe = Math.sin(t * 0.35) * 0.5 + 0.5;
  const dynamicEnergy = Math.max(0.08, bass * 0.6 + mid * 0.25 + treble * 0.15);
  const masterSpeed = (0.35 + dynamicEnergy * 1.3) * (effectParams.speed || 1.0);

  // --- 2. 240 颗细腻 3D 发光神经元全量初始化 ---
  const NODE_COUNT = 240;
  const isConstellationSchema =
    Array.isArray(refs.particles.current) &&
    refs.particles.current.length === NODE_COUNT &&
    typeof refs.particles.current[0]?.clusterId === "number";

  if (!isConstellationSchema) {
    const nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const clusterId = i < MASTER_CLUSTERS.length ? i : (i % MASTER_CLUSTERS.length);
      const isHubLeader = i < MASTER_CLUSTERS.length;
      const hub = MASTER_CLUSTERS[clusterId];

      let bx: number;
      let by: number;
      let bz: number;
      let nodeRadius: number;

      if (isHubLeader) {
        bx = hub.x;
        by = hub.y;
        bz = hub.z;
        nodeRadius = hub.radius;
      } else {
        // 围绕各自星团中枢做三维空间分布（铺满 16:9 全屏）
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI;
        const dist = 45 + Math.pow(Math.random(), 1.2) * (clusterId === 0 ? 520 : 340);

        bx = hub.x + Math.cos(theta) * Math.cos(phi) * dist;
        by = hub.y + Math.sin(theta) * Math.cos(phi) * dist * 0.75;
        bz = hub.z + Math.sin(phi) * dist;
        nodeRadius = 1.8 + Math.random() * 3.2; // 更加精致小巧
      }

      nodes.push({
        id: i,
        clusterId,
        isHubLeader,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        x: bx,
        y: by,
        z: bz,
        radius: nodeRadius,
        orbitSpeed: (0.15 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1),
        orbitRadius: Math.hypot(bx, by),
        orbitAngle: Math.atan2(by, bx),
        val: 0,
        freqIdx: isHubLeader ? hub.freqBand : Math.floor(Math.random() * 64),
        seed: i * 17.31,
      });
    }
    refs.particles.current = nodes;
  }

  // --- 3. 重低音引力冲击波池 (Shockwave Manager - 由星系演化速度平缓控制) ---
  if (!refs.shockwaves || !refs.shockwaves.current) {
    (refs as any).shockwaves = { current: [] };
  }
  const shockwaves: { x: number; y: number; radius: number; maxRadius: number; alpha: number; speed: number; hue: number }[] =
    (refs as any).shockwaves.current;

  // 强节拍触发引力波 (重低音爆发且间隔充足，受星系演化速度精确调控)
  const evoSpeed = effectParams.speed || 1.0;
  if (bass > 0.68 && (!shockwaves.length || shockwaves[shockwaves.length - 1].radius > 240)) {
    shockwaves.push({
      x: cx,
      y: cy,
      radius: 25,
      maxRadius: Math.max(width, height) * 0.95,
      alpha: 0.55,
      speed: (2.2 + bass * 3.0) * evoSpeed,
      hue: amberGoldHue,
    });
  }

  // --- 4. 电影级 3D 摄影机轨道自转与平滑投影 ---
  const camAngleY = t * 0.04;
  const camAngleX = Math.sin(t * 0.03) * 0.16 + bass * 0.04;
  const cosY = Math.cos(camAngleY);
  const sinY = Math.sin(camAngleY);
  const cosX = Math.cos(camAngleX);
  const sinX = Math.sin(camAngleX);
  const fov = 1150;

  const project3D = (x: number, y: number, z: number) => {
    // 绕 Y 轴轨道自转
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    // 绕 X 轴微幅俯仰
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX + 1550;

    const safeZ = Math.max(60, z2);
    const scale = fov / safeZ;
    return {
      x2d: x1 * scale + cx,
      y2d: y1 * scale + cy,
      scale,
      depthAlpha: Math.max(0, Math.min(1, (2400 - safeZ) / 1800)),
      zDepth: safeZ,
    };
  };

  // ==========================================
  // 🌟 第 1 层：深邃无垠曜石宇宙底色与星云气辉
  // ==========================================
  ctx.save();
  const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, width * 1.1);
  bgGrad.addColorStop(0, "#080414");
  bgGrad.addColorStop(0.45, "#04020a");
  bgGrad.addColorStop(0.85, "#020106");
  bgGrad.addColorStop(1, "#000000");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 柔和体积星云呼吸
  ctx.globalCompositeOperation = "screen";
  for (let c = 0; c < MASTER_CLUSTERS.length; c++) {
    const hub = MASTER_CLUSTERS[c];
    const hubProj = project3D(hub.x, hub.y, hub.z);
    if (hubProj.depthAlpha < 0.05) continue;

    const nebRad = (180 + bass * 120) * hubProj.scale;
    const nGrad = ctx.createRadialGradient(hubProj.x2d, hubProj.y2d, 10, hubProj.x2d, hubProj.y2d, nebRad);
    const nHue = c === 0 ? amberGoldHue : (albumHue + hub.hueOffset) % 360;
    const nAlpha = (c === 0 ? 0.12 + bass * 0.12 : 0.05 + mid * 0.06) * hubProj.depthAlpha;

    nGrad.addColorStop(0, `hsla(${nHue}, 90%, 55%, ${nAlpha})`);
    nGrad.addColorStop(0.5, `hsla(${nHue + 20}, 80%, 35%, ${nAlpha * 0.4})`);
    nGrad.addColorStop(1, "transparent");

    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.arc(hubProj.x2d, hubProj.y2d, nebRad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ==========================================
  // 🌟 第 2 层：引力冲击波扩散渲染 (Gravitational Shockwaves - 平缓优雅由星系演化速度控制)
  // ==========================================
  if (shockwaves.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let s = shockwaves.length - 1; s >= 0; s--) {
      const sw = shockwaves[s];
      sw.radius += sw.speed * (0.6 + dynamicEnergy * 0.4);
      sw.alpha *= 0.985;

      if (sw.radius > sw.maxRadius || sw.alpha < 0.01) {
        shockwaves.splice(s, 1);
        continue;
      }

      ctx.strokeStyle = `hsla(${sw.hue}, 100%, 85%, ${sw.alpha})`;
      ctx.lineWidth = Math.max(0.8, 2.5 * (1 - sw.radius / sw.maxRadius));
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      // 内层微光晕
      ctx.strokeStyle = `hsla(${platinumWhiteHue}, 100%, 95%, ${sw.alpha * 0.4})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius * 0.985, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ==========================================
  // 🌟 第 3 层：3D 神经元位置更新与投影映射
  // ==========================================
  const nodes = refs.particles.current;
  const projectedNodes: any[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];

    // 频段能量注入
    const rawVal = data && data[n.freqIdx] ? data[n.freqIdx] / 255 : 0;
    n.val = (n.val || 0) * 0.86 + rawVal * 0.14;

    // 柔和天体公转与自律呼吸位移 (恢复原本动力学)
    n.orbitAngle += (0.003 + treble * 0.008) * n.orbitSpeed * masterSpeed;
    const wobble = Math.sin(t * 1.2 + n.seed) * (10 + (n.isHubLeader ? bass * 25 : mid * 15));

    if (n.isHubLeader) {
      n.x = n.baseX + Math.sin(t * 0.8 + n.seed) * 15;
      n.y = n.baseY + Math.cos(t * 0.8 + n.seed) * 10;
      n.z = n.baseZ + wobble;
    } else {
      const parentHub = MASTER_CLUSTERS[n.clusterId];
      const dx = n.baseX - parentHub.x;
      const dy = n.baseY - parentHub.y;
      const r = Math.hypot(dx, dy) * (1 + bass * 0.12);
      n.x = parentHub.x + Math.cos(n.orbitAngle) * r;
      n.y = parentHub.y + Math.sin(n.orbitAngle) * r * 0.85;
      n.z = n.baseZ + wobble;
    }

    const proj = project3D(n.x, n.y, n.z);
    projectedNodes.push({
      ...n,
      ...proj,
    });
  }

  // ==========================================
  // 🌟 第 4 层：粗壮骨干能量管道与动态突触纤维 (Axon High-Tension Pipelines & Synapses)
  // ==========================================
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 4.1 绘制 5 大星团中枢之间的粗壮主干能量管道
  for (let c1 = 0; c1 < MASTER_CLUSTERS.length; c1++) {
    const hub1 = projectedNodes[c1];
    if (!hub1) continue;

    for (let c2 = c1 + 1; c2 < MASTER_CLUSTERS.length; c2++) {
      const hub2 = projectedNodes[c2];
      if (!hub2) continue;

      const avgAlpha = (hub1.depthAlpha + hub2.depthAlpha) * 0.5;
      if (avgAlpha < 0.05) continue;

      const pipeGrad = ctx.createLinearGradient(hub1.x2d, hub1.y2d, hub2.x2d, hub2.y2d);
      const pipeAlpha = (0.15 + mid * 0.35 + bass * 0.25) * avgAlpha;

      pipeGrad.addColorStop(0, `hsla(${amberGoldHue}, 100%, 80%, ${pipeAlpha * 0.6})`);
      pipeGrad.addColorStop(0.5, `hsla(${platinumWhiteHue}, 100%, 96%, ${pipeAlpha})`);
      pipeGrad.addColorStop(1, `hsla(${albumHue}, 100%, 80%, ${pipeAlpha * 0.6})`);

      ctx.strokeStyle = pipeGrad;
      ctx.lineWidth = Math.max(1.0, (2.2 + bass * 2.5) * ((hub1.scale + hub2.scale) * 0.5));
      ctx.beginPath();
      ctx.moveTo(hub1.x2d, hub1.y2d);
      ctx.lineTo(hub2.x2d, hub2.y2d);
      ctx.stroke();

      // 双向流光动作电位光子 (只针对中间管道粒子进行专属超慢优雅滑行)
      const pulseCount = 2;
      const pipePulseSpeed = 0.045; // 极慢流光，单次传输约 20 秒
      for (let p = 0; p < pulseCount; p++) {
        const pulseT = ((t * (effectParams.pulseSpeed || 1.0) * pipePulseSpeed + (p / pulseCount) + c1 * 0.2) % 1);
        const px = hub1.x2d + (hub2.x2d - hub1.x2d) * pulseT;
        const py = hub1.y2d + (hub2.y2d - hub1.y2d) * pulseT;

        const pulseGlow = ctx.createRadialGradient(px, py, 0, px, py, 14 * hub1.scale);
        pulseGlow.addColorStop(0, `hsla(${platinumWhiteHue}, 100%, 98%, ${Math.min(1, pipeAlpha * 2.5)})`);
        pulseGlow.addColorStop(0.4, `hsla(${amberGoldHue}, 100%, 75%, ${Math.min(0.6, pipeAlpha * 1.5)})`);
        pulseGlow.addColorStop(1, "transparent");

        ctx.fillStyle = pulseGlow;
        ctx.beginPath();
        ctx.arc(px, py, 14 * hub1.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 4.2 动态距离感应突触纤维 (Proximity-based Synaptic Axons - 针对 240 节点优化)
  const MAX_CONNECT_DIST = 210; // 3D 距离阈值
  const maxEdgesPerNode = 3;

  for (let i = 0; i < projectedNodes.length; i++) {
    const n1 = projectedNodes[i];
    if (n1.depthAlpha < 0.05) continue;
    let edgeCount = 0;

    for (let j = i + 1; j < projectedNodes.length; j++) {
      if (edgeCount >= maxEdgesPerNode) break;
      const n2 = projectedNodes[j];
      if (n2.depthAlpha < 0.05) continue;

      const dx = n1.x - n2.x;
      const dy = n1.y - n2.y;
      const dz = n1.z - n2.z;
      const dist3D = Math.hypot(dx, dy, dz);

      if (dist3D < MAX_CONNECT_DIST) {
        edgeCount++;
        const distFactor = 1 - dist3D / MAX_CONNECT_DIST;
        const avgAlpha = (n1.depthAlpha + n2.depthAlpha) * 0.5;
        const axonAlpha = distFactor * distFactor * (0.10 + mid * 0.25 + (n1.val + n2.val) * 0.25) * avgAlpha;

        const axonHue = (i + j) % 2 === 0 ? amberGoldHue : albumHue;
        ctx.strokeStyle = `hsla(${axonHue}, 90%, 75%, ${axonAlpha})`;
        ctx.lineWidth = Math.max(0.4, (0.6 + bass * 0.6) * ((n1.scale + n2.scale) * 0.5) * distFactor);
        ctx.beginPath();
        ctx.moveTo(n1.x2d, n1.y2d);
        ctx.lineTo(n2.x2d, n2.y2d);
        ctx.stroke();

        // 突触微观光子专属慢速滑行
        if (distFactor > 0.55 && (n1.val > 0.4 || n2.val > 0.4)) {
          const pt = ((t * 0.05 + i * 0.17) % 1);
          const px = n1.x2d + (n2.x2d - n1.x2d) * pt;
          const py = n1.y2d + (n2.y2d - n1.y2d) * pt;

          ctx.fillStyle = `hsla(${platinumWhiteHue}, 100%, 95%, ${axonAlpha * 2})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.5 * n1.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();

  // ==========================================
  // 🌟 第 5 层：240 颗小巧精致高能发光神经元中枢渲染 (Luminous Synaptic Nodes)
  // ==========================================
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < projectedNodes.length; i++) {
    const n = projectedNodes[i];
    if (n.depthAlpha < 0.03) continue;

    const isHub = n.isHubLeader;
    const sizeMultiplier = effectParams.particleSize ? effectParams.particleSize / 1.0 : 1.0;
    const dynamicRad = (n.radius * (isHub ? 1 + bass * 0.35 : 1 + n.val * 0.45)) * n.scale * sizeMultiplier;
    const nodeHue = isHub ? (n.id === 0 ? platinumWhiteHue : amberGoldHue) : ((albumHue + n.clusterId * 40) % 360);
    const nodeAlpha = Math.min(1, n.depthAlpha * (isHub ? 0.95 : 0.45 + n.val * 0.55));

    // 1. 双层柔和发光能量光晕 (Bloom Halo - 精致收敛)
    const haloRadius = dynamicRad * (isHub ? 2.6 : 1.8);
    const bloomGrad = ctx.createRadialGradient(n.x2d, n.y2d, 0, n.x2d, n.y2d, haloRadius);
    bloomGrad.addColorStop(0, `hsla(${nodeHue}, 100%, 92%, ${nodeAlpha * (isHub ? 0.85 : 0.55)})`);
    bloomGrad.addColorStop(0.4, `hsla(${nodeHue}, 95%, 70%, ${nodeAlpha * (isHub ? 0.4 : 0.2)})`);
    bloomGrad.addColorStop(1, "transparent");

    ctx.fillStyle = bloomGrad;
    ctx.beginPath();
    ctx.arc(n.x2d, n.y2d, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. 核心白炽高能亮点 (Incandescent Core - 细致明亮)
    ctx.fillStyle = `hsla(${platinumWhiteHue}, 100%, 98%, ${nodeAlpha})`;
    ctx.beginPath();
    ctx.arc(n.x2d, n.y2d, Math.max(0.8, dynamicRad * 0.42), 0, Math.PI * 2);
    ctx.fill();

    // 3. 主中枢全息旋转光环 (Hub Outer Energy Ring)
    if (isHub) {
      ctx.strokeStyle = `hsla(${amberGoldHue}, 100%, 85%, ${nodeAlpha * 0.65})`;
      ctx.lineWidth = 0.9 * n.scale;
      ctx.beginPath();
      ctx.arc(n.x2d, n.y2d, dynamicRad * 1.45, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  // ==========================================
  // 🌟 第 6 层：宽银幕变形镜头横向微光斑 (Cinematic Anamorphic Flare)
  // ==========================================
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const streakAlpha = (0.06 + bass * 0.18 + mid * 0.08) * (effectParams.glowIntensity || 1.0);
  const streakGrad = ctx.createLinearGradient(cx - width * 0.45, cy, cx + width * 0.45, cy);
  streakGrad.addColorStop(0, "transparent");
  streakGrad.addColorStop(0.35, `hsla(${albumHue}, 100%, 75%, ${streakAlpha * 0.3})`);
  streakGrad.addColorStop(0.5, `hsla(${platinumWhiteHue}, 100%, 98%, ${streakAlpha})`);
  streakGrad.addColorStop(0.65, `hsla(${amberGoldHue}, 100%, 75%, ${streakAlpha * 0.4})`);
  streakGrad.addColorStop(1, "transparent");

  ctx.fillStyle = streakGrad;
  ctx.fillRect(cx - width * 0.45, cy - 1.2, width * 0.9, 2.4);
  ctx.restore();

  // ==========================================
  // 🌟 第 7 层：极简科幻 HUD 遥测仪表 (Minimal HUD)
  // ==========================================
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "9px 'SF Pro Mono', 'JetBrains Mono', monospace";

  const padX = 32;
  const padY = 44;
  ctx.fillText("3D CYBERNETIC NEURAL CONSTELLATION // V9.0", padX, padY);
  ctx.fillText(`SYNAPSE NODES: 100 CLUSTERS  |  COHERENCE: ${(98.4 + Math.sin(t) * 1.2).toFixed(1)}%`, padX, padY + 13);
  ctx.fillText(`SYNAPTIC FLUX: ${(78.5 + bass * 21.5).toFixed(1)}%  |  DEPTH: 1550 LY`, padX, padY + 26);

  ctx.restore();
};
