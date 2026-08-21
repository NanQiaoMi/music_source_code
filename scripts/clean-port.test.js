const net = require("net");

const {
  canListenOnPort,
  getWindowsNetstatCandidates,
  getWindowsTaskkillCandidates,
  parseWindowsNetstatForPort,
  isPortOwnedByLine,
  formatPortAddressPattern,
} = require("./clean-port");

describe("clean-port netstat parsing", () => {
  it("prefers Windows system netstat.exe paths before falling back to PATH lookup", () => {
    expect(getWindowsNetstatCandidates({ windir: "C:\\Windows" })).toEqual([
      "C:\\Windows\\Sysnative\\netstat.exe",
      "C:\\Windows\\System32\\netstat.exe",
      "netstat",
    ]);
  });

  it("prefers Windows system taskkill.exe paths before falling back to PATH lookup", () => {
    expect(getWindowsTaskkillCandidates({ windir: "C:\\Windows" })).toEqual([
      "C:\\Windows\\Sysnative\\taskkill.exe",
      "C:\\Windows\\System32\\taskkill.exe",
      "taskkill",
    ]);
  });

  it("treats wildcard IPv6 listeners as occupying the port", async () => {
    const blocker = net.createServer();
    await new Promise((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "::", () => resolve());
    });

    try {
      const address = blocker.address();
      expect(await canListenOnPort(address.port)).toBe(false);
    } finally {
      await new Promise((resolve) => blocker.close(resolve));
    }
  });

  it("matches exact Windows local addresses for the requested port", () => {
    expect(isPortOwnedByLine("  TCP    0.0.0.0:3025    0.0.0.0:0    LISTENING    111", 3025)).toBe(
      true
    );
    expect(isPortOwnedByLine("  TCP    [::]:3025       [::]:0       LISTENING    222", 3025)).toBe(
      true
    );
    expect(isPortOwnedByLine("  TCP    127.0.0.1:3025  0.0.0.0:0    LISTENING    333", 3025)).toBe(
      true
    );
  });

  it("does not confuse neighboring ports or remote addresses with the target port", () => {
    expect(isPortOwnedByLine("  TCP    0.0.0.0:13025   0.0.0.0:0    LISTENING    111", 3025)).toBe(
      false
    );
    expect(isPortOwnedByLine("  TCP    127.0.0.1:30250 0.0.0.0:0    LISTENING    222", 3025)).toBe(
      false
    );
    expect(isPortOwnedByLine("  TCP    127.0.0.1:60000 127.0.0.1:3025 ESTABLISHED 333", 3025)).toBe(
      false
    );
  });

  it("returns unique listening PIDs and skips the current process", () => {
    const currentPid = process.pid;
    const sample = [
      "  Proto  Local Address          Foreign Address        State           PID",
      "  TCP    0.0.0.0:3025           0.0.0.0:0              LISTENING       100",
      "  TCP    [::]:3025              [::]:0                 LISTENING       100",
      `  TCP    127.0.0.1:3025       0.0.0.0:0              LISTENING       ${currentPid}`,
      "  TCP    127.0.0.1:30250        0.0.0.0:0              LISTENING       200",
      "  TCP    127.0.0.1:60000        127.0.0.1:3025         ESTABLISHED     300",
    ].join("\n");

    expect(parseWindowsNetstatForPort(sample, 3025, currentPid)).toEqual([100]);
  });

  it("formats the exact address pattern used for diagnostics", () => {
    expect(formatPortAddressPattern(3025)).toBe(":3025");
  });
});
