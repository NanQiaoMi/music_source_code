import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAIAgentStore } from "./useAIAgentStore";
import { useAIStore } from "./aiStore";
import { useAudioStore } from "./audioStore";
import { useOfflineDownloadStore } from "./useOfflineDownloadStore";
import { useUIStore } from "./uiStore";
import { runAgentConversation } from "@/services/aiAgentService";
import { Song } from "@/types/song";
import { AgentMessage } from "@/types/aiAgent";

vi.mock("@/services/aiAgentService", () => ({
  runAgentConversation: vi.fn(),
}));

vi.mock("./audioStore", () => ({
  useAudioStore: {
    getState: vi.fn(() => ({
      playSong: vi.fn(),
    })),
  },
}));

vi.mock("./useOfflineDownloadStore", () => ({
  useOfflineDownloadStore: {
    getState: vi.fn(() => ({
      addDownload: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("./uiStore", () => ({
  useUIStore: {
    getState: vi.fn(() => ({
      openPanel: vi.fn(),
      closePanel: vi.fn(),
    })),
  },
}));

vi.mock("./aiStore", () => ({
  useAIStore: {
    getState: vi.fn(() => ({
      configs: [
        {
          id: "cfg_1",
          name: "Test",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-test",
          model: "gpt-4o",
          status: "online",
        },
      ],
      activeConfigId: "cfg_1",
      isEnabled: true,
    })),
  },
}));

describe("useAIAgentStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAIAgentStore.getState().clearMessages();
  });

  it("should initialize with default greeting message and idle status", () => {
    const state = useAIAgentStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].id).toBe("greeting");
    expect(state.isProcessing).toBe(false);
    expect(state.currentToolName).toBeNull();
    expect(state.suggestedPrompts.length).toBeGreaterThan(0);
  });

  it("should send message and update messages when AI config is active", async () => {
    (runAgentConversation as any).mockImplementation(
      async ({ messages }: { messages: AgentMessage[] }) => [
        ...messages,
        {
          id: "msg_final",
          role: "assistant",
          content: "这是为您推荐的歌曲",
          timestamp: Date.now(),
          status: "done",
        },
      ]
    );

    await useAIAgentStore.getState().sendMessage("推荐一首轻音乐");

    const state = useAIAgentStore.getState();
    expect(state.isProcessing).toBe(false);
    expect(state.messages.length).toBe(3); // greeting, user, assistant
    expect(state.messages[1].role).toBe("user");
    expect(state.messages[1].content).toBe("推荐一首轻音乐");
    expect(state.messages[2].content).toBe("这是为您推荐的歌曲");
  });

  it("should warn if no AI config is found", async () => {
    (useAIStore.getState as any).mockReturnValue({
      configs: [],
      activeConfigId: null,
      isEnabled: true,
    });

    await useAIAgentStore.getState().sendMessage("搜索晴天");

    const state = useAIAgentStore.getState();
    expect(state.messages.length).toBe(3); // greeting, user, error/warn
    expect(state.messages[2].status).toBe("error");
    expect(state.messages[2].content).toContain("未检测到可用的 AI 模型配置");
  });

  it("should play song through useAudioStore", () => {
    const playMock = vi.fn();
    (useAudioStore.getState as any).mockReturnValue({ playSong: playMock });

    const song: Song = {
      id: "s1",
      title: "晴天",
      artist: "周杰伦",
      duration: 260,
      source: "netease",
    };

    useAIAgentStore.getState().playSongFromAgent(song);
    expect(playMock).toHaveBeenCalledWith(song);
  });

  it("should download song through useOfflineDownloadStore", async () => {
    const downloadMock = vi.fn().mockResolvedValue(undefined);
    (useOfflineDownloadStore.getState as any).mockReturnValue({ addDownload: downloadMock });

    const song: Song = {
      id: "s1",
      title: "晴天",
      artist: "周杰伦",
      duration: 260,
      source: "netease",
    };

    await useAIAgentStore.getState().downloadSongFromAgent(song);
    expect(downloadMock).toHaveBeenCalledWith(song, "lossless");
  });

  it("should toggle and sync panel state with uiStore", () => {
    const openPanelMock = vi.fn();
    const closePanelMock = vi.fn();
    (useUIStore.getState as any).mockReturnValue({
      openPanel: openPanelMock,
      closePanel: closePanelMock,
    });

    useAIAgentStore.getState().openPanel();
    expect(useAIAgentStore.getState().isPanelOpen).toBe(true);
    expect(openPanelMock).toHaveBeenCalledWith("aiAgent");

    useAIAgentStore.getState().closePanel();
    expect(useAIAgentStore.getState().isPanelOpen).toBe(false);
    expect(closePanelMock).toHaveBeenCalledWith("aiAgent");

    useAIAgentStore.getState().togglePanel();
    expect(useAIAgentStore.getState().isPanelOpen).toBe(true);
  });

  it("should clear messages and reset state", () => {
    useAIAgentStore.setState({
      messages: [
        { id: "1", role: "user", content: "hello", timestamp: 1 },
        { id: "2", role: "assistant", content: "world", timestamp: 2 },
      ],
      isProcessing: true,
      currentToolName: "search_songs",
    });

    useAIAgentStore.getState().clearMessages();
    const state = useAIAgentStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].id).toBe("greeting");
    expect(state.isProcessing).toBe(false);
    expect(state.currentToolName).toBeNull();
  });
});
