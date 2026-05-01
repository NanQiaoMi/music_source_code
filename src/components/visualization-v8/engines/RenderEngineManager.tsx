"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { RenderEngine, RenderContext, EffectPlugin, AudioData, TransformParams } from "@/lib/visualization/types";
import { ThreeJSScene } from "@/lib/three/ThreeJSScene";
import { usePerformanceV8Store } from "@/store/performanceV8Store";

interface RenderEngineManagerProps {
  engine: RenderEngine;
  effect: EffectPlugin | null;
  onRender: (ctx: RenderContext, audioData: AudioData, params: Record<string, any>) => void;
  params?: Record<string, any>;
  width: number;
  height: number;
}

export function RenderEngineManager({ 
  engine, 
  effect, 
  onRender, 
  params = {},
  width, 
  height 
}: RenderEngineManagerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeSceneRef = useRef<ThreeJSScene | null>(null);
  const ctx2DRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const effectRef = useRef<EffectPlugin | null>(null);
  const dprRef = useRef(window.devicePixelRatio || 1);
  const privateContextRef = useRef<Record<string, any>>({});
  
  const frequencyDataRef = useRef(new Uint8Array(256));
  const waveformDataRef = useRef(new Uint8Array(256));
  
  const [isWebGLAvailable] = useState(() => {
    try {
      const testCanvas = document.createElement("canvas");
      return !!(
        testCanvas.getContext("webgl") || 
        testCanvas.getContext("experimental-webgl")
      );
    } catch {
      return false;
    }
  });

  const { config, updateStats } = usePerformanceV8Store();
  const frameCountRef = useRef(0);
  const lastFPSUpdateRef = useRef(Date.now());

  const selectActualEngine = useCallback((preferred: RenderEngine): RenderEngine => {
    if (preferred === "webgl" && !isWebGLAvailable) {
      return "canvas";
    }
    if (preferred === "auto") {
      return isWebGLAvailable ? "webgl" : "canvas";
    }
    return preferred;
  }, [isWebGLAvailable]);

  const actualEngine = selectActualEngine(engine);

  const setupCanvas = useCallback(() => {
    if (!canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const dpr = dprRef.current;
    
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    
    if (ctx2DRef.current) {
      ctx2DRef.current.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    return { displayWidth: window.innerWidth, displayHeight: window.innerHeight };
  }, []);

  const applyTransform = useCallback((context: CanvasRenderingContext2D, displayWidth: number, displayHeight: number, transformParams: TransformParams, dpr: number) => {
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
  }, []);

  const restoreTransform = useCallback((context: CanvasRenderingContext2D, dpr: number) => {
    context.restore();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const createRenderContext = useCallback((displayWidth: number, displayHeight: number, deltaTime: number, time: number): RenderContext => {
    const ctx: RenderContext = {
      canvas: canvasRef.current!,
      width: displayWidth,
      height: displayHeight,
      deltaTime,
      time,
      private: privateContextRef.current
    };

    if (actualEngine === "webgl" && threeSceneRef.current) {
      ctx.scene = threeSceneRef.current.scene;
      ctx.camera = threeSceneRef.current.camera;
      ctx.renderer = threeSceneRef.current.renderer;
    } else if (ctx2DRef.current) {
      ctx.ctx = ctx2DRef.current;
    }

    return ctx;
  }, [actualEngine]);

  const createAudioData = useCallback((): AudioData => ({
    frequencyData: frequencyDataRef.current,
    waveformData: waveformDataRef.current,
    bass: 0,
    mid: 0,
    treble: 0,
    full: 0,
    isBeat: false,
    bpm: 120
  }), []);

  const getTransformParams = useCallback((): TransformParams => ({
    positionX: params.positionX ?? 0,
    positionY: params.positionY ?? 0,
    scale: params.scale ?? 1,
    rotation: params.rotation ?? 0
  }), [params]);

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
          alpha: true
        });
      }
      setupCanvas();
    }

    const handleResize = () => {
      dprRef.current = window.devicePixelRatio || 1;
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
        const cleanupCtx: RenderContext = {
          canvas,
          width: window.innerWidth,
          height: window.innerHeight,
          deltaTime: 0,
          time: 0,
          ctx: ctx2DRef.current || undefined,
          scene: threeSceneRef.current?.scene,
          camera: threeSceneRef.current?.camera,
          renderer: threeSceneRef.current?.renderer,
          private: privateContextRef.current
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
          private: privateContextRef.current
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
  }, [actualEngine, isWebGLAvailable, effect, setupCanvas]);

  useEffect(() => {
    const render = (timestamp: number) => {
      if (!canvasRef.current || !ctx2DRef.current) return;

      const deltaTime = lastTimeRef.current 
        ? (timestamp - lastTimeRef.current) / 1000 
        : 0;
      lastTimeRef.current = timestamp;

      const time = (Date.now() - startTimeRef.current) / 1000;

      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFPSUpdateRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (now - lastFPSUpdateRef.current));
        updateStats({
          fps,
          cpuUsage: Math.min(100, (deltaTime * 1000) / (1000 / config.targetFPS) * 100),
          memoryUsage: 0,
          drawCalls: 0
        });
        frameCountRef.current = 0;
        lastFPSUpdateRef.current = now;
      }

      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;
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
  }, [actualEngine, config.targetFPS, updateStats, onRender, params, createRenderContext, createAudioData, getTransformParams, applyTransform, restoreTransform]);

  useEffect(() => {
    return () => {
      if (effectRef.current) {
        const cleanupCtx: RenderContext = {
          canvas: canvasRef.current!,
          width: window.innerWidth,
          height: window.innerHeight,
          deltaTime: 0,
          time: 0,
          ctx: ctx2DRef.current || undefined,
          scene: threeSceneRef.current?.scene,
          camera: threeSceneRef.current?.camera,
          renderer: threeSceneRef.current?.renderer,
          private: privateContextRef.current
        };
        effectRef.current.destroy(cleanupCtx);
      }
      if (threeSceneRef.current) {
        threeSceneRef.current.destroy();
        threeSceneRef.current = null;
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}
