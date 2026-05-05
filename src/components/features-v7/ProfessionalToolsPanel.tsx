"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { useProfessionalModeStore, PROFESSIONAL_FEATURE_INFO } from "@/store/professionalModeStore";
import { X, Settings, RefreshCw, FileAudio, Music, Activity } from "lucide-react";
import { HealthCheckPanel } from "./HealthCheckPanel";

interface ProfessionalToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFormatConverter: () => void;
  onOpenTrackCutter: () => void;
  onOpenFingerprintScanner: () => void;
  onOpenDSDConverter: () => void;
  onOpenCrossfadeMixer: () => void;
  onOpenLibraryHealth: () => void;
}

type ToolSection = "overview" | "health-check" | "format-converter" | "cue-cutter" | "fingerprint" | "ai-settings";

export function ProfessionalToolsPanel({ 
  isOpen, 
  onClose,
  onOpenFormatConverter,
  onOpenTrackCutter,
  onOpenFingerprintScanner,
  onOpenDSDConverter,
  onOpenCrossfadeMixer,
  onOpenLibraryHealth
}: ProfessionalToolsPanelProps) {
  const { currentView } = useUIStore();
  const { isProfessionalMode, enabledFeatures, isFeatureEnabled } = useProfessionalModeStore();
  const [activeSection, setActiveSection] = useState<ToolSection>("overview");
  const [showHealthCheck, setShowHealthCheck] = useState(false);

  const tools = [
    {
      id: "health-check" as ToolSection,
      name: "健康检查",
      icon: "🏥",
      description: "扫描音乐库问题并修复",
      enabled: isFeatureEnabled("health-check"),
      action: () => {
        onClose();
        onOpenLibraryHealth();
      },
    },
    {
      id: "format-converter" as ToolSection,
      name: "格式转换",
      icon: "🔄",
      description: "无损音频格式转换",
      enabled: isFeatureEnabled("format-converter"),
      action: () => {
        onClose();
        onOpenFormatConverter();
      },
    },
    {
      id: "cue-cutter" as ToolSection,
      name: "CUE 切割",
      icon: "✂️",
      description: "整轨音频自动拆分",
      enabled: isFeatureEnabled("cue-cutter"),
      action: () => {
        onClose();
        onOpenTrackCutter();
      },
    },
    {
      id: "fingerprint" as ToolSection,
      name: "音频指纹",
      icon: "🔍",
      description: "本地音频指纹识别",
      enabled: isFeatureEnabled("fingerprint"),
      action: () => {
        onClose();
        onOpenFingerprintScanner();
      },
    },
    {
      id: "dsd-converter" as ToolSection,
      name: "DSD 转换",
      icon: "🎵",
      description: "DSD 音频格式转换",
      enabled: true,
      action: () => {
        onClose();
        onOpenDSDConverter();
      },
    },
    {
      id: "crossfade-mixer" as ToolSection,
      name: "淡入淡出",
      icon: "🎚️",
      description: "歌曲淡入淡出混合",
      enabled: true,
      action: () => {
        onClose();
        onOpenCrossfadeMixer();
      },
    },
    {
      id: "ai-settings" as ToolSection,
      name: "AI 设置",
      icon: "🤖",
      description: "管理 AI 接口与模型检测",
      enabled: true,
      action: () => {
        onClose();
        useUIStore.getState().openPanel("aiSettings");
      },
    },
  ];

  if (!isOpen) return null;

  if (showHealthCheck) {
    return <HealthCheckPanel isOpen={showHealthCheck} onClose={() => setShowHealthCheck(false)} />;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 300 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 300 }}
        transition={{ duration: 0.3 }}
        className="fixed left-0 right-0 bottom-0 top-20 bg-black/95 backdrop-blur-2xl border-t border-white/20 rounded-t-3xl z-50"
      >
        <div className="p-6 h-full flex flex-col max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold text-white">专业工具</h2>
              {!isProfessionalMode && (
                <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs">
                  普通模式
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {!isProfessionalMode ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Activity className="w-16 h-16 text-white/30 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">专业模式未启用</h3>
                <p className="text-white/60 mb-6 max-w-md">
                  请在设置中启用专业模式以使用高级音频处理功能
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tools.map((tool) => (
                  <motion.button
                    key={tool.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={tool.action}
                    disabled={!tool.enabled}
                    className={`p-6 rounded-2xl border transition-all text-left ${
                      tool.enabled
                        ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                        : "bg-white/2 border-white/5 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{tool.icon}</div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold mb-1">{tool.name}</h3>
                        <p className="text-white/60 text-sm">{tool.description}</p>
                      </div>
                      {tool.enabled && (
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {isProfessionalMode && (
              <div className="mt-8 p-6 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  已启用的专业功能
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from(enabledFeatures).map((feature) => {
                    const info = PROFESSIONAL_FEATURE_INFO[feature];
                    return (
                      <span
                        key={feature}
                        className="px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-300 text-sm border border-purple-500/30"
                      >
                        {info.icon} {info.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
