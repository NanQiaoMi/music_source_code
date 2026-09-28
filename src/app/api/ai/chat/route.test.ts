import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

/** 这几个环境变量决定路由拿哪把钥匙，测试里必须完全接管 */
const ENV_KEYS = [
  "SENSENOVA_API_KEY_1",
  "SENSENOVA_API_KEY",
  "SENSENOVA_BASE_URL",
  "SENSENOVA_DEFAULT_MODEL",
] as const;

const ENV_KEY = "env-secret-key";
const CALLER_KEY = "caller-stale-key";
const SENSENOVA_BASE = "https://token.sensenova.cn/v1";

let savedEnv: Record<string, string | undefined> = {};

interface UpstreamReply {
  status: number;
  body: Record<string, unknown>;
}

interface RecordedCall {
  url: string;
  auth: string;
}

/** 按预设顺序逐次回复的 fetch 桩，记录每次的 Authorization */
function installFetchMock(replies: UpstreamReply[]): RecordedCall[] {
  const calls: RecordedCall[] = [];
  let index = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        auth: new Headers(init?.headers).get("authorization") || "",
      });
      const reply = replies[Math.min(index, replies.length - 1)];
      index += 1;
      return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        statusText: reply.status === 401 ? "Unauthorized" : "OK",
        headers: new Headers(),
        text: async () => JSON.stringify(reply.body),
      } as unknown as Response;
    })
  );

  return calls;
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
    headers: {
      get: () => null,
    },
  } as unknown as NextRequest;
}

/** 默认打到 SenseNova，省掉每个用例重复写 baseUrl */
function chatBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    baseUrl: SENSENOVA_BASE,
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: "hi" }],
    max_tokens: 5,
    ...overrides,
  };
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.SENSENOVA_API_KEY_1 = ENV_KEY;
  process.env.SENSENOVA_BASE_URL = SENSENOVA_BASE;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/ai/chat 密钥解析", () => {
  it("调用方和环境变量都没有 key 时返回 401，并提示去 AI 设置配置", async () => {
    delete process.env.SENSENOVA_API_KEY_1;
    delete process.env.SENSENOVA_API_KEY;
    const calls = installFetchMock([{ status: 200, body: { ok: true } }]);

    const res = await POST(makeRequest(chatBody({ apiKey: "" })));

    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: { message: string } };
    expect(data.error.message).toContain("未提供 API Key");
    // 没钥匙就不该把请求打到上游
    expect(calls).toHaveLength(0);
  });

  it("调用方 key 可用时只发一次请求，不带回退标记", async () => {
    const calls = installFetchMock([{ status: 200, body: { id: "ok" } }]);

    const res = await POST(makeRequest(chatBody({ apiKey: CALLER_KEY })));

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].auth).toBe(`Bearer ${CALLER_KEY}`);
    expect(res.headers.get("x-mimi-key-fallback")).toBeNull();
  });

  it("调用方不带 key 时直接用环境变量密钥，只发一次", async () => {
    const calls = installFetchMock([{ status: 200, body: { id: "ok" } }]);

    const res = await POST(makeRequest(chatBody({ apiKey: "" })));

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].auth).toBe(`Bearer ${ENV_KEY}`);
    expect(res.headers.get("x-mimi-key-fallback")).toBeNull();
  });
});

describe("POST /api/ai/chat 密钥回退", () => {
  it("调用方 key 被上游拒时改用环境变量密钥重试并成功", async () => {
    const calls = installFetchMock([
      { status: 401, body: { error: { message: "Forbidden", code: 16 } } },
      { status: 200, body: { id: "recovered" } },
    ]);

    const res = await POST(makeRequest(chatBody({ apiKey: CALLER_KEY })));

    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string };
    expect(data.id).toBe("recovered");

    expect(calls).toHaveLength(2);
    expect(calls[0].auth).toBe(`Bearer ${CALLER_KEY}`);
    expect(calls[1].auth).toBe(`Bearer ${ENV_KEY}`);
    expect(calls.every((c) => c.url === SENSENOVA_BASE + "/chat/completions")).toBe(true);
    // 标记靠服务端密钥救回来的，便于发现「用户的 key 其实已失效」
    expect(res.headers.get("x-mimi-key-fallback")).toBe("1");
  });

  it("回退也失败时返回调用方那次的原始错误，不被回退的报错盖掉", async () => {
    const calls = installFetchMock([
      { status: 401, body: { error: { message: "CALLER_REJECTED" } } },
      { status: 401, body: { error: { message: "ENV_REJECTED" } } },
    ]);

    const res = await POST(makeRequest(chatBody({ apiKey: CALLER_KEY })));

    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: { message: string } };
    expect(data.error.message).toBe("CALLER_REJECTED");
    expect(calls).toHaveLength(2);
    expect(res.headers.get("x-mimi-key-fallback")).toBeNull();
  });

  it("回退请求本身抛错时仍返回调用方的错误，不变成 500", async () => {
    let index = 0;
    const calls: RecordedCall[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(_input),
          auth: new Headers(init?.headers).get("authorization") || "",
        });
        index += 1;
        if (index === 1) {
          return {
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            headers: new Headers(),
            text: async () => JSON.stringify({ error: { message: "CALLER_REJECTED" } }),
          } as unknown as Response;
        }
        throw new TypeError("fetch failed");
      })
    );

    const res = await POST(makeRequest(chatBody({ apiKey: CALLER_KEY })));

    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: { message: string } };
    expect(data.error.message).toBe("CALLER_REJECTED");
    expect(calls).toHaveLength(2);
  });

  it("没有环境变量密钥时不重试", async () => {
    delete process.env.SENSENOVA_API_KEY_1;
    delete process.env.SENSENOVA_API_KEY;
    const calls = installFetchMock([
      { status: 401, body: { error: { message: "CALLER_REJECTED" } } },
      { status: 200, body: { id: "should-not-happen" } },
    ]);

    const res = await POST(makeRequest(chatBody({ apiKey: CALLER_KEY })));

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(1);
  });

  it("调用方 key 与环境变量相同且被拒时不原地重试", async () => {
    const calls = installFetchMock([
      { status: 401, body: { error: { message: "CALLER_REJECTED" } } },
      { status: 200, body: { id: "should-not-happen" } },
    ]);

    const res = await POST(makeRequest(chatBody({ apiKey: ENV_KEY })));

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(1);
  });

  it("非认证类失败（500）不换钥匙重试", async () => {
    const calls = installFetchMock([
      { status: 500, body: { error: { message: "boom" } } },
      { status: 200, body: { id: "should-not-happen" } },
    ]);

    const res = await POST(makeRequest(chatBody({ apiKey: CALLER_KEY })));

    expect(res.status).toBe(500);
    expect(calls).toHaveLength(1);
    expect(calls[0].auth).toBe(`Bearer ${CALLER_KEY}`);
  });

  it("目标不是 SenseNova 时不把环境变量密钥发过去", async () => {
    const calls = installFetchMock([
      { status: 401, body: { error: { message: "CALLER_REJECTED" } } },
      { status: 200, body: { id: "should-not-happen" } },
    ]);

    const res = await POST(
      makeRequest(chatBody({ apiKey: CALLER_KEY, baseUrl: "https://third-party.example.com/v1" }))
    );

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(1);
    // 只有调用方自己的 key 出网，环境变量密钥没被转发到第三方主机
    expect(calls[0].auth).toBe(`Bearer ${CALLER_KEY}`);
    expect(calls[0].url).toContain("third-party.example.com");
  });
});
