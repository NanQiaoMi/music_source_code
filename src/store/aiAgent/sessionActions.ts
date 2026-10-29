// S6-12o: 会话生命周期动作（原 useAIAgentStore 内联实现）整体迁出，逻辑逐字保留；
// 中止句柄改由 ./abortController 持有，三处 abort 分支语义不变。
import type { AgentSessionMeta } from "@/types/aiAgent";
import { aiAgentDb } from "@/lib/storage/aiAgentDb";
import { INITIAL_GREETING_MESSAGE, type AIAgentSliceCreator, type AIAgentState } from "./helpers";
import { abortPendingRequest } from "./abortController";

export type AIAgentSessionActions = Pick<
  AIAgentState,
  | "createNewSession"
  | "switchSession"
  | "deleteSession"
  | "clearAllSessions"
  | "renameSession"
  | "openSessionDrawer"
  | "closeSessionDrawer"
  | "toggleSessionDrawer"
>;

export const createSessionActions: AIAgentSliceCreator<AIAgentSessionActions> = (set, get) => ({
  createNewSession: (initialTitle?: string) => {
    abortPendingRequest();

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

    abortPendingRequest();

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
    abortPendingRequest();

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
  toggleSessionDrawer: () => set((state) => ({ isSessionDrawerOpen: !state.isSessionDrawerOpen })),
});
