import { describe, it, expect, beforeEach } from "vitest";
import { endpointCircuitBreaker } from "./EndpointCircuitBreaker";

describe("EndpointCircuitBreaker", () => {
  beforeEach(() => {
    endpointCircuitBreaker.resetAll();
  });

  it("should extract host correctly from URLs", () => {
    expect(endpointCircuitBreaker.extractHost("https://api.huibq.com/api/v1")).toBe("api.huibq.com");
    expect(endpointCircuitBreaker.extractHost("http://175.27.166.236:8080/wy")).toBe("175.27.166.236:8080");
    expect(endpointCircuitBreaker.extractHost("music.163.com")).toBe("music.163.com");
  });

  it("should cool down host for 1 minute on first failure", () => {
    const url = "https://api.huibq.com/api/url";
    expect(endpointCircuitBreaker.isHostCooling(url)).toBe(false);

    endpointCircuitBreaker.recordFailure(url, "ECONNRESET");
    expect(endpointCircuitBreaker.isHostCooling(url)).toBe(true);

    const coolingList = endpointCircuitBreaker.getCoolingHosts();
    expect(coolingList.length).toBe(1);
    expect(coolingList[0].host).toBe("api.huibq.com");
    expect(coolingList[0].failureCount).toBe(1);
    expect(coolingList[0].remainingSeconds).toBeGreaterThan(50);
  });

  it("should escalate to 5 minutes on second failure", () => {
    const url = "https://api.lingchuan.com/v1/url";
    endpointCircuitBreaker.recordFailure(url, "502 Bad Gateway");
    endpointCircuitBreaker.recordFailure(url, "502 Bad Gateway");

    const coolingList = endpointCircuitBreaker.getCoolingHosts();
    expect(coolingList.find((c) => c.host === "api.lingchuan.com")?.failureCount).toBe(2);
    expect(coolingList.find((c) => c.host === "api.lingchuan.com")?.remainingSeconds).toBeGreaterThan(250);
  });

  it("should clear cooling on success", () => {
    const url = "https://good-host.com/stream.mp3";
    endpointCircuitBreaker.recordFailure(url, "Temporary Glitch");
    expect(endpointCircuitBreaker.isHostCooling(url)).toBe(true);

    endpointCircuitBreaker.recordSuccess(url);
    expect(endpointCircuitBreaker.isHostCooling(url)).toBe(false);
  });
});
