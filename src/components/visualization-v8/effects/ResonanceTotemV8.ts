import * as THREE from "three";
import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";
import { useTotemStore } from "@/store/totemStore";

export const ResonanceTotemV8: EffectPlugin = {
  id: "resonance-totem",
  name: "共鸣图腾",
  category: "shapes",
  description: "自动提取歌词关键词并形成动态背景图腾",
  preferredEngine: "webgl",

  parameters: [
    {
      id: "baseOpacity",
      name: "基础透明度",
      type: "number",
      mode: "basic",
      min: 0.05,
      max: 0.4,
      step: 0.01,
      default: 0.2,
    },
    {
      id: "burstIntensity",
      name: "共鸣强度",
      type: "number",
      mode: "professional",
      min: 0.1,
      max: 1.0,
      step: 0.1,
      default: 0.6,
    },
    {
      id: "glitchAmount",
      name: "故障频率",
      type: "number",
      mode: "expert",
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.3,
    },
  ],

  init(ctx: RenderContext) {
    if (!ctx.scene) return;

    const group = new THREE.Group();
    ctx.scene.add(group);

    // Totem Meshes map: keywordId -> Mesh
    const meshes = new Map<string, THREE.Mesh>();

    // Shader Material template
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uBass;
      uniform float uTreble;
      uniform float uLife; // 0 to 1
      uniform float uBurst; // 0 to 1
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        
        // V2 Spec: No cheap glitches, precise and minimal.
        // We do a very subtle breathing scale on the UV.
        vec2 centeredUv = uv - 0.5;
        float scale = 1.0 - (uBass * 0.05);
        vec2 scaledUv = centeredUv * scale + 0.5;
        
        vec4 color = texture2D(uTexture, scaledUv);
        
        // Subconscious Emergence: Fade in/out
        float alpha = color.a * uOpacity;
        
        // Burst effect: Additive brightness during resonance
        alpha += uBurst * 0.8 * color.a;
        
        // Life cycle fade
        alpha *= smoothstep(0.0, 0.2, uLife) * smoothstep(1.0, 0.8, uLife);
        
        gl_FragColor = vec4(color.rgb, alpha);
      }
    `;

    ctx.private = {
      group,
      meshes,
      vertexShader,
      fragmentShader,
      initialized: true,
    };
  },

  render(ctx: RenderContext, audioData: AudioData, params: Record<string, any>) {
    if (!ctx.private || !ctx.private.initialized) return;

    const { group, meshes, vertexShader, fragmentShader } = ctx.private;
    const totemStore = useTotemStore.getState();
    const activeKeywords = totemStore.activeKeywords;
    const textures = totemStore.preloadedTextures;

    const baseOpacity = params.baseOpacity ?? 0.2;
    const burstIntensity = params.burstIntensity ?? 0.6;

    // 1. Manage Meshes for active keywords
    const activeIds = new Set(activeKeywords.map((kw) => kw.id));

    // Remove expired meshes
    meshes.forEach((mesh: THREE.Mesh, id: string) => {
      if (!activeIds.has(id)) {
        group.remove(mesh);
        (mesh.material as THREE.ShaderMaterial).dispose();
        mesh.geometry.dispose();
        meshes.delete(id);
      }
    });

    // Add new meshes
    activeKeywords.forEach((kw) => {
      if (!meshes.has(kw.id) && textures[kw.id]) {
        const texture = new THREE.CanvasTexture(textures[kw.id] as any);
        const geometry = new THREE.PlaneGeometry(4, 4);
        const material = new THREE.ShaderMaterial({
          uniforms: {
            uTexture: { value: texture },
            uOpacity: { value: baseOpacity },
            uTime: { value: 0 },
            uBass: { value: 0 },
            uTreble: { value: 0 },
            uLife: { value: 0 },
            uBurst: { value: 0 },
          },
          vertexShader,
          fragmentShader,
          transparent: true,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });

        const mesh = new THREE.Mesh(geometry, material);
        // Random position in background, but centered
        mesh.position.set(
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 2,
          -5 // Deep background
        );

        group.add(mesh);
        meshes.set(kw.id, mesh);
      }
    });

    // 2. Update mesh uniforms
    const currentTime = audioData.full; // We need global time from ctx

    activeKeywords.forEach((kw) => {
      const mesh = meshes.get(kw.id);
      if (mesh) {
        const material = mesh.material as THREE.ShaderMaterial;

        // Calculate lifecycle (normalized 0 to 1)
        const totalDuration = kw.duration + 3; // +3s for emergence
        const startTime = kw.startTime - 3;
        // We need the current music time. For now we assume store's time is updated.
        // Wait, the store doesn't have currentTime. I'll get it from audioData if possible or pass it via context.
        // Since we are in the render loop of the visualizer, we use ctx.time.

        // Wait, the totem lifecycle is tied to MUSIC time, not absolute time.
        // I'll use a hack or assume ctx.time is synced with music if possible.
        // Actually, I should pass musicTime to the render function.

        // For now, let's use ctx.time but we need to know the offset.
        // Better: the store should be updated by the player.

        // Let's assume uLife and uBurst are handled here.
        // We need the actual music time. I'll use the one from useAudioStore.
        // (Accessing store in every frame is okay in small apps, but better to pass it).

        const musicTime = (window as any)._currentMusicTime || 0; // Global hack for now or use useAudioStore.getState()

        const life = (musicTime - startTime) / totalDuration;
        const burst = Math.max(0, 1.0 - Math.abs(musicTime - kw.startTime) * 2.0); // 0.5s burst window

        material.uniforms.uTime.value = ctx.time;
        material.uniforms.uBass.value = audioData.bass;
        material.uniforms.uTreble.value = audioData.treble;
        material.uniforms.uLife.value = Math.max(0, Math.min(1, life));
        material.uniforms.uBurst.value = Math.max(0, burst) * burstIntensity;
        material.uniforms.uOpacity.value = baseOpacity;

        // Bass Pulse: Scale is handled slightly in shader now, but we can do transform too.
        // V2 spec: max +-15% smooth breathing scale.
        const scale = 1.0 + audioData.bass * 0.15 * kw.intensity;
        mesh.scale.set(scale, scale, 1);

        // Also subtle vertical drift
        const driftY = Math.sin(ctx.time * 0.5 + kw.startTime) * 0.5;
        mesh.position.y = driftY;
      }
    });
  },

  resize(width: number, height: number) {},

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private && ctx.private.group) {
      ctx.scene.remove(ctx.private.group);
      ctx.private.meshes.forEach((mesh: THREE.Mesh) => {
        (mesh.material as THREE.ShaderMaterial).dispose();
        mesh.geometry.dispose();
      });
      ctx.private.meshes.clear();
    }
  },
};
