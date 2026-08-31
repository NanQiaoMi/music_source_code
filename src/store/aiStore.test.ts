import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAIStore } from "./aiStore";

describe("aiStore", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    useAIStore.setState({
      configs: [
        {
          id: "cfg-1",
          name: "Local relay",
          baseUrl: "https://api.example.com/v1",
          apiKey: "test-key",
          model: "",
          status: "idle",
        },
      ],
      activeConfigId: null,
      isEnabled: true,
    });
  });

  it("filters model ids from relay payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "gpt-4.1" }, { id: 42 }, {}, { id: "" }] }),
      })
    );

    await expect(useAIStore.getState().fetchModels("cfg-1")).resolves.toEqual(["gpt-4.1"]);
  });

  it("orders config pool with primary first and others sorted by online status and latency", () => {
    useAIStore.setState({
      configs: [
        {
          id: "cfg-1",
          name: "SenseNova",
          baseUrl: "https://token.sensenova.cn/v1",
          apiKey: "key-1",
          model: "SenseChat-5",
          status: "online",
          latency: 650,
        },
        {
          id: "cfg-2",
          name: "DeepSeek",
          baseUrl: "https://api.deepseek.com/v1",
          apiKey: "key-2",
          model: "deepseek-chat",
          status: "online",
          latency: 220,
        },
        {
          id: "cfg-3",
          name: "SiliconFlow",
          baseUrl: "https://api.siliconflow.cn/v1",
          apiKey: "key-3",
          model: "deepseek-v3",
          status: "idle",
        },
      ],
      activeConfigId: "cfg-1",
      enableAutoFallback: true,
    });

    const pool = useAIStore.getState().getOrderedConfigPool("cfg-1");
    expect(pool).toHaveLength(3);
    // Primary first
    expect(pool[0].id).toBe("cfg-1");
    // DeepSeek second (online & 220ms)
    expect(pool[1].id).toBe("cfg-2");
    // SiliconFlow third (idle)
    expect(pool[2].id).toBe("cfg-3");
  });

  it("toggles and sets auto fallback state", () => {
    expect(useAIStore.getState().enableAutoFallback).toBe(true);
    useAIStore.getState().toggleAutoFallback();
    expect(useAIStore.getState().enableAutoFallback).toBe(false);
    useAIStore.getState().setAutoFallback(true);
    expect(useAIStore.getState().enableAutoFallback).toBe(true);
  });
});
