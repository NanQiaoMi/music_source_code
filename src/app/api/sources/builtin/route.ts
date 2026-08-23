import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface BuiltinSourceMeta {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  fileName: string;
  sizeBytes: number;
}

const BUILTIN_LIST: BuiltinSourceMeta[] = [
  {
    id: "exclusive_v4",
    name: "[独家音源] v4.0",
    author: "洛雪科技",
    version: "4.0.0",
    description: "多平台逆向母带解析，覆盖全网主流曲库与无损音轨",
    fileName: "exclusive_v4.js",
    sizeBytes: 114852,
  },
  {
    id: "aggregate_special_v9",
    name: "全豆要[聚合音源] 9.3特供版",
    author: "全豆要 / DeepSeek优化",
    version: "9.3.0",
    description: "聚合 星海/溯音/念心/长青/汽水VIP 等多链路自动回退",
    fileName: "aggregate_special_v9.js",
    sizeBytes: 31037,
  },
  {
    id: "yecao_v1",
    name: "野草🌾 音源",
    author: "野草",
    version: "1.0.0",
    description: "野草专属 API 节点，支持 wy/tx/kw/kg 128k/320k/flac 解析",
    fileName: "yecao_v1.js",
    sizeBytes: 7155,
  },
  {
    id: "yehua_v1",
    name: "野花🌷 音源",
    author: "野花",
    version: "1.0.0",
    description: "野花专属 API 节点，全网主流曲库高品质音源直链解析",
    fileName: "yehua_v1.js",
    sizeBytes: 7452,
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const sourcesDir = path.join(process.cwd(), "src", "data", "lx_sources");

  if (id) {
    const item = BUILTIN_LIST.find((s) => s.id === id);
    if (!item) {
      return NextResponse.json({ code: 404, message: "Source not found" }, { status: 404 });
    }

    const filePath = path.join(sourcesDir, item.fileName);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        return NextResponse.json({
          code: 200,
          source: item,
          content,
        });
      }
    } catch (e: any) {
      return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
    }
  }

  // Return list with contents included
  const sourcesWithContent = BUILTIN_LIST.map((item) => {
    const filePath = path.join(sourcesDir, item.fileName);
    let content = "";
    try {
      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, "utf-8");
      }
    } catch {
      // ignore
    }
    return {
      ...item,
      content,
    };
  });

  return NextResponse.json({
    code: 200,
    sources: sourcesWithContent,
  });
}
