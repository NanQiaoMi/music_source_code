"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioEffectsStore, AudioEffectType } from "@/store/audioEffectsStore";
import {
  X,
  Zap,
  Volume2,
  Waves,
  Mic,
  Music,
  Move,
  FastForward,
  Disc,
  Droplets,
  Disc3,
  Radio,
  Waves as Bass,
  Headphones,
  Circle,
  Mic2,
  Repeat,
  RadioTower,
} from "lucide-react";

interface AudioEffectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const effectIcons: Record<AudioEffectType, React.ComponentType<any>> = {
  autoPan: Move,
  reverb: Waves,
  stereoWidener: Volume2,
  nightcore: FastForward,
  vaporwave: Disc,
  cassette: Disc3,
  tremolo: Waves,
  underwater: Droplets,
  vinyl: Disc3,
  bitcrusher: Circle,
  talkie: RadioTower,
  megaBass: Music,
  asmr: Headphones,
  phaser: Repeat,
  vocalRemove: Mic2,
  cyberpunkDistortion: Zap,
  loFiPhone: Radio,
};

const effectColors: Record<AudioEffectType, string> = {
  autoPan: "from-cyan-500 to-blue-500",
  reverb: "from-purple-500 to-indigo-500",
  stereoWidener: "from-blue-500 to-cyan-500",
  nightcore: "from-pink-500 to-fuchsia-500",
  vaporwave: "from-violet-500 to-purple-500",
  cassette: "from-amber-500 to-yellow-500",
  tremolo: "from-teal-500 to-emerald-500",
  underwater: "from-blue-400 to-indigo-400",
  vinyl: "from-orange-500 to-amber-500",
  bitcrusher: "from-lime-500 to-green-500",
  talkie: "from-rose-500 to-red-500",
  megaBass: "from-green-500 to-emerald-500",
  asmr: "from-fuchsia-500 to-pink-500",
  phaser: "from-indigo-500 to-violet-500",
  vocalRemove: "from-pink-500 to-rose-500",
  cyberpunkDistortion: "from-yellow-400 to-red-500",
  loFiPhone: "from-stone-500 to-amber-700",
};

const CATEGORIES = [
  { id: "环境空间", name: "环境空间" },
  { id: "时域变换", name: "时域变换" },
  { id: "音质质感", name: "音质质感" },
];

export function AudioEffectsPanel({ isOpen, onClose }: AudioEffectsPanelProps) {
  const { effects, isEnabled, setIsEnabled, toggleEffect, setEffectIntensity, resetAllEffects } =
    useAudioEffectsStore();

  const effectsByCategory = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    Object.values(effects).forEach((effect: any) => {
      if (!grouped[effect.category]) {
        grouped[effect.category] = [];
      }
      grouped[effect.category].push(effect);
    });
    return grouped;
  }, [effects]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={onClose}
        />

        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed left-0 right-0 bottom-0 top-16 bg-white/10 backdrop-blur-2xl border-t border-white/20 z-50 flex flex-col"
        >
          <div className="p-6 h-full flex flex-col max-w-6xl mx-auto w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-yellow-400" />
                <h2 className="text-2xl font-bold text-white">音频特效矩阵</h2>
                {!isEnabled && (
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs">
                    已关闭
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-white/5">
              <span className="text-white font-medium">全局特效开关</span>
              <button
                onClick={() => setIsEnabled(!isEnabled)}
                className={`w-14 h-7 rounded-full transition-colors relative ${
                  isEnabled ? "bg-gradient-to-r from-purple-500 to-indigo-500" : "bg-white/20"
                }`}
              >
                <motion.div
                  animate={{ x: isEnabled ? 32 : 4 }}
                  className="absolute top-1.5 w-4 h-4 rounded-full bg-white shadow-lg"
                />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar pb-8 min-h-0">
              {CATEGORIES.map((category) => (
                <div key={category.id} className="space-y-4">
                  <h3 className="text-lg font-semibold text-white/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
                    {category.name}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {effectsByCategory[category.id]?.map((effect) => {
                      const Icon = effectIcons[effect.id as AudioEffectType];
                      const colorGradient = effectColors[effect.id as AudioEffectType];
                      const isDisabled = !isEnabled;

                      return (
                        <motion.div
                          key={effect.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-5 rounded-2xl transition-all border ${
                            effect.enabled
                              ? "bg-white/15 border-white/30 shadow-lg"
                              : "bg-white/5 border-white/10"
                          } ${isDisabled ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorGradient} flex items-center justify-center shadow-md`}
                              >
                                <Icon className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-semibold text-sm truncate">
                                  {effect.name}
                                </h3>
                                <p className="text-white/40 text-xs mt-0.5 line-clamp-2">
                                  {effect.description}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleEffect(effect.id)}
                              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                                effect.enabled ? `bg-gradient-to-r ${colorGradient}` : "bg-white/20"
                              }`}
                            >
                              <motion.div
                                animate={{ x: effect.enabled ? 28 : 4 }}
                                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
                              />
                            </button>
                          </div>

                          {effect.enabled && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              className="mt-3 pt-3 border-t border-white/10"
                            >
                              <div className="flex items-center gap-2">
                                <Volume2 className="w-4 h-4 text-white/40" />
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.01"
                                  value={effect.intensity}
                                  onChange={(e) =>
                                    setEffectIntensity(effect.id, parseFloat(e.target.value))
                                  }
                                  disabled={!effect.enabled || isDisabled}
                                  className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                  style={{
                                    background: `linear-gradient(to right, rgba(255,255,255,0.6) ${
                                      effect.intensity * 100
                                    }%, rgba(255,255,255,0.1) ${effect.intensity * 100}%)`,
                                  }}
                                />
                                <span className="text-white/50 text-xs font-mono w-10 text-right">
                                  {Math.round(effect.intensity * 100)}%
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                onClick={resetAllEffects}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                重置所有特效
              </button>
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
