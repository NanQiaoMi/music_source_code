"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Edit3, FileText, Image, Upload, X } from "lucide-react";
import { CoverData, LyricData, useLyricsCoverStore } from "@/store/lyricsCoverStore";
import { usePlaylistStore } from "@/store/playlistStore";
import type { Song } from "@/types/song";

interface LyricsCoverEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ITEMS = [
  { id: "lyrics", name: "Lyrics" },
  { id: "cover", name: "Cover" },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

export const LyricsCoverEditor: React.FC<LyricsCoverEditorProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>("lyrics");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const { songs } = usePlaylistStore();

  const {
    lyrics,
    covers,
    currentLyric,
    loadLyric,
    saveLyric,
    importLRC,
    exportLRC,
    loadCover,
    saveCover,
    importCoverImage,
  } = useLyricsCoverStore();

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#1c1c1e]/90 shadow-2xl backdrop-blur-[40px]"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30">
              <Edit3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Lyrics & Cover Editor</h2>
              <p className="text-sm text-white/60">Edit LRC lyrics and manage cover images</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-white/10">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-4 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-500 bg-white/5 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === "lyrics" && (
            <LyricsTab
              songs={songs}
              selectedSong={selectedSong}
              onSelectSong={setSelectedSong}
              lyrics={lyrics}
              currentLyric={currentLyric}
              onLoadLyric={loadLyric}
              onSaveLyric={saveLyric}
              onImportLRC={importLRC}
              onExportLRC={exportLRC}
            />
          )}

          {activeTab === "cover" && (
            <CoverTab
              songs={songs}
              selectedSong={selectedSong}
              onSelectSong={setSelectedSong}
              covers={covers}
              onLoadCover={loadCover}
              onSaveCover={saveCover}
              onImportCover={importCoverImage}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

function LyricsTab({
  songs,
  selectedSong,
  onSelectSong,
  lyrics: _lyrics,
  currentLyric,
  onLoadLyric,
  onSaveLyric: _onSaveLyric,
  onImportLRC,
  onExportLRC,
}: {
  songs: Song[];
  selectedSong: Song | null;
  onSelectSong: (song: Song | null) => void;
  lyrics: LyricData[];
  currentLyric: LyricData | null;
  onLoadLyric: (songId: string) => unknown;
  onSaveLyric: (lyric: LyricData) => void;
  onImportLRC: (songId: string, lrcText: string) => unknown;
  onExportLRC: (songId: string) => string;
}) {
  const [lrcText, setLrcText] = useState("");

  const handleImport = () => {
    if (selectedSong && lrcText.trim()) {
      onImportLRC(selectedSong.id, lrcText);
      setLrcText("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <SongPicker
          songs={songs}
          selectedSong={selectedSong}
          onSelectSong={onSelectSong}
          onLoad={onLoadLyric}
        />

        <div className="md:col-span-2">
          <h3 className="mb-4 font-semibold text-white">
            {selectedSong ? `Editing: ${selectedSong.title}` : "Select a song"}
          </h3>

          {selectedSong && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-white/80">LRC text</label>
                <textarea
                  value={lrcText}
                  onChange={(event) => setLrcText(event.target.value)}
                  placeholder="Paste LRC lyrics here..."
                  className="h-40 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={!lrcText.trim()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 font-medium text-white transition-all duration-200 hover:from-blue-600 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  Import LRC
                </button>

                {currentLyric && (
                  <button
                    onClick={() => {
                      const lrc = onExportLRC(selectedSong.id);
                      const blob = new Blob([lrc], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const anchor = document.createElement("a");
                      anchor.href = url;
                      anchor.download = `${selectedSong.title}.lrc`;
                      anchor.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-white/20"
                  >
                    <FileText className="h-4 w-4" />
                    Export LRC
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoverTab({
  songs,
  selectedSong,
  onSelectSong,
  covers: _covers,
  onLoadCover,
  onSaveCover: _onSaveCover,
  onImportCover,
}: {
  songs: Song[];
  selectedSong: Song | null;
  onSelectSong: (song: Song | null) => void;
  covers: CoverData[];
  onLoadCover: (songId: string) => CoverData | null;
  onSaveCover: (cover: CoverData) => void;
  onImportCover: (songId: string, imageData: string, format: string) => unknown;
}) {
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedSong && event.target.files?.[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const imageData = readerEvent.target?.result as string;
        const format = file.type.includes("png") ? "png" : "jpg";
        onImportCover(selectedSong.id, imageData, format);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <SongPicker
          songs={songs}
          selectedSong={selectedSong}
          onSelectSong={onSelectSong}
          onLoad={onLoadCover}
        />

        <div className="md:col-span-2">
          <h3 className="mb-4 font-semibold text-white">
            {selectedSong ? `Cover: ${selectedSong.title}` : "Select a song"}
          </h3>

          {selectedSong && (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {selectedSong.cover ? (
                    <img
                      src={selectedSong.cover}
                      alt={selectedSong.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image className="h-16 w-16 text-white/40" />
                  )}
                </div>
              </div>

              <div className="text-center">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 font-medium text-white transition-all duration-200 hover:from-blue-600 hover:to-cyan-600">
                  <Upload className="h-4 w-4" />
                  Upload cover
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SongPicker({
  songs,
  selectedSong,
  onSelectSong,
  onLoad,
}: {
  songs: Song[];
  selectedSong: Song | null;
  onSelectSong: (song: Song | null) => void;
  onLoad: (songId: string) => unknown;
}) {
  return (
    <div className="md:col-span-1">
      <h3 className="mb-4 font-semibold text-white">Select song</h3>
      <div className="max-h-80 min-h-0 space-y-2 overflow-y-auto">
        {songs.map((song) => (
          <button
            key={song.id}
            onClick={() => {
              onSelectSong(song);
              onLoad(song.id);
            }}
            className={`w-full rounded-xl p-3 text-left transition-all duration-200 ${
              selectedSong?.id === song.id
                ? "border border-blue-500/30 bg-blue-500/20"
                : "border border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <div className="truncate text-sm font-medium text-white">{song.title}</div>
            <div className="truncate text-xs text-white/60">{song.artist}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
