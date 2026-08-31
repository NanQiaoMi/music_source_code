"use client";

import React, { useState } from "react";
import { PROVIDER_PRESETS } from "./providerPresets";
import { ProviderPreset, CategoryFilter } from "./types";
import { ProviderLogo } from "./ProviderLogo";
import { X, Search, Sparkles, Plus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AIProviderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProvider: (preset: ProviderPreset) => void;
}

const CATEGORY_TABS: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "全部厂商" },
  { id: "domestic", label: "国内顶尖" },
  { id: "global", label: "国际先锋" },
  { id: "local", label: "本地私有" },
  { id: "custom", label: "自定义" },
];

export const AIProviderPickerModal: React.FC<AIProviderPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectProvider,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredPresets = PROVIDER_PRESETS.filter((preset) => {
    const matchCategory =
      activeCategory === "all" || preset.category === activeCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchQuery =
      !query ||
      preset.name.toLowerCase().includes(query) ||
      preset.description.toLowerCase().includes(query) ||
      preset.tags.some((t) => t.toLowerCase().includes(query));
    return matchCategory && matchQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xl select-none font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-3xl bg-[#18181b]/95 border border-white/[0.12] rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] text-[#f5f5f7]"
      >
        {/* 顶部标题 */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-white tracking-tight">
                选择大模型服务商预设
              </h3>
              <p className="text-[12px] text-white/50 mt-0.5">
                支持 14+ 顶尖 AI 厂商一键初始化配置与参数模板
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

        {/* 搜索与分类导航 */}
        <div className="px-6 py-3 border-b border-white/[0.06] bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* 分类切换 */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-full sm:w-auto overflow-x-auto">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                  activeCategory === tab.id
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 搜索框 */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索厂商或特性..."
              className="w-full h-8 pl-8 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12px] text-white placeholder-white/30 outline-none focus:border-purple-500/60"
            />
          </div>
        </div>

        {/* 厂商卡片网格 */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredPresets.map((preset) => (
            <motion.button
              key={preset.id}
              type="button"
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onSelectProvider(preset);
                onClose();
              }}
              className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-purple-500/40 text-left transition-all group flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] group-hover:scale-105 transition-transform">
                    <ProviderLogo providerId={preset.id} size={24} />
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-white/70 border border-white/[0.04]">
                    {preset.category === "domestic"
                      ? "国产"
                      : preset.category === "global"
                        ? "国际"
                        : preset.category === "local"
                          ? "本地"
                          : "自定义"}
                  </span>
                </div>

                <h4 className="text-[14px] font-semibold text-white tracking-tight group-hover:text-purple-300 transition-colors">
                  {preset.name}
                </h4>
                <p className="text-[11px] text-white/50 line-clamp-2 mt-1 leading-relaxed">
                  {preset.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-1 mt-3.5 pt-2 border-t border-white/[0.04]">
                {preset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
