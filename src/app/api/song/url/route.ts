import { NextRequest, NextResponse } from "next/server";
import { neteaseWeApiRequest } from "@/lib/netease/request";

function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[\(\[\{（【][^\)\]\}）】]*?[\)\]\}）】]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

const NOISE_KEYWORDS = [
  "伴奏", "instrumental", "inst", "片段", "dj", "慢摇", "串烧",
  "电音版", "变调", "变速", "加速", "减速", "铃声", "remix", "cover",
  "翻唱", "八音盒", "纯音乐", "试听", "重低音", "高燃", "bounce", "phonk",
  "网友改编", "小提琴", "钢琴版", "萨克斯", "古筝", "吉他版", "气氛版", "氛围版", "搞笑版"
];

function isNoiseCandidate(candidateTitle: string, targetTitle: string): boolean {
  const cLower = (candidateTitle || "").toLowerCase();
  const tLower = (targetTitle || "").toLowerCase();

  for (const kw of NOISE_KEYWORDS) {
    if (cLower.includes(kw) && !tLower.includes(kw)) {
      return true;
    }
  }
  return false;
}

function calculateMatchScore(
  targetTitle: string,
  targetArtist: string,
  candidateTitle: string,
  candidateArtist: string
): number {
  if (isNoiseCandidate(candidateTitle, targetTitle)) {
    return -100;
  }

  const normTargetTitle = normalizeString(targetTitle);
  const normCandTitle = normalizeString(candidateTitle);
  const normTargetArtist = normalizeString(targetArtist);
  const normCandArtist = normalizeString(candidateArtist);

  if (!normTargetTitle || !normCandTitle) return 0;

  // 杜绝拼接串烧
  if (!targetTitle.includes("+") && !targetTitle.includes("＋") && (candidateTitle.includes("+") || candidateTitle.includes("＋"))) {
    return -100;
  }

  // 杜绝超长标题拼接
  if (normCandTitle.length > normTargetTitle.length * 2.2 && normTargetTitle.length <= 6) {
    return -50;
  }

  let score = 0;

  // 1. 歌名匹配
  if (normTargetTitle === normCandTitle) {
    score += 80;
  } else if (normCandTitle.startsWith(normTargetTitle) || normTargetTitle.startsWith(normCandTitle)) {
    score += 45;
  } else if (normCandTitle.includes(normTargetTitle) || normTargetTitle.includes(normCandTitle)) {
    score += 25;
  } else {
    return 0; // 歌名不匹配，直接淘汰
  }

  // 2. 歌手匹配
  if (normTargetArtist) {
    if (normTargetArtist === normCandArtist) {
      score += 50;
    } else if (normCandArtist.includes(normTargetArtist) || normTargetArtist.includes(normCandArtist)) {
      score += 35;
    } else if (normCandTitle.includes(normTargetArtist)) {
      score += 30; // 标题内嵌歌手名（如 "海阔天空（BEYOND）"）
    } else if (
      (normTargetArtist.includes("beyond") && (normCandArtist.includes("黄家驹") || normCandTitle.includes("黄家驹"))) ||
      (normTargetArtist.includes("黄家驹") && (normCandArtist.includes("beyond") || normCandTitle.includes("beyond")))
    ) {
      score += 40; // 传奇乐队主唱别名关联匹配
    } else if (normTargetArtist === "未知歌手" || normCandArtist === "未知歌手") {
      score += 10;
    } else {
      return 0; // 歌手不匹配，直接淘汰（杜绝他人翻唱）
    }
  } else {
    score += 20;
  }

  // 原版加分：标题无额外修饰括号
  if (!candidateTitle.includes("(") && !candidateTitle.includes("（")) {
    score += 15;
  }

  return score;
}

const ARTIST_ALIASES: Record<string, string[]> = {
  beyond: ["黄家驹", "BEYOND", "Beyond乐队"],
  黄家驹: ["Beyond", "BEYOND"],
  eason: ["陈奕迅"],
  jay: ["周杰伦"],
  jj: ["林俊杰"],
};

/**
 * 跨源智能匹配高可用母带音频流 (严格过滤噪音与翻唱，支持双层降级搜索与别名嗅探)
 */
async function resolveCrossSourceAudio(title: string, artist: string): Promise<{ url: string; source: string } | null> {
  if (!title || !title.trim()) return null;

  const t = title.trim();
  const a = (artist || "").trim();

  const searchQueries = new Set<string>();
  if (t && a) {
    searchQueries.add(`${t} ${a}`);
    searchQueries.add(`${a} ${t}`);
  }
  searchQueries.add(t);

  // 扩展别名（如 Beyond -> 黄家驹）
  const lowerA = a.toLowerCase();
  for (const [key, aliases] of Object.entries(ARTIST_ALIASES)) {
    if (lowerA.includes(key)) {
      for (const alias of aliases) {
        searchQueries.add(`${t} ${alias}`);
        searchQueries.add(`${alias} ${t}`);
      }
    }
  }

  for (const query of Array.from(searchQueries)) {
    try {
      const kuwoSearch = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(query)}&pn=0&rn=30&uid=794766028&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json`;
      const kwRes = await fetch(kuwoSearch, { signal: AbortSignal.timeout(3000) });
      if (kwRes.ok) {
        const text = await kwRes.text();
        const clean = text.replace(/&nbsp;/g, " ").replace(/'/g, '"');
        let data: any = null;
        try {
          data = JSON.parse(clean);
        } catch {
          data = null;
        }
        const list = data?.abslist || [];

        let bestRid = "";
        let highestScore = 0;

        for (const item of list) {
          const songName = item.SONGNAME || item.NAME || "";
          const artistName = item.ARTIST || item.AARTIST || "";
          const score = calculateMatchScore(title, artist, songName, artistName);
          if (score > highestScore && score >= 70) {
            highestScore = score;
            bestRid = String(item.DC_TARGETID || item.MUSICRID || "").replace("MUSIC_", "");
          }
        }

        if (bestRid) {
          const streamUrlReq = `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=${bestRid}&format=mp3&response=url`;
          const streamRes = await fetch(streamUrlReq, { signal: AbortSignal.timeout(2500) });
          if (streamRes.ok) {
            const streamUrl = (await streamRes.text()).trim();
            if (streamUrl && streamUrl.startsWith("http")) {
              return { url: streamUrl, source: "kuwo" };
            }
          }
        }
      }
    } catch (e) {
      console.warn("[resolveCrossSourceAudio] Kuwo search error for:", query, e);
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  const title = searchParams.get("name") || searchParams.get("title") || "";
  const artist = searchParams.get("artist") || "";
  const source = (searchParams.get("source") || "").toLowerCase();

  const numericId = id.replace(/^[a-zA-Z_-]+/, "");
  const effectiveId = numericId || id;

  // 1. 酷我专区 (仅在明确指定 kuwo 或以 MUSIC_ 开头时调用)
  if (source === "kuwo" || source === "kw" || id.startsWith("MUSIC_") || id.startsWith("kw_")) {
    if (id) {
      try {
        const rid = id.replace(/^(MUSIC_|kw_)/, "");
        const directRes = await fetch(
          `http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=${rid}&format=mp3&response=url`,
          { signal: AbortSignal.timeout(2500) }
        );
        if (directRes.ok) {
          const streamUrl = (await directRes.text()).trim();
          if (streamUrl && streamUrl.startsWith("http")) {
            return NextResponse.json({
              url: streamUrl,
              level: "lossless",
              br: 320000,
              source: "kuwo",
              code: 200,
            });
          }
        }
      } catch {}
    }

    if (title) {
      const kuwoRes = await resolveCrossSourceAudio(title, artist);
      if (kuwoRes?.url) {
        return NextResponse.json({
          url: kuwoRes.url,
          level: "lossless",
          br: 320000,
          source: "kuwo",
          code: 200,
        });
      }
    }

    return NextResponse.json({ url: "", code: 404, message: "Kuwo audio not found" });
  }

  // 2. 网易云专区 (仅从网易云自身官方 WeAPI、外链 CDN 及官方接口中提取，严禁串到其他平台)
  if (source === "netease" || source === "wy" || (!source && /^\d+$/.test(effectiveId))) {
    // 2.1 网易云官方 WeAPI 获取原版真流
    if (/^\d+$/.test(effectiveId)) {
      try {
        const cookie = request.headers.get("x-netease-cookie") || request.headers.get("cookie") || "";
        const weRes = await neteaseWeApiRequest(
          "/api/song/enhance/player/url/v1",
          {
            ids: JSON.stringify([effectiveId]),
            level: "standard",
            encodeType: "mp3",
          },
          { cookie }
        );
        const songData = weRes.body?.data?.[0];
        const isTrial =
          Boolean(songData?.freeTrialInfo && (songData.freeTrialInfo.start > 0 || songData.freeTrialInfo.end > 0)) ||
          Boolean(songData?.fee === 1 && (!cookie || cookie.length < 10)) ||
          Boolean(songData?.time && songData.time <= 95000);

        if (songData?.url && songData.url.startsWith("http") && (songData.code === 200 || !songData.code) && !isTrial) {
          return NextResponse.json({
            url: songData.url,
            level: songData.level || "standard",
            br: songData.br || 320000,
            source: "netease",
            code: 200,
          });
        }
      } catch {}

      // 2.2 网易云官方外链 CDN 校验
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
      } catch {}

      // 2.3 Meting NetEase 专属通道
      try {
        const metingRes = await fetch(
          `https://api.injahow.cn/meting/?type=url&id=${effectiveId}&server=netease`,
          { signal: AbortSignal.timeout(3500) }
        );
        if (metingRes.ok) {
          const text = await metingRes.text();
          let streamUrl = "";
          try {
            const parsed = JSON.parse(text);
            streamUrl = parsed.url || parsed.data?.url || "";
          } catch {
            if (text.startsWith("http")) streamUrl = text.trim();
          }
          if (streamUrl && !streamUrl.includes("/404")) {
            return NextResponse.json({
              url: streamUrl,
              level: "high",
              br: 320000,
              source: "netease",
              code: 200,
            });
          }
        }
      } catch {}
    }

    if (source === "netease" || source === "wy") {
      // 纯网易云请求，不跨源到其他平台
      return NextResponse.json({ url: "", code: 404, message: "NetEase audio stream not found" });
    }
  }

  // 3. 通用未指明来源时的兜底搜索
  if (title) {
    const crossResult = await resolveCrossSourceAudio(title, artist);
    if (crossResult?.url) {
      return NextResponse.json({
        url: crossResult.url,
        level: "lossless",
        br: 320000,
        source: crossResult.source,
        code: 200,
      });
    }
  }

  return NextResponse.json({ url: "", code: 404, message: "Song stream not found" });
}
