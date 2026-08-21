import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || searchParams.get("s") || "";
  const limit = parseInt(searchParams.get("limit") || "40", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  if (!keywords.trim()) {
    return NextResponse.json({ songs: [], code: 200, count: 0 });
  }

  const encoded = encodeURIComponent(keywords.trim());
  const neteaseUrl = `https://music.163.com/api/search/get/web?csrf_token=&hlpretag=&hlposttag=&s=${encoded}&type=1&offset=${offset}&total=true&limit=${limit}`;

  try {
    const res = await fetch(neteaseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://music.163.com",
      },
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const data = await res.json();
      const rawSongs = data?.result?.songs || [];
      const songs = rawSongs.map((s: any) => {
        const songId = String(s.id);
        const artist = Array.isArray(s.artists)
          ? s.artists.map((a: any) => a.name).join("/")
          : s.artist?.name || "未知歌手";
        const cover =
          s.album?.picUrl ||
          s.album?.blurPicUrl ||
          s.album?.artist?.img1v1Url ||
          s.artists?.[0]?.img1v1Url ||
          (s.album?.picId ? `https://music.163.com/api/album/img?id=${s.album.picId}` : "");

        return {
          id: songId,
          title: s.name || "未知曲目",
          artist,
          album: s.album?.name || "精选大碟",
          duration: s.duration ? Math.round(s.duration / 1000) : 240,
          cover: cover || "/default-cover.svg",
          source: "netease",
          audioUrl: `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
          format: "mp3",
        };
      });

      return NextResponse.json({ songs, code: 200, count: songs.length });
    }
  } catch (err) {
    console.error("[api/search] NetEase search error:", err);
  }

  return NextResponse.json({ songs: [], code: 500, message: "Search failed" });
}
