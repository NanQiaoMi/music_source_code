"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Database,
  FolderOpen,
  ListMusic,
  Play,
  RefreshCw,
  Settings2,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import {
  useLibraryManagerStore,
  type DuplicateGroup,
  type LibraryStats,
  type RenameRule,
  type ScanFilter,
} from "@/store/libraryManagerStore";
import { useAudioStore } from "@/store/audioStore";
import { usePlaylistGroupStore, type PlaylistGroup } from "@/store/playlistGroupStore";
import { usePlaylistStore } from "@/store/playlistStore";

interface LibraryManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ITEMS = [
  { id: "playlists", name: "Saved playlists", icon: ListMusic },
  { id: "deduplicate", name: "Duplicates", icon: Trash2 },
  { id: "rename", name: "Rename rules", icon: Wand2 },
  { id: "scan", name: "Scan filters", icon: Settings2 },
  { id: "stats", name: "Library stats", icon: BarChart3 },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

export const LibraryManagerPanel: React.FC<LibraryManagerPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>("playlists");
  const [statusMessage, setStatusMessage] = useState("Saved Smart Mix playlists appear here.");
  const { songs } = usePlaylistStore();
  const playQueue = useAudioStore((state) => state.playQueue);
  const { groups, deleteGroup } = usePlaylistGroupStore();

  const {
    duplicateGroups,
    isScanningDuplicates,
    duplicateScanProgress,
    renameRules,
    selectedRenameRule,
    scanFilters,
    libraryStats,
    findDuplicates,
    deleteSelectedDuplicates,
    updateLibraryStats,
  } = useLibraryManagerStore();

  const customGroups = useMemo(() => groups.filter((group) => group.type === "custom"), [groups]);

  useEffect(() => {
    if (isOpen) {
      updateLibraryStats(songs);
    }
  }, [isOpen, songs, updateLibraryStats]);

  const handleFindDuplicates = useCallback(() => {
    void findDuplicates(songs);
  }, [findDuplicates, songs]);

  const handleDeleteDuplicates = useCallback(async () => {
    try {
      await deleteSelectedDuplicates();
      setStatusMessage("Duplicate cleanup finished.");
    } catch (error) {
      console.error("Delete duplicates failed:", error);
      setStatusMessage("Duplicate cleanup failed.");
    }
  }, [deleteSelectedDuplicates]);

  const handlePlayGroup = useCallback(
    (group: PlaylistGroup) => {
      if (group.songs.length === 0) return;
      playQueue(group.songs, 0);
      setStatusMessage(`Playing ${group.name} with ${group.songs.length} tracks.`);
    },
    [playQueue]
  );

  const handleDeleteGroup = useCallback(
    (group: PlaylistGroup) => {
      deleteGroup(group.id);
      setStatusMessage(`Deleted playlist ${group.name}.`);
    },
    [deleteGroup]
  );

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/92 shadow-2xl backdrop-blur-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Music Library</h2>
              <p className="text-sm text-white/55">
                Manage saved playlists, duplicates, scan rules, and library health basics.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close music library"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <nav
          className="grid grid-cols-2 border-b border-white/10 md:grid-cols-5"
          aria-label="Library sections"
        >
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/5 hover:text-white/85"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
          >
            {statusMessage}
          </div>

          {activeTab === "playlists" && (
            <SavedPlaylistsTab
              groups={customGroups}
              onPlayGroup={handlePlayGroup}
              onDeleteGroup={handleDeleteGroup}
            />
          )}

          {activeTab === "deduplicate" && (
            <DeduplicateTab
              duplicateGroups={duplicateGroups}
              isScanning={isScanningDuplicates}
              scanProgress={duplicateScanProgress}
              onFindDuplicates={handleFindDuplicates}
              onDeleteDuplicates={handleDeleteDuplicates}
            />
          )}

          {activeTab === "rename" && (
            <RenameTab renameRules={renameRules} selectedRule={selectedRenameRule} />
          )}

          {activeTab === "scan" && <ScanTab scanFilters={scanFilters} />}

          {activeTab === "stats" && <StatsTab stats={libraryStats} />}
        </div>
      </motion.div>
    </motion.div>
  );
};

function SavedPlaylistsTab({
  groups,
  onPlayGroup,
  onDeleteGroup,
}: {
  groups: PlaylistGroup[];
  onPlayGroup: (group: PlaylistGroup) => void;
  onDeleteGroup: (group: PlaylistGroup) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
        <FolderOpen className="mx-auto mb-3 h-8 w-8 text-white/35" />
        <h3 className="mb-2 text-lg font-semibold text-white">No saved playlists yet</h3>
        <p className="text-sm text-white/50">
          Save a Smart Mix to turn it into a reusable custom playlist.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map((group) => (
        <article key={group.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-white">{group.name}</h3>
              <p className="text-sm text-white/45">
                {group.songs.length} tracks - Updated {formatDate(group.updatedAt)}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200">
              <ListMusic className="h-5 w-5" />
            </div>
          </div>

          <div className="mb-4 space-y-2">
            {group.songs.slice(0, 3).map((song, index) => (
              <div
                key={song.id}
                className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-xs text-white/50">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white/80">{song.title}</span>
                  <span className="block truncate text-xs text-white/40">{song.artist}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPlayGroup(group)}
              disabled={group.songs.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-4 w-4" />
              Play
            </button>
            <button
              type="button"
              onClick={() => onDeleteGroup(group)}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/70 transition-colors hover:bg-red-500/20 hover:text-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function DeduplicateTab({
  duplicateGroups,
  isScanning,
  scanProgress,
  onFindDuplicates,
  onDeleteDuplicates,
}: {
  duplicateGroups: DuplicateGroup[];
  isScanning: boolean;
  scanProgress: number;
  onFindDuplicates: () => void;
  onDeleteDuplicates: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Duplicate scanner</h3>
          <p className="text-sm text-white/50">
            Find duplicate artist/title pairs and keep one best copy.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onFindDuplicates}
            disabled={isScanning}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white/75 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Scanning" : "Scan duplicates"}
          </button>
          <button
            type="button"
            onClick={onDeleteDuplicates}
            disabled={duplicateGroups.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-100 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Remove extras
          </button>
        </div>
      </div>

      {isScanning && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-white/65">
            <span>Scanning library</span>
            <span>{scanProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${scanProgress}%` }}
              className="h-full bg-emerald-300"
            />
          </div>
        </div>
      )}

      {duplicateGroups.length === 0 && !isScanning ? (
        <EmptyState
          icon={<Trash2 className="h-8 w-8" />}
          title="No duplicate groups"
          description="Run a scan to find matching artist/title pairs."
        />
      ) : (
        <div className="space-y-3">
          {duplicateGroups.map((group) => (
            <article
              key={group.groupId}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="mb-3 text-sm font-semibold text-white">
                {group.songs[0]?.title || "Untitled"} - {group.songs[0]?.artist || "Unknown"}
              </div>
              <div className="space-y-2">
                {group.songs.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white/80">{song.title}</div>
                      <div className="truncate text-xs text-white/40">
                        {formatDuration(song.duration)}
                      </div>
                    </div>
                    {song.isRecommended && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-100">
                        Keep
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function RenameTab({
  renameRules,
  selectedRule,
}: {
  renameRules: RenameRule[];
  selectedRule: string;
}) {
  return (
    <div className="space-y-3">
      {renameRules.map((rule) => (
        <article
          key={rule.id}
          className={`rounded-2xl border p-4 ${
            selectedRule === rule.id
              ? "border-emerald-300/30 bg-emerald-500/10"
              : "border-white/10 bg-white/[0.04]"
          }`}
        >
          <h3 className="text-sm font-semibold text-white">{rule.name}</h3>
          <p className="mt-1 font-mono text-xs text-white/50">{rule.pattern}</p>
          <p className="mt-2 text-xs text-white/40">Example: {rule.example}</p>
        </article>
      ))}
    </div>
  );
}

function ScanTab({ scanFilters }: { scanFilters: ScanFilter }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MetricCard label="Minimum duration" value={`${scanFilters.minDuration || 0}s`} />
      <MetricCard
        label="Maximum duration"
        value={scanFilters.maxDuration ? `${scanFilters.maxDuration}s` : "No limit"}
      />
      <MetricCard label="Minimum file size" value={formatBytes(scanFilters.minFileSize || 0)} />
      <MetricCard label="Formats" value={scanFilters.formats?.join(", ") || "All"} />
    </div>
  );
}

function StatsTab({ stats }: { stats: LibraryStats }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <MetricCard label="Songs" value={String(stats.totalSongs)} />
      <MetricCard label="Duration" value={formatDuration(stats.totalDuration)} />
      <MetricCard label="Artists" value={String(stats.artistsCount)} />
      <MetricCard label="Albums" value={String(stats.albumsCount)} />
      <MetricCard label="Duplicates" value={String(stats.duplicatesCount)} />
      <MetricCard label="Library size" value={formatBytes(stats.totalFileSize)} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-white/35">{label}</div>
      <div className="truncate text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/35">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-white/50">{description}</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  if (minutes < 60) return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
