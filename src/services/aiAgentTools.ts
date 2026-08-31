import { Song } from "@/types/song";
import { ToolDefinition, ToolExecutionResult } from "@/types/aiAgent";
import { multiSourceResolver } from "@/services/MultiSourceResolver";
import { useAudioStore } from "@/store/audioStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";

/**
 * 歌曲运行时快速缓存，用于根据 ID 在工具调用间共享检索到的完整 Song 结构
 */
const songCacheMap = new Map<string, Song>();

export function getCachedSong(id: string): Song | undefined {
  return songCacheMap.get(id);
}

export function cacheSong(song: Song): void {
  if (song && song.id) {
    songCacheMap.set(song.id, song);
  }
}

export function cacheSongs(songs: Song[]): void {
  for (const song of songs) {
    cacheSong(song);
  }
}

export function clearSongCache(): void {
  songCacheMap.clear();
}

/**
 * OpenAI 格式的工具定义列表
 */
export const AI_AGENT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_songs",
      description: "根据歌名、歌手、模糊歌词或关键词在全网和曲库中搜索歌曲",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词、歌名、歌手名或模糊歌词片段",
          },
          limit: {
            type: "number",
            description: "返回结果数量上限，默认 8 首，最大 20 首",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "play_song",
      description: "播放指定的歌曲",
      parameters: {
        type: "object",
        properties: {
          songId: {
            type: "string",
            description: "歌曲的唯一标识 ID",
          },
          title: {
            type: "string",
            description: "歌曲标题",
          },
          artist: {
            type: "string",
            description: "歌手名称",
          },
          source: {
            type: "string",
            description: "音源平台，如 netease, qq, kugou 等",
          },
        },
        required: ["songId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "download_song",
      description: "将指定歌曲添加到离线下载队列",
      parameters: {
        type: "object",
        properties: {
          songId: {
            type: "string",
            description: "歌曲的唯一标识 ID",
          },
          title: {
            type: "string",
            description: "歌曲标题",
          },
          artist: {
            type: "string",
            description: "歌手名称",
          },
          source: {
            type: "string",
            description: "音源平台，如 netease, qq, kugou 等",
          },
          quality: {
            type: "string",
            description: "音质规格，如 lossless, 320k, standard",
          },
        },
        required: ["songId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lyrics",
      description: "获取指定歌曲的原版及翻译歌词",
      parameters: {
        type: "object",
        properties: {
          songId: {
            type: "string",
            description: "歌曲的唯一标识 ID",
          },
          title: {
            type: "string",
            description: "歌曲标题（辅助检索）",
          },
          artist: {
            type: "string",
            description: "歌手名称（辅助检索）",
          },
          source: {
            type: "string",
            description: "音源平台",
          },
        },
        required: ["songId"],
      },
    },
  },
];

/**
 * 执行具体的 AI 工具调用
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  _context?: { abortSignal?: AbortSignal }
): Promise<ToolExecutionResult> {
  try {
    switch (name) {
      case "search_songs": {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        if (!query) {
          return {
            success: false,
            message: "搜索关键词不能为空",
            error: "Empty search query",
          };
        }

        const rawLimit = typeof args.limit === "number" ? args.limit : 8;
        const limit = Math.max(1, Math.min(rawLimit, 20));

        const songs = await multiSourceResolver.searchOnlineMusic(query, limit);
        cacheSongs(songs);

        const summary = {
          count: songs.length,
          results: songs.map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album || "",
            duration: s.duration,
            source: s.source,
          })),
        };

        return {
          success: true,
          message: `已检索到 ${songs.length} 首歌曲`,
          data: summary,
          songs,
        };
      }

      case "play_song": {
        const songId = typeof args.songId === "string" ? args.songId.trim() : "";
        if (!songId) {
          return {
            success: false,
            message: "缺少歌曲 ID",
            error: "Missing songId",
          };
        }

        const title = typeof args.title === "string" ? args.title : "未知曲目";
        const artist = typeof args.artist === "string" ? args.artist : "未知歌手";
        const source = typeof args.source === "string" ? args.source : "netease";

        let song = getCachedSong(songId);
        if (!song) {
          song = {
            id: songId,
            title,
            artist,
            source,
            duration: 0,
          };
          cacheSong(song);
        }

        useAudioStore.getState().playSong(song);

        return {
          success: true,
          message: `已开始播放: ${song.title} - ${song.artist}`,
          data: {
            played: true,
            song: {
              id: song.id,
              title: song.title,
              artist: song.artist,
              source: song.source,
            },
          },
        };
      }

      case "download_song": {
        const songId = typeof args.songId === "string" ? args.songId.trim() : "";
        if (!songId) {
          return {
            success: false,
            message: "缺少歌曲 ID",
            error: "Missing songId",
          };
        }

        const title = typeof args.title === "string" ? args.title : "未知曲目";
        const artist = typeof args.artist === "string" ? args.artist : "未知歌手";
        const source = typeof args.source === "string" ? args.source : "netease";
        const quality = typeof args.quality === "string" ? args.quality : "lossless";

        let song = getCachedSong(songId);
        if (!song) {
          song = {
            id: songId,
            title,
            artist,
            source,
            duration: 0,
          };
          cacheSong(song);
        }

        await useOfflineDownloadStore.getState().addDownload(song, quality);

        return {
          success: true,
          message: `已将《${song.title}》添加到离线下载队列`,
          data: {
            queued: true,
            song: {
              id: song.id,
              title: song.title,
              artist: song.artist,
              quality,
            },
          },
        };
      }

      case "get_lyrics": {
        const songId = typeof args.songId === "string" ? args.songId.trim() : "";
        const title = typeof args.title === "string" ? args.title : undefined;
        const artist = typeof args.artist === "string" ? args.artist : undefined;
        const source = typeof args.source === "string" ? args.source : "netease";

        const queryMeta =
          title || artist
            ? {
                title: title || "",
                artist: artist || "",
              }
            : undefined;

        const lyricRes = await multiSourceResolver.fetchOnlineLyrics(songId, source, queryMeta);

        if (lyricRes && (lyricRes.lyrics || lyricRes.translationLyrics)) {
          return {
            success: true,
            message: "歌词获取成功",
            data: lyricRes,
          };
        }

        return {
          success: false,
          message: "未找到相关歌词",
          data: null,
        };
      }

      default:
        return {
          success: false,
          message: `未知的工具: ${name}`,
          error: `Unknown tool: ${name}`,
        };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `工具执行失败: ${errorMsg}`,
      error: errorMsg,
    };
  }
}
