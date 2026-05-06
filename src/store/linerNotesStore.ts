import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAIStore } from "./aiStore";

interface LinerNotesState {
  // Key: artist-title or songId
  notes: Record<string, string>;
  isGenerating: boolean;
  
  // Actions
  getNotes: (artist: string, title: string, lyrics?: string) => Promise<string | null>;
  clearCache: () => void;
}

export const useLinerNotesStore = create<LinerNotesState>()(
  persist(
    (set, get) => ({
      notes: {},
      isGenerating: false,

      getNotes: async (artist, title, lyrics) => {
        const key = `${artist}-${title}`;
        const cached = get().notes[key];
        if (cached) return cached;

        const aiStore = useAIStore.getState();
        const activeConfigId = aiStore.activeConfigId;
        const config = aiStore.configs.find((c) => c.id === activeConfigId);

        if (!config || config.status !== "online") {
          return null;
        }

        set({ isGenerating: true });

        try {
          const baseUrl = config.baseUrl.replace(/\/$/, "");
          const url = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
          
          const systemPrompt = `你是一位拥有 20 年经验的高级音乐评论家，为《Pitchfork》或《The Wire》等前卫音乐杂志撰稿。
你的任务是为一首歌生成一段极简的“灵魂摘要”。
风格要求：
1. 抽象且富有感官色彩：关注质感（texture）、色彩（color）、温度（temperature）和空间感（space）。
2. 措辞高级：避免使用“好听”、“感人”等通俗词汇。使用如“铝制触感”、“余烬中的回响”、“极简主义的脉冲”、“流动的深蓝”等词汇。
3. 字数极简：20-40 个字。
4. 重点：不是在描述歌词，而是在描述这首歌带来的“情绪底色”和“视觉通感”。

示例：“这首歌的底色是冰冷的铝制触感，混合了深夜 3 点的孤寂与微光。”`;

          const userPrompt = `歌曲名：${title}
艺术家：${artist}
${lyrics ? `部分歌词：${lyrics.substring(0, 300)}` : ""}`;

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
                { role: "user", content: userPrompt },
              ],
              temperature: 0.7,
              max_tokens: 100,
            }),
          });

          if (!response.ok) throw new Error("AI Generation failed");

          const data = await response.json();
          const result = data.choices[0]?.message?.content?.trim();

          if (result) {
            set((state) => ({
              notes: { ...state.notes, [key]: result },
              isGenerating: false,
            }));
            return result;
          }
        } catch (error) {
          console.error("Failed to generate liner notes:", error);
        } finally {
          set({ isGenerating: false });
        }

        return null;
      },

      clearCache: () => set({ notes: {} }),
    }),
    {
      name: "mimi-liner-notes-store",
    }
  )
);
