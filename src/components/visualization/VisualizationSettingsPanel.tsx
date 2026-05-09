"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVisualizationStore } from "@/store/visualizationStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { Settings, X, Save, Trash2, Sparkles } from "lucide-react";

interface VisualizationSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingSlider = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onTrackUsage,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onTrackUsage?: () => void;
}) => {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-white/80">{label}</label>
        <span className="text-xs text-white/40 font-mono tabular-nums bg-white/5 px-2 py-0.5 rounded-md">
          {typeof value === "number" ? (Number.isInteger(step) ? value : value.toFixed(1)) : value}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            onChange(parseFloat(e.target.value));
            onTrackUsage?.();
          }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-transparent relative z-10"
          style={{
            background: `linear-gradient(to right, rgba(236,72,153,0.8) ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
          }}
        />
      </div>
    </div>
  );
};

export function VisualizationSettingsPanel({ isOpen, onClose }: VisualizationSettingsPanelProps) {
  const {
    currentEffect,
    effectSettings,
    updateEffectSettings,
    savePreset,
    presets,
    loadPreset,
    deletePreset,
    currentPresetId,
  } = useVisualizationStore();
  const reportUsage = useStatsAchievementsStore((state) => state.reportProToolsUsage);
  const [presetName, setPresetName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  if (!isOpen) return null;

  const handleSavePreset = () => {
    if (presetName.trim()) {
      savePreset(presetName.trim());
      reportUsage("save_preset");
      setPresetName("");
      setShowSaveDialog(false);
    }
  };

  const effectLabels: Record<string, string> = {
    spatialMesh: "流光幻境",
    cyberpunkParticles: "神经之网",
    organicFluid: "生命流体",
    auroraWave: "极光幻影",
    spectrumRing: "频谱奇点",
    nebulaField: "星海漫游",
    vinylGroove: "量子空间",
    cyberMatrix: "赛博矩阵",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute right-0 top-0 bottom-0 w-[340px] bg-black/70 backdrop-blur-[40px] border-l border-white/10 z-50 flex flex-col"
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">可视化设置</h2>
              <p className="text-[10px] text-white/40">
                {effectLabels[currentEffect] || currentEffect}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/15 transition-all"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 min-h-0">
          {/* Effect Params */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> 效果参数
            </h3>

            {currentEffect === "spatialMesh" && (
              <div className="space-y-4">
                <SettingSlider
                  label="流体模糊强度"
                  value={effectSettings.spatialMesh.blurIntensity}
                  min={10}
                  max={200}
                  step={5}
                  onChange={(v) => updateEffectSettings("spatialMesh", { blurIntensity: v })}
                  onTrackUsage={() => reportUsage("visualizer_config")}
                />
                <SettingSlider
                  label="呼吸速度"
                  value={effectSettings.spatialMesh.speed}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("spatialMesh", { speed: v })}
                  onTrackUsage={() => reportUsage("visualizer_config")}
                />
                <SettingSlider
                  label="色彩强度"
                  value={effectSettings.spatialMesh.colorIntensity}
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("spatialMesh", { colorIntensity: v })}
                  onTrackUsage={() => reportUsage("visualizer_config")}
                />
              </div>
            )}

            {currentEffect === "cyberpunkParticles" && (
              <div className="space-y-4">
                <SettingSlider
                  label="粒子数量"
                  value={effectSettings.cyberpunkParticles.particleCount}
                  min={100}
                  max={2000}
                  step={50}
                  onChange={(v) => updateEffectSettings("cyberpunkParticles", { particleCount: v })}
                />
                <SettingSlider
                  label="粒子大小"
                  value={effectSettings.cyberpunkParticles.particleSize}
                  min={0.5}
                  max={10.0}
                  step={0.5}
                  onChange={(v) => updateEffectSettings("cyberpunkParticles", { particleSize: v })}
                />
                <SettingSlider
                  label="发射速度"
                  value={effectSettings.cyberpunkParticles.speed}
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("cyberpunkParticles", { speed: v })}
                />
                <SettingSlider
                  label="发光强度"
                  value={effectSettings.cyberpunkParticles.glowIntensity}
                  min={0.0}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("cyberpunkParticles", { glowIntensity: v })}
                />
              </div>
            )}

            {currentEffect === "organicFluid" && (
              <div className="space-y-4">
                <SettingSlider
                  label="形态复杂度"
                  value={effectSettings.organicFluid.complexity}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("organicFluid", { complexity: v })}
                />
                <SettingSlider
                  label="演化速度"
                  value={effectSettings.organicFluid.speed}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("organicFluid", { speed: v })}
                />
                <SettingSlider
                  label="色彩偏移"
                  value={effectSettings.organicFluid.colorShift}
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  onChange={(v) => updateEffectSettings("organicFluid", { colorShift: v })}
                />
              </div>
            )}

            {currentEffect === "auroraWave" && (
              <div className="space-y-4">
                <SettingSlider
                  label="流动速度"
                  value={effectSettings.auroraWave.speed}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("auroraWave", { speed: v })}
                />
                <SettingSlider
                  label="色彩强度"
                  value={effectSettings.auroraWave.colorIntensity}
                  min={0.2}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("auroraWave", { colorIntensity: v })}
                />
                <SettingSlider
                  label="核心复杂度"
                  value={effectSettings.auroraWave.coreComplexity}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("auroraWave", { coreComplexity: v })}
                />
                <SettingSlider
                  label="镜头光晕"
                  value={effectSettings.auroraWave.flareAmount}
                  min={0.0}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("auroraWave", { flareAmount: v })}
                />
                <SettingSlider
                  label="界面细节"
                  value={effectSettings.auroraWave.hudDetail}
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("auroraWave", { hudDetail: v })}
                />
              </div>
            )}
            {currentEffect === "spectrumRing" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/80 font-medium">光环形态 / Halo Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: 0, label: "棱镜" },
                      { v: 1, label: "星尘" },
                      { v: 2, label: "液态" },
                    ].map((m) => (
                      <button
                        key={m.v}
                        onClick={() => updateEffectSettings("spectrumRing", { haloStyle: m.v })}
                        className={`py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${effectSettings.spectrumRing.haloStyle === m.v ? "bg-pink-500/30 text-pink-300 border border-pink-500/40" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <SettingSlider
                  label="光环层数"
                  value={effectSettings.spectrumRing.ringCount}
                  min={1}
                  max={5}
                  step={1}
                  onChange={(v) => updateEffectSettings("spectrumRing", { ringCount: v })}
                />
                <SettingSlider
                  label="旋转速度"
                  value={effectSettings.spectrumRing.rotationSpeed}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("spectrumRing", { rotationSpeed: v })}
                />
                <SettingSlider
                  label="频率条宽"
                  value={effectSettings.spectrumRing.barWidth}
                  min={1.0}
                  max={8.0}
                  step={0.5}
                  onChange={(v) => updateEffectSettings("spectrumRing", { barWidth: v })}
                />
                <SettingSlider
                  label="镜头光晕"
                  value={effectSettings.spectrumRing.flareAmount}
                  min={0.0}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("spectrumRing", { flareAmount: v })}
                />
                <SettingSlider
                  label="色差强度"
                  value={effectSettings.spectrumRing.chromaticIntensity}
                  min={0.0}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("spectrumRing", { chromaticIntensity: v })}
                />
                <SettingSlider
                  label="界面细节"
                  value={effectSettings.spectrumRing.hudDetail}
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("spectrumRing", { hudDetail: v })}
                />
                <div className="space-y-2">
                  <label className="text-sm text-white/80">配色方案</label>
                  <div className="flex gap-2">
                    {[
                      { v: 0, label: "彩虹" },
                      { v: 1, label: "冰蓝" },
                    ].map((m) => (
                      <button
                        key={m.v}
                        onClick={() => updateEffectSettings("spectrumRing", { colorMode: m.v })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${effectSettings.spectrumRing.colorMode === m.v ? "bg-pink-500/30 text-pink-300 border border-pink-500/40" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentEffect === "nebulaField" && (
              <div className="space-y-4">
                <SettingSlider
                  label="星星数量"
                  value={effectSettings.nebulaField.starCount}
                  min={200}
                  max={1500}
                  step={50}
                  onChange={(v) => updateEffectSettings("nebulaField", { starCount: v })}
                />
                <SettingSlider
                  label="星云强度"
                  value={effectSettings.nebulaField.nebulaIntensity}
                  min={0.2}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("nebulaField", { nebulaIntensity: v })}
                />
                <SettingSlider
                  label="漂移速度"
                  value={effectSettings.nebulaField.speed}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("nebulaField", { speed: v })}
                />
                <SettingSlider
                  label="深度感"
                  value={effectSettings.nebulaField.depth}
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("nebulaField", { depth: v })}
                />
                <SettingSlider
                  label="镜头光晕"
                  value={effectSettings.nebulaField.flareAmount}
                  min={0.0}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("nebulaField", { flareAmount: v })}
                />
                <SettingSlider
                  label="界面细节"
                  value={effectSettings.nebulaField.hudDetail}
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("nebulaField", { hudDetail: v })}
                />
              </div>
            )}

            {currentEffect === "vinylGroove" && (
              <div className="space-y-4">
                <SettingSlider
                  label="旋转速度"
                  value={effectSettings.vinylGroove.spinSpeed}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("vinylGroove", { spinSpeed: v })}
                />
                <SettingSlider
                  label="核心形变"
                  value={effectSettings.vinylGroove.grooveIntensity}
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("vinylGroove", { grooveIntensity: v })}
                />
                <SettingSlider
                  label="光学效果"
                  value={effectSettings.vinylGroove.opticalComplexity}
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("vinylGroove", { opticalComplexity: v })}
                />
                <SettingSlider
                  label="色差强度"
                  value={effectSettings.vinylGroove.chromaticIntensity}
                  min={0.0}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("vinylGroove", { chromaticIntensity: v })}
                />
                <SettingSlider
                  label="整体发光"
                  value={effectSettings.vinylGroove.glowAmount}
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("vinylGroove", { glowAmount: v })}
                />
              </div>
            )}

            {currentEffect === "cyberMatrix" && (
              <div className="space-y-4">
                <SettingSlider
                  label="下落速度"
                  value={effectSettings.cyberMatrix.speed}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("cyberMatrix", { speed: v })}
                />
                <SettingSlider
                  label="矩阵密度"
                  value={effectSettings.cyberMatrix.density}
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("cyberMatrix", { density: v })}
                />
              </div>
            )}

            {currentEffect === "prismPulse" && (
              <div className="space-y-4">
                <SettingSlider
                  label="几何复杂度"
                  value={effectSettings.prismPulse.complexity}
                  min={3}
                  max={12}
                  step={1}
                  onChange={(v) => updateEffectSettings("prismPulse", { complexity: v })}
                  onTrackUsage={() => reportUsage("visualizer_config")}
                />
                <SettingSlider
                  label="折射强度"
                  value={effectSettings.prismPulse.refraction}
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("prismPulse", { refraction: v })}
                  onTrackUsage={() => reportUsage("visualizer_config")}
                />
                <SettingSlider
                  label="色彩漂移"
                  value={effectSettings.prismPulse.drift}
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("prismPulse", { drift: v })}
                  onTrackUsage={() => reportUsage("visualizer_config")}
                />
                <SettingSlider
                  label="变换速度"
                  value={effectSettings.prismPulse.speed}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => updateEffectSettings("prismPulse", { speed: v })}
                  onTrackUsage={() => reportUsage("visualizer_config")}
                />
              </div>
            )}
          </div>

          {/* Presets */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              预设管理
            </h3>

            <button
              onClick={() => setShowSaveDialog(!showSaveDialog)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 border border-pink-500/20 text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存当前设置
            </button>

            {showSaveDialog && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="space-y-2 overflow-hidden"
              >
                <input
                  type="text"
                  placeholder="输入预设名称..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-pink-500/50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePreset}
                    className="flex-1 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-all"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm transition-all"
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            )}

            {presets.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-white/30">已保存的预设</h4>
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      currentPresetId === preset.id
                        ? "bg-pink-500/20 border border-pink-500/30"
                        : "bg-white/5 border border-transparent hover:bg-white/10"
                    }`}
                  >
                    <button
                      onClick={() => loadPreset(preset.id)}
                      className="flex-1 text-left text-sm text-white/80 hover:text-white transition-colors"
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-white/30 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
