import { create } from "zustand";
import { buildSession, type SmartMixInput, type SmartMixSession } from "@/lib/mix/sessionBuilder";
import { usePlaylistGroupStore } from "./playlistGroupStore";
import { useQueueStore } from "./queueStore";

interface SmartMixState {
  currentSession: SmartMixSession | null;
  lastInput: SmartMixInput | null;
  start: (input: SmartMixInput) => SmartMixSession;
  regenerate: () => SmartMixSession | null;
  clear: () => void;
  commitToQueue: () => void;
  saveCurrentAsPlaylist: (name?: string) => string | null;
}

export const useSmartMixStore = create<SmartMixState>((set, get) => ({
  currentSession: null,
  lastInput: null,

  start: (input) => {
    const session = buildSession(input);
    set({ currentSession: session, lastInput: input });
    return session;
  },

  regenerate: () => {
    const input = get().lastInput;
    if (!input) return null;

    const session = buildSession(input);
    set({ currentSession: session });
    return session;
  },

  clear: () => set({ currentSession: null, lastInput: null }),

  commitToQueue: () => {
    const session = get().currentSession;
    if (!session) return;
    useQueueStore.getState().setQueue(session.songs);
  },

  saveCurrentAsPlaylist: (name) => {
    const session = get().currentSession;
    if (!session || session.songs.length === 0) return null;

    const seedTitle = session.songs[0]?.title || "Smart Mix";
    return usePlaylistGroupStore
      .getState()
      .createGroupFromSongs(name || `Smart Mix - ${seedTitle}`, session.songs, "custom");
  },
}));

export type { SmartMixInput, SmartMixSession };
