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
      return <FileText className="h-4 w-4 text-yellow-300" />;
    case "missing_cover":
    case "oversized_cover":
      return <Image className="h-4 w-4 text-orange-300" />;
    case "missing_lyrics":
      return <Music className="h-4 w-4 text-blue-300" />;
    default:
      return <AlertCircle className="h-4 w-4 text-red-300" />;
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

  const startScan = useCallback(async () => {
    if (songs.length === 0) {
      setHealthReport(generateHealthReport([]));
      setActiveTab("results");
      return;
    }

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="mx-4 flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/90 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20">
                <Activity className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Library Health</h2>
                <p className="text-xs text-white/45">
                  {hasScanned
                    ? `${healthReport?.totalSongs || 0} songs - ${totalIssues} active issues`
                    : "Scan the library before cleanup or export."}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Close library health"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-6 flex flex-wrap gap-2">
              {(["scan", "results", "settings"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                    activeTab === tab
                      ? "bg-emerald-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  {tab === "scan"
                    ? "Scan"
                    : tab === "results"
                      ? `Results (${totalIssues})`
                      : "Settings"}
                </button>
              ))}
              <button
                onClick={downloadReport}
                disabled={!healthReport}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20 disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                Export report
              </button>
            </div>

            {activeTab === "scan" && (
              <div className="space-y-6">
                <HealthStatusBanner
                  songsCount={songs.length}
                  totalIssues={totalIssues}
                  hasScanned={hasScanned}
                />

                <div className="grid grid-cols-3 gap-4">
                  <StatCard label="Songs" value={songs.length} />
                  <StatCard label="Issues" value={totalIssues} tone="text-red-300" />
                  <StatCard
                    label="Healthy"
                    value={healthReport?.healthySongs ?? songs.length}
                    tone="text-emerald-300"
                  />
                </div>

                <ScanStateCard
                  songsCount={songs.length}
                  totalIssues={totalIssues}
                  hasScanned={hasScanned}
                />

                {localScanning ? (
                  <div className="flex flex-col items-center py-8">
                    <RefreshCw className="mb-4 h-8 w-8 animate-spin text-emerald-300" />
                    <p className="text-white/70">Scanning library...</p>
                  </div>
                ) : (
                  <button
                    onClick={startScan}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-white transition-colors hover:bg-emerald-700"
                  >
                    {songs.length === 0 ? "Create empty health report" : "Start scan"}
                  </button>
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
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-white/5 p-4">
                  <div>
                    <div className="font-medium text-white">Auto scan</div>
                    <div className="text-sm text-white/60">
                      Check library health when the library opens.
                    </div>
                  </div>
                  <button
                    onClick={() => setAutoScan(!autoScan)}
                    className={`h-7 w-12 rounded-full transition-colors ${autoScan ? "bg-emerald-600" : "bg-white/20"}`}
                    aria-label="Toggle auto scan"
                  >
                    <div
                      className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        autoScan ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={clearIssues}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600/20 py-3 text-red-300 transition-colors hover:bg-red-600/30"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear active issues
                </button>
              </div>
            )}
          </div>
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
}: {
  songsCount: number;
  totalIssues: number;
  hasScanned: boolean;
}) {
  if (songsCount === 0) {
    return (
      <StatePanel icon={<Music className="h-5 w-5" />} title="No songs imported" tone="info">
        Import tracks before running cleanup. An empty report can still confirm the health panel is
        working.
      </StatePanel>
    );
  }

  if (!hasScanned) {
    return (
      <StatePanel icon={<Activity className="h-5 w-5" />} title="Ready to scan" tone="info">
        The scan checks missing audio, duplicate metadata, covers, lyrics, and invalid durations.
      </StatePanel>
    );
  }

  if (totalIssues === 0) {
    return (
      <StatePanel icon={<CheckCircle className="h-5 w-5" />} title="Healthy library" tone="success">
        The current report has no active issues. Export it if you need a snapshot.
      </StatePanel>
    );
  }

  return (
    <StatePanel icon={<AlertCircle className="h-5 w-5" />} title="Issues found" tone="warning">
      Review the Results tab, ignore resolved items, or export the report for later cleanup.
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
        className={`mx-auto mb-4 h-14 w-14 ${healthy ? "text-emerald-300" : "text-white/35"}`}
      />
      <p className="text-lg text-white/80">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/50">{description}</p>
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
          <p className="mt-1 text-sm text-white/60">{children}</p>
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
    <div className="rounded-xl bg-white/5 p-4 text-center">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-sm text-white/60">{label}</div>
    </div>
  );
}

function IssueGroupCard({
  group,
  songLookup,
  onIgnore,
}: {
  group: HealthIssueGroup;
  songLookup: Map<string, string>;
  onIgnore: (issueId: string) => void;
}) {
  return (
    <div className={`rounded-xl border p-4 ${getSeverityClass(group.severity)}`}>
      <div className="flex items-start gap-3">
        {getIssueIcon(group.type)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-white">{issueLabels[group.type] || group.type}</h3>
              <p className="mt-1 text-xs text-white/45">
                {group.count} issue{group.count === 1 ? "" : "s"} - {group.affectedSongIds.length}{" "}
                song{group.affectedSongIds.length === 1 ? "" : "s"} affected
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs capitalize text-white/60">
              {group.severity}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {group.issues.slice(0, 3).map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white/80">
                    {songLookup.get(issue.songId) || issue.songId}
                  </p>
                  <p className="truncate text-xs text-white/45">{issue.suggestion}</p>
                </div>
                {issue.actions.includes("ignore") && (
                  <button
                    onClick={() => onIgnore(issue.id)}
                    className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/60 hover:text-white"
                  >
                    Ignore
                  </button>
                )}
              </div>
            ))}
            {group.issues.length > 3 && (
              <div className="px-3 text-xs text-white/40">
                +{group.issues.length - 3} more affected songs
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
