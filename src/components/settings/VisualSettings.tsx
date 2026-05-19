"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, RotateCcw, Sliders, Sparkles, X } from "lucide-react";
import {
  usePerformanceV8Store,
  VISUAL_PERFORMANCE_PRESETS,
  type VisualPerformancePreset,
} from "@/store/performanceV8Store";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";

interface VisualSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const visualModes = [
  {
    id: "light" as const,
    name: "Light",
    description: "Fast motion with lighter blur.",
    blur: 10,
    shadow: 10,
    speed: 1.2,
    perspective: 1000,
  },
  {
    id: "heavy" as const,
    name: "Glass",
    description: "Deeper blur and stronger depth.",
    blur: 30,
    shadow: 25,
    speed: 0.8,
    perspective: 600,
  },
  {
    id: "minimal" as const,
    name: "Minimal",
    description: "Lower decoration and faster response.",
    blur: 0,
    shadow: 0,
    speed: 1.5,
    perspective: 1200,
  },
];

function RangeControl({
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-white/80">{label}</span>
        <span className="text-white/60">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
        style={{
          background: `linear-gradient(to right, rgba(255,255,255,0.55) ${percent}%, rgba(255,255,255,0.12) ${percent}%)`,
        }}
      />
    </div>
  );
}

export const VisualSettingsPanel: React.FC<VisualSettingsPanelProps> = ({ isOpen, onClose }) => {
  const {
    blurIntensity,
    shadowDepth,
    animationSpeed,
    perspectiveIntensity,
    visualMode,
    setBlurIntensity,
    setShadowDepth,
    setAnimationSpeed,
    setPerspectiveIntensity,
    setVisualMode,
    resetSettings,
  } = useVisualSettingsStore();
  const { activePreset, config, setPerformancePreset } = usePerformanceV8Store();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, []);

  const handleModeSelect = (mode: (typeof visualModes)[number]) => {
    setVisualMode(mode.id);
    setBlurIntensity(mode.blur);
    setShadowDepth(mode.shadow);
    setAnimationSpeed(mode.speed);
    setPerspectiveIntensity(mode.perspective);
  };

  const handlePerformancePreset = (preset: VisualPerformancePreset) => {
    setPerformancePreset(preset);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.98, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Visual settings</h2>
            <p className="mt-1 text-sm text-white/50">Tune glass depth and visualization load.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close visual settings"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-88px)] overflow-y-auto">
          <div className="border-b border-white/10 p-6">
            <div className="mb-4 flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              <h3 className="font-medium">Visual style</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {visualModes.map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  onClick={() => handleModeSelect(mode)}
                  aria-pressed={visualMode === mode.id}
                  className={`flex min-h-[116px] flex-col items-start gap-2 rounded-xl p-4 text-left transition-all ${
                    visualMode === mode.id
                      ? "bg-white/20 text-white ring-2 ring-white/30"
                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="text-sm font-semibold">{mode.name}</span>
                  <span className="text-xs leading-relaxed text-white/55">{mode.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-white/10 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-white">
                <Gauge className="h-4 w-4 text-emerald-200" />
                <h3 className="font-medium">Performance presets</h3>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/65">
                {config.webglQuality}
              </span>
            </div>

            {prefersReducedMotion && (
              <div className="mb-4 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                Reduced motion is on - visuals will downgrade automatically
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {VISUAL_PERFORMANCE_PRESETS.map((preset) => {
                const isActive = activePreset === preset.id;

                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => handlePerformancePreset(preset.id)}
                    aria-pressed={isActive}
                    className={`min-h-[116px] rounded-xl border p-4 text-left transition ${
                      isActive
                        ? "border-emerald-200/60 bg-emerald-200/15 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div className="text-sm font-semibold">{preset.name}</div>
                    <div className="mt-2 text-xs leading-relaxed text-white/55">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-white/50">Target FPS</div>
                <div className="mt-1 text-xl font-semibold text-white">{config.targetFPS}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-white/50">Particle budget</div>
                <div className="mt-1 text-xl font-semibold text-white">
                  {config.maxParticles.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            <div className="flex items-center gap-2 text-white">
              <Sliders className="h-4 w-4 text-sky-200" />
              <h3 className="font-medium">Custom tuning</h3>
            </div>

            <RangeControl
              label="Blur intensity"
              valueLabel={`${blurIntensity}px`}
              value={blurIntensity}
              min={0}
              max={50}
              onChange={(value) => setBlurIntensity(value)}
            />
            <RangeControl
              label="Shadow depth"
              valueLabel={`${shadowDepth}px`}
              value={shadowDepth}
              min={0}
              max={40}
              onChange={(value) => setShadowDepth(value)}
            />
            <RangeControl
              label="Animation speed"
              valueLabel={`${animationSpeed.toFixed(1)}x`}
              value={animationSpeed}
              min={0.5}
              max={2}
              step={0.1}
              onChange={(value) => setAnimationSpeed(value)}
            />
            <RangeControl
              label="3D perspective"
              valueLabel={`${perspectiveIntensity}px`}
              value={perspectiveIntensity}
              min={400}
              max={1500}
              onChange={(value) => setPerspectiveIntensity(value)}
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-white/10 p-6">
          <button
            type="button"
            onClick={resetSettings}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-medium text-white transition-colors hover:bg-white/20"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-white px-4 py-3 font-medium text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:bg-white/90"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
