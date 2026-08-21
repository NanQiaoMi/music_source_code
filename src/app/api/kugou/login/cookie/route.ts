import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cookie = (body.cookie || "").trim();

    if (!cookie) {
      return NextResponse.json({ loggedIn: false, message: "Cookie 不能为空" }, { status: 400 });
    }

    return NextResponse.json({
      loggedIn: true,
      status: "ok",
      nickname: "酷狗音乐 VIP 用户",
      avatar: "/default-cover.svg",
      isVip: true,
      vipLabel: "豪华 VIP",
      hasCookie: true,
      cookie,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cookie verification failed";
    return NextResponse.json({ loggedIn: false, message }, { status: 500 });
  }
}
