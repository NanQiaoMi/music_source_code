import type { SearchCommand } from "./commandRouter";
import type { Song } from "@/types/song";

export interface SearchCommandExecutorDeps {
  songs: Song[];
  setQuery: (query: string) => void;
  search: (songs: Song[]) => void;
  addRecentCommand: (command: string) => void;
  setCommandFeedback: (message: string) => void;
  clearQueue: () => void;
  shuffleQueue: () => void;
  addToQueue: (song: Song) => void;
  setCurrentSong: (song: Song) => void;
  setIsPlaying: (playing: boolean) => void;
  nextSong: () => void;
  prevSong: () => void;
  setVolume: (volume: number) => void;
  setSleepTimer: (minutes: number) => void;
  onClose: () => void;
}

function findCommandMatches(searchQuery: string, songs: Song[]): Song[] {
  const needle = searchQuery.toLowerCase().trim();
  if (!needle) return [];

  return songs.filter((song) => {
    const title = song.title.toLowerCase();
    const artist = song.artist.toLowerCase();
    const album = song.album?.toLowerCase() || "";
    return title.includes(needle) || artist.includes(needle) || album.includes(needle);
  });
}

function pluralizeSong(count: number): string {
  return count === 1 ? "song" : "songs";
}

export function executeSearchCommand(
  command: SearchCommand,
  deps: SearchCommandExecutorDeps
): void {
  if (command.kind === "text-search") {
    deps.setQuery(command.query);
    deps.search(deps.songs);
    return;
  }

  deps.addRecentCommand(command.raw.trim());

  if (command.kind === "clear") {
    deps.clearQueue();
    deps.setCommandFeedback("Queue cleared");
    return;
  }

  if (command.kind === "shuffle") {
    deps.shuffleQueue();
    deps.setCommandFeedback("Queue shuffled");
    return;
  }

  if (command.kind === "pause") {
    deps.setIsPlaying(false);
    deps.setCommandFeedback("Playback paused");
    return;
  }

  if (command.kind === "next") {
    deps.nextSong();
    deps.setCommandFeedback("Skipped to next song");
    return;
  }

  if (command.kind === "prev") {
    deps.prevSong();
    deps.setCommandFeedback("Returned to previous song");
    return;
  }

  if (command.kind === "volume") {
    if (command.volume === undefined) {
      deps.setCommandFeedback("Use /volume 60");
      return;
    }

    deps.setVolume(command.volume);
    deps.setCommandFeedback(`Volume set to ${Math.round(command.volume * 100)}%`);
    return;
  }

  if (command.kind === "sleep") {
    if (!command.minutes) {
      deps.setCommandFeedback("Use /sleep 30m");
      return;
    }

    deps.setSleepTimer(command.minutes);
    deps.setCommandFeedback(`Sleep timer set for ${command.minutes} minutes`);
    return;
  }

  const matches = findCommandMatches(command.query, deps.songs);
  if (matches.length === 0) {
    deps.setCommandFeedback(`No matches for "${command.query}"`);
    return;
  }

  if (command.kind === "play") {
    deps.setCurrentSong(matches[0]);
    deps.setIsPlaying(true);
    deps.onClose();
    deps.setCommandFeedback(`Playing ${matches[0].title}`);
    return;
  }

  if (command.kind === "queue") {
    const queued = matches.slice(0, 10);
    queued.forEach((song) => deps.addToQueue(song));
    deps.setCommandFeedback(`Queued ${queued.length} ${pluralizeSong(queued.length)}`);
  }
}
