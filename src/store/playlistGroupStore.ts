import { create } from "zustand";
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

  // Actions
  createGroup: (name: string, type: PlaylistGroupType) => string;
  deleteGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<PlaylistGroup>) => void;
  addSongToGroup: (groupId: string, song: Song) => void;
  removeSongFromGroup: (groupId: string, songId: string) => void;
  setCurrentGroup: (groupId: string | null) => void;
  getGroupById: (groupId: string) => PlaylistGroup | undefined;
  getDefaultGroups: () => PlaylistGroup[];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const usePlaylistGroupStore = create<PlaylistGroupState>((set, get) => ({
  groups: [
    {
      id: "recent",
      type: "recent",
      name: "最近播放",
      cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: "favorites",
      type: "favorites",
      name: "我的收藏",
      cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop",
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: "daily",
      type: "daily",
      name: "每日推荐",
      cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=600&fit=crop",
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  currentGroupId: null,

  createGroup: (name, type) => {
    const id = generateId();
    const newGroup: PlaylistGroup = {
      id,
      type,
      name,
      cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({ groups: [...state.groups, newGroup] }));
    return id;
  },

  deleteGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
    })),

  updateGroup: (groupId, updates) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, ...updates, updatedAt: Date.now() } : g
      ),
    })),

  addSongToGroup: (groupId, song) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              songs: g.songs.some((s) => s.id === song.id) ? g.songs : [...g.songs, song],
              updatedAt: Date.now(),
            }
          : g
      ),
    })),

  removeSongFromGroup: (groupId, songId) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? { ...g, songs: g.songs.filter((s) => s.id !== songId), updatedAt: Date.now() }
          : g
      ),
    })),

  setCurrentGroup: (groupId) => set({ currentGroupId: groupId }),

  getGroupById: (groupId) => {
    return get().groups.find((g) => g.id === groupId);
  },

  getDefaultGroups: () => {
    return get().groups.filter((g) => g.type !== "custom");
  },
}));
