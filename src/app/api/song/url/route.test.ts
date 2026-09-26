import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/netease/request", () => ({
  neteaseWeApiRequest: vi.fn(),
}));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FetchCall {
  url: string;
  at: number;
}

/**
 * 按目标域名分流的 fetch 桩：记录发起时刻，便于断言"两条分支是否真的同时启动"。
 */
function installFetchMock(plan: {
  neteaseDelayMs?: number;
  neteaseStatus?: number;
  neteaseLocation?: string;
  kuwoSearchDelayMs?: number;
  kuwoConvertDelayMs?: number;
  kuwoMatch?: boolean;
}) {
  const calls: FetchCall[] = [];

  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push({ url, at: performance.now() });

    if (url.includes("music.163.com")) {
      await sleep(plan.neteaseDelayMs ?? 0);
      const status = plan.neteaseStatus ?? 301;
      const headers = new Headers();
      if (plan.neteaseLocation) headers.set("location", plan.neteaseLocation);
      return {
        ok: status >= 200 && status < 300,
        status,
        headers,
        text: async () => "",
      } as Response;
    }

    if (url.includes("search.kuwo.cn")) {
      await sleep(plan.kuwoSearchDelayMs ?? 0);
      const abslist =
        plan.kuwoMatch === false
          ? []
          : [{ SONGNAME: "稻香", ARTIST: "周杰伦", DC_TARGETID: "6912345" }];
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ abslist }),
      } as unknown as Response;
    }

    if (url.includes("antiserver.kuwo.cn")) {
      await sleep(plan.kuwoConvertDelayMs ?? 0);
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => "http://kw.example/6912345.mp3",
      } as unknown as Response;
    }

    return { ok: false, status: 404, headers: new Headers(), text: async () => "" } as Response;
  });

  vi.stubGlobal("fetch", mock);
  return { calls, mock };
}

const makeRequest = (qs: string): NextRequest =>
  ({
    url: `http://localhost:3025/api/song/url?${qs}`,
    headers: new Headers(),
  }) as unknown as NextRequest;

const NETEASE_QS =
  "source=netease&id=185827&title=" +
  encodeURIComponent("稻香") +
  "&artist=" +
  encodeURIComponent("周杰伦");

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/song/url 并发改造", () => {
  it("官方通道还在等的时候，跨源嗅探就已经发起了（旧实现要等官方跑完才开始）", async () => {
    const { calls } = installFetchMock({
      neteaseDelayMs: 600, // 官方外链 HEAD 慢
      neteaseStatus: 200,
      kuwoSearchDelayMs: 40,
      kuwoConvertDelayMs: 10,
    });

    await GET(makeRequest(NETEASE_QS));

    const officialAt = calls.find((c) => c.url.includes("music.163.com"))?.at;
    const crossAt = calls.find((c) => c.url.includes("search.kuwo.cn"))?.at;
    expect(officialAt).toBeDefined();
    expect(crossAt).toBeDefined();
    // 关键断言：跨源搜索在官方 HEAD 返回之前就已发起
    expect(crossAt! - officialAt!).toBeLessThan(100);
  });

  it("两条分支都成功时接受官方通道（优先级与旧实现一致）", async () => {
    installFetchMock({
      neteaseDelayMs: 120,
      neteaseStatus: 301,
      neteaseLocation: "http://m.music.163.com/outer/url.mp3",
      kuwoSearchDelayMs: 5,
      kuwoConvertDelayMs: 5,
    });

    const res = await GET(makeRequest(NETEASE_QS));
    const body = (await res.json()) as { url: string; source: string; code: number };

    expect(body.code).toBe(200);
    expect(body.source).toBe("netease");
    expect(body.url).toContain("m.music.163.com");
  });

  it("官方通道失败时回落到跨源嗅探，而不是直接 404", async () => {
    installFetchMock({
      neteaseDelayMs: 80,
      neteaseStatus: 404,
      kuwoSearchDelayMs: 10,
      kuwoConvertDelayMs: 5,
    });

    const res = await GET(makeRequest(NETEASE_QS));
    const body = (await res.json()) as { url: string; source: string; code: number };

    expect(body.code).toBe(200);
    expect(body.source).toBe("kuwo");
    expect(body.url).toContain("kw.example");
  });

  it("打分不过（歌手不匹配）时不返回串歌结果", async () => {
    installFetchMock({
      neteaseDelayMs: 5,
      neteaseStatus: 404,
      kuwoSearchDelayMs: 5,
      kuwoMatch: false,
    });

    const res = await GET(makeRequest(NETEASE_QS));
    const body = (await res.json()) as { url: string; code: number };

    expect(body.code).toBe(404);
    expect(body.url).toBe("");
  });
});
