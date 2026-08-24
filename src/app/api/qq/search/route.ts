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

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookie = request.headers.get("x-qq-cookie") || request.headers.get("cookie") || "";
  if (!cookie || cookie.trim().length < 5) {
    return NextResponse.json(
      { songs: [], code: 401, message: "QQ Music authentication required. Please login first.", source: "qq" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || searchParams.get("s") || "";
  const rawLimit = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 60);
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);

  if (!keywords.trim()) {
    return NextResponse.json({ songs: [], code: 200, count: 0, source: "qq" });
  }

  const encoded = encodeURIComponent(keywords.trim());
  const qqUrl = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=${page}&n=${limit}&w=${encoded}&format=json&ct=24&qqmusic_ver=1298`;

  try {
    const res = await fetch(qqUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://y.qq.com/",
        Cookie: cookie,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        const clean = text.replace(/^callback\(|^MusicJsonCallback\(|\)$/g, "").trim();
        data = JSON.parse(clean);
      }

      const rawList = data?.data?.song?.list || data?.song?.list || data?.data?.list || [];
      if (rawList.length === 0) {
        console.warn("[api/qq/search] rawList empty. data preview:", JSON.stringify(data).slice(0, 300));
      }
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
