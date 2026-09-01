import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAIStore, DEFAULT_SENSENOVA_CONFIGS, AIConfig } from "./aiStore";

interface LinerNotesState {
  // Key: artist-title or songId
  notes: Record<string, string>;
  isGenerating: boolean;

  // Actions
  getNotes: (
    artist: string,
    title: string,
    lyrics?: string,
    emotion?: { x: number; y: number },
    forceRefresh?: boolean
  ) => Promise<string | null>;
  clearCache: () => void;
}

/**
 * 离线/网络故障时的唯美通感切片算法（兜底保障 100% 优雅可用）
 */
function generateFallbackLinerNote(
  title: string,
  artist: string,
  emotion?: { x: number; y: number }
): string {
  const x = emotion?.x ?? 0;
  const y = emotion?.y ?? 0;

  if (x > 0.2 && y > 0.2) {
    return `宛如午后穿透琉璃的暖金色微尘，在${artist}的明朗节拍里折射出跳跃的光晕。`;
  } else if (x > 0.2 && y <= 0.2) {
    return `如浸润在温热白瓷里的琥珀红茶，留存着《${title}》那份沉静而悠长的回甘。`;
  } else if (x <= 0.2 && y > 0.2) {
    return `金属丝弦剧烈摩擦后的焦灼温度，如暴雨骤停后夜幕裂开的冷青色电光。`;
  } else {
    return `沉入深海三千米处的静止气压，任由《${title}》的幽蓝潮汐将一切喧嚣悄然吞没。`;
  }
}

export const useLinerNotesStore = create<LinerNotesState>()(
  persist(
    (set, get) => ({
      notes: {},
      isGenerating: false,

      getNotes: async (artist, title, lyrics, emotion, forceRefresh) => {
        if (!title && !artist) return null;

        const key = `${artist || "未知"}-${title || "未知"}`;
        const cached = get().notes[key];
        if (cached && !forceRefresh) return cached;

        const aiStore = useAIStore.getState();
        if (!aiStore.isEnabled) {
          set({ isGenerating: false });
          return null;
        }

        set({ isGenerating: true });

        // 收集所有候选 API 配置（优先当前活跃配置，随后轮询 SenseNova 备用池）
        const candidateConfigs: AIConfig[] = [];
        if (aiStore.activeConfigId) {
          const active = aiStore.configs.find((c) => c.id === aiStore.activeConfigId);
          if (active && active.apiKey) {
            candidateConfigs.push(active);
          }
        }

        // 加入所有已知 SenseNova 候选配置
        for (const def of DEFAULT_SENSENOVA_CONFIGS) {
          if (!candidateConfigs.some((c) => c.apiKey === def.apiKey)) {
            candidateConfigs.push({
              ...def,
              status: "online",
            });
          }
        }

        const emotionContext = emotion
          ? `[核心质感]：${emotion.x > 0 ? "偏向明亮/温润" : "偏向幽暗/冷峻"}的底色，伴随${emotion.y > 0 ? "极具颗粒感/侵略性" : "失重/漂流"}的脉络。`
          : "";

        const systemPrompt = `你是一位追求极致语义差异的音乐通感艺术家。
任务：将歌曲转译为一段 15-30 字的“感官切片”。
${emotionContext}

严律：
1. 禁止套路：严禁使用“时间的铁锈”、“靛蓝色”、“碎裂”、“深渊”等万金油词汇。
2. 语义溯源：必须从歌名或歌词残片中提取一个具体的“物质锚点”，并基于此进行超现实通感联想。
3. 物理属性：文字中必须包含一个极具辨识度的物理特征（如：特定的温度、化学状态、光折射率或材质）。
4. 结构：无主体代词，无纯音乐术语，仅限一两句精炼短语。`;

        const userPrompt = `信号源：${title} / ${artist}
${lyrics ? `语义残片：${lyrics.substring(0, 300)}` : ""}`;

        // 逐一轮询配置池
        for (const config of candidateConfigs) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9000);

            const isBrowser = typeof window !== "undefined";
            const baseUrl = config.baseUrl.replace(/\/$/, "");
            const url = isBrowser
              ? "/api/ai/chat"
              : baseUrl.endsWith("/v1")
                ? `${baseUrl}/chat/completions`
                : `${baseUrl}/v1/chat/completions`;

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
              },
              body: JSON.stringify({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                model: config.model || "sensenova-6.8-flash-lite",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                temperature: 0.85,
                max_tokens: 100,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              continue; // 自动故障转移至下一个 Key
            }

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content?.trim();

            if (result && result.length >= 6) {
              // 清理多余引号
              const cleaned = result.replace(/^["“'「]|["”'」]$/g, "").trim();
              set((state) => ({
                notes: { ...state.notes, [key]: cleaned },
                isGenerating: false,
              }));
              return cleaned;
            }
          } catch {
            // 继续下一个 Key
            continue;
          }
        }

        console.warn("[LinerNotes] Failed to generate liner notes: all upstream requests failed");
        set({ isGenerating: false });
        return null;
      },

      clearCache: () => set({ notes: {} }),
    }),
    {
      name: "mimi-liner-notes-store",
    }
  )
);
