import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAIStore, DEFAULT_SENSENOVA_CONFIGS, AIConfig } from "./aiStore";
import { networkPriorityManager, NetworkPriority } from "@/services/networkPriorityManager";

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
 * 判断缓存内容是否属于旧版本单一硬编码的重复雷同句式
 */
export function isOldRepetitiveFallback(str?: string | null): boolean {
  if (!str) return true;
  return (
    str.includes("沉入深海三千米") ||
    str.includes("幽蓝潮汐将一切喧嚣悄然吞没") ||
    str.includes("幽蓝微沙将一切应激情绪吞没") ||
    str.includes("穿透琉璃的暖金色微尘") ||
    str.includes("浸润在温热白瓷里的琥珀红茶") ||
    str.includes("金属丝弦剧烈摩擦后的焦灼温度")
  );
}

/**
 * 离线/网络故障时的唯美通感切片算法（高多态性哈希池，杜绝雷同与句式重复）
 */
function generateFallbackLinerNote(
  title: string,
  artist: string,
  emotion?: { x: number; y: number }
): string {
  const safeTitle = title || "旋律";
  const safeArtist = artist || "音浪";

  const POETIC_TEMPLATES: Array<(t: string, a: string) => string> = [
    (t, a) => `像暗金色的融化蜜糖裹着暖风，在${a}的指尖下滑过丝绸般的节拍。`,
    (t, a) => `暮色被《${t}》切成透明的琥珀碎片，空气里漫开青柠与微焦黑胶的香气。`,
    (t, a) => `宛如盛夏午后穿透琉璃的暖金色微尘，随着${a}的起伏折射出跃动脉络。`,
    (t, a) => `如浸润在温热白瓷里的高山红茶，留存着《${t}》那份沉静而悠长的甘润。`,
    (t, a) => `金属琴弦摩擦出三十八度的微烫体温，像暴雨骤停后夜幕裂开的冷青色微光。`,
    (t, a) => `冷杉木质的香气在空气中悄然散逸，《${t}》在指尖凝成剔透的雨滴纹理。`,
    (t, a) => `霓虹光斑在潮湿沥青路面上被踩碎，${a}的低频像气泡在脊椎间轻缓升腾。`,
    (t, a) => `清晨微寒的山雾掠过松针，指尖触碰到的是《${t}》纯粹而空灵的雪白色回响。`,
    (t, a) => `七十五度的热流击穿黑夜的坚冰，在《${t}》的律动里点燃了跳跃的火种。`,
    (t, a) => `丝绒般的月色流过青石苔藓，${a}的声线沉入微风与星屑交织的柔波。`,
    (t, a) => `像极光划过寂静的冰原，每一道折射的光芒都在《${t}》的余音里凝固成诗。`,
    (t, a) => `熟透的野莓汁在温热阳光下发酵，在${a}的轻快步调中溢出微醺的甜意。`,
    (t, a) => `旧胶片在昏黄台灯下慢速卷动，那些关于《${t}》的记忆在灰尘里温柔闪烁。`,
    (t, a) => `深蓝潮汐退去后的湿润海盐气息，静默地包裹住所有未说出口的悸动。`,
    (t, a) => `干燥风声掠过八月的金色麦浪，在《${t}》的旋律里卷起麦芒的细微声响。`,
    (t, a) => `紫水晶般清脆的声响撞碎在深夜，空气里飘荡着${a}独有的清冷与热烈。`,
  ];

  let hash = 0;
  const seed = `${safeArtist}-${safeTitle}-${emotion?.x ?? 0}-${emotion?.y ?? 0}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % POETIC_TEMPLATES.length;
  return POETIC_TEMPLATES[index](safeTitle, safeArtist);
}

let activeLinerNotesController: AbortController | null = null;

export const useLinerNotesStore = create<LinerNotesState>()(
  persist(
    (set, get) => ({
      notes: {},
      isGenerating: false,

      getNotes: async (artist, title, lyrics, emotion, forceRefresh) => {
        if (!title && !artist) return null;

        const key = `${artist || "未知"}-${title || "未知"}`;
        const cached = get().notes[key];
        // 如果已缓存且不是旧版本雷同模板，直接返回命中
        if (cached && !forceRefresh && !isOldRepetitiveFallback(cached)) {
          return cached;
        }

        const aiStore = useAIStore.getState();
        if (aiStore.isEnabled === false) {
          const fallback = generateFallbackLinerNote(title, artist, emotion);
          set((state) => ({ notes: { ...state.notes, [key]: fallback }, isGenerating: false }));
          return fallback;
        }

        // 中止上一个正在进行的 AI 请求，防止切歌时并发打满连接池
        if (activeLinerNotesController) {
          activeLinerNotesController.abort();
          activeLinerNotesController = null;
        }
        activeLinerNotesController = new AbortController();
        const currentSignal = activeLinerNotesController.signal;

        set({ isGenerating: true });

        // 收集所有候选 API 配置（优先当前活跃配置，随后轮询 SenseNova/DeepSeek 备用池）
        const candidateConfigs: AIConfig[] = [];
        if (aiStore.activeConfigId) {
          const active = aiStore.configs.find((c) => c.id === aiStore.activeConfigId);
          if (active && active.apiKey) {
            candidateConfigs.push(active);
          }
        }

        for (const def of DEFAULT_SENSENOVA_CONFIGS) {
          if (!candidateConfigs.some((c) => c.apiKey === def.apiKey && c.model === def.model)) {
            candidateConfigs.push({
              ...def,
              status: "online",
            });
          }
        }

        // 优化候选排序：优先调用响应毫秒级、意象丰富的 deepseek-v4-flash
        candidateConfigs.sort((a, b) => {
          const score = (model?: string) => {
            if (!model) return 9;
            if (model.includes("deepseek-v4-flash")) return 1;
            if (model.includes("deepseek-v4-pro")) return 2;
            if (model.includes("sensenova-6.8")) return 3;
            return 4;
          };
          return score(a.model) - score(b.model);
        });

        const emotionContext = emotion
          ? `[情感底色]：${emotion.x > 0 ? "明朗温润" : "清幽沉静"}，${emotion.y > 0 ? "节拍鲜活有张力" : "舒缓松弛"}`
          : "";

        const systemPrompt = `你是一位精通通感修辞的现代音乐美学鉴赏家。
任务：针对给出的曲目与艺术家${emotionContext ? `（${emotionContext}）` : ""}，直接写出一两句极其独特、富有感官温度与画面通感的凝练短评（关于光影、温度、色彩、触觉或微风质感）。
要求：
1. 字数严格在15到28字之间；
2. 唯美克制，紧扣曲目独特气质，禁止平庸套路；
3. 直接输出这句感悟短语，严禁输出任何思考过程、序号或前缀解释。`;

        const userPrompt = `曲目：《${title}》，艺术家：${artist}${lyrics ? `\n参考歌词：${lyrics.substring(0, 200)}` : ""}`;

        try {
          return await networkPriorityManager.schedule(
            NetworkPriority.P2_BACKGROUND,
            async () => {
              for (const config of candidateConfigs) {
                if (currentSignal.aborted) break;

                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 8000);

                  const onAbort = () => controller.abort();
                  currentSignal.addEventListener("abort", onAbort, { once: true });

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
                      model: config.model || "deepseek-v4-flash",
                      messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                      ],
                      temperature: 0.85,
                      max_tokens: 500,
                    }),
                    signal: controller.signal,
                  });

                  clearTimeout(timeoutId);
                  currentSignal.removeEventListener("abort", onAbort);

                  if (!response.ok) {
                    continue;
                  }

                  const data = await response.json();
                  const message = data.choices?.[0]?.message;
                  let result = (message?.content || "").trim();

                  // 兼容提取：若部分模型将最终句子输出于 reasoning 中
                  if (!result && message?.reasoning_content) {
                    const match = message.reasoning_content.match(/“([^”]{10,40})”/);
                    if (match) {
                      result = match[1].trim();
                    }
                  }

                  if (result && result.length >= 6) {
                    const cleaned = result.replace(/^["“'「]|["”'」]$/g, "").trim();
                    set((state) => ({
                      notes: { ...state.notes, [key]: cleaned },
                      isGenerating: false,
                    }));
                    return cleaned;
                  }
                } catch {
                  continue;
                }
              }

              // 若所有配置超时或失败，优雅采用高多态性唯美本地通感算法，零延迟 100% 可用
              const fallback = generateFallbackLinerNote(title, artist, emotion);
              set((state) => ({
                notes: { ...state.notes, [key]: fallback },
                isGenerating: false,
              }));
              return fallback;
            },
            { signal: currentSignal }
          );
        } catch {
          const fallback = generateFallbackLinerNote(title, artist, emotion);
          set((state) => ({
            notes: { ...state.notes, [key]: fallback },
            isGenerating: false,
          }));
          return fallback;
        } finally {
          set({ isGenerating: false });
        }
      },

      clearCache: () => set({ notes: {} }),
    }),
    {
      name: "mimi-liner-notes-store",
    }
  )
);
