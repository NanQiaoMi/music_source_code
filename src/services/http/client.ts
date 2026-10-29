/**
 * 统一 HTTP 客户端 (S7-1a)
 *
 * resolver / 平台插件的外部请求统一走这里，替换裸 fetch：
 * - 超时：AbortSignal + 自建 deadline（不依赖 fetch 是否理会 signal）；
 * - 取消：外部 AbortSignal 组合（composeSignals），结算后 removeEventListener；
 * - 重试：仅幂等 GET，且仅 5xx / 网络错误 / 超时；4xx、取消不重试（默认 retries=0，行为不变）；
 * - 熔断：按 breakerKey（协议+host+前两段 path）分桶的 closed/open/half-open；
 * - 指标：requests/succeeded/failed/timeouts/aborted/retries/circuitOpenSkips/dedupeHits；
 * - 去重：可选（dedupe），只对同一 key 的 in-flight 请求合并，共享已解析结果。
 *
 * 纯服务层：不 import store / React / Next，便于单测与后续 S7-5 迁移。
 */
import { HostCircuitBreaker, breakerKey, type HostCircuitSnapshot } from "./circuitBreaker";

export type HttpErrorKind = "timeout" | "aborted" | "network" | "http" | "parse" | "circuit-open";

export interface HttpRequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  /** 单次请求超时，默认 3000ms。 */
  timeoutMs?: number;
  /** 外部取消信号（换歌/新请求）。 */
  signal?: AbortSignal;
  /** 仅 GET 生效；默认 0（保持既有行为：不额外发包）。 */
  retries?: number;
  /** 退避基数，默认 200ms，按 2^n 增长并封顶 2s。 */
  retryDelayMs?: number;
  /** 可选请求去重：true=按 URL，string=自定义 key。 */
  dedupe?: boolean | string;
}

export interface HttpRawResult {
  ok: boolean;
  status: number;
  response: Response | null;
  error?: HttpErrorKind;
}

export interface HttpResult<T> extends HttpRawResult {
  data: T | null;
}

export interface HttpMetricsSnapshot {
  requests: number;
  succeeded: number;
  failed: number;
  timeouts: number;
  aborted: number;
  retries: number;
  circuitOpenSkips: number;
  dedupeHits: number;
  networkErrors: number;
  httpErrors: number;
  parseErrors: number;
}

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_RETRY_DELAY_MS = 200;
const MAX_RETRY_DELAY_MS = 2000;

/** 请求路径上的熔断器单例（可注入时钟，测试里用 resetHttpState 复位）。 */
export const httpCircuitBreaker = new HostCircuitBreaker();

const metrics: HttpMetricsSnapshot = {
  requests: 0,
  succeeded: 0,
  failed: 0,
  timeouts: 0,
  aborted: 0,
  retries: 0,
  circuitOpenSkips: 0,
  dedupeHits: 0,
  networkErrors: 0,
  httpErrors: 0,
  parseErrors: 0,
};

const inFlight = new Map<string, Promise<unknown>>();

function reasonName(signal: AbortSignal): string {
  const reason = signal.reason as { name?: unknown } | undefined;
  return typeof reason === "object" && reason !== null ? String(reason.name ?? "") : "";
}

function abortReasonOf(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

/** 组合外部 signal 与超时；必须在结算后 dispose（移除监听 + 清定时器，I4）。 */
export function composeSignals(
  timeoutMs: number,
  external?: AbortSignal
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => {
      timer = null;
      controller.abort(new DOMException("The operation timed out", "TimeoutError"));
    },
    Math.max(0, timeoutMs)
  );

  const onExternalAbort = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    controller.abort(external?.reason);
  };

  if (external) {
    if (external.aborted) {
      onExternalAbort();
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true });
      controller.signal.addEventListener(
        "abort",
        () => external.removeEventListener("abort", onExternalAbort),
        { once: true }
      );
    }
  }

  return {
    signal: controller.signal,
    dispose: () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

/** 错误归类：取消与超时不能混为一谈（取消不写日志、不熔断）。 */
export function classifyFetchError(error: unknown, signal?: AbortSignal): HttpErrorKind {
  if (signal?.aborted) return reasonName(signal) === "TimeoutError" ? "timeout" : "aborted";
  const name =
    typeof error === "object" && error !== null
      ? String((error as { name?: unknown }).name ?? "")
      : "";
  if (name === "TimeoutError") return "timeout";
  if (name === "AbortError") return "aborted";
  return "network";
}

function isTripStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

function retryDelayMs(attempt: number, base: number): number {
  return Math.min(MAX_RETRY_DELAY_MS, base * 2 ** Math.max(0, attempt - 1));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReasonOf(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(
        signal ? abortReasonOf(signal) : new DOMException("The operation was aborted", "AbortError")
      );
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** 即使 fetch 实现不理会 signal，也能按 deadline 结算（测试 mock 依赖此行为）。 */
function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortReasonOf(signal));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReasonOf(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

function resolveFetch(): typeof fetch | null {
  const candidate = (globalThis as { fetch?: typeof fetch }).fetch;
  return typeof candidate === "function" ? candidate : null;
}

function settleResponse(key: string, response: Response): HttpRawResult {
  if (response.ok) {
    metrics.succeeded += 1;
    httpCircuitBreaker.recordSuccess(key);
    return { ok: true, status: response.status, response };
  }
  metrics.failed += 1;
  metrics.httpErrors += 1;
  if (isTripStatus(response.status)) {
    httpCircuitBreaker.recordFailure(key, "http-" + response.status);
  } else {
    // 4xx：主机可达（会话/权限问题），不计熔断失败，也不保留旧的失败计数。
    httpCircuitBreaker.recordSuccess(key);
  }
  return { ok: false, status: response.status, response, error: "http" };
}

/** 统一请求入口：超时 + 熔断 + 取消 + 有限重试；永不抛出。 */
export async function fetchWithPolicy(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpRawResult> {
  const fetchImpl = resolveFetch();
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = method === "GET" ? Math.max(0, options.retries ?? 0) : 0;
  const baseDelay = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const key = breakerKey(url);

  if (!fetchImpl) {
    metrics.requests += 1;
    metrics.failed += 1;
    metrics.networkErrors += 1;
    return { ok: false, status: 0, response: null, error: "network" };
  }

  let attempt = 0;
  for (;;) {
    if (options.signal?.aborted) {
      metrics.aborted += 1;
      return { ok: false, status: 0, response: null, error: "aborted" };
    }

    const admission = httpCircuitBreaker.admit(key);
    if (admission === "blocked") {
      metrics.circuitOpenSkips += 1;
      return { ok: false, status: 0, response: null, error: "circuit-open" };
    }

    metrics.requests += 1;
    const deadline = composeSignals(timeoutMs, options.signal);
    let outcome: HttpRawResult;
    try {
      const response = await raceWithSignal(
        Promise.resolve().then(() =>
          fetchImpl(url, {
            method,
            headers: options.headers,
            body: options.body,
            signal: deadline.signal,
          })
        ),
        deadline.signal
      );
      outcome = settleResponse(key, response);
    } catch (error) {
      const kind: HttpErrorKind = options.signal?.aborted
        ? "aborted"
        : classifyFetchError(error, deadline.signal);
      if (kind === "aborted") {
        metrics.aborted += 1;
        if (admission === "probe") httpCircuitBreaker.releaseProbe(key);
        outcome = { ok: false, status: 0, response: null, error: "aborted" };
      } else {
        if (kind === "timeout") metrics.timeouts += 1;
        else metrics.networkErrors += 1;
        metrics.failed += 1;
        httpCircuitBreaker.recordFailure(key, kind);
        outcome = { ok: false, status: 0, response: null, error: kind };
      }
    } finally {
      deadline.dispose();
    }

    const retryable =
      outcome.error === "timeout" ||
      outcome.error === "network" ||
      (outcome.error === "http" && isTripStatus(outcome.status));
    if (retryable && attempt < maxRetries) {
      attempt += 1;
      metrics.retries += 1;
      try {
        await sleep(retryDelayMs(attempt, baseDelay), options.signal);
      } catch {
        metrics.aborted += 1;
        return { ok: false, status: 0, response: null, error: "aborted" };
      }
      continue;
    }
    return outcome;
  }
}

function dedupeKeyOf(
  kind: string,
  url: string,
  dedupe: boolean | string | undefined
): string | null {
  if (!dedupe) return null;
  return kind + ":" + (typeof dedupe === "string" ? dedupe : url);
}

function dedupe<T>(key: string | null, run: () => Promise<T>): Promise<T> {
  if (!key) return run();
  const existing = inFlight.get(key);
  if (existing) {
    metrics.dedupeHits += 1;
    return existing as Promise<T>;
  }
  const tracked = run().finally(() => {
    if (inFlight.get(key) === tracked) inFlight.delete(key);
  });
  inFlight.set(key, tracked as Promise<unknown>);
  return tracked;
}

async function readJson<T>(response: Response): Promise<T | null> {
  if (typeof response.json === "function") return (await response.json()) as T;
  if (typeof response.text === "function") {
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : null;
  }
  return null;
}

async function readText(response: Response): Promise<string> {
  if (typeof response.text === "function") return response.text();
  if (typeof response.json === "function") return JSON.stringify(await response.json());
  return "";
}

/** GET/POST 后解析 JSON；非 2xx 时 data 恒为 null（与迁移前 if(!res.ok) 语义一致）。 */
export async function fetchJson<T = unknown>(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResult<T>> {
  const run = async (): Promise<HttpResult<T>> => {
    const raw = await fetchWithPolicy(url, options);
    if (!raw.ok || !raw.response) return { ...raw, data: null };
    try {
      const data = await readJson<T>(raw.response);
      return { ...raw, data: data ?? null };
    } catch {
      metrics.parseErrors += 1;
      return { ok: false, status: raw.status, response: raw.response, error: "parse", data: null };
    }
  };
  return dedupe(dedupeKeyOf("json", url, options.dedupe), run);
}

/** 文本响应（如酷我 anti.s 直链）。 */
export async function fetchText(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResult<string>> {
  const run = async (): Promise<HttpResult<string>> => {
    const raw = await fetchWithPolicy(url, options);
    if (!raw.ok || !raw.response) return { ...raw, data: null };
    try {
      return { ...raw, data: await readText(raw.response) };
    } catch {
      metrics.parseErrors += 1;
      return { ok: false, status: raw.status, response: raw.response, error: "parse", data: null };
    }
  };
  return dedupe(dedupeKeyOf("text", url, options.dedupe), run);
}

export function getHttpMetrics(): HttpMetricsSnapshot {
  return { ...metrics };
}

export function getHostCircuitStates(): HostCircuitSnapshot[] {
  return httpCircuitBreaker.snapshot();
}

/** 测试/调试用：清零指标、清空 in-flight 与熔断状态。 */
export function resetHttpState(): void {
  metrics.requests = 0;
  metrics.succeeded = 0;
  metrics.failed = 0;
  metrics.timeouts = 0;
  metrics.aborted = 0;
  metrics.retries = 0;
  metrics.circuitOpenSkips = 0;
  metrics.dedupeHits = 0;
  metrics.networkErrors = 0;
  metrics.httpErrors = 0;
  metrics.parseErrors = 0;
  inFlight.clear();
  httpCircuitBreaker.reset();
}
