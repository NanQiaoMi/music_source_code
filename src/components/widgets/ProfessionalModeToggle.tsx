"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Zap, ChevronRight, Check } from "lucide-react";
import {
  useProfessionalModeStore,
  PROFESSIONAL_FEATURE_INFO,
  ProfessionalFeature,
} from "@/store/professionalModeStore";

interface ProfessionalModeToggleProps {
  className?: string;
}

export const ProfessionalModeToggle: React.FC<ProfessionalModeToggleProps> = ({
  className = "",
}) => {
  const { isProfessionalMode, toggleMode, showModeSwitchAnimation } = useProfessionalModeStore();

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleMode}
      className={`
        relative overflow-hidden
        px-4 py-2 rounded-xl
        ${
          isProfessionalMode
            ? "bg-gradient-to-r from-purple-600 to-blue-600"
            : "bg-white/10 hover:bg-white/20"
        }
        text-white font-medium
        border border-white/20
        shadow-lg hover:shadow-xl
        transition-all duration-300
        ${className}
      `}
    >
      <AnimatePresence>
        {showModeSwitchAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-white/30 rounded-xl"
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-2">
        {isProfessionalMode ? (
          <>
            <Zap className="w-4 h-4" />
            <span className="text-sm">专业模式</span>
          </>
        ) : (
          <>
            <Settings className="w-4 h-4" />
            <span className="text-sm">普通模式</span>
          </>
        )}
      </div>
    </motion.button>
  );
};

interface ProfessionalModePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfessionalModePanel: React.FC<ProfessionalModePanelProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    isProfessionalMode,
    setProfessionalMode,
    enabledFeatures,
    toggleFeature,
    resetToDefaults,
  } = useProfessionalModeStore();

  const [showFeatureList, setShowFeatureList] = useState(false);

  const allFeatures = Object.keys(PROFESSIONAL_FEATURE_INFO) as ProfessionalFeature[];

  return (
    <AnimatePresence>
      {isOpen && (
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
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] bg-white/10 backdrop-blur-3xl rounded-3xl border border-white/20 m-4 overflow-hidden flex flex-col"
          >
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white">专业模式设置</h2>
                <button
                  onClick={onClose}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 min-h-0">
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-semibold mb-1">专业模式</h3>
                        <p className="text-white/60 text-sm">启用发烧友专业功能</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setProfessionalMode(!isProfessionalMode)}
                        className={`
                          relative w-14 h-8 rounded-full transition-colors duration-300
                          ${isProfessionalMode ? "bg-purple-600" : "bg-white/20"}
                        `}
                      >
                        <motion.div
                          initial={false}
                          animate={{ x: isProfessionalMode ? 24 : 4 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                        />
                      </motion.button>
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => setShowFeatureList(!showFeatureList)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="text-left">
                        <h3 className="text-white font-semibold mb-1">功能管理</h3>
                        <p className="text-white/60 text-sm">自定义启用的专业功能</p>
                      </div>
                      <motion.div
                        animate={{ rotate: showFeatureList ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="w-5 h-5 text-white/60" />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {showFeatureList && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar min-h-0">
                            {allFeatures.map((feature) => {
                              const info = PROFESSIONAL_FEATURE_INFO[feature];
                              const isEnabled = enabledFeatures.has(feature);

                              return (
                                <motion.button
                                  key={feature}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => toggleFeature(feature)}
                                  disabled={!isProfessionalMode}
                                  className={`
                                    w-full flex items-center gap-4 p-4 rounded-xl
                                    ${
                                      isEnabled && isProfessionalMode
                                        ? "bg-purple-600/20 border-purple-500/50"
                                        : "bg-white/5 border-white/10"
                                    }
                                    border transition-all duration-200
                                    ${!isProfessionalMode ? "opacity-50 cursor-not-allowed" : ""}
                                  `}
                                >
                                  <div className="text-2xl">{info.icon}</div>
                                  <div className="flex-1 text-left">
                                    <div className="text-white font-medium">{info.name}</div>
                                    <div className="text-white/60 text-sm">{info.description}</div>
                                  </div>
                                  {isEnabled && isProfessionalMode && (
                                    <Check className="w-5 h-5 text-purple-400" />
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={resetToDefaults}
                      className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                    >
                      重置默认
                    </button>
                    <button
                      onClick={onClose}
                      className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
                    >
                      确定
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};