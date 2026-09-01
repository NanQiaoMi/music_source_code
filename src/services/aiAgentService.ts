import { AIConfig } from "@/store/aiStore";
import { AgentMessage, SongResult, ToolCall } from "@/types/aiAgent";
import { AI_AGENT_TOOLS, executeTool } from "./aiAgentTools";

export const AI_AGENT_SYSTEM_PROMPT = `你是 MIMI Music Player 的专属全能音乐管家与极简美学 AI 助手。
你的核心能力与交互准则：
1. 【音乐找寻与推荐】：
   - 深度理解用户的音乐意图（模糊歌词、歌手别名、特定心情场景如“深夜微醺爵士”、“专注写代码的低保真节拍”、小众流派等）。
   - 找歌、听歌、荐歌请优先调用 \`search_songs\` 进行曲库检索。
   - 当用户要求“播放某首歌”但未指明具体版本时，先通过 \`search_songs\` 检索，并在检索后调用 \`play_song\` 立即开播。
2. 【全功能播放器与环境控制】：
   - 播放状态控制：当用户要求“暂停”、“继续”、“下一首”、“上一首”、“切换播放”时，调用 \`control_playback\`。
   - 音量与声音：当用户要求“调大/调小音量”、“音量设为 50%”、“静音”时，调用 \`set_volume\`。
   - 播放循环模式：当用户要求“单曲循环”、“随机播放”、“列表循环”、“顺序播放”时，调用 \`set_play_mode\`。
   - 当前曲目查询：当用户询问“现在在放什么歌？”、“当前播放的歌手是谁？”时，调用 \`get_current_playing\` 并在回复中自然告知用户。
   - 红心收藏：当用户要求“把这首歌加入喜欢/收藏”或“取消收藏”时，调用 \`like_current_song\`。
   - 待播队列：当用户要求“把这些歌加入待播/下一首播放”或“清空待播”时，调用 \`add_to_queue\`。
   - 全屏可视化特效：当用户要求“换成水墨特效”、“开启弧光伴字/流光歌词”、“换成星轨粒子”时，调用 \`switch_visualizer\`。
   - 睡眠定时器：当用户要求“30分钟后停止播放”、“设置睡眠倒计时”或“取消定时”时，调用 \`set_sleep_timer\`。
   - 离线下载与歌词：分别调用 \`download_song\` 与 \`get_lyrics\`。
3. 【至关重要的排版与回答规范】：
   - 当调用 \`search_songs\` 检索到曲目后，前端界面已自动生成精致的独立滚动卡片盒（包含封面、试听播放、添加待播和无损下载按钮）。
   - **绝对严禁在文本中用 Markdown 表格（| # | 歌曲 | ... |）或重复冗长的长列表罗列所有歌曲**，避免造成排版混乱。
   - 你的文字回答应短小精悍、优雅自然、富有音乐品味（通常控制在 2~3 句话以内），简述听感意境并点睛推荐 1~2 首亮点作。
   - 执行控制类操作（如切歌、调音量、设定时、换特效）后，给出一句轻巧贴心的操作确认即可。
4. 严禁捏造虚假的歌曲或无效链接，回复保持亲切自然、懂音乐、高级优雅。`;

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

export function formatMessagesForOpenAI(messages: AgentMessage[]): OpenAIMessagePayload[] {
  const payload: OpenAIMessagePayload[] = [
    {
      role: "system",
      content: AI_AGENT_SYSTEM_PROMPT,
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
  onUpdate: (updatedMessages: AgentMessage[], currentToolName: string | null) => void;
  onFallback?: (fromConfig: AIConfig, toConfig: AIConfig, reason: string) => void;
  abortSignal?: AbortSignal;
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
  onUpdate,
  onFallback,
  abortSignal,
}: RunAgentConversationOptions): Promise<AgentMessage[]> {
  const currentMessages: AgentMessage[] = [...messages];
  const isBrowser = typeof window !== "undefined";

  let currentConfig = config;
  let remainingFallbacks = [...fallbackConfigs];
  let url = isBrowser ? "/api/ai/chat" : resolveChatCompletionsUrl(currentConfig.baseUrl);

  let openAIMessages = formatMessagesForOpenAI(currentMessages);
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

    // 检查是否有工具调用
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCalls: ToolCall[] = message.tool_calls.map((tc) => ({
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
        content: message.content || "",
        timestamp: Date.now(),
        toolCalls,
        status: "streaming",
      };

      currentMessages.push(assistantMsg);
      openAIMessages.push({
        role: "assistant",
        content: message.content || null,
        tool_calls: message.tool_calls,
      });

      onUpdate(currentMessages, null);

      // 执行每一个 tool call
      for (const tc of message.tool_calls) {
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
    let finalContent = message.content?.trim() || "";
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
