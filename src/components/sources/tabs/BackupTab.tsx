"use client";

import { useState, useCallback } from "react";
import { Download, RotateCcw } from "lucide-react";
import { useSourceConfigStore, PRESET_SCHEMES } from "@/store/sourceConfigStore";

export function BackupTab() {
  const { activePreset, exportConfigJson, importConfigJson, resetToDefaults, applyPreset } =
    useSourceConfigStore();

  const [importJsonText, setImportJsonText] = useState("");
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Copy JSON config
  const handleCopyConfig = useCallback(() => {
    const json = exportConfigJson();
    navigator.clipboard.writeText(json);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }, [exportConfigJson]);

  // Import JSON config
  const handleImportConfig = useCallback(() => {
    if (!importJsonText.trim()) return;
    const ok = importConfigJson(importJsonText);
    if (ok) {
      setImportFeedback("配置方案导入成功！已应用最新音源设置。");
      setImportJsonText("");
    } else {
      setImportFeedback("JSON 格式错误或缺少必填字段，导入失败。");
    }
  }, [importConfigJson, importJsonText]);

  return (
    <>
      {/* TAB 4: 预设方案与备份 */}
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-white mb-2.5">开箱即用预设方案</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRESET_SCHEMES.map((scheme) => {
              const isActive = activePreset === scheme.id;
              return (
                <div
                  key={scheme.id}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                    isActive
                      ? "bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/10"
                      : "bg-white/[0.02] border-white/10"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-white">{scheme.name}</div>
                    <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                      {scheme.description}
                    </p>
                  </div>
                  <button
                    onClick={() => applyPreset(scheme.id)}
                    className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-cyan-500 text-black font-bold"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    }`}
                  >
                    {isActive ? "当前使用中" : "应用此方案"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Export & Import */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white">配置备份与导入导出</h4>
              <p className="text-[11px] text-white/50">
                支持将当前 7 大音源配置方案导出为 JSON 备份
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyConfig}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{copyFeedback ? "已复制到剪贴板！" : "一键导出 JSON"}</span>
              </button>
              <button
                onClick={resetToDefaults}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>恢复出厂设置</span>
              </button>
            </div>
          </div>

          <div>
            <textarea
              rows={3}
              placeholder="粘贴外部 JSON 配置文件并点击导入..."
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 font-mono text-[11px] text-white focus:outline-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-cyan-300">{importFeedback}</span>
              <button
                onClick={handleImportConfig}
                disabled={!importJsonText.trim()}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs disabled:opacity-40 cursor-pointer"
              >
                导入并应用配置
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
