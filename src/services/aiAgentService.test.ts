import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runAgentConversation,
  formatMessagesForOpenAI,
  resolveChatCompletionsUrl,
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
      expect(formatted[3]).toEqual({ role: "tool", tool_call_id: "call_1", content: '{"count":1}' });
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
      expect(executeTool).toHaveBeenCalledWith("search_songs", { query: "晴天" }, expect.anything());

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
  });
});
