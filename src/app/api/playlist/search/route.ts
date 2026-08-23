import { NextRequest, NextResponse } from "next/server";

export interface OnlinePlaylistResult {
  id: string;
  name: string;
  coverImgUrl: string;
  creatorName: string;
  playCount: number;
  trackCount: number;
  source: "netease" | "qq" | "kuwo" | "kugou" | "all";
  description?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || searchParams.get("s") || "";
  const limit = parseInt(searchParams.get("limit") || "30", 10);
  const source = searchParams.get("source") || "all";

  if (!keywords.trim()) {
    return NextResponse.json({ playlists: [], code: 200, count: 0 });
  }

  const encoded = encodeURIComponent(keywords.trim());
  const playlists: OnlinePlaylistResult[] = [];

  // 1. 网易云歌单搜索 (type=1000 为歌单)
  if (source === "all" || source === "netease") {
    try {
      const neteaseUrl = `https://music.163.com/api/search/get/web?csrf_token=&s=${encoded}&type=1000&offset=0&total=true&limit=${limit}`;
      const res = await fetch(neteaseUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://music.163.com",
        },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        const rawList = data?.result?.playlists || [];
        rawList.forEach((p: any) => {
          playlists.push({
            id: String(p.id),
            name: p.name || "精选歌单",
            coverImgUrl: p.coverImgUrl || "/default-cover.svg",
            creatorName: p.creator?.nickname || "云音乐达人",
            playCount: p.playCount || 0,
            trackCount: p.trackCount || 0,
            source: "netease",
            description: p.description || "",
          });
        });
      }
    } catch (e) {
      console.warn("[api/playlist/search] NetEase playlist search error:", e);
    }
  }

  // 2. QQ 音乐歌单搜索
  if (source === "all" || source === "qq") {
    try {
      const qqUrl = `https://c.y.qq.com/soso/fcgi-bin/client_music_search_songlist?page_no=0&num_per_page=${limit}&query=${encoded}&format=json&inCharset=utf8&outCharset=utf-8`;
      const res = await fetch(qqUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://y.qq.com",
        },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        const rawList = data?.data?.list || [];
        rawList.forEach((p: any) => {
          playlists.push({
            id: String(p.dissid || p.dirid || ""),
            name: p.dissname || p.songlist_name || "QQ音乐歌单",
            coverImgUrl: p.imgurl || "/default-cover.svg",
            creatorName: p.creator?.name || p.nickname || "音乐达人",
            playCount: p.listennum || 0,
            trackCount: p.song_count || 0,
            source: "qq",
            description: p.desc || "",
          });
        });
      }
    } catch (e) {
      console.warn("[api/playlist/search] QQ playlist search error:", e);
    }
  }

  return NextResponse.json({
    playlists,
    code: 200,
    count: playlists.length,
  });
}
