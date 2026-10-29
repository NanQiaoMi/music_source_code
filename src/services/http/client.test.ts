import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyFetchError,
  composeSignals,
  fetchJson,
  fetchText,
  fetchWithPolicy,
  getHostCircuitStates,
  getHttpMetrics,
  resetHttpState,
} from "./client";
import { HostCircuitBreaker, breakerKey } from "./circuitBreaker";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as Response;
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

/** 尊重 signal 的 fetch 桩：abort 时以 AbortError 拒绝。 */
function installFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>
): ReturnType<typeof vi.fn> {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const run = handler(String(input), init);
    const signal = init?.signal;
    if (!signal) return run;
    return new Promise<Response>((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      signal.addEventListener("abort", () => reject(abortError()), { once: true });
      run.then(resolve, reject);
    });
  });
  vi.stubGlobal("fetch", mock);
  return mock as unknown as ReturnType<typeof vi.fn>;
}

const never = () => new Promise<Response>(() => {});

beforeEach(() => {
  resetHttpState();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchJson", () => {
  it("returns parsed data on 200 and counts metrics", async () => {
    installFetch(async () => jsonResponse({ songs: [{ id: "1" }] }));

    const res = await fetchJson<{ songs: { id: string }[] }>("http://api.test/api/search?q=1");

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data?.songs[0].id).toBe("1");
    expect(getHttpMetrics().succeeded).toBe(1);
  });

  it("keeps data null on non-2xx without reading the body", async () => {
    const bodyReader = vi.fn(async () => ({}));
    installFetch(async () => ({ ok: false, status: 503, json: bodyReader }) as unknown as Response);

    const res = await fetchJson("http://api.test/api/qq/search");

    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
    expect(res.data).toBeNull();
    expect(bodyReader).not.toHaveBeenCalled();
  });

  it("treats invalid json as a parse error", async () => {
    installFetch(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("Unexpected token");
          },
        }) as unknown as Response
    );

    const res = await fetchJson("http://api.test/api/search");

    expect(res.ok).toBe(false);
    expect(res.error).toBe("parse");
    expect(getHttpMetrics().parseErrors).toBe(1);
  });

  it("times out after timeoutMs even when fetch ignores the signal", async () => {
    installFetch(never);

    const res = await fetchJson("http://api.test/api/search", { timeoutMs: 20 });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("timeout");
    expect(getHttpMetrics().timeouts).toBe(1);
  });

  it("is aborted by the external signal without counting a circuit failure", async () => {
    installFetch(async () => jsonResponse({}));
    const controller = new AbortController();
    controller.abort();

    const res = await fetchJson("http://api.test/api/search", { signal: controller.signal });

    expect(res.error).toBe("aborted");
    expect(getHttpMetrics().aborted).toBe(1);
    expect(getHttpMetrics().networkErrors).toBe(0);
    expect(getHostCircuitStates()).toHaveLength(0);
  });

  it("reads text bodies through fetchText", async () => {
    installFetch(async () => textResponse("  http://cdn.test/a.mp3  "));

    const res = await fetchText("http://antiserver.kuwo.cn/anti.s?rid=1");

    expect(res.data?.trim()).toBe("http://cdn.test/a.mp3");
  });
});

describe("fetchWithPolicy retries", () => {
  it("retries an idempotent GET on 5xx with backoff, then succeeds", async () => {
    let calls = 0;
    installFetch(async () => {
      calls += 1;
      return calls === 1 ? jsonResponse({}, 503) : jsonResponse({ ok: true });
    });

    const res = await fetchJson("http://api.test/api/search", { retries: 1, retryDelayMs: 5 });

    expect(calls).toBe(2);
    expect(res.ok).toBe(true);
    expect(getHttpMetrics().retries).toBe(1);
  });

  it("does not retry POST", async () => {
    let calls = 0;
    installFetch(async () => {
      calls += 1;
      return jsonResponse({}, 500);
    });

    const res = await fetchWithPolicy("http://api.test/api/write", { method: "POST", retries: 3 });

    expect(calls).toBe(1);
    expect(res.ok).toBe(false);
  });

  it("does not retry when the request was aborted", async () => {
    let calls = 0;
    installFetch(async () => {
      calls += 1;
      return never();
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);

    const res = await fetchWithPolicy("http://api.test/api/search", {
      retries: 3,
      retryDelayMs: 1,
      timeoutMs: 1000,
      signal: controller.signal,
    });

    expect(res.error).toBe("aborted");
    expect(calls).toBe(1);
    expect(getHttpMetrics().retries).toBe(0);
  });
});

describe("circuit breaker on the request path", () => {
  it("opens after the failure threshold and skips the next request in 0ms", async () => {
    const mock = installFetch(async () => {
      throw new Error("ECONNRESET");
    });

    const first = await fetchJson("http://api.test/api/qq/search");
    const second = await fetchJson("http://api.test/api/qq/search");
    const startedAt = Date.now();
    const third = await fetchJson("http://api.test/api/qq/search");
    const elapsed = Date.now() - startedAt;

    expect(first.error).toBe("network");
    expect(second.error).toBe("network");
    expect(third.error).toBe("circuit-open");
    expect(third.status).toBe(0);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(elapsed).toBeLessThan(50);
    expect(getHttpMetrics().circuitOpenSkips).toBe(1);
    expect(getHostCircuitStates()[0].state).toBe("open");
  });

  it("half-open admits a single probe and closes on success", async () => {
    let healthy = false;
    installFetch(async () => {
      if (!healthy) throw new Error("ECONNRESET");
      return jsonResponse({ ok: true });
    });
    const nowSpy = vi.spyOn(Date, "now");
    let now = 1_000_000;
    nowSpy.mockImplementation(() => now);

    await fetchJson("http://api.test/api/search");
    await fetchJson("http://api.test/api/search");
    expect(getHostCircuitStates()[0].state).toBe("open");

    now += 30_000; // open 冷却结束 -> half-open
    expect(getHostCircuitStates()[0].state).toBe("half-open");

    healthy = true;
    const probe = await fetchJson("http://api.test/api/search");

    expect(probe.ok).toBe(true);
    expect(getHostCircuitStates()).toHaveLength(0);
    nowSpy.mockRestore();
  });

  it("buckets the breaker by host + first two path segments", () => {
    expect(breakerKey("http://localhost:3000/api/qq/search?q=1")).toBe(
      "http://localhost:3000/api/qq"
    );
    expect(breakerKey("http://localhost:3000/api/song/url")).toBe("http://localhost:3000/api/song");
    expect(breakerKey("http://antiserver.kuwo.cn/anti.s?rid=1")).toBe(
      "http://antiserver.kuwo.cn/anti.s"
    );
  });

  it("blocks the second concurrent probe while one is in flight", () => {
    const clock = { now: 0 };
    const breaker = new HostCircuitBreaker({ now: () => clock.now, openMs: 100 });
    const key = breakerKey("http://api.test/api/qq/search");

    breaker.recordFailure(key, "network");
    breaker.recordFailure(key, "network");
    expect(breaker.admit(key)).toBe("blocked");

    clock.now += 100;
    expect(breaker.admit(key)).toBe("probe");
    expect(breaker.admit(key)).toBe("blocked");

    breaker.recordSuccess(key);
    expect(breaker.getState(key)).toBe("closed");
    expect(breaker.admit(key)).toBe("allow");
  });
});

describe("request dedupe", () => {
  it("merges concurrent identical GETs into one network call", async () => {
    let release: (value: Response) => void = () => {};
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const mock = installFetch(() => gate);

    const a = fetchJson("http://api.test/api/search?q=1", { dedupe: true });
    const b = fetchJson("http://api.test/api/search?q=1", { dedupe: true });
    release(jsonResponse({ ok: true }));
    const [first, second] = await Promise.all([a, b]);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(getHttpMetrics().dedupeHits).toBe(1);
  });

  it("does not dedupe without the flag", async () => {
    const mock = installFetch(async () => jsonResponse({ ok: true }));

    await Promise.all([
      fetchJson("http://api.test/api/search?q=2"),
      fetchJson("http://api.test/api/search?q=2"),
    ]);

    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe("signal composition", () => {
  it("composes the external signal with the timeout", () => {
    const controller = new AbortController();
    const composed = composeSignals(1000, controller.signal);

    expect(composed.signal.aborted).toBe(false);
    controller.abort();
    expect(composed.signal.aborted).toBe(true);
    composed.dispose();
  });

  it("dispose removes the listener so later aborts are ignored", () => {
    const controller = new AbortController();
    const composed = composeSignals(1000, controller.signal);
    composed.dispose();

    controller.abort();

    expect(composed.signal.aborted).toBe(false);
  });

  it("classifies timeout, abort and network errors apart", () => {
    expect(classifyFetchError(new Error("boom"))).toBe("network");
    const timeout = new AbortController();
    timeout.abort(new DOMException("late", "TimeoutError"));
    expect(classifyFetchError(new Error("boom"), timeout.signal)).toBe("timeout");
    const aborted = new AbortController();
    aborted.abort();
    expect(classifyFetchError(abortError(), aborted.signal)).toBe("aborted");
  });
});
