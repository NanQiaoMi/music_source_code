import { describe, it, expect } from "vitest";
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
});
