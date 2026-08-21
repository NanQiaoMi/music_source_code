/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { neteaseWeApiRequest } from "@/lib/netease/request";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  const queryCookie = searchParams.get("cookie") || "";
  const headerCookie = request.headers.get("x-netease-cookie") || request.headers.get("cookie") || "";
  const cookie = queryCookie || headerCookie;
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));

  if (!id) {
    return NextResponse.json({ code: 400, message: "Missing playlist id", songs: [] }, { status: 400 });
  }

  try {
    const detailRes = await neteaseWeApiRequest(
      "/api/v6/playlist/detail",
      {
        id,
        n: 100,
        s: 8,
      },
      { cookie }
    );

    const playlist = detailRes.body?.playlist;
    const allTrackIds = (playlist?.trackIds || []).map((t: any) => String(t.id));
    const totalCount = playlist?.trackCount || allTrackIds.length || 0;

    let rawTracks: any[] = [];

    if (offset === 0 && Array.isArray(playlist?.tracks) && playlist.tracks.length > 0 && limit <= playlist.tracks.length) {
      rawTracks = playlist.tracks.slice(0, limit);
    } else if (allTrackIds.length > 0) {
      const targetIds = allTrackIds.slice(offset, offset + limit);
      if (targetIds.length > 0) {
        try {
          const songDetailRes = await neteaseWeApiRequest(
            "/api/v3/song/detail",
            {
              c: JSON.stringify(targetIds.map((tid: string) => ({ id: tid }))),
            },
            { cookie }
          );
          rawTracks = songDetailRes.body?.songs || [];
        } catch {
          rawTracks = (playlist?.tracks || []).slice(offset, offset + limit);
        }
      }
    } else {
      rawTracks = (playlist?.tracks || []).slice(offset, offset + limit);
    }

    const songs = rawTracks.map((t: any) => {
      const songId = String(t.id);
      const artist = Array.isArray(t.ar)
        ? t.ar.map((a: any) => a.name).join("/")
        : Array.isArray(t.artists)
        ? t.artists.map((a: any) => a.name).join("/")
        : "未知歌手";

      const cover = t.al?.picUrl || t.album?.picUrl || "/default-cover.svg";
      const duration = t.dt ? Math.round(t.dt / 1000) : t.duration ? Math.round(t.duration / 1000) : 240;

      return {
        id: songId,
        title: t.name || "未知曲目",
        artist,
        album: t.al?.name || t.album?.name || "未知专辑",
        duration,
        cover,
        source: "netease",
        audioUrl: `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
        format: "mp3",
      };
    });

    return NextResponse.json({
      code: 200,
      playlistId: id,
      name: playlist?.name || "歌单",
      coverImgUrl: playlist?.coverImgUrl || "/default-cover.svg",
      trackCount: totalCount || songs.length,
      offset,
      limit,
      hasMore: offset + songs.length < totalCount,
      songs,
      tracks: songs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fetch playlist tracks failed";
    return NextResponse.json({ code: 500, message, songs: [] }, { status: 500 });
  }
}
