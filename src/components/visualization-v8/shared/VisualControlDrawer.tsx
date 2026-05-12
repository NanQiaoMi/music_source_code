"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Gauge, RotateCcw, Search, Sliders, Sparkles, Star, X } from "lucide-react";
import { EffectCategory, EffectPlugin, PerformanceLevel } from "@/lib/visualization/types";
import { usePerformanceV8Store } from "@/store/performanceV8Store";
import { useVisualizationV8Store } from "@/store/visualizationV8Store";

interface VisualControlDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  effects: EffectPlugin[];
  currentEffectId: string;
  onEffectSelect: (effectId: string) => void;
  effectParams: Record<string, Record<string, any>>;
  onParamChange: (effectId: string, paramId: string, value: any) => void;
  parameterMode: "basic" | "professional" | "expert";
  onParameterModeChange: (mode: "basic" | "professional" | "expert") => void;
  performanceStats?: {
    fps: number;
    cpu: number;
    memory: number;
  };
}

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 1,
  bounce: 0,
};

const CONTENT_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delay: 0.1, ...APPLE_SPRING_CONFIG } },
  exit: { opacity: 0, transition: APPLE_SPRING_CONFIG },
};

const categoryLabels: Record<EffectCategory, string> = {
  spectrum: "Spectrum",
  shapes: "Shapes",
  physics: "Physics",
  particles: "Particles",
  geometry: "Geometry",
  space: "Space",
};

function AccordionSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/[0.08]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3 text-white/80">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={APPLE_SPRING_CONFIG}>
          <ChevronDown className="w-4 h-4 text-white/40" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={CONTENT_VARIANTS}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function VisualControlDrawer({
  isOpen,
  onClose,
  effects,
  currentEffectId,
  onEffectSelect,
  effectParams,
  onParamChange,
  parameterMode,
  onParameterModeChange,
  performanceStats,
}: VisualControlDrawerProps) {
  const [effectSearch, setEffectSearch] = useState("");
  const { config, setPerformanceLevel, resetRecoveryState } = usePerformanceV8Store();
  const { favoriteEffects, toggleFavoriteEffect } = useVisualizationV8Store();

  const currentEffect = effects.find((effect) => effect.id === currentEffectId);
  const currentParams = effectParams[currentEffectId] || {};

  const filteredEffects = useMemo(() => {
    const query = effectSearch.trim().toLowerCase();
    if (!query) return effects;

    return effects.filter((effect) =>
      [effect.name, effect.category, effect.description, effect.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [effectSearch, effects]);

  const groupedEffects = useMemo(() => {
    return filteredEffects.reduce(
      (groups, effect) => {
        groups[effect.category] = [...(groups[effect.category] || []), effect];
        return groups;
      },
      {} as Partial<Record<EffectCategory, EffectPlugin[]>>
    );
  }, [filteredEffects]);

  const favoriteEffectObjects = favoriteEffects
    .map((effectId) => effects.find((effect) => effect.id === effectId))
    .filter((effect): effect is EffectPlugin => Boolean(effect));

  const shouldShowParam = (paramMode: string) => {
    const modeOrder = ["basic", "professional", "expert"];
    return modeOrder.indexOf(paramMode) >= modeOrder.indexOf(parameterMode);
  };

  const resetCurrentEffectParams = () => {
    if (!currentEffect) return;

    currentEffect.parameters.forEach((param) => {
      onParamChange(currentEffect.id, param.id, param.default);
    });
  };

  const handlePerformanceLevel = (level: PerformanceLevel) => {
    setPerformanceLevel(level);
    resetRecoveryState();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={APPLE_SPRING_CONFIG}
            className="fixed inset-0 bg-black/50 backdrop-blur-[8px] z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={APPLE_SPRING_CONFIG}
            className="fixed right-0 top-0 bottom-0 w-[380px] max-w-[100vw] bg-[#0a0a0c]/85 backdrop-blur-[64px] backdrop-saturate-[180%] border-l border-white/10 z-50 flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">视觉效果</h2>
                <p className="text-xs text-white/40 mt-1">
                  {currentEffect?.name || "No effect selected"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
              <AccordionSection
                title="效果选择"
                icon={<Sparkles className="w-4 h-4" />}
                defaultOpen={true}
              >
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      value={effectSearch}
                      onChange={(event) => setEffectSearch(event.target.value)}
                      placeholder="Search effects"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.07] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                    />
                  </div>

                  {favoriteEffectObjects.length > 0 && (
                    <div>
                      <div className="text-xs text-white/35 uppercase tracking-wider mb-2 font-medium">
                        Favorites
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {favoriteEffectObjects.map((effect) => (
                          <button
                            key={effect.id}
                            onClick={() => onEffectSelect(effect.id)}
                            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                              currentEffectId === effect.id
                                ? "bg-white text-black"
                                : "bg-white/[0.08] text-white/70 hover:bg-white/[0.14]"
                            }`}
                          >
                            {effect.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.entries(groupedEffects).map(([category, categoryEffects]) => {
                    if (!categoryEffects?.length) return null;

                    return (
                      <div key={category}>
                        <div className="text-xs text-white/35 uppercase tracking-wider mb-3 font-medium">
                          {categoryLabels[category as EffectCategory] || category}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {categoryEffects.map((effect) => {
                            const isCurrent = currentEffectId === effect.id;
                            const isFavorite = favoriteEffects.includes(effect.id);

                            return (
                              <div
                                key={effect.id}
                                className={`group rounded-xl border transition-all ${
                                  isCurrent
                                    ? "border-white/60 bg-white text-black"
                                    : "border-white/10 bg-white/[0.08] text-white/75 hover:bg-white/[0.12] hover:text-white"
                                }`}
                              >
                                <button
                                  onClick={() => onEffectSelect(effect.id)}
                                  className="w-full px-3 pt-3 text-left text-sm font-medium"
                                >
                                  <span className="block truncate">{effect.name}</span>
                                  <span
                                    className={`mt-1 block text-[11px] ${
                                      isCurrent ? "text-black/55" : "text-white/35"
                                    }`}
                                  >
                                    {effect.preferredEngine.toUpperCase()}
                                  </span>
                                </button>
                                <button
                                  onClick={() => toggleFavoriteEffect(effect.id)}
                                  className={`mx-2 mb-2 mt-2 inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
                                    isCurrent
                                      ? "bg-black/10 text-black"
                                      : "bg-white/10 text-white/55 hover:text-white"
                                  }`}
                                  title={isFavorite ? "Remove favorite" : "Add favorite"}
                                >
                                  <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {filteredEffects.length === 0 && (
                    <p className="py-6 text-center text-sm text-white/35">No effects found</p>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection
                title="参数调节"
                icon={<Sliders className="w-4 h-4" />}
                defaultOpen={true}
              >
                <div className="mb-4 space-y-3">
                  <div className="flex gap-2 p-1 bg-white/[0.05] rounded-xl">
                    {(["basic", "professional", "expert"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onParameterModeChange(mode)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          parameterMode === mode
                            ? "bg-white text-black shadow-sm"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        {mode === "basic" ? "基础" : mode === "professional" ? "专业" : "专家"}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={resetCurrentEffectParams}
                    disabled={!currentEffect}
                    className="inline-flex items-center gap-2 rounded-lg bg-white/[0.08] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.14] hover:text-white disabled:opacity-40"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset current effect
                  </button>
                </div>

                <div className="space-y-5">
                  {currentEffect?.parameters
                    .filter((param) => shouldShowParam(param.mode))
                    .map((param) => (
                      <div key={param.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-white/70">{param.name}</label>
                          <span className="text-xs text-white/40 tabular-nums font-medium">
                            {typeof currentParams[param.id] === "number"
                              ? (currentParams[param.id] ?? param.default).toFixed(
                                  param.step && param.step < 1 ? 2 : 0
                                )
                              : (currentParams[param.id] ?? param.default)}
                          </span>
                        </div>

                        {param.type === "number" && (
                          <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/60 to-white rounded-full"
                              initial={false}
                              animate={{
                                width: `${(((currentParams[param.id] ?? param.default) - (param.min ?? 0)) / ((param.max ?? 100) - (param.min ?? 0))) * 100}%`,
                              }}
                              transition={APPLE_SPRING_CONFIG}
                            />
                            <input
                              type="range"
                              min={param.min ?? 0}
                              max={param.max ?? 100}
                              step={param.step ?? 1}
                              value={currentParams[param.id] ?? param.default}
                              onChange={(event) =>
                                onParamChange(
                                  currentEffectId,
                                  param.id,
                                  parseFloat(event.target.value)
                                )
                              }
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                        )}

                        {param.type === "color" && (
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/20">
                              <input
                                type="color"
                                value={currentParams[param.id] ?? param.default}
                                onChange={(event) =>
                                  onParamChange(currentEffectId, param.id, event.target.value)
                                }
                                className="absolute inset-0 w-full h-full cursor-pointer"
                              />
                            </div>
                            <span className="text-xs text-white/40 font-mono">
                              {currentParams[param.id] ?? param.default}
                            </span>
                          </div>
                        )}

                        {param.type === "boolean" && (
                          <button
                            onClick={() =>
                              onParamChange(currentEffectId, param.id, !currentParams[param.id])
                            }
                            className={`w-12 h-6 rounded-full transition-all relative ${
                              currentParams[param.id] ? "bg-white" : "bg-white/20"
                            }`}
                          >
                            <motion.div
                              className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-all"
                              animate={{ left: currentParams[param.id] ? "26px" : "2px" }}
                              transition={APPLE_SPRING_CONFIG}
                              style={{
                                background: currentParams[param.id]
                                  ? "#000"
                                  : "rgba(255,255,255,0.6)",
                              }}
                            />
                          </button>
                        )}

                        {param.type === "select" && (
                          <select
                            value={currentParams[param.id] ?? param.default}
                            onChange={(event) =>
                              onParamChange(currentEffectId, param.id, event.target.value)
                            }
                            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.08] border border-white/10 text-white text-sm appearance-none cursor-pointer"
                          >
                            {param.options?.map((opt) => (
                              <option
                                key={opt.value}
                                value={opt.value}
                                className="bg-[#1c1c1e] text-white"
                              >
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}

                  {currentEffect?.parameters.filter((param) => shouldShowParam(param.mode))
                    .length === 0 && (
                    <p className="text-sm text-white/30 text-center py-6">当前模式没有可调参数</p>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection title="性能控制" icon={<Gauge className="w-4 h-4" />}>
                <div className="space-y-5">
                  <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/[0.05] p-1">
                    {(["low", "medium", "high", "ultra"] as PerformanceLevel[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => handlePerformanceLevel(level)}
                        className={`rounded-lg px-2 py-2 text-xs font-medium capitalize transition ${
                          config.level === level
                            ? "bg-white text-black"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>

                  {performanceStats ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/50">帧率</span>
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            performanceStats.fps >= 55
                              ? "text-emerald-400"
                              : performanceStats.fps >= 30
                                ? "text-amber-400"
                                : "text-rose-400"
                          }`}
                        >
                          {performanceStats.fps.toFixed(0)} FPS
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/50">内存</span>
                        <span className="text-sm text-white/70 tabular-nums font-medium">
                          {performanceStats.memory.toFixed(0)} MB
                        </span>
                      </div>
                      <motion.div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                          initial={false}
                          animate={{ width: `${Math.min(100, performanceStats.cpu || 0)}%` }}
                          transition={APPLE_SPRING_CONFIG}
                        />
                      </motion.div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/30 text-center py-6">性能数据暂不可用</p>
                  )}
                </div>
              </AccordionSection>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
