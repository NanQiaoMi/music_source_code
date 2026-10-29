/**
 * /api/audio/proxy 出站目标校验（S7 平台边界加固，非 S7 任务验收）。
 *
 * 只允许 http/https、拒绝 URL 内嵌凭据、拒绝 localhost/.local/回环/私网/链路本地/元数据
 * 地址（IPv4 + IPv6 + DNS 解析结果），重定向逐跳复检，并给响应体 100MB 上限。
 * MIMI_PROXY_ALLOW_PRIVATE=1 可显式关闭私网拦截（默认关闭，测试/开发用）；
 * MIMI_PROXY_TIMEOUT_MS 可覆盖回源超时（默认 15s，供单测使用）。
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const MAX_PROXY_BYTES = 100 * 1024 * 1024; // 100MB
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".localdomain"];

export class ProxyTargetError extends Error {
  readonly reason: string;
  readonly status: number;

  constructor(reason: string, message: string, status: number) {
    super(message);
    this.name = "ProxyTargetError";
    this.reason = reason;
    this.status = status;
  }
}

export function proxyTimeoutMs(): number {
  const configured = Number(process.env.MIMI_PROXY_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    bytes.push(value);
  }
  return bytes;
}

function isBlockedIpv4(bytes: number[]): boolean {
  const [a, b, c] = bytes;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT，含 100.100.100.200 元数据地址
  if (a === 169 && b === 254) return true; // link-local，含 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF / TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  return a >= 224; // multicast / reserved / broadcast
}

function parseIpv6Groups(ip: string): number[] | null {
  let value = ip.trim().toLowerCase();
  const zoneIndex = value.indexOf("%");
  if (zoneIndex !== -1) value = value.slice(0, zoneIndex);
  const halves = value.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const groups: number[] = [];
    for (const group of part.split(":")) {
      if (group.includes(".")) {
        const ipv4 = parseIpv4(group);
        if (!ipv4) return null;
        groups.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
        groups.push(Number.parseInt(group, 16));
      }
    }
    return groups;
  };

  const head = parseGroups(halves[0]);
  if (!head) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const tail = parseGroups(halves[1]);
  if (!tail) return null;
  const zeros = 8 - head.length - tail.length;
  if (zeros < 1) return null;
  return [...head, ...new Array<number>(zeros).fill(0), ...tail];
}

function isBlockedIpv6(groups: number[]): boolean {
  // ::/96：未指定/回环/已废弃的 IPv4-compatible 形式
  if (groups.slice(0, 6).every((group) => group === 0)) return true;

  // ::ffff:0:0/96 IPv4-mapped，按内嵌 IPv4 判断
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const ipv4 = [
      (groups[6] >> 8) & 0xff,
      groups[6] & 0xff,
      (groups[7] >> 8) & 0xff,
      groups[7] & 0xff,
    ];
    return isBlockedIpv4(ipv4);
  }

  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // 2001:db8::/32 文档地址
  if (groups[0] === 0x0064 && groups[1] === 0xff9b) return true; // 64:ff9b::/96 NAT64

  if (groups[0] === 0x2002) {
    const ipv4 = [
      (groups[1] >> 8) & 0xff,
      groups[1] & 0xff,
      (groups[2] >> 8) & 0xff,
      groups[2] & 0xff,
    ];
    return isBlockedIpv4(ipv4); // 6to4 内嵌 IPv4
  }
  return false;
}

/** 判断 IP 是否属于回环/私网/链路本地/保留地址；无法解析的输入按危险处理。 */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const bytes = parseIpv4(ip);
    return bytes ? isBlockedIpv4(bytes) : true;
  }
  if (family === 6) {
    const groups = parseIpv6Groups(ip);
    return groups ? isBlockedIpv6(groups) : true;
  }
  return true;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
}

/** 解析并校验 scheme/凭据；不触发 DNS。 */
export function parseProxyTarget(raw: string | null, base?: URL): URL {
  if (!raw || raw.trim() === "") {
    throw new ProxyTargetError("invalid-url", "Missing audio target URL", 400);
  }
  let target: URL;
  try {
    target = base ? new URL(raw, base) : new URL(raw);
  } catch {
    throw new ProxyTargetError("invalid-url", `Invalid audio target URL: ${raw}`, 400);
  }
  if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
    throw new ProxyTargetError(
      "unsupported-scheme",
      `Unsupported protocol: ${target.protocol}`,
      400
    );
  }
  if (target.username || target.password) {
    throw new ProxyTargetError("credentials", "Audio target URL must not contain credentials", 400);
  }
  return target;
}

/** 同步校验主机名/IP 字面量（不触发 DNS），用于磁盘缓存命中前的快速拒绝。 */
export function assertProxyTargetStatic(target: URL): void {
  if (process.env.MIMI_PROXY_ALLOW_PRIVATE === "1") return;
  const hostname = normalizeHostname(target.hostname);
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new ProxyTargetError("blocked-host", `Blocked hostname: ${hostname}`, 403);
  }
  if (isIP(hostname) !== 0 && isBlockedIp(hostname)) {
    throw new ProxyTargetError("blocked-ip", `Blocked IP address: ${hostname}`, 403);
  }
}

/** 异步解析域名，要求所有 A/AAAA 记录均为公网地址；DNS 失败按拒绝处理。 */
export async function assertProxyTargetResolvable(target: URL): Promise<void> {
  if (process.env.MIMI_PROXY_ALLOW_PRIVATE === "1") return;
  const hostname = normalizeHostname(target.hostname);
  if (isIP(hostname) !== 0) return; // 字面量 IP 已由 assertProxyTargetStatic 校验

  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ProxyTargetError("dns-failure", `DNS lookup failed for ${hostname}: ${detail}`, 403);
  }
  if (records.length === 0) {
    throw new ProxyTargetError(
      "dns-failure",
      `DNS lookup returned no address for ${hostname}`,
      403
    );
  }
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new ProxyTargetError(
        "blocked-ip",
        `Hostname ${hostname} resolves to blocked address ${record.address}`,
        403
      );
    }
  }
}

/** 手动跟随重定向：每一跳都重新做 scheme/凭据/私网/DNS 校验，最多 3 跳。 */
export async function fetchProxyUpstream(target: URL, init: RequestInit): Promise<Response> {
  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (!REDIRECT_STATUSES.has(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    try {
      await response.body?.cancel();
    } catch {
      // 关闭重定向响应体失败不影响后续请求
    }
    current = parseProxyTarget(location, current);
    assertProxyTargetStatic(current);
    await assertProxyTargetResolvable(current);
  }
  throw new ProxyTargetError("too-many-redirects", `Too many redirects: ${target.href}`, 502);
}

/** 流式大小上限：content-length 缺失或造假时，超过 maxBytes 立即让流失败。 */
export function capResponseStream(
  body: ReadableStream<Uint8Array>,
  maxBytes = MAX_PROXY_BYTES
): ReadableStream<Uint8Array> {
  let received = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) {
          controller.error(new Error(`Audio proxy response exceeded ${maxBytes} bytes`));
          return;
        }
        controller.enqueue(chunk);
      },
    })
  );
}
