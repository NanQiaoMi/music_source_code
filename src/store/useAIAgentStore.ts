import { create } from "zustand";
import { Song } from "@/types/song";
import { AgentMessage } from "@/types/aiAgent";
import { useAIStore } from "./aiStore";
import { useAudioStore } from "./audioStore";
import { useOfflineDownloadStore } from "./useOfflineDownloadStore";
import { useUIStore } from "./uiStore";
import { runAgentConversation } from "@/services/aiAgentService";

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
    "你好！我是 MIMI 音乐找歌助手 🎵\n告诉我你想听什么，无论是歌名、歌手、某句模糊歌词、还是特定的心情与场景，我都能为你检索全网曲库并直接播放或下载！",
  timestamp: Date.now(),
  status: "done",
};

let currentAbortController: AbortController | null = null;

export interface AIAgentState {
  messages: AgentMessage[];
  isProcessing: boolean;
  currentToolName: string | null;
  isPanelOpen: boolean;
  suggestedPrompts: string[];

  // Actions
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  abortCurrentRequest: () => void;
  playSongFromAgent: (song: Song) => void;
  downloadSongFromAgent: (song: Song) => Promise<void>;
}

export const useAIAgentStore = create<AIAgentState>()((set, get) => ({
  messages: [{ ...INITIAL_GREETING_MESSAGE, timestamp: Date.now() }],
  isProcessing: false,
  currentToolName: null,
  isPanelOpen: false,
  suggestedPrompts: DEFAULT_SUGGESTED_PROMPTS,

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get().isProcessing) return;

    const aiState = useAIStore.getState();
    const orderedPool = aiState.enableAutoFallback
      ? aiState.getOrderedConfigPool(aiState.activeConfigId)
      : [
          aiState.configs.find((c) => c.id === aiState.activeConfigId) ||
            aiState.configs[0],
        ].filter(Boolean);

    const activeConfig = orderedPool[0];
    const fallbackConfigs = orderedPool.slice(1);

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

      set((state) => ({
        messages: [...state.messages, userMsg, warnMsg],
      }));
      return;
    }

    const updatedWithUser = [...get().messages, userMsg];
    set({
      messages: updatedWithUser,
      isProcessing: true,
      currentToolName: null,
    });

    currentAbortController = new AbortController();

    try {
      const resultMessages = await runAgentConversation({
        messages: updatedWithUser,
        config: activeConfig,
        fallbackConfigs,
        onUpdate: (updatedMessages, currentToolName) => {
          set({ messages: updatedMessages, currentToolName });
        },
        onFallback: (fromConfig, toConfig, reason) => {
          useUIStore.getState().showToast?.(
            `⚠️ [${fromConfig.name}] 受限，已自动无感切换至 [${toConfig.name}] 继续检索`,
            "info"
          );
        },
        abortSignal: currentAbortController.signal,
      });

      set({
        messages: resultMessages,
        isProcessing: false,
        currentToolName: null,
      });
    } catch (err: unknown) {
      const isAborted =
        currentAbortController?.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError");

      if (isAborted) {
        const stopMsg: AgentMessage = {
          id: `msg_stopped_${Date.now()}`,
          role: "assistant",
          content: "已停止本次请求。",
          timestamp: Date.now(),
          status: "done",
        };
        set((state) => ({
          messages: [...state.messages, stopMsg],
          isProcessing: false,
          currentToolName: null,
        }));
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
        set((state) => ({
          messages: [...state.messages, errorMsg],
          isProcessing: false,
          currentToolName: null,
        }));
      }
    } finally {
      currentAbortController = null;
    }
  },

  clearMessages: () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    set({
      messages: [{ ...INITIAL_GREETING_MESSAGE, timestamp: Date.now() }],
      isProcessing: false,
      currentToolName: null,
    });
  },

  openPanel: () => {
    set({ isPanelOpen: true });
    useUIStore.getState().openPanel("aiAgent");
  },

  closePanel: () => {
    set({ isPanelOpen: false });
    useUIStore.getState().closePanel("aiAgent");
  },

  togglePanel: () => {
    const nextState = !get().isPanelOpen;
    set({ isPanelOpen: nextState });
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
}));
