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
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const page = parseInt(searchParams.get("page") || "0", 10);

  if (!keywords.trim()) {
    return NextResponse.json({ songs: [], code: 200, count: 0, source: "kuwo" });
  }

  const encoded = encodeURIComponent(keywords.trim());
  const kuwoUrl = `http://search.kuwo.cn/r.s?all=${encoded}&ft=music&itemset=web_2013&client=kt&pn=${page}&rn=${limit}&rformat=json&encoding=utf8`;

  try {
    const res = await fetch(kuwoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 300 },
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
        const picShort = s.web_albumpic_short || s.web_artistpic_short;
        if (picShort && typeof picShort === "string" && picShort.length > 3) {
          cover = `https://img4.kuwo.cn/star/albumcover/${picShort}`;
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
