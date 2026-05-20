import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "@/types/song";

export type PlaylistGroupType = "recent" | "favorites" | "custom" | "daily";

export interface PlaylistGroup {
  id: string;
  type: PlaylistGroupType;
  name: string;
  cover: string;
  songs: Song[];
  createdAt: number;
  updatedAt: number;
}

interface PlaylistGroupState {
  groups: PlaylistGroup[];
  currentGroupId: string | null;

  createGroup: (name: string, type: PlaylistGroupType) => string;
  createGroupFromSongs: (name: string, songs: Song[], type?: PlaylistGroupType) => string;
  deleteGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<PlaylistGroup>) => void;
  addSongToGroup: (groupId: string, song: Song) => void;
  removeSongFromGroup: (groupId: string, songId: string) => void;
  setCurrentGroup: (groupId: string | null) => void;
  getGroupById: (groupId: string) => PlaylistGroup | undefined;
  getDefaultGroups: () => PlaylistGroup[];
}

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop";

const generateId = () => Math.random().toString(36).substring(2, 15);

function createDefaultGroups(): PlaylistGroup[] {
  const now = Date.now();

  return [
    {
      id: "recent",
      type: "recent",
      name: "Recently Played",
      cover: DEFAULT_COVER,
      songs: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "favorites",
      type: "favorites",
      name: "Favorites",
      cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop",
      songs: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "daily",
      type: "daily",
      name: "Daily Recommendations",
      cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=600&fit=crop",
      songs: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function dedupeSongs(songs: Song[]): Song[] {
  const seen = new Set<string>();

  return songs.filter((song) => {
    if (seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
}

function normalizeGroupName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Untitled playlist";
}

export const usePlaylistGroupStore = create<PlaylistGroupState>()(
  persist(
    (set, get) => ({
      groups: createDefaultGroups(),
      currentGroupId: null,

      createGroup: (name, type) => get().createGroupFromSongs(name, [], type),

      createGroupFromSongs: (name, songs, type = "custom") => {
        const id = generateId();
        const now = Date.now();
        const uniqueSongs = dedupeSongs(songs);
        const newGroup: PlaylistGroup = {
          id,
          type,
          name: normalizeGroupName(name),
          cover: uniqueSongs[0]?.cover || DEFAULT_COVER,
          songs: uniqueSongs,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({ groups: [...state.groups, newGroup], currentGroupId: id }));
        return id;
      },

      deleteGroup: (groupId) =>
        set((state) => ({
          groups: state.groups.filter((group) => group.id !== groupId),
          currentGroupId: state.currentGroupId === groupId ? null : state.currentGroupId,
        })),

      updateGroup: (groupId, updates) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId ? { ...group, ...updates, updatedAt: Date.now() } : group
          ),
        })),

      addSongToGroup: (groupId, song) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  songs: group.songs.some((item) => item.id === song.id)
                    ? group.songs
                    : [...group.songs, song],
                  updatedAt: Date.now(),
                }
              : group
          ),
        })),

      removeSongFromGroup: (groupId, songId) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  songs: group.songs.filter((song) => song.id !== songId),
                  updatedAt: Date.now(),
                }
              : group
          ),
        })),

      setCurrentGroup: (groupId) => set({ currentGroupId: groupId }),

      getGroupById: (groupId) => get().groups.find((group) => group.id === groupId),

      getDefaultGroups: () => get().groups.filter((group) => group.type !== "custom"),
    }),
    {
      name: "playlist-group-store-v1",
      partialize: (state) => ({ groups: state.groups, currentGroupId: state.currentGroupId }),
    }
  )
);
