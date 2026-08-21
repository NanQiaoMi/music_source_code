"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Edit2, Eye, Plus, Save, Trash2 } from "lucide-react";
import { BatchEditOperation, useMetadataEditorStore } from "@/store/metadataEditorStore";
import { usePlaylistStore } from "@/store/playlistStore";

type EditType = BatchEditOperation["type"];

interface BatchMetadataEditorProps {
  className?: string;
}

const EDIT_FIELDS = [
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
  { value: "genre", label: "Genre" },
  { value: "year", label: "Year" },
  { value: "composer", label: "Composer" },
  { value: "lyricist", label: "Lyricist" },
];

const EDIT_TYPES: { value: EditType; label: string }[] = [
  { value: "set", label: "Set" },
  { value: "clear", label: "Clear" },
  { value: "replace", label: "Replace" },
  { value: "append", label: "Append" },
];

export const BatchMetadataEditor: React.FC<BatchMetadataEditorProps> = ({ className = "" }) => {
  const { songs } = usePlaylistStore();
  const {
    operations,
    previewChanges,
    regexPresets,
    setSelectedSongs,
    addOperation,
    removeOperation,
    clearOperations,
    generatePreview,
    applyChanges,
  } = useMetadataEditorStore();

  const [activeTab, setActiveTab] = useState<"select" | "edit" | "preview">("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editField, setEditField] = useState("artist");
  const [editValue, setEditValue] = useState("");
  const [editType, setEditType] = useState<EditType>("set");
  const [searchValue, setSearchValue] = useState("");
  const [regexPattern] = useState("");

  const handleSelectAll = () => {
    setSelectedIds(songs.map((song) => song.id));
    setSelectedSongs(songs);
  };

  const handleToggleSong = (songId: string) => {
    const nextSelected = selectedIds.includes(songId)
      ? selectedIds.filter((id) => id !== songId)
      : [...selectedIds, songId];

    setSelectedIds(nextSelected);
    setSelectedSongs(songs.filter((song) => nextSelected.includes(song.id)));
  };

  const handleAddOperation = () => {
    if (selectedIds.length === 0) return;
    if (editType !== "clear" && editValue.trim().length === 0) return;

    addOperation({
      id: Date.now().toString(),
      type: editType,
      field: editField,
      value: editValue,
      searchValue: editType === "replace" ? searchValue : undefined,
      applyToSelected: true,
      selectedSongIds: selectedIds,
      createdAt: Date.now(),
    });

    setEditValue("");
    setSearchValue("");
  };

  const handleApplyRegex = () => {
    const preset = regexPresets.find((item) => item.name === regexPattern);
    if (!preset) return;

    songs.forEach((song) => {
      const extracted = extractMetadataFromFilename(song.title, preset.pattern, preset.fields);
      Object.entries(extracted).forEach(([field, value]) => {
        addOperation({
          id: `${Date.now()}-${song.id}-${field}`,
          type: "set",
          field,
          value,
          applyToSelected: false,
          selectedSongIds: [song.id],
          createdAt: Date.now(),
        });
      });
    });
  };

  const handleGeneratePreview = () => {
    generatePreview();
    setActiveTab("preview");
  };

  const handleApplyChanges = () => {
    applyChanges();
    setActiveTab("select");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl ${className}`}
    >
      <div className="border-b border-white/10 p-6">
        <h2 className="flex items-center gap-3 text-xl font-bold text-white">
          <Edit2 className="h-6 w-6" />
          Batch Metadata Editor
        </h2>
      </div>

      <div className="p-6">
        <div className="mb-6 flex gap-2">
          <TabButton active={activeTab === "select"} onClick={() => setActiveTab("select")}>
            Select Songs ({selectedIds.length})
          </TabButton>
          <TabButton active={activeTab === "edit"} onClick={() => setActiveTab("edit")}>
            Edit Queue ({operations.length})
          </TabButton>
          <TabButton active={activeTab === "preview"} onClick={() => setActiveTab("preview")}>
            Preview
          </TabButton>
        </div>

        {activeTab === "select" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Choose songs to edit</h3>
              <button
                onClick={handleSelectAll}
                className="rounded-xl bg-blue-500/20 px-4 py-2 text-blue-300 transition-all hover:bg-blue-500/30"
              >
                Select all ({songs.length})
              </button>
            </div>

            <div className="max-h-96 min-h-0 space-y-2 overflow-y-auto custom-scrollbar">
              {songs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => handleToggleSong(song.id)}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 transition-all ${
                    selectedIds.includes(song.id)
                      ? "border border-blue-500/50 bg-blue-500/20"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="h-12 w-12 overflow-hidden rounded-lg bg-white/10">
                    {song.cover ? (
                      <img
                        src={song.cover}
                        alt={song.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/40">
                        *
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-white">{song.title}</div>
                    <div className="text-sm text-white/60">{song.artist}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "edit" && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-4 font-semibold text-white">Add batch operation</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-white/60">Field</label>
                  <select
                    value={editField}
                    onChange={(event) => setEditField(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white"
                  >
                    {EDIT_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/60">Operation</label>
                  <select
                    value={editType}
                    onChange={(event) => setEditType(event.target.value as EditType)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white"
                  >
                    {EDIT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editType !== "clear" && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm text-white/60">Value</label>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white"
                    placeholder="Enter the new value"
                  />
                </div>
              )}

              {editType === "replace" && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm text-white/60">Search text</label>
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white"
                    placeholder="Text to replace"
                  />
                </div>
              )}

              <button
                onClick={handleAddOperation}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3 text-white transition-all hover:bg-blue-600"
              >
                <Plus className="h-5 w-5" />
                Add operation
              </button>
            </div>

            <div>
              <h3 className="mb-4 font-semibold text-white">Current operations</h3>
              <div className="space-y-2">
                {operations.map((operation) => (
                  <div
                    key={operation.id}
                    className="flex items-center justify-between rounded-xl bg-white/5 p-3"
                  >
                    <div className="text-white/80">
                      <span className="font-medium text-blue-400">{operation.type}</span>{" "}
                      <span className="text-purple-400">{operation.field}</span>{" "}
                      {operation.type !== "clear" && <span>= &quot;{operation.value}&quot;</span>}
                    </div>
                    <button
                      onClick={() => removeOperation(operation.id)}
                      className="rounded-lg p-2 transition-all hover:bg-white/10"
                      aria-label="Remove operation"
                    >
                      <Trash2 className="h-4 w-4 text-white/60" />
                    </button>
                  </div>
                ))}
              </div>

              {operations.length > 0 && (
                <button
                  onClick={clearOperations}
                  className="mt-3 w-full rounded-xl bg-red-500/20 py-2 text-red-300 transition-all hover:bg-red-500/30"
                >
                  Clear operations
                </button>
              )}
            </div>

            <button
              onClick={handleGeneratePreview}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 py-3 text-white transition-all hover:bg-purple-600"
            >
              <Eye className="h-5 w-5" />
              Generate preview
            </button>

            <button
              onClick={handleApplyRegex}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        )}

        {activeTab === "preview" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Preview changes</h3>
            <div className="max-h-96 min-h-0 space-y-2 overflow-y-auto custom-scrollbar">
              {Array.from(previewChanges.entries()).map(([songId, changes]) => {
                const song = songs.find((item) => item.id === songId);
                if (!song) return null;

                return (
                  <div key={songId} className="rounded-xl bg-white/5 p-4">
                    <div className="mb-2 font-medium text-white">{song.title}</div>
                    <div className="space-y-1">
                      {Object.entries(changes).map(([field, value]) => (
                        <div key={field} className="text-sm">
                          <span className="text-white/60">{field}:</span>{" "}
                          <span className="text-green-400">{value?.toString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab("edit")}
                className="flex-1 rounded-xl bg-white/10 py-3 text-white transition-all hover:bg-white/20"
              >
                Back to edit
              </button>
              <button
                onClick={handleApplyChanges}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-white transition-all hover:bg-green-600"
              >
                <Save className="h-5 w-5" />
                Apply changes
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 transition-all ${
        active ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function extractMetadataFromFilename(
  filename: string,
  pattern: string,
  fields: { field: string; group: number }[]
) {
  const regex = new RegExp(pattern);
  const match = filename.match(regex);

  if (!match) {
    return {};
  }

  const result: Record<string, string> = {};
  fields.forEach(({ field, group }) => {
    if (match[group]) {
      result[field] = match[group].trim();
    }
  });

  return result;
}
