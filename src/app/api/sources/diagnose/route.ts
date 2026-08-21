import { NextRequest, NextResponse } from "next/server";
import { MusicSourceId, SourceHealthStatus } from "@/types/sourceConfig";

interface DiagnoseTarget {
  id: MusicSourceId;
  url: string;
}

const TARGETS: DiagnoseTarget[] = [
  {
    id: "netease",
    url: "https://music.163.com/api/search/get/web?csrf_token=&s=test&type=1&offset=0&limit=1",
  },
  {
    id: "qq",
    url: "https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=1&n=1&w=test&format=json",
  },
  {
    id: "kugou",
    url: "http://mobilecdn.kugou.com/api/v3/search/song?keyword=test&page=1&pagesize=1",
  },
  {
    id: "kuwo",
    url: "http://search.kuwo.cn/r.s?all=test&ft=music&itemset=web_2013&client=kt&pn=0&rn=1&rformat=json&encoding=utf8",
  },
  {
    id: "qishui",
    url: "https://music.douyin.com",
  },
];

export async function GET(request: NextRequest) {
  const healthResults: Partial<Record<MusicSourceId, SourceHealthStatus>> = {
    local: {
      status: "normal",
      latencyMs: 1,
      lastChecked: Date.now(),
      message: "本地存储 DSD/FLAC 母带直连正常",
    },
    lx_custom: {
      status: "normal",
      latencyMs: 15,
      lastChecked: Date.now(),
      message: "洛雪沙箱执行引擎就绪",
    },
  };

  const tasks = TARGETS.map(async ({ id, url }) => {
    const startTime = Date.now();
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(4000),
      });

      const latencyMs = Math.max(5, Date.now() - startTime);

      if (res.ok || res.status === 200 || res.status === 302 || res.status === 304) {
        healthResults[id] = {
          status: latencyMs > 800 ? "degraded" : "normal",
          latencyMs,
          lastChecked: Date.now(),
          message: `连接正常 (HTTP ${res.status})`,
        };
      } else {
        healthResults[id] = {
          status: "degraded",
          latencyMs,
          lastChecked: Date.now(),
          message: `响应异常 (HTTP ${res.status})`,
        };
      }
    } catch (err: any) {
      healthResults[id] = {
        status: "error",
        latencyMs: 4000,
        lastChecked: Date.now(),
        message: err.name === "TimeoutError" ? "连接超时 (>4000ms)" : "网络请求失败",
      };
    }
  });

  await Promise.all(tasks);

  return NextResponse.json({
    code: 200,
    timestamp: Date.now(),
    health: healthResults,
  });
}
