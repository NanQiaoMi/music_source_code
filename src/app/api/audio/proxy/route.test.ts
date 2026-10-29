import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("node:dns/promises", () => {
  const lookup = vi.fn();
  return { lookup, default: { lookup } };
});

vi.mock("@/lib/audio/proxyDiskCache", () => ({
  getCacheKey: vi.fn(() => "test-cache-key"),
  hasCompleteCache: vi.fn(async () => ({ isHit: false, filePath: "", meta: null })),
  serveCachedFile: vi.fn(),
  cacheStreamAndTee: vi.fn(
    (
      _key: string,
      _url: string,
      _contentType: string,
      _expectedLength: number,
      stream: ReadableStream<Uint8Array>
    ) => stream
  ),
}));

import { lookup } from "node:dns/promises";
import { hasCompleteCache, serveCachedFile } from "@/lib/audio/proxyDiskCache";
import { MAX_PROXY_BYTES } from "@/lib/audio/proxyGuard";
import { GET } from "./route";

const PUBLIC_ADDRESS = { address: "93.184.216.34", family: 4 };

const lookupMock = vi.mocked(
  lookup as unknown as (
    hostname: string,
    options: { all: true }
  ) => Promise<{ address: string; family: number }[]>
);

function makeRequest(
  targetUrl: string | null,
  options: { range?: string; signal?: AbortSignal } = {}
): NextRequest {
  const path =
    targetUrl === null
      ? "/api/audio/proxy"
      : `/api/audio/proxy?url=${encodeURIComponent(targetUrl)}`;
  const headers = new Headers();
  if (options.range) headers.set("range", options.range);
  return {
    url: `http://localhost:3025${path}`,
    headers,
    signal: options.signal ?? new AbortController().signal,
  } as unknown as NextRequest;
}

function audioResponse(
  bytes = new Uint8Array([1, 2, 3]),
  headers: Record<string, string> = {}
): Response {
  return new Response(bytes, {
    status: 200,
    headers: { "content-type": "audio/mpeg", ...headers },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  lookupMock.mockReset();
  lookupMock.mockResolvedValue([PUBLIC_ADDRESS]);
  vi.mocked(hasCompleteCache).mockReset();
  vi.mocked(hasCompleteCache).mockResolvedValue({ isHit: false, filePath: "", meta: null });
  vi.mocked(serveCachedFile).mockReset();
  delete process.env.MIMI_PROXY_ALLOW_PRIVATE;
  delete process.env.MIMI_PROXY_TIMEOUT_MS;

  fetchMock = vi.fn(async () => audioResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.unstubAllGlobals();
  delete process.env.MIMI_PROXY_ALLOW_PRIVATE;
  delete process.env.MIMI_PROXY_TIMEOUT_MS;
});

describe("/api/audio/proxy 出站目标校验", () => {
  it("允许公网 URL，并按既有契约透传响应与缓存头", async () => {
    const res = await GET(makeRequest("https://cdn.example.com/song.mp3"));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-cache")).toBe("MISS");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

    expect(lookup).toHaveBeenCalledWith("cdn.example.com", { all: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toBe("https://cdn.example.com/song.mp3");
    expect(init?.redirect).toBe("manual");
  });

  it("缓存命中时直接返回 206，不再做 DNS 查询或回源", async () => {
    vi.mocked(hasCompleteCache).mockResolvedValue({
      isHit: true,
      filePath: "C:/cache/audio.bin",
      meta: {
        url: "https://cdn.example.com/song.mp3",
        contentType: "audio/mpeg",
        contentLength: 10000,
        lastAccessed: 0,
        createdAt: 0,
        complete: true,
      },
    });
    vi.mocked(serveCachedFile).mockReturnValue(
      new Response(new Uint8Array([9]), {
        status: 206,
        headers: { "content-range": "bytes 0-0/10000", "x-cache": "HIT" },
      })
    );

    const res = await GET(
      makeRequest("https://cdn.example.com/song.mp3", { range: "bytes=0-1023" })
    );

    expect(res.status).toBe(206);
    expect(res.headers.get("x-cache")).toBe("HIT");
    expect(serveCachedFile).toHaveBeenCalledWith(
      "C:/cache/audio.bin",
      expect.anything(),
      "bytes=0-1023"
    );
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("上游 206 Range 响应保持原状态与 Content-Range", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(new Uint8Array([1, 2]), {
          status: 206,
          headers: {
            "content-type": "audio/mpeg",
            "content-length": "2",
            "content-range": "bytes 0-1/100",
          },
        })
    );

    const res = await GET(makeRequest("https://cdn.example.com/song.mp3", { range: "bytes=0-1" }));

    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-1/100");
    expect(res.headers.get("content-length")).toBe("2");
  });

  it("缺少 url 参数时返回 400", async () => {
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["file:///etc/passwd", "ftp://example.com/a.mp3", "httpfoo://example.com/a.mp3"])(
    "拒绝非 http(s) 协议：%s",
    async (targetUrl) => {
      const res = await GET(makeRequest(targetUrl));
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("拒绝 URL 内嵌凭据", async () => {
    const res = await GET(makeRequest("https://user:secret@cdn.example.com/a.mp3"));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://localhost:3025/a.mp3",
    "http://printer.local/a.mp3",
    "http://metadata.google.internal/computeMetadata/v1/",
  ])("拒绝本地主机名：%s", async (targetUrl) => {
    const res = await GET(makeRequest(targetUrl));
    expect(res.status).toBe(403);
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://127.0.0.1/a.mp3",
    "http://10.0.0.5/a.mp3",
    "http://172.16.0.1/a.mp3",
    "http://192.168.1.10/a.mp3",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.100.100.200/latest/meta-data/",
    "http://0.0.0.0/a.mp3",
  ])("拒绝回环/私网/链路本地/元数据 IPv4：%s", async (targetUrl) => {
    const res = await GET(makeRequest(targetUrl));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://[::1]/a.mp3",
    "http://[fd00::1]/a.mp3",
    "http://[fe80::1]/a.mp3",
    "http://[::ffff:127.0.0.1]/a.mp3",
  ])("拒绝回环/ULA/链路本地 IPv6：%s", async (targetUrl) => {
    const res = await GET(makeRequest(targetUrl));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("域名解析到私网地址时拒绝", async () => {
    lookupMock.mockResolvedValue([{ address: "10.1.2.3", family: 4 }]);

    const res = await GET(makeRequest("https://internal.example.com/a.mp3"));

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DNS 解析失败按拒绝处理", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));

    const res = await GET(makeRequest("https://missing.example.com/a.mp3"));

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("上游超时返回 504 并中断 fetch", async () => {
    process.env.MIMI_PROXY_TIMEOUT_MS = "25";
    fetchMock.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        })
    );

    const startedAt = Date.now();
    const res = await GET(makeRequest("https://slow.example.com/a.mp3"));

    expect(res.status).toBe(504);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it("客户端中断会传播到上游 fetch 并返回 499", async () => {
    const controller = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          upstreamSignal = init?.signal ?? undefined;
          upstreamSignal?.addEventListener("abort", () => reject(upstreamSignal?.reason), {
            once: true,
          });
        })
    );

    const pending = GET(
      makeRequest("https://slow.example.com/a.mp3", { signal: controller.signal })
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    controller.abort(new DOMException("client gone", "AbortError"));

    const res = await pending;

    expect(res.status).toBe(499);
    expect(upstreamSignal?.aborted).toBe(true);
  });

  it("content-length 超过 100MB 上限时返回 413", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: {
            "content-type": "audio/flac",
            "content-length": String(MAX_PROXY_BYTES + 1),
          },
        })
    );

    const res = await GET(makeRequest("https://cdn.example.com/huge.flac"));

    expect(res.status).toBe(413);
  });

  it("重定向到私网地址时拒绝", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        })
    );

    const res = await GET(makeRequest("https://cdn.example.com/redirect.mp3"));

    expect(res.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("MIMI_PROXY_ALLOW_PRIVATE=1 时允许回环地址（测试/开发逃生口）", async () => {
    process.env.MIMI_PROXY_ALLOW_PRIVATE = "1";

    const res = await GET(makeRequest("http://127.0.0.1:8000/a.mp3"));

    expect(res.status).toBe(200);
    expect(lookup).not.toHaveBeenCalled();
  });
});
