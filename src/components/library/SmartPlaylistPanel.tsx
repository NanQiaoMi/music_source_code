"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileInput,
  ListMusic,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { useEmotionStore } from "@/store/emotionStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import {
  useSmartPlaylistStore,
  type PlaylistExportFormat,
  type SmartPlaylist,
  type SmartPlaylistRule,
  type SmartPlaylistType,
} from "@/store/smartPlaylistStore";
import { toast } from "@/components/shared/GlassToast";
import {
  buildSmartPlaylistRule,
  DEFAULT_SMART_PLAYLIST_RULE_DRAFT,
  getSmartPlaylistOperatorOptions,
  normalizeSmartPlaylistOperator,
  SMART_PLAYLIST_FIELD_OPTIONS,
} from "@/lib/library/smartPlaylistRules";
import { evaluateSmartPlaylistRules } from "@/lib/smart-playlist/ruleEngine";
import type { Song } from "@/types/song";

interface SmartPlaylistPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = "system" | "custom" | "import";

type RuleField = SmartPlaylistRule["field"];

const TAB_ITEMS: { id: TabId; label: string }[] = [
  { id: "system", label: "System" },
  { id: "custom", label: "Rules" },
  { id: "import", label: "Import / Export" },
];

const FORMAT_OPTIONS: { value: PlaylistExportFormat; label: string; ext: string; type: string }[] =
  [
    { value: "m3u", label: "M3U", ext: "m3u", type: "audio/x-mpegurl" },
    { value: "m3u8", label: "M3U8", ext: "m3u8", type: "audio/x-mpegurl" },
    { value: "pls", label: "PLS", ext: "pls", type: "audio/x-scpls" },
    { value: "xspf", label: "XSPF", ext: "xspf", type: "application/xspf+xml" },
    { value: "wpl", label: "WPL", ext: "wpl", type: "application/vnd.ms-wpl" },
    { value: "txt", label: "TXT", ext: "txt", type: "text/plain" },
  ];

function nextRuleId() {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function playlistSummary(playlist: SmartPlaylist) {
  if (playlist.rules.length === 0) return "No rules";
  return `${playlist.rules.length} rule${playlist.rules.length === 1 ? "" : "s"}`;
}

function playSongs(songs: Song[]) {
  if (songs.length === 0) {
    toast.info("No matching songs");
    return;
  }
  useQueueStore.getState().setQueue(songs);
  useAudioStore.getState().playQueue(songs, 0);
  toast.success(`Queued ${songs.length} songs`);
}

export const SmartPlaylistPanel: React.FC<SmartPlaylistPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>("system");
  const { songs } = usePlaylistStore();
  const emotionMap = useEmotionStore((state) => state.emotionMap);
  const {
    customPlaylists,
    createSmartPlaylist,
    deleteSmartPlaylist,
    addRule,
    deleteRule,
    generatePlaylist,
    exportPlaylist,
    importPlaylist,
    getDefaultSmartPlaylists,
  } = useSmartPlaylistStore();

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.98, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/92 shadow-2xl backdrop-blur-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-200">
              <ListMusic className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Smart Playlists</h2>
              <p className="text-sm text-white/50">
                Generate queues from system lists, custom rules, and playlist files.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close smart playlists"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <nav className="flex border-b border-white/10">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-rose-400 bg-white/5 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
          {activeTab === "system" && (
            <SystemPlaylistsTab
              songs={songs}
              emotionMap={emotionMap}
              generatePlaylist={generatePlaylist}
              getDefaultPlaylists={getDefaultSmartPlaylists}
            />
          )}
          {activeTab === "custom" && (
            <CustomRulesTab
              songs={songs}
              emotionMap={emotionMap}
              playlists={customPlaylists}
              createSmartPlaylist={createSmartPlaylist}
              deleteSmartPlaylist={deleteSmartPlaylist}
              addRule={addRule}
              deleteRule={deleteRule}
              generatePlaylist={generatePlaylist}
            />
          )}
          {activeTab === "import" && (
            <ImportExportTab
              songs={songs}
              exportPlaylist={exportPlaylist}
              importPlaylist={importPlaylist}
            />
          )}
        </main>
      </motion.div>
    </motion.div>
  );
};

function SystemPlaylistsTab({
  songs,
  emotionMap,
  generatePlaylist,
  getDefaultPlaylists,
}: {
  songs: Song[];
  emotionMap: Record<string, { x: number; y: number } | undefined>;
  generatePlaylist: (
    playlist: SmartPlaylist,
    songs: Song[],
    inputs?: { emotions?: typeof emotionMap }
  ) => Song[];
  getDefaultPlaylists: () => SmartPlaylist[];
}) {
  const playlists = getDefaultPlaylists();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">System lists</h3>
          <p className="text-sm text-white/50">
            Ready-made playlists based on library, queue history, stats, and emotion tags.
          </p>
        </div>
        <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/60">
          {songs.length} songs
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {playlists.map((playlist) => {
          const preview = generatePlaylist(playlist, songs, { emotions: emotionMap });
          return (
            <section
              key={playlist.id}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-200">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate font-semibold text-white">{playlist.name}</h4>
                  <p className="mt-1 text-sm text-white/50">{playlist.description}</p>
                </div>
              </div>
              <div className="mb-4 flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm text-white/60">
                <span>Preview count</span>
                <span className="font-semibold text-white">{preview.length}</span>
              </div>
              <button
                onClick={() => playSongs(preview)}
                disabled={preview.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
              >
                <Play className="h-4 w-4" />
                Play now
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CustomRulesTab({
  songs,
  emotionMap,
  playlists,
  createSmartPlaylist,
  deleteSmartPlaylist,
  addRule,
  deleteRule,
  generatePlaylist,
}: {
  songs: Song[];
  emotionMap: Record<string, { x: number; y: number } | undefined>;
  playlists: SmartPlaylist[];
  createSmartPlaylist: (
    name: string,
    type: SmartPlaylistType,
    rules?: SmartPlaylistRule[]
  ) => SmartPlaylist;
  deleteSmartPlaylist: (id: string) => void;
  addRule: (playlistId: string, rule: SmartPlaylistRule) => void;
  deleteRule: (playlistId: string, ruleId: string) => void;
  generatePlaylist: (
    playlist: SmartPlaylist,
    songs: Song[],
    inputs?: { emotions?: typeof emotionMap }
  ) => Song[];
}) {
  const [newPlaylistName, setNewPlaylistName] = useState("Focus mix");
  const [selectedId, setSelectedId] = useState<string | null>(playlists[0]?.id ?? null);
  const [draftRule, setDraftRule] = useState<Omit<SmartPlaylistRule, "id">>(
    DEFAULT_SMART_PLAYLIST_RULE_DRAFT
  );

  const selectedPlaylist =
    playlists.find((playlist) => playlist.id === selectedId) || playlists[0] || null;
  const preview = useMemo(
    () =>
      selectedPlaylist ? generatePlaylist(selectedPlaylist, songs, { emotions: emotionMap }) : [],
    [emotionMap, generatePlaylist, selectedPlaylist, songs]
  );
  const draftPreviewCount = useMemo(() => {
    const normalizedDraft = buildSmartPlaylistRule("draft-rule", draftRule);

    return songs.filter((song) => evaluateSmartPlaylistRules(song, [normalizedDraft], emotionMap))
      .length;
  }, [draftRule, emotionMap, songs]);

  const createPlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) {
      toast.warning("Enter a playlist name");
      return;
    }
    const playlist = createSmartPlaylist(name, "custom");
    setSelectedId(playlist.id);
    setNewPlaylistName("");
    toast.success("Smart playlist created");
  };

  const updateDraftField = (field: RuleField) => {
    setDraftRule((current) => ({
      ...current,
      field,
      operator: normalizeSmartPlaylistOperator(field, current.operator),
      value: field === "emotion" ? "Q1" : current.value,
    }));
  };

  const saveRule = () => {
    if (!selectedPlaylist) {
      toast.warning("Create a playlist first");
      return;
    }
    if (draftRule.value === "") {
      toast.warning("Enter a rule value");
      return;
    }
    addRule(selectedPlaylist.id, buildSmartPlaylistRule(nextRuleId(), draftRule));
    setDraftRule(DEFAULT_SMART_PLAYLIST_RULE_DRAFT);
    toast.success("Rule saved");
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/45">
            New playlist
          </label>
          <div className="flex gap-2">
            <input
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
              placeholder="Playlist name"
            />
            <button
              onClick={createPlaylist}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white hover:bg-rose-400"
              aria-label="Create smart playlist"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {playlists.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-white/45">
              No custom playlists yet.
            </div>
          ) : (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => setSelectedId(playlist.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selectedPlaylist?.id === playlist.id
                    ? "border-rose-300/50 bg-rose-500/10"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                }`}
              >
                <div className="font-medium text-white">{playlist.name}</div>
                <div className="mt-1 text-xs text-white/45">{playlistSummary(playlist)}</div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="space-y-5">
        {!selectedPlaylist ? (
          <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/50">
            Create a playlist to start adding rules.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedPlaylist.name}</h3>
                <p className="text-sm text-white/50">
                  {preview.length} matching songs from {songs.length} total
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => playSongs(preview)}
                  disabled={preview.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:bg-white/10 disabled:text-white/40"
                >
                  <Play className="h-4 w-4" />
                  Play now
                </button>
                <button
                  onClick={() => {
                    deleteSmartPlaylist(selectedPlaylist.id);
                    setSelectedId(null);
                    toast.success("Playlist deleted");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/25"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Save className="h-4 w-4 text-rose-200" />
                  Add rule
                </div>
                <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-100/70">
                    Draft preview
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {draftPreviewCount} songs would match this rule
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                <select
                  value={draftRule.field}
                  onChange={(event) => updateDraftField(event.target.value as RuleField)}
                  className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
                >
                  {SMART_PLAYLIST_FIELD_OPTIONS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
                {draftRule.field === "emotion" ? (
                  <select
                    value={String(draftRule.value)}
                    onChange={(event) =>
                      setDraftRule((current) => ({ ...current, value: event.target.value }))
                    }
                    className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
                  >
                    <option value="Q1">Q1 positive / energetic</option>
                    <option value="Q2">Q2 tense / energetic</option>
                    <option value="Q3">Q3 tense / calm</option>
                    <option value="Q4">Q4 positive / calm</option>
                  </select>
                ) : (
                  <input
                    value={String(draftRule.value)}
                    onChange={(event) =>
                      setDraftRule((current) => ({ ...current, value: event.target.value }))
                    }
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/60"
                    placeholder="Value"
                  />
                )}
                <button
                  onClick={saveRule}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  <Plus className="h-4 w-4" />
                  Save rule
                </button>
              </div>
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
                  Operator chips
                </div>
                <div className="flex flex-wrap gap-2">
                  {getSmartPlaylistOperatorOptions(draftRule.field).map((operator) => (
                    <button
                      key={operator.value}
                      type="button"
                      onClick={() =>
                        setDraftRule((current) => ({ ...current, operator: operator.value }))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        normalizeSmartPlaylistOperator(draftRule.field, draftRule.operator) ===
                        operator.value
                          ? "border-rose-300/60 bg-rose-500/20 text-rose-50"
                          : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
                      }`}
                      aria-pressed={
                        normalizeSmartPlaylistOperator(draftRule.field, draftRule.operator) ===
                        operator.value
                      }
                    >
                      {operator.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {selectedPlaylist.rules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-white/45">
                  This playlist has no rules. It will match every song until you add one.
                </div>
              ) : (
                selectedPlaylist.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <div className="min-w-0 text-sm text-white/75">
                      <span className="font-semibold text-white">{rule.field}</span> {rule.operator}{" "}
                      <span className="font-semibold text-white">{String(rule.value)}</span>
                    </div>
                    <button
                      onClick={() => deleteRule(selectedPlaylist.id, rule.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-200 hover:bg-red-500/25"
                      aria-label="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ImportExportTab({
  songs,
  exportPlaylist,
  importPlaylist,
}: {
  songs: Song[];
  exportPlaylist: (songs: Song[], format: PlaylistExportFormat) => string;
  importPlaylist: (content: string, format: PlaylistExportFormat, songs: Song[]) => Song[];
}) {
  const [exportFormat, setExportFormat] = useState<PlaylistExportFormat>("m3u");
  const [importFormat, setImportFormat] = useState<PlaylistExportFormat>("m3u");
  const [importText, setImportText] = useState("");
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const exportCurrent = () => {
    const format = FORMAT_OPTIONS.find((item) => item.value === exportFormat) || FORMAT_OPTIONS[0];
    const content = exportPlaylist(songs, exportFormat);
    const blob = new Blob([content], { type: format.type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `playlist.${format.ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${format.label}`);
  };

  const previewImport = () => {
    const matched = importPlaylist(importText, importFormat, songs);
    setImportedCount(matched.length);
    if (matched.length > 0) {
      useQueueStore.getState().setQueue(matched);
      toast.success(`Imported ${matched.length} songs into the queue`);
    } else {
      toast.info("No library songs matched the imported playlist");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-4 w-4 text-rose-200" />
          <h3 className="font-semibold text-white">Export library</h3>
        </div>
        <p className="mb-4 text-sm text-white/50">
          Export the current library list in a playlist format.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map((format) => (
            <button
              key={format.value}
              onClick={() => setExportFormat(format.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                exportFormat === format.value
                  ? "border-rose-300/50 bg-rose-500/15 text-rose-100"
                  : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
              }`}
            >
              {format.label}
            </button>
          ))}
        </div>
        <button
          onClick={exportCurrent}
          disabled={songs.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:bg-white/10 disabled:text-white/40"
        >
          <FileInput className="h-4 w-4" />
          Export {songs.length} songs
        </button>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-4 flex items-center gap-2">
          <Upload className="h-4 w-4 text-rose-200" />
          <h3 className="font-semibold text-white">Import playlist text</h3>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {FORMAT_OPTIONS.filter((format) => format.value !== "txt").map((format) => (
            <button
              key={format.value}
              onClick={() => setImportFormat(format.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                importFormat === format.value
                  ? "border-rose-300/50 bg-rose-500/15 text-rose-100"
                  : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
              }`}
            >
              {format.label}
            </button>
          ))}
        </div>
        <textarea
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          className="mb-3 h-36 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-rose-300/60"
          placeholder="Paste playlist contents here"
        />
        <button
          onClick={previewImport}
          disabled={!importText.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/35"
        >
          <Upload className="h-4 w-4" />
          Match and queue songs
        </button>
        {importedCount !== null && (
          <p className="mt-3 text-sm text-white/50">Last import matched {importedCount} songs.</p>
        )}
      </section>
    </div>
  );
}
