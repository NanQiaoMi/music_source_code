/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

function decodeEntities(str: string): string {
  return (str || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || searchParams.get("s") || "";
  const limit = parseInt(searchParams.get("limit") || "40", 10);
  const page = parseInt(searchParams.get("page") || "1", 10);

  if (!keywords.trim()) {
    return NextResponse.json({ songs: [], code: 200, count: 0, source: "qq" });
  }

  const encoded = encodeURIComponent(keywords.trim());
  const qqUrl = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=${page}&n=${limit}&w=${encoded}&format=json`;

  try {
    const res = await fetch(qqUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://y.qq.com",
      },
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const data = await res.json();
      const rawList = data?.data?.song?.list || [];
      const songs = rawList.map((s: any) => {
        const songmid = String(s.songmid || s.songid || "");
        const artist = Array.isArray(s.singer)
          ? s.singer.map((a: any) => decodeEntities(a.name)).join("/")
          : decodeEntities(s.singer?.[0]?.name || "未知歌手");
        const title = decodeEntities(s.songname || s.title || "未知曲目");
        const album = decodeEntities(s.albumname || "精选专辑");
        const cover = s.albummid
          ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg`
          : "/default-cover.svg";

        return {
          id: songmid,
          title,
          artist,
          album,
          duration: s.interval ? Math.round(s.interval) : 240,
          cover,
          source: "qq",
          audioUrl: "",
          format: "mp3",
        };
      });

      return NextResponse.json({ songs, code: 200, count: songs.length, source: "qq" });
    }
  } catch (err) {
    console.error("[api/qq/search] QQ search error:", err);
  }

  return NextResponse.json({ songs: [], code: 500, message: "QQ search failed", source: "qq" });
}
