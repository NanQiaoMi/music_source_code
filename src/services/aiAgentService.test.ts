import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runAgentConversation,
  formatMessagesForOpenAI,
  resolveChatCompletionsUrl,
  extractInlineToolCalls,
  buildDynamicPromptContext,
  MusicPlaybackContext,
} from "./aiAgentService";
import { executeTool } from "./aiAgentTools";
import { AIConfig } from "@/store/aiStore";
import { AgentMessage } from "@/types/aiAgent";

vi.mock("./aiAgentTools", () => ({
  AI_AGENT_TOOLS: [{ type: "function", function: { name: "search_songs" } }],
  executeTool: vi.fn(),
}));

const mockConfig: AIConfig = {
  id: "test-ai-config",
  name: "Test AI",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "test-key",
  model: "gpt-4o",
  status: "online",
};

describe("aiAgentService", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("resolveChatCompletionsUrl", () => {
    it("should resolve correct /chat/completions endpoint", () => {
      expect(resolveChatCompletionsUrl("https://api.openai.com/v1")).toBe(
        "https://api.openai.com/v1/chat/completions"
      );
      expect(resolveChatCompletionsUrl("https://api.openai.com/v1/")).toBe(
        "https://api.openai.com/v1/chat/completions"
      );
      expect(resolveChatCompletionsUrl("https://api.example.com")).toBe(
        "https://api.example.com/v1/chat/completions"
      );
    });
  });

  describe("formatMessagesForOpenAI", () => {
    it("should include system prompt and format user/assistant/tool messages correctly", () => {
      const messages: AgentMessage[] = [
        { id: "1", role: "user", content: "搜索晴天", timestamp: 100 },
        {
          id: "2",
          role: "assistant",
          content: "",
          timestamp: 200,
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "search_songs", arguments: '{"query":"晴天"}' },
            },
          ],
        },
        { id: "3", role: "tool", toolCallId: "call_1", content: '{"count":1}', timestamp: 300 },
      ];

      const formatted = formatMessagesForOpenAI(messages);
      expect(formatted[0].role).toBe("system");
      expect(formatted[1]).toEqual({ role: "user", content: "搜索晴天" });
      expect(formatted[2].role).toBe("assistant");
      expect(formatted[2].tool_calls).toHaveLength(1);
      expect(formatted[3]).toEqual({
        role: "tool",
        tool_call_id: "call_1",
        content: '{"count":1}',
      });
    });

    it("should dynamically inject music playback context into the system prompt", () => {
      const messages: AgentMessage[] = [
        { id: "1", role: "user", content: "分析一下这首歌", timestamp: 100 },
      ];

      const playbackContext: MusicPlaybackContext = {
        currentSong: {
          id: "song-red-bean",
          title: "红豆",
          artist: "王菲",
          album: "唱游",
          duration: 258,
          currentTime: 84,
          isPlaying: true,
          lyricsSnippet: "> 有时候 有时候\n> 我会相信一切有尽头",
        },
        emotion: {
          x: -0.4,
          y: -0.3,
          description: "幽暗清冷、伤感沉郁，伴随舒缓失重的漂流感",
        },
        timeOfDay: {
          hour: 2,
          periodLabel: "深夜时分",
          ambientMood: "万籁俱寂，适宜聆听沉静、温润或内省的声响",
        },
        userPreferences: {
          favoriteCount: 42,
          topArtists: ["王菲", "陈绮贞", "周杰伦"],
        },
      };

      const formatted = formatMessagesForOpenAI(messages, playbackContext);
      const systemContent = formatted[0].content || "";

      expect(systemContent).toContain("音乐策展人");
      expect(systemContent).toContain("红豆");
      expect(systemContent).toContain("王菲");
      expect(systemContent).toContain("有时候 有时候");
      expect(systemContent).toContain("深夜时分");
      expect(systemContent).toContain("幽暗清冷");
      expect(systemContent).toContain("王菲 / 陈绮贞 / 周杰伦");
    });
  });

  describe("buildDynamicPromptContext", () => {
    it("returns empty string when context is undefined", () => {
      expect(buildDynamicPromptContext(undefined)).toBe("");
    });

    it("handles fallback when no song is currently playing", () => {
      const context: MusicPlaybackContext = {
        currentSong: null,
        timeOfDay: {
          hour: 15,
          periodLabel: "午后时光",
          ambientMood: "阳光正好",
        },
      };
      const text = buildDynamicPromptContext(context);
      expect(text).toContain("午后时光");
      expect(text).toContain("暂无正在播放的歌曲");
    });
  });

  describe("runAgentConversation", () => {
    it("should complete a direct conversation without tool calls", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: "assistant",
                content: "你好！请问想听什么歌？",
              },
            },
          ],
        }),
      } as any);

      const onUpdate = vi.fn();
      const messages: AgentMessage[] = [
        { id: "user_1", role: "user", content: "你好", timestamp: 1 },
      ];

      const result = await runAgentConversation({
        messages,
        config: mockConfig,
        onUpdate,
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const lastMsg = result[result.length - 1];
      expect(lastMsg.role).toBe("assistant");
      expect(lastMsg.content).toBe("你好！请问想听什么歌？");
      expect(lastMsg.status).toBe("done");
    });

    it("should execute ReAct tool calling loop when model returns tool_calls", async () => {
      (executeTool as any).mockResolvedValue({
        success: true,
        data: { count: 1, results: [{ id: "song1", title: "晴天" }] },
        songs: [{ id: "song1", title: "晴天", artist: "周杰伦", duration: 260, source: "netease" }],
      });

      // 1st call: returns tool_call
      // 2nd call: returns final summary
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_search_1",
                      type: "function",
                      function: {
                        name: "search_songs",
                        arguments: JSON.stringify({ query: "晴天" }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "为你找到了周杰伦的《晴天》，点击卡片即可播放！",
                },
              },
            ],
          }),
        } as any);

      const onUpdate = vi.fn();
      const messages: AgentMessage[] = [
        { id: "user_1", role: "user", content: "帮我找周杰伦的晴天", timestamp: 1 },
      ];

      const result = await runAgentConversation({
        messages,
        config: mockConfig,
        onUpdate,
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(executeTool).toHaveBeenCalledWith(
        "search_songs",
        { query: "晴天" },
        expect.anything()
      );

      // Should have assistant tool call, tool response, and final assistant message
      const toolMsg = result.find((m) => m.role === "tool");
      expect(toolMsg).toBeDefined();
      expect(toolMsg?.songResults).toHaveLength(1);
      expect(toolMsg?.songResults?.[0].song.title).toBe("晴天");

      const finalMsg = result[result.length - 1];
      expect(finalMsg.content).toBe("为你找到了周杰伦的《晴天》，点击卡片即可播放！");
      expect(finalMsg.status).toBe("done");
    });

    it("should handle request abort cleanly", async () => {
      const controller = new AbortController();
      controller.abort();

      const onUpdate = vi.fn();
      const messages: AgentMessage[] = [
        { id: "user_1", role: "user", content: "找歌", timestamp: 1 },
      ];

      await expect(
        runAgentConversation({
          messages,
          config: mockConfig,
          onUpdate,
          abortSignal: controller.signal,
        })
      ).rejects.toThrow();
    });

    it("should throw on API HTTP error response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Internal Server Error",
      } as any);

      const onUpdate = vi.fn();
      const messages: AgentMessage[] = [
        { id: "user_1", role: "user", content: "找歌", timestamp: 1 },
      ];

      await expect(
        runAgentConversation({
          messages,
          config: mockConfig,
          onUpdate,
        })
      ).rejects.toThrow(/API 请求失败/);
    });

    it("should automatically failover to fallback config when primary config hits 429 rate limit", async () => {
      const fallbackConfig: AIConfig = {
        id: "fallback-ai-config",
        name: "DeepSeek Backup",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-deepseek-backup",
        model: "deepseek-chat",
        status: "online",
      };

      const onFallback = vi.fn();
      const onUpdate = vi.fn();

      // 1st call to primary: 429 rpm exhausted
      // 2nd call to fallback: 200 OK
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          text: async () => JSON.stringify({ error: { message: "rpm exhausted" } }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "来自备用端点的成功回复",
                },
              },
            ],
          }),
        } as any);

      const messages: AgentMessage[] = [
        { id: "user_1", role: "user", content: "找歌", timestamp: 1 },
      ];

      const result = await runAgentConversation({
        messages,
        config: mockConfig,
        fallbackConfigs: [fallbackConfig],
        onUpdate,
        onFallback,
      });

      expect(onFallback).toHaveBeenCalledTimes(1);
      expect(onFallback).toHaveBeenCalledWith(
        mockConfig,
        fallbackConfig,
        expect.stringContaining("429")
      );

      const lastMsg = result[result.length - 1];
      expect(lastMsg.content).toBe("来自备用端点的成功回复");
      expect(lastMsg.status).toBe("done");
    });

    it("should extract and execute inline pseudo-XML tool calls from model content", async () => {
      const inlineXmlOutput = `<tool_call>
<function=search_songs>
<parameter=limit>
8
</parameter>
<parameter=query>
赵雷 成都
</parameter>
</function>
<tool_call>
<function=search_songs>
<parameter=limit>
8
</parameter>
<parameter=query>
马頔 消息
</parameter>
</function>`;

      // 1st call returns inline XML tool calls
      // 2nd call returns final response
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: inlineXmlOutput,
                },
              },
            ],
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "为你找到了赵雷和马頔的经典民谣 🎵",
                },
              },
            ],
          }),
        } as any);

      (executeTool as any).mockResolvedValue({
        success: true,
        songs: [
          {
            id: "song-1",
            title: "成都",
            artist: "赵雷",
            source: "netease",
          },
        ],
      });

      const onUpdate = vi.fn();
      const messages: AgentMessage[] = [
        { id: "user_1", role: "user", content: "来几首民谣", timestamp: 1 },
      ];

      const result = await runAgentConversation({
        messages,
        config: mockConfig,
        onUpdate,
      });

      expect(executeTool).toHaveBeenCalledWith(
        "search_songs",
        { limit: 8, query: "赵雷 成都" },
        expect.anything()
      );
      expect(executeTool).toHaveBeenCalledWith(
        "search_songs",
        { limit: 8, query: "马頔 消息" },
        expect.anything()
      );

      const lastMsg = result[result.length - 1];
      expect(lastMsg.content).toBe("为你找到了赵雷和马頔的经典民谣 🎵");
      expect(lastMsg.songResults).toBeDefined();
      expect(lastMsg.songResults?.[0].song.title).toBe("成都");
    });
  });

  describe("extractInlineToolCalls", () => {
    it("should correctly parse pseudo-XML function and parameter tags", () => {
      const input = `<tool_call>
<function=search_songs>
<parameter=limit>
8
</parameter>
<parameter=query>
朴树 白桦林
</parameter>
</function>`;

      const { toolCalls, cleanedContent } = extractInlineToolCalls(input);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].function.name).toBe("search_songs");
      expect(JSON.parse(toolCalls[0].function.arguments)).toEqual({
        limit: 8,
        query: "朴树 白桦林",
      });
      expect(cleanedContent).toBe("");
    });

    it("should handle mixed text and JSON tool calls", () => {
      const input = `好的，正在为你搜索：<tool_call>{"name":"search_songs","arguments":{"query":"晴天"}}</tool_call>请稍候`;
      const { toolCalls, cleanedContent } = extractInlineToolCalls(input);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].function.name).toBe("search_songs");
      expect(JSON.parse(toolCalls[0].function.arguments)).toEqual({ query: "晴天" });
      expect(cleanedContent).toBe("好的，正在为你搜索：请稍候");
    });
  });
});
