"use client";

import React, { useState } from "react";
import { AIConfig } from "@/store/aiStore";
import { ProviderPreset, CategoryFilter } from "./types";
import { findPresetById, detectProviderFromUrl } from "./providerPresets";
import { ProviderLogo } from "./ProviderLogo";
import {
  Search,
  Plus,
  RefreshCcw,
  Copy,
  Trash2,
  Check,
  Radio,
  Zap,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AIEndpointListProps {
  configs: AIConfig[];
  activeConfigId: string | null;
  selectedConfigId: string | null;
  onSelectConfig: (id: string) => void;
  onActivateConfig: (id: string) => void;
  onTestConfig: (id: string) => void;
  onDuplicateConfig: (id: string) => void;
  onDeleteConfig: (id: string) => void;
  onOpenAddModal: () => void;
}

const CATEGORIES: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "domestic", label: "国产" },
  { id: "global", label: "国际" },
  { id: "local", label: "本地" },
  { id: "custom", label: "自定义" },
];

export const AIEndpointList: React.FC<AIEndpointListProps> = ({
  configs,
  activeConfigId,
  selectedConfigId,
  onSelectConfig,
  onActivateConfig,
  onTestConfig,
  onDuplicateConfig,
  onDeleteConfig,
  onOpenAddModal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const filteredConfigs = configs.filter((c) => {
    const preset = findPresetById(c.providerId) || detectProviderFromUrl(c.baseUrl);
    const matchCategory =
      activeCategory === "all" || preset.category === activeCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchQuery =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.model.toLowerCase().includes(query) ||
      c.baseUrl.toLowerCase().includes(query);
    return matchCategory && matchQuery;
  });

  return (
    <div className="flex flex-col h-full border-r border-white/[0.08] bg-black/20">
      {/* 搜索与分类导航 */}
      <div className="p-3.5 space-y-2 border-b border-white/[0.06]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索端点或模型..."
            className="w-full h-8 pl-8 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[12px] text-white placeholder-white/30 outline-none focus:border-purple-500/60 transition-all"
          />
        </div>

        {/* 分类过滤药丸 */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 ${
                activeCategory === cat.id
                  ? "bg-purple-600/80 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 端点卡片列表 */}
      <div className="p-2.5 overflow-y-auto flex-1 space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredConfigs.map((config) => {
            const isSelected = selectedConfigId === config.id;
            const isActive = activeConfigId === config.id;
            const preset =
              findPresetById(config.providerId) || detectProviderFromUrl(config.baseUrl);

            return (
              <motion.div
                key={config.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                onClick={() => onSelectConfig(config.id)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all relative group ${
                  isSelected
                    ? "bg-white/[0.08] border-purple-500/50 shadow-[0_4px_20px_rgba(168,85,247,0.15)]"
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]"
                }`}
              >
                {/* 活跃发光指示条 */}
                {isActive && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>生效中</span>
                  </div>
                )}

                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] shrink-0 mt-0.5">
                    <ProviderLogo providerId={preset.id} size={18} />
                  </div>

                  <div className="flex-1 min-w-0 pr-12">
                    <h4 className="text-[13px] font-semibold text-white tracking-tight truncate">
                      {config.name || preset.name}
                    </h4>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-white/70 truncate max-w-[120px]">
                        {config.model || preset.defaultModel}
                      </span>

                      {/* 延迟与状态 */}
                      {config.status === "testing" ? (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                          <RefreshCcw className="w-2.5 h-2.5 animate-spin" />
                          测速中
                        </span>
                      ) : config.status === "online" ? (
                        <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,199,89,0.8)]" />
                          {config.latency ? `${config.latency}ms` : "在线"}
                        </span>
                      ) : config.status === "offline" ? (
                        <span className="flex items-center gap-0.5 text-[10px] text-rose-400 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          异常
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[10px] text-white/30 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                          未测试
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 悬浮/操作按钮组 */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04]">
                  {/* 一键启用按钮 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivateConfig(config.id);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                        : "bg-white/[0.06] text-white/60 hover:text-white hover:bg-purple-600"
                    }`}
                  >
                    {isActive ? "已为主模型" : "设为主模型"}
                  </button>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTestConfig(config.id);
                      }}
                      className="p-1 rounded-lg hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors"
                      title="快速测速"
                    >
                      <RefreshCcw
                        className={`w-3 h-3 ${config.status === "testing" ? "animate-spin" : ""}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateConfig(config.id);
                      }}
                      className="p-1 rounded-lg hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors"
                      title="克隆配置"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {configs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConfig(config.id);
                        }}
                        className="p-1 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors"
                        title="删除端点"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredConfigs.length === 0 && (
          <div className="p-6 text-center text-[12px] text-white/40">
            暂无匹配端点，点击下方添加
          </div>
        )}
      </div>

      {/* 底部「+ 添加端点」按钮 */}
      <div className="p-3 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={onOpenAddModal}
          className="w-full h-10 rounded-2xl bg-gradient-to-r from-purple-600/80 to-indigo-600/80 hover:from-purple-500 hover:to-indigo-500 text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(168,85,247,0.25)] hover:shadow-[0_6px_24px_rgba(168,85,247,0.4)] transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>添加新模型端点</span>
        </button>
      </div>
    </div>
  );
};
