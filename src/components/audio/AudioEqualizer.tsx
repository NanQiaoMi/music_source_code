/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore, type EQPreset as AudioEQPreset } from "@/store/audioStore";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { Waves, X, RotateCcw, Check, Sparkles, Activity } from "lucide-react";

export interface EQPresetUI {
  id: AudioEQPreset;
  name: string;
  nameEn: string;
  badge: string;
}

export const EQ_PRESETS_UI: EQPresetUI[] = [
  { id: "flat", name: "平坦", nameEn: "Flat", badge: "RAW" },
  { id: "pop", name: "流行", nameEn: "Pop", badge: "POP" },
  { id: "rock", name: "摇滚", nameEn: "Rock", badge: "ROCK" },
  { id: "classical", name: "古典", nameEn: "Classical", badge: "CLASSIC" },
  { id: "jazz", name: "爵士", nameEn: "Jazz", badge: "JAZZ" },
  { id: "vocal", name: "人声", nameEn: "Vocal", badge: "VOCAL" },
  { id: "light", name: "轻音乐", nameEn: "Light", badge: "ACOUSTIC" },
  { id: "bass", name: "重低音", nameEn: "Bass", badge: "BASS+" },
  { id: "treble", name: "高音增强", nameEn: "Treble", badge: "AIR+" },
];

const BAND_FREQUENCIES = [
  "32 Hz",
  "64 Hz",
  "125 Hz",
  "250 Hz",
  "500 Hz",
  "1 kHz",
  "2 kHz",
  "4 kHz",
  "8 kHz",
  "16 kHz",
];

const DEFAULT_EQ_BANDS_30: number[] = Array(30).fill(0);

interface AudioEqualizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioEqualizer: React.FC<AudioEqualizerProps> = ({ isOpen, onClose }) => {
  const { audioElement } = useAudioPlayer();
  const setEQBands = useAudioStore((state) => state.setEQBands);
  const currentEQPreset = useAudioStore((state) => state.currentEQPreset);
  const eqBands = useAudioStore((state) => state.eqBands);
  const loadEQPreset = useAudioStore((state) => state.loadEQPreset);
  const bands = eqBands.length === 30 ? eqBands : DEFAULT_EQ_BANDS_30;
  const selectedPreset = currentEQPreset;

  const applyEQToAudio = useCallback(
    (gainValues: number[]) => {
      AudioEngine.getInstance().updateEQ(gainValues);
      setEQBands(gainValues);
    },
    [setEQBands]
  );

  useEffect(() => {
    if (audioElement && isOpen) {
      applyEQToAudio(bands);
    }
  }, [applyEQToAudio, bands, audioElement, isOpen]);

  const handleBandChange = useCallback(
    (index: number, value: number) => {
      const newBands = [...bands];
      newBands[index] = value;
      applyEQToAudio(newBands);
    },
    [applyEQToAudio, bands]
  );

  const handlePresetSelect = useCallback(
    (presetId: AudioEQPreset) => {
      loadEQPreset(presetId);
    },
    [loadEQPreset]
  );

  const handleReset = useCallback(() => {
    handlePresetSelect("flat");
  }, [handlePresetSelect]);

  const displayBands = bands.slice(0, 10);

  // 计算实时贝塞尔频率响应曲线路径 (SVG Bezier Path)
  const curvePath = useMemo(() => {
    const width = 640;
    const height = 90;
    const paddingX = 32;
    const usableWidth = width - paddingX * 2;
    const stepX = usableWidth / (displayBands.length - 1);
    const midY = height / 2;

    const points = displayBands.map((gain, i) => {
      const x = paddingX + i * stepX;
      // gain: -12 to +12, maps to midY + 36 to midY - 36
      const y = midY - (gain / 12) * 36;
      return { x, y };
    });

    if (points.length < 2) return "";

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) * 0.45;
      const cy1 = p0.y;
      const cx2 = p1.x - (p1.x - p0.x) * 0.45;
      const cy2 = p1.y;
      path += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }

    return path;
  }, [displayBands]);

  const areaPath = useMemo(() => {
    if (!curvePath) return "";
    return `${curvePath} L 608 90 L 32 90 Z`;
  }, [curvePath]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/70 backdrop-blur-md select-none font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative w-full max-w-[720px] bg-[#1c1c1e]/95 rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.7)] border border-white/[0.08] overflow-hidden flex flex-col max-h-[88vh] text-[#f5f5f7]"
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0071e3] to-[#2997ff] flex items-center justify-center text-white shadow-md shadow-[#0071e3]/30">
              <Waves className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[18px] font-semibold text-white tracking-[-0.02em] leading-tight">
                专业音频均衡器 (Studio EQ)
              </h3>
              <p className="text-[13px] text-[#86868b] mt-1 tracking-tight">
                10 段高精度双二阶频段增益 · 纯净硬件级音效补偿
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主体滚动区 */}
        <div className="px-8 py-7 overflow-y-auto space-y-7 flex-1 text-left">
          {/* 1. 实时频率响应曲线 (Live Frequency Response Curve) */}
          <div className="p-5 rounded-[22px] bg-white/[0.04] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                滤波器频率响应拓扑 (Frequency Response)
              </span>
              <span className="text-[11px] font-mono text-[#2997ff]">实时硬件插值</span>
            </div>

            <div className="relative w-full h-[90px] rounded-xl overflow-hidden bg-black/30 border border-white/5">
              {/* 零刻度虚线 */}
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10 border-dashed" />
              <div className="absolute top-2 left-3 text-[10px] font-mono text-white/30">+12 dB</div>
              <div className="absolute bottom-2 left-3 text-[10px] font-mono text-white/30">-12 dB</div>
              <div className="absolute top-1/2 -translate-y-1/2 left-3 text-[10px] font-mono text-[#2997ff]/60">
                0 dB
              </div>

              {/* 动态 SVG 曲线 */}
              <svg className="w-full h-full" viewBox="0 0 640 90" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eqCurveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#bf5af2" />
                    <stop offset="50%" stopColor="#2997ff" />
                    <stop offset="100%" stopColor="#30d158" />
                  </linearGradient>
                  <linearGradient id="eqAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2997ff" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2997ff" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#eqAreaGradient)" />
                <path
                  d={curvePath}
                  fill="none"
                  stroke="url(#eqCurveGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* 2. 调音风格预设 (Segmented Preset Grid) */}
          <div className="space-y-3">
            <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider px-1">
              调音风格预设
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {EQ_PRESETS_UI.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <motion.button
                    key={preset.id}
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`p-3 rounded-2xl text-center transition-all border ${
                      isSelected
                        ? "bg-[#0071e3] border-[#0071e3] text-white shadow-md font-semibold"
                        : "bg-white/[0.04] border-white/[0.06] text-[#86868b] hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <div className="text-[13px] tracking-tight">{preset.name}</div>
                    <div className="text-[10px] opacity-70 font-mono mt-0.5 tracking-wider">
                      {preset.badge}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* 3. 10 段专业频段垂直推子 (Apple Studio Tactile Faders) */}
          <div className="p-6 rounded-[22px] bg-white/[0.04] border border-white/[0.06] space-y-4">
            <div className="flex items-center justify-between text-[12px] text-[#86868b] font-mono px-2">
              <span>+12 dB</span>
              <span className="text-white/40">0 dB (基准)</span>
              <span>-12 dB</span>
            </div>

            {/* 推子网格 */}
            <div className="grid grid-cols-10 gap-2 sm:gap-3">
              {displayBands.map((gain, index) => (
                <div key={index} className="flex flex-col items-center gap-2.5">
                  <span className="text-[12px] font-mono font-semibold text-white/90">
                    {gain > 0 ? `+${gain}` : gain}
                  </span>

                  <div className="relative h-40 flex items-center justify-center">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={gain}
                      onChange={(e) => handleBandChange(index, parseInt(e.target.value))}
                      className="h-36 w-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3] hover:accent-[#2997ff] transition-all"
                      style={{
                        writingMode: "vertical-lr",
                        direction: "rtl",
                      }}
                    />
                  </div>

                  <span className="text-[11px] font-mono text-[#86868b] whitespace-nowrap">
                    {BAND_FREQUENCIES[index]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="px-8 py-5 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 text-[14px] text-[#86868b] hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            还原默认 (平坦)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-7 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[14px] font-semibold tracking-tight shadow-md transition-transform active:scale-[0.97]"
          >
            完成
          </button>
        </div>
      </motion.div>
    </div>
  );
};
