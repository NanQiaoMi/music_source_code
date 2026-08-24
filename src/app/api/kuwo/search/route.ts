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
  const cookie = request.headers.get("x-kuwo-cookie") || "";
  if (!cookie || cookie.trim().length < 5) {
    return NextResponse.json(
      { songs: [], code: 401, message: "Kuwo authentication required. Please login first.", source: "kuwo" },
      { status: 401 }
    );
  }


  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || searchParams.get("s") || "";
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const page = parseInt(searchParams.get("page") || "0", 10);

  if (!keywords.trim()) {
    return NextResponse.json({ songs: [], code: 200, count: 0, source: "kuwo" });
  }

  const encoded = encodeURIComponent(keywords.trim());
  const kuwoUrl = `http://search.kuwo.cn/r.s?client=kt&all=${encoded}&pn=${page}&rn=${limit}&uid=794766028&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json`;

  try {
    const res = await fetch(kuwoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: cookie,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const text = await res.text();
      const parsedText = text.replace(/'/g, '"');
      const data = JSON.parse(parsedText);
      const rawList = data?.abslist || [];

      const songs = rawList.map((s: any) => {
        const rid = String(s.DC_TARGETID || s.MUSICRID || "").replace("MUSIC_", "");
        const title = decodeEntities(s.SONGNAME || s.NAME || "未知曲目");
        const artist = decodeEntities(s.ARTIST || s.AARTIST || "未知歌手");
        const album = decodeEntities(s.ALBUM || "精选专辑");
        const duration = s.DURATION ? parseInt(s.DURATION, 10) : 240;

        let cover = "/default-cover.svg";
        if (s.web_albumpic_short && typeof s.web_albumpic_short === "string" && s.web_albumpic_short.length > 3) {
          cover = `http://img1.kuwo.cn/star/albumcover/${s.web_albumpic_short}`;
        } else if (s.web_artistpic_short && typeof s.web_artistpic_short === "string" && s.web_artistpic_short.length > 3) {
          cover = `http://img1.kuwo.cn/star/starheads/${s.web_artistpic_short}`;
        } else if (s.hts_MVPIC && typeof s.hts_MVPIC === "string" && s.hts_MVPIC.startsWith("http")) {
          cover = s.hts_MVPIC;
        } else if (s.MVPIC && typeof s.MVPIC === "string" && s.MVPIC.startsWith("http")) {
          cover = s.MVPIC;
        }

        return {
          id: rid,
          title,
          artist,
          album,
          duration: isNaN(duration) ? 240 : duration,
          cover,
          source: "kuwo",
          audioUrl: "",
          format: "mp3",
        };
      });

      return NextResponse.json({ songs, code: 200, count: songs.length, source: "kuwo" });
    }
  } catch (err) {
    console.error("[api/kuwo/search] Kuwo search error:", err);
  }

  return NextResponse.json({ songs: [], code: 500, message: "Kuwo search failed", source: "kuwo" });
}
