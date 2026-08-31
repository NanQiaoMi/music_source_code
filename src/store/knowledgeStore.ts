"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAIStore } from "./aiStore";

interface Backstory {
  content: string;
  timestamp: number;
}

interface Metaphor {
  term: string;
  meaning: string;
}

export interface DNAJournal {
  archetype: string;
  motto: string;
  genre: string;
  description: string;
  timestamp: number;
}

interface KnowledgeState {
  backstories: Record<string, Backstory>;
  metaphors: Record<string, Metaphor[]>;
  dnaJournal: DNAJournal | null;
  isLoading: boolean;
  lastRawResponse?: string;

  fetchBackstory: (title: string, artist: string, force?: boolean) => Promise<void>;
  fetchMetaphors: (
    title: string,
    artist: string,
    lyrics?: string,
    force?: boolean
  ) => Promise<void>;
  generateDNAJournal: (stats: {
    totalSongs: number;
    averageValence: number;
    averageEnergy: number;
    dominantQuadrant: string;
    genres: string[];
  }) => Promise<void>;
  clearCache: () => void;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const getActiveAIConfig = () => {
  const aiStore = useAIStore.getState();
  return aiStore.configs.find((config) => config.id === aiStore.activeConfigId) ?? null;
};

function extractJson(text: string): unknown[] {
  if (!text) return [];
  try {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    const objectMatch = cleaned.match(/{[\s\S]*}/);
    if (objectMatch) {
      const objectValue = JSON.parse(objectMatch[0]);
      return Array.isArray(objectValue) ? objectValue : [objectValue];
    }
  } catch {
    /* ignore malformed model output */
  }
  return [];
}

function isMetaphor(value: unknown): value is Metaphor {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Metaphor).term === "string" &&
    typeof (value as Metaphor).meaning === "string"
  );
}

function toDNAJournal(value: unknown): Omit<DNAJournal, "timestamp"> | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<DNAJournal>;
  if (
    typeof candidate.archetype !== "string" ||
    typeof candidate.motto !== "string" ||
    typeof candidate.genre !== "string" ||
    typeof candidate.description !== "string"
  ) {
    return null;
  }

  return {
    archetype: candidate.archetype,
    motto: candidate.motto,
    genre: candidate.genre,
    description: candidate.description,
  };
}

async function requestChatCompletion(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  baseUrl?: string
): Promise<string> {
  const isBrowser = typeof window !== "undefined";
  const targetUrl = isBrowser ? "/api/ai/chat" : url;
  const payload = isBrowser ? { ...body, baseUrl, apiKey } : body;

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data.choices?.[0]?.message?.content ?? "";
}

function getChatCompletionUrl(baseUrl: string) {
  const normalized = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  return normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

export const useKnowledgeStore = create<KnowledgeState>()(
  persist(
    (set, get) => ({
      backstories: {},
      metaphors: {},
      dnaJournal: null,
      isLoading: false,

      fetchBackstory: async (title, artist, force = false) => {
        const key = `${artist}-${title}`.toLowerCase();
        if (get().backstories[key] && !force) return;
        const config = getActiveAIConfig();
        if (!config?.apiKey) return;

        set({ isLoading: true });
        try {
          const content = await requestChatCompletion(
            getChatCompletionUrl(config.baseUrl),
            config.apiKey,
            {
              model: config.model || "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "你是一位凝练的音乐评论家。请用一句中文写出 15-30 字的歌曲背景或聆听提示，避免空话。",
                },
                { role: "user", content: `歌曲：${title} / ${artist}` },
              ],
              temperature: 0.8,
              max_tokens: 150,
            },
            config.baseUrl
          );

          set((state) => ({
            backstories: {
              ...state.backstories,
              [key]: { content: content || "暂无可用背景信息", timestamp: Date.now() },
            },
            isLoading: false,
          }));
        } catch (error) {
          set({ isLoading: false, lastRawResponse: getErrorMessage(error) });
        }
      },

      fetchMetaphors: async (title, artist, lyrics, force = false) => {
        const key = `${artist}-${title}`.toLowerCase();
        if (get().metaphors[key]?.length > 0 && !force) return;
        const config = getActiveAIConfig();
        if (!config?.apiKey) return;

        set({ isLoading: true });
        try {
          const rawContent = await requestChatCompletion(
            getChatCompletionUrl(config.baseUrl),
            config.apiKey,
            {
              model: config.model || "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    '你是一位诗学分析专家。只输出 JSON 数组：[ {"term":"...", "meaning":"..."} ]，每项解释一个意象或关键词。',
                },
                {
                  role: "user",
                  content: `歌曲：${title} / ${artist}\n歌词：${(lyrics ?? "").slice(0, 500)}`,
                },
              ],
              temperature: 0.3,
              max_tokens: 600,
            },
            config.baseUrl
          );
          const parsedMetaphors = extractJson(rawContent).filter(isMetaphor);

          set((state) => ({
            metaphors: { ...state.metaphors, [key]: parsedMetaphors },
            lastRawResponse: rawContent,
            isLoading: false,
          }));
        } catch (error) {
          set({ isLoading: false, lastRawResponse: getErrorMessage(error) });
        }
      },

      generateDNAJournal: async (stats) => {
        const config = getActiveAIConfig();
        if (!config?.apiKey) return;

        set({ isLoading: true });
        try {
          const rawContent = await requestChatCompletion(
            getChatCompletionUrl(config.baseUrl),
            config.apiKey,
            {
              model: config.model || "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    '你是一位懂音乐心理学的策展人。根据用户听歌统计生成一份音乐 DNA 报告。只输出 JSON：{"archetype":"人格类型", "motto":"核心格言", "genre":"主要气质", "description":"简短说明"}。archetype、motto、genre 均控制在 8 个中文以内，description 控制在 20 个中文以内。',
                },
                {
                  role: "user",
                  content: `音乐数据汇总：\n- 总收听歌曲数：${stats.totalSongs || 0}\n- 平均愉悦度 (Valence): ${(stats.averageValence || 0).toFixed(3)}\n- 平均能量 (Energy): ${(stats.averageEnergy || 0).toFixed(3)}\n- 主要象限：${stats.dominantQuadrant || "未知"}\n- 涉及流派：${(stats.genres || []).slice(0, 5).join(", ")}`,
                },
              ],
              temperature: 0.8,
              max_tokens: 800,
            },
            config.baseUrl
          );

          const parsed = toDNAJournal(extractJson(rawContent)[0]);
          if (!parsed) throw new Error("Failed to parse DNA Journal");

          set({
            dnaJournal: {
              ...parsed,
              timestamp: Date.now(),
            },
            lastRawResponse: rawContent,
            isLoading: false,
          });
        } catch (error) {
          console.error("generateDNAJournal failed:", error);
          set({ isLoading: false, lastRawResponse: getErrorMessage(error) });
        }
      },

      clearCache: () => set({ backstories: {}, metaphors: {}, dnaJournal: null }),
    }),
    {
      name: "mimi-knowledge-storage-v3",
    }
  )
);
