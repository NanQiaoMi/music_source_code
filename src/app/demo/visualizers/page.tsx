"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  Sparkles,
  Sliders,
  Activity,
  Zap,
  Radio,
} from "lucide-react";
import { drawAnimeHandwrittenMV } from "@/components/visualization/effects/animeHandwrittenMV";
import { drawCinematicLyricDrift } from "@/components/visualization/effects/cinematicLyricDrift";
import type { EffectContext } from "@/components/visualization/effects/types";
import { FloatingCompactControlsState } from "@/components/player/floating/FloatingCompactControlsState";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";

const MOCK_LYRICS = [
  "在无声的微光中悄然苏醒",
  "万千星尘随声浪奔涌成字",
  "穿过幽暗深空 触碰纸面余温",
  "呼吸间 镜头如行云流水般掠过",
  "没有边界的画纸 自由舒展",
  "在暖光的照拂下 娓娓道来",
];

const DEMO_LAB_SONG = {
  id: "lab-song-01",
  title: "动漫手书 MV // 新海诚暮色",
  artist: "MIMI Cinematic Studio",
  album: "Cinematic Odyssey Vol.1",
  cover: "/default-cover.svg",
  audioUrl: "",
  duration: 240,
  source: "demo",
  lyrics: MOCK_LYRICS.map(
    (line, idx) => `[00:${(idx * 4).toString().padStart(2, "0")}.00]${line}`
  ).join("\n"),
};

export default function VisualizersLabPage() {
  const [selectedEffect, setSelectedEffect] = useState<
    "animeHandwrittenMV" | "cinematicLyricDrift"
  >("animeHandwrittenMV");
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [isInterlude, setIsInterlude] = useState(false);
  const [fps, setFps] = useState(60);

  // Anime MV Params
  const [zoomScale, setZoomScale] = useState(1.8);
  const [frameRate, setFrameRate] = useState<12 | 24>(12);
  const [animeColorScheme, setAnimeColorScheme] = useState(0);
  const [cinemascope, setCinemascope] = useState(true);
  const [ambientGlow, setAmbientGlow] = useState(0.9);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioDataRef = useRef<Uint8Array>(new Uint8Array(128));
  const bassKickRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);

  // 清理可能遗留的实验室演示歌曲，保证主播放器不受干扰
  useEffect(() => {
    const cur = useAudioStore.getState().currentSong;
    if (cur?.id === "lab-song-01") {
      const queue = useQueueStore.getState().queue;
      const playable = queue.find((s) => s.id !== "lab-song-01");
      if (playable) {
        useAudioStore.setState({ currentSong: playable });
        usePlayerStore.setState({ currentSong: playable });
      }
    }
  }, []);

  // Audio energy & Beat generator simulation
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = (60 / bpm) * 1000;
    const beatTimer = setInterval(() => {
      bassKickRef.current = 1.0;
    }, intervalMs);

    return () => clearInterval(beatTimer);
  }, [bpm, isPlaying]);

  // Auto step lyrics
  useEffect(() => {
    if (!isPlaying || isInterlude) return;
    const lyricTimer = setInterval(() => {
      setCurrentLineIndex((prev) => (prev + 1) % MOCK_LYRICS.length);
      bassKickRef.current = 0.9;
    }, 4500);

    return () => clearInterval(lyricTimer);
  }, [isPlaying, isInterlude]);

  // Manual transient trigger (Kick)
  const handleTriggerKick = useCallback(() => {
    bassKickRef.current = 1.0;
  }, []);

  // Main Render Loop
  useEffect(() => {
    let animId: number;

    const render = (time: number) => {
      animId = requestAnimationFrame(render);

      // FPS Calculation
      frameCountRef.current++;
      if (time - lastFpsUpdateRef.current >= 500) {
        setFps(Math.round((frameCountRef.current * 1000) / (time - lastFpsUpdateRef.current)));
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = time;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Generate synthetic frequency data with smooth kick decay
      bassKickRef.current *= 0.92;
      const kick = bassKickRef.current;
      const data = audioDataRef.current;
      for (let i = 0; i < data.length; i++) {
        const base = Math.sin(time * 0.003 + i * 0.1) * 30 + 40;
        const bassBoost = i < 16 ? kick * 180 : 0;
        data[i] = Math.min(255, Math.max(0, base + bassBoost));
      }

      // Build mock EffectContext
      const effectCtx: EffectContext = {
        ctx,
        width,
        height,
        data,
        params:
          selectedEffect === "animeHandwrittenMV"
            ? {
                zoomScale,
                frameRate,
                inkSplatter: 1.2,
                colorScheme: animeColorScheme,
                ambientGlow,
                cinemascope,
              }
            : {},
        time: time * 0.001,
        musicTime: currentLineIndex * 4.5 + ((time * 0.001) % 4.5),
        refs: {
          particles: { current: [] },
          nebulaStars: { current: [] },
          spectrumStars: { current: [] },
          matrixDrops: { current: [] },
          smoothBass: { current: kick },
          smoothMid: { current: 0.4 },
          smoothTreble: { current: 0.5 },
          bokeh: { current: [] },
          shockwaves: { current: [] },
        },
        theme: {
          primary: 210,
          secondary: 260,
          accent: 180,
        },
        utils: {
          getThemeBaseHue: () => 210,
        },
      };

      if (selectedEffect === "animeHandwrittenMV") {
        drawAnimeHandwrittenMV(effectCtx);
      } else {
        drawCinematicLyricDrift(effectCtx);
      }

      ctx.restore();
      lastTimeRef.current = time;
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    selectedEffect,
    zoomScale,
    frameRate,
    animeColorScheme,
    cinemascope,
    ambientGlow,
    currentLineIndex,
  ]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#06070a] text-white flex flex-col font-sans select-none">
      {/* 1. Header Toolbar */}
      <header className="relative z-30 h-14 border-b border-white/10 bg-black/40 backdrop-blur-2xl px-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-medium text-white/70 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回 MIMI 播放器
          </Link>
          <div className="h-4 w-px bg-white/15" />
          <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>MIMI 动效实验室 (Visualizers & Dock Lab)</span>
          </h1>
        </div>

        {/* Effect Selector Tabs */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
          {[
            { id: "animeHandwrittenMV", label: "动漫手书 MV (AE无裁切拉镜)" },
            { id: "cinematicLyricDrift", label: "温光浮字" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedEffect(tab.id as typeof selectedEffect)}
              className={`px-3.5 py-1 text-xs font-medium rounded-full transition-all ${
                selectedEffect === tab.id
                  ? "bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Realtime Stats */}
        <div className="flex items-center gap-4 text-xs font-mono text-white/50">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-white/80">{fps} FPS</span>
          </div>
          <div className="h-3 w-px bg-white/15" />
          <span>BPM: {bpm}</span>
        </div>
      </header>

      {/* 2. Main Stage (Full Canvas) */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

        {/* Floating Controls Overlay (Dock Test) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="mb-2 text-center text-[11px] font-medium text-white/40 tracking-wider">
            ↓ 鼠标悬浮查看自适应平滑展开 · 移开自动收缩折叠 ↓
          </div>
          <FloatingCompactControlsState song={DEMO_LAB_SONG} />
        </div>

        {/* Control & Debug Drawer Panel */}
        <div className="absolute top-4 right-4 z-30 w-72 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              实时调试控制台
            </span>
            <button
              onClick={handleTriggerKick}
              className="text-[11px] px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md hover:bg-amber-500/30 flex items-center gap-1 active:scale-95 transition-all"
            >
              <Zap className="w-3 h-3" />
              瞬态重拍
            </button>
          </div>

          {/* Audio & Timeline Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>模拟 BPM 速度: {bpm}</span>
              <input
                type="range"
                min={60}
                max={180}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-24 h-1 accent-cyan-400 bg-white/10 rounded-full"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex-1 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? "暂停律动" : "开始律动"}
              </button>
              <button
                onClick={() => setCurrentLineIndex((prev) => (prev + 1) % MOCK_LYRICS.length)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-medium flex items-center justify-center transition-all"
                title="切换下一句歌词 (触发特写/聚散)"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => setIsInterlude((prev) => !prev)}
              className={`w-full py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                isInterlude
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {isInterlude ? "间奏中 (吸积盘 / 全景)" : "模拟无歌词间奏"}
            </button>
          </div>

          {/* Current Lyric Preview */}
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <div className="text-[10px] uppercase text-cyan-400/80 font-mono tracking-wider mb-1">
              当前歌词行 [{currentLineIndex + 1}/{MOCK_LYRICS.length}]
            </div>
            <div className="font-semibold text-white truncate">{MOCK_LYRICS[currentLineIndex]}</div>
          </div>

          {/* Effect-Specific Tuning */}
          <div className="space-y-3 pt-1 border-t border-white/10">
            {selectedEffect === "animeHandwrittenMV" && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/70">
                    <span>AE 镜头推近倍率</span>
                    <span className="font-mono text-amber-300">{zoomScale}x</span>
                  </div>
                  <input
                    type="range"
                    min={1.2}
                    max={2.5}
                    step={0.1}
                    value={zoomScale}
                    onChange={(e) => setZoomScale(Number(e.target.value))}
                    className="w-full h-1 accent-amber-400 bg-white/10 rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>抽帧定格模式</span>
                  <div className="flex gap-1">
                    {[12, 24].map((fpsVal) => (
                      <button
                        key={fpsVal}
                        onClick={() => setFrameRate(fpsVal as 12 | 24)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                          frameRate === fpsVal ? "bg-amber-500/30 text-amber-300" : "bg-white/5"
                        }`}
                      >
                        {fpsVal}fps
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/70">
                    <span>手绘色盘预设</span>
                    <span className="font-mono text-amber-300">
                      {["日光暖纸", "暮色群青", "秋叶山吹", "封面自适应"][animeColorScheme]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={animeColorScheme}
                    onChange={(e) => setAnimeColorScheme(Number(e.target.value))}
                    className="w-full h-1 accent-amber-400 bg-white/10 rounded-full"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/70">
                    <span>45°晨光体积光与光晕</span>
                    <span className="font-mono text-amber-300">
                      {Math.round(ambientGlow * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.8}
                    step={0.1}
                    value={ambientGlow}
                    onChange={(e) => setAmbientGlow(Number(e.target.value))}
                    className="w-full h-1 accent-amber-400 bg-white/10 rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-white/70 pt-1">
                  <span>2.39:1 院线遮幅</span>
                  <button
                    onClick={() => setCinemascope((prev) => !prev)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-mono transition-all ${
                      cinemascope
                        ? "bg-amber-500/25 text-amber-300 border border-amber-400/40"
                        : "bg-white/5 text-white/40"
                    }`}
                  >
                    {cinemascope ? "已开启" : "已关闭"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
