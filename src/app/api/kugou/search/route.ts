/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || searchParams.get("s") || "";
  const limit = parseInt(searchParams.get("limit") || "40", 10);
  const page = parseInt(searchParams.get("page") || "1", 10);

  if (!keywords.trim()) {
    return NextResponse.json({ songs: [], code: 200, count: 0, source: "kugou" });
  }

  const encoded = encodeURIComponent(keywords.trim());
  const kugouUrl = `http://mobilecdn.kugou.com/api/v3/search/song?keyword=${encoded}&page=${page}&pagesize=${limit}`;

  try {
    const res = await fetch(kugouUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      const rawList = data?.data?.info || [];
      const songs = rawList.map((s: any) => {
        const hash = String(s.hash || "");
        const artist = s.singername || "未知歌手";
        const title = s.songname || s.filename || "未知曲目";

        let cover = "/default-cover.svg";
        const unionCover = s.trans_param?.union_cover;
        if (unionCover && typeof unionCover === "string" && unionCover.startsWith("http")) {
          cover = unionCover.replace("{size}", "400");
        }

        return {
          id: hash,
          title,
          artist,
          album: s.album_name || "精选专辑",
          duration: s.duration ? Math.round(s.duration) : 240,
          cover,
          source: "kugou",
          audioUrl: "",
          format: "mp3",
        };
      });

      return NextResponse.json({ songs, code: 200, count: songs.length, source: "kugou" });
    }
  } catch (err) {
    console.error("[api/kugou/search] Kugou search error:", err);
  }

  return NextResponse.json({ songs: [], code: 500, message: "Kugou search failed", source: "kugou" });
}
