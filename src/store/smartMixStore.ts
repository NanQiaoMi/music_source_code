import { create } from "zustand";
import { buildSession, type SmartMixInput, type SmartMixSession } from "@/lib/mix/sessionBuilder";
import { useQueueStore } from "./queueStore";

interface SmartMixState {
  currentSession: SmartMixSession | null;
  lastInput: SmartMixInput | null;
  start: (input: SmartMixInput) => SmartMixSession;
  regenerate: () => SmartMixSession | null;
  clear: () => void;
  commitToQueue: () => void;
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
}));

export type { SmartMixInput, SmartMixSession };
