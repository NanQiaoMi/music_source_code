"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Radio,
  Sliders,
  Code2,
  Activity,
  Download,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Sparkles,
  Zap,
  HardDrive,
  Globe,
  Settings2,
  KeyRound,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  useSourceConfigStore,
  PRESET_SCHEMES,
} from "@/store/sourceConfigStore";
import {
  MusicSourceId,
  QualityTier,
  LXCustomScript,
} from "@/types/sourceConfig";
import { LXRunner } from "@/lib/sources/lxRunner";
import { useNetworkAudioCache } from "@/hooks/useNetworkAudioCache";
import { getAllCachedAudioMeta, CachedNetworkAudioMeta } from "@/services/networkAudioCache";
import { useAudioStore } from "@/store/audioStore";

const QUALITY_OPTIONS: { value: QualityTier; label: string; tag: string }[] = [
  { value: "auto", label: "自适应最高 (Auto)", tag: "AUTO" },
  { value: "hires", label: "母带 Hi-Res / DSD", tag: "HI-RES" },
  { value: "flac", label: "无损 FLAC (96k/24bit)", tag: "FLAC" },
  { value: "320k", label: "极高品 320kbps", tag: "320K" },
  { value: "128k", label: "标准 128kbps (省流)", tag: "128K" },
];

export function SourceManagementModal() {
  const {
    sources,
    lxScripts,
    activePreset,
    resolutionMode,
    isManagementModalOpen,
    activeManagementTab,
    setResolutionMode,
    toggleSource,
    setSourceConfig,
    setSourceQuality,
    setSourcePriority,
    setSourceCredentials,
    updateAllHealth,
    addLXScript,
    updateLXScript,
    removeLXScript,
    toggleLXScript,
    syncBuiltinDesktopSources,
    applyPreset,
    exportConfigJson,
    importConfigJson,
    resetToDefaults,
    closeManagementModal,
    setActiveManagementTab,
  } = useSourceConfigStore();

  useEffect(() => {
    syncBuiltinDesktopSources();
  }, [syncBuiltinDesktopSources]);

  // Local states
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseMessage, setDiagnoseMessage] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState("");
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // New script modal form state
  const [showAddScript, setShowAddScript] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [newScriptAuthor, setNewScriptAuthor] = useState("");
  const [newScriptUrl, setNewScriptUrl] = useState("");
  const [newScriptCode, setNewScriptCode] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingScript, setIsTestingScript] = useState(false);

  // Run full health check
  const handleRunDiagnose = useCallback(async () => {
    setIsDiagnosing(true);
    setDiagnoseMessage("正在向 7 大音源端点发起并发测速与连通性诊断...");
    try {
      const res = await fetch("/api/sources/diagnose");
      const data = await res.json();
      if (data.health) {
        updateAllHealth(data.health);
        setDiagnoseMessage("体检完成！所有音源连通性已更新至最新状态。");
      } else {
        setDiagnoseMessage("诊断返回异常，请重试。");
      }
    } catch {
      setDiagnoseMessage("诊断请求失败，请检查网络环境。");
    } finally {
      setIsDiagnosing(false);
    }
  }, [updateAllHealth]);

  // Test custom script
  const handleTestScript = useCallback(async () => {
    setIsTestingScript(true);
    setTestResult(null);
    let codeToTest = newScriptCode;

    if (newScriptUrl && !newScriptCode) {
      try {
        const res = await fetch(`/api/sources/lx?url=${encodeURIComponent(newScriptUrl)}`);
        const json = await res.json();
        if (json.content) {
          codeToTest = json.content;
          setNewScriptCode(json.content);
        } else {
          setTestResult({ success: false, message: `拉取订阅失败: ${json.message}` });
          setIsTestingScript(false);
          return;
        }
      } catch (e: any) {
        setTestResult({ success: false, message: `网络请求失败: ${e.message}` });
        setIsTestingScript(false);
        return;
      }
    }

    const res = await LXRunner.testScript(codeToTest);
    setTestResult(res);
    setIsTestingScript(false);
  }, [newScriptCode, newScriptUrl]);

  // Add new script
  const handleSaveNewScript = useCallback(() => {
    if (!newScriptName.trim()) return;
    addLXScript({
      name: newScriptName.trim(),
      author: newScriptAuthor.trim() || "自定义开发者",
      version: "1.0.0",
      description: newScriptUrl ? `订阅源: ${newScriptUrl}` : "本地自定义扩展脚本",
      scriptUrl: newScriptUrl.trim() || undefined,
      scriptContent: newScriptCode.trim() || undefined,
      enabled: true,
      supportedActions: ["search", "songUrl", "lyric", "pic"],
    });
    setShowAddScript(false);
    setNewScriptName("");
    setNewScriptAuthor("");
    setNewScriptUrl("");
    setNewScriptCode("");
    setTestResult(null);
  }, [addLXScript, newScriptName, newScriptAuthor, newScriptUrl, newScriptCode]);

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

  const sourceList = useMemo(() => Object.values(sources), [sources]);

  if (!isManagementModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeManagementModal}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0f1d]/95 border border-white/15 rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden flex flex-col backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 flex items-center justify-center shadow-inner">
                <Radio className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-wide">
                    全网多音源矩阵与扩展中心
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Matrix v2.0
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  精细管理 7 大官方音源、洛雪自定义 JS 脚本与并行抢答策略
                </p>
              </div>
            </div>

            <button
              onClick={closeManagementModal}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div
            className="flex items-center gap-2 px-6 py-2.5 bg-white/[0.01] border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar scrollbar-hide select-none"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            {[
              { id: "matrix", label: "音源矩阵控制台", icon: Sliders },
              { id: "lx_scripts", label: "洛雪 / 自定义脚本", icon: Code2 },
              { id: "diagnostics", label: "一键健康诊断", icon: Activity },
              { id: "offline_cache", label: "离线缓存管理", icon: Download },
              { id: "backup", label: "预设方案与备份", icon: HardDrive },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeManagementTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveManagementTab(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-white text-black font-semibold shadow-lg shadow-white/10"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-black" : "text-white/60"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            {/* TAB 1: 音源矩阵控制台 */}
            {activeManagementTab === "matrix" && (
              <div className="space-y-5">
                {/* 🚀 解析链路通道选择器 */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/30 to-purple-950/30 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-inner">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-bold text-white">核心播放链路模式</span>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      选择歌曲播放时的底层音源嗅探与解析策略
                    </p>
                  </div>

                  <div className="flex items-center bg-black/50 border border-white/10 p-1 rounded-2xl shrink-0">
                    <button
                      type="button"
                      onClick={() => setResolutionMode("hybrid_racing")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        resolutionMode === "hybrid_racing"
                          ? "bg-gradient-to-r from-cyan-500/80 to-blue-500/80 text-white shadow-md shadow-cyan-500/25 border border-cyan-400/40"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      <span>⚡</span>
                      <span>通道一：全网智能聚合竞速</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setResolutionMode("lx_only")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        resolutionMode === "lx_only"
                          ? "bg-gradient-to-r from-purple-500/80 to-pink-500/80 text-white shadow-md shadow-purple-500/25 border border-purple-400/40"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      <span>📜</span>
                      <span>通道二：纯粹落雪音源专属</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50 font-medium">
                    已启用 {sourceList.filter((s) => s.enabled).length} / {sourceList.length} 个音源通道
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRunDiagnose}
                      disabled={isDiagnosing}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isDiagnosing ? "animate-spin" : ""}`} />
                      <span>实时测速</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {sourceList.map((src) => {
                    const isEnabled = src.enabled;
                    return (
                      <div
                        key={src.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isEnabled
                            ? "bg-white/[0.04] border-white/20 shadow-md"
                            : "bg-white/[0.01] border-white/5 opacity-60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${src.dotColor} shadow-sm`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">{src.name}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${src.badgeColor}`}
                                >
                                  {src.badgeName}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/45 mt-0.5 line-clamp-1">
                                {src.description}
                              </p>
                            </div>
                          </div>

                          {/* Switch toggle */}
                          <button
                            type="button"
                            onClick={() => toggleSource(src.id)}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                              isEnabled ? "bg-cyan-500" : "bg-white/15"
                            }`}
                          >
                            <motion.div
                              layout
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              className={`w-4 h-4 rounded-full bg-white absolute top-1 shadow-md ${
                                isEnabled ? "right-1" : "left-1"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Config Controls */}
                        {isEnabled && (
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                            <div>
                              <label className="text-[10px] text-white/40 block mb-1">音质偏好</label>
                              <select
                                value={src.qualityPreference}
                                onChange={(e) =>
                                  setSourceQuality(src.id, e.target.value as QualityTier)
                                }
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none cursor-pointer"
                              >
                                {QUALITY_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value} className="bg-[#121626]">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-white/40 block mb-1">抢答优先级 (1-10)</label>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={src.priority}
                                onChange={(e) =>
                                  setSourcePriority(src.id, parseInt(e.target.value, 10) || 1)
                                }
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                              />
                            </div>

                            <div className="col-span-2">
                              <label className="text-[10px] text-white/40 block mb-1">
                                自定义镜像 / 反代 API 基址 (可选)
                              </label>
                              <input
                                type="text"
                                placeholder="留空使用默认服务端代理 (如 https://proxy.music.com)"
                                value={src.customApiBase}
                                onChange={(e) =>
                                  setSourceConfig(src.id, { customApiBase: e.target.value })
                                }
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-[11px] focus:outline-none placeholder-white/25"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: 洛雪 / 自定义脚本 */}
            {activeManagementTab === "lx_scripts" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      洛雪 / 自定义 JS 脚本扩展引擎
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {lxScripts.length} 个音源
                      </span>
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      支持执行洛雪 (LX Music) 自定义源脚本与标准 JavaScript 解析器
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await syncBuiltinDesktopSources();
                        alert("🎉 已成功载入并同步本地桌面 4 套音源库（独家v4.0、聚合9.3特供版、野草、野花）！");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
                      title="从桌面音源目录一键刷新并载入最新脚本"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>同步本地 4 大音源</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAddScript(true)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>添加扩展源</span>
                    </button>
                  </div>
                </div>

                {/* Script Add Modal */}
                {showAddScript && (
                  <div className="p-4 rounded-2xl bg-white/[0.05] border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300">新建自定义音源脚本</span>
                      <button
                        onClick={() => setShowAddScript(false)}
                        className="text-white/50 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-white/50 block mb-1">源名称 *</label>
                        <input
                          type="text"
                          placeholder="例如: 六音无损源 v2"
                          value={newScriptName}
                          onChange={(e) => setNewScriptName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/50 block mb-1">作者 / 版本</label>
                        <input
                          type="text"
                          placeholder="例如: LX Dev / 1.0.0"
                          value={newScriptAuthor}
                          onChange={(e) => setNewScriptAuthor(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-white/50 block mb-1">
                        在线订阅 URL (支持 GitHub / Gitee Raw 链接)
                      </label>
                      <input
                        type="text"
                        placeholder="https://raw.githubusercontent.com/.../custom_source.js"
                        value={newScriptUrl}
                        onChange={(e) => setNewScriptUrl(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-white/50 block mb-1">
                        本地 JavaScript 代码
                      </label>
                      <textarea
                        rows={4}
                        placeholder="module.exports = { search: async function(kw) { ... } };"
                        value={newScriptCode}
                        onChange={(e) => setNewScriptCode(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 font-mono text-[11px] text-emerald-300 focus:outline-none"
                      />
                    </div>

                    {testResult && (
                      <div
                        className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                          testResult.success
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{testResult.message}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={handleTestScript}
                        disabled={isTestingScript}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>{isTestingScript ? "正在测试..." : "测试运行"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewScript}
                        disabled={!newScriptName.trim()}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs disabled:opacity-40 cursor-pointer"
                      >
                        保存并启用
                      </button>
                    </div>
                  </div>
                )}

                {/* Script List */}
                <div className="space-y-3">
                  {lxScripts.map((script) => (
                    <div
                      key={script.id}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Code2 className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{script.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/10 text-white/70">
                              v{script.version}
                            </span>
                            <span className="text-[10px] text-white/40">作者: {script.author}</span>
                          </div>
                          <p className="text-xs text-white/50 mt-1">{script.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleLXScript(script.id)}
                          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                            script.enabled ? "bg-cyan-500" : "bg-white/15"
                          }`}
                        >
                          <motion.div
                            layout
                            className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 ${
                              script.enabled ? "right-1" : "left-1"
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => removeLXScript(script.id)}
                          className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 flex items-center justify-center transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: 一键健康诊断 */}
            {activeManagementTab === "diagnostics" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">多音源全链路健康体检仪</h3>
                    <p className="text-xs text-white/60 mt-0.5">
                      毫秒级测试每个音源的实时网络延迟与可用状态
                    </p>
                  </div>
                  <button
                    onClick={handleRunDiagnose}
                    disabled={isDiagnosing}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                  >
                    <Activity className={`w-4 h-4 ${isDiagnosing ? "animate-pulse" : ""}`} />
                    <span>{isDiagnosing ? "诊断中..." : "一键全面体检"}</span>
                  </button>
                </div>

                {diagnoseMessage && (
                  <div className="text-xs text-cyan-300/90 px-1">{diagnoseMessage}</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sourceList.map((src) => {
                    const health = src.health || { status: "untested", latencyMs: 0 };
                    const isNormal = health.status === "normal";
                    const isDegraded = health.status === "degraded";
                    const isError = health.status === "error";

                    return (
                      <div
                        key={src.id}
                        className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${src.dotColor}`} />
                          <div>
                            <div className="text-xs font-semibold text-white">{src.name}</div>
                            <div className="text-[10px] text-white/40">{health.message || "就绪"}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {health.latencyMs > 0 && (
                            <span className="font-mono text-xs text-white/80">
                              {health.latencyMs} ms
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                              isNormal
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : isDegraded
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : isError
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                : "bg-white/10 text-white/60 border-white/10"
                            }`}
                          >
                            {isNormal && <CheckCircle2 className="w-3 h-3" />}
                            {isDegraded && <AlertTriangle className="w-3 h-3" />}
                            {isError && <XCircle className="w-3 h-3" />}
                            {isNormal ? "优质" : isDegraded ? "良好" : isError ? "异常" : "未测试"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: 预设方案与备份 */}
            {activeManagementTab === "backup" && (
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
                      <p className="text-[11px] text-white/50">支持将当前 7 大音源配置方案导出为 JSON 备份</p>
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
            )}

            {/* TAB 5: 离线缓存管理 */}
            {activeManagementTab === "offline_cache" && (
              <OfflineCacheTab />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function OfflineCacheTab() {
  const { stats, clearAllCache, deleteSongCache, refreshStats } = useNetworkAudioCache();
  const [cachedSongs, setCachedSongs] = useState<CachedNetworkAudioMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadSongs = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getAllCachedAudioMeta();
      setCachedSongs(list.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt));
    } catch {
      setCachedSongs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return cachedSongs;
    const q = searchQuery.toLowerCase();
    return cachedSongs.filter(
      (s) =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.artist && s.artist.toLowerCase().includes(q))
    );
  }, [cachedSongs, searchQuery]);

  const handleDelete = async (songId: string, source: string) => {
    await deleteSongCache(songId, source);
    await loadSongs();
  };

  const handleClearAll = async () => {
    if (window.confirm("确定要清空所有本地离线音频缓存吗？清空后再次播放将重新联网下载。")) {
      await clearAllCache();
      await loadSongs();
    }
  };

  const handlePlaySong = (item: CachedNetworkAudioMeta) => {
    const src = item.source || "netease";
    useAudioStore.getState().playSong({
      id: item.songId,
      title: item.title || "未知歌曲",
      artist: item.artist || "未知艺术家",
      album: item.album,
      duration: item.duration || 0,
      cover: item.cover,
      source: src as any,
      audioUrl: `cached://${src}/${item.songId}`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-white/50 font-medium">已缓存歌曲总数</div>
            <div className="text-xl font-bold text-white tracking-tight">
              {stats.count} <span className="text-xs font-normal text-white/40">首</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-white/50 font-medium">占用本地磁盘</div>
            <div className="text-xl font-bold text-white tracking-tight">
              {stats.totalSizeMB} <span className="text-xs font-normal text-white/40">MB / 4000 MB</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-white/50 font-medium">离线播放特性</div>
            <div className="text-sm font-semibold text-purple-300">
              0ms 秒开 · 自动 LRU
            </div>
          </div>
        </div>
      </div>

      {/* Action Header & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            placeholder="搜索已缓存的歌名或歌手..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-xs bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/50"
          />
          <button
            onClick={() => { refreshStats(); loadSongs(); }}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            title="刷新列表"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {stats.count > 0 && (
          <button
            onClick={handleClearAll}
            className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer font-medium self-end sm:self-auto border border-rose-500/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空全部离线缓存</span>
          </button>
        )}
      </div>

      {/* Cached Songs List */}
      <div className="border border-white/10 rounded-2xl bg-white/[0.01] overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-white/40 text-xs gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>正在读取本地 IndexedDB 缓存数据库...</span>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="py-12 text-center text-white/40 text-xs space-y-1">
            <p>暂无已缓存的网络歌曲</p>
            <p className="text-[11px] text-white/30">播放网络歌曲后，系统会自动在后台完成二进制无损缓存</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto custom-scrollbar">
            {filteredSongs.map((item) => {
              const sizeMB = item.fileSize ? (item.fileSize / 1024 / 1024).toFixed(1) : "0.0";
              const cachedTimeStr = item.cachedAt ? new Date(item.cachedAt).toLocaleDateString() : "未知时间";
              const displaySource = (item.source || "NET").toUpperCase();
              const displayFormat = item.fileType?.split("/")[1]?.toUpperCase() || "MP3";

              return (
                <div
                  key={item.cacheKey || `${item.source || "cache"}:${item.songId}`}
                  className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => handlePlaySong(item)}
                      className="w-8 h-8 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center transition-transform hover:scale-105 shrink-0 cursor-pointer"
                      title="立即离线播放"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">{item.title || "未知曲目"}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/60 font-mono">
                          {displaySource}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 font-mono">
                          {displayFormat}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/50 truncate flex items-center gap-2 mt-0.5">
                        <span>{item.artist || "未知艺术家"}</span>
                        <span>·</span>
                        <span>{sizeMB} MB</span>
                        <span>·</span>
                        <span>缓存于 {cachedTimeStr}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDelete(item.songId, item.source || "")}
                      className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="删除此歌曲缓存"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
