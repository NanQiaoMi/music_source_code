"use client";

import React, { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAudioEffectsStore,
  AudioEffectType,
  EFFECT_SCENES,
} from "@/store/audioEffectsStore";
import {
  X, Zap, Volume2, Waves, Move, FastForward, Disc, Droplets,
  Disc3, Radio, Circle, Mic2, Repeat, RadioTower, Music,
  Headphones, Shuffle, Save, Trash2, Sparkles, Grid3X3, Layers, Wind,
} from "lucide-react";

interface AudioEffectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const effectIcons: Record<AudioEffectType, React.ComponentType<any>> = {
  autoPan: Move, reverb: Waves, stereoWidener: Volume2,
  nightcore: FastForward, vaporwave: Disc, cassette: Disc3,
  tremolo: Waves, underwater: Droplets, vinyl: Disc3,
  bitcrusher: Circle, talkie: RadioTower, megaBass: Music,
  asmr: Headphones, phaser: Repeat, vocalRemove: Mic2,
  cyberpunkDistortion: Zap, loFiPhone: Radio,
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
  { id: "spatial", name: "环境空间", icon: "🌐" },
  { id: "temporal", name: "时域变换", icon: "☄️" },
  { id: "texture", name: "音质质感", icon: "👅" },
];

type PanelTab = "scenes" | "effects" | "presets";

const XYPad = ({
  x, y, onChange,
}: {
  x: number; y: number;
  onChange: (x: number, y: number) => void;
}) => {
  const padRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current;
      if (!pad) return;
      const rect = pad.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      onChange(nx, 1 - ny);
    },
    [onChange]
  );
  return (
    <div
      ref={padRef}
      className="relative w-full h-40 rounded-2xl overflow-hidden cursor-crosshair border border-white/10 select-none"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, rgba(139,92,246,0.3) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(59,130,246,0.3) 0%, transparent 50%), rgba(0,0,0,0.3)",
      }}
      onPointerDown={(e) => {
        setDragging(true);
        handlePointer(e.clientX, e.clientY);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (dragging) handlePointer(e.clientX, e.clientY);
      }}
      onPointerUp={() => setDragging(false)}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5" />
      </div>
      <span className="absolute top-2 left-3 text-[10px] text-white/30 uppercase tracking-wider">
        空间深度 ↑
      </span>
      <span className="absolute bottom-2 right-3 text-[10px] text-white/30 uppercase tracking-wider">
        声场宽度 →
      </span>
      <motion.div
        className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-white shadow-lg shadow-purple-500/40 pointer-events-none"
        style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
        animate={{ scale: dragging ? 1.3 : 1 }}
      />
      <div
        className="absolute w-24 h-24 -ml-12 -mt-12 rounded-full pointer-events-none opacity-40 blur-xl"
        style={{
          left: `${x * 100}%`,
          top: `${(1 - y) * 100}%`,
          background: "radial-gradient(circle, rgba(168,85,247,0.5), transparent)",
        }}
      />
    </div>
  );
};

export function AudioEffectsPanel({ isOpen, onClose }: AudioEffectsPanelProps) {
  const {
    effects, isEnabled, setIsEnabled, toggleEffect, setEffectIntensity,
    resetAllEffects, activeScene, clearScene, randomize, shuffleIntensity,
    xyX, xyY, setXY, savedPresets, savePreset, loadPreset, deletePreset,
    morphToScene, isMorphing, lfoEnabled, lfoSpeed, lfoDepth,
    toggleLFO, setLFOSpeed, setLFODepth,
  } = useAudioEffectsStore();

  const [activeTab, setActiveTab] = useState<PanelTab>("scenes");
  const [presetName, setPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const activeEffectCount = useMemo(
    () => Object.values(effects).filter((e) => e.enabled).length,
    [effects]
  );

  const effectsByCategory = useMemo(() => {
    const grouped: Record<string, typeof effects[AudioEffectType][]> = {};
    Object.values(effects).forEach((effect) => {
      if (!grouped[effect.category]) grouped[effect.category] = [];
      grouped[effect.category].push(effect);
    });
    return grouped;
  }, [effects]);

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName.trim());
    setPresetName("");
    setShowSaveInput(false);
  };

  const tabs: { id: PanelTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: "scenes", label: "场景预设", icon: Sparkles },
    { id: "effects", label: "特效矩阵", icon: Grid3X3 },
    { id: "presets", label: "我的预设", icon: Layers },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Zap className="w-6 h-6 text-yellow-400" />
                  <h2 className="text-2xl font-bold text-white">音频特效矩阵</h2>
                  {activeEffectCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-xs font-mono">
                      {activeEffectCount} 个活跃
                    </span>
                  )}
                  {!isEnabled && (
                    <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs">已关闭</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEnabled(!isEnabled)}
                    className={`w-14 h-7 rounded-full transition-colors relative ${isEnabled ? "bg-gradient-to-r from-purple-500 to-indigo-500" : "bg-white/20"}`}
                  >
                    <motion.div animate={{ x: isEnabled ? 32 : 4 }} className="absolute top-1.5 w-4 h-4 rounded-full bg-white shadow-lg" />
                  </button>
                  <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "bg-white/15 text-white shadow-lg" : "text-white/50 hover:text-white/80 hover:bg-white/5"}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                <AnimatePresence mode="wait">

                  {activeTab === "scenes" && (
                    <motion.div
                      key="scenes"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div className="flex gap-3">
                        <button onClick={randomize} disabled={!isEnabled}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-white/10 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                          <Shuffle className="w-4 h-4" /> 随机探索
                        </button>
                        <button onClick={shuffleIntensity} disabled={!isEnabled}
                          className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                          <Sparkles className="w-4 h-4" /> 随机强度
                        </button>
                        <button onClick={clearScene} disabled={!isEnabled}
                          className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-medium text-sm transition-all disabled:opacity-40">
                          清除
                        </button>
                      </div>

                      <div>
                        <h3 className="text-white/70 text-sm font-medium mb-3">🎵 XY 效果控制垫</h3>
                        <XYPad x={xyX} y={xyY} onChange={setXY} />
                        <div className="flex justify-between mt-2 text-[10px] text-white/30">
                          <span>声场: {Math.round(xyX * 100)}%</span>
                          <span>空间: {Math.round(xyY * 100)}%</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Wind className="w-4 h-4 text-pink-400" />
                            <span className="text-white/80 text-sm font-medium">LFO 自动呼吸</span>
                          </div>
                          <button onClick={toggleLFO} disabled={!isEnabled}
                            className={`w-12 h-6 rounded-full transition-colors relative ${lfoEnabled ? "bg-gradient-to-r from-pink-500 to-rose-500" : "bg-white/15"} disabled:opacity-40`}>
                            <motion.div animate={{ x: lfoEnabled ? 26 : 3 }} className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md" />
                          </button>
                        </div>
                        <AnimatePresence>
                          {lfoEnabled && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden space-y-3"
                            >
                              <div>
                                <div className="flex justify-between text-xs text-white/50 mb-1">
                                  <span>速度</span>
                                  <span>{lfoSpeed.toFixed(1)} Hz</span>
                                </div>
                                <input type="range" min={0.1} max={2} step={0.1} value={lfoSpeed}
                                  onChange={(e) => setLFOSpeed(parseFloat(e.target.value))}
                                  className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-pink-500" />
                              </div>
                              <div>
                                <div className="flex justify-between text-xs text-white/50 mb-1">
                                  <span>深度</span>
                                  <span>{Math.round(lfoDepth * 100)}%</span>
                                </div>
                                <input type="range" min={0} max={1} step={0.05} value={lfoDepth}
                                  onChange={(e) => setLFODepth(parseFloat(e.target.value))}
                                  className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-pink-500" />
                              </div>
                              <p className="text-[10px] text-white/30">自动周期性波动活跃特效的强度，营造“呼吸感”</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div>
                        <h3 className="text-white/70 text-sm font-medium mb-3">🎬 场景预设</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {EFFECT_SCENES.map((scene) => {
                            const isActive = activeScene === scene.id;
                            return (
                              <motion.button
                                key={scene.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => morphToScene(scene.id)}
                                disabled={!isEnabled || isMorphing}
                                className={`relative p-4 rounded-2xl border text-left transition-all overflow-hidden disabled:opacity-40 ${isActive ? "border-purple-400/50 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/8"}`}
                              >
                                <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${scene.gradient}`} />
                                <div className="relative">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xl">{scene.icon}</span>
                                    <span className="text-white font-medium text-sm">{scene.nameZh}</span>
                                    {isActive && <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                                  </div>
                                  <p className="text-white/40 text-[11px] leading-relaxed">{scene.description}</p>
                                  <div className="flex gap-1 mt-2">
                                    {Object.keys(scene.effects).map((fxId) => (
                                      <span key={fxId} className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-white/50">
                                        {(effects as any)[fxId]?.name ?? fxId}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "effects" && (
                    <motion.div
                      key="effects"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      {CATEGORIES.map((cat) => {
                        const catEffects = effectsByCategory[cat.name] ?? [];
                        if (catEffects.length === 0) return null;
                        return (
                          <div key={cat.id}>
                            <h3 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
                              <span>{cat.icon}</span>{cat.name}
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                              {catEffects.map((effect) => {
                                const Icon = effectIcons[effect.id];
                                const gradient = effectColors[effect.id];
                                return (
                                  <motion.div key={effect.id} layout
                                    className={`p-3 rounded-xl border transition-all ${effect.enabled ? "border-white/20 bg-white/10" : "border-white/5 bg-white/3"}`}>
                                    <div className="flex items-center gap-3">
                                      <button onClick={() => toggleEffect(effect.id)} disabled={!isEnabled}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-gradient-to-br ${gradient} ${effect.enabled ? "opacity-100 shadow-lg" : "opacity-30"} disabled:opacity-20`}>
                                        <Icon className="w-5 h-5 text-white" />
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-white text-sm font-medium truncate">{effect.name}</span>
                                          {effect.enabled && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                                        </div>
                                        <p className="text-white/40 text-[11px] truncate">{effect.description}</p>
                                      </div>
                                    </div>
                                    <AnimatePresence>
                                      {effect.enabled && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                          <div className="pt-3 px-1">
                                            <div className="flex items-center gap-3">
                                              <input type="range" min={0} max={1} step={0.01} value={effect.intensity}
                                                onChange={(e) => setEffectIntensity(effect.id, parseFloat(e.target.value))}
                                                disabled={!isEnabled}
                                                className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-purple-500 disabled:opacity-30" />
                                              <span className="text-white/60 text-xs font-mono w-10 text-right">
                                                {Math.round(effect.intensity * 100)}%
                                              </span>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={() => { resetAllEffects(); clearScene(); }}
                        className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm transition-all">
                        重置所有特效
                      </button>
                    </motion.div>
                  )}

                  {activeTab === "presets" && (
                    <motion.div
                      key="presets"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-4"
                    >
                      {!showSaveInput ? (
                        <button onClick={() => setShowSaveInput(true)} disabled={activeEffectCount === 0}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 border border-white/10 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                          <Save className="w-4 h-4" /> 保存当前预设
                        </button>
                      ) : (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="flex gap-2">
                          <input value={presetName} onChange={(e) => setPresetName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                            placeholder="输入预设名称..." autoFocus
                            className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 outline-none focus:border-purple-400/50" />
                          <button onClick={handleSavePreset} className="px-4 py-3 rounded-xl bg-purple-500 text-white text-sm font-medium">保存</button>
                          <button onClick={() => { setShowSaveInput(false); setPresetName(""); }} className="px-4 py-3 rounded-xl bg-white/10 text-white/60 text-sm">取消</button>
                        </motion.div>
                      )}

                      {savedPresets.length === 0 ? (
                        <div className="text-center py-12 text-white/30">
                          <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p className="text-sm">还没有保存的预设</p>
                          <p className="text-xs mt-1">调整特效后点击“保存当前预设”</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {savedPresets.map((preset) => {
                            const effectCount = Object.values(preset.effects).filter((e) => e?.enabled).length;
                            return (
                              <motion.div key={preset.id} layout
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all">
                                <button onClick={() => loadPreset(preset.id)} className="flex-1 text-left">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{preset.icon}</span>
                                    <span className="text-white text-sm font-medium">{preset.name}</span>
                                    <span className="text-white/30 text-[11px]">{effectCount} 个特效</span>
                                  </div>
                                </button>
                                <button onClick={() => deletePreset(preset.id)}
                                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
