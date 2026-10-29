import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResolverRegistry, type ResolverPlugin, type ResolverPluginContext } from "./plugin";
import { neteasePlugin, platformPlugins, qqPlugin } from "./platforms";
import { resetHttpState } from "@/services/http/client";

interface FetchCall {
  url: string;
  headers?: Record<string, string>;
}

function installFetch(body: (url: string) => unknown, status = 200): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: init?.headers as Record<string, string> | undefined });
      const payload = body(url);
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      } as unknown as Response;
    })
  );
  return calls;
}

function makeContext(overrides: Partial<ResolverPluginContext> = {}): ResolverPluginContext {
  return {
    apiBase: "http://localhost:3025",
    isLoggedIn: () => true,
    headers: () => ({}),
    onUnauthorized: vi.fn(),
    score: () => 100,
    ...overrides,
  };
}

const QUERY = { title: "七里香", artist: "周杰伦", album: "七里香", source: "netease" };

beforeEach(() => {
  resetHttpState();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ResolverRegistry dispatch", () => {
  it("dispatches by plugin id and by legacy alias", async () => {
    const calls = installFetch(() => ({ url: "http://cdn.test/a.mp3", level: "lossless" }));
    const registry = new ResolverRegistry();
    registry.register(neteasePlugin);
    const ctx = makeContext({ headers: () => ({ "x-netease-cookie": "cookie-1" }) });

    const byId = await registry.resolve("netease", { id: "123", query: QUERY }, ctx);
    const byAlias = await registry.resolve("wy", { id: "456", query: QUERY }, ctx);

    expect(byId?.url).toBe("http://cdn.test/a.mp3");
    expect(byAlias?.url).toBe("http://cdn.test/a.mp3");
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/api/song/url?");
    expect(calls[0].url).toContain("id=123");
    expect(calls[0].headers).toEqual({ "x-netease-cookie": "cookie-1" });
  });

  it("returns null for an unknown source without touching the network", async () => {
    const calls = installFetch(() => ({ url: "http://cdn.test/a.mp3" }));
    const registry = new ResolverRegistry();
    registry.register(neteasePlugin);

    const result = await registry.resolve("migu", { query: QUERY }, makeContext());

    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
    expect(registry.metrics().unknownSourceRequests).toBe(1);
  });

  it("skips a plugin whose canHandle rejects the input", async () => {
    const calls = installFetch(() => ({ url: "http://cdn.test/a.mp3" }));
    const registry = new ResolverRegistry();
    registry.register({
      id: "custom",
      label: "Custom",
      canHandle: (input) => input.source === "other",
      resolve: async () => ({
        url: "http://cdn.test/custom.mp3",
        source: "local",
        quality: "high",
        format: "mp3",
        isTrial: false,
      }),
    });

    const result = await registry.resolve(
      "custom",
      { query: QUERY, source: "custom" },
      makeContext()
    );

    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
    expect(registry.metrics().plugins[0].attempts).toBe(0);
  });

  it("keeps one failing plugin from rejecting the race", async () => {
    const registry = new ResolverRegistry();
    const boom: ResolverPlugin = {
      id: "boom",
      label: "Boom",
      canHandle: () => true,
      resolve: async () => {
        throw new Error("platform blew up");
      },
    };
    const ok: ResolverPlugin = {
      id: "ok",
      label: "Ok",
      canHandle: () => true,
      resolve: async () => ({
        url: "http://cdn.test/ok.mp3",
        source: "kuwo",
        quality: "lossless",
        format: "mp3",
        isTrial: false,
      }),
    };
    registry.register(boom);
    registry.register(ok);

    const [failed, succeeded] = await Promise.all([
      registry.resolve("boom", {}, makeContext()),
      registry.resolve("ok", {}, makeContext()),
    ]);

    expect(failed).toBeNull();
    expect(succeeded?.url).toBe("http://cdn.test/ok.mp3");
    expect(registry.metrics().plugins.find((p) => p.id === "boom")?.errors).toBe(1);
  });

  it("counts hits and misses per plugin", async () => {
    installFetch(() => ({}));
    const registry = new ResolverRegistry();
    registry.register(neteasePlugin);
    const ctx = makeContext();

    const miss = await registry.resolve("netease", { id: "1", query: QUERY }, ctx);

    expect(miss).toBeNull();
    expect(registry.metrics().plugins[0]).toMatchObject({ attempts: 1, hits: 0, misses: 1 });
    expect(registry.metrics().http.requests).toBe(1);

    registry.resetStats();
    expect(registry.metrics().plugins[0]).toMatchObject({ attempts: 0, hits: 0, misses: 0 });
  });
});

describe("built-in platform plugins", () => {
  it("registers the five shipped platforms in race order", () => {
    expect(platformPlugins.map((plugin) => plugin.id)).toEqual([
      "netease",
      "qq",
      "kugou",
      "kuwo",
      "qishui",
    ]);
    expect(neteasePlugin.aliases).toEqual(["wy"]);
  });

  it("netease maps an empty url payload to null", async () => {
    installFetch(() => ({}));

    const result = await neteasePlugin.resolve({ id: "1", query: QUERY }, makeContext());

    expect(result).toBeNull();
  });

  it("netease marks the session expired on 401", async () => {
    installFetch(() => ({ message: "unauthorized" }), 401);
    const onUnauthorized = vi.fn();

    const result = await neteasePlugin.resolve(
      { id: "1", query: QUERY },
      makeContext({ onUnauthorized })
    );

    expect(result).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledWith("netease");
  });

  it("qq runs search then url and maps a hires flac", async () => {
    const calls = installFetch((url) =>
      url.includes("/api/qq/song/url")
        ? { url: "http://cdn.test/qq.flac" }
        : { songs: [{ id: "mid-1", title: "七里香", artist: "周杰伦" }] }
    );

    const result = await qqPlugin.resolve({ query: QUERY }, makeContext());

    expect(result).toMatchObject({
      url: "http://cdn.test/qq.flac",
      source: "qq",
      quality: "hires",
      format: "flac",
    });
    expect(calls[1].url).toContain("/api/qq/song/url?mid=mid-1");
  });

  it("does not fetch when the platform is not logged in or the signal is aborted", async () => {
    const calls = installFetch(() => ({ url: "http://cdn.test/a.mp3" }));
    const controller = new AbortController();
    controller.abort();

    const loggedOut = await neteasePlugin.resolve(
      { id: "1", query: QUERY },
      makeContext({ isLoggedIn: () => false })
    );
    const aborted = await neteasePlugin.resolve(
      { id: "1", query: QUERY },
      makeContext({ signal: controller.signal, isLoggedIn: () => true })
    );

    expect(loggedOut).toBeNull();
    expect(aborted).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
