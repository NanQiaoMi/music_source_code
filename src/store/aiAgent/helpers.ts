// S6-12o: useAIAgentStore 的零 Zustand 依赖层：公共类型、默认值与纯函数逐字迁出，
// 让 store 本体留在 400 行预算内（scripts/check-store-budgets.mjs）。
// store 仍 re-export 这些公共标识符，导入方无需改动。
import type { StateCreator } from "zustand";
import type { AgentMessage, AgentSessionMeta } from "@/types/aiAgent";
import type { Song } from "@/types/song";

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

export const DEFAULT_SESSION_ID = "session_default";

export const DEFAULT_INITIAL_SESSION: AgentSessionMeta = {
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

// 辅助萃取会话标题
export function extractSessionTitle(prompt: string): string {
  const clean = prompt.replace(/[？?！!，,。.\n\r]/g, " ").trim();
  if (!clean) return "音乐对话";
  const words = clean.split(/\s+/);
  if (words.length > 0 && words[0].length >= 2) {
    return clean.slice(0, 16);
  }
  return clean.slice(0, 14);
}

// 切片工厂签名：与 persist 中间件一致（同 slices/types.ts 的 AudioSliceCreator）。
export type AIAgentSliceCreator<T> = StateCreator<
  AIAgentState,
  [["zustand/persist", unknown]],
  [],
  T
>;
