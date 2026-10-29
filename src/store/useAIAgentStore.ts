// S6-12o: store 本体只保留 persist 配置、初始状态与消息/面板动作；
// 公共类型与纯函数在 ./aiAgent/helpers.ts，播放快照在 ./aiAgent/playbackContext.ts，
// 会话动作在 ./aiAgent/sessionActions.ts，中止句柄在 ./aiAgent/abortController.ts。
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage } from "@/lib/storage/safeStorage";
import { Song } from "@/types/song";
import { AgentMessage } from "@/types/aiAgent";
import { useAIStore } from "./aiStore";
import { useAudioStore } from "./audioStore";
import { useOfflineDownloadStore } from "./useOfflineDownloadStore";
import { usePanelStore } from "./panelStore";
import { toast } from "@/store/actions/uiActions";
import { runAgentConversation } from "@/services/aiAgentService";
import { aiAgentDb } from "@/lib/storage/aiAgentDb";
import {
  DEFAULT_INITIAL_SESSION,
  DEFAULT_SESSION_ID,
  DEFAULT_SUGGESTED_PROMPTS,
  INITIAL_GREETING_MESSAGE,
  extractSessionTitle,
  type AIAgentState,
} from "./aiAgent/helpers";
import { getDynamicPlaybackContext } from "./aiAgent/playbackContext";
import { createSessionActions } from "./aiAgent/sessionActions";
import {
  abortPendingRequest,
  getAbortController,
  setAbortController,
} from "./aiAgent/abortController";

export {
  DEFAULT_SUGGESTED_PROMPTS,
  INITIAL_GREETING_MESSAGE,
  extractLyricsSnippet,
} from "./aiAgent/helpers";
export type { AIAgentState } from "./aiAgent/helpers";
export { getDynamicPlaybackContext } from "./aiAgent/playbackContext";

export const useAIAgentStore = create<AIAgentState>()(
  persist(
    (set, get, api) => ({
      sessions: [DEFAULT_INITIAL_SESSION],
      currentSessionId: DEFAULT_SESSION_ID,
      isSessionDrawerOpen: false,
      isSessionLoading: false,

      messages: [{ ...INITIAL_GREETING_MESSAGE, timestamp: Date.now() }],
      isProcessing: false,
      currentToolName: null,
      isPanelOpen: false,
      suggestedPrompts: DEFAULT_SUGGESTED_PROMPTS,

      ...createSessionActions(set, get, api),

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

        const abortController = new AbortController();
        setAbortController(abortController);
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
              // S6-6a：toast 事实由 toastStore 持有，store 侧统一走动作层（与 aiStore 一致）。
              toast.info(
                `⚠️ [${fromConfig.name}] 受限，已自动无感切换至 [${toConfig.name}] 继续检索`
              );
            },
            abortSignal: abortController.signal,
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
            getAbortController()?.signal.aborted ||
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
          setAbortController(null);
        }
      },

      clearMessages: () => {
        abortPendingRequest();
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
        usePanelStore.getState().openPanel("aiAgent");
      },

      closePanel: () => {
        set({ isPanelOpen: false, isSessionDrawerOpen: false });
        usePanelStore.getState().closePanel("aiAgent");
      },

      togglePanel: () => {
        const nextState = !get().isPanelOpen;
        set({ isPanelOpen: nextState, isSessionDrawerOpen: false });
        if (nextState) {
          usePanelStore.getState().openPanel("aiAgent");
        } else {
          usePanelStore.getState().closePanel("aiAgent");
        }
      },

      abortCurrentRequest: () => {
        abortPendingRequest();
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
      skipHydration: true,
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
