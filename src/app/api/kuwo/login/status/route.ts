import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cookie = searchParams.get("cookie") || request.headers.get("x-kuwo-cookie") || "";

  if (cookie && cookie.trim().length > 5) {
    return NextResponse.json({
      loggedIn: true,
      nickname: "酷我音乐用户",
      avatar: "/default-cover.svg",
      isVip: true,
      vipLabel: "豪华VIP",
      hasCookie: true,
    });
  }

  return NextResponse.json({
    loggedIn: false,
    isVip: false,
    vipLabel: "未登录",
    hasCookie: false,
  });
}
