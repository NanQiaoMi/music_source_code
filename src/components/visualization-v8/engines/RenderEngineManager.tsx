"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  RenderEngine,
  RenderContext,
  EffectPlugin,
  AudioData,
  TransformParams,
  EffectParameterMap,
  EffectRuntimeState,
} from "@/lib/visualization/types";
import type { VisualizationAudioSnapshot } from "@/lib/visualization/audioSnapshot";
import { ThreeJSScene } from "@/lib/three/ThreeJSScene";
import { usePerformanceV8Store } from "@/store/performanceV8Store";
import { useAudioStore } from "@/store/audioStore";
import { useAudioSourceStore } from "@/store/audioSourceStore";

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
  };
}

interface RenderEngineManagerProps {
  engine: RenderEngine;
  effect: EffectPlugin | null;
  onRender: (ctx: RenderContext, audioData: AudioData, params: EffectParameterMap) => void;
  params?: EffectParameterMap;
  audioSnapshot?: VisualizationAudioSnapshot;
  width: number;
  height: number;
}

export function RenderEngineManager({
  engine,
  effect,
  onRender,
  params = {},
  audioSnapshot,
  width,
  height,
}: RenderEngineManagerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeSceneRef = useRef<ThreeJSScene | null>(null);
  const ctx2DRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const effectRef = useRef<EffectPlugin | null>(null);
  const dprRef = useRef(1);
  const privateContextRef = useRef<EffectRuntimeState>({});
  const audioSnapshotRef = useRef(audioSnapshot);

  const frequencyDataRef = useRef(new Uint8Array(256));
  const waveformDataRef = useRef(new Uint8Array(256));

  const [isWebGLAvailable] = useState(() => {
    try {
      const testCanvas = document.createElement("canvas");
      return !!(testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  });

  const { config, updateStats } = usePerformanceV8Store();
  const frameCountRef = useRef(0);
  const lastFPSUpdateRef = useRef(0);

  useEffect(() => {
    audioSnapshotRef.current = audioSnapshot;
  }, [audioSnapshot]);

  const getDisplaySize = useCallback(() => {
    const fallbackWidth = typeof window !== "undefined" ? window.innerWidth : 0;
    const fallbackHeight = typeof window !== "undefined" ? window.innerHeight : 0;

    return {
      displayWidth: width || canvasRef.current?.clientWidth || fallbackWidth,
      displayHeight: height || canvasRef.current?.clientHeight || fallbackHeight,
    };
  }, [height, width]);

  const getQualityDpr = useCallback(() => {
    const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const maxDprByQuality = {
      low: 1,
      medium: 1.5,
      high: 1.75,
      ultra: 2,
    }[config.webglQuality];

    return Math.max(1, Math.min(rawDpr, maxDprByQuality));
  }, [config.webglQuality]);

  const selectActualEngine = useCallback(
    (preferred: RenderEngine): RenderEngine => {
      if (preferred === "webgl" && !isWebGLAvailable) {
        return "canvas";
      }
      if (preferred === "auto") {
        return isWebGLAvailable ? "webgl" : "canvas";
      }
      return preferred;
    },
    [isWebGLAvailable]
  );

  const actualEngine = selectActualEngine(engine);

  const setupCanvas = useCallback(() => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const { displayWidth, displayHeight } = getDisplaySize();
    const dpr = getQualityDpr();

    dprRef.current = dpr;
    canvas.width = Math.max(1, Math.floor(displayWidth * dpr));
    canvas.height = Math.max(1, Math.floor(displayHeight * dpr));

    if (ctx2DRef.current) {
      ctx2DRef.current.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return { displayWidth, displayHeight };
  }, [getDisplaySize, getQualityDpr]);

  const applyTransform = useCallback(
    (
      context: CanvasRenderingContext2D,
      displayWidth: number,
      displayHeight: number,
      transformParams: TransformParams,
      dpr: number
    ) => {
      const { positionX, positionY, scale, rotation } = transformParams;
      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, displayWidth, displayHeight);

      context.save();
      context.translate(centerX + positionX * displayWidth, centerY + positionY * displayHeight);
      context.rotate((rotation * Math.PI) / 180);
      context.scale(scale, scale);
      context.translate(-centerX, -centerY);
    },
    []
  );

  const restoreTransform = useCallback((context: CanvasRenderingContext2D, dpr: number) => {
    context.restore();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const createRenderContext = useCallback(
    (
      displayWidth: number,
      displayHeight: number,
      deltaTime: number,
      time: number
    ): RenderContext => {
      const ctx: RenderContext = {
        canvas: canvasRef.current!,
        width: displayWidth,
        height: displayHeight,
        deltaTime,
        time,
        audioSnapshot: audioSnapshotRef.current,
        private: privateContextRef.current,
      };

      if (actualEngine === "webgl" && threeSceneRef.current) {
        ctx.scene = threeSceneRef.current.scene;
        ctx.camera = threeSceneRef.current.camera;
        ctx.renderer = threeSceneRef.current.renderer;
      } else if (ctx2DRef.current) {
        ctx.ctx = ctx2DRef.current;
      }

      return ctx;
    },
    [actualEngine]
  );

  const createAudioData = useCallback((): AudioData => {
    const audioState = useAudioStore.getState();
    const sourceSettings = useAudioSourceStore.getState();
    const currentBeatMap = sourceSettings.currentBeatMap;
    const currentTime = audioState.currentTime || 0;

    let isDownbeat = false;
    let beatImpact = 0;
    let lowEnergy = 0;
    let snapEnergy = 0;
    let beatPhase = 0;
    const bpm = currentBeatMap?.bpm || 120;

    if (currentBeatMap && sourceSettings.enableBeatAnalysis) {
      const gridStep = currentBeatMap.gridStep || 0.5;
      beatPhase = (currentTime % gridStep) / gridStep;

      // 强拍检测 (±0.06s 窗口)
      if (currentBeatMap.downbeats) {
        for (let i = 0; i < currentBeatMap.downbeats.length; i++) {
          const dbTime = currentBeatMap.downbeats[i];
          if (Math.abs(currentTime - dbTime) <= 0.06) {
            isDownbeat = true;
            break;
          }
          if (dbTime > currentTime + 0.1) break;
        }
      }

      // 瞬态打击能量匹配
      if (currentBeatMap.beats && currentBeatMap.beats.length > 0) {
        for (let i = 0; i < currentBeatMap.beats.length; i++) {
          const b = currentBeatMap.beats[i];
          if (Math.abs(currentTime - b.time) <= 0.08) {
            beatImpact = b.impact * (sourceSettings.beatSensitivity || 1.0);
            lowEnergy = b.low;
            snapEnergy = b.snap;
            break;
          }
          if (b.time > currentTime + 0.1) break;
        }
      }
    }

    return {
      frequencyData: frequencyDataRef.current,
      waveformData: waveformDataRef.current,
      bass: lowEnergy > 0 ? lowEnergy : 0,
      mid: 0,
      treble: snapEnergy > 0 ? snapEnergy : 0,
      full: 0,
      isBeat: isDownbeat || beatImpact > 0.5,
      bpm,
      isDownbeat,
      beatImpact,
      lowEnergy,
      snapEnergy,
      beatPhase,
    };
  }, []);

  const getTransformParams = useCallback(
    (): TransformParams => ({
      positionX: params.positionX ?? 0,
      positionY: params.positionY ?? 0,
      scale: params.scale ?? 1,
      rotation: params.rotation ?? 0,
    }),
    [params]
  );

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    if (actualEngine === "webgl" && isWebGLAvailable) {
      if (!threeSceneRef.current) {
        threeSceneRef.current = new ThreeJSScene(canvas);
      }
      const dimensions = setupCanvas();
      if (dimensions) {
        threeSceneRef.current.resize(dimensions.displayWidth, dimensions.displayHeight);
      }
    } else {
      if (!ctx2DRef.current) {
        ctx2DRef.current = canvas.getContext("2d", {
          alpha: true,
          desynchronized: true,
        });
      }
      setupCanvas();
    }

    const handleResize = () => {
      const dimensions = setupCanvas();

      if (dimensions && actualEngine === "webgl" && threeSceneRef.current) {
        threeSceneRef.current.resize(dimensions.displayWidth, dimensions.displayHeight);
      }

      if (effect && dimensions) {
        effect.resize(dimensions.displayWidth, dimensions.displayHeight);
      }
    };

    window.addEventListener("resize", handleResize);

    if (effect && effect !== effectRef.current) {
      if (effectRef.current) {
        const dimensions = getDisplaySize();
        const cleanupCtx: RenderContext = {
          canvas,
          width: dimensions.displayWidth,
          height: dimensions.displayHeight,
          deltaTime: 0,
          time: 0,
          ctx: ctx2DRef.current || undefined,
          scene: threeSceneRef.current?.scene,
          camera: threeSceneRef.current?.camera,
          renderer: threeSceneRef.current?.renderer,
          private: privateContextRef.current,
        };
        effectRef.current.destroy(cleanupCtx);
      }
      // Reset private context for the new effect
      privateContextRef.current = {};

      const dimensions = setupCanvas();
      if (dimensions) {
        const initCtx: RenderContext = {
          canvas,
          width: dimensions.displayWidth,
          height: dimensions.displayHeight,
          deltaTime: 0,
          time: 0,
          ctx: ctx2DRef.current || undefined,
          scene: threeSceneRef.current?.scene,
          camera: threeSceneRef.current?.camera,
          renderer: threeSceneRef.current?.renderer,
          private: privateContextRef.current,
        };
        effect.init(initCtx);
        effectRef.current = effect;
      }
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [actualEngine, isWebGLAvailable, effect, setupCanvas, getDisplaySize]);

  useEffect(() => {
    const render = (timestamp: number) => {
      if (!canvasRef.current) return;
      startTimeRef.current ??= timestamp;
      if (lastFPSUpdateRef.current === 0) {
        lastFPSUpdateRef.current = timestamp;
      }

      if (actualEngine !== "webgl" && !ctx2DRef.current) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const elapsed = lastTimeRef.current ? timestamp - lastTimeRef.current : Infinity;
      const frameInterval = 1000 / Math.max(1, config.targetFPS);

      if (elapsed < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const deltaTime = Number.isFinite(elapsed) ? elapsed / 1000 : 0;
      lastTimeRef.current = timestamp;

      const time = (timestamp - startTimeRef.current) / 1000;

      frameCountRef.current++;
      const now = timestamp;
      if (now - lastFPSUpdateRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (now - lastFPSUpdateRef.current));

        let drawCalls = 0;
        let gpuMemory = 0;

        if (actualEngine === "webgl" && threeSceneRef.current) {
          const info = threeSceneRef.current.renderer.info;
          drawCalls = info.render.calls;
          // 浼扮畻 GPU 鍐呭瓨鍗犵敤 (geometries + textures)
          // 娉ㄦ剰锛氳繖鍙槸涓€涓繎浼煎€硷紝Three.js 鐨?info.memory 鎻愪緵鐨勬槸璁℃暟锛屼笉鏄瓧鑺傛暟
          // 浣嗘垜浠彲浠ラ€氳繃杩欎釜璁℃暟鍙嶆槧璧勬簮鍗犵敤鍘嬪姏
          gpuMemory = info.memory.geometries + info.memory.textures;
        }

        const browserPerformance = performance as PerformanceWithMemory;
        const memoryUsage = browserPerformance.memory
          ? browserPerformance.memory.usedJSHeapSize / (1024 * 1024)
          : 0;

        updateStats({
          fps,
          cpuUsage: Math.min(100, ((deltaTime * 1000) / (1000 / config.targetFPS)) * 100),
          memoryUsage,
          drawCalls,
          gpuMemory,
        });
        frameCountRef.current = 0;
        lastFPSUpdateRef.current = now;
      }

      const { displayWidth, displayHeight } = getDisplaySize();
      const dpr = dprRef.current;

      const ctx = createRenderContext(displayWidth, displayHeight, deltaTime, time);
      const audioData = createAudioData();
      const transformParams = getTransformParams();

      if (ctx.ctx) {
        applyTransform(ctx.ctx, displayWidth, displayHeight, transformParams, dpr);
      }

      onRender(ctx, audioData, params);

      if (ctx.ctx) {
        restoreTransform(ctx.ctx, dpr);
      }

      if (actualEngine === "webgl" && threeSceneRef.current) {
        threeSceneRef.current.render();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    actualEngine,
    config.targetFPS,
    updateStats,
    onRender,
    params,
    createRenderContext,
    createAudioData,
    getTransformParams,
    applyTransform,
    restoreTransform,
    getDisplaySize,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;

    return () => {
      if (effectRef.current && canvas) {
        const dimensions = getDisplaySize();
        const cleanupCtx: RenderContext = {
          canvas,
          width: dimensions.displayWidth,
          height: dimensions.displayHeight,
          deltaTime: 0,
          time: 0,
          ctx: ctx2DRef.current || undefined,
          scene: threeSceneRef.current?.scene,
          camera: threeSceneRef.current?.camera,
          renderer: threeSceneRef.current?.renderer,
          private: privateContextRef.current,
        };
        effectRef.current.destroy(cleanupCtx);
      }
      if (threeSceneRef.current) {
        threeSceneRef.current.destroy();
        threeSceneRef.current = null;
      }
    };
  }, [getDisplaySize]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ transform: "translateZ(0)" }}
    />
  );
}
