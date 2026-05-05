"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useTotemStore } from "@/store/totemStore";
import { useAudioStore } from "@/store/audioStore";
import { useAudioPlayer, getAudioAnalyser } from "@/hooks/useAudioPlayer";

interface AudioDataSummary {
  bass: number;
  treble: number;
}


export function ResonanceTotemLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const groupRef = useRef<THREE.Group | null>(null);
  const currentTimeRef = useRef<number>(0);

  const currentTime = useAudioStore(state => state.currentTime);

  const { activeKeywords, preloadedTextures } = useTotemStore();

  // Sync current time ref
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Initialization

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const group = new THREE.Group();
    scene.add(group);

    camera.position.z = 10;

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    groupRef.current = group;

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []);

  // Audio Analysis
  const getAudioData = () => {
    const analyser = getAudioAnalyser();
    if (!analyser) return { bass: 0, treble: 0 };

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    let bass = 0;
    let treble = 0;

    const bassLimit = Math.floor(dataArray.length * 0.1);
    const trebleStart = Math.floor(dataArray.length * 0.6);

    for (let i = 0; i < bassLimit; i++) bass += dataArray[i];
    bass = (bass / bassLimit) / 255;

    for (let i = trebleStart; i < dataArray.length; i++) treble += dataArray[i];
    treble = (treble / (dataArray.length - trebleStart)) / 255;

    return { bass, treble };
  };

  // Animation Loop

  useEffect(() => {
    let animationFrame: number;
    
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
      uniform float uLife;
      uniform float uBurst;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        
        // Chromatic Aberration
        float glitch = uTreble * 0.03;
        vec4 r = texture2D(uTexture, uv + vec2(glitch, 0.0));
        vec4 g = texture2D(uTexture, uv);
        vec4 b = texture2D(uTexture, uv - vec2(glitch, 0.0));
        
        vec4 color = vec4(r.r, g.g, b.b, g.a);
        
        float alpha = color.a * uOpacity;
        alpha += uBurst * 0.4 * color.a;
        alpha *= smoothstep(0.0, 0.2, uLife) * smoothstep(1.0, 0.8, uLife);
        
        gl_FragColor = vec4(color.rgb, alpha);
      }
    `;

    const render = (time: number) => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !groupRef.current) return;

      const group = groupRef.current;
      const meshes = meshesRef.current;

      // Update meshes
      const activeIds = new Set(activeKeywords.map(kw => kw.id));

      meshes.forEach((mesh, id) => {
        if (!activeIds.has(id)) {
          group.remove(mesh);
          (mesh.material as THREE.ShaderMaterial).dispose();
          mesh.geometry.dispose();
          meshes.delete(id);
        }
      });

      activeKeywords.forEach(kw => {
        if (!meshes.has(kw.id) && preloadedTextures[kw.id]) {
          const texture = new THREE.CanvasTexture(preloadedTextures[kw.id] as any);
          const geometry = new THREE.PlaneGeometry(6, 6);
          const material = new THREE.ShaderMaterial({
            uniforms: {
              uTexture: { value: texture },
              uOpacity: { value: 0.2 },
              uTime: { value: 0 },
              uBass: { value: 0 },
              uTreble: { value: 0 },
              uLife: { value: 0 },
              uBurst: { value: 0 }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthTest: false,
            blending: THREE.AdditiveBlending
          });

          const mesh = new THREE.Mesh(geometry, material);
          // Random but stable position
          const seed = kw.startTime;
          mesh.position.set(
            (Math.sin(seed) * 5),
            (Math.cos(seed) * 3),
            -2
          );
          
          group.add(mesh);
          meshes.set(kw.id, mesh);
        }
      });

      // Update Uniforms
      const audio = getAudioData();
      
      activeKeywords.forEach(kw => {
        const mesh = meshes.get(kw.id);
        if (mesh) {
          const material = mesh.material as THREE.ShaderMaterial;
          const totalDuration = kw.duration + 3;
          const startTime = kw.startTime - 3;
          const musicTime = currentTimeRef.current;
          const life = (musicTime - startTime) / totalDuration;
          const burst = Math.max(0, 1.0 - Math.abs(musicTime - kw.startTime) * 1.5);


          material.uniforms.uTime.value = time * 0.001;
          material.uniforms.uLife.value = Math.max(0, Math.min(1, life));
          material.uniforms.uBurst.value = Math.max(0, burst);
          material.uniforms.uBass.value = audio.bass;
          material.uniforms.uTreble.value = audio.treble;
          
          // Floating animation + Bass pulse
          const scale = 1.0 + audio.bass * 0.1 * kw.intensity + burst * 0.2;
          mesh.scale.set(scale, scale, 1);
          mesh.position.y += Math.sin(time * 0.001 + kw.startTime) * 0.005;
        }
      });


      rendererRef.current.render(sceneRef.current, cameraRef.current);
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [activeKeywords, preloadedTextures]); // Remove currentTime from deps


  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
