import { NextRequest } from "next/server";
import {
  getCacheKey,
  hasCompleteCache,
  serveCachedFile,
  cacheStreamAndTee,
} from "@/lib/audio/proxyDiskCache";
import {
  MAX_PROXY_BYTES,
  ProxyTargetError,
  assertProxyTargetResolvable,
  assertProxyTargetStatic,
  capResponseStream,
  fetchProxyUpstream,
  parseProxyTarget,
  proxyTimeoutMs,
} from "@/lib/audio/proxyGuard";
import { combineSignals } from "@/lib/playback/requestCoordinator";

const CLIENT_ABORT_STATUS = 499;

function isTimeoutReason(reason: unknown): boolean {
  return (
    typeof reason === "object" &&
    reason !== null &&
    (reason as { name?: unknown }).name === "TimeoutError"
  );
}

function rejectionResponse(error: ProxyTargetError): Response {
  console.warn(`[/api/audio/proxy] Rejected target (${error.reason}): ${error.message}`);
  if (error.status === 400) {
    return new Response("Invalid audio target URL", { status: 400 });
  }
  if (error.status === 502) {
    return new Response("Audio proxy redirect limit exceeded", { status: 502 });
  }
  return new Response("Blocked audio proxy target", { status: 403 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Accept, User-Agent",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, X-Cache",
    },
  });
}

export async function HEAD(request: NextRequest) {
  return GET(request);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url") ?? "";

  let target: URL;
  try {
    target = parseProxyTarget(targetUrl);
    assertProxyTargetStatic(target);
  } catch (error) {
    if (error instanceof ProxyTargetError) return rejectionResponse(error);
    console.error("[/api/audio/proxy] Target validation error:", error);
    return new Response("Invalid audio target URL", { status: 400 });
  }

  const rangeHeader = request.headers.get("range");
  const cacheKey = getCacheKey(targetUrl);

  // 1. ===== 本地代理磁盘 LRU 缓存命中检查 (0ms 本地瞬发) =====
  try {
    const cached = await hasCompleteCache(cacheKey);
    if (cached.isHit && cached.meta) {
      return serveCachedFile(cached.filePath, cached.meta, rangeHeader);
    }
  } catch (e) {
    console.warn("[/api/audio/proxy] Cache lookup error:", e);
  }

  // 2. ===== 远端拉取前做异步 DNS 校验（缓存未命中才需要联网） =====
  try {
    await assertProxyTargetResolvable(target);
  } catch (error) {
    if (error instanceof ProxyTargetError) return rejectionResponse(error);
    console.error("[/api/audio/proxy] DNS validation error:", error);
    return new Response("Blocked audio proxy target", { status: 403 });
  }

  // 3. ===== 远端拉取回退 =====
  const upstreamHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  };

  if (targetUrl.includes("kuwo.cn")) {
    upstreamHeaders["Referer"] = "http://www.kuwo.cn/";
  } else if (targetUrl.includes("qq.com")) {
    upstreamHeaders["Referer"] = "https://y.qq.com/";
  } else if (targetUrl.includes("kugou.com")) {
    upstreamHeaders["Referer"] = "http://www.kugou.com/";
  }

  if (rangeHeader) {
    upstreamHeaders["Range"] = rangeHeader;
  }

  const clientSignal = request.signal;
  if (clientSignal?.aborted) {
    return new Response("Client closed request", { status: CLIENT_ABORT_STATUS });
  }
  const upstreamSignal = combineSignals(clientSignal, proxyTimeoutMs());

  try {
    const upstreamRes = await fetchProxyUpstream(target, {
      headers: upstreamHeaders,
      signal: upstreamSignal,
    });

    const contentLength = upstreamRes.headers.get("content-length");
    const declaredLength = contentLength ? Number.parseInt(contentLength, 10) : 0;
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PROXY_BYTES) {
      try {
        await upstreamRes.body?.cancel();
      } catch {
        // 关闭超限响应体失败不影响返回
      }
      return new Response("Upstream audio exceeds proxy size limit", { status: 413 });
    }

    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
    headers.set(
      "Access-Control-Expose-Headers",
      "Content-Range, Content-Length, Accept-Ranges, X-Cache"
    );
    headers.set("Accept-Ranges", "bytes");
    headers.set("X-Cache", "MISS");

    const contentType = upstreamRes.headers.get("content-type") || "audio/mpeg";
    headers.set("Content-Type", contentType);

    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    let clientBody: ReadableStream<Uint8Array> | null = upstreamRes.body
      ? capResponseStream(upstreamRes.body as ReadableStream<Uint8Array>, MAX_PROXY_BYTES)
      : null;

    // 仅在起始拉流（状态 200，或从 0 开始的 Range 206）时分流写入磁盘缓存
    const isStartOfFile = !rangeHeader || rangeHeader.startsWith("bytes=0-");
    if (clientBody && isStartOfFile && upstreamRes.status >= 200 && upstreamRes.status < 300) {
      clientBody = cacheStreamAndTee(
        cacheKey,
        targetUrl,
        contentType,
        declaredLength > 0 ? declaredLength : 0,
        clientBody
      );
    }

    return new Response(clientBody, {
      status: upstreamRes.status,
      headers,
    });
  } catch (error) {
    if (clientSignal?.aborted) {
      return new Response("Client closed request", { status: CLIENT_ABORT_STATUS });
    }
    if (error instanceof ProxyTargetError) return rejectionResponse(error);
    if (upstreamSignal.aborted && isTimeoutReason(upstreamSignal.reason)) {
      return new Response("Upstream audio request timed out", { status: 504 });
    }
    console.error("[/api/audio/proxy] Proxy streaming error:", error);
    return new Response("Internal audio proxy streaming error", { status: 502 });
  }
}
