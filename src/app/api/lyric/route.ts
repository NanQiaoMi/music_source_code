import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";

  if (!id.trim()) {
    return NextResponse.json({ lyric: "", code: 400, message: "Missing id" });
  }

  const numericId = id.replace(/^[a-zA-Z_-]+/, "");
  const effectiveId = numericId || id;

  if (/^\d+$/.test(effectiveId)) {
    try {
      const neteaseLyricUrl = `https://music.163.com/api/song/lyric?os=pc&id=${effectiveId}&lv=-1&kv=-1&tv=-1`;
      const res = await fetch(neteaseLyricUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://music.163.com",
        },
        next: { revalidate: 3600 },
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          lrc: { lyric: data.lrc?.lyric || "" },
          tlyric: { lyric: data.tlyric?.lyric || "" },
          code: 200,
        });
      }
    } catch (err) {
      console.error("[api/lyric] NetEase lyric error:", err);
    }
  }

  return NextResponse.json({ lrc: { lyric: "" }, code: 404, message: "Lyric not found" });
}
