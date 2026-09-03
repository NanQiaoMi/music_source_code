/**
 * Multi-Source Endpoint Circuit Breaker
 * 
 * 阶梯式熔断冷却机制：
 * - 首次失败 (502 / ECONNRESET / Timeout / 404)：冷却 1 分钟
 * - 连续失败 ≥ 2 次：冷却 5 分钟
 * - 冷却期内请求：0ms 快速跳过，绝不发起耗时的无效 TCP 握手，保障连接池健康
 */

export interface CoolingHostInfo {
  host: string;
  remainingSeconds: number;
  failureCount: number;
  lastErrorReason: string;
}

interface HostState {
  failureCount: number;
  coolingUntil: number;
  lastErrorReason: string;
}

class EndpointCircuitBreakerService {
  private static instance: EndpointCircuitBreakerService;
  private hostStates: Map<string, HostState> = new Map();

  public static getInstance(): EndpointCircuitBreakerService {
    if (!EndpointCircuitBreakerService.instance) {
      EndpointCircuitBreakerService.instance = new EndpointCircuitBreakerService();
    }
    return EndpointCircuitBreakerService.instance;
  }

  public extractHost(urlOrHost: string): string {
    if (!urlOrHost) return "";
    try {
      if (urlOrHost.startsWith("http://") || urlOrHost.startsWith("https://")) {
        const parsed = new URL(urlOrHost);
        return parsed.host.toLowerCase();
      }
      return urlOrHost.split("/")[0].toLowerCase();
    } catch {
      return urlOrHost.toLowerCase();
    }
  }

  public recordFailure(urlOrHost: string, reason: string = "unknown"): void {
    const host = this.extractHost(urlOrHost);
    if (!host) return;

    const state = this.hostStates.get(host) || {
      failureCount: 0,
      coolingUntil: 0,
      lastErrorReason: "",
    };

    state.failureCount += 1;
    state.lastErrorReason = reason;

    // 阶梯式冷却：首次 1 分钟 (60s)，连续失败 5 分钟 (300s)
    const coolDurationMs = state.failureCount >= 2 ? 5 * 60 * 1000 : 1 * 60 * 1000;
    state.coolingUntil = Date.now() + coolDurationMs;

    this.hostStates.set(host, state);
    console.warn(
      `[CircuitBreaker] ⚠️ 节点 [${host}] 触发熔断冷却 ${coolDurationMs / 1000}s (失败次数: ${state.failureCount}, 原因: ${reason})`
    );
  }

  public isHostCooling(urlOrHost: string): boolean {
    const host = this.extractHost(urlOrHost);
    if (!host) return false;

    const state = this.hostStates.get(host);
    if (!state) return false;

    if (Date.now() < state.coolingUntil) {
      return true;
    }

    return false;
  }

  public recordSuccess(urlOrHost: string): void {
    const host = this.extractHost(urlOrHost);
    if (!host) return;

    if (this.hostStates.has(host)) {
      this.hostStates.delete(host);
    }
  }

  public getCoolingHosts(): CoolingHostInfo[] {
    const now = Date.now();
    const result: CoolingHostInfo[] = [];

    for (const [host, state] of this.hostStates.entries()) {
      if (now < state.coolingUntil) {
        result.push({
          host,
          remainingSeconds: Math.ceil((state.coolingUntil - now) / 1000),
          failureCount: state.failureCount,
          lastErrorReason: state.lastErrorReason,
        });
      }
    }

    return result;
  }

  public resetAll(): void {
    this.hostStates.clear();
  }
}

export const endpointCircuitBreaker = EndpointCircuitBreakerService.getInstance();
