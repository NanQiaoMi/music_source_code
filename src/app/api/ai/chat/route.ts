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

/** 认证类失败——只有这种才值得换一把钥匙重试，500/超时换钥匙没有意义 */
function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * 目标是否就是 SenseNova 自己的端点。
 *
 * 环境变量里的 `SENSENOVA_API_KEY_*` 是 SenseNova 的密钥，而 `baseUrl` 由请求方
 * 任意指定。回退重试等于把这把密钥再发一次给请求方点名的主机，所以只在目标确实是
 * SenseNova 时才允许回退，避免把服务端密钥转发到第三方。
 * （主路径沿用既有行为，不在本次改动范围内。）
 */
function isSenseNovaEndpoint(targetUrl: string): boolean {
  const base = process.env.SENSENOVA_BASE_URL || "https://token.sensenova.cn/v1";
  try {
    return new URL(targetUrl).origin === new URL(resolveChatCompletionsUrl(base)).origin;
  } catch {
    return false;
  }
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
    const callerApiKey = (
      bodyApiKey ||
      (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader) ||
      ""
    ).trim();
    const envApiKey = process.env.SENSENOVA_API_KEY_1 || process.env.SENSENOVA_API_KEY || "";
    const effectiveApiKey = callerApiKey || envApiKey;

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

    const callUpstream = async (apiKey: string) => {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(35000), // 35s 超时保护
      });

      const responseText = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { raw: responseText };
      }
      return { res, data };
    };

    let upstream = await callUpstream(effectiveApiKey);
    let fellBackToEnvKey = false;

    // 调用方自己带的 key 被上游拒了，而服务端还有一把能用的 —— 换它再试一次。
    // 触发场景：浏览器端 AI 设置里存的 key 过期后，页面会一直带着它发请求，
    // 而 .env.local 里的 key 其实是好的，结果就是「密钥明明能用，AI 却一直 401」。
    if (
      !upstream.res.ok &&
      isAuthFailure(upstream.res.status) &&
      callerApiKey &&
      envApiKey &&
      callerApiKey !== envApiKey &&
      isSenseNovaEndpoint(targetUrl)
    ) {
      console.warn(
        `[api/ai/chat] 调用方 API Key 被上游拒绝 (HTTP ${upstream.res.status})，改用服务端环境变量密钥重试一次`
      );
      try {
        const retry = await callUpstream(envApiKey);
        if (retry.res.ok) {
          upstream = retry;
          fellBackToEnvKey = true;
        }
        // 回退也失败就保留调用方那次的错误——那才是用户配置实际产生的结果，
        // 换成回退的报错会把真正的原因盖掉。
      } catch (e) {
        console.warn("[api/ai/chat] 密钥回退重试失败，沿用调用方返回的错误:", e);
      }
    }

    if (!upstream.res.ok) {
      const errorObj = (upstream.data as { error?: { message?: string } })?.error;
      const errorMsg =
        errorObj?.message || `上游接口响应异常 (${upstream.res.status} ${upstream.res.statusText})`;

      return NextResponse.json(
        {
          error: {
            message: errorMsg,
            status: upstream.res.status,
            details: upstream.data,
          },
        },
        { status: upstream.res.status }
      );
    }

    return NextResponse.json(upstream.data, {
      // 标记本次是靠服务端密钥成功的，便于排查「用户的 key 其实已经失效」
      headers: fellBackToEnvKey ? { "x-mimi-key-fallback": "1" } : undefined,
    });
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
