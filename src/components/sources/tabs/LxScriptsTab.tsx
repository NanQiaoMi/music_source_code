"use client";

import { useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, Code2, Sparkles, Plus, Trash2, CheckCircle2, AlertTriangle, Play } from "lucide-react";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { LXRunner } from "@/lib/sources/lxRunner";
import { ErrorBanner } from "@/components/ui/settings";
import { EmptyState, LoadingSkeleton } from "@/components/shared/Glass";

interface LxScriptsTabProps {
  /** 脚本列表拉取中。缺省（undefined）时保持原有渲染，由外壳 Task 10 接线。 */
  loading?: boolean;
  /** 拉取失败文案。缺省时不渲染错误态。 */
  error?: string | null;
  /** 错误态「重试」回调。缺省时按钮仍渲染但为空操作。 */
  onRetry?: () => void;
}

export function LxScriptsTab({ loading, error, onRetry }: LxScriptsTabProps = {}) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  // 订阅整店以便状态变化时重渲染；动作来自 hook。
  const { addLXScript, removeLXScript, toggleLXScript } = useSourceConfigStore();
  // 脚本列表直接读当前值：renderToStaticMarkup 下 hook 快照是初始值（getInitialState），
  // 而空态判据必须反映「此刻」的 store，故用 getState 读取，客户端也由上面的订阅保证更新。
  const lxScripts = useSourceConfigStore.getState().lxScripts;

  // New script modal form state
  const [showAddScript, setShowAddScript] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [newScriptAuthor, setNewScriptAuthor] = useState("");
  const [newScriptUrl, setNewScriptUrl] = useState("");
  const [newScriptCode, setNewScriptCode] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingScript, setIsTestingScript] = useState(false);

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
      } catch (e) {
        setTestResult({
          success: false,
          message: `网络请求失败: ${e instanceof Error ? e.message : String(e)}`,
        });
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

  // 非阻断错误横幅：仅提示上游故障，不遮挡本地已有的脚本列表。
  const errorBanner = error ? <ErrorBanner message={error} onRetry={onRetry} /> : null;

  return (
    <>
      {/* TAB 2: 洛雪 / 自定义脚本 */}
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
            {/* 走外壳的 onRetry（即 runSourceSync）：加载态与失败横幅都由外壳统一管理，
                这里不再自行 alert——一是 alert 会阻塞界面，二是失败已经被上方横幅说清楚了。
                同步成功的反馈是列表/计数随之更新。 */}
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b13]"
              title="从桌面音源目录一键刷新并载入最新脚本"
            >
              <Sparkles className={`w-3.5 h-3.5 ${loading ? "animate-pulse" : ""}`} />
              <span>同步本地 4 大音源</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddScript(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b13]"
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
                type="button"
                onClick={() => setShowAddScript(false)}
                aria-label="关闭新建脚本"
                className="text-white/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b13] rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-white/50 block mb-1">源名称 *</label>
                <input
                  type="text"
                  placeholder="例如: 六音无损源 v2"
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:border-cyan-300/50"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/50 block mb-1">作者 / 版本</label>
                <input
                  type="text"
                  placeholder="例如: LX Dev / 1.0.0"
                  value={newScriptAuthor}
                  onChange={(e) => setNewScriptAuthor(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:border-cyan-300/50"
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
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:border-cyan-300/50"
              />
            </div>

            <div>
              <label className="text-[11px] text-white/50 block mb-1">本地 JavaScript 代码</label>
              <textarea
                rows={4}
                placeholder="module.exports = { search: async function(kw) { ... } };"
                value={newScriptCode}
                onChange={(e) => setNewScriptCode(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 font-mono text-[11px] text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:border-cyan-300/50"
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

        {/* Script List：三态分派（优先级 loading > 横幅 + （空态 | 列表））。
            标题栏保留在上方，仅替换列表区，保证既有默认渲染不变。
            错误不再阻断：横幅可与空态或正常列表同时出现。 */}
        {loading ? (
          <div data-skeleton="true" className="space-y-3">
            <LoadingSkeleton count={3} variant="card" />
          </div>
        ) : (
          <>
            {errorBanner}
            {lxScripts.length === 0 ? (
              <EmptyState
                title="还没有自定义脚本"
                description="添加洛雪自定义源脚本，或同步本地桌面音源后即可在此管理"
                actionLabel="添加扩展源"
                onAction={() => setShowAddScript(true)}
              />
            ) : (
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
                          layout={!shouldReduceMotion}
                          transition={shouldReduceMotion ? { duration: 0 } : undefined}
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
            )}
          </>
        )}
      </div>
    </>
  );
}
