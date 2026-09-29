"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Code2, Sparkles, Plus, Trash2, CheckCircle2, AlertTriangle, Play } from "lucide-react";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { LXRunner } from "@/lib/sources/lxRunner";
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
  // 订阅整店以便状态变化时重渲染；动作来自 hook。
  const { addLXScript, removeLXScript, toggleLXScript, syncBuiltinDesktopSources } =
    useSourceConfigStore();
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
            <button
              type="button"
              onClick={async () => {
                await syncBuiltinDesktopSources();
                alert(
                  "🎉 已成功载入并同步本地桌面 4 套音源库（独家v4.0、聚合9.3特供版、野草、野花）！"
                );
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
              <label className="text-[11px] text-white/50 block mb-1">本地 JavaScript 代码</label>
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

        {/* Script List：三态分派（优先级 loading > error > 空态 > 列表）。
            标题栏保留在上方，仅替换列表区，保证既有默认渲染不变。 */}
        {loading ? (
          <div data-skeleton="true" className="space-y-3">
            <LoadingSkeleton count={3} variant="card" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-5 py-6">
            <p className="text-[13px] text-rose-200">{error}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="h-8 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-[12.5px] text-white transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        ) : lxScripts.length === 0 ? (
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
        )}
      </div>
    </>
  );
}
