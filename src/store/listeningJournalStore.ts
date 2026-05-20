import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getIsoDate,
  rollupDay,
  type JournalDay,
  type JournalPlayEvent,
} from "@/lib/journal/listeningJournal";

interface ListeningJournalState {
  days: Record<string, JournalDay>;
  eventsByDate: Record<string, JournalPlayEvent[]>;
  selectedDate: string;
  recordPlay: (event: JournalPlayEvent) => void;
  upsertDay: (day: JournalDay) => void;
  appendNote: (date: string, note: string) => void;
  setSelectedDate: (date: string) => void;
  getWeek: (anchorDate?: string) => JournalDay[];
  trimToLast90Days: () => void;
  clear: () => void;
}

function emptyDay(date: string): JournalDay {
  return {
    date,
    totalMinutes: 0,
    topSongIds: [],
    dominantMood: null,
  };
}

function getWeekDates(anchorDate: string): string[] {
  const anchor = new Date(`${anchorDate}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, index) => getIsoDate(index - 6, anchor));
}

export const useListeningJournalStore = create<ListeningJournalState>()(
  persist(
    (set, get) => ({
      days: {},
      eventsByDate: {},
      selectedDate: getIsoDate(),

      recordPlay: (event) =>
        set((state) => {
          const date = getIsoDate(0, new Date(event.playedAt));
          const events = [...(state.eventsByDate[date] || []), event];
          const current = state.days[date] || emptyDay(date);
          const day = rollupDay(date, events, current.note);

          return {
            days: {
              ...state.days,
              [date]: day,
            },
            eventsByDate: {
              ...state.eventsByDate,
              [date]: events,
            },
          };
        }),

      upsertDay: (day) =>
        set((state) => ({
          days: {
            ...state.days,
            [day.date]: day,
          },
        })),

      appendNote: (date, note) =>
        set((state) => {
          const current = state.days[date] || emptyDay(date);
          return {
            days: {
              ...state.days,
              [date]: {
                ...current,
                note,
              },
            },
          };
        }),

      setSelectedDate: (date) => set({ selectedDate: date }),

      getWeek: (anchorDate) => {
        const anchor = anchorDate || getIsoDate();
        return getWeekDates(anchor).map((date) => get().days[date] || emptyDay(date));
      },

      trimToLast90Days: () =>
        set((state) => {
          const cutoff = getIsoDate(-89);
          return {
            days: Object.fromEntries(
              Object.entries(state.days).filter(([date]) => date.localeCompare(cutoff) >= 0)
            ),
            eventsByDate: Object.fromEntries(
              Object.entries(state.eventsByDate).filter(([date]) => date.localeCompare(cutoff) >= 0)
            ),
          };
        }),

      clear: () => set({ days: {}, eventsByDate: {}, selectedDate: getIsoDate() }),
    }),
    {
      name: "journal-store-v1",
      partialize: (state) => ({
        days: state.days,
        eventsByDate: state.eventsByDate,
        selectedDate: state.selectedDate,
      }),
    }
  )
);

export type { JournalDay };
