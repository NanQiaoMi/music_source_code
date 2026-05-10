import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ShortcutBinding {
  id: string;
  label: string;
  category: string;
  keys: string[];
  description: string;
}

export interface UserShortcutOverride {
  id: string;
  keys: string[];
}

interface KeyboardShortcutsState {
  defaults: ShortcutBinding[];
  overrides: UserShortcutOverride[];
  isRecording: boolean;
  recordingId: string | null;

  getBinding: (id: string) => string[];
  setBinding: (id: string, keys: string[]) => { success: boolean; conflicts: string[] };
  resetBinding: (id: string) => void;
  resetAll: () => void;
  setIsRecording: (id: string | null) => void;
  getAllBindings: () => ShortcutBinding[];
}

const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { id: "play-pause", label: "播放/暂停", category: "播放控制", keys: ["Space"], description: "切换播放与暂停" },
  { id: "seek-back-5", label: "快退 5秒", category: "播放控制", keys: ["ArrowLeft"], description: "后退 5 秒" },
  { id: "seek-forward-5", label: "快进 5秒", category: "播放控制", keys: ["ArrowRight"], description: "前进 5 秒" },
  { id: "seek-back-10", label: "快退 10秒", category: "播放控制", keys: ["Shift+ArrowLeft"], description: "后退 10 秒" },
  { id: "seek-forward-10", label: "快进 10秒", category: "播放控制", keys: ["Shift+ArrowRight"], description: "前进 10 秒" },
  { id: "vol-up", label: "音量增加", category: "音量控制", keys: ["ArrowUp"], description: "增加音量 5%" },
  { id: "vol-down", label: "音量减少", category: "音量控制", keys: ["ArrowDown"], description: "减少音量 5%" },
  { id: "vol-up-more", label: "音量增加(大)", category: "音量控制", keys: ["Shift+ArrowUp"], description: "增加音量 10%" },
  { id: "vol-down-more", label: "音量减少(大)", category: "音量控制", keys: ["Shift+ArrowDown"], description: "减少音量 10%" },
  { id: "toggle-mute", label: "静音切换", category: "音量控制", keys: ["Ctrl+M"], description: "静音或取消静音" },
  { id: "favorite", label: "收藏歌曲", category: "歌曲操作", keys: ["Ctrl+D"], description: "收藏/取消收藏当前歌曲" },
  { id: "cycle-loop", label: "切换播放模式", category: "歌曲操作", keys: ["Ctrl+L"], description: "顺序/列表循环/单曲循环/随机" },
  { id: "next-song", label: "下一首", category: "歌曲操作", keys: ["Ctrl+N"], description: "播放下一首歌曲" },
  { id: "prev-song", label: "上一首", category: "歌曲操作", keys: ["Ctrl+P"], description: "播放上一首歌曲" },
  { id: "fullscreen", label: "全屏切换", category: "界面切换", keys: ["F"], description: "切换全屏模式" },
  { id: "fullscreen-lyrics", label: "全屏歌词", category: "界面切换", keys: ["Ctrl+F"], description: "切换全屏歌词" },
  { id: "escape", label: "返回/关闭", category: "界面切换", keys: ["Escape"], description: "返回主页或关闭面板" },
  { id: "speed-up", label: "加速播放", category: "播放控制", keys: ["="], description: "增加 0.25x" },
  { id: "speed-down", label: "减速播放", category: "播放控制", keys: ["-"], description: "减少 0.25x" },
  { id: "seek-0", label: "进度 0%", category: "播放控制", keys: ["0"], description: "跳转到 0%" },
  { id: "seek-10", label: "进度 10%", category: "播放控制", keys: ["1"], description: "跳转到 10%" },
  { id: "seek-20", label: "进度 20%", category: "播放控制", keys: ["2"], description: "跳转到 20%" },
  { id: "seek-30", label: "进度 30%", category: "播放控制", keys: ["3"], description: "跳转到 30%" },
  { id: "seek-40", label: "进度 40%", category: "播放控制", keys: ["4"], description: "跳转到 40%" },
  { id: "seek-50", label: "进度 50%", category: "播放控制", keys: ["5"], description: "跳转到 50%" },
  { id: "seek-60", label: "进度 60%", category: "播放控制", keys: ["6"], description: "跳转到 60%" },
  { id: "seek-70", label: "进度 70%", category: "播放控制", keys: ["7"], description: "跳转到 70%" },
  { id: "seek-80", label: "进度 80%", category: "播放控制", keys: ["8"], description: "跳转到 80%" },
  { id: "seek-90", label: "进度 90%", category: "播放控制", keys: ["9"], description: "跳转到 90%" },
  { id: "open-ai-settings", label: "AI 设置", category: "AI 功能", keys: ["Ctrl+Shift+A"], description: "打开 AI 设置面板" },
  { id: "toggle-ai-panel", label: "切换 AI 面板", category: "AI 功能", keys: ["Ctrl+I"], description: "切换 AI 设置面板" },
];

export const useKeyboardShortcutsStore = create<KeyboardShortcutsState>()(
  persist(
    (set, get) => ({
      defaults: DEFAULT_SHORTCUTS,
      overrides: [],
      isRecording: false,
      recordingId: null,

      getBinding: (id) => {
        const state = get();
        const override = state.overrides.find((o) => o.id === id);
        if (override) return override.keys;
        const def = state.defaults.find((d) => d.id === id);
        return def ? def.keys : [];
      },

      setBinding: (id, keys) => {
        const state = get();
        const allBindings = state.getAllBindings();
        const conflicts: string[] = [];

        for (const b of allBindings) {
          if (b.id === id) continue;
          const existingKeys = state.getBinding(b.id);
          if (existingKeys.length === keys.length && existingKeys.every((k, i) => k === keys[i])) {
            conflicts.push(b.label);
          }
        }

        set((s) => ({
          overrides: [
            ...s.overrides.filter((o) => o.id !== id),
            { id, keys },
          ],
        }));

        return { success: conflicts.length === 0, conflicts };
      },

      resetBinding: (id) => {
        set((s) => ({
          overrides: s.overrides.filter((o) => o.id !== id),
        }));
      },

      resetAll: () => {
        set({ overrides: [] });
      },

      setIsRecording: (id) => {
        set({ isRecording: id !== null, recordingId: id });
      },

      getAllBindings: () => {
        return get().defaults;
      },
    }),
    {
      name: "keyboard-shortcuts-store-v1",
      partialize: (state) => ({
        overrides: state.overrides,
      }),
    }
  )
);