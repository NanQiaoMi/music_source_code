"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Sparkles,
  Sliders,
  Gauge,
  X,
} from "lucide-react";
import { EffectPlugin, EffectCategory } from "@/lib/visualization/types";

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
  bounce: 0
};

const ACCORDION_VARIANTS = {
  hidden: { height: 0, opacity: 0 },
  visible: {
    height: "auto",
    opacity: 1,
    transition: APPLE_SPRING_CONFIG
  },
  exit: { height: 0, opacity: 0, transition: APPLE_SPRING_CONFIG }
};

const CONTENT_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delay: 0.1, ...APPLE_SPRING_CONFIG } },
  exit: { opacity: 0, transition: APPLE_SPRING_CONFIG }
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
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={APPLE_SPRING_CONFIG}
        >
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
  const groupedEffects = {
    spectrum: effects.filter((e) => e.category === "spectrum"),
    particles: effects.filter((e) => e.category === "particles"),
  };

  const currentEffect = effects.find((e) => e.id === currentEffectId);
  const currentParams = effectParams[currentEffectId] || {};

  const shouldShowParam = (paramMode: string) => {
    const modeOrder = ["basic", "professional", "expert"];
    return modeOrder.indexOf(paramMode) >= modeOrder.indexOf(parameterMode);
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
            className="fixed right-0 top-0 bottom-0 w-[380px] bg-[#0a0a0c]/80 backdrop-blur-[64px] backdrop-saturate-[180%] border-l border-white/10 z-50 flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                视觉效果
              </h2>
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
                  {Object.entries(groupedEffects).map(([category, categoryEffects]) => {
                    if (!categoryEffects?.length) return null;

                    return (
                      <div key={category}>
                        <div className="text-xs text-white/30 uppercase tracking-wider mb-3 font-medium">
                          {category === "spectrum" ? "频谱与波形" : "粒子效果"}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {categoryEffects.map((effect) => (
                            <button
                              key={effect.id}
                              onClick={() => onEffectSelect(effect.id)}
                              className={`
                                px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                                ${
                                  currentEffectId === effect.id
                                    ? "bg-white text-black shadow-lg"
                                    : "bg-white/[0.08] text-white/70 hover:bg-white/[0.12] hover:text-white"
                                }
                              `}
                            >
                              {effect.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionSection>

              <AccordionSection
                title="参数调节"
                icon={<Sliders className="w-4 h-4" />}
                defaultOpen={true}
              >
                <div className="mb-4">
                  <div className="flex gap-2 p-1 bg-white/[0.05] rounded-xl">
                    {(["basic", "professional", "expert"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onParameterModeChange(mode)}
                        className={`
                          flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all
                          ${
                            parameterMode === mode
                              ? "bg-white text-black shadow-sm"
                              : "text-white/50 hover:text-white"
                          }
                        `}
                      >
                        {mode === "basic" ? "基础" : mode === "professional" ? "专业" : "专家"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  {currentEffect?.parameters
                    .filter((p) => shouldShowParam(p.mode))
                    .map((param) => (
                      <div key={param.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-white/70">
                            {param.name}
                          </label>
                          <span className="text-xs text-white/40 tabular-nums font-medium">
                            {typeof currentParams[param.id] === 'number'
                              ? (currentParams[param.id] ?? param.default).toFixed(
                                  param.step && param.step < 1 ? 2 : 0
                                )
                              : currentParams[param.id] ?? param.default}
                          </span>
                        </div>

                        {param.type === "number" && (
                          <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/60 to-white rounded-full"
                              initial={false}
                              animate={{
                                width: `${((currentParams[param.id] ?? param.default) - (param.min ?? 0)) / ((param.max ?? 100) - (param.min ?? 0)) * 100}%`
                              }}
                              transition={APPLE_SPRING_CONFIG}
                            />
                            <input
                              type="range"
                              min={param.min ?? 0}
                              max={param.max ?? 100}
                              step={param.step ?? 1}
                              value={currentParams[param.id] ?? param.default}
                              onChange={(e) =>
                                onParamChange(
                                  currentEffectId,
                                  param.id,
                                  parseFloat(e.target.value)
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
                                onChange={(e) =>
                                  onParamChange(
                                    currentEffectId,
                                    param.id,
                                    e.target.value
                                  )
                                }
                                className="absolute inset-0 w-full h-full cursor-pointer"
                              />
                            </div>
                            <span className="text-xs text-white/40 font-mono">
                              {currentParams[param.id]}
                            </span>
                          </div>
                        )}

                        {param.type === "boolean" && (
                          <button
                            onClick={() =>
                              onParamChange(
                                currentEffectId,
                                param.id,
                                !currentParams[param.id]
                              )
                            }
                            className={`
                              w-12 h-6 rounded-full transition-all relative
                              ${currentParams[param.id] ? "bg-white" : "bg-white/20"}
                            `}
                          >
                            <motion.div
                              className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-all"
                              animate={{ left: currentParams[param.id] ? "26px" : "2px" }}
                              transition={APPLE_SPRING_CONFIG}
                              style={{ background: currentParams[param.id] ? "#000" : "rgba(255,255,255,0.6)" }}
                            />
                          </button>
                        )}

                        {param.type === "select" && (
                          <select
                            value={currentParams[param.id] ?? param.default}
                            onChange={(e) =>
                              onParamChange(
                                currentEffectId,
                                param.id,
                                e.target.value
                              )
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

                  {currentEffect?.parameters.filter((p) =>
                    shouldShowParam(p.mode)
                  ).length === 0 && (
                    <p className="text-sm text-white/30 text-center py-6">
                      当前模式无可调参数
                    </p>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection
                title="性能监控"
                icon={<Gauge className="w-4 h-4" />}
              >
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
                    <motion.div
                        className="h-1.5 bg-white/10 rounded-full overflow-hidden"
                      >
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                          initial={false}
                          animate={{ width: `${Math.min(100, performanceStats.cpu)}%` }}
                          transition={APPLE_SPRING_CONFIG}
                        />
                      </motion.div>
                  </div>
                ) : (
                  <p className="text-sm text-white/30 text-center py-6">
                    性能数据不可用
                  </p>
                )}
              </AccordionSection>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}