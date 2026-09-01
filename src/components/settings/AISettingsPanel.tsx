/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Download,
  Upload,
  RotateCcw,
  ArrowLeft,
  Check,
  Zap,
  Layers,
  HelpCircle,
} from "lucide-react";
import { useAIStore, AIConfig } from "@/store/aiStore";
import { useGlassToast } from "@/components/shared/GlassToast";
import { AIEndpointList } from "./ai/AIEndpointList";
import { AIDetailTabs } from "./ai/AIDetailTabs";
import { AIProviderPickerModal } from "./ai/AIProviderPickerModal";
import { AIImportExportModal } from "./ai/AIImportExportModal";
import { PROVIDER_PRESETS } from "./ai/providerPresets";
import { ProviderPreset } from "./ai/types";

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
    duplicateConfig,
    setActiveConfig,
    importConfigs,
    resetToDefaultConfigs,
    testConfig,
    fetchModels,
  } = useAIStore();

  const { showToast } = useGlassToast();

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isMobileDetailView, setIsMobileDetailView] = useState(false);
  const [isProviderPickerOpen, setIsProviderPickerOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // Initialize selected config
  useEffect(() => {
    if (configs.length > 0) {
      if (!selectedConfigId || !configs.some((c) => c.id === selectedConfigId)) {
        setSelectedConfigId(activeConfigId || configs[0].id);
      }
    } else {
      setSelectedConfigId(null);
    }
  }, [configs, activeConfigId, selectedConfigId]);

  // Selected config reference
  const selectedConfig = configs.find((c) => c.id === selectedConfigId) || configs[0];
  const activeConfig = configs.find((c) => c.id === activeConfigId) || configs[0];

  const handleSelectProvider = (preset: ProviderPreset) => {
    const newId = addConfig({
      name: preset.name,
      providerId: preset.id,
      baseUrl: preset.baseUrl,
      apiKey: "",
      model: preset.defaultModel,
      temperature: 0.7,
      topP: 1.0,
      maxTokens: 2048,
      timeout: 30000,
      stream: true,
    });
    setSelectedConfigId(newId);
    setIsMobileDetailView(true);
    showToast(`已添加 ${preset.name} 端点`, "success");
  };

  const handleTest = async (id: string) => {
    showToast("正在测试接口连通性与网络延迟...", "info");
    const success = await testConfig(id);
    if (success) {
      const cfg = useAIStore.getState().configs.find((c) => c.id === id);
      showToast(`连接成功！响应耗时: ${cfg?.latency ?? 0}ms`, "success");
    } else {
      showToast("连接测试未通过，请检查端点 URL 与 API 密钥", "error");
    }
  };

  const handleFetchModels = async (id: string) => {
    setIsFetchingModels(true);
    const models = await fetchModels(id);
    setAvailableModels(models);
    setIsFetchingModels(false);

    if (models.length > 0) {
      showToast(`已自动拉取 ${models.length} 个可用模型`, "info");
      const target = configs.find((c) => c.id === id);
      if (target && (!target.model || target.model === "deepseek-v4-flash")) {
        updateConfig(id, { model: models[0] });
      }
    } else {
      showToast("未能拉取到模型列表，请确认 API Key 或手动输入模型名称", "warning");
    }
    return models;
  };

  const handleDuplicate = (id: string) => {
    const newId = duplicateConfig(id);
    if (newId) {
      setSelectedConfigId(newId);
      showToast("已成功克隆端点副本", "success");
    }
  };

  const handleDelete = (id: string) => {
    removeConfig(id);
    showToast("已移除该端点配置", "info");
  };

  const handleResetDefaults = () => {
    if (
      confirm(
        "确定要恢复官方推荐商汤 SenseNova 极速多通道 AI 端点配置吗？这将载入 5 大官方高速密钥与多模型容灾池。"
      )
    ) {
      resetToDefaultConfigs();
      showToast("已成功重置并载入 SenseNova 多通道 API 端点矩阵", "success");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-2xl select-none font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-5xl h-[88vh] bg-[#141416]/95 border border-white/[0.12] rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.85),0_0_60px_rgba(168,85,247,0.08)] overflow-hidden flex flex-col text-[#f5f5f7]"
      >
        {/* 顶部全局标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            {/* 移动端详情页返回按钮 */}
            {isMobileDetailView && (
              <button
                type="button"
                onClick={() => setIsMobileDetailView(false)}
                className="md:hidden p-1.5 rounded-xl bg-white/[0.06] text-white hover:bg-white/[0.12] transition-colors mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-700 flex items-center justify-center text-white shadow-[0_2px_12px_rgba(168,85,247,0.4)]">
              <Sparkles className="w-4 h-4" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold text-white tracking-tight">
                  AI 模型与接口设置
                </h3>
                {activeConfig && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    主模型: {activeConfig.name}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-white/50 mt-0.5 tracking-tight">
                配置大语言模型端点、API 密钥、动力学参数与音乐场景人设
              </p>
            </div>
          </div>

          {/* 右侧快捷工具按钮 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportExportOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white text-[12px] font-medium border border-white/[0.08] transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>导入 / 导出</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white text-[12px] font-medium border border-white/[0.08] transition-all"
              title="恢复官方默认端点"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置预设</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 双栏工作区 */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* 左侧端点智能列表 */}
          <div
            className={`w-full md:w-80 md:shrink-0 h-full ${
              isMobileDetailView ? "hidden md:flex flex-col" : "flex flex-col"
            }`}
          >
            <AIEndpointList
              configs={configs}
              activeConfigId={activeConfigId}
              selectedConfigId={selectedConfigId}
              onSelectConfig={(id) => {
                setSelectedConfigId(id);
                setIsMobileDetailView(true);
              }}
              onActivateConfig={(id) => {
                setActiveConfig(id);
                showToast("已切换生效的主 AI 模型", "success");
              }}
              onTestConfig={handleTest}
              onDuplicateConfig={handleDuplicate}
              onDeleteConfig={handleDelete}
              onOpenAddModal={() => setIsProviderPickerOpen(true)}
            />
          </div>

          {/* 右侧详情 4-Tab 工作台 */}
          <div
            className={`w-full flex-1 h-full overflow-hidden ${
              !isMobileDetailView ? "hidden md:flex flex-col" : "flex flex-col"
            }`}
          >
            {selectedConfig ? (
              <AIDetailTabs
                config={selectedConfig}
                onUpdate={(updates) => updateConfig(selectedConfig.id, updates)}
                onTestConfig={() => handleTest(selectedConfig.id)}
                onFetchModels={() => handleFetchModels(selectedConfig.id)}
                availableModels={availableModels}
                isFetchingModels={isFetchingModels}
                isActive={activeConfigId === selectedConfig.id}
                onActivate={() => {
                  setActiveConfig(selectedConfig.id);
                  showToast(`已将 ${selectedConfig.name} 设为主模型`, "success");
                }}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-purple-400 mb-4 shadow-inner">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h4 className="text-[16px] font-semibold text-white">暂未选择或添加 AI 端点</h4>
                <p className="text-[13px] text-white/50 max-w-sm mt-1 mb-6 leading-relaxed">
                  您可以从 14+ 顶尖服务商预设中一键添加 DeepSeek、SenseNova 或 OpenAI 端点。
                </p>
                <button
                  type="button"
                  onClick={() => setIsProviderPickerOpen(true)}
                  className="px-6 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-[13px] font-semibold shadow-[0_4px_20px_rgba(168,85,247,0.35)] transition-all active:scale-95"
                >
                  从预设矩阵中添加
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作与状态指示栏 */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3 text-[12px] text-white/60">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>共 {configs.length} 个端点</span>
            </span>
            {activeConfig && (
              <span className="hidden sm:inline-flex items-center gap-1 text-white/40">
                · 当前活跃: <span className="text-white/80 font-medium">{activeConfig.name}</span>
                {activeConfig.latency && ` (${activeConfig.latency}ms)`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[13px] font-semibold tracking-tight shadow-[0_2px_12px_rgba(168,85,247,0.3)] transition-transform active:scale-[0.96]"
            >
              完成
            </button>
          </div>
        </div>

        {/* 厂商预设快速添加抽屉 */}
        <AIProviderPickerModal
          isOpen={isProviderPickerOpen}
          onClose={() => setIsProviderPickerOpen(false)}
          onSelectProvider={handleSelectProvider}
        />

        {/* 导入 / 导出模态窗 */}
        <AIImportExportModal
          isOpen={isImportExportOpen}
          onClose={() => setIsImportExportOpen(false)}
          configs={configs}
          onImport={(imported, mode) => {
            importConfigs(imported, mode);
            showToast(`已成功导入 ${imported.length} 项配置`, "success");
          }}
        />
      </motion.div>
    </div>
  );
};

export default AISettingsPanel;
