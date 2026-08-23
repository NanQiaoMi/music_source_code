import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mid = searchParams.get("mid") || searchParams.get("id") || "";
  const title = searchParams.get("title") || searchParams.get("name") || "";
  const artist = searchParams.get("artist") || "";

  const origin = request.nextUrl.origin || "http://127.0.0.1:3025";

  // 1. 如果有标题+歌手，走跨源母带匹配
  if (title) {
    try {
      const crossRes = await fetch(
        `${origin}/api/song/url?name=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&id=${mid}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (crossRes.ok) {
        const crossData = await crossRes.json();
        if (crossData?.url && crossData.url.startsWith("http")) {
          return NextResponse.json({
            url: crossData.url,
            source: crossData.source || "qq_cross",
            level: crossData.level || "lossless",
            br: crossData.br || 320000,
            code: 200,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ url: "", code: 404, message: "QQ song stream not found" });
}
