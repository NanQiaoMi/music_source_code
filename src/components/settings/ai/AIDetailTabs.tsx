"use client";

import React, { useState } from "react";
import { AIConfig } from "@/store/aiStore";
import { AIConnectionTab } from "./tabs/AIConnectionTab";
import { AIParametersTab } from "./tabs/AIParametersTab";
import { AIPlaygroundTab } from "./tabs/AIPlaygroundTab";
import { AIAdvancedNetworkTab } from "./tabs/AIAdvancedNetworkTab";
import { ProviderLogo } from "./ProviderLogo";
import { findPresetById, detectProviderFromUrl } from "./providerPresets";
import {
  Link2,
  Sliders,
  Terminal,
  Shield,
  RefreshCcw,
  Sparkles,
  Zap,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";

interface AIDetailTabsProps {
  config: AIConfig;
  onUpdate: (updates: Partial<AIConfig>) => void;
  onTestConfig: () => void;
  onFetchModels: () => Promise<string[]>;
  availableModels: string[];
  isFetchingModels: boolean;
  isActive: boolean;
  onActivate: () => void;
}

type TabType = "connection" | "parameters" | "playground" | "network";

const TABS: Array<{ id: TabType; label: string; icon: React.ElementType }> = [
  { id: "connection", label: "连接与模型", icon: Link2 },
  { id: "parameters", label: "参数与人设", icon: Sliders },
  { id: "playground", label: "测试沙盒", icon: Terminal },
  { id: "network", label: "高级网络", icon: Shield },
];

export const AIDetailTabs: React.FC<AIDetailTabsProps> = ({
  config,
  onUpdate,
  onTestConfig,
  onFetchModels,
  availableModels,
  isFetchingModels,
  isActive,
  onActivate,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("connection");

  const preset = findPresetById(config.providerId) || detectProviderFromUrl(config.baseUrl);

  return (
    <div className="flex flex-col h-full bg-white/[0.01]">
      {/* 详情页顶部标题栏与快捷操作 */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-white/[0.06] border border-white/[0.08]">
            <ProviderLogo providerId={preset.id} size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-white tracking-tight">
                {config.name || preset.name}
              </h3>
              {isActive ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" />
                  当前主模型
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onActivate}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] hover:bg-purple-600 text-white/70 hover:text-white transition-colors"
                >
                  设为默认
                </button>
              )}
            </div>
            <p className="text-[11px] font-mono text-white/40 mt-0.5 truncate max-w-xs sm:max-w-md">
              {config.baseUrl} · {config.model || "未指定模型"}
            </p>
          </div>
        </div>

        {/* 顶部快速测速按钮 */}
        <button
          type="button"
          onClick={onTestConfig}
          disabled={config.status === "testing"}
          className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-[12px] font-medium flex items-center gap-1.5 border border-white/[0.08] transition-all active:scale-95"
        >
          <RefreshCcw
            className={`w-3.5 h-3.5 ${config.status === "testing" ? "animate-spin text-amber-400" : "text-purple-400"}`}
          />
          <span>
            {config.status === "testing"
              ? "测速中..."
              : config.status === "online" && config.latency
                ? `已连接 (${config.latency}ms)`
                : "连接测速"}
          </span>
        </button>
      </div>

      {/* 4-Tab 导航栏 */}
      <div className="px-6 border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative py-3 px-3 text-[13px] font-medium flex items-center gap-2 transition-colors ${
                isCurrent ? "text-white font-semibold" : "text-white/50 hover:text-white/80"
              }`}
            >
              <Icon className={`w-4 h-4 ${isCurrent ? "text-purple-400" : "text-white/40"}`} />
              <span>{tab.label}</span>
              {isCurrent && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 选项卡内容区 */}
      <div className="p-6 overflow-y-auto flex-1">
        {activeTab === "connection" && (
          <AIConnectionTab
            config={config}
            onUpdate={onUpdate}
            onFetchModels={onFetchModels}
            availableModels={availableModels}
            isFetchingModels={isFetchingModels}
          />
        )}
        {activeTab === "parameters" && (
          <AIParametersTab config={config} onUpdate={onUpdate} />
        )}
        {activeTab === "playground" && <AIPlaygroundTab config={config} />}
        {activeTab === "network" && (
          <AIAdvancedNetworkTab config={config} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
};
