import { NextResponse } from "next/server";
import { neteaseWeApiRequest } from "@/lib/netease/request";

export async function GET() {
  try {
    const result = await neteaseWeApiRequest("/api/login/qrcode/unikey", { type: 3 });
    const unikey = result.body?.unikey || result.body?.data?.unikey;

    if (unikey) {
      return NextResponse.json({
        code: 200,
        unikey,
        key: unikey,
      });
    }

    return NextResponse.json(
      { code: 500, message: "Failed to generate unikey", details: result.body },
      { status: 500 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ code: 500, message }, { status: 500 });
  }
}
