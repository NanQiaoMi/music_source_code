"use client";

import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Flame,
  Image as ImageIcon,
  Music,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import {
  generateHealthReport,
  HealthIssueGroup,
  useLibraryHealthStore,
} from "@/store/libraryHealthStore";
import { HealthIssueType, Song } from "@/types/song";
import { usePlaylistStore } from "@/store/playlistStore";
import { purgeInvalidSongs, evaluateSongIntegrity, PurgeReport } from "@/services/songPurgeService";
import {
  getLibraryHealthNextAction,
  type LibraryHealthNextAction,
} from "@/lib/library/libraryHealthActions";

interface LibraryHealthPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const issueLabels: Partial<Record<HealthIssueType, string>> = {
  missing_file: "Missing audio (无音频源/死链)",
  duplicate: "Duplicates (重复曲目)",
  low_quality: "Invalid metadata / duration (时长或数据异常)",
  oversized_cover: "Oversized cover (超大封面)",
  missing_metadata: "Missing metadata (缺失元数据)",
  missing_cover: "Missing cover (缺失封面)",
  missing_lyrics: "Missing lyrics (缺失歌词)",
};

function getIssueIcon(type: HealthIssueType) {
  switch (type) {
    case "missing_metadata":
      return <FileText className="h-4 w-4 text-yellow-300" />;
    case "missing_cover":
    case "oversized_cover":
      return <ImageIcon className="h-4 w-4 text-orange-300" />;
    case "missing_lyrics":
      return <Music className="h-4 w-4 text-blue-300" />;
    case "missing_file":
      return <Flame className="h-4 w-4 text-red-400" />;
    default:
      return <AlertCircle className="h-4 w-4 text-red-300" />;
  }
}

function getSeverityClass(severity: string) {
  switch (severity) {
    case "critical":
      return "border-red-400/40 bg-red-500/10";
    case "warning":
      return "border-amber-400/40 bg-amber-500/10";
    default:
      return "border-sky-400/30 bg-sky-500/10";
  }
}

export const LibraryHealthPanel: React.FC<LibraryHealthPanelProps> = ({ isOpen, onClose }) => {
  const { songs } = usePlaylistStore();
  const [activeTab, setActiveTab] = useState<"scan" | "results" | "settings">("scan");
  const [localScanning, setLocalScanning] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeFeedback, setPurgeFeedback] = useState<PurgeReport | null>(null);
  const [songsToPurgeConfirm, setSongsToPurgeConfirm] = useState<string[] | null>(null);

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

  const songLookup = useMemo(
    () =>
      new Map(
        songs.map((song) => [song.id, `${song.title || "Untitled"} - ${song.artist || "Unknown"}`])
      ),
    [songs]
  );

  const issueGroups = useMemo(
    () => Object.values(healthReport?.issueGroups || {}),
    [healthReport?.issueGroups]
  );
  const totalIssues = healthReport?.issuesCount || 0;
  const hasScanned = Boolean(healthReport);
  const missingFileCount = healthReport?.issueGroups.missing_file?.count || 0;

  // Identify all critical broken/invalid song IDs that should be purged
  const purgeableSongIds = useMemo(() => {
    const invalidIds = new Set<string>();
    songs.forEach((song) => {
      const evaluation = evaluateSongIntegrity(song);
      if (evaluation.isInvalid) {
        invalidIds.add(song.id);
      }
    });
    // Also include songs from missing_file group
    if (healthReport?.issueGroups.missing_file) {
      healthReport.issueGroups.missing_file.affectedSongIds.forEach((id) => invalidIds.add(id));
    }
    return Array.from(invalidIds);
  }, [songs, healthReport]);

  const nextAction = useMemo(
    () =>
      getLibraryHealthNextAction({
        songsCount: songs.length,
        hasScanned,
        totalIssues,
        missingFileCount,
      }),
    [hasScanned, missingFileCount, songs.length, totalIssues]
  );

  const startScan = useCallback(async () => {
    if (songs.length === 0) {
      setHealthReport(generateHealthReport([]));
      setActiveTab("results");
      return;
    }

    setLocalScanning(true);
    setScanning(true);
    setScanProgress(25);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setScanProgress(70);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const report = generateHealthReport(songs);
    setScanProgress(100);
    setHealthReport(report);

    setLocalScanning(false);
    setScanning(false);
    setActiveTab("results");
  }, [songs, setHealthReport, setScanProgress, setScanning]);

  const runNextAction = useCallback(() => {
    if (nextAction.target === "scan") {
      void startScan();
      return;
    }

    setActiveTab("results");
  }, [nextAction.target, startScan]);

  const handleExecutePurge = useCallback(
    async (targetIds: string[]) => {
      if (targetIds.length === 0) return;
      setIsPurging(true);
      setSongsToPurgeConfirm(null);

      try {
        const report = await purgeInvalidSongs(targetIds);
        setPurgeFeedback(report);
        setTimeout(() => setPurgeFeedback(null), 5000);
      } catch (err) {
        console.error("Failed to purge songs:", err);
      } finally {
        setIsPurging(false);
      }
    },
    []
  );

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="relative mx-4 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0e101c]/95 shadow-[0_25px_80px_rgba(0,0,0,0.85)] backdrop-blur-3xl"
        >
          {/* Header with Ambient Glow */}
          <div className="relative overflow-hidden border-b border-white/10 p-5">
            <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_4px_16px_rgba(16,185,129,0.3)]">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white truncate">Library Health</h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-400/15 text-emerald-300 border border-emerald-400/25">
                      歌曲智能巡检与死链清理
                    </span>
                  </div>
                  <p className="text-xs text-white/50 truncate mt-0.5">
                    {hasScanned
                      ? `${healthReport?.totalSongs || 0} songs - ${totalIssues} active issues`
                      : "Scan the library before cleanup or export."}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {purgeableSongIds.length > 0 && (
                  <button
                    onClick={() => setSongsToPurgeConfirm(purgeableSongIds)}
                    disabled={isPurging}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 hover:text-white transition-all active:scale-95 disabled:opacity-40"
                    title="一键彻底删除所有无实际信息/死链曲目"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    彻底清理 ({purgeableSongIds.length})
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Close library health"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Purge Success Toast Feedback */}
          {purgeFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-5 mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-xs text-emerald-200"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  已彻底清理 <strong>{purgeFeedback.purgedCount}</strong> 首无实际信息/异常音乐，曲库与本地存储已彻底同步！
                </span>
              </div>
              <button
                onClick={() => setPurgeFeedback(null)}
                className="text-emerald-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}

          {/* Body Content */}
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
            {/* Tabs */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {(["scan", "results", "settings"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                    activeTab === tab
                      ? "bg-white text-black shadow-sm"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab === "scan"
                    ? "巡检诊断 (Scan)"
                    : tab === "results"
                      ? `检测结果 (Results ${totalIssues})`
                      : "设置 (Settings)"}
                </button>
              ))}
              <button
                onClick={downloadReport}
                disabled={!healthReport}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-40 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export report
              </button>
            </div>

            {activeTab === "scan" && (
              <div className="space-y-5">
                <HealthStatusBanner
                  songsCount={songs.length}
                  totalIssues={totalIssues}
                  hasScanned={hasScanned}
                />

                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="总曲目 (Songs)" value={songs.length} />
                  <StatCard label="异常项目 (Issues)" value={totalIssues} tone="text-red-300" />
                  <StatCard
                    label="健康曲目 (Healthy)"
                    value={healthReport?.healthySongs ?? songs.length}
                    tone="text-emerald-300"
                  />
                </div>

                <ScanStateCard
                  songsCount={songs.length}
                  totalIssues={totalIssues}
                  hasScanned={hasScanned}
                  nextAction={nextAction}
                  onNextAction={runNextAction}
                  actionDisabled={localScanning}
                />

                {localScanning && (
                  <div className="flex flex-col items-center py-8">
                    <RefreshCw className="mb-3 h-8 w-8 animate-spin text-emerald-400" />
                    <p className="text-sm font-medium text-white/80">正在对曲库进行逐曲深度巡检...</p>
                    <p className="text-xs text-white/40 mt-1">分析音频源可播性、元数据完整度与本地存储状态</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "results" && (
              <div className="space-y-4">
                {!hasScanned ? (
                  <EmptyResultsState
                    title="No scan yet"
                    description="Run a scan to see broken audio, metadata, cover, and lyric issues."
                  />
                ) : songs.length === 0 ? (
                  <EmptyResultsState
                    title="Library is empty"
                    description="Import songs first, then run health checks before cleanup."
                  />
                ) : issueGroups.length === 0 ? (
                  <EmptyResultsState
                    title="Library looks healthy"
                    description="No active issues are left in the current report."
                    healthy
                  />
                ) : (
                  issueGroups.map((group) => (
                    <IssueGroupCard
                      key={group.type}
                      group={group}
                      songLookup={songLookup}
                      onIgnore={ignoreIssue}
                      onPurgeSong={(songId) => handleExecutePurge([songId])}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <div className="text-sm font-medium text-white">Auto scan (自动巡检)</div>
                    <div className="text-xs text-white/50 mt-0.5">
                      Check library health when the library opens.
                    </div>
                  </div>
                  <button
                    onClick={() => setAutoScan(!autoScan)}
                    className={`h-6 w-11 rounded-full transition-colors relative ${autoScan ? "bg-emerald-500" : "bg-white/20"}`}
                    aria-label="Toggle auto scan"
                  >
                    <div
                      className={`h-4 w-4 rounded-full bg-white shadow transition-transform absolute top-1 ${
                        autoScan ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={clearIssues}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear active issues
                </button>
              </div>
            )}
          </div>

          {/* Purge Confirmation Modal */}
          {songsToPurgeConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md rounded-3xl border border-red-500/30 bg-[#121424] p-6 shadow-2xl"
              >
                <div className="flex items-center gap-3 text-red-400 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/20">
                    <ShieldAlert className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">彻底删除确认</h3>
                    <p className="text-xs text-white/50">永久清除无实际信息/死链歌曲</p>
                  </div>
                </div>

                <p className="text-xs text-white/70 leading-relaxed">
                  即将永久彻底删除 <strong>{songsToPurgeConfirm.length}</strong> 首无实际信息或死链音乐。该操作将级联清理曲库列表、播放队列、封面缓存及本地 IndexedDB 存储。
                </p>

                <div className="mt-3 max-h-36 overflow-y-auto custom-scrollbar rounded-xl bg-black/30 p-2 text-[11px] text-white/60 space-y-1">
                  {songsToPurgeConfirm.slice(0, 10).map((id) => (
                    <div key={id} className="truncate">
                      • {songLookup.get(id) || id}
                    </div>
                  ))}
                  {songsToPurgeConfirm.length > 10 && (
                    <div className="text-white/40 italic">
                      ...以及其余 {songsToPurgeConfirm.length - 10} 首
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setSongsToPurgeConfirm(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 text-xs font-medium text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleExecutePurge(songsToPurgeConfirm)}
                    disabled={isPurging}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-xs font-semibold text-white shadow-lg hover:bg-red-500 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isPurging ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    确认彻底删除
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

function HealthStatusBanner({
  songsCount,
  totalIssues,
  hasScanned,
}: {
  songsCount: number;
  totalIssues: number;
  hasScanned: boolean;
}) {
  if (songsCount === 0) {
    return (
      <StatusBanner
        icon={<Music className="h-5 w-5" />}
        status="Empty library"
        detail="Import songs before cleanup checks."
        tone="info"
      />
    );
  }

  if (!hasScanned) {
    return (
      <StatusBanner
        icon={<Activity className="h-5 w-5" />}
        status="Ready to scan"
        detail="Run a scan to classify missing files, metadata, covers, and lyrics."
        tone="info"
      />
    );
  }

  if (totalIssues === 0) {
    return (
      <StatusBanner
        icon={<CheckCircle className="h-5 w-5" />}
        status="Healthy library"
        detail="No active issues in the latest scan."
        tone="success"
      />
    );
  }

  return (
    <StatusBanner
      icon={<AlertCircle className="h-5 w-5" />}
      status="Needs attention"
      detail="Review and resolve active library issues."
      tone="warning"
    />
  );
}

function StatusBanner({
  icon,
  status,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  status: string;
  detail: string;
  tone: "info" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warning"
        ? "border-amber-400/35 bg-amber-500/10 text-amber-200"
        : "border-sky-400/25 bg-sky-500/10 text-sky-200";

  return (
    <section className={`rounded-2xl border p-4 ${toneClass}`} aria-label="Health status">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Health status
          </div>
          <div className="mt-1 font-semibold text-white">{status}</div>
          <p className="mt-0.5 text-sm text-white/60">{detail}</p>
        </div>
      </div>
    </section>
  );
}

function ScanStateCard({
  songsCount,
  totalIssues,
  hasScanned,
  nextAction,
  onNextAction,
  actionDisabled,
}: {
  songsCount: number;
  totalIssues: number;
  hasScanned: boolean;
  nextAction: LibraryHealthNextAction;
  onNextAction: () => void;
  actionDisabled: boolean;
}) {
  const nextActionButton = (
    <button
      type="button"
      onClick={onNextAction}
      disabled={actionDisabled}
      className="mt-4 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={"Library health next action: " + nextAction.label}
    >
      {nextAction.label}
    </button>
  );

  if (songsCount === 0) {
    return (
      <StatePanel icon={<Music className="h-5 w-5" />} title="No songs imported" tone="info">
        Import tracks before running cleanup. An empty report can still confirm the health panel is
        working.
        {nextActionButton}
      </StatePanel>
    );
  }

  if (!hasScanned) {
    return (
      <StatePanel icon={<Activity className="h-5 w-5" />} title="Ready to scan" tone="info">
        The scan checks missing audio, duplicate metadata, covers, lyrics, and invalid durations.
        {nextActionButton}
      </StatePanel>
    );
  }

  if (totalIssues === 0) {
    return (
      <StatePanel icon={<CheckCircle className="h-5 w-5" />} title="Healthy library" tone="success">
        The current report has no active issues. Export it if you need a snapshot.
        {nextActionButton}
      </StatePanel>
    );
  }

  return (
    <StatePanel icon={<AlertCircle className="h-5 w-5" />} title="Issues found" tone="warning">
      Review the Results tab, ignore resolved items, or export the report for later cleanup.
      {nextActionButton}
    </StatePanel>
  );
}

function EmptyResultsState({
  title,
  description,
  healthy = false,
}: {
  title: string;
  description: string;
  healthy?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 py-12 text-center">
      <CheckCircle
        className={`mx-auto mb-3 h-12 w-12 ${healthy ? "text-emerald-400" : "text-white/30"}`}
      />
      <p className="text-base font-semibold text-white/80">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs text-white/50 leading-relaxed">{description}</p>
    </div>
  );
}

function StatePanel({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "info" | "success" | "warning";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warning"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
        : "border-sky-400/25 bg-sky-500/10 text-sky-200";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <div className="font-medium text-white">{title}</div>
          <div className="mt-1 text-sm text-white/60">{children}</div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </div>
  );
}

function IssueGroupCard({
  group,
  songLookup,
  onIgnore,
  onPurgeSong,
}: {
  group: HealthIssueGroup;
  songLookup: Map<string, string>;
  onIgnore: (issueId: string) => void;
  onPurgeSong: (songId: string) => void;
}) {
  const isPurgeable = group.type === "missing_file" || group.type === "low_quality";

  return (
    <div className={`rounded-2xl border p-4 ${getSeverityClass(group.severity)}`}>
      <div className="flex items-start gap-3">
        {getIssueIcon(group.type)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-white text-sm">
                {issueLabels[group.type] || group.type}
              </h3>
              <p className="mt-0.5 text-xs text-white/45">
                {group.count} issue{group.count === 1 ? "" : "s"} - {group.affectedSongIds.length}{" "}
                song{group.affectedSongIds.length === 1 ? "" : "s"} affected
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] capitalize text-white/70">
              {group.severity}
            </span>
          </div>

          <div className="mt-3 space-y-1.5">
            {group.issues.slice(0, 5).map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-black/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white/90">
                    {songLookup.get(issue.songId) || issue.songId}
                  </p>
                  <p className="truncate text-[11px] text-white/45 mt-0.5">{issue.suggestion}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isPurgeable && (
                    <button
                      onClick={() => onPurgeSong(issue.songId)}
                      className="flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30 hover:text-white transition-colors"
                      title="彻底删除此异常曲目"
                    >
                      <Trash2 className="h-3 w-3" />
                      彻底删除
                    </button>
                  )}
                  {issue.actions.includes("ignore") && (
                    <button
                      onClick={() => onIgnore(issue.id)}
                      className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/60 hover:bg-white/20 hover:text-white transition-colors"
                    >
                      Ignore
                    </button>
                  )}
                </div>
              </div>
            ))}
            {group.issues.length > 5 && (
              <div className="px-3 text-xs text-white/40 pt-1">
                +{group.issues.length - 5} more affected songs
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
