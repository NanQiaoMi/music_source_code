import { NextRequest, NextResponse } from "next/server";
import { neteaseWeApiRequest } from "@/lib/netease/request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cookie = (body.cookie || "").trim();

    if (!cookie) {
      return NextResponse.json({ loggedIn: false, message: "Cookie 不能为空" }, { status: 400 });
    }

    const result = await neteaseWeApiRequest("/api/w/nuser/account/get", {}, { cookie });
    const profile = result.body?.profile;
    const account = result.body?.account;

    if (profile || (account && account.id)) {
      const vipType = account?.vipType ?? profile?.vipType ?? 0;
      const isVip = vipType > 0;
      const isSvip = vipType === 11;
      const vipLabel = isSvip ? "黑胶 SVIP" : isVip ? "黑胶 VIP" : "标准会员";

      const res = NextResponse.json({
        loggedIn: true,
        status: "ok",
        userId: String(profile?.userId || account?.id || ""),
        nickname: profile?.nickname || account?.userName || "网易云用户",
        avatarUrl: profile?.avatarUrl || "/default-cover.svg",
        vipType,
        vipLevel: isSvip ? "svip" : isVip ? "vip" : "standard",
        isVip,
        isSvip,
        vipLabel,
        hasCookie: true,
        cookie,
      });

      res.headers.set("X-Netease-Cookie", cookie);
      return res;
    }

    return NextResponse.json({ loggedIn: false, message: "Cookie 无效或已过期" }, { status: 401 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cookie verification failed";
    return NextResponse.json({ loggedIn: false, message }, { status: 500 });
  }
}
