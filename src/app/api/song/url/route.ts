import { NextRequest, NextResponse } from "next/server";

function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * 跨源匹配解析可播放的真音频流 (解决网易云 VIP/版权 404 问题)
 */
async function resolveCrossSourceAudio(title: string, artist: string): Promise<string | null> {
  const query = `${title} ${artist}`.trim();
  if (!query) return null;

  try {
    const kuwoSearch = `http://search.kuwo.cn/r.s?all=${encodeURIComponent(query)}&ft=music&itemset=web_2013&client=kt&pn=0&rn=5&rformat=json&encoding=utf8`;
    const kwRes = await fetch(kuwoSearch, { signal: AbortSignal.timeout(3000) });
    if (kwRes.ok) {
      const text = await kwRes.text();
      const data = JSON.parse(text.replace(/'/g, '"'));
      const list = data.abslist || [];

      for (const item of list) {
        const rid = (item.DC_TARGETID || item.MUSICRID || "").replace("MUSIC_", "");
        if (rid) {
          const streamUrlReq = `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=${rid}&format=mp3&response=url`;
          const streamRes = await fetch(streamUrlReq, { signal: AbortSignal.timeout(2500) });
          if (streamRes.ok) {
            const streamUrl = (await streamRes.text()).trim();
            if (streamUrl && streamUrl.startsWith("http")) {
              return streamUrl;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("[resolveCrossSourceAudio] Kuwo failover error:", e);
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  const title = searchParams.get("name") || searchParams.get("title") || "";
  const artist = searchParams.get("artist") || "";

  const numericId = id.replace(/^[a-zA-Z_-]+/, "");
  const effectiveId = numericId || id;

  // 1. 尝试网易云官方直链，校验其是否会 302 转向 404 (VIP/版权拦截)
  if (/^\d+$/.test(effectiveId)) {
    try {
      const directUrl = `https://music.163.com/song/media/outer/url?id=${effectiveId}.mp3`;
      const headCheck = await fetch(directUrl, {
        method: "HEAD",
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Referer: "https://music.163.com",
        },
        signal: AbortSignal.timeout(3000),
      });

      const location = headCheck.headers.get("location");
      if (headCheck.status === 200 || (location && !location.includes("/404") && location.startsWith("http"))) {
        return NextResponse.json({
          url: location || directUrl,
          level: "high",
          br: 320000,
          source: "netease",
          code: 200,
        });
      }
    } catch {
      // ignore & fallback
    }
  }

  // 2. 如果网易云直链 404 (如周杰伦等版权曲目)，自动跨源无缝秒切酷我高品质音频流
  if (title) {
    const fallbackStream = await resolveCrossSourceAudio(title, artist);
    if (fallbackStream) {
      return NextResponse.json({
        url: fallbackStream,
        level: "lossless",
        br: 320000,
        source: "cross_matched",
        code: 200,
      });
    }
  }

  // 3. 最终兜底
  if (/^\d+$/.test(effectiveId)) {
    return NextResponse.json({
      url: `https://music.163.com/song/media/outer/url?id=${effectiveId}.mp3`,
      level: "standard",
      br: 128000,
      code: 200,
    });
  }

  return NextResponse.json({ url: "", code: 404, message: "Song stream not found" });
}
