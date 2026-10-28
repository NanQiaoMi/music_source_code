import { describe, it, expect, vi, afterEach } from "vitest";
import { LXRunner } from "./lxRunner";

const cryptoLoads = vi.hoisted(() => ({ count: 0 }));

vi.mock("crypto-js", async (importOriginal) => {
  cryptoLoads.count += 1;
  return await importOriginal<typeof import("crypto-js")>();
});

const customScriptBase = {
  name: "Concurrent Source",
  author: "Tester",
  version: "1.0.0",
  description: "",
  enabled: true,
  lastUpdated: 0,
  supportedActions: ["search" as const],
};

describe("LXRunner", () => {
  it("loads crypto-js once for concurrent LX entries and reuses it afterwards", async () => {
    const script = `module.exports = { search: async () => [] };`;

    await Promise.all([
      LXRunner.testScript(script),
      LXRunner.testScript(script),
      LXRunner.search(
        { ...customScriptBase, scriptContent: script, id: "concurrent-search" },
        "keyword"
      ),
    ]);
    expect(cryptoLoads.count).toBe(1);

    await LXRunner.testScript(script);
    expect(cryptoLoads.count).toBe(1);
  });

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

  it("keeps LX crypto helpers byte-compatible with the previous crypto-js output", async () => {
    const script = `
      lx.send(lx.EVENT_NAMES.inited, {
        md5: lx.utils.crypto.md5("hello"),
        sha256: lx.utils.crypto.sha256("hello"),
        base64: lx.utils.crypto.base64.encode("hello"),
        base64Decoded: lx.utils.crypto.base64.decode("aGVsbG8="),
        hexToUtf8: lx.utils.buffer.bufToString(lx.utils.buffer.from("68656c6c6f", "hex"), "utf8"),
        aes: lx.utils.crypto.aesEncrypt("hello", "cbc", "1234567890123456", "6543210987654321")
      });
    `;

    const result = await LXRunner.testScript(script);

    expect(result.success).toBe(true);
    expect(result.details?.initedInfo).toEqual({
      md5: "5d41402abc4b2a76b9719d911017c592",
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      base64: "aGVsbG8=",
      base64Decoded: "hello",
      hexToUtf8: "hello",
      aes: "WcQYnUww0VTFgh1HE4gepg==",
    });
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
