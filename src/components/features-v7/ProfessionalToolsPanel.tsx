"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { useProfessionalModeStore, PROFESSIONAL_FEATURE_INFO } from "@/store/professionalModeStore";
import { 
  X, 
  Settings, 
  RefreshCw, 
  Activity, 
  Stethoscope, 
  ArrowRightLeft, 
  Scissors, 
  Fingerprint, 
  Disc3, 
  SlidersHorizontal, 
  Bot 
} from "lucide-react";
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

type ToolSection =
  | "overview"
  | "health-check"
  | "format-converter"
  | "cue-cutter"
  | "fingerprint"
  | "ai-settings"
  | "dsd-converter"
  | "crossfade-mixer";

export function ProfessionalToolsPanel({
  isOpen,
  onClose,
  onOpenFormatConverter,
  onOpenTrackCutter,
  onOpenFingerprintScanner,
  onOpenDSDConverter,
  onOpenCrossfadeMixer,
  onOpenLibraryHealth,
}: ProfessionalToolsPanelProps) {
  const { currentView: _currentView } = useUIStore();
  const { isProfessionalMode, enabledFeatures, isFeatureEnabled } = useProfessionalModeStore();
  const [showHealthCheck, setShowHealthCheck] = useState(false);

  const tools = [
    {
      id: "health-check" as ToolSection,
      name: "健康检查",
      icon: <Stethoscope className="w-8 h-8 text-rose-400" />,
      description: "扫描音乐库问题并自动修复，保障数据完整性。",
      enabled: isFeatureEnabled("health-check"),
      action: () => {
        onClose();
        onOpenLibraryHealth();
      },
      colSpan: 2,
      gradient: "from-rose-500/10 to-orange-500/5",
    },
    {
      id: "format-converter" as ToolSection,
      name: "格式转换",
      icon: <ArrowRightLeft className="w-6 h-6 text-blue-400" />,
      description: "极速无损音频格式跨界转换",
      enabled: isFeatureEnabled("format-converter"),
      action: () => {
        onClose();
        onOpenFormatConverter();
      },
      colSpan: 1,
      gradient: "from-blue-500/10 to-cyan-500/5",
    },
    {
      id: "cue-cutter" as ToolSection,
      name: "CUE 切割",
      icon: <Scissors className="w-6 h-6 text-emerald-400" />,
      description: "毫秒级精准的整轨自动拆分",
      enabled: isFeatureEnabled("cue-cutter"),
      action: () => {
        onClose();
        onOpenTrackCutter();
      },
      colSpan: 1,
      gradient: "from-emerald-500/10 to-green-500/5",
    },
    {
      id: "fingerprint" as ToolSection,
      name: "音频指纹",
      icon: <Fingerprint className="w-6 h-6 text-purple-400" />,
      description: "本地高性能声学指纹智能识别",
      enabled: isFeatureEnabled("fingerprint"),
      action: () => {
        onClose();
        onOpenFingerprintScanner();
      },
      colSpan: 1,
      gradient: "from-purple-500/10 to-indigo-500/5",
    },
    {
      id: "dsd-converter" as ToolSection,
      name: "DSD 转换",
      icon: <Disc3 className="w-6 h-6 text-amber-400" />,
      description: "发烧级 DSD 原声无缝解码",
      enabled: true,
      action: () => {
        onClose();
        onOpenDSDConverter();
      },
      colSpan: 1,
      gradient: "from-amber-500/10 to-yellow-500/5",
    },
    {
      id: "crossfade-mixer" as ToolSection,
      name: "淡入淡出",
      icon: <SlidersHorizontal className="w-6 h-6 text-pink-400" />,
      description: "录音室级混音与歌曲过渡效果",
      enabled: true,
      action: () => {
        onClose();
        onOpenCrossfadeMixer();
      },
      colSpan: 1,
      gradient: "from-pink-500/10 to-rose-500/5",
    },
    {
      id: "ai-settings" as ToolSection,
      name: "AI 设置",
      icon: <Bot className="w-6 h-6 text-cyan-400" />,
      description: "神经渲染模型与本地 API 管控",
      enabled: true,
      action: () => {
        onClose();
        useUIStore.getState().openPanel("aiSettings");
      },
      colSpan: 1,
      gradient: "from-cyan-500/10 to-teal-500/5",
    },
  ];

  if (!isOpen) return null;

  if (showHealthCheck) {
    return <HealthCheckPanel isOpen={showHealthCheck} onClose={() => setShowHealthCheck(false)} />;
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95, filter: "blur(20px)" },
    visible: { 
      opacity: 1, 
      scale: 1, 
      filter: "blur(0px)",
      transition: { 
        type: "spring" as const, 
        damping: 30, 
        stiffness: 400,
        staggerChildren: 0.05,
        delayChildren: 0.05
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95, 
      filter: "blur(20px)",
      transition: { duration: 0.25, ease: "easeOut" as const }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: { type: "spring" as const, damping: 25, stiffness: 400 }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        {/* Background Overlay with slow breathing opacity */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-xl pointer-events-auto"
          onClick={onClose}
        />
        
        {/* Main Panel */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/70 backdrop-blur-[64px] shadow-2xl shadow-black/80 pointer-events-auto flex flex-col"
        >
          {/* Ambient Glow Effects (Breathing) */}
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.15, 0.25, 0.15] 
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/30 rounded-full blur-[120px] pointer-events-none" 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1] 
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/30 rounded-full blur-[120px] pointer-events-none" 
          />
          
          {/* Header */}
          <div className="relative flex items-center justify-between p-8 pb-6 border-b border-white/[0.08]">
            <div className="flex items-center gap-5">
              <div className="p-3 bg-white/[0.08] rounded-2xl border border-white/10 shadow-inner backdrop-blur-md">
                <Settings className="w-6 h-6 text-white/90" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">专业工具</h2>
                <p className="text-sm text-white/50 mt-1.5 font-medium">高级音频处理与库管理引擎</p>
              </div>
              {!isProfessionalMode && (
                <span className="ml-4 px-3 py-1.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/20 backdrop-blur-md shadow-inner">
                  未启用
                </span>
              )}
            </div>
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.15)" }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-colors border border-white/10 shadow-sm"
            >
              <X className="w-5 h-5 text-white/70" />
            </motion.button>
          </div>

          {/* Content Area */}
          <div className="relative flex-1 overflow-y-auto p-8 custom-scrollbar">
            {!isProfessionalMode ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-64 text-center"
              >
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-inner backdrop-blur-md"
                >
                  <Activity className="w-10 h-10 text-white/30" />
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">专业模式未启用</h3>
                <p className="text-white/50 max-w-sm leading-relaxed">
                  解锁极致音频处理能力。请在系统设置中开启专业模式以访问所有高级工具与微服务。
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-8">
                {/* Bento Grid Tools */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {tools.map((tool) => (
                    <motion.button
                      key={tool.id}
                      variants={itemVariants}
                      whileHover={tool.enabled ? { scale: 1.02, y: -4 } : {}}
                      whileTap={tool.enabled ? { scale: 0.97 } : {}}
                      onClick={tool.action}
                      disabled={!tool.enabled}
                      className={`
                        relative overflow-hidden text-left group
                        ${tool.colSpan === 2 ? 'md:col-span-2' : 'col-span-1'}
                        ${tool.colSpan === 2 ? 'p-8' : 'p-6'}
                        rounded-[28px] border transition-all duration-400 ease-out
                        ${tool.enabled
                          ? "bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:shadow-2xl hover:shadow-black/40"
                          : "bg-white/[0.01] border-white/5 opacity-50 cursor-not-allowed"
                        }
                      `}
                    >
                      {/* Hover Gradient Background */}
                      {tool.enabled && (
                        <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      )}
                      
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-start justify-between mb-6">
                          <div className={`
                            ${tool.colSpan === 2 ? 'p-4' : 'p-3'} 
                            bg-white/[0.06] rounded-2xl border border-white/10 shadow-inner backdrop-blur-md
                            group-hover:scale-110 group-hover:rotate-3 transition-all duration-400 ease-out
                          `}>
                            {tool.icon}
                          </div>
                          {tool.enabled && (
                            <motion.div 
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" 
                            />
                          )}
                        </div>
                        <div>
                          <h3 className={`${tool.colSpan === 2 ? 'text-2xl' : 'text-lg'} text-white/95 font-bold mb-2 tracking-tight`}>
                            {tool.name}
                          </h3>
                          <p className="text-white/50 text-sm leading-relaxed font-medium">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Enabled Features Pill List */}
                <motion.div 
                  variants={itemVariants}
                  className="p-6 rounded-[28px] bg-white/[0.03] border border-white/[0.08] shadow-inner flex flex-col sm:flex-row sm:items-center justify-between gap-5 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-3 text-white/70 font-semibold tracking-tight">
                    <RefreshCw className="w-5 h-5 animate-[spin_4s_linear_infinite] opacity-60" />
                    已挂载微服务节点
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {Array.from(enabledFeatures).map((feature) => {
                      const info = PROFESSIONAL_FEATURE_INFO[feature];
                      return (
                        <motion.span
                          whileHover={{ scale: 1.05, y: -1 }}
                          key={feature}
                          className="px-4 py-2 rounded-full bg-white/[0.06] text-white/90 text-xs font-medium border border-white/10 flex items-center gap-2 backdrop-blur-md shadow-sm"
                        >
                          <span className="opacity-70">{info.icon}</span> {info.name}
                        </motion.span>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
