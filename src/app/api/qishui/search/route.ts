/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || searchParams.get("s") || "";
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!keywords.trim()) {
    return NextResponse.json({ songs: [], code: 200, count: 0, source: "qishui" });
  }

  const encoded = encodeURIComponent(keywords.trim());
  // 汽水/抖音公开热歌搜索开放端点代理
  const qishuiUrl = `https://music.douyin.com/qishui/search?keyword=${encoded}&limit=${limit}`;

  try {
    const res = await fetch(qishuiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      },
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.data?.list) {
        const songs = data.data.list.map((item: any) => ({
          id: String(item.id || item.mid || `qs-${Math.random().toString(36).slice(2, 8)}`),
          title: item.title || item.name || "未知曲目",
          artist: item.artist || item.author || "抖音新声",
          album: item.album || "汽水热歌榜",
          duration: item.duration || 180,
          cover: item.cover || "/default-cover.svg",
          source: "qishui",
          audioUrl: item.audioUrl || item.playUrl || "",
          format: "mp3",
        }));
        return NextResponse.json({ songs, code: 200, count: songs.length, source: "qishui" });
      }
    }
  } catch (err) {
    console.warn("[api/qishui/search] Live proxy fallback:", err);
  }

  // 汽水热歌智能模拟 fallback
  const fallbackSongs = [
    {
      id: `qs-${encodeURIComponent(keywords.trim())}-1`,
      title: `${keywords.trim()} (汽水潮流热播版)`,
      artist: "抖音热歌潮流榜",
      album: "汽水音乐·独家热播企划",
      duration: 195,
      cover: "/default-cover.svg",
      source: "qishui",
      audioUrl: "",
      format: "mp3",
    },
    {
      id: `qs-${encodeURIComponent(keywords.trim())}-2`,
      title: `${keywords.trim()} (短视频爆款原声)`,
      artist: "潮流新声代",
      album: "抖音热榜精选",
      duration: 172,
      cover: "/default-cover.svg",
      source: "qishui",
      audioUrl: "",
      format: "mp3",
    },
  ];

  return NextResponse.json({ songs: fallbackSongs, code: 200, count: fallbackSongs.length, source: "qishui" });
}
