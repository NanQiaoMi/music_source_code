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
});
