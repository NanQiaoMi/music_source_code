import { Song } from "@/types/song";
import { ToolDefinition, ToolExecutionResult } from "@/types/aiAgent";
import { multiSourceResolver } from "@/services/MultiSourceResolver";
import { useAudioStore, LoopMode } from "@/store/audioStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useQueueStore } from "@/store/queueStore";
import { useVisualizationV8Store } from "@/store/visualizationV8Store";
import { useSleepTimerStore } from "@/store/sleepTimerStore";
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
 * OpenAI 格式的工具定义列表（共 12 项全功能工具矩阵）
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
      name: "control_playback",
      description: "控制音频播放器的播放状态（播放、暂停、播放/暂停切换、下一首、上一首、停止）",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["play", "pause", "toggle", "next", "prev", "stop"],
            description:
              "操作指令：play(继续播放), pause(暂停), toggle(切换播放暂停), next(下一首), prev(上一首), stop(停止)",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_volume",
      description: "调节播放器音量（0~100）或切换静音状态",
      parameters: {
        type: "object",
        properties: {
          volume: {
            type: "number",
            description: "目标音量百分比，范围 0 到 100",
          },
          isMuted: {
            type: "boolean",
            description: "是否开启静音（true 为静音，false 为取消静音）",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_play_mode",
      description: "设置播放模式（单曲循环、列表循环、随机播放、顺序播放）",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["single", "loop", "shuffle", "sequence"],
            description:
              "目标播放模式：single(单曲循环), loop(列表循环), shuffle(随机播放), sequence(顺序播放)",
          },
        },
        required: ["mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_playing",
      description: "查询当前正在播放的曲目名称、歌手、专辑、当前播放状态、播放进度、音量及播放模式",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "like_current_song",
      description: "将当前播放歌曲或指定歌曲添加到“我的喜欢”红心收藏列表，或取消收藏",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["like", "unlike", "toggle"],
            description: "操作类型：like(添加喜欢), unlike(取消喜欢), toggle(切换喜欢状态)",
          },
          songId: {
            type: "string",
            description: "可选的指定歌曲 ID，如果不传则默认操作当前正在播放的歌曲",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_queue",
      description: "将指定歌曲批量添加到播放列表末尾、插队到下一首播放，或清空待播队列",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["append", "insert_next", "clear"],
            description:
              "添加方式：append(追加到待播列表末尾), insert_next(插队到下一首播放), clear(清空待播队列)",
          },
          songIds: {
            type: "array",
            items: { type: "string" },
            description: "歌曲 ID 列表",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "switch_visualizer",
      description: "切换全屏音乐可视化效果（如弧光伴字、东方水墨、经典频谱、粒子星轨等）",
      parameters: {
        type: "object",
        properties: {
          effect: {
            type: "string",
            description:
              "可视化特效名称或别名，例如：cinematicLyricDrift(弧光伴字/流光歌词), cinematicOrientalInk(东方水墨), orientalLandscape(水墨山水), spectrum(经典频谱), particleField(粒子场), starTrails(星轨), auroraWave(极光)",
          },
        },
        required: ["effect"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_sleep_timer",
      description: "设置定时停止播放（睡眠定时器），或取消当前定时",
      parameters: {
        type: "object",
        properties: {
          minutes: {
            type: "number",
            description: "定时停止的分钟数，例如 15, 30, 45, 60",
          },
          cancel: {
            type: "boolean",
            description: "是否取消当前正在运行的睡眠定时器",
          },
        },
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
 * 辅助映射可视化效果标识符
 */
function normalizeVisualizerEffect(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (
    trimmed.includes("弧光") ||
    trimmed.includes("歌词") ||
    trimmed.includes("drift") ||
    trimmed.includes("lyric")
  ) {
    return "cinematicLyricDrift";
  }
  if (trimmed.includes("水墨山水") || trimmed.includes("landscape") || trimmed.includes("山水")) {
    return "orientalLandscape";
  }
  if (trimmed.includes("水墨") || trimmed.includes("ink")) {
    return "cinematicOrientalInk";
  }
  if (trimmed.includes("粒子") || trimmed.includes("particle")) {
    return "particleField";
  }
  if (trimmed.includes("星轨") || trimmed.includes("star")) {
    return "starTrails";
  }
  if (trimmed.includes("极光") || trimmed.includes("aurora")) {
    return "auroraWave";
  }
  if (trimmed.includes("频谱") || trimmed.includes("spectrum")) {
    return "spectrum";
  }
  return input;
}

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

        const songResults = await multiSourceResolver.searchBestMatchingSongResults(query, limit);
        const songs = songResults.map((sr) => sr.song);
        cacheSongs(songs);

        const bestMatch = songResults.find((sr) => sr.isBestMatch);
        const summary = {
          count: songs.length,
          bestMatch: bestMatch
            ? {
                title: bestMatch.song.title,
                artist: bestMatch.song.artist,
                source: bestMatch.source,
                quality: bestMatch.qualityLabel,
                matchScore: bestMatch.matchScore,
              }
            : null,
          results: songResults.map((sr) => ({
            id: sr.song.id,
            title: sr.song.title,
            artist: sr.song.artist,
            album: sr.song.album || "",
            duration: sr.song.duration,
            source: sr.source,
            quality: sr.qualityLabel,
            isBestMatch: sr.isBestMatch,
          })),
        };

        return {
          success: true,
          message: bestMatch
            ? `已从已有渠道中优选出最符合资源《${bestMatch.song.title}》（${bestMatch.source} · ${bestMatch.qualityLabel}），共检索到 ${songs.length} 首`
            : `已检索到 ${songs.length} 首歌曲`,
          data: summary,
          songs,
          songResults,
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

      case "control_playback": {
        const action = typeof args.action === "string" ? args.action.toLowerCase() : "";
        const audioStore = useAudioStore.getState();

        switch (action) {
          case "play":
            audioStore.setIsPlaying(true);
            return { success: true, message: "已继续播放音乐" };

          case "pause":
            audioStore.setIsPlaying(false);
            return { success: true, message: "已暂停音乐播放" };

          case "toggle": {
            const nextPlaying = !audioStore.isPlaying;
            audioStore.setIsPlaying(nextPlaying);
            return { success: true, message: nextPlaying ? "已开始播放" : "已暂停播放" };
          }

          case "next":
            audioStore.nextSong();
            return { success: true, message: "已为您切到下一首歌曲" };

          case "prev":
            audioStore.prevSong();
            return { success: true, message: "已为您切回上一首歌曲" };

          case "stop":
            audioStore.setIsPlaying(false);
            return { success: true, message: "已停止音乐播放" };

          default:
            return {
              success: false,
              message: `不支持的播放控制动作: ${action}`,
              error: `Invalid action: ${action}`,
            };
        }
      }

      case "set_volume": {
        const audioStore = useAudioStore.getState();
        const results: string[] = [];

        if (typeof args.volume === "number" && !Number.isNaN(args.volume)) {
          const clamped = Math.max(0, Math.min(100, args.volume));
          audioStore.setVolume(clamped / 100);
          results.push(`音量已调整为 ${clamped}%`);
        }

        if (typeof args.isMuted === "boolean") {
          if (args.isMuted !== audioStore.isMuted) {
            audioStore.toggleMute();
          }
          results.push(args.isMuted ? "已开启静音" : "已取消静音");
        }

        if (results.length === 0) {
          return {
            success: false,
            message: "未提供有效的音量数值或静音指令",
            error: "No volume or isMuted parameter provided",
          };
        }

        return {
          success: true,
          message: results.join("，"),
          data: {
            volume: Math.round(useAudioStore.getState().volume * 100),
            isMuted: useAudioStore.getState().isMuted,
          },
        };
      }

      case "set_play_mode": {
        const mode = typeof args.mode === "string" ? args.mode.toLowerCase() : "";
        let loopMode: LoopMode;
        let modeLabel = "";

        switch (mode) {
          case "single":
            loopMode = "single";
            modeLabel = "单曲循环";
            break;
          case "loop":
            loopMode = "all";
            modeLabel = "列表循环";
            break;
          case "shuffle":
            loopMode = "shuffle";
            modeLabel = "随机播放";
            break;
          case "sequence":
            loopMode = "none";
            modeLabel = "顺序播放";
            break;
          default:
            return {
              success: false,
              message: `不支持的播放模式: ${mode}`,
              error: `Invalid mode: ${mode}`,
            };
        }

        useAudioStore.getState().setLoopMode(loopMode);
        return {
          success: true,
          message: `播放模式已切换为「${modeLabel}」`,
          data: { loopMode, modeLabel },
        };
      }

      case "get_current_playing": {
        const audioStore = useAudioStore.getState();
        const currentSong = audioStore.currentSong;

        if (!currentSong) {
          return {
            success: true,
            message: "当前暂无正在播放的歌曲",
            data: {
              isPlaying: false,
              currentSong: null,
            },
          };
        }

        const isFav = useFavoritesStore.getState().isFavorite(currentSong.id);
        const loopModeMap: Record<LoopMode, string> = {
          none: "顺序播放",
          all: "列表循环",
          single: "单曲循环",
          shuffle: "随机播放",
        };

        return {
          success: true,
          message: `当前正在播放: 《${currentSong.title}》 - ${currentSong.artist}`,
          data: {
            isPlaying: audioStore.isPlaying,
            song: {
              id: currentSong.id,
              title: currentSong.title,
              artist: currentSong.artist,
              album: currentSong.album || "未知专辑",
              duration: currentSong.duration,
              source: currentSong.source,
            },
            progressSeconds: Math.round(audioStore.currentTime),
            volume: Math.round(audioStore.volume * 100),
            isMuted: audioStore.isMuted,
            isFavorite: isFav,
            playMode: loopModeMap[audioStore.loopMode] || "顺序播放",
          },
        };
      }

      case "like_current_song": {
        const action = typeof args.action === "string" ? args.action.toLowerCase() : "toggle";
        const songId = typeof args.songId === "string" ? args.songId.trim() : undefined;

        let targetSong: Song | null = null;
        if (songId) {
          targetSong = getCachedSong(songId) || null;
        }
        if (!targetSong) {
          targetSong = useAudioStore.getState().currentSong;
        }

        if (!targetSong) {
          return {
            success: false,
            message: "当前没有正在播放的曲目，且未指定歌曲 ID",
            error: "No song to like",
          };
        }

        const favStore = useFavoritesStore.getState();
        const isCurrentlyFav = favStore.isFavorite(targetSong.id);

        if (action === "like") {
          favStore.addToFavorites(targetSong);
          return {
            success: true,
            message: `已将《${targetSong.title}》加入红心收藏 ❤️`,
            data: { isFavorite: true, song: targetSong },
          };
        } else if (action === "unlike") {
          favStore.removeFromFavorites(targetSong.id);
          return {
            success: true,
            message: `已将《${targetSong.title}》从收藏列表中移除 🤍`,
            data: { isFavorite: false, song: targetSong },
          };
        } else {
          favStore.toggleFavorite(targetSong);
          const newFavState = !isCurrentlyFav;
          return {
            success: true,
            message: newFavState
              ? `已将《${targetSong.title}》加入红心收藏 ❤️`
              : `已将《${targetSong.title}》取消收藏 🤍`,
            data: { isFavorite: newFavState, song: targetSong },
          };
        }
      }

      case "add_to_queue": {
        const action = typeof args.action === "string" ? args.action.toLowerCase() : "append";
        const queueStore = useQueueStore.getState();

        if (action === "clear") {
          queueStore.clearQueue();
          return {
            success: true,
            message: "已清空播放队列",
          };
        }

        const songIds = Array.isArray(args.songIds) ? (args.songIds as string[]) : [];
        if (songIds.length === 0) {
          return {
            success: false,
            message: "未提供要添加的歌曲 ID 列表",
            error: "Empty songIds array",
          };
        }

        const resolvedSongs: Song[] = [];
        for (const sid of songIds) {
          const s = getCachedSong(sid);
          if (s) {
            resolvedSongs.push(s);
          }
        }

        if (resolvedSongs.length === 0) {
          return {
            success: false,
            message: "未能根据提供的 ID 找到有效的歌曲缓存，请先搜索曲目",
            error: "No songs resolved from cache",
          };
        }

        if (action === "insert_next") {
          // 倒序插入以保证首首依次紧随当前播放
          for (let i = resolvedSongs.length - 1; i >= 0; i--) {
            queueStore.addToNext(resolvedSongs[i]);
          }
          return {
            success: true,
            message: `已将 ${resolvedSongs.length} 首曲目设为下一首播放 ⏭️`,
            data: { count: resolvedSongs.length, songs: resolvedSongs },
          };
        } else {
          for (const s of resolvedSongs) {
            queueStore.addToQueue(s);
          }
          return {
            success: true,
            message: `已将 ${resolvedSongs.length} 首曲目追加至待播列表 🎶`,
            data: { count: resolvedSongs.length, songs: resolvedSongs },
          };
        }
      }

      case "switch_visualizer": {
        const rawEffect = typeof args.effect === "string" ? args.effect : "";
        if (!rawEffect) {
          return {
            success: false,
            message: "缺少可视化特效名称",
            error: "Missing effect parameter",
          };
        }

        const normalized = normalizeVisualizerEffect(rawEffect);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useVisualizationV8Store.getState().setCurrentEffect(normalized as any);

        return {
          success: true,
          message: `已为您切换全屏音乐可视化特效为「${normalized}」✨`,
          data: { effect: normalized },
        };
      }

      case "set_sleep_timer": {
        const sleepStore = useSleepTimerStore.getState();

        if (args.cancel === true) {
          sleepStore.cancelTimer();
          return {
            success: true,
            message: "已取消睡眠定时器 ⏰",
            data: { isActive: false },
          };
        }

        const minutes =
          typeof args.minutes === "number" ? Math.max(1, Math.round(args.minutes)) : null;
        if (!minutes) {
          return {
            success: false,
            message: "缺少定时分钟数",
            error: "Invalid minutes parameter",
          };
        }

        sleepStore.setTimer(minutes);
        sleepStore.startTimer();

        return {
          success: true,
          message: `已设定睡眠定时器：${minutes} 分钟后自动停止播放 🌙`,
          data: { minutes, isActive: true },
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
