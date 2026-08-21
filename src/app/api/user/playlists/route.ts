/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { neteaseWeApiRequest } from "@/lib/netease/request";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryCookie = searchParams.get("cookie") || "";
  const headerCookie = request.headers.get("x-netease-cookie") || request.headers.get("cookie") || "";
  const cookie = queryCookie || headerCookie;
  let uid = searchParams.get("uid") || request.headers.get("x-user-id") || "";

  if (!cookie && !uid) {
    return NextResponse.json({ code: 401, message: "未登录或未指定用户", playlists: [] });
  }

  try {
    // 若未直接传入 uid，先从账号状态中解析 uid
    if (!uid && cookie) {
      const statusRes = await neteaseWeApiRequest("/api/w/nuser/account/get", {}, { cookie });
      uid = String(statusRes.body?.profile?.userId || statusRes.body?.account?.id || "");
    }

    if (!uid) {
      return NextResponse.json({ code: 401, message: "无法获取用户身份", playlists: [] });
    }

    const playlistRes = await neteaseWeApiRequest(
      "/api/user/playlist",
      {
        uid,
        limit: 60,
        offset: 0,
        includeVideo: false,
      },
      { cookie }
    );

    const rawPlaylists = playlistRes.body?.playlist || [];
    const playlists = rawPlaylists.map((pl: any, idx: number) => ({
      id: String(pl.id),
      name: pl.name || "未命名歌单",
      coverImgUrl: pl.coverImgUrl || pl.cover || "/default-cover.svg",
      trackCount: pl.trackCount || pl.songCount || 0,
      playCount: pl.playCount || 0,
      isHeart: idx === 0 || pl.specialType === 5 || pl.name?.includes("喜欢的音乐"),
      source: "netease",
      description: pl.description || "",
      creator: {
        nickname: pl.creator?.nickname || "",
        avatarUrl: pl.creator?.avatarUrl || "",
      },
    }));

    return NextResponse.json({
      code: 200,
      playlists,
      total: playlists.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fetch playlists failed";
    return NextResponse.json({ code: 500, message, playlists: [] }, { status: 500 });
  }
}
