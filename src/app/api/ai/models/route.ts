import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function resolveModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "https://api.openai.com/v1/models";
  }
  if (trimmed.endsWith("/models")) {
    return trimmed;
  }
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/models`;
  }
  return `${trimmed}/v1/models`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { baseUrl = "https://api.openai.com/v1", apiKey: bodyApiKey } = body;

    const authHeader = req.headers.get("authorization") || "";
    const effectiveApiKey =
      bodyApiKey || (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader);

    if (!effectiveApiKey) {
      return NextResponse.json({ error: { message: "未提供 API Key" } }, { status: 401 });
    }

    const targetUrl = resolveModelsUrl(baseUrl);

    const upstreamResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await upstreamResponse.json();
    return NextResponse.json(data, { status: upstreamResponse.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "获取模型列表失败";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
