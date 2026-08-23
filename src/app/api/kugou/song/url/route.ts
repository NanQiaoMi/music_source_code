import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash") || searchParams.get("id") || "";
  const title = searchParams.get("title") || searchParams.get("name") || "";
  const artist = searchParams.get("artist") || "";

  const cleanHash = hash.trim();
  const origin = request.nextUrl.origin || "http://127.0.0.1:3025";

  // 1. 如果有标题/歌手，优先通过高可用全网母带集群秒级匹配真实播放流
  if (title) {
    try {
      const crossRes = await fetch(
        `${origin}/api/song/url?name=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (crossRes.ok) {
        const crossData = await crossRes.json();
        if (crossData?.url && crossData.url.startsWith("http")) {
          return NextResponse.json({
            url: crossData.url,
            source: crossData.source || "kugou_master",
            level: crossData.level || "lossless",
            br: crossData.br || 320000,
            code: 200,
          });
        }
      }
    } catch {
      // fallback
    }
  }

  // 2. 尝试从酷狗官方 getdata 提取
  if (cleanHash && /^[a-fA-F0-9]{32}$/.test(cleanHash)) {
    try {
      const getdataUrl = `https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${cleanHash}`;
      const res = await fetch(getdataUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Cookie: "kg_mid=2333",
        },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        const playUrl = data?.data?.play_url || data?.data?.play_backup_url || "";
        if (playUrl && playUrl.startsWith("http")) {
          return NextResponse.json({
            url: playUrl,
            source: "kugou",
            level: "high",
            br: 320000,
            code: 200,
          });
        }
      }
    } catch {
      // fallback
    }
  }

  return NextResponse.json({ url: "", code: 404, message: "Kugou song stream not found" });
}
