import { NextRequest } from "next/server";
import {
  getCacheKey,
  hasCompleteCache,
  serveCachedFile,
  cacheStreamAndTee,
} from "@/lib/audio/proxyDiskCache";

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
  const targetUrl = searchParams.get("url");

  if (!targetUrl || !targetUrl.startsWith("http")) {
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

  // 2. ===== 远端拉取回退 =====
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

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: upstreamHeaders,
    });

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

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    let clientBody = upstreamRes.body;

    // 仅在起始拉流（状态 200，或从 0 开始的 Range 206）时分流写入磁盘缓存
    const isStartOfFile = !rangeHeader || rangeHeader.startsWith("bytes=0-");
    if (clientBody && isStartOfFile && upstreamRes.status >= 200 && upstreamRes.status < 300) {
      const expectedTotal = contentLength ? parseInt(contentLength, 10) : 0;
      clientBody = cacheStreamAndTee(
        cacheKey,
        targetUrl,
        contentType,
        expectedTotal,
        clientBody as unknown as ReadableStream<Uint8Array>
      ) as unknown as ReadableStream<Uint8Array<ArrayBuffer>>;
    }

    return new Response(clientBody, {
      status: upstreamRes.status === 206 ? 206 : upstreamRes.status,
      headers,
    });
  } catch (error) {
    console.error("[/api/audio/proxy] Proxy streaming error:", error);
    return new Response("Internal audio proxy streaming error", { status: 502 });
  }
}
