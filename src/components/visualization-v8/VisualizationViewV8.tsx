"use client";

import React, { useRef, useEffect, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { useAudioStore } from "@/store/audioStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import { usePerformanceV8Store } from "@/store/performanceV8Store";
import { useVisualizationV8Store } from "@/store/visualizationV8Store";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Gauge, Settings, X } from "lucide-react";
import { RenderEngineManager } from "./engines/RenderEngineManager";
import { ResonanceTotemLayer } from "./ResonanceTotemLayer";
import { VisualControlDrawer } from "./shared/VisualControlDrawer";

import { useVisualizationV8 } from "@/hooks/useVisualizationV8";
import { RenderContext, AudioData } from "@/lib/visualization/types";
import { useTotemStore } from "@/store/totemStore";
import { useLyricsSearchStore } from "@/store/lyricsSearchStore";

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 350,
  damping: 30,
  mass: 1,
};

export function VisualizationViewV8() {
  const { currentView, setCurrentView, isTransitioning, setIsTransitioning } = useUIStore();
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentSong = useAudioStore((state) => state.currentSong);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const bufferedRanges = useAudioStore((state) => state.bufferedRanges);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const prevSong = useAudioStore((state) => state.prevSong);
  const nextSong = useAudioStore((state) => state.nextSong);
  const { currentTheme, blurIntensity, animationSpeed } = useVisualSettingsStore();
  const {
    fps,
    cpuUsage,
    memoryUsage,
    isWebGLAvailable,
    needsRecovery,
    setPerformanceLevel,
    setWebGLAvailable,
    resetRecoveryState,
  } = usePerformanceV8Store();
  const { seek } = useAudioPlayer();
  const {
    effects,
    currentEffectId,
    currentEffect,
    effectParams,
    setCurrentEffectId,
    updateParam,
    renderEffect,
    getCurrentParams,
    isInitialized,
  } = useVisualizationV8();

  const totemStore = useTotemStore();
  const parsedLyrics = useLyricsSearchStore((state) => state.parsedLyrics);
  const workerRef = useRef<Worker | null>(null);

  const [showControlDrawer, setShowControlDrawer] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const parameterMode = useVisualizationV8Store((state) => state.parameterMode);
  const setParameterMode = useVisualizationV8Store((state) => state.setParameterMode);

  const firstCanvasEffectId = effects.find((effect) => effect.preferredEngine !== "webgl")?.id;
  const performanceStats = {
    fps,
    cpu: cpuUsage,
    memory: memoryUsage,
  };
  const shouldShowRecovery =
    !currentEffect ||
    (currentEffect.preferredEngine === "webgl" && !isWebGLAvailable) ||
    needsRecovery;

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    try {
      const canvas = document.createElement("canvas");
      setWebGLAvailable(!!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
    } catch {
      setWebGLAvailable(false);
    }
  }, [setWebGLAvailable]);

  // Sync music time for shaders
  useEffect(() => {
    (window as any)._currentMusicTime = currentTime;
  }, [currentTime]);

  // Initialize totems for current song
  useEffect(() => {
    if (parsedLyrics.length > 0) {
      totemStore.initializeForSong(parsedLyrics);
    } else {
      totemStore.clear();
    }
  }, [parsedLyrics]);

  // Update active totems
  useEffect(() => {
    totemStore.updateActiveKeywords(currentTime);
  }, [currentTime]);

  // Manage Texture Worker
  useEffect(() => {
    if (typeof window === "undefined") return;

    const worker = new Worker(new URL("../../workers/totemTexture.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e) => {
      if (e.data.type === "texture-generated") {
        totemStore.addPreloadedTexture(e.data.id, e.data.bitmap);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  // Preload textures when keywords change
  useEffect(() => {
    if (!workerRef.current || totemStore.allKeywords.length === 0) return;

    totemStore.allKeywords.forEach((kw) => {
      if (!totemStore.preloadedTextures[kw.id]) {
        workerRef.current?.postMessage({
          type: "generate",
          id: kw.id,
          text: kw.text,
          style: "serif",
        });
      }
    });
  }, [totemStore.allKeywords]);

  useEffect(() => {
    if (currentView !== "visualization") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "C") {
        setShowControlDrawer((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentView]);

  const handleBack = useCallback(() => {
    setIsTransitioning(true);
    requestAnimationFrame(() => {
      setCurrentView("player");
      setTimeout(() => setIsTransitioning(false), 600);
    });
  }, [setCurrentView, setIsTransitioning]);

  const handleRender = useCallback(
    (ctx: RenderContext, audioData: AudioData, params: Record<string, any>) => {
      renderEffect(ctx, audioData, params);
    },
    [renderEffect]
  );

  if (currentView !== "visualization") return null;

  if (!isInitialized) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center z-[100]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/60 text-lg"
        >
          初始化中...
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ pointerEvents: currentView === "visualization" ? "auto" : "none" }}
    >
      <div
        className="absolute inset-0 transition-all"
        style={{
          background:
            "linear-gradient(135deg, rgb(15, 15, 35) 0%, rgba(0,0,0,0.8) 50%, rgb(30, 30, 60) 100%)",
          transitionDuration: `${animationSpeed * 800}ms`,
          backdropFilter: `blur(${blurIntensity}px)`,
        }}
      />

      <div
        className="absolute inset-0 transition-opacity duration-[800ms] ease-out"
        style={{
          background: "radial-gradient(ellipse at top, rgb(147, 51, 234) 0%, transparent 60%)",
          opacity: 0.15,
        }}
      />
      <div
        className="absolute inset-0 transition-opacity duration-[800ms] ease-out"
        style={{
          background:
            "radial-gradient(ellipse at bottom right, rgb(59, 130, 246) 0%, transparent 50%)",
          opacity: 0.1,
        }}
      />

      <div
        className="absolute inset-0 transition-all duration-[800ms] ease-out pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -20%, rgb(72, 236, 153) 0%, transparent 50%),
            radial-gradient(ellipse 80% 40% at 50% 0%, rgb(72, 236, 153) 0%, transparent 40%)
          `,
          opacity: 0.25,
        }}
      />

      <div
        className="absolute inset-0 transition-all duration-[800ms] ease-out pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 150% 100% at 50% -30%, rgb(72, 236, 153) 0%, transparent 70%)",
          opacity: 0.1,
          filter: "blur(60px)",
        }}
      />

      <div
        className="absolute inset-0 transition-opacity duration-[800ms] ease-out pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgb(236, 72, 153) 0%, transparent 70%)",
          opacity: 0.05,
        }}
      />

      <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <ResonanceTotemLayer />

      <RenderEngineManager
        engine={currentEffect?.preferredEngine || "canvas"}
        effect={currentEffect || null}
        onRender={handleRender}
        params={getCurrentParams()}
        width={dimensions.width}
        height={dimensions.height}
      />

      {shouldShowRecovery && (
        <div className="absolute inset-x-0 top-24 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-black/70 backdrop-blur-2xl p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200">
                <Gauge className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-white">可视化需要恢复</h3>
                <p className="mt-1 text-sm text-white/60">
                  {!currentEffect
                    ? "当前效果未初始化。"
                    : currentEffect.preferredEngine === "webgl" && !isWebGLAvailable
                      ? "当前设备不可用 WebGL，建议切换到 Canvas 效果。"
                      : `帧率已低于 20 FPS，当前约 ${fps.toFixed(0)} FPS。`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!firstCanvasEffectId}
                    onClick={() => {
                      if (firstCanvasEffectId) {
                        setCurrentEffectId(firstCanvasEffectId);
                      }
                      resetRecoveryState();
                    }}
                    className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
                  >
                    切换 Canvas
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerformanceLevel("low")}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                  >
                    降低质量
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowControlDrawer(true)}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                  >
                    打开控制
                  </button>
                </div>
                <p className="mt-3 text-xs text-white/35">
                  CPU {cpuUsage.toFixed(0)}% · Memory {memoryUsage.toFixed(0)} MB
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <motion.button
        onClick={handleBack}
        className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/[0.08] backdrop-blur-[24px] saturate-[180%] border border-white/[0.08] text-white/70 flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-white/[0.15] hover:text-white hover:border-white/[0.15] active:scale-95 z-50"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, ...APPLE_SPRING_CONFIG }}
      >
        <X className="w-6 h-6" />
      </motion.button>

      <button
        onClick={() => setShowControlDrawer(true)}
        className="absolute bottom-6 right-6 z-30 w-12 h-12 rounded-2xl bg-[#1c1c1e]/70 backdrop-blur-[48px] backdrop-saturate-[200%] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-center hover:bg-[#1c1c1e]/90 transition-all"
        title="效果控制 (C)"
      >
        <Settings className="w-5 h-5 text-white/80" />
      </button>

      <VisualControlDrawer
        isOpen={showControlDrawer}
        onClose={() => setShowControlDrawer(false)}
        effects={effects}
        currentEffectId={currentEffectId}
        onEffectSelect={setCurrentEffectId}
        effectParams={effectParams}
        onParamChange={updateParam}
        parameterMode={parameterMode}
        onParameterModeChange={setParameterMode}
        performanceStats={performanceStats}
      />

      {isTransitioning && <div className="absolute inset-0 bg-black/50 z-50 pointer-events-none" />}
    </motion.div>
  );
}
