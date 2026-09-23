import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 规范化并组装上游 AI Chat Completions 完整 URL
 */
function resolveChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "https://api.openai.com/v1/chat/completions";
  }
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      baseUrl = process.env.SENSENOVA_BASE_URL || "https://token.sensenova.cn/v1",
      apiKey: bodyApiKey,
      model = process.env.SENSENOVA_DEFAULT_MODEL || "deepseek-v4-flash",
      messages,
      tools,
      tool_choice,
      temperature = 0.7,
      max_tokens = 1024,
      response_format,
    } = body;

    const authHeader = req.headers.get("authorization") || "";
    // 只从调用方或环境变量取密钥。不要在源码里硬编码兜底值：
    // 提交进去的值会永久留在 git 历史里，事后删除也无法撤回
    const effectiveApiKey =
      bodyApiKey ||
      (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader) ||
      process.env.SENSENOVA_API_KEY_1 ||
      process.env.SENSENOVA_API_KEY;

    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: { message: "未提供 API Key，请在 AI 设置中配置" } },
        { status: 401 }
      );
    }

    const targetUrl = resolveChatCompletionsUrl(baseUrl);

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens,
    };

    if (tools && Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
      if (tool_choice) {
        payload.tool_choice = tool_choice;
      }
    }

    if (response_format) {
      payload.response_format = response_format;
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000), // 35s 超时保护
    });

    const responseText = await upstreamResponse.text();
    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!upstreamResponse.ok) {
      const errorObj = (data as { error?: { message?: string } })?.error;
      const errorMsg =
        errorObj?.message ||
        `上游接口响应异常 (${upstreamResponse.status} ${upstreamResponse.statusText})`;

      return NextResponse.json(
        {
          error: {
            message: errorMsg,
            status: upstreamResponse.status,
            details: data,
          },
        },
        { status: upstreamResponse.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const isTimeout =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const message = isTimeout
      ? "AI 接口请求超时，请检查网络或更换模型端点"
      : error instanceof Error
        ? error.message
        : "AI 代理服务发生内部异常";

    return NextResponse.json(
      {
        error: {
          message,
          type: isTimeout ? "timeout_error" : "proxy_internal_error",
        },
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
