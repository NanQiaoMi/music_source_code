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
  archetype: string; // 人格名号 (如：虚无主义漫游者)
  motto: string; // 核心格言
  genre: string; // 主导流派
  description: string; // 深度解析
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

const getActiveAIConfig = () => {
  const aiStore = useAIStore.getState();
  return aiStore.configs.find((c) => c.id === aiStore.activeConfigId) ?? null;
};

function extractJson(text: string): any[] {
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
      const obj = JSON.parse(objectMatch[0]);
      return Array.isArray(obj) ? obj : [obj];
    }
  } catch (e) {}
  return [];
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
          const baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
          const url = baseUrl.endsWith("/v1")
            ? `${baseUrl}/chat/completions`
            : `${baseUrl}/v1/chat/completions`;
          const systemPrompt = `你是一位极简主义音乐评论家。任务：一句话侧写。15-30字。严禁废话。`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.model || "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `歌曲：${title} / ${artist}` },
              ],
              temperature: 0.8,
              max_tokens: 150,
            }),
          });
          const data = await response.json();
          const content = data.choices[0]?.message?.content || "暂无考古信息。";
          set((state) => ({
            backstories: { ...state.backstories, [key]: { content, timestamp: Date.now() } },
            isLoading: false,
          }));
        } catch (error) {
          set({ isLoading: false });
        }
      },

      fetchMetaphors: async (title, artist, lyrics, force = false) => {
        const key = `${artist}-${title}`.toLowerCase();
        if (get().metaphors[key] && get().metaphors[key].length > 0 && !force) return;
        const config = getActiveAIConfig();
        if (!config?.apiKey) return;
        set({ isLoading: true });
        const baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
        const url = baseUrl.endsWith("/v1")
          ? `${baseUrl}/chat/completions`
          : `${baseUrl}/v1/chat/completions`;
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.model || "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    '你是一位诗学专家。解析意象。JSON: [{"term": "...", "meaning": "..."}]。严禁废话。',
                },
                {
                  role: "user",
                  content: `歌曲：${title} / ${artist}\n歌词：${(lyrics ?? "").slice(0, 500)}`,
                },
              ],
              temperature: 0.3,
              max_tokens: 600,
            }),
          });
          const data = await response.json();
          const rawContent = data.choices[0]?.message?.content || "";
          const parsedMetaphors = extractJson(rawContent);
          set((state) => ({
            metaphors: { ...state.metaphors, [key]: parsedMetaphors },
            lastRawResponse: rawContent,
            isLoading: false,
          }));
        } catch (error: any) {
          set({ isLoading: false, lastRawResponse: error.message });
        }
      },

      generateDNAJournal: async (stats) => {
        const config = getActiveAIConfig();
        if (!config?.apiKey) return;

        set({ isLoading: true });
        try {
          const baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
          const url = baseUrl.endsWith("/v1")
            ? `${baseUrl}/chat/completions`
            : `${baseUrl}/v1/chat/completions`;

          const systemPrompt = `你是一位精通听觉审美与心理学的“审美基因分析师”。
任务：根据用户的听歌情绪分布和流派偏好，生成一份极具诗意的“听觉基因报告”。
要求：
1. 严格输出 JSON 格式：{"archetype": "人格名号", "motto": "核心格言", "genre": "主导流派", "description": "深度解析"}
2. 语言风格：冷峻、深邃、未来主义。
3. 名号限制在 8 字以内，格言限制在 20 字以内。`;

          const userMessage = `听歌数据汇总：
- 总解析歌曲数：${stats.totalSongs || 0}
- 平均愉悦度 (Valence): ${(stats.averageValence || 0).toFixed(3)}
- 平均能量度 (Energy): ${(stats.averageEnergy || 0).toFixed(3)}
- 主导象限：${stats.dominantQuadrant || "未知"}
- 涉及流派：${(stats.genres || []).slice(0, 5).join(", ")}`;

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.model || "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
              ],
              temperature: 0.8,
              max_tokens: 800,
            }),
          });

          const data = await response.json();
          const raw = data.choices[0]?.message?.content;
          const parsed = extractJson(raw)[0];

          if (parsed) {
            set({
              dnaJournal: {
                ...parsed,
                timestamp: Date.now(),
              },
              isLoading: false,
            });
          } else {
            throw new Error("Failed to parse DNA Journal");
          }
        } catch (error) {
          console.error("generateDNAJournal failed:", error);
          set({ isLoading: false });
        }
      },

      clearCache: () => set({ backstories: {}, metaphors: {}, dnaJournal: null }),
    }),
    {
      name: "mimi-knowledge-storage-v3",
    }
  )
);
