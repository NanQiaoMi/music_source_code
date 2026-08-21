/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, RefreshCcw, Sparkles, Key, Zap, Check, ChevronDown } from "lucide-react";
import { useAIStore } from "@/store/aiStore";
import { useGlassToast } from "@/components/shared/GlassToast";

interface AISettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({ isOpen, onClose }) => {
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
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "",
  });

  const [isAdding, setIsAdding] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [_isFetchingModels, setIsFetchingModels] = useState(false);

  const handleAdd = () => {
    if (!newConfig.name || !newConfig.apiKey) {
      showToast("请填写名称和 API Key", "warning");
      return;
    }
    addConfig(newConfig);
    setNewConfig({ name: "", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "" });
    setIsAdding(false);
    showToast("已添加新 AI 配置", "success");
  };

  const handleTest = async (id: string) => {
    const success = await testConfig(id);
    if (success) {
      showToast("连接成功！", "success");
      handleFetchModels(id);
    } else {
      showToast("连接失败，请检查端点与密钥", "error");
    }
  };

  const handleFetchModels = async (id: string) => {
    setIsFetchingModels(true);
    const models = await fetchModels(id);
    setAvailableModels(models);
    setIsFetchingModels(false);

    if (models.length > 0) {
      showToast(`已发现 ${models.length} 个可用模型`, "info");
      const config = configs.find((c) => c.id === id);
      if (config && !config.model) {
        updateConfig(id, { model: models[0] });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-md select-none font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-xl bg-[#1c1c1e]/95 rounded-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.6)] border border-white/[0.08] overflow-hidden flex flex-col max-h-[88vh] text-[#f5f5f7]"
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-white tracking-[-0.016em] leading-tight">
                AI 模型与接口设置
              </h3>
              <p className="text-[12px] text-[#86868b] mt-0.5 tracking-tight">
                配置大语言模型端点、API 密钥与智能分析服务
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 主体滚动区 */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-left">
          {/* 配置列表 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                已配置的服务端点 ({configs.length})
              </span>
              <button
                type="button"
                onClick={() => setIsAdding(!isAdding)}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2997ff] hover:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAdding ? "收起添加" : "添加端点"}
              </button>
            </div>

            {/* 新增端点表单 */}
            <AnimatePresence>
              {isAdding && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-3 overflow-hidden"
                >
                  <div className="text-[13px] font-semibold text-white">新增服务配置</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="配置名称 (如 OpenAI)"
                      value={newConfig.name}
                      onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                      className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] text-white outline-none focus:border-[#0071e3]"
                    />
                    <input
                      placeholder="Base URL"
                      value={newConfig.baseUrl}
                      onChange={(e) => setNewConfig({ ...newConfig, baseUrl: e.target.value })}
                      className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] text-white outline-none focus:border-[#0071e3]"
                    />
                  </div>
                  <input
                    type="password"
                    placeholder="API Key (sk-...)"
                    value={newConfig.apiKey}
                    onChange={(e) => setNewConfig({ ...newConfig, apiKey: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] text-white outline-none focus:border-[#0071e3]"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-4 py-1.5 rounded-full bg-white/10 text-white/70 text-[12px]"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleAdd}
                      className="px-5 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[12px] font-semibold shadow-sm"
                    >
                      保存端点
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 端点卡片列表 */}
            <div className="space-y-2.5">
              {configs.map((config) => {
                const isActive = activeConfigId === config.id;
                return (
                  <div
                    key={config.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isActive
                        ? "bg-[#0071e3]/10 border-[#0071e3] shadow-[0_2px_12px_rgba(0,113,227,0.15)]"
                        : "bg-white/[0.04] border-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            config.status === "online"
                              ? "bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.6)]"
                              : config.status === "offline"
                                ? "bg-rose-500"
                                : "bg-white/30"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-[14px] font-semibold text-white tracking-tight">
                              {config.name}
                            </h4>
                            {isActive && (
                              <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-[#0071e3]/20 text-[#2997ff] border border-[#0071e3]/30">
                                当前启用
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-[#86868b] truncate max-w-[240px] mt-0.5">
                            {config.baseUrl}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTest(config.id)}
                          className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                          title="测试连通性"
                        >
                          <RefreshCcw
                            className={`w-3.5 h-3.5 ${config.status === "testing" ? "animate-spin" : ""}`}
                          />
                        </button>
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => setActiveConfig(config.id)}
                            className="px-3 py-1 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[11px] font-medium transition-transform active:scale-[0.96]"
                          >
                            启用
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2997ff] px-2.5 py-1 rounded-full bg-[#0071e3]/15">
                            <Check className="w-3 h-3" />
                            使用中
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeConfig(config.id)}
                          className="p-2 rounded-lg bg-white/[0.06] hover:bg-rose-500/20 text-white/50 hover:text-rose-400 transition-colors"
                          title="删除配置"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-semibold tracking-tight shadow-sm transition-transform active:scale-[0.96]"
          >
            完成
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AISettingsPanel;
