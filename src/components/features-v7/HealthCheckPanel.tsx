"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useHealthCheckStore, issueTypeNames, HealthIssue } from "@/store/healthCheckStore";
import { X, Play, Square, CheckCircle, AlertTriangle, AlertCircle, XCircle, RefreshCw, Wrench, Eye } from "lucide-react";

interface HealthCheckPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const severityColors: Record<HealthIssue["severity"], { bg: string; text: string; border: string; icon: any }> = {
  low: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", icon: Eye },
  medium: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30", icon: AlertTriangle },
  high: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30", icon: AlertCircle },
  critical: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", icon: XCircle },
};

export function HealthCheckPanel({ isOpen, onClose }: HealthCheckPanelProps) {
  const {
    isRunning,
    progress,
    issues,
    selectedIssues,
    lastCheckTime,
    totalSongsScanned,
    startCheck,
    stopCheck,
    selectIssue,
    selectAllIssues,
    deselectAllIssues,
    fixIssue,
    fixSelectedIssues,
    clearIssues,
    dismissIssue,
  } = useHealthCheckStore();

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return "从未检查";
    return new Date(timestamp).toLocaleString("zh-CN");
  };

  const handleStartCheck = () => {
    clearIssues();
    startCheck();
  };

  const IssueItem = ({ issue }: { issue: HealthIssue }) => {
    const severity = severityColors[issue.severity];
    const SeverityIcon = severity.icon;
    const isSelected = selectedIssues.has(issue.id);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl border transition-all ${
          isSelected
            ? "bg-pink-500/20 border-pink-500/50"
            : `${severity.bg} ${severity.border}`
        }`}
      >
        <div className="flex items-start gap-4">
          <button
            onClick={() => selectIssue(issue.id)}
            className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-all ${
              isSelected
                ? "bg-pink-500 border-pink-500"
                : "border-white/30 hover:border-white/50"
            }`}
          >
            {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
          </button>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <SeverityIcon className={`w-4 h-4 ${severity.text}`} />
              <span className={`text-xs font-medium ${severity.text} uppercase`}>
                {issue.severity}
              </span>
              <span className="text-xs text-white/40">•</span>
              <span className="text-xs text-white/60">{issueTypeNames[issue.type]}</span>
            </div>
            <h4 className="text-white font-medium mb-1">{issue.title}</h4>
            <p className="text-white/60 text-sm mb-2">{issue.artist}</p>
            <p className="text-white/40 text-xs mb-3">{issue.filePath}</p>
            <p className="text-white/70 text-sm">{issue.description}</p>
          </div>

          <div className="flex flex-col gap-2">
            {issue.canAutoFix && (
              <button
                onClick={() => fixIssue(issue.id)}
                className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
                title="自动修复"
              >
                <Wrench className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => dismissIssue(issue.id)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 transition-colors"
              title="忽略"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 300 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 300 }}
        transition={{ duration: 0.3 }}
        className="fixed left-0 right-0 bottom-0 top-20 bg-black/95 backdrop-blur-2xl border-t border-white/20 rounded-t-3xl z-50"
      >
        <div className="p-6 h-full flex flex-col max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-pink-400" />
              <h2 className="text-xl font-bold text-white">音乐库健康检查</h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-white/60">
                上次检查: {formatTime(lastCheckTime)}
                {totalSongsScanned > 0 && ` • 扫描了 ${totalSongsScanned} 首歌曲`}
              </div>
              {!isRunning && issues.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={deselectAllIssues}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 text-sm transition-colors"
                  >
                    取消全选
                  </button>
                  <button
                    onClick={selectAllIssues}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                  >
                    全选
                  </button>
                  {selectedIssues.size > 0 && (
                    <button
                      onClick={fixSelectedIssues}
                      className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Wrench className="w-4 h-4" />
                      修复选中 ({selectedIssues.size})
                    </button>
                  )}
                </div>
              )}
            </div>

            {isRunning ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 mx-auto mb-4"
                  >
                    <RefreshCw className="w-16 h-16 text-pink-400" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white mb-2">正在扫描音乐库...</h3>
                  <p className="text-white/60">请稍候，这可能需要一些时间</p>
                </div>

                <div className="w-full max-w-md">
                  <div className="flex justify-between text-sm text-white/60 mb-2">
                    <span>进度</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                <button
                  onClick={stopCheck}
                  className="mt-8 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-all flex items-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  停止扫描
                </button>
              </div>
            ) : issues.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                {issues.map((issue) => (
                  <IssueItem key={issue.id} issue={issue} />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                {lastCheckTime ? (
                  <>
                    <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">音乐库状态良好！</h3>
                    <p className="text-white/60 mb-6">未发现任何问题</p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-16 h-16 text-white/40 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">还未检查过音乐库</h3>
                    <p className="text-white/60 mb-6">点击下方按钮开始检查</p>
                  </>
                )}
                <button
                  onClick={handleStartCheck}
                  className="px-8 py-4 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-lg transition-all flex items-center gap-3 shadow-lg shadow-pink-500/30"
                >
                  <Play className="w-6 h-6" />
                  开始检查
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
