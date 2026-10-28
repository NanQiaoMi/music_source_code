"use client";

import { useState, useCallback } from "react";
import { Download, RotateCcw } from "lucide-react";
import { useSourceConfigStore, PRESET_SCHEMES } from "@/store/sourceConfigStore";
import { useLiveStoreValue } from "@/hooks/useLiveStoreValue";
import { ErrorBanner } from "@/components/ui/settings";
import { EmptyState, LoadingSkeleton } from "@/components/shared/Glass";

interface BackupTabProps {
  /** 预设/备份数据拉取中。缺省（undefined）时保持原有渲染，由外壳 Task 10 接线。 */
  loading?: boolean;
  /** 拉取失败文案。缺省时不渲染错误态。 */
  error?: string | null;
  /** 错误态「重试」回调。缺省时按钮仍渲染但为空操作。 */
  onRetry?: () => void;
}

export function BackupTab({ loading, error, onRetry }: BackupTabProps = {}) {
  // 逐个订阅本组件用到的字段；动作是稳定引用。
  const activePreset = useSourceConfigStore((state) => state.activePreset);
  const exportConfigJson = useSourceConfigStore((state) => state.exportConfigJson);
  const importConfigJson = useSourceConfigStore((state) => state.importConfigJson);
  const resetToDefaults = useSourceConfigStore((state) => state.resetToDefaults);
  const applyPreset = useSourceConfigStore((state) => state.applyPreset);
  // 音源表用 SSR-live 选择器读「此刻」的 store：renderToStaticMarkup 下 zustand
  // 原生 hook 的服务端快照取自 getInitialState，空态判据会失真（S6-10b）。
  const sources = useLiveStoreValue(useSourceConfigStore, (state) => state.sources);

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

  // 三态分派（优先级 loading > 横幅 + （空态 | 正常）），全部由可选 props / 本组件 sources 推导。
  // 错误不再阻断：横幅可与空态或正常备份面板同时出现。
  if (loading) {
    return (
      <div data-skeleton="true" className="space-y-3">
        <LoadingSkeleton count={4} variant="card" />
      </div>
    );
  }

  const errorBanner = error ? <ErrorBanner message={error} onRetry={onRetry} /> : null;

  if (Object.keys(sources).length === 0) {
    return (
      <>
        {errorBanner}
        <EmptyState
          title="还没有任何可用音源"
          description="恢复默认配置后即可套用预设方案并导出备份"
          actionLabel="恢复默认"
          onAction={resetToDefaults}
        />
      </>
    );
  }

  return (
    <>
      {errorBanner}
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
