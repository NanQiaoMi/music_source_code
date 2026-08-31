"use client";

import React, { useState } from "react";
import { AIConfig } from "@/store/aiStore";
import { Network, Plus, Trash2, Shield, Radio, Clock } from "lucide-react";

interface AIAdvancedNetworkTabProps {
  config: AIConfig;
  onUpdate: (updates: Partial<AIConfig>) => void;
}

export const AIAdvancedNetworkTab: React.FC<AIAdvancedNetworkTabProps> = ({
  config,
  onUpdate,
}) => {
  const timeout = config.timeout ?? 30000;
  const stream = config.stream ?? true;
  const customHeaders = config.customHeaders ?? {};

  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");

  const handleAddHeader = () => {
    if (!newHeaderKey.trim()) return;
    const updated = {
      ...customHeaders,
      [newHeaderKey.trim()]: newHeaderValue.trim(),
    };
    onUpdate({ customHeaders: updated });
    setNewHeaderKey("");
    setNewHeaderValue("");
  };

  const handleRemoveHeader = (keyToRemove: string) => {
    const updated = { ...customHeaders };
    delete updated[keyToRemove];
    onUpdate({ customHeaders: updated });
  };

  return (
    <div className="space-y-6">
      {/* 网络与连接选项 */}
      <div className="space-y-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <Network className="w-4 h-4 text-purple-400" />
          <span>网络协议与响应控制</span>
        </div>

        {/* 流式响应开关 */}
        <div className="flex items-center justify-between py-1 border-b border-white/[0.06]">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[12px] font-medium text-white">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>流式传输 (Server-Sent Events / SSE)</span>
            </div>
            <p className="text-[11px] text-white/40">
              逐字流式打字输出，显著降低首字等待感 (TTFT)
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdate({ stream: !stream })}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              stream ? "bg-purple-600" : "bg-white/20"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                stream ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* 请求超时时间 */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <label className="text-[12px] font-medium text-white/80">
                请求超时时间 (Timeout)
              </label>
            </div>
            <span className="text-[12px] font-mono text-purple-300 font-semibold">
              {(timeout / 1000).toFixed(0)} 秒
            </span>
          </div>
          <input
            type="range"
            min="5000"
            max="120000"
            step="5000"
            value={timeout}
            onChange={(e) => onUpdate({ timeout: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 transition-all"
          />
          <div className="flex justify-between text-[10px] text-white/30 font-mono">
            <span>5s (极速超时)</span>
            <span>30s (标准推荐)</span>
            <span>120s (长推理/思考模型)</span>
          </div>
        </div>
      </div>

      {/* 自定义 HTTP 请求头 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <Shield className="w-4 h-4 text-purple-400" />
            <span>自定义 HTTP Headers (高级鉴权与代理透传)</span>
          </div>
          <span className="text-[11px] text-white/40">
            {Object.keys(customHeaders).length} 项已配置
          </span>
        </div>

        {/* 已配置列表 */}
        {Object.keys(customHeaders).length > 0 && (
          <div className="space-y-1.5">
            {Object.entries(customHeaders).map(([key, val]) => (
              <div
                key={key}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[12px] font-mono"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-purple-300 font-medium">{key}:</span>
                  <span className="text-white/60 truncate">{val}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveHeader(key)}
                  className="p-1 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-2 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 添加 Header 表单 */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newHeaderKey}
            onChange={(e) => setNewHeaderKey(e.target.value)}
            placeholder="Header 字段 (如 X-Title)"
            className="w-1/3 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12px] font-mono text-white placeholder-white/25 outline-none focus:border-purple-500/60 transition-all"
          />
          <input
            type="text"
            value={newHeaderValue}
            onChange={(e) => setNewHeaderValue(e.target.value)}
            placeholder="Header 值"
            className="flex-1 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12px] font-mono text-white placeholder-white/25 outline-none focus:border-purple-500/60 transition-all"
          />
          <button
            type="button"
            onClick={handleAddHeader}
            disabled={!newHeaderKey.trim()}
            className={`h-9 px-3 rounded-xl flex items-center gap-1 text-[12px] font-medium transition-all ${
              !newHeaderKey.trim()
                ? "bg-white/[0.04] text-white/30 cursor-not-allowed"
                : "bg-white/[0.08] hover:bg-purple-600 text-white"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加</span>
          </button>
        </div>
      </div>
    </div>
  );
};
