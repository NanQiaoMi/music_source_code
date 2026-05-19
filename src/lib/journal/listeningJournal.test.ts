import { describe, expect, it } from "vitest";
import {
  buildJournalSongRows,
  getIsoDate,
  rollupDay,
  type JournalPlayEvent,
} from "./listeningJournal";

describe("rollupDay", () => {
  it("returns zero minutes and no top songs for an empty day", () => {
    expect(rollupDay("2026-05-20", [])).toEqual({
      date: "2026-05-20",
      totalMinutes: 0,
      topSongIds: [],
      dominantMood: null,
    });
  });

  it("sorts top songs by play count descending", () => {
    const events: JournalPlayEvent[] = [
      { songId: "b", playedAt: 1, listenSeconds: 60 },
      { songId: "a", playedAt: 2, listenSeconds: 120 },
      { songId: "b", playedAt: 3, listenSeconds: 90 },
      { songId: "c", playedAt: 4, listenSeconds: 30 },
      { songId: "a", playedAt: 5, listenSeconds: 60 },
      { songId: "b", playedAt: 6, listenSeconds: 60 },
    ];

    const day = rollupDay("2026-05-20", events);

    expect(day.totalMinutes).toBe(7);
    expect(day.topSongIds).toEqual(["b", "a", "c"]);
  });

  it("resolves dominant mood ties by first seen mood", () => {
    const day = rollupDay("2026-05-20", [
      { songId: "a", playedAt: 1, listenSeconds: 60, mood: "calm" },
      { songId: "b", playedAt: 2, listenSeconds: 60, mood: "focus" },
      { songId: "c", playedAt: 3, listenSeconds: 60, mood: "focus" },
      { songId: "d", playedAt: 4, listenSeconds: 60, mood: "calm" },
    ]);

    expect(day.dominantMood).toBe("calm");
  });

  it("creates ISO date strings from an anchor date", () => {
    expect(getIsoDate(-1, new Date("2026-05-20T12:00:00.000Z"))).toBe("2026-05-19");
  });

  it("builds readable top-song rows from journal song ids", () => {
    const rows = buildJournalSongRows(
      ["b", "missing", "a"],
      [
        {
          id: "a",
          title: "Aurora",
          artist: "Night Drive",
          duration: 180,
          source: "local",
        },
        {
          id: "b",
          title: "Blue Hour",
          artist: "City Lights",
          album: "Late Set",
          duration: 220,
          source: "local",
        },
      ]
    );

    expect(rows).toEqual([
      {
        id: "b",
        title: "Blue Hour",
        artist: "City Lights",
        album: "Late Set",
        missing: false,
      },
      {
        id: "missing",
        title: "missing",
        artist: "Unknown artist",
        album: undefined,
        missing: true,
      },
      {
        id: "a",
        title: "Aurora",
        artist: "Night Drive",
        album: undefined,
        missing: false,
      },
    ]);
  });
});
