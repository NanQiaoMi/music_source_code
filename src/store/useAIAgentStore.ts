import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage } from "@/lib/storage/safeStorage";
import { Song } from "@/types/song";
import { AgentMessage, AgentSessionMeta } from "@/types/aiAgent";
import { useAIStore } from "./aiStore";
import { useAudioStore } from "./audioStore";
import { useOfflineDownloadStore } from "./useOfflineDownloadStore";
import { useUIStore } from "./uiStore";
import { useEmotionStore } from "./emotionStore";
import { useFavoritesStore } from "./favoritesStore";
import { runAgentConversation, MusicPlaybackContext } from "@/services/aiAgentService";
import { aiAgentDb } from "@/lib/storage/aiAgentDb";

export const DEFAULT_SUGGESTED_PROMPTS = [
  "搜周杰伦的晴天",
  "有首歌词是'如果天黑之前来得及'",
  "来首适合深夜听的慢歌",
  "帮我下载陈奕迅的十年",
];

export const INITIAL_GREETING_MESSAGE: AgentMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "你好！我是 MIMI 音乐策展人 🎵\n在音符流转间与你相遇。无论是某句朦胧歌词、此时此刻的心境流转，还是探索小众宝藏与黑胶意境，我都能为你全网淘取并即刻开播！",
  timestamp: Date.now(),
  status: "done",
};

const DEFAULT_SESSION_ID = "session_default";

const DEFAULT_INITIAL_SESSION: AgentSessionMeta = {
  id: DEFAULT_SESSION_ID,
  title: "探索新音乐",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messageCount: 1,
  lastSnippet: "你好！我是 MIMI 音乐策展人 🎵",
};

export function extractLyricsSnippet(lyrics: string, currentTime: number): string {
  if (!lyrics) return "";
  const lines = lyrics.split("\n");
  const parsedLines: { time: number; text: string }[] = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d+))?\](.*)/);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].slice(0, 2), 10) / 100 : 0;
      const text = match[4].trim();
      if (text) {
        parsedLines.push({ time: min * 60 + sec + ms, text });
      }
    }
  }

  if (parsedLines.length === 0) {
    return lines
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((l) => `> ${l}`)
      .join("\n");
  }

  let activeIndex = 0;
  for (let i = 0; i < parsedLines.length; i++) {
    if (parsedLines[i].time <= currentTime) {
      activeIndex = i;
    } else {
      break;
    }
  }

  const startIndex = Math.max(0, activeIndex - 1);
  const endIndex = Math.min(parsedLines.length, startIndex + 4);
  return parsedLines
    .slice(startIndex, endIndex)
    .map((l) => `> ${l.text}`)
    .join("\n");
}

export function getDynamicPlaybackContext(): MusicPlaybackContext {
  const audioState = useAudioStore.getState();
  const currentSong = audioState.currentSong;
  const currentTime = audioState.currentTime || 0;
  const isPlaying = audioState.isPlaying;

  // 1. 时段计算
  const now = new Date();
  const hour = now.getHours();
  let periodLabel = "深夜时分";
  let ambientMood = "万籁俱寂，适宜聆听沉静、温润或内省的声响";
  if (hour >= 5 && hour < 9) {
    periodLabel = "清晨曙光";
    ambientMood = "晨光初醒，适合明亮、清新、轻快的唤醒节奏";
  } else if (hour >= 9 && hour < 12) {
    periodLabel = "上午专注";
    ambientMood = "精力饱满，适合平稳、低保真 Lo-Fi 或专注器乐";
  } else if (hour >= 12 && hour < 14) {
    periodLabel = "午后小憩";
    ambientMood = "惬意慵懒，适宜舒缓、轻柔、微风般的旋律";
  } else if (hour >= 14 && hour < 18) {
    periodLabel = "午后时光";
    ambientMood = "阳光正好，适宜律动、爵士放克或流光流行";
  } else if (hour >= 18 && hour < 22) {
    periodLabel = "黄昏与入夜";
    ambientMood = "落日与霓虹交织，适宜都市流行、R&B 或微醺氛围";
  } else if (hour >= 22 || hour < 2) {
    periodLabel = "深夜独处";
    ambientMood = "夜色渐浓，适宜木吉他民谣、氛围环境音或深情低语";
  }

  // 2. 歌词切片
  let lyricsSnippet: string | undefined = undefined;
  if (currentSong?.lyrics) {
    lyricsSnippet = extractLyricsSnippet(currentSong.lyrics, currentTime);
  }

  // 3. 情感坐标
  const emotionState = useEmotionStore.getState();
  const point = currentSong ? emotionState.points.find((p) => p.id === currentSong.id) : null;
  const emotion = point ? { x: point.x, y: point.y } : null;

  // 4. 用户偏好
  const favState = useFavoritesStore.getState();
  const favorites = favState.favorites || [];
  const recentArtists = Array.from(new Set(favorites.map((s) => s.artist).filter(Boolean))).slice(
    0,
    5
  );

  return {
    currentSong: currentSong
      ? {
          id: currentSong.id,
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album,
          duration: audioState.duration,
          currentTime,
          isPlaying,
          lyricsSnippet,
          source: currentSong.source,
        }
      : null,
    emotion,
    timeOfDay: {
      hour,
      periodLabel,
      ambientMood,
    },
    userPreferences: {
      favoriteCount: favorites.length,
      topArtists: recentArtists,
    },
  };
}

let currentAbortController: AbortController | null = null;

export interface AIAgentState {
  // 会话列表元数据与当前会话
  sessions: AgentSessionMeta[];
  currentSessionId: string;
  isSessionDrawerOpen: boolean;
  isSessionLoading: boolean;

  // 当前激活会话的消息体
  messages: AgentMessage[];
  isProcessing: boolean;
  currentToolName: string | null;
  isPanelOpen: boolean;
  suggestedPrompts: string[];

  // 会话管理 Actions
  createNewSession: (initialTitle?: string) => string;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearAllSessions: () => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => void;
  openSessionDrawer: () => void;
  closeSessionDrawer: () => void;
  toggleSessionDrawer: () => void;

  // 消息与交互 Actions
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  abortCurrentRequest: () => void;
  playSongFromAgent: (song: Song) => void;
  downloadSongFromAgent: (song: Song) => Promise<void>;
}

// 辅助萃取会话标题
function extractSessionTitle(prompt: string): string {
  const clean = prompt.replace(/[？?！!，,。.\n\r]/g, " ").trim();
  if (!clean) return "音乐对话";
  const words = clean.split(/\s+/);
  if (words.length > 0 && words[0].length >= 2) {
    return clean.slice(0, 16);
  }
  return clean.slice(0, 14);
}

export const useAIAgentStore = create<AIAgentState>()(
  persist(
    (set, get) => ({
      sessions: [DEFAULT_INITIAL_SESSION],
      currentSessionId: DEFAULT_SESSION_ID,
      isSessionDrawerOpen: false,
      isSessionLoading: false,

      messages: [{ ...INITIAL_GREETING_MESSAGE, timestamp: Date.now() }],
      isProcessing: false,
      currentToolName: null,
      isPanelOpen: false,
      suggestedPrompts: DEFAULT_SUGGESTED_PROMPTS,

      createNewSession: (initialTitle?: string) => {
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }

        const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newSessionMeta: AgentSessionMeta = {
          id: newId,
          title: initialTitle || "新音乐对话",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 1,
          lastSnippet: "你好！我是 MIMI 音乐找歌助手 🎵",
        };

        const initialMsgs = [{ ...INITIAL_GREETING_MESSAGE, timestamp: Date.now() }];

        set((state) => ({
          sessions: [newSessionMeta, ...state.sessions.filter((s) => s.id !== newId)],
          currentSessionId: newId,
          messages: initialMsgs,
          isProcessing: false,
          currentToolName: null,
          isSessionDrawerOpen: false,
        }));

        aiAgentDb.saveSessionMessages(newId, initialMsgs);
        return newId;
      },

      switchSession: async (sessionId: string) => {
        if (sessionId === get().currentSessionId && get().messages.length > 0) {
          set({ isSessionDrawerOpen: false });
          return;
        }

        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }

        set({ isSessionLoading: true, currentSessionId: sessionId, isSessionDrawerOpen: false });

        try {
          const storedMessages = await aiAgentDb.getSessionMessages(sessionId);
          const activeMessages =
            storedMessages && storedMessages.length > 0
              ? storedMessages
              : [{ ...INITIAL_GREETING_MESSAGE, timestamp: Date.now() }];

          set({
            messages: activeMessages,
            isProcessing: false,
            currentToolName: null,
            isSessionLoading: false,
          });
        } catch {
          set({
            messages: [{ ...INITIAL_GREETING_MESSAGE, timestamp: Date.now() }],
            isProcessing: false,
            currentToolName: null,
            isSessionLoading: false,
          });
        }
      },

      deleteSession: async (sessionId: string) => {
        const { sessions, currentSessionId } = get();
        const remaining = sessions.filter((s) => s.id !== sessionId);

        await aiAgentDb.deleteSessionMessages(sessionId);

        if (remaining.length === 0) {
          // 全部删光时重建默认空白会话
          get().createNewSession("探索新音乐");
          return;
        }

        if (currentSessionId === sessionId) {
          const nextSession = remaining[0];
          set({ sessions: remaining });
          await get().switchSession(nextSession.id);
        } else {
          set({ sessions: remaining });
        }
      },

      clearAllSessions: async () => {
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }

        await aiAgentDb.clearAllSessionMessages();

        const defaultId = `session_${Date.now()}`;
        const newSession: AgentSessionMeta = {
          id: defaultId,
          title: "探索新音乐",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 1,
          lastSnippet: "你好！我是 MIMI 音乐找歌助手 🎵",
        };
        const initialMsgs = [{ ...INITIAL_GREETING_MESSAGE, timestamp: Date.now() }];

        set({
          sessions: [newSession],
          currentSessionId: defaultId,
          messages: initialMsgs,
          isProcessing: false,
          currentToolName: null,
          isSessionDrawerOpen: false,
        });

        await aiAgentDb.saveSessionMessages(defaultId, initialMsgs);
      },

      renameSession: (sessionId: string, newTitle: string) => {
        const trimmed = newTitle.trim();
        if (!trimmed) return;
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, title: trimmed, updatedAt: Date.now() } : s
          ),
        }));
      },

      openSessionDrawer: () => set({ isSessionDrawerOpen: true }),
      closeSessionDrawer: () => set({ isSessionDrawerOpen: false }),
      toggleSessionDrawer: () =>
        set((state) => ({ isSessionDrawerOpen: !state.isSessionDrawerOpen })),

      sendMessage: async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || get().isProcessing) return;

        const aiState = useAIStore.getState();
        const orderedPool = aiState.enableAutoFallback
          ? aiState.getOrderedConfigPool(aiState.activeConfigId)
          : [
              aiState.configs.find((c) => c.id === aiState.activeConfigId) || aiState.configs[0],
            ].filter(Boolean);

        const activeConfig = orderedPool[0];
        const fallbackConfigs = orderedPool.slice(1);

        const currentSessionId = get().currentSessionId;
        const currentSession = get().sessions.find((s) => s.id === currentSessionId);

        // 首条提问自动萃取生成会话标题
        if (
          currentSession &&
          (currentSession.title === "新音乐对话" ||
            currentSession.title === "探索新音乐" ||
            currentSession.messageCount <= 1)
        ) {
          const autoTitle = extractSessionTitle(trimmed);
          get().renameSession(currentSessionId, autoTitle);
        }

        const userMsg: AgentMessage = {
          id: `msg_user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          role: "user",
          content: trimmed,
          timestamp: Date.now(),
          status: "done",
        };

        if (!activeConfig || !aiState.isEnabled) {
          const warnMsg: AgentMessage = {
            id: `msg_warn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            role: "assistant",
            content: !aiState.isEnabled
              ? "AI 引擎目前已暂停。请在顶部 AI 菜单或设置中重新启动 AI 功能后使用。"
              : "未检测到可用的 AI 模型配置。请先在「AI 接口配置」中添加有效的 API 端点与密钥。",
            timestamp: Date.now(),
            status: "error",
            error: "AI_CONFIG_MISSING",
          };

          const newMsgs = [...get().messages, userMsg, warnMsg];
          set((state) => ({
            messages: newMsgs,
            sessions: state.sessions.map((s) =>
              s.id === currentSessionId
                ? {
                    ...s,
                    messageCount: newMsgs.length,
                    lastSnippet: trimmed.slice(0, 30),
                    updatedAt: Date.now(),
                  }
                : s
            ),
          }));
          aiAgentDb.saveSessionMessages(currentSessionId, newMsgs);
          return;
        }

        const updatedWithUser = [...get().messages, userMsg];
        set({
          messages: updatedWithUser,
          isProcessing: true,
          currentToolName: null,
        });

        currentAbortController = new AbortController();
        let pendingRafId: number | null = null;
        let pendingUpdate: { msgs: AgentMessage[]; tool: string | null } | null = null;

        const flushPendingUpdate = (finalMessages?: AgentMessage[]) => {
          if (pendingRafId !== null && typeof cancelAnimationFrame !== "undefined") {
            cancelAnimationFrame(pendingRafId);
            pendingRafId = null;
          }
          if (finalMessages) {
            set({ messages: finalMessages });
          } else if (pendingUpdate) {
            set({ messages: pendingUpdate.msgs, currentToolName: pendingUpdate.tool });
            pendingUpdate = null;
          }
        };

        try {
          const playbackContext = getDynamicPlaybackContext();
          const resultMessages = await runAgentConversation({
            messages: updatedWithUser,
            config: activeConfig,
            fallbackConfigs,
            playbackContext,
            onUpdate: (updatedMessages, currentToolName) => {
              pendingUpdate = { msgs: updatedMessages, tool: currentToolName };
              if (pendingRafId === null && typeof requestAnimationFrame !== "undefined") {
                pendingRafId = requestAnimationFrame(() => {
                  pendingRafId = null;
                  if (pendingUpdate) {
                    set({ messages: pendingUpdate.msgs, currentToolName: pendingUpdate.tool });
                    pendingUpdate = null;
                  }
                });
              } else if (typeof requestAnimationFrame === "undefined") {
                set({ messages: updatedMessages, currentToolName });
              }
            },
            onFallback: (fromConfig, toConfig) => {
              useUIStore
                .getState()
                .showToast?.(
                  `⚠️ [${fromConfig.name}] 受限，已自动无感切换至 [${toConfig.name}] 继续检索`,
                  "info"
                );
            },
            abortSignal: currentAbortController.signal,
          });

          flushPendingUpdate(resultMessages);
          set((state) => ({
            messages: resultMessages,
            isProcessing: false,
            currentToolName: null,
            sessions: state.sessions.map((s) =>
              s.id === currentSessionId
                ? {
                    ...s,
                    messageCount: resultMessages.length,
                    lastSnippet: (
                      resultMessages[resultMessages.length - 1]?.content || trimmed
                    ).slice(0, 32),
                    updatedAt: Date.now(),
                  }
                : s
            ),
          }));
          aiAgentDb.saveSessionMessages(currentSessionId, resultMessages);
        } catch (err: unknown) {
          flushPendingUpdate();
          const isAborted =
            currentAbortController?.signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError");

          let finalErrorMsgs: AgentMessage[];
          if (isAborted) {
            const stopMsg: AgentMessage = {
              id: `msg_stopped_${Date.now()}`,
              role: "assistant",
              content: "已停止本次请求。",
              timestamp: Date.now(),
              status: "done",
            };
            finalErrorMsgs = [...get().messages, stopMsg];
          } else {
            const errorText = err instanceof Error ? err.message : String(err);
            const errorMsg: AgentMessage = {
              id: `msg_err_${Date.now()}`,
              role: "assistant",
              content: `请求失败: ${errorText}`,
              timestamp: Date.now(),
              status: "error",
              error: errorText,
            };
            finalErrorMsgs = [...get().messages, errorMsg];
          }

          set((state) => ({
            messages: finalErrorMsgs,
            isProcessing: false,
            currentToolName: null,
            sessions: state.sessions.map((s) =>
              s.id === currentSessionId
                ? {
                    ...s,
                    messageCount: finalErrorMsgs.length,
                    lastSnippet: "已终止或出错",
                    updatedAt: Date.now(),
                  }
                : s
            ),
          }));
          aiAgentDb.saveSessionMessages(currentSessionId, finalErrorMsgs);
        } finally {
          flushPendingUpdate();
          currentAbortController = null;
        }
      },

      clearMessages: () => {
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        const initialMsgs = [{ ...INITIAL_GREETING_MESSAGE, timestamp: Date.now() }];
        const currentSessionId = get().currentSessionId;

        set((state) => ({
          messages: initialMsgs,
          isProcessing: false,
          currentToolName: null,
          sessions: state.sessions.map((s) =>
            s.id === currentSessionId
              ? {
                  ...s,
                  messageCount: 1,
                  lastSnippet: "已清空当前对话",
                  updatedAt: Date.now(),
                }
              : s
          ),
        }));

        aiAgentDb.saveSessionMessages(currentSessionId, initialMsgs);
      },

      openPanel: () => {
        set({ isPanelOpen: true });
        useUIStore.getState().openPanel("aiAgent");
      },

      closePanel: () => {
        set({ isPanelOpen: false, isSessionDrawerOpen: false });
        useUIStore.getState().closePanel("aiAgent");
      },

      togglePanel: () => {
        const nextState = !get().isPanelOpen;
        set({ isPanelOpen: nextState, isSessionDrawerOpen: false });
        if (nextState) {
          useUIStore.getState().openPanel("aiAgent");
        } else {
          useUIStore.getState().closePanel("aiAgent");
        }
      },

      abortCurrentRequest: () => {
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        set({ isProcessing: false, currentToolName: null });
      },

      playSongFromAgent: (song: Song) => {
        useAudioStore.getState().playSong(song);
      },

      downloadSongFromAgent: async (song: Song) => {
        await useOfflineDownloadStore.getState().addDownload(song, "lossless");
      },
    }),
    {
      name: "mimi_ai_agent_chat_store_v1",
      storage: createJSONStorage(() => createSafeStorage("mimi_ai_agent_chat_store_v1")),
      partialize: (state) => ({
        sessions: Array.isArray(state.sessions) ? state.sessions.slice(0, 50) : [],
        currentSessionId: state.currentSessionId || DEFAULT_SESSION_ID,
        messages: Array.isArray(state.messages) ? state.messages.slice(-50) : [],
        suggestedPrompts: state.suggestedPrompts,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isProcessing = false;
          state.currentToolName = null;
          state.isSessionLoading = false;
          state.isSessionDrawerOpen = false;

          // 异步从 IndexedDB 恢复当前会话的消息体
          if (state.currentSessionId) {
            aiAgentDb.getSessionMessages(state.currentSessionId).then((storedMsgs) => {
              if (storedMsgs && storedMsgs.length > 0) {
                useAIAgentStore.setState({ messages: storedMsgs });
              }
            });
          }
        }
      },
    }
  )
);
