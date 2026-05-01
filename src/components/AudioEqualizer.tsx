"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAudioStore, type EQPreset as AudioEQPreset } from "@/store/audioStore";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

export interface EQBand {
  frequency: number;
  label: string;
  gain: number;
}

export interface EQPresetUI {
  id: AudioEQPreset;
  name: string;
  nameEn: string;
  icon: string;
}

export const EQ_PRESETS_UI: EQPresetUI[] = [
  { id: "flat", name: "平坦", nameEn: "Flat", icon: "─" },
  { id: "pop", name: "流行", nameEn: "Pop", icon: "♪" },
  { id: "rock", name: "摇滚", nameEn: "Rock", icon: "🎸" },
  { id: "classical", name: "古典", nameEn: "Classical", icon: "🎻" },
  { id: "jazz", name: "爵士", nameEn: "Jazz", icon: "🎷" },
  { id: "vocal", name: "人声", nameEn: "Vocal", icon: "🎤" },
  { id: "light", name: "轻音乐", nameEn: "Light", icon: "🌙" },
  { id: "bass", name: "重低音", nameEn: "Bass", icon: "🔊" },
  { id: "treble", name: "高音增强", nameEn: "Treble", icon: "✨" },
];

const DEFAULT_EQ_BANDS_30: number[] = Array(30).fill(0);

interface AudioEqualizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioEqualizer: React.FC<AudioEqualizerProps> = ({ isOpen, onClose }) => {
  const { audioElement } = useAudioPlayer();
  const setEQBands = useAudioStore(state => state.setEQBands);
  const currentEQPreset = useAudioStore(state => state.currentEQPreset);
  const setCurrentEQPreset = useAudioStore(state => state.setCurrentEQPreset);
  const eqBands = useAudioStore(state => state.eqBands);
  const loadEQPreset = useAudioStore(state => state.loadEQPreset);
  const [bands, setBands] = useState<number[]>(
    eqBands.length === 30 ? eqBands : DEFAULT_EQ_BANDS_30
  );
  const [selectedPreset, setSelectedPreset] = useState<AudioEQPreset>(currentEQPreset);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    if (audioElement && isOpen) {
      applyEQToAudio(bands);
    }
  }, [bands, audioElement, isOpen]);

  useEffect(() => {
    setBands(eqBands.length === 30 ? eqBands : DEFAULT_EQ_BANDS_30);
  }, [eqBands]);

  const applyEQToAudio = useCallback(
    (gainValues: number[]) => {
      AudioEngine.getInstance().updateEQ(gainValues);
      setEQBands(gainValues);
    },
    [setEQBands]
  );

  const handleBandChange = useCallback(
    (index: number, value: number) => {
      const newBands = [...bands];
      newBands[index] = value;
      setBands(newBands);
      setIsCustom(true);
    },
    [bands]
  );

  const handlePresetSelect = useCallback(
    (presetId: AudioEQPreset) => {
      setSelectedPreset(presetId);
      loadEQPreset(presetId);
      setIsCustom(false);
    },
    [loadEQPreset]
  );

  const handleReset = useCallback(() => {
    handlePresetSelect("flat");
  }, [handlePresetSelect]);

  const activePreset = useMemo(() => {
    return EQ_PRESETS_UI.find((p) => p.id === selectedPreset) || null;
  }, [selectedPreset]);

  const displayBands = bands.slice(0, 10);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="text-white text-2xl font-semibold">专业均衡器</h2>
            {activePreset && (
              <span className="px-3 py-1 bg-white/10 rounded-full text-white/80 text-sm">
                {activePreset.icon} {activePreset.name}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 border-b border-white/10">
          <div className="flex items-end justify-center gap-1 h-32">
            {displayBands.map((gain, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div className="relative w-8 h-24 bg-white/5 rounded-lg overflow-hidden">
                  <div
                    className="absolute bottom-1/2 left-0 right-0 bg-gradient-to-t from-purple-500 to-pink-500 transition-all duration-150"
                    style={{
                      height: `${Math.abs(gain) * 5}%`,
                      bottom: gain >= 0 ? "50%" : "auto",
                      top: gain < 0 ? "50%" : "auto",
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white/40 text-xs">
                      {gain > 0 ? "+" : ""}
                      {gain}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-4">
            <span className="text-white/40 text-xs">-12dB</span>
            <span className="text-white/40 text-xs">0dB</span>
            <span className="text-white/40 text-xs">+12dB</span>
          </div>
        </div>

        <div className="p-6 border-b border-white/10">
          <div className="flex justify-between items-end gap-2">
            {displayBands.map((gain, index) => (
              <div key={index} className="flex flex-col items-center gap-3 flex-1">
                <span className="text-white/60 text-xs font-medium">
                  {gain > 0 ? "+" : ""}
                  {gain}dB
                </span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={gain}
                  onChange={(e) => handleBandChange(index, parseInt(e.target.value))}
                  className="writing-mode-vertical h-32 appearance-none bg-transparent cursor-pointer"
                  style={{
                    writingMode: "vertical-lr",
                    direction: "rtl",
                  }}
                />
                <span className="text-white/80 text-sm font-medium">{index * 2 + 1}k</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-b border-white/10">
          <h3 className="text-white font-medium mb-4">预设</h3>
          <div className="grid grid-cols-5 gap-2">
            {EQ_PRESETS_UI.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 ${selectedPreset === preset.id
                    ? "bg-white/20 text-white ring-2 ring-white/30"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <span className="text-xl">{preset.icon}</span>
                <span className="text-xs font-medium">{preset.name}</span>
                <span className="text-xs text-white/50">{preset.nameEn}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors font-medium"
          >
            重置
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-opacity font-medium"
          >
            完成
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none overflow-hidden opacity-30">
          <div className="flex items-end justify-center gap-0.5 h-full">
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full"
                animate={{
                  height: [
                    Math.random() * 40 + 10,
                    Math.random() * 60 + 20,
                    Math.random() * 30 + 5,
                  ],
                }}
                transition={{
                  duration: Math.random() * 0.5 + 0.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
