import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") || "";

  if (!key) {
    return NextResponse.json({ code: 400, message: "Missing key parameter" }, { status: 400 });
  }

  const qrurl = `https://music.163.com/login?codekey=${encodeURIComponent(key)}`;

  try {
    const qrimg = await QRCode.toDataURL(qrurl, {
      margin: 1,
      width: 256,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    return NextResponse.json({
      code: 200,
      data: {
        qrurl,
        qrimg,
      },
      img: qrimg,
      qrimg,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to render QR Code";
    return NextResponse.json({ code: 500, message }, { status: 500 });
  }
}
