import { NextRequest } from "next/server";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Accept, User-Agent",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
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
    headers.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Type", upstreamRes.headers.get("content-type") || "audio/mpeg");

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status === 206 ? 206 : upstreamRes.status,
      headers,
    });
  } catch (error) {
    console.error("[/api/audio/proxy] Proxy streaming error:", error);
    return new Response("Internal audio proxy streaming error", { status: 502 });
  }
}
