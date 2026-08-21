import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaylistGroupStore } from "./playlistGroupStore";
import type { Song } from "@/types/song";

function song(id: string, overrides: Partial<Song> = {}): Song {
  return {
    id,
    title: `Song ${id}`,
    artist: "Artist",
    duration: 180,
    source: "local",
    ...overrides,
  };
}

describe("playlistGroupStore", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-05-21T00:00:00.000Z"));
    localStorage.clear();
    usePlaylistGroupStore.setState({ groups: [], currentGroupId: null });
  });

  it("creates a custom playlist group from unique songs", () => {
    const groupId = usePlaylistGroupStore
      .getState()
      .createGroupFromSongs("Road mix", [song("a", { cover: "cover-a" }), song("a"), song("b")]);

    const group = usePlaylistGroupStore.getState().getGroupById(groupId);

    expect(group).toMatchObject({
      id: groupId,
      type: "custom",
      name: "Road mix",
      cover: "cover-a",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    expect(group?.songs.map((item) => item.id)).toEqual(["a", "b"]);
    expect(usePlaylistGroupStore.getState().currentGroupId).toBe(groupId);
  });

  it("normalizes empty playlist names", () => {
    const groupId = usePlaylistGroupStore.getState().createGroupFromSongs("   ", [song("a")]);

    expect(usePlaylistGroupStore.getState().getGroupById(groupId)?.name).toBe("Untitled playlist");
  });
});
