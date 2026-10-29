/**
 * HostCircuitBreaker (S7-1a)
 *
 * 请求路径上的主机级熔断器：closed -> open -> half-open 三态。
 * - closed：正常放行；连续失败达到阈值后进入 open。
 * - open：冷却期内 0ms 直接返回（不发起 TCP 握手）；冷却结束后进入 half-open。
 * - half-open：只放行 **一个** 探测请求；成功 -> closed，失败 -> 重新 open。
 *
 * 与旧的 EndpointCircuitBreaker（阶梯式 cooling，仅调试 UI 使用）并存：
 * 那个没有三态、不可注入时钟，语义也不同，改它会连带改 44 行既有测试与
 * AppleAudioSourceInspector 的行为。统一留待 S7-1c。
 *
 * 纯模块：无 store / 无 React / 无全局定时器，时钟可注入，便于单测。
 */

export type CircuitState = "closed" | "open" | "half-open";

/** 放行结果：allow=正常请求；probe=half-open 的唯一种子请求；blocked=熔断跳过。 */
export type CircuitAdmission = "allow" | "probe" | "blocked";

export interface CircuitBreakerOptions {
  /** 连续失败多少次触发熔断，默认 2。 */
  failureThreshold?: number;
  /** open 状态冷却时长，默认 30s。 */
  openMs?: number;
  /** 可注入时钟，默认 Date.now。 */
  now?: () => number;
}

export interface HostCircuitSnapshot {
  key: string;
  state: CircuitState;
  failures: number;
  openUntil: number;
  probeInFlight: boolean;
  lastErrorReason: string;
}

interface HostState {
  failures: number;
  openUntil: number;
  probeInFlight: boolean;
  lastErrorReason: string;
}

const DEFAULT_FAILURE_THRESHOLD = 2;
const DEFAULT_OPEN_MS = 30_000;

/**
 * 熔断键：协议 + host + 前两段 path（如 http://localhost:3000/api/qq）。
 * 只按 host 分桶会让一个平台的失败误伤同 host 的其它平台（S7 计划 §5.1 风险项）。
 */
export function breakerKey(urlOrKey: string): string {
  if (!urlOrKey) return "";
  try {
    const parsed = new URL(urlOrKey, "http://localhost");
    const segments = parsed.pathname.split("/").filter(Boolean).slice(0, 2);
    return parsed.protocol + "//" + parsed.host + "/" + segments.join("/");
  } catch {
    return urlOrKey;
  }
}

export class HostCircuitBreaker {
  private readonly failureThreshold: number;
  private readonly openMs: number;
  private readonly now: () => number;
  private readonly hostStates = new Map<string, HostState>();

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = Math.max(1, options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD);
    this.openMs = Math.max(0, options.openMs ?? DEFAULT_OPEN_MS);
    this.now = options.now ?? (() => Date.now());
  }

  getState(key: string): CircuitState {
    const state = this.hostStates.get(key);
    if (!state) return "closed";
    if (state.failures < this.failureThreshold) return "closed";
    return this.now() < state.openUntil ? "open" : "half-open";
  }

  /** 进入请求前的准入判断；probe 同时占用 half-open 的唯一探测名额（须 settle）。 */
  admit(key: string): CircuitAdmission {
    const state = this.hostStates.get(key);
    if (!state) return "allow";
    const current = this.getState(key);
    if (current === "closed") return "allow";
    if (current === "open") return "blocked";
    if (state.probeInFlight) return "blocked";
    state.probeInFlight = true;
    return "probe";
  }

  recordSuccess(key: string): void {
    this.hostStates.delete(key);
  }

  recordFailure(key: string, reason = "unknown"): void {
    const existing = this.hostStates.get(key);
    const state: HostState = existing ?? {
      failures: 0,
      openUntil: 0,
      probeInFlight: false,
      lastErrorReason: "",
    };
    state.failures += 1;
    state.lastErrorReason = reason;
    state.probeInFlight = false;
    if (state.failures >= this.failureThreshold) {
      state.openUntil = this.now() + this.openMs;
    }
    this.hostStates.set(key, state);
  }

  /** 探测请求既未成功也未失败（如被取消）：归还探测名额，状态不变。 */
  releaseProbe(key: string): void {
    const state = this.hostStates.get(key);
    if (state) state.probeInFlight = false;
  }

  snapshot(): HostCircuitSnapshot[] {
    return [...this.hostStates.entries()].map(([key, state]) => ({
      key,
      state: this.getState(key),
      failures: state.failures,
      openUntil: state.openUntil,
      probeInFlight: state.probeInFlight,
      lastErrorReason: state.lastErrorReason,
    }));
  }

  reset(): void {
    this.hostStates.clear();
  }
}
