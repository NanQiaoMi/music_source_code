import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";

  if (!id.trim()) {
    return NextResponse.json({ url: "", code: 400, message: "Missing id" });
  }

  const numericId = id.replace(/^[a-zA-Z_-]+/, "");
  const effectiveId = numericId || id;

  // 1. 尝试官方 CDN 直通流
  if (/^\d+$/.test(effectiveId)) {
    const directUrl = `https://music.163.com/song/media/outer/url?id=${effectiveId}.mp3`;
    return NextResponse.json({
      url: directUrl,
      level: "high",
      br: 320000,
      code: 200,
    });
  }

  return NextResponse.json({ url: "", code: 404, message: "Song not found" });
}
