import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "./route";

function makeRequest(source = "all", headers: Record<string, string> = {}): NextRequest {
  const params = new URLSearchParams({ keywords: "playlist boundary", limit: "12", source });
  return {
    url: `http://localhost:3025/api/playlist/search?${params.toString()}`,
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/playlist/search provider outcomes", () => {
  it("returns 503 when every attempted playlist provider request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("NetEase unavailable"))
      .mockResolvedValueOnce(jsonResponse(503, {}));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      makeRequest("all", {
        "x-netease-cookie": "netease-session-cookie",
        "x-qq-cookie": "qq-session-cookie",
      })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ playlists: [], code: 503, count: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps HTTP 200 and the success schema when a provider succeeds with no playlists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result: { playlists: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      makeRequest("netease", { "x-netease-cookie": "netease-session-cookie" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ playlists: [], code: 200, count: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps HTTP 200 for an empty partial success when another provider fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("NetEase unavailable"))
      .mockResolvedValueOnce(jsonResponse(200, { data: { list: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      makeRequest("all", {
        "x-netease-cookie": "netease-session-cookie",
        "x-qq-cookie": "qq-session-cookie",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ playlists: [], code: 200, count: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps HTTP 200 with an empty result when no provider is attempted", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(makeRequest("all"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ playlists: [], code: 200, count: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
