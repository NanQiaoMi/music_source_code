"use client";

import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Image,
  Music,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  generateHealthReport,
  HealthIssueGroup,
  useLibraryHealthStore,
} from "@/store/libraryHealthStore";
import { HealthIssueType } from "@/types/song";
import { usePlaylistStore } from "@/store/playlistStore";

interface LibraryHealthPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const issueLabels: Partial<Record<HealthIssueType, string>> = {
  missing_file: "Missing audio",
  duplicate: "Duplicates",
  low_quality: "Invalid metadata",
  oversized_cover: "Oversized cover",
  missing_metadata: "Missing metadata",
  missing_cover: "Missing cover",
  missing_lyrics: "Missing lyrics",
};

function getIssueIcon(type: HealthIssueType) {
  switch (type) {
    case "missing_metadata":
      return <FileText className="w-4 h-4 text-yellow-300" />;
    case "missing_cover":
    case "oversized_cover":
      return <Image className="w-4 h-4 text-orange-300" />;
    case "missing_lyrics":
      return <Music className="w-4 h-4 text-blue-300" />;
    default:
      return <AlertCircle className="w-4 h-4 text-red-300" />;
  }
}

function getSeverityClass(severity: string) {
  switch (severity) {
    case "critical":
      return "border-red-400/40 bg-red-500/15";
    case "warning":
      return "border-amber-400/40 bg-amber-500/15";
    default:
      return "border-sky-400/30 bg-sky-500/10";
  }
}

export const LibraryHealthPanel: React.FC<LibraryHealthPanelProps> = ({ isOpen, onClose }) => {
  const { songs } = usePlaylistStore();
  const [activeTab, setActiveTab] = useState<"scan" | "results" | "settings">("scan");
  const [localScanning, setLocalScanning] = useState(false);

  const {
    healthReport,
    autoScan,
    setHealthReport,
    setAutoScan,
    setScanning,
    setScanProgress,
    ignoreIssue,
    clearIssues,
    exportHealthReport,
  } = useLibraryHealthStore();

  const issueGroups = useMemo(
    () => Object.values(healthReport?.issueGroups || {}),
    [healthReport?.issueGroups]
  );
  const totalIssues = healthReport?.issuesCount || 0;

  const startScan = useCallback(async () => {
    if (songs.length === 0) return;

    setLocalScanning(true);
    setScanning(true);
    setScanProgress(25);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const report = generateHealthReport(songs);
    setScanProgress(100);
    setHealthReport(report);

    setLocalScanning(false);
    setScanning(false);
    setActiveTab("results");
  }, [songs, setHealthReport, setScanProgress, setScanning]);

  const downloadReport = () => {
    const reportJson = exportHealthReport();
    if (!reportJson) return;

    const blob = new Blob([reportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `library-health-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl bg-zinc-950/90 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl mx-4 overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-white font-semibold">音乐库健康检查</h2>
                <p className="text-white/45 text-xs">
                  {healthReport
                    ? `${healthReport.totalSongs} songs · ${healthReport.issuesCount} issues`
                    : "Scan library issues before cleanup"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 max-h-[65vh] overflow-y-auto custom-scrollbar min-h-0">
            <div className="flex flex-wrap gap-2 mb-6">
              {(["scan", "results", "settings"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === tab
                      ? "bg-emerald-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  {tab === "scan" ? "扫描" : tab === "results" ? `结果 (${totalIssues})` : "设置"}
                </button>
              ))}
              <button
                onClick={downloadReport}
                disabled={!healthReport}
                className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-40 text-sm"
              >
                <Download className="w-4 h-4" />
                导出报告
              </button>
            </div>

            {activeTab === "scan" && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <StatCard label="总歌曲" value={songs.length} />
                  <StatCard label="发现问题" value={totalIssues} tone="text-red-300" />
                  <StatCard
                    label="健康歌曲"
                    value={healthReport?.healthySongs ?? songs.length}
                    tone="text-emerald-300"
                  />
                </div>

                {localScanning ? (
                  <div className="flex flex-col items-center py-8">
                    <RefreshCw className="w-8 h-8 text-emerald-300 animate-spin mb-4" />
                    <p className="text-white/70">正在扫描音乐库...</p>
                  </div>
                ) : (
                  <button
                    onClick={startScan}
                    disabled={songs.length === 0}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-white/20 disabled:text-white/50 rounded-xl transition-colors text-white"
                  >
                    开始扫描
                  </button>
                )}
              </div>
            )}

            {activeTab === "results" && (
              <div className="space-y-4">
                {issueGroups.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 mx-auto text-emerald-300 mb-4" />
                    <p className="text-lg text-white/80">音乐库状态良好</p>
                    <p className="text-sm text-white/50 mt-2">没有发现需要处理的问题</p>
                  </div>
                ) : (
                  issueGroups.map((group) => (
                    <IssueGroupCard key={group.type} group={group} onIgnore={ignoreIssue} />
                  ))
                )}
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div>
                    <div className="font-medium text-white">自动扫描</div>
                    <div className="text-sm text-white/60">启动时自动检查音乐库</div>
                  </div>
                  <button
                    onClick={() => setAutoScan(!autoScan)}
                    className={`w-12 h-7 rounded-full transition-colors ${
                      autoScan ? "bg-emerald-600" : "bg-white/20"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        autoScan ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={clearIssues}
                  className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  清空问题记录
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

function StatCard({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-sm text-white/60">{label}</div>
    </div>
  );
}

function IssueGroupCard({
  group,
  onIgnore,
}: {
  group: HealthIssueGroup;
  onIgnore: (issueId: string) => void;
}) {
  return (
    <div className={`p-4 rounded-xl border ${getSeverityClass(group.severity)}`}>
      <div className="flex items-start gap-3">
        {getIssueIcon(group.type)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-white">{issueLabels[group.type] || group.type}</h3>
              <p className="text-xs text-white/45 mt-1">
                {group.count} issue(s) · {group.affectedSongIds.length} song(s) affected
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/60">
              {group.severity}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {group.issues.slice(0, 4).map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white/80">{issue.songId}</p>
                  <p className="truncate text-xs text-white/45">{issue.suggestion}</p>
                </div>
                {issue.actions.includes("ignore") && (
                  <button
                    onClick={() => onIgnore(issue.id)}
                    className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/60 hover:text-white"
                  >
                    忽略
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
