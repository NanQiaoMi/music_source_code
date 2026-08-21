import { NextRequest, NextResponse } from "next/server";
import { neteaseWeApiRequest } from "@/lib/netease/request";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") || "";

  if (!key) {
    return NextResponse.json({ code: 400, message: "Missing key parameter" }, { status: 400 });
  }

  try {
    const result = await neteaseWeApiRequest("/api/login/qrcode/client/login", {
      key,
      type: 3,
    });

    const code = result.body?.code ?? (result.status === 200 ? 801 : 500);
    const message = result.body?.message || (code === 803 ? "授权登录成功" : code === 802 ? "待确认" : code === 800 ? "二维码已过期" : "等待扫码");

    // 提取 cookie 字符串
    const cookie = result.cookieStr || (Array.isArray(result.cookie) ? result.cookie.join("; ") : "");

    const response = NextResponse.json({
      code,
      message,
      cookie,
      status: code === 803 ? "AUTHORIZED" : code === 802 ? "PENDING_CONFIRM" : code === 800 ? "EXPIRED" : "WAITING",
      body: result.body,
    });

    // 如果授权成功，也可通过 Header 写入 Set-Cookie
    if (code === 803 && cookie) {
      response.headers.set("X-Netease-Cookie", cookie);
    }

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Check QR status failed";
    return NextResponse.json({ code: 500, message }, { status: 500 });
  }
}
