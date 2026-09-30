import { describe, it, expect, vi, afterEach } from "vitest";
import { LXRunner } from "./lxRunner";

describe("LXRunner", () => {
  it("validates valid JavaScript source scripts", async () => {
    const script = `
      module.exports = {
        name: "Test Source",
        search: async function(kw) { return []; },
        url: async function(id) { return "https://example.com/audio.mp3"; }
      };
    `;

    const result = await LXRunner.testScript(script);
    expect(result.success).toBe(true);
    expect(result.details?.hasSearch).toBe(true);
  });

  it("reports syntax errors on broken scripts", async () => {
    const brokenScript = `
      module.exports = {
        broken: function( {
      };
    `;

    const result = await LXRunner.testScript(brokenScript);
    expect(result.success).toBe(false);
    expect(result.message).toContain("异常");
  });

  it("executes search and normalizes song objects", async () => {
    const customScript = {
      id: "test-script-1",
      name: "Custom Test Script",
      author: "Tester",
      version: "1.0.0",
      description: "Test description",
      scriptContent: `
        module.exports = {
          search: async function(keyword) {
            return [{
              id: "test-123",
              title: keyword + " Live",
              artist: "Artist A",
              album: "Album A",
              duration: 300,
              format: "flac"
            }];
          }
        };
      `,
      enabled: true,
      lastUpdated: Date.now(),
      supportedActions: ["search" as const],
    };

    const songs = await LXRunner.search(customScript, "七里香");
    expect(songs.length).toBe(1);
    expect(songs[0].id).toBe("test-123");
    expect(songs[0].title).toBe("七里香 Live");
    expect(songs[0].source).toBe("lx_custom");
  });

  it("preserves a successful empty custom script search without trying fallback APIs", async () => {
    const script = {
      id: "empty-success-script",
      name: "Empty Search Source",
      author: "Tester",
      version: "1.0.0",
      description: "",
      scriptContent: `module.exports = { search: async () => [] };`,
      enabled: true,
      lastUpdated: Date.now(),
      supportedActions: ["search" as const],
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const songs = await LXRunner.search(script, "no matches");

    expect(songs).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when every fallback search API request fails", async () => {
    const script = {
      id: "fallback-failure-script",
      name: "Fallback Failure Source",
      author: "Tester",
      version: "1.0.0",
      description: "",
      scriptContent: `module.exports = {};`,
      enabled: true,
      lastUpdated: Date.now(),
      supportedActions: ["search" as const],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/search?")) throw new Error("network unavailable");
      return { ok: false, status: 503, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(LXRunner.search(script, "unavailable query")).rejects.toThrow(
      /all fallback search providers failed/i
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps an empty fallback result when one API responds successfully and another fails", async () => {
    const script = {
      id: "partial-fallback-script",
      name: "Partial Fallback Source",
      author: "Tester",
      version: "1.0.0",
      description: "",
      scriptContent: `module.exports = {};`,
      enabled: true,
      lastUpdated: Date.now(),
      supportedActions: ["search" as const],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/search?")) throw new Error("one provider unavailable");
      return { ok: true, status: 200, json: async () => ({ songs: [] }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const songs = await LXRunner.search(script, "partial fallback query");

    expect(songs).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
