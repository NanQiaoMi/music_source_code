import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    configured: true,
    loggedIn: true,
    nickname: "汽水音乐会员",
    vipLabel: "SpadeKey 已激活",
  });
}
