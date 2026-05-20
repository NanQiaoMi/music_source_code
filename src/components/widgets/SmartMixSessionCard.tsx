"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ListMusic, Play, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useSmartMixStore } from "@/store/smartMixStore";
import type { SmartMixKnobs } from "@/lib/mix/sessionBuilder";
import type { Song } from "@/types/song";

const DEFAULT_KNOBS: SmartMixKnobs = {
  energy: 0.65,
  familiarity: 0.45,
  length: 12,
};

export function SmartMixSessionCard() {
  const songs = usePlaylistStore((state) => state.songs);
  const playQueue = useAudioStore((state) => state.playQueue);
  const { currentSession, start, regenerate, commitToQueue } = useSmartMixStore();
  const [knobs, setKnobs] = useState<SmartMixKnobs>(DEFAULT_KNOBS);
  const [selectedSeedId, setSelectedSeedId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState("Choose a seed track to shape a Smart Mix.");
  const seedSong = useMemo(
    () => songs.find((song) => song.id === selectedSeedId) || songs[0] || null,
    [selectedSeedId, songs]
  );
  const recentSongIds = useMemo(() => songs.slice(0, 5).map((song) => song.id), [songs]);

  const canStart = Boolean(seedSong) && songs.length > 0;
  const sessionSongs = currentSession?.songs || [];

  const updateKnob = (key: keyof SmartMixKnobs, value: number) => {
    setKnobs((current) => ({ ...current, [key]: value }));
  };

  const handleStart = () => {
    if (!seedSong) return;
    const session = start({
      seedSong,
      library: songs,
      recentSongIds,
      knobs,
    });
    setStatusMessage(`Mix ready: ${session.songs.length} tracks from ${seedSong.title}`);
  };

  const handlePlay = () => {
    if (!currentSession || currentSession.songs.length === 0) return;
    commitToQueue();
    playQueue(currentSession.songs, 0);
    setStatusMessage(`Queued ${currentSession.songs.length} Smart Mix tracks`);
  };

  const handleRegenerate = () => {
    const session = regenerate();
    if (!session) return;
    const seedTitle = session.songs[0]?.title || "the seed track";
    setStatusMessage(`Regenerated mix: ${session.songs.length} tracks from ${seedTitle}`);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur-xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Smart Mix Session</h3>
            <p className="text-sm text-white/50">
              Shape a queue from one seed track and three simple controls.
            </p>
          </div>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
          {sessionSongs.length > 0 ? `${sessionSongs.length} tracks` : "No mix"}
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="mb-4 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-100"
      >
        {statusMessage}
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-white/40">
            Seed track
          </span>
          <select
            value={seedSong?.id || ""}
            onChange={(event) => setSelectedSeedId(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-fuchsia-300/50"
          >
            {songs.length === 0 ? (
              <option value="">Import songs first</option>
            ) : (
              songs.slice(0, 80).map((song) => (
                <option key={song.id} value={song.id}>
                  {song.title} - {song.artist}
                </option>
              ))
            )}
          </select>
        </label>
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          Start mix
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <KnobSlider
          label="Energy"
          value={knobs.energy}
          min={0}
          max={1}
          step={0.05}
          display={`${Math.round(knobs.energy * 100)}%`}
          onChange={(value) => updateKnob("energy", value)}
        />
        <KnobSlider
          label="Familiarity"
          value={knobs.familiarity}
          min={0}
          max={1}
          step={0.05}
          display={`${Math.round(knobs.familiarity * 100)}%`}
          onChange={(value) => updateKnob("familiarity", value)}
        />
        <LengthStepper value={knobs.length} onChange={(value) => updateKnob("length", value)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={handleRegenerate}
          disabled={!currentSession}
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate
        </button>
        <button
          onClick={handlePlay}
          disabled={!currentSession}
          className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500/20 px-4 py-2 text-sm text-fuchsia-100 transition-colors hover:bg-fuchsia-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
          Play mix
        </button>
      </div>

      <div className="mt-5 space-y-2">
        {sessionSongs.length === 0 ? (
          <EmptyMixState />
        ) : (
          sessionSongs
            .slice(0, 6)
            .map((song, index) => <TrackPreview key={song.id} song={song} index={index} />)
        )}
        {sessionSongs.length > 6 && (
          <div className="text-center text-xs text-white/35">
            +{sessionSongs.length - 6} more tracks in queue
          </div>
        )}
      </div>
    </div>
  );
}

function KnobSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/55">
        <span className="inline-flex items-center gap-1">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {label}
        </span>
        <span>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-fuchsia-300"
      />
    </label>
  );
}

function LengthStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const change = (delta: number) => onChange(Math.max(5, Math.min(50, value + delta)));
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-white/55">
        <span>Length</span>
        <span>{value} tracks</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => change(-1)}
          className="h-9 w-9 rounded-lg bg-white/10 text-white/70 hover:bg-white/15"
          aria-label="Decrease mix length"
        >
          -
        </button>
        <input
          type="number"
          min={5}
          max={50}
          value={value}
          onChange={(event) => onChange(Math.max(5, Math.min(50, Number(event.target.value))))}
          className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 text-center text-sm text-white outline-none"
        />
        <button
          onClick={() => change(1)}
          className="h-9 w-9 rounded-lg bg-white/10 text-white/70 hover:bg-white/15"
          aria-label="Increase mix length"
        >
          +
        </button>
      </div>
    </div>
  );
}

function EmptyMixState() {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-center">
      <ListMusic className="mx-auto mb-2 h-5 w-5 text-white/35" />
      <p className="text-sm text-white/50">Start a mix to preview its first tracks.</p>
    </div>
  );
}

function TrackPreview({ song, index }: { song: Song; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs text-white/55">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{song.title}</div>
        <div className="truncate text-xs text-white/45">{song.artist}</div>
      </div>
      {song.genre && (
        <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/45">
          {song.genre}
        </div>
      )}
    </motion.div>
  );
}
