// S6-11c selector snapshots: a key selector must return the store's field reference while that
// field is unchanged, and a new reference only when the selected field changes. Samples cover the
// playlist exported selectors, UI panel state, visual theme state, audio identity and PlaybackClock.
import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { selectSelectedSongIds, selectSongs } from "@/store/selectors/playlistSelectors";
import { useUIStore } from "@/store/uiStore";
import { useVisualSettingsStore, type ThemeColors } from "@/store/visualSettingsStore";
import { getPlaybackClockSnapshot } from "@/lib/playback/playbackClock";
import type { Song } from "@/types/song";

const track = (id: string): Song => ({
  id,
  title: id,
  artist: "contract",
  duration: 180,
  source: "local",
});
const colors = (primary: string): ThemeColors => ({
  primary,
  secondary: "#8b5cf6",
  accent: "#ec4899",
  background: "#0f172a",
  surface: "#1e293b",
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  border: "#334155",
});

type Probe = {
  readonly name: string;
  readonly prepare: () => void;
  readonly read: () => unknown;
  readonly touch: () => void;
  readonly bump: () => void;
};

const PROBES: readonly Probe[] = [
  {
    name: "playlist selectSongs",
    prepare: () => usePlaylistStore.getState().addSong(track("a")),
    read: () => selectSongs(usePlaylistStore.getState()),
    touch: () => usePlaylistStore.getState().setSelectedSong(track("a")),
    bump: () => usePlaylistStore.getState().addSong(track("b")),
  },
  {
    name: "playlist selectSelectedSongIds",
    prepare: () => usePlaylistStore.getState().selectSong("a"),
    read: () => selectSelectedSongIds(usePlaylistStore.getState()),
    touch: () => usePlaylistStore.getState().setSelectedSong(track("a")),
    bump: () => usePlaylistStore.getState().selectSong("b"),
  },
  {
    name: "ui panels slice",
    prepare: () => useUIStore.getState().openPanel("queue"),
    read: () => useUIStore.getState().panels,
    touch: () => useUIStore.getState().setCurrentView("player"),
    bump: () => useUIStore.getState().openPanel("history"),
  },
  {
    name: "visual customTheme slice",
    prepare: () => useVisualSettingsStore.getState().setCustomTheme(colors("#111111")),
    read: () => useVisualSettingsStore.getState().customTheme,
    touch: () => useVisualSettingsStore.getState().setBlurIntensity(33),
    bump: () => useVisualSettingsStore.getState().setCustomTheme(colors("#222222")),
  },
  {
    name: "audio currentSong identity",
    prepare: () => useAudioStore.getState().setCurrentSong(track("a")),
    read: () => useAudioStore.getState().currentSong,
    touch: () => usePlayerStore.getState().setVolume(0.31),
    bump: () => useAudioStore.getState().setCurrentSong(track("b")),
  },
  {
    name: "playbackClock snapshot",
    prepare: () => usePlayerStore.getState().setCurrentTime(12.25),
    read: () => getPlaybackClockSnapshot(),
    touch: () => {
      usePlayerStore.getState().setCurrentSong(track("a"));
      usePlayerStore.getState().toggleMute();
    },
    bump: () => usePlayerStore.getState().setCurrentTime(13),
  },
];

beforeEach(() => {
  usePlaylistStore.setState({
    songs: [],
    filteredSongs: [],
    selectedSong: null,
    searchQuery: "",
    selectedSongIds: new Set<string>(),
  });
  useUIStore.getState().closeAllPanels();
  useUIStore.getState().setCurrentView("home");
  useVisualSettingsStore.getState().resetSettings();
  usePlayerStore.setState({ currentSong: null, currentTime: 0, isMuted: false, volume: 0.7 });
  useAudioStore.setState({ currentSong: null, currentTime: 0, isMuted: false, volume: 0.7 });
});

describe("selector snapshot stability (S6-11c)", () => {
  for (const probe of PROBES) {
    it(probe.name + " changes reference only when the selected field changes", () => {
      probe.prepare();
      const first = probe.read();
      expect(probe.read()).toBe(first);

      probe.touch();
      expect(probe.read()).toBe(first);

      probe.bump();
      expect(probe.read()).not.toBe(first);
      expect(probe.read()).not.toEqual(first);
    });
  }
});
