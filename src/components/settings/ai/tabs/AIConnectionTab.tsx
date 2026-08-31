"use client";

import React, { useState } from "react";
import { AIConfig } from "@/store/aiStore";
import { ProviderPreset } from "../types";
import { findPresetById, detectProviderFromUrl } from "../providerPresets";
import { ProviderLogo } from "../ProviderLogo";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCcw,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Layers,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AIConnectionTabProps {
  config: AIConfig;
  onUpdate: (updates: Partial<AIConfig>) => void;
  onFetchModels: () => Promise<string[]>;
  availableModels: string[];
  isFetchingModels: boolean;
}

export const AIConnectionTab: React.FC<AIConnectionTabProps> = ({
  config,
  onUpdate,
  onFetchModels,
  availableModels,
  isFetchingModels,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  const activePreset: ProviderPreset =
    findPresetById(config.providerId) || detectProviderFromUrl(config.baseUrl);

  const handleCopyKey = () => {
    if (!config.apiKey) return;
    navigator.clipboard.writeText(config.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1800);
  };

  const handleBaseUrlBlur = () => {
    let url = config.baseUrl.trim();
    if (!url) return;
    // ensure starts with http:// or https://
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    onUpdate({ baseUrl: url });
  };

  // Combine recommended models with fetched models
  const allModels = Array.from(
    new Set([...(activePreset?.recommendedModels || []), ...availableModels])
  );

  const filteredModels = allModels.filter((m) =>
    m.toLowerCase().includes(modelSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* 顶部服务商情报微卡片 */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08]">
            <ProviderLogo providerId={activePreset.id} size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white tracking-tight">
                {activePreset.name}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.08] text-white/80 border border-white/[0.06]">
                {activePreset.category === "domestic"
                  ? "国内专线"
                  : activePreset.category === "global"
                    ? "国际通用"
                    : activePreset.category === "local"
                      ? "本地私有"
                      : "自定义"}
              </span>
            </div>
            <p className="text-[11px] text-white/50 line-clamp-1 mt-0.5">
              {activePreset.description}
            </p>
          </div>
        </div>

        {activePreset.docUrl && (
          <a
            href={activePreset.docUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
          >
            <span>官方文档</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* 表单字段 */}
      <div className="space-y-4">
        {/* 端点显示名称 */}
        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium text-white/70">
            端点备注名称
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="例如: DeepSeek 旗舰推理 / 个人 GPT-4o"
            className="w-full h-9 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-white/25 outline-none focus:border-purple-500/60 focus:bg-white/[0.06] transition-all"
          />
        </div>

        {/* API Base URL */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[12px] font-medium text-white/70">
              API Base URL (接口基地址)
            </label>
            <button
              type="button"
              onClick={() => onUpdate({ baseUrl: activePreset.baseUrl })}
              className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
            >
              填入官方默认
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => onUpdate({ baseUrl: e.target.value })}
              onBlur={handleBaseUrlBlur}
              placeholder="https://api.openai.com/v1"
              className="w-full h-9 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12px] font-mono text-white placeholder-white/25 outline-none focus:border-purple-500/60 focus:bg-white/[0.06] transition-all"
            />
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[12px] font-medium text-white/70">
              API 密钥 (API Key)
            </label>
            <span className="text-[11px] text-white/40 font-mono">
              {config.apiKey ? `${config.apiKey.length} 字符 · 本地加密存储` : "未填写"}
            </span>
          </div>
          <div className="relative flex items-center">
            <input
              type={showApiKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => onUpdate({ apiKey: e.target.value.trim() })}
              placeholder="sk-..."
              className="w-full h-9 pl-3.5 pr-20 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12px] font-mono text-white placeholder-white/25 outline-none focus:border-purple-500/60 focus:bg-white/[0.06] transition-all"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                title={showApiKey ? "隐藏密钥" : "显示明文"}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleCopyKey}
                className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                title="复制密钥"
              >
                {copiedKey ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 模型选择器 (Combobox & 自动拉取) */}
        <div className="space-y-1.5 relative">
          <div className="flex items-center justify-between">
            <label className="block text-[12px] font-medium text-white/70">
              当前调用模型 (Model Name)
            </label>
            <button
              type="button"
              onClick={onFetchModels}
              disabled={isFetchingModels || !config.apiKey}
              className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
                isFetchingModels || !config.apiKey
                  ? "text-white/30 cursor-not-allowed"
                  : "text-purple-400 hover:text-purple-300"
              }`}
            >
              <RefreshCcw
                className={`w-3 h-3 ${isFetchingModels ? "animate-spin" : ""}`}
              />
              <span>{isFetchingModels ? "正在拉取..." : "拉取可用模型"}</span>
            </button>
          </div>

          <div className="relative">
            <div className="flex items-center">
              <input
                type="text"
                value={config.model}
                onChange={(e) => onUpdate({ model: e.target.value })}
                placeholder="例如: deepseek-chat 或 gpt-4o"
                className="w-full h-9 pl-3.5 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white font-mono placeholder-white/25 outline-none focus:border-purple-500/60 focus:bg-white/[0.06] transition-all"
              />
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="absolute right-2 p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isModelDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* 下拉建议与模型列表 */}
            <AnimatePresence>
              {isModelDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-20 top-full mt-1.5 left-0 right-0 max-h-56 overflow-hidden rounded-2xl bg-[#1e1e22]/95 border border-white/[0.12] shadow-2xl backdrop-blur-2xl flex flex-col"
                >
                  {/* 搜索框 */}
                  <div className="p-2 border-b border-white/[0.06] flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-white/40" />
                    <input
                      type="text"
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      placeholder="过滤模型列表..."
                      className="w-full bg-transparent text-[12px] text-white placeholder-white/30 outline-none"
                      autoFocus
                    />
                  </div>

                  {/* 列表项 */}
                  <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1">
                    {filteredModels.length > 0 ? (
                      filteredModels.map((modelName) => (
                        <button
                          key={modelName}
                          type="button"
                          onClick={() => {
                            onUpdate({ model: modelName });
                            setIsModelDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-[12px] font-mono transition-colors ${
                            config.model === modelName
                              ? "bg-purple-500/20 text-purple-300 font-semibold"
                              : "text-white/80 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          <span className="truncate">{modelName}</span>
                          {config.model === modelName && (
                            <Check className="w-3.5 h-3.5 text-purple-400 ml-2 shrink-0" />
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="py-4 text-center text-[12px] text-white/40">
                        未匹配到模型，可直接在输入框中手动键入
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 推荐快速点选药丸 */}
          {activePreset.recommendedModels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-white/40">推荐预设:</span>
              {activePreset.recommendedModels.map((rm) => (
                <button
                  key={rm}
                  type="button"
                  onClick={() => onUpdate({ model: rm })}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-mono transition-all ${
                    config.model === rm
                      ? "bg-purple-500/25 text-purple-300 border border-purple-500/40"
                      : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                  }`}
                >
                  {rm}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
