import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAIStore } from "./aiStore";

interface LinerNotesState {
  // Key: artist-title or songId
  notes: Record<string, string>;
  isGenerating: boolean;
  
  // Actions
  getNotes: (artist: string, title: string, lyrics?: string, emotion?: { x: number, y: number }, forceRefresh?: boolean) => Promise<string | null>;
  clearCache: () => void;
}

export const useLinerNotesStore = create<LinerNotesState>()(
  persist(
    (set, get) => ({
      notes: {},
      isGenerating: false,

      getNotes: async (artist, title, lyrics, emotion, forceRefresh) => {
        const key = `${artist}-${title}`;
        const cached = get().notes[key];
        if (cached && !forceRefresh) return cached;

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
          
          const emotionContext = emotion 
            ? `[核心质感]：${emotion.x > 0 ? "偏向明亮/温润" : "偏向幽暗/冷峻"}的底色，伴随${emotion.y > 0 ? "极具颗粒感/侵略性" : "失重/漂流"}的脉络。`
            : "";

          const systemPrompt = `你是一位拒绝平庸、追求极致语义差异的通感艺术家。
任务：将信号源转译为一段 15-30 字的“感官切片”。
${emotionContext}

严律：
1. 禁止套路：严禁使用“时间的铁锈”、“靛蓝色”、“碎裂”、“深渊”等万金油词汇。
2. 语义溯源：必须从歌名或歌词残片中提取一个具体的“物质锚点”，并基于此进行超现实联想。
3. 物理属性：文字中必须包含一个极具辨识度的物理特征（如：特定的温度、化学状态、光折射率或罕见的材质）。
4. 结构：无主体代词。无音乐词汇。仅限一句话。

风格指南：如果这首歌是金属色的，就不要写成丝绒；如果它是干燥的，就不要写成潮湿。追求那种“唯有这首歌才配得上这段文字”的唯一性。`;

          const userPrompt = `信号源：${title} / ${artist}
${lyrics ? `语义残片：${lyrics.substring(0, 400)}` : ""}`;

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
              temperature: 0.95,
              presence_penalty: 0.6, // 鼓励谈论新话题
              frequency_penalty: 0.6, // 减少重复词汇
              max_tokens: 150,
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
