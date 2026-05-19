import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListeningJournalStore, type JournalDay } from "./listeningJournalStore";

function day(date: string, totalMinutes = 10): JournalDay {
  return {
    date,
    totalMinutes,
    topSongIds: [`song-${date}`],
    dominantMood: "focus",
  };
}

describe("listeningJournalStore", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
    useListeningJournalStore.setState({ days: {}, selectedDate: "2026-05-20" });
    localStorage.clear();
  });

  it("upserts a journal day", () => {
    useListeningJournalStore.getState().upsertDay(day("2026-05-20", 42));

    expect(useListeningJournalStore.getState().days["2026-05-20"].totalMinutes).toBe(42);
  });

  it("appends a note to an existing day", () => {
    useListeningJournalStore.getState().upsertDay(day("2026-05-20"));

    useListeningJournalStore.getState().appendNote("2026-05-20", "Late night listening");

    expect(useListeningJournalStore.getState().days["2026-05-20"].note).toBe(
      "Late night listening"
    );
  });

  it("creates an empty day when appending a note to a missing date", () => {
    useListeningJournalStore.getState().appendNote("2026-05-19", "Quiet day");

    expect(useListeningJournalStore.getState().days["2026-05-19"]).toMatchObject({
      date: "2026-05-19",
      totalMinutes: 0,
      topSongIds: [],
      dominantMood: null,
      note: "Quiet day",
    });
  });

  it("returns a seven-day week ending at the anchor date", () => {
    useListeningJournalStore.getState().upsertDay(day("2026-05-18", 18));
    useListeningJournalStore.getState().upsertDay(day("2026-05-20", 20));

    const week = useListeningJournalStore.getState().getWeek("2026-05-20");

    expect(week).toHaveLength(7);
    expect(week[0].date).toBe("2026-05-14");
    expect(week[4].totalMinutes).toBe(18);
    expect(week[6].totalMinutes).toBe(20);
  });

  it("trims journal data to the last 90 days", () => {
    useListeningJournalStore.getState().upsertDay(day("2026-02-01", 1));
    useListeningJournalStore.getState().upsertDay(day("2026-02-20", 2));
    useListeningJournalStore.getState().upsertDay(day("2026-05-20", 3));

    useListeningJournalStore.getState().trimToLast90Days();

    expect(useListeningJournalStore.getState().days["2026-02-01"]).toBeUndefined();
    expect(useListeningJournalStore.getState().days["2026-02-20"]).toBeDefined();
    expect(useListeningJournalStore.getState().days["2026-05-20"]).toBeDefined();
  });
});
