import { AIConfig } from "@/store/aiStore";
import { AgentMessage, SongResult, ToolCall } from "@/types/aiAgent";
import { AI_AGENT_TOOLS, executeTool } from "./aiAgentTools";

export interface MusicPlaybackContext {
  currentSong?: {
    id?: string;
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    currentTime?: number;
    isPlaying?: boolean;
    lyricsSnippet?: string;
    source?: string;
  } | null;
  emotion?: {
    x: number;
    y: number;
    description?: string;
  } | null;
  timeOfDay?: {
    hour: number;
    periodLabel: string;
    ambientMood: string;
  };
  userPreferences?: {
    favoriteCount?: number;
    topArtists?: string[];
  };
}

export const AI_AGENT_SYSTEM_PROMPT = `你是 MIMI Music Player 的专属「音乐策展人（Music Curator）与声音主理人」。
你拥有顶尖黑胶唱片店主理人的艺术修养与听觉通感。你不仅深谙乐理、配器声学质地（如吉他箱体的木质共振、黑胶底噪的模拟温润感、合成器的低频滤波）与时代音乐流派，更懂得敏锐体察听众在不同时辰与环境下的心境。

你的交互准则与核心信条：
1. 【沉浸式去机械化表达】：
   - 严禁任何 AI 客服套话（如“好的，为您推荐...”、“作为您的AI助手”、“请问还有什么能帮您”）。
   - 直入音乐听感与质地，以富有品味的通感断句、意象切片切入对话。
   - 播控操作（切歌、调音量、设定时、换特效）完成后，仅给出一句轻巧雅致的操作确认即可。

2. 【广度发现与深度导赏准则】：
   - 当听众寻求推荐、找歌或探索某种心情/场景时，调用 \`search_songs\` 工具一次性检索 8~10 首高品质曲目，涵盖不同年代、主流代表与宝藏小众分支。
   - 前端已自动为检索结果渲染出包含试听、连播与下载的精致卡片盒。**绝对严禁在正文中用 Markdown 表格（| # | 歌名 | ... |）重复堆砌曲目列表**。
   - 你的文字回答应短小精悍、优雅自然（通常 2~3 句话），重点针对其中 1~2 首最具辨识度的曲目，用一两句点睛之笔导赏其编曲亮点或情绪锚点。

3. 【当前曲目共振与全能播控】：
   - 系统已动态为你实时注入听众当前正在聆听的曲目、当前进度歌词和 2D 情感坐标。
   - 当听众探讨当前歌曲时，结合正在唱到的歌词与配器质地进行深层艺术剖析。
   - 控制指令执行：
     - 播放/切歌：调用 \`control_playback\`
     - 音量调节：调用 \`set_volume\`
     - 播放循环：调用 \`set_play_mode\`
     - 收藏喜欢：调用 \`like_current_song\`
     - 待播队列：调用 \`add_to_queue\`
     - 全屏特效：调用 \`switch_visualizer\`
     - 睡眠定时：调用 \`set_sleep_timer\`
     - 离线下载与歌词：分别调用 \`download_song\` 与 \`get_lyrics\`

4. 严禁捏造虚假的歌曲或无效链接，保持亲切自然、极简克制、懂音乐、高级优雅。`;

export function buildDynamicPromptContext(context?: MusicPlaybackContext): string {
  if (!context) return "";

  const lines: string[] = ["【当前环境与听觉感知动态上下文（实时注入）】:"];

  // 1. 时段心境
  if (context.timeOfDay) {
    lines.push(`- 当前系统时段：${context.timeOfDay.periodLabel}（${context.timeOfDay.ambientMood}）`);
  }

  // 2. 正在播放曲目态势
  if (context.currentSong) {
    const s = context.currentSong;
    const playState = s.isPlaying ? "正在播放" : "已暂停";
    const curMin = Math.floor((s.currentTime || 0) / 60);
    const curSec = Math.floor((s.currentTime || 0) % 60).toString().padStart(2, "0");
    const durMin = Math.floor((s.duration || 0) / 60);
    const durSec = Math.floor((s.duration || 0) % 60).toString().padStart(2, "0");
    lines.push(
      `- 正在聆听曲目：《${s.title}》 - ${s.artist}${s.album ? `（专辑：《${s.album}》）` : ""} [${playState}，进度 ${curMin}:${curSec} / ${durMin}:${durSec}]`
    );

    if (s.lyricsSnippet) {
      lines.push(`- 当前唱到的歌词片段：\n${s.lyricsSnippet}`);
    }
  } else {
    lines.push("- 当前曲库状态：暂无正在播放的歌曲（静默待播，随时等待唤醒探索新旋律）");
  }

  // 3. 情感心境坐标
  if (context.emotion) {
    const { x, y, description } = context.emotion;
    const valenceText =
      x > 0.2 ? "明亮温润、正面愉悦" : x < -0.2 ? "幽暗清冷、伤感沉郁" : "平静中性、克制留白";
    const arousalText =
      y > 0.2
        ? "能量充沛、颗粒感与律动强烈"
        : y < -0.2
          ? "舒缓失重、轻柔漂流与微醺"
          : "平和自如、节奏从容";
    lines.push(
      `- 旋律 2D 情感坐标：[X=${x.toFixed(2)}, Y=${y.toFixed(2)}] -> ${
        description || `${valenceText}，伴随${arousalText}`
      }`
    );
  } else if (context.currentSong) {
    lines.push("- 旋律情感底色：基于曲目氛围自然推断，以通感与意象共振为基调");
  }

  // 4. 用户偏好
  if (context.userPreferences) {
    const { favoriteCount, topArtists } = context.userPreferences;
    const parts: string[] = [];
    if (favoriteCount !== undefined && favoriteCount > 0) parts.push(`收藏曲目数: ${favoriteCount} 首`);
    if (topArtists && topArtists.length > 0)
      parts.push(`常听艺人偏好: ${topArtists.slice(0, 4).join(" / ")}`);
    if (parts.length > 0) {
      lines.push(`- 听众品味侧写：${parts.join(" · ")}`);
    }
  }

  lines.push(
    "（请根据上述动态环境上下文，在回答、导赏或互动时自然呼应听众此时此刻的心境与听觉状态，保持音乐策展人专属的高级审美与意境）"
  );

  return lines.join("\n");
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessagePayload {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface ChatCompletionChoice {
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason?: string;
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export function formatMessagesForOpenAI(
  messages: AgentMessage[],
  playbackContext?: MusicPlaybackContext
): OpenAIMessagePayload[] {
  const dynamicContextText = buildDynamicPromptContext(playbackContext);
  const fullSystemPrompt = dynamicContextText
    ? `${AI_AGENT_SYSTEM_PROMPT}\n\n${dynamicContextText}`
    : AI_AGENT_SYSTEM_PROMPT;

  const payload: OpenAIMessagePayload[] = [
    {
      role: "system",
      content: fullSystemPrompt,
    },
  ];

  for (const msg of messages) {
    if (msg.role === "user") {
      payload.push({
        role: "user",
        content: msg.content,
      });
    } else if (msg.role === "assistant") {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        payload.push({
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.toolCalls as OpenAIToolCall[],
        });
      } else {
        payload.push({
          role: "assistant",
          content: msg.content || "",
        });
      }
    } else if (msg.role === "tool") {
      payload.push({
        role: "tool",
        tool_call_id: msg.toolCallId || "",
        content: msg.content,
      });
    } else if (msg.role === "system") {
      payload.push({
        role: "system",
        content: msg.content,
      });
    }
  }

  return payload;
}

export function resolveChatCompletionsUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  return cleanBase.endsWith("/v1")
    ? `${cleanBase}/chat/completions`
    : `${cleanBase}/v1/chat/completions`;
}

export interface RunAgentConversationOptions {
  messages: AgentMessage[];
  config: AIConfig;
  fallbackConfigs?: AIConfig[];
  playbackContext?: MusicPlaybackContext;
  onUpdate: (updatedMessages: AgentMessage[], currentToolName: string | null) => void;
  onFallback?: (fromConfig: AIConfig, toConfig: AIConfig, reason: string) => void;
  abortSignal?: AbortSignal;
}

/**
 * 自动提取并解析大模型输出在 content 中的伪 XML / JSON 格式工具调用
 * 兼容 SenseNova / Qwen / DeepSeek 等端点偶尔内联输出的 <tool_call><function=name>...</function>
 */
export function extractInlineToolCalls(content: string): {
  toolCalls: OpenAIToolCall[];
  cleanedContent: string;
} {
  if (!content) return { toolCalls: [], cleanedContent: "" };

  const toolCalls: OpenAIToolCall[] = [];
  let cleaned = content;

  // 1. 匹配 SenseNova 伪 XML 语法:
  // <function=search_songs> 或 <function name="search_songs">
  //   <parameter=limit>8</parameter>
  //   <parameter=query>赵雷 成都</parameter>
  // </function>
  const functionRegex =
    /<function(?:\s*=\s*|\s+name\s*=\s*["']?)([a-zA-Z0-9_-]+)["']?>([\s\S]*?)<\/function>/gi;
  let match: RegExpExecArray | null;

  while ((match = functionRegex.exec(content)) !== null) {
    const fnName = match[1].trim();
    const body = match[2];
    const args: Record<string, unknown> = {};

    // 匹配 <parameter=key>value</parameter> 或 <parameter name="key">value</parameter>
    const paramRegex =
      /<parameter(?:\s*=\s*|\s+name\s*=\s*["']?)([a-zA-Z0-9_-]+)["']?>([\s\S]*?)<\/parameter>/gi;
    let paramMatch: RegExpExecArray | null;
    let hasParams = false;

    while ((paramMatch = paramRegex.exec(body)) !== null) {
      hasParams = true;
      const key = paramMatch[1].trim();
      const rawVal = paramMatch[2].trim();
      let val: unknown = rawVal;
      if (!isNaN(Number(rawVal)) && rawVal !== "") {
        val = Number(rawVal);
      } else if (rawVal === "true") {
        val = true;
      } else if (rawVal === "false") {
        val = false;
      }
      args[key] = val;
    }

    if (!hasParams) {
      // 尝试 JSON 解析
      try {
        const parsed = JSON.parse(body.trim());
        Object.assign(args, parsed);
      } catch {}
    }

    toolCalls.push({
      id: `call_inline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: "function",
      function: {
        name: fnName,
        arguments: JSON.stringify(args),
      },
    });
  }

  // 2. 匹配 <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  const jsonToolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  while ((match = jsonToolCallRegex.exec(content)) !== null) {
    const raw = match[1].trim();
    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.name) {
          toolCalls.push({
            id: `call_inline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: "function",
            function: {
              name: parsed.name,
              arguments:
                typeof parsed.arguments === "string"
                  ? parsed.arguments
                  : JSON.stringify(parsed.arguments || parsed.parameters || {}),
            },
          });
        }
      } catch {}
    }
  }

  // 从文本中彻底清理所有 tool_call、function、parameter 原始代码标签
  cleaned = cleaned
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<tool_call>/gi, "")
    .replace(/<\/tool_call>/gi, "")
    .replace(
      /<function(?:\s*=\s*|\s+name\s*=\s*["']?)[a-zA-Z0-9_-]+["']?>[\s\S]*?<\/function>/gi,
      ""
    )
    .replace(/<function[\s\S]*?<\/function>/gi, "")
    .replace(/<parameter[\s\S]*?<\/parameter>/gi, "")
    .trim();

  return { toolCalls, cleanedContent: cleaned };
}

export function parseAIErrorMessage(status: number, rawText: string): string {
  let message = rawText;
  try {
    const json = JSON.parse(rawText);
    message = json.error?.message || json.message || rawText;
  } catch {
    // raw text
  }

  const lowerMsg = message.toLowerCase();
  if (
    status === 429 ||
    lowerMsg.includes("rpm") ||
    lowerMsg.includes("quota") ||
    lowerMsg.includes("rate limit") ||
    lowerMsg.includes("exhausted")
  ) {
    return "当前 AI 端点调用频次超限 (429 / RPM Exhausted) 或账户余额已用尽。\n💡 建议稍等 10-30 秒后重试，或点击下方「AI 设置」切换为其他服务商端点（如 DeepSeek、SiliconFlow、通义千问或本地 Ollama）。";
  }
  if (status === 401 || lowerMsg.includes("unauthorized") || lowerMsg.includes("api key")) {
    return "API 密钥鉴权失败 (401 Unauthorized)。\n💡 请点击下方「AI 设置」检查 API Key 是否正确或已失效。";
  }
  if (status === 404 || lowerMsg.includes("not found") || lowerMsg.includes("model")) {
    return `未找到目标模型 (${message})。\n💡 请在「AI 设置」中点击「拉取可用模型」重新选择当前端点支持的模型。`;
  }
  if (status === 504 || status === 408 || lowerMsg.includes("timeout")) {
    return "AI 接口请求超时 (504 Timeout)。\n💡 上游服务商响应较慢，建议更换更快或更高并发的端点。";
  }

  return `API 请求失败 (${status}): ${message}`;
}

/**
 * 执行 ReAct 循环驱动的 AI Agent 会话（支持多端点自动故障转移）
 */
export async function runAgentConversation({
  messages,
  config,
  fallbackConfigs = [],
  playbackContext,
  onUpdate,
  onFallback,
  abortSignal,
}: RunAgentConversationOptions): Promise<AgentMessage[]> {
  const currentMessages: AgentMessage[] = [...messages];
  const isBrowser = typeof window !== "undefined";

  let currentConfig = config;
  let remainingFallbacks = [...fallbackConfigs];
  let url = isBrowser ? "/api/ai/chat" : resolveChatCompletionsUrl(currentConfig.baseUrl);

  let openAIMessages = formatMessagesForOpenAI(currentMessages, playbackContext);
  const maxIterations = 5;
  let supportsTools = true;
  let accumulatedSongResults: SongResult[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (abortSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    onUpdate(currentMessages, null);

    let response: Response | null = null;
    let success = false;

    // 单次迭代内的端点请求与故障转移重试循环
    while (!success) {
      if (abortSignal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const requestBody: Record<string, unknown> = {
        baseUrl: currentConfig.baseUrl,
        apiKey: currentConfig.apiKey,
        model: currentConfig.model,
        messages: openAIMessages,
        temperature: currentConfig.temperature ?? 0.7,
        max_tokens: currentConfig.maxTokens ?? 1024,
      };

      if (supportsTools) {
        requestBody.tools = AI_AGENT_TOOLS;
        // 若已执行过工具，引导模型聚焦自然语言总结，避免无谓的重复工具调用
        requestBody.tool_choice = iteration > 1 ? "none" : "auto";
      }

      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentConfig.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: abortSignal,
        });
      } catch (err) {
        if (abortSignal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // 网络或连接异常时的故障转移
        if (remainingFallbacks.length > 0) {
          const nextConfig = remainingFallbacks.shift()!;
          const reason = err instanceof Error ? err.message : "网络连接异常";
          onFallback?.(currentConfig, nextConfig, reason);
          currentConfig = nextConfig;
          url = isBrowser ? "/api/ai/chat" : resolveChatCompletionsUrl(currentConfig.baseUrl);
          supportsTools = true;
          continue;
        }

        throw err;
      }

      // 处理不支持 tools 的模型进行降级重试 (同端点降级)
      if (!response.ok && supportsTools && (response.status === 400 || response.status === 404)) {
        const errorText = await response.text().catch(() => "");
        if (
          errorText.includes("tools") ||
          errorText.includes("tool_choice") ||
          errorText.includes("not supported")
        ) {
          supportsTools = false;
          continue;
        }

        // 若不是单纯的 tools 错误而是 404/400 且有备用端点，尝试备用端点
        if (remainingFallbacks.length > 0) {
          const nextConfig = remainingFallbacks.shift()!;
          onFallback?.(currentConfig, nextConfig, `端点响应 ${response.status}`);
          currentConfig = nextConfig;
          url = isBrowser ? "/api/ai/chat" : resolveChatCompletionsUrl(currentConfig.baseUrl);
          supportsTools = true;
          continue;
        }

        throw new Error(parseAIErrorMessage(response.status, errorText || response.statusText));
      }

      // 处理 429 (限频/额度超限)、401 (密钥失效)、5xx (服务端故障) 自动无感故障转移
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        if (
          (response.status === 429 ||
            response.status === 401 ||
            response.status >= 500 ||
            errorText.includes("rpm") ||
            errorText.includes("quota")) &&
          remainingFallbacks.length > 0
        ) {
          const nextConfig = remainingFallbacks.shift()!;
          const reason = `端点 [${currentConfig.name}] 触发 ${response.status} 限频/错误`;
          onFallback?.(currentConfig, nextConfig, reason);
          currentConfig = nextConfig;
          url = isBrowser ? "/api/ai/chat" : resolveChatCompletionsUrl(currentConfig.baseUrl);
          supportsTools = true;
          continue;
        }

        throw new Error(parseAIErrorMessage(response.status, errorText || response.statusText));
      }

      success = true;
    }

    if (!response) {
      throw new Error("未能获取到有效的服务响应");
    }

    const data: ChatCompletionResponse = await response.json();
    if (data.error) {
      // 业务错误时若有备用端点也可以转移
      if (remainingFallbacks.length > 0) {
        const nextConfig = remainingFallbacks.shift()!;
        onFallback?.(currentConfig, nextConfig, data.error.message || "模型返回业务错误");
        currentConfig = nextConfig;
        url = isBrowser ? "/api/ai/chat" : resolveChatCompletionsUrl(currentConfig.baseUrl);
        supportsTools = true;
        iteration--;
        continue;
      }
      throw new Error(
        parseAIErrorMessage(response.status || 500, data.error.message || "未知 API 错误")
      );
    }

    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error("模型未返回有效消息内容");
    }

    let effectiveToolCalls = message.tool_calls;
    let effectiveContent = message.content || "";

    // 自动检测并提取模型输出在 content 中的内联 XML / JSON 工具调用 (兼容 SenseNova / Qwen / DeepSeek 等端点)
    if (!effectiveToolCalls || effectiveToolCalls.length === 0) {
      const { toolCalls: inlineCalls, cleanedContent } = extractInlineToolCalls(effectiveContent);
      if (inlineCalls.length > 0) {
        effectiveToolCalls = inlineCalls;
        effectiveContent = cleanedContent;
      }
    }

    // 检查是否有工具调用
    if (effectiveToolCalls && effectiveToolCalls.length > 0) {
      const toolCalls: ToolCall[] = effectiveToolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

      const assistantMsg: AgentMessage = {
        id: `msg_toolcall_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        role: "assistant",
        content: effectiveContent,
        timestamp: Date.now(),
        toolCalls,
        status: "streaming",
      };

      currentMessages.push(assistantMsg);
      openAIMessages.push({
        role: "assistant",
        content: effectiveContent || null,
        tool_calls: effectiveToolCalls,
      });

      onUpdate(currentMessages, null);

      // 执行每一个 tool call
      for (const tc of effectiveToolCalls) {
        if (abortSignal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const toolName = tc.function.name;
        onUpdate(currentMessages, toolName);

        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          parsedArgs = {};
        }

        const toolResult = await executeTool(toolName, parsedArgs, { abortSignal });

        let songResults: SongResult[] | undefined = toolResult.songResults;
        if (!songResults && toolResult.songs && toolResult.songs.length > 0) {
          songResults = toolResult.songs.map((s) => ({
            song: s,
            source: s.source || "netease",
            canPlay: true,
            canDownload: true,
          }));
        }
        if (songResults && songResults.length > 0) {
          accumulatedSongResults = [...accumulatedSongResults, ...songResults];
        }

        const toolMsg: AgentMessage = {
          id: `msg_toolres_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          role: "tool",
          toolCallId: tc.id,
          content: JSON.stringify(
            toolResult.data ?? toolResult.message ?? (toolResult.success ? "success" : "failed")
          ),
          timestamp: Date.now(),
          songResults,
          status: "done",
        };

        currentMessages.push(toolMsg);
        openAIMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolMsg.content,
        });

        onUpdate(currentMessages, toolName);
      }

      // 继续进入下一轮循环，让模型总结工具执行结果
      continue;
    }

    // 模型返回普通回复（若模型返回空字符串且有搜索结果，自动提供优雅音乐推荐短语）
    const { cleanedContent: sanitizedContent } = extractInlineToolCalls(effectiveContent);
    let finalContent = sanitizedContent.trim();
    if (!finalContent && accumulatedSongResults.length > 0) {
      finalContent = `为你找到了《**${accumulatedSongResults[0].song.title}**》等 ${accumulatedSongResults.length} 首契合氛围的曲目 🎵，可以直接在下方列表中点击播放：`;
    } else if (!finalContent && iteration > 0) {
      finalContent = `已为你完成操作。`;
    }

    const finalMsg: AgentMessage = {
      id: `msg_assistant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: "assistant",
      content: finalContent,
      timestamp: Date.now(),
      songResults: accumulatedSongResults.length > 0 ? accumulatedSongResults : undefined,
      status: "done",
    };

    currentMessages.push(finalMsg);
    onUpdate(currentMessages, null);
    return currentMessages;
  }

  onUpdate(currentMessages, null);
  return currentMessages;
}

export class AIAgentService {
  public static async runConversation(
    options: RunAgentConversationOptions
  ): Promise<AgentMessage[]> {
    return runAgentConversation(options);
  }
}
