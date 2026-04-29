"use client";

import { useRef, useEffect, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { useAudioStore } from "@/store/audioStore";
import { useVisualizationStore, VisualizationEffect } from "@/store/visualizationStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { getAudioAnalyser } from "@/hooks/useAudioPlayer";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { X, Maximize2, Minimize2, Settings, Video } from "lucide-react";
import { RecordingPanel } from "@/components/features-v7/RecordingPanel";
import { VisualizationSettingsPanel } from "./VisualizationSettingsPanel";
import { VisualizationProgressBar } from "./VisualizationProgressBar";
import * as Effects from "./effects";

const PlayIcon = memo(() => (
  <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
));
PlayIcon.displayName = "PlayIcon";

const PauseIcon = memo(() => (
  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
  </svg>
));
PauseIcon.displayName = "PauseIcon";

const PrevIcon = memo(() => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
));
PrevIcon.displayName = "PrevIcon";

const NextIcon = memo(() => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
  </svg>
));
NextIcon.displayName = "NextIcon";

export function VisualizationView() {
  const { currentView, setCurrentView, isTransitioning } = useUIStore();
  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const themeColors = useUIStore((state) => state.themeColors);
  const isDynamicTheme = useUIStore((state) => state.isDynamicTheme);
  const currentTime = useAudioStore(state => state.currentTime);
  const duration = useAudioStore(state => state.duration);
  const bufferedRanges = useAudioStore(state => state.bufferedRanges);
  const prevSong = useAudioStore(state => state.prevSong);
  const nextSong = useAudioStore(state => state.nextSong);
  const { currentEffect, setCurrentEffect, isFullscreen, setIsFullscreen, effectSettings } = useVisualizationStore();
  const { currentTheme } = useVisualSettingsStore();
  const { seek } = useAudioPlayer();
  const [showSettings, setShowSettings] = useState(false);
  const [showRecording, setShowRecording] = useState(false);
  const [mouseIdle, setMouseIdle] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const bufferLengthRef = useRef<number>(0);
  const particlesRef = useRef<any[]>([]);
  const nebulaStarsRef = useRef<any[]>([]);
  const spectrumStarsRef = useRef<any[]>([]);
  const matrixDropsRef = useRef<number[]>([]);
  const timeRef = useRef<number>(0);
  const smoothDataRef = useRef<Float32Array>(new Float32Array(128));
  const smoothBassRef = useRef(0);
  const smoothMidRef = useRef(0);
  const smoothTrebleRef = useRef(0);
  const bokehRef = useRef<any[]>([]);
  const shockwavesRef = useRef<any[]>([]);

  // Mouse idle detection for Zen Mode
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      setMouseIdle(false);
      clearTimeout(timeout);
      timeout = setTimeout(() => setMouseIdle(true), 3000);
    };
    window.addEventListener("mousemove", handleMouseMove);
    timeout = setTimeout(() => setMouseIdle(true), 3000);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  // Sync fullscreen state with browser events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [setIsFullscreen]);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleDoubleClick = () => {
    handleToggleFullscreen();
  };

  useEffect(() => {
    if (currentView !== "visualization") return;

    const analyser = getAudioAnalyser();
    if (analyser) {
      analyser.fftSize = 256;
      bufferLengthRef.current = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLengthRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentView]);

  const vizTargetHues = useRef({ primary: 280, secondary: 320, accent: 150 });
  const vizActiveHues = useRef({ primary: 280, secondary: 320, accent: 150 });

  // 1. Decoupled Hue Target Calculation
  useEffect(() => {
    const rgbToHue = (rgbStr: string) => {
      if (!rgbStr) return 280;
      const match = rgbStr.match(/\d+/g);
      if (!match) return 280;
      const r = parseInt(match[0]) / 255, g = parseInt(match[1]) / 255, b = parseInt(match[2]) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0;
      if (max !== min) {
        const d = max - min;
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
      }
      return h * 360;
    };

    const p = themeColors ? rgbToHue(themeColors.primary) : 280;
    const s = themeColors ? rgbToHue(themeColors.secondary) : (p + 40) % 360;
    const a = themeColors ? rgbToHue(themeColors.accent) : (p + 180) % 360;

    vizTargetHues.current = { primary: p, secondary: s, accent: a };
  }, [themeColors]);

  useEffect(() => {
    if (currentView !== "visualization" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false }); // optimize for opaque background
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles(canvas.width, canvas.height);
    };

    const initParticles = (w: number, h: number) => {
      particlesRef.current = [];
      const count = 1000;
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: (Math.random() - 0.5) * 2000,
          y: (Math.random() - 0.5) * 2000,
          z: Math.random() * 2000,
          ox: 0, oy: 0,
        });
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const lerpHue = (current: number, target: number, factor: number) => {
      let diff = target - current;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      return (current + diff * factor + 360) % 360;
    };


    const draw = (timestamp: number) => {
      timeRef.current = timestamp;
      
      const state = useVisualizationStore.getState();
      const currentEff = state.currentEffect;
      const settings = state.effectSettings;

      const analyser = getAudioAnalyser();
      if (analyser && dataArrayRef.current) {
        analyser.getByteFrequencyData(dataArrayRef.current as any);
        
        // Smooth data for visualization
        const raw = dataArrayRef.current;
        const smooth = smoothDataRef.current;
        const len = Math.min(raw.length, smooth.length);
        for (let i = 0; i < len; i++) {
          smooth[i] = smooth[i] * 0.7 + (raw[i] / 255) * 0.3;
        }
      }

      // Smooth Hue Transitions
      const target = vizTargetHues.current;
      const active = vizActiveHues.current;
      
      const lerpHueInternal = (curr: number, tar: number, factor: number) => {
        let diff = tar - curr;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return (curr + diff * factor + 360) % 360;
      };

      active.primary = lerpHueInternal(active.primary, target.primary, 0.05);
      active.secondary = lerpHueInternal(active.secondary, target.secondary, 0.05);
      active.accent = lerpHueInternal(active.accent, target.accent, 0.05);

      if (ctx && dataArrayRef.current) {
        // Shared context for all effects
        const effectCtx: Effects.EffectContext = {
          ctx,
          width: canvas.width,
          height: canvas.height,
          data: dataArrayRef.current,
          time: timestamp,
          params: settings[currentEff] || settings.spatialMesh,
          refs: {
            particles: particlesRef,
            nebulaStars: nebulaStarsRef,
            spectrumStars: spectrumStarsRef,
            matrixDrops: matrixDropsRef,
            smoothBass: smoothBassRef,
            smoothMid: smoothMidRef,
            smoothTreble: smoothTrebleRef,
            bokeh: bokehRef,
            shockwaves: shockwavesRef,
          },
          theme: {
            primary: active.primary,
            secondary: active.secondary,
            accent: active.accent,
          },
          utils: {
            getThemeBaseHue: () => active.primary
          }
        };

        // --- SAFETY RESET: Ensure each effect starts with a clean slate ---
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.filter = "none";

        // Clear background for non-matrix effects (Matrix handles its own clear)
        if (currentEff !== "cyberMatrix") {
          ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Call the appropriate effect
        switch (currentEff) {
          case "spatialMesh":
            Effects.drawSpatialMesh(effectCtx);
            break;
          case "cyberpunkParticles":
            Effects.drawCyberpunkParticles(effectCtx);
            break;
          case "organicFluid":
            Effects.drawOrganicFluid(effectCtx);
            break;
          case "auroraWave":
            Effects.drawAuroraWave(effectCtx);
            break;
          case "spectrumRing":
            Effects.drawSpectrumRing(effectCtx);
            break;
          case "nebulaField":
            Effects.drawNebulaField(effectCtx);
            break;
          case "vinylGroove":
            Effects.drawVinylGroove(effectCtx);
            break;
          case "cyberMatrix":
            Effects.drawCyberMatrix(effectCtx);
            break;
          case "gravitationalField":
            Effects.drawGravitationalField(effectCtx);
            break;
          case "prismPulse":
            Effects.drawPrismPulse(effectCtx);
            break;
          default:
            Effects.drawSpatialMesh(effectCtx);
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentView]);

  if (currentView !== "visualization") return null;

  const handleTogglePlay = () => {
    if (currentSong) {
      setIsPlaying(!isPlaying);
    }
  };

  const getCanvasStyle = () => {
    if (currentEffect === "spatialMesh") {
      const blurVal = Math.min(effectSettings.spatialMesh.blurIntensity, 80);
      return {
        filter: `blur(${blurVal}px) saturate(1.8) contrast(1.1)`,
        transform: 'translateZ(0)',
        willChange: 'filter'
      };
    }
    if (currentEffect === "organicFluid") {
      return {
        filter: `saturate(1.3) contrast(1.25) brightness(0.8) drop-shadow(0 0 40px rgba(0, 100, 255, 0.15))`,
        transform: 'translateZ(0)',
        willChange: 'filter'
      };
    }
    if (currentEffect === "auroraWave") {
      return { filter: `saturate(1.2) contrast(1.1)`, transform: 'translateZ(0)' };
    }
    if (currentEffect === "nebulaField") {
      return { filter: `saturate(1.3) brightness(1.1)`, transform: 'translateZ(0)' };
    }
    if (currentEffect === "vinylGroove") {
      return { 
        filter: `saturate(1.4) contrast(1.15) brightness(1.05) drop-shadow(0 0 40px rgba(100, 150, 255, 0.15))`, 
        transform: 'translateZ(0)',
        willChange: 'filter'
      };
    }
    if (currentEffect === "spectrumRing") {
      return { 
        filter: `saturate(1.4) contrast(1.1) brightness(1.1) drop-shadow(0 0 30px rgba(255, 255, 255, 0.05))`, 
        transform: 'translateZ(0)',
        willChange: 'filter'
      };
    }
    return { transform: 'translateZ(0)' };
  };

  const effectsList: { id: VisualizationEffect; name: string }[] = [
    { id: "spatialMesh", name: "流光幻境" },
    { id: "cyberpunkParticles", name: "神经之网" },
    { id: "organicFluid", name: "生命流体" },
    { id: "auroraWave", name: "极光幻影" },
    { id: "spectrumRing", name: "频谱奇点" },
    { id: "nebulaField", name: "星海漫游" },
    { id: "vinylGroove", name: "量子空间" },
    { id: "cyberMatrix", name: "赛博矩阵" },
    { id: "prismPulse", name: "棱镜脉冲" },
    { id: "gravitationalField", name: "重力场 (隐藏)" },
  ];

  return (
    <motion.div
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      className="absolute inset-0 bg-black overflow-hidden font-sans cursor-pointer"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: currentView === "visualization" ? "auto" : "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full transition-all duration-1000 ease-out"
        style={getCanvasStyle()}
      />

      {/* Album Art floating in center */}
      <AnimatePresence>
        {(currentEffect === "spatialMesh" || currentEffect === "spectrumRing" || currentEffect === "organicFluid" || currentEffect === "vinylGroove") && currentSong?.cover && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ type: "spring", stiffness: 150, damping: 25 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className={`relative overflow-hidden ${(currentEffect === "spectrumRing" || currentEffect === "vinylGroove") ? "w-48 h-48 md:w-72 md:h-72 rounded-full shadow-[0_0_80px_rgba(0,0,0,0.9)]" : "w-[240px] h-[240px] md:w-[360px] md:h-[360px] rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              } border border-white/10`}
              style={{
                transform: `scale(${1 + (dataArrayRef.current?.[2] || 0) / 255 * 0.08})`,
                willChange: 'transform',
                transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)'
              }}>
              {/* Dynamic glow behind the cover */}
              {currentEffect === "spectrumRing" && (
                <div className="absolute inset-0 bg-white/20 animate-pulse blur-2xl -z-10" />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentSong.cover} alt="cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 border border-white/20 rounded-[inherit] pointer-events-none mix-blend-overlay" />
              
              {/* Overlay reflection */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 flex flex-col pointer-events-none">
        {/* Header */}
        <AnimatePresence>
          {!mouseIdle && (
            <motion.header
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex items-center justify-between p-6 md:px-10 md:py-8 z-10 pointer-events-auto"
            >
              <button
                onClick={() => setCurrentView("player")}
                className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-105 transition-all duration-300 shrink-0"
              >
                <X className="w-5 h-5 text-white/90" />
              </button>

              <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 overflow-x-auto max-w-[70vw] scrollbar-hide shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                {effectsList.map((effect) => (
                  <button
                    key={effect.id}
                    onClick={() => {
                      setCurrentEffect(effect.id);
                      useStatsAchievementsStore.getState().reportProToolsUsage("visualizer_config");
                    }}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-widest transition-all duration-300 whitespace-nowrap shrink-0 uppercase ${currentEffect === effect.id
                        ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-105"
                        : "text-white/50 hover:text-white/90 hover:bg-white/5"
                      }`}
                  >
                    {effect.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-105 transition-all duration-300"
                >
                  <Settings className="w-5 h-5 text-white/90" />
                </button>

                <button
                  onClick={() => setShowRecording(!showRecording)}
                  className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-105 transition-all duration-300"
                >
                  <Video className="w-5 h-5 text-white/90" />
                </button>

                <button
                  onClick={handleToggleFullscreen}
                  className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-105 transition-all duration-300 hidden md:flex"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5 text-white/90" />
                  ) : (
                    <Maximize2 className="w-5 h-5 text-white/90" />
                  )}
                </button>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* Footer Controls - Premium Glassmorphism */}
        <AnimatePresence>
          {!mouseIdle && (
            <motion.footer
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-10 pointer-events-auto"
            >
              <div className="relative overflow-hidden rounded-[32px] bg-[#0a0c14]/60 backdrop-blur-[60px] border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.8)] p-8 md:p-10">
                {/* Subtle highlight gradient */}
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent opacity-30 pointer-events-none" />

                <div className="relative z-10 flex flex-col gap-6">
                  {currentSong && (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex-1 min-w-0 flex flex-col items-center md:items-start text-center md:text-left">
                        <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-tight mb-1 truncate w-full">
                          {currentSong.title}
                        </h2>
                        <p className="text-white/60 text-sm md:text-base font-medium truncate w-full flex items-center justify-center md:justify-start gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-xs font-bold uppercase tracking-wider text-white/80">
                            Hires
                          </span>
                          {currentSong.artist} {currentSong.album ? ` • ${currentSong.album}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-4 shrink-0">
                        <button
                          onClick={prevSong}
                          className="w-12 h-12 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center transition-all duration-300 hover:bg-white/20 hover:scale-110 active:scale-95 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        >
                          <PrevIcon />
                        </button>

                        <button
                          onClick={handleTogglePlay}
                          disabled={!currentSong}
                          className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_40px_rgba(255,255,255,0.6)]"
                        >
                          {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        </button>

                        <button
                          onClick={nextSong}
                          className="w-12 h-12 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center transition-all duration-300 hover:bg-white/20 hover:scale-110 active:scale-95 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        >
                          <NextIcon />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="w-full px-2">
                    <VisualizationProgressBar
                      currentTime={currentTime}
                      duration={duration}
                      bufferedRanges={bufferedRanges}
                      onSeek={seek}
                    />
                  </div>
                </div>
              </div>
            </motion.footer>
          )}
        </AnimatePresence>
      </div>

      {isTransitioning && (
        <div className="absolute inset-0 bg-black/50 z-50 pointer-events-none transition-opacity duration-500" />
      )}

      <VisualizationSettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <RecordingPanel
        isOpen={showRecording}
        onClose={() => setShowRecording(false)}
        canvasRef={canvasRef}
      />
    </motion.div>
  );
}
