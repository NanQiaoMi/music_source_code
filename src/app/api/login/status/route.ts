import { NextRequest, NextResponse } from "next/server";
import { neteaseWeApiRequest } from "@/lib/netease/request";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryCookie = searchParams.get("cookie") || "";
  const headerCookie = request.headers.get("x-netease-cookie") || request.headers.get("cookie") || "";
  const cookie = queryCookie || headerCookie;

  if (!cookie || !cookie.includes("MUSIC_U")) {
    return NextResponse.json({
      loggedIn: false,
      vipType: 0,
      vipLevel: "none",
      isVip: false,
      isSvip: false,
      vipLabel: "未登录",
      hasCookie: false,
    });
  }

  try {
    const result = await neteaseWeApiRequest("/api/w/nuser/account/get", {}, { cookie });
    const profile = result.body?.profile;
    const account = result.body?.account;

    if (profile || (account && account.id)) {
      const vipType = account?.vipType ?? profile?.vipType ?? 0;
      const isVip = vipType > 0;
      const isSvip = vipType === 11; // 11 通常为黑胶 SVIP
      const vipLabel = isSvip ? "黑胶 SVIP" : isVip ? "黑胶 VIP" : "标准会员";

      return NextResponse.json({
        loggedIn: true,
        userId: String(profile?.userId || account?.id || ""),
        nickname: profile?.nickname || account?.userName || "网易云用户",
        avatarUrl: profile?.avatarUrl || "/default-cover.svg",
        vipType,
        vipLevel: isSvip ? "svip" : isVip ? "vip" : "standard",
        isVip,
        isSvip,
        vipLabel,
        hasCookie: true,
      });
    }

    return NextResponse.json({
      loggedIn: false,
      vipType: 0,
      vipLevel: "none",
      isVip: false,
      isSvip: false,
      vipLabel: "未登录",
      hasCookie: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fetch status failed";
    return NextResponse.json({ loggedIn: false, error: message }, { status: 500 });
  }
}
