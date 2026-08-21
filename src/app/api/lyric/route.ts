import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  const title = searchParams.get("title") || searchParams.get("name") || "";
  const artist = searchParams.get("artist") || "";

  const numericId = id.replace(/^[a-zA-Z_-]+/, "");
  const effectiveId = numericId || id;

  // 1. 如果有纯数字 ID，首先尝试网易云官方歌词接口
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
        const lyric = data.lrc?.lyric || "";
        if (lyric && lyric.trim().length > 0) {
          return NextResponse.json({
            lrc: { lyric },
            tlyric: { lyric: data.tlyric?.lyric || "" },
            code: 200,
          });
        }
      }
    } catch (err) {
      console.error("[api/lyric] NetEase lyric error:", err);
    }
  }

  // 2. 如果未找到且提供了歌名/歌手，通过公开搜索自动补全歌词
  if (title) {
    try {
      const kw = encodeURIComponent(`${title} ${artist}`.trim());
      const searchUrl = `https://music.163.com/api/search/get/web?s=${kw}&type=1&offset=0&total=true&limit=5`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://music.163.com",
        },
        signal: AbortSignal.timeout(3000),
      });

      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const foundSong = searchJson?.result?.songs?.[0];
        if (foundSong?.id) {
          const lrcRes = await fetch(
            `https://music.163.com/api/song/lyric?os=pc&id=${foundSong.id}&lv=-1&kv=-1&tv=-1`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                Referer: "https://music.163.com",
              },
              signal: AbortSignal.timeout(3000),
            }
          );
          if (lrcRes.ok) {
            const lrcData = await lrcRes.json();
            const lyric = lrcData.lrc?.lyric || "";
            if (lyric && lyric.trim().length > 0) {
              return NextResponse.json({
                lrc: { lyric },
                tlyric: { lyric: lrcData.tlyric?.lyric || "" },
                code: 200,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("[api/lyric] Search lyric failover error:", e);
    }
  }

  return NextResponse.json({ lrc: { lyric: "" }, code: 404, message: "Lyric not found" });
}
