// S6-12o: 播放/情感/收藏快照构造，逐字迁出（只读各 store 的 getState 与 PlaybackClock）。
import { getPlaybackClockSnapshot } from "@/lib/playback/playbackClock";
import type { MusicPlaybackContext } from "@/services/aiAgentService";
import { usePlayerStore } from "../playerStore";
import { useEmotionStore } from "../emotionStore";
import { useFavoritesStore } from "../favoritesStore";
import { extractLyricsSnippet } from "./helpers";

export function getDynamicPlaybackContext(): MusicPlaybackContext {
  // 身份读 playerStore（音频字段 owner 镜像）；进度读 PlaybackClock，避免直接依赖 audioStore。
  const currentSong = usePlayerStore.getState().currentSong;
  const { currentTime, duration, isPlaying } = getPlaybackClockSnapshot();

  // 1. 时段计算
  const now = new Date();
  const hour = now.getHours();
  let periodLabel = "深夜时分";
  let ambientMood = "万籁俱寂，适宜聆听沉静、温润或内省的声响";
  if (hour >= 5 && hour < 9) {
    periodLabel = "清晨曙光";
    ambientMood = "晨光初醒，适合明亮、清新、轻快的唤醒节奏";
  } else if (hour >= 9 && hour < 12) {
    periodLabel = "上午专注";
    ambientMood = "精力饱满，适合平稳、低保真 Lo-Fi 或专注器乐";
  } else if (hour >= 12 && hour < 14) {
    periodLabel = "午后小憩";
    ambientMood = "惬意慵懒，适宜舒缓、轻柔、微风般的旋律";
  } else if (hour >= 14 && hour < 18) {
    periodLabel = "午后时光";
    ambientMood = "阳光正好，适宜律动、爵士放克或流光流行";
  } else if (hour >= 18 && hour < 22) {
    periodLabel = "黄昏与入夜";
    ambientMood = "落日与霓虹交织，适宜都市流行、R&B 或微醺氛围";
  } else if (hour >= 22 || hour < 2) {
    periodLabel = "深夜独处";
    ambientMood = "夜色渐浓，适宜木吉他民谣、氛围环境音或深情低语";
  }

  // 2. 歌词切片
  let lyricsSnippet: string | undefined = undefined;
  if (currentSong?.lyrics) {
    lyricsSnippet = extractLyricsSnippet(currentSong.lyrics, currentTime);
  }

  // 3. 情感坐标
  const emotionState = useEmotionStore.getState();
  const point = currentSong ? emotionState.points.find((p) => p.id === currentSong.id) : null;
  const emotion = point ? { x: point.x, y: point.y } : null;

  // 4. 用户偏好
  const favState = useFavoritesStore.getState();
  const favorites = favState.favorites || [];
  const recentArtists = Array.from(new Set(favorites.map((s) => s.artist).filter(Boolean))).slice(
    0,
    5
  );

  return {
    currentSong: currentSong
      ? {
          id: currentSong.id,
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album,
          duration,
          currentTime,
          isPlaying,
          lyricsSnippet,
          source: currentSong.source,
        }
      : null,
    emotion,
    timeOfDay: {
      hour,
      periodLabel,
      ambientMood,
    },
    userPreferences: {
      favoriteCount: favorites.length,
      topArtists: recentArtists,
    },
  };
}
