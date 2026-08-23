import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
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

const safeStateStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === "undefined") return null;
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(name, value);
    } catch (e: any) {
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        try {
          // 配额超限时自动清理旧版缓存
          localStorage.removeItem("journal-store-v1");
          localStorage.setItem(name, value);
        } catch {
          // 降级内存运行
        }
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === "undefined") return;
      localStorage.removeItem(name);
    } catch {}
  },
};

export const useListeningJournalStore = create<ListeningJournalState>()(
  persist(
    (set, get) => ({
      days: {},
      eventsByDate: {},
      selectedDate: getIsoDate(),

      recordPlay: (event) =>
        set((state) => {
          const date = getIsoDate(0, new Date(event.playedAt));
          // 限制当天事件最大记录数（防无界膨胀）
          const existingEvents = state.eventsByDate[date] || [];
          const events = [...existingEvents.slice(-25), event];
          const current = state.days[date] || emptyDay(date);
          const day = rollupDay(date, events, current.note);

          // 保留最近 14 天数据，自动清理历史旧日志
          const cutoff = getIsoDate(-14);
          const newDays: Record<string, JournalDay> = { [date]: day };
          const newEvents: Record<string, JournalPlayEvent[]> = { [date]: events };

          Object.entries(state.days).forEach(([d, v]) => {
            if (d.localeCompare(cutoff) >= 0 && d !== date) {
              newDays[d] = v;
            }
          });

          Object.entries(state.eventsByDate).forEach(([d, v]) => {
            if (d.localeCompare(cutoff) >= 0 && d !== date) {
              newEvents[d] = v.slice(-25);
            }
          });

          return {
            days: newDays,
            eventsByDate: newEvents,
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
          const cutoff = getIsoDate(-90);
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
      storage: createJSONStorage(() => safeStateStorage),
      partialize: (state) => ({
        days: state.days,
        eventsByDate: state.eventsByDate,
        selectedDate: state.selectedDate,
      }),
    }
  )
);

export type { JournalDay };
