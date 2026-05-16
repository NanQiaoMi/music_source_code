"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  GitCompareArrows,
  Layers,
  RotateCcw,
  Save,
  Shuffle,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { AudioEffectType, EFFECT_SCENES, useAudioEffectsStore } from "@/store/audioEffectsStore";

interface AudioEffectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const effectIcons: Partial<Record<AudioEffectType, React.ComponentType<{ className?: string }>>> = {
  reverb: Sparkles,
  stereoWidener: Layers,
  megaBass: Activity,
  autoPan: Shuffle,
  vinyl: RotateCcw,
  phaser: GitCompareArrows,
};

type PanelTab = "presets" | "scenes" | "effects";

export function AudioEffectsPanel({ isOpen, onClose }: AudioEffectsPanelProps) {
  const {
    effects,
    isEnabled,
    setIsEnabled,
    toggleEffect,
    setEffectIntensity,
    resetAllEffects,
    activeScene,
    applyScene,
    clearScene,
    randomize,
    shuffleIntensity,
    savedPresets,
    savePreset,
    loadPreset,
    deletePreset,
    presets,
    activePresetId,
    morphState,
    morphTo,
    setMorphT,
  } = useAudioEffectsStore();

  const [activeTab, setActiveTab] = useState<PanelTab>("presets");
  const [presetName, setPresetName] = useState("");
  const [previousPresetId, setPreviousPresetId] = useState<string | null>(null);

  const activeEffectCount = useMemo(
    () => Object.values(effects).filter((effect) => effect.enabled).length,
    [effects]
  );

  const visibleEffects = useMemo(
    () =>
      Object.values(effects).filter((effect) =>
        ["reverb", "stereoWidener", "megaBass", "autoPan", "vinyl", "phaser"].includes(effect.id)
      ),
    [effects]
  );

  const handleApplyPreset = (presetId: string) => {
    if (activePresetId && activePresetId !== presetId) {
      setPreviousPresetId(activePresetId);
    }
    morphTo(presetId, 800);
  };

  const handleABCompare = () => {
    if (!previousPresetId) return;
    const current = activePresetId;
    morphTo(previousPresetId, 600);
    setPreviousPresetId(current);
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    savePreset(name);
    setPresetName("");
  };

  const tabs: { id: PanelTab; label: string }[] = [
    { id: "presets", label: "Presets" },
    { id: "scenes", label: "Scenes" },
    { id: "effects", label: "Effects" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 210 }}
            className="fixed bottom-0 left-0 right-0 top-16 z-50 flex flex-col border-t border-white/15 bg-black/70 backdrop-blur-2xl"
          >
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col p-6">
              <header className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/15 text-yellow-300">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Audio Effects</h2>
                    <p className="text-xs text-white/45">
                      {activeEffectCount} active effects
                      {activePresetId
                        ? ` - ${presets.find((preset) => preset.id === activePresetId)?.name}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEnabled(!isEnabled)}
                    className={`relative h-8 w-16 rounded-full transition-colors ${
                      isEnabled ? "bg-purple-500" : "bg-white/15"
                    }`}
                    aria-label={isEnabled ? "Disable audio effects" : "Enable audio effects"}
                  >
                    <motion.span
                      animate={{ x: isEnabled ? 34 : 4 }}
                      className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-lg"
                    />
                  </button>
                  <button
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    aria-label="Close audio effects"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </header>

              <nav className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-white/15 text-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {activeTab === "presets" && (
                  <section className="space-y-5">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {presets.map((preset) => {
                        const active = activePresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            onClick={() => handleApplyPreset(preset.id)}
                            disabled={!isEnabled}
                            className={`min-w-36 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-40 ${
                              active
                                ? "border-purple-300/70 bg-purple-400/20 text-white"
                                : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                            }`}
                          >
                            <span className="block text-sm font-semibold">{preset.name}</span>
                            <span className="mt-1 block text-[11px] text-white/40">
                              Reverb {Math.round(preset.reverb * 100)}% / Width{" "}
                              {preset.stereoWidth.toFixed(1)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-white">Morph</h3>
                          <p className="text-xs text-white/40">
                            Blend between the previous preset and the selected target.
                          </p>
                        </div>
                        <button
                          onClick={handleABCompare}
                          disabled={!previousPresetId}
                          className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/15 disabled:opacity-35"
                        >
                          <GitCompareArrows className="h-3.5 w-3.5" />
                          A/B
                        </button>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={morphState?.t ?? (activePresetId ? 1 : 0)}
                        onChange={(event) => setMorphT(Number(event.target.value))}
                        disabled={!morphState}
                        className="h-1.5 w-full appearance-none rounded-full bg-white/10 accent-purple-400 disabled:opacity-40"
                        aria-label="Morph amount"
                      />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Save className="h-4 w-4 text-white/50" />
                        <h3 className="text-sm font-medium text-white">User Presets</h3>
                      </div>
                      <div className="mb-3 flex gap-2">
                        <input
                          value={presetName}
                          onChange={(event) => setPresetName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") handleSavePreset();
                          }}
                          placeholder="Preset name"
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/60"
                        />
                        <button
                          onClick={handleSavePreset}
                          className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-medium text-white"
                        >
                          Save
                        </button>
                      </div>
                      <div className="space-y-2">
                        {savedPresets.length === 0 ? (
                          <p className="py-4 text-center text-sm text-white/35">
                            No saved presets yet.
                          </p>
                        ) : (
                          savedPresets.map((preset) => (
                            <div
                              key={preset.id}
                              className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-2"
                            >
                              <button
                                onClick={() => loadPreset(preset.id)}
                                className="min-w-0 flex-1 text-left text-sm text-white/75"
                              >
                                {preset.name}
                              </button>
                              <button
                                onClick={() => deletePreset(preset.id)}
                                className="rounded-lg p-2 text-white/35 transition-colors hover:bg-red-500/15 hover:text-red-300"
                                aria-label={`Delete ${preset.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {activeTab === "scenes" && (
                  <section className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={randomize}
                        disabled={!isEnabled}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] py-3 text-sm font-medium text-white disabled:opacity-40"
                      >
                        <Shuffle className="h-4 w-4" />
                        Randomize
                      </button>
                      <button
                        onClick={shuffleIntensity}
                        disabled={!isEnabled}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] py-3 text-sm font-medium text-white disabled:opacity-40"
                      >
                        <Sparkles className="h-4 w-4" />
                        Shuffle intensity
                      </button>
                      <button
                        onClick={clearScene}
                        className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white/70"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {EFFECT_SCENES.map((scene) => (
                        <button
                          key={scene.id}
                          onClick={() => applyScene(scene.id)}
                          disabled={!isEnabled}
                          className={`rounded-2xl border p-4 text-left transition-colors disabled:opacity-40 ${
                            activeScene === scene.id
                              ? "border-purple-300/70 bg-purple-400/20"
                              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                          }`}
                        >
                          <span className="text-xs font-semibold text-white/45">{scene.icon}</span>
                          <span className="mt-2 block text-sm font-semibold text-white">
                            {scene.nameZh}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-white/45">
                            {scene.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {activeTab === "effects" && (
                  <section className="space-y-3">
                    {visibleEffects.map((effect) => {
                      const Icon = effectIcons[effect.id] ?? Activity;
                      return (
                        <div
                          key={effect.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleEffect(effect.id)}
                              disabled={!isEnabled}
                              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
                                effect.enabled
                                  ? "bg-purple-500 text-white"
                                  : "bg-white/10 text-white/45"
                              }`}
                              aria-label={`${effect.enabled ? "Disable" : "Enable"} ${effect.name}`}
                            >
                              <Icon className="h-5 w-5" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-medium text-white">{effect.name}</h3>
                              <p className="truncate text-xs text-white/40">{effect.description}</p>
                            </div>
                            <span className="w-12 text-right text-xs tabular-nums text-white/45">
                              {Math.round(effect.intensity * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={effect.intensity}
                            onChange={(event) =>
                              setEffectIntensity(effect.id, Number(event.target.value))
                            }
                            disabled={!isEnabled || !effect.enabled}
                            className="mt-3 h-1.5 w-full appearance-none rounded-full bg-white/10 accent-purple-400 disabled:opacity-35"
                            aria-label={`${effect.name} intensity`}
                          />
                        </div>
                      );
                    })}

                    <button
                      onClick={resetAllEffects}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.08]"
                    >
                      Reset effects
                    </button>
                  </section>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
