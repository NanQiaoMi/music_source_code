"use client";

import React, { useState } from "react";
import { AIConfig } from "@/store/aiStore";
import { X, Download, Upload, Copy, Check, AlertTriangle, FileText } from "lucide-react";
import { motion } from "framer-motion";

interface AIImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  configs: AIConfig[];
  onImport: (configs: AIConfig[], mode: "merge" | "overwrite") => void;
}

export const AIImportExportModal: React.FC<AIImportExportModalProps> = ({
  isOpen,
  onClose,
  configs,
  onImport,
}) => {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [includeKeys, setIncludeKeys] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Prepare export payload
  const exportPayload = configs.map((c) => ({
    ...c,
    apiKey: includeKeys ? c.apiKey : c.apiKey ? "sk-••••••••" : "",
    status: "idle",
  }));
  const exportString = JSON.stringify(exportPayload, null, 2);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([exportString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mimi-ai-configs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importJsonText.trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (list.length === 0) {
        setImportError("导入数据为空");
        return;
      }
      onImport(list, importMode);
      onClose();
    } catch {
      setImportError("JSON 格式无效，请检查语法是否正确");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xl select-none font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-xl bg-[#18181b]/95 border border-white/[0.12] rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] text-[#f5f5f7]"
      >
        {/* 顶部标题与 Tab */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setActiveTab("export")}
              className={`px-3 py-1 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "export"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出备份</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("import")}
              className={`px-3 py-1 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "import"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>导入恢复</span>
            </button>
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

        {/* 主体区 */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === "export" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[13px] font-medium text-white">导出包含明文 API Key</div>
                  <div className="text-[11px] text-white/40">
                    关闭时将以掩码脱敏导出，避免密钥泄露
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIncludeKeys(!includeKeys)}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 ${
                    includeKeys ? "bg-amber-600" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                      includeKeys ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {includeKeys && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>导出文件含有真实 API Key，请妥善保管勿公开分享。</span>
                </div>
              )}

              <div className="relative">
                <textarea
                  readOnly
                  rows={8}
                  value={exportString}
                  className="w-full p-3 rounded-xl bg-black/40 border border-white/[0.08] text-[11px] font-mono text-white/80 leading-relaxed outline-none resize-none select-text"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCopyExport}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-[12px] font-medium flex items-center gap-1.5 transition-all"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? "已复制到剪贴板" : "复制 JSON"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载 .json 文件</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-white/80">
                  粘贴导出的 AI 配置 JSON
                </label>
                <textarea
                  rows={7}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder='[ { "name": "...", "baseUrl": "...", "apiKey": "...", "model": "..." } ]'
                  className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-white placeholder-white/20 outline-none focus:border-purple-500/60 transition-all resize-none"
                />
              </div>

              {importError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* 导入模式 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[12px] font-medium text-white">导入策略</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode("merge")}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      importMode === "merge"
                        ? "bg-purple-600 text-white"
                        : "bg-white/[0.06] text-white/50"
                    }`}
                  >
                    合并追加 (推荐)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("overwrite")}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      importMode === "overwrite"
                        ? "bg-rose-600 text-white"
                        : "bg-white/[0.06] text-white/50"
                    }`}
                  >
                    完全覆写
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] text-white/70 text-[12px]"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={!importJsonText.trim()}
                  onClick={handleExecuteImport}
                  className={`px-5 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-all ${
                    !importJsonText.trim()
                      ? "bg-white/[0.06] text-white/30 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-md active:scale-95"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>执行导入</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
