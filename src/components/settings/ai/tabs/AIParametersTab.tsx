"use client";

import React from "react";
import { AIConfig } from "@/store/aiStore";
import { PROMPT_PRESETS } from "../promptPresets";
import { Sliders, Sparkles, Wand2, Info } from "lucide-react";

interface AIParametersTabProps {
  config: AIConfig;
  onUpdate: (updates: Partial<AIConfig>) => void;
}

export const AIParametersTab: React.FC<AIParametersTabProps> = ({ config, onUpdate }) => {
  const temperature = config.temperature ?? 0.7;
  const topP = config.topP ?? 1.0;
  const maxTokens = config.maxTokens ?? 2048;
  const systemPrompt = config.systemPrompt ?? "";

  const getTemperatureBadge = (val: number) => {
    if (val < 0.45) return { label: "严谨求实 · 乐理解析", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
    if (val <= 0.95) return { label: "均衡流畅 · 默认推荐", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    return { label: "诗意发散 · 艺术通感", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" };
  };

  const tempBadge = getTemperatureBadge(temperature);

  return (
    <div className="space-y-6">
      {/* 参数微调滑块区域 */}
      <div className="space-y-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <Sliders className="w-4 h-4 text-purple-400" />
          <span>模型生成动力学参数</span>
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-[12px] font-medium text-white/80">
                Temperature (随机性 / 创造力)
              </label>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${tempBadge.color}`}>
                {tempBadge.label}
              </span>
            </div>
            <span className="text-[12px] font-mono text-purple-300 font-semibold">
              {temperature.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={temperature}
            onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
          />
          <div className="flex justify-between text-[10px] text-white/30 font-mono">
            <span>0.0 (最确定/严谨)</span>
            <span>1.0 (平衡标准)</span>
            <span>2.0 (极致天马行空)</span>
          </div>
        </div>

        {/* Top_P & Max Tokens 并排 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Top_P */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-white/80">
                Top_P (核心采样概率)
              </label>
              <span className="text-[12px] font-mono text-purple-300 font-semibold">
                {topP.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={topP}
              onChange={(e) => onUpdate({ topP: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 transition-all"
            />
          </div>

          {/* Max Tokens */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-white/80">
                Max Output Tokens (最大生成长度)
              </label>
              <span className="text-[12px] font-mono text-purple-300 font-semibold">
                {maxTokens}
              </span>
            </div>
            <input
              type="range"
              min="256"
              max="8192"
              step="256"
              value={maxTokens}
              onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* 音乐专属 Prompt 预设人设 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>音乐场景专属 Prompt 预设人设</span>
          </div>
          <span className="text-[11px] text-white/40">点击一键套用</span>
        </div>

        {/* 预设卡片药丸 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PROMPT_PRESETS.map((preset) => {
            const isApplied = systemPrompt === preset.systemPrompt;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onUpdate({
                    systemPrompt: preset.systemPrompt,
                    temperature: preset.temperature,
                  });
                }}
                className={`p-2.5 rounded-xl border text-left transition-all group ${
                  isApplied
                    ? "bg-purple-500/15 border-purple-500/40 shadow-sm"
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{preset.icon}</span>
                    <span className="text-[12px] font-semibold text-white tracking-tight">
                      {preset.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300/80">
                    T:{preset.temperature}
                  </span>
                </div>
                <p className="text-[10px] text-white/50 line-clamp-1 mt-1">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* System Prompt 自定义文本框 */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-white/70">
              全局 System Prompt (系统人设指令)
            </label>
            {systemPrompt && (
              <button
                type="button"
                onClick={() => onUpdate({ systemPrompt: "" })}
                className="text-[11px] text-white/40 hover:text-white/80 transition-colors"
              >
                清空人设
              </button>
            )}
          </div>
          <textarea
            rows={4}
            value={systemPrompt}
            onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
            placeholder="自定义该模型在 MIMI 播放器中的分析风格、语言习惯与角色设定（留空则采用默认助手设定）..."
            className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12px] leading-relaxed text-white placeholder-white/25 outline-none focus:border-purple-500/60 focus:bg-white/[0.06] transition-all resize-none"
          />
        </div>
      </div>
    </div>
  );
};
