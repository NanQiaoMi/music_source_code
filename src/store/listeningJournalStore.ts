import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getIsoDate, type JournalDay } from "@/lib/journal/listeningJournal";

interface ListeningJournalState {
  days: Record<string, JournalDay>;
  selectedDate: string;
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
      selectedDate: getIsoDate(),

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
          };
        }),

      clear: () => set({ days: {}, selectedDate: getIsoDate() }),
    }),
    {
      name: "journal-store-v1",
      partialize: (state) => ({
        days: state.days,
        selectedDate: state.selectedDate,
      }),
    }
  )
);

export type { JournalDay };
