import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scriptUrl = searchParams.get("url");

  if (!scriptUrl) {
    return NextResponse.json({ code: 400, message: "Missing script url" }, { status: 400 });
  }

  try {
    const res = await fetch(scriptUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const scriptContent = await res.text();
      return NextResponse.json({
        code: 200,
        url: scriptUrl,
        size: scriptContent.length,
        content: scriptContent,
      });
    } else {
      return NextResponse.json(
        { code: res.status, message: `Failed to fetch script: HTTP ${res.status}` },
        { status: 502 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { code: 500, message: err?.message || "Script download error" },
      { status: 500 }
    );
  }
}
