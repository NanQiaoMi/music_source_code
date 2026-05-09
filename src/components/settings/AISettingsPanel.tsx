"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  X,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCcw,
  Globe,
  Key,
  Cpu,
  Activity,
  Zap,
} from "lucide-react";
import { useAIStore, AIConfig } from "@/store/aiStore";
import { useGlassToast } from "@/components/shared/GlassToast";
import { GlassCard } from "@/components/shared/Glass/GlassCard";
import { GlassButton } from "@/components/shared/GlassButton";

interface AISettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AISettingsPanel: React.FC<AISettingsPanelProps> = ({ isOpen, onClose }) => {
  const {
    configs,
    activeConfigId,
    addConfig,
    removeConfig,
    updateConfig,
    setActiveConfig,
    testConfig,
    fetchModels,
  } = useAIStore();

  const { showToast } = useGlassToast();

  const [newConfig, setNewConfig] = useState({
    name: "",
    baseUrl: "https://api.mnapi.com/v1",
    apiKey: "",
    model: "",
  });

  const [isAdding, setIsAdding] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const handleAdd = () => {
    if (!newConfig.name || !newConfig.apiKey) {
      showToast("请填写名称和 API Key", "warning");
      return;
    }
    addConfig(newConfig);
    setNewConfig({ name: "", baseUrl: "https://api.openai.com", apiKey: "", model: "" });
    setIsAdding(false);
    showToast("已添加新配置", "success");
  };

  const handleTest = async (id: string) => {
    const success = await testConfig(id);
    if (success) {
      showToast("连接成功！", "success");
      // If successful, automatically try to fetch models
      handleFetchModels(id);
    } else {
      showToast("连接失败，请检查配置", "error");
    }
  };

  const handleFetchModels = async (id: string) => {
    setIsFetchingModels(true);
    const models = await fetchModels(id);
    setAvailableModels(models);
    setIsFetchingModels(false);

    if (models.length > 0) {
      showToast(`已发现 ${models.length} 个可用模型`, "info");
      // If current model is empty, select the first one
      const config = configs.find((c) => c.id === id);
      if (config && !config.model) {
        updateConfig(id, { model: models[0] });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl max-h-[85vh] flex flex-col"
        >
          <GlassCard className="flex flex-col h-full overflow-hidden border-white/20">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">AI 接口管理</h2>
                  <p className="text-sm text-white/50">管理您的模型分发与连通性</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {/* Config List */}
              <div className="space-y-4">
                {configs.map((config) => (
                  <motion.div
                    key={config.id}
                    layout
                    className={`p-4 rounded-2xl border transition-all ${
                      activeConfigId === config.id
                        ? "bg-white/10 border-purple-500/50"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            config.status === "online"
                              ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                              : config.status === "offline"
                                ? "bg-red-500"
                                : config.status === "testing"
                                  ? "bg-yellow-500 animate-pulse"
                                  : "bg-white/20"
                          }`}
                        />
                        <div>
                          <h3 className="text-white font-medium flex items-center gap-2">
                            {config.name}
                            {activeConfigId === config.id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 border border-purple-500/30">
                                当前使用
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-white/40 font-mono truncate max-w-[200px]">
                            {config.baseUrl}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTest(config.id)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                          title="测试连通性"
                        >
                          <RefreshCcw
                            className={`w-4 h-4 ${config.status === "testing" ? "animate-spin" : ""}`}
                          />
                        </button>
                        <button
                          onClick={() => setActiveConfig(config.id)}
                          className={`p-2 rounded-lg transition-all ${
                            activeConfigId === config.id
                              ? "bg-purple-500 text-white"
                              : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                          }`}
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeConfig(config.id)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/30 uppercase">所选模型</label>
                        <select
                          value={config.model}
                          onChange={(e) => updateConfig(config.id, { model: e.target.value })}
                          className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/80 focus:outline-none"
                        >
                          {!config.model && <option value="">未选择模型</option>}
                          {config.model && <option value={config.model}>{config.model}</option>}
                          {availableModels
                            .filter((m) => m !== config.model)
                            .map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/30 uppercase">最后检测</label>
                        <div className="px-2 py-1.5 text-xs text-white/60">
                          {config.lastTested
                            ? new Date(config.lastTested).toLocaleTimeString()
                            : "从未测试"}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {configs.length === 0 && !isAdding && (
                  <div className="py-12 text-center">
                    <Activity className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40">暂无 API 配置，点击下方按钮添加</p>
                  </div>
                )}
              </div>

              {/* Add Form */}
              {isAdding ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                        <Activity className="w-4 h-4" /> 配置名称
                      </label>
                      <input
                        type="text"
                        value={newConfig.name}
                        onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                        placeholder="例如: OpenAI 官方"
                        className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-purple-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                        <Globe className="w-4 h-4" /> API 地址 (Base URL)
                      </label>
                      <input
                        type="text"
                        value={newConfig.baseUrl}
                        onChange={(e) => setNewConfig({ ...newConfig, baseUrl: e.target.value })}
                        placeholder="https://api.openai.com"
                        className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-purple-500/50 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                        <Key className="w-4 h-4" /> API Key
                      </label>
                      <input
                        type="password"
                        value={newConfig.apiKey}
                        onChange={(e) => setNewConfig({ ...newConfig, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-purple-500/50 outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsAdding(false)}
                      className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAdd}
                      className="flex-1 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-medium transition-all shadow-lg shadow-purple-500/20"
                    >
                      保存配置
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-2 text-white/40 hover:text-white/60 hover:border-white/20 transition-all group"
                >
                  <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>添加新的接口渠道</span>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white/5 border-t border-white/10">
              <div className="flex items-center justify-between text-[10px] text-white/30 uppercase tracking-widest px-2">
                <span>Mimimusic AI Core v1.0</span>
                <span>Powered by OpenAI Compatible Protocol</span>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AISettingsPanel;
