export interface LyricSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  lyrics: string;
  source: string;
  score?: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

export class LyricsSearchService {
  private demoLyrics: Map<string, LyricSearchResult>;

  constructor() {
    this.demoLyrics = new Map();
    this.initDemoLyrics();
  }

  private initDemoLyrics() {
    this.demoLyrics.set("夜曲-周杰伦", {
      id: "lyric-1",
      title: "夜曲",
      artist: "周杰伦",
      album: "十一月的肖邦",
      lyrics: `[00:00.00]夜曲
[00:04.50]作词：方文山 作曲：周杰伦
[00:08.00]
[00:12.00]一群嗜血的蚂蚁 被腐肉所吸引
[00:17.50]我面无表情 看孤独的风景
[00:23.00]失去你 爱恨开始分明
[00:28.50]失去你 还有什么事好关心
[00:34.00]
[00:34.50]当鸽子不再象征和平
[00:39.00]我终于被提醒 广场上喂食的是秃鹰
[00:45.00]我用漂亮的押韵 形容被掠夺一空的爱情
[00:52.00]
[00:52.50]啊 乌云开始遮蔽 夜色不安静
[00:58.00]公园里 葬礼的回音 在漫天飞行
[01:03.50]送你的 白色玫瑰 在纯黑的环境凋零
[01:09.00]乌鸦在树枝上诡异的很安静
[01:15.00]
[01:15.50]静静听 我黑色的大衣 想温暖你日渐冰冷的回忆
[01:22.00]走过的 走过的 生命
[01:26.00]啊 四周弥漫雾气 我在空旷的墓地
[01:32.00]老去后还爱你
[01:36.00]
[01:36.50]为你弹奏肖邦的夜曲
[01:41.00]纪念我死去的爱情
[01:46.00]跟夜风一样的声音
[01:51.00]心碎的很好听
[01:55.00]
[01:55.50]手在键盘敲很轻
[02:00.00]我给的思念很小心
[02:05.00]你埋葬的地方叫幽冥
[02:10.00]`,
      source: "demo",
    });

    this.demoLyrics.set("稻香-周杰伦", {
      id: "lyric-2",
      title: "稻香",
      artist: "周杰伦",
      album: "魔杰座",
      lyrics: `[00:00.00]稻香
[00:04.00]作词：周杰伦 作曲：周杰伦
[00:08.00]
[00:14.00]对这个世界如果你有太多的抱怨
[00:19.00]跌倒了就不敢继续往前走
[00:24.00]为什么人要这么的脆弱堕落
[00:29.00]请你打开电视看看
[00:33.00]多少人为生命在努力勇敢的走下去
[00:38.00]我们是不是该知足
[00:42.00]珍惜一切就算没有拥有
[00:46.00]
[00:47.00]还记得你说家是唯一的城堡
[00:52.00]随着稻香河流继续奔跑
[00:57.00]微微笑 小时候的梦我知道
[01:02.00]不要哭让萤火虫带着你逃跑
[01:07.00]乡间的歌谣永远的依靠
[01:12.00]回家吧 回到最初的美好
[01:17.00]
[01:18.00]不要这么容易就想放弃
[01:22.00]就像我说的
[01:25.00]追不到的梦想 换个梦不就得了
[01:30.00]为自己的人生鲜艳上色
[01:35.00]先把爱涂上喜欢的颜色
[01:39.00]笑一个吧 功成名就不是目的
[01:44.00]让自己快乐快乐 这才叫做意义
[01:49.00]`,
      source: "demo",
    });
  }

  async searchLyrics(title: string, artist?: string): Promise<LyricSearchResult[]> {
    const results: LyricSearchResult[] = [];
    const searchKey = `${title}-${artist || ""}`.toLowerCase();

    for (const [key, lyric] of this.demoLyrics) {
      if (
        key.toLowerCase().includes(searchKey) ||
        lyric.title.toLowerCase().includes(title.toLowerCase()) ||
        (artist && lyric.artist.toLowerCase().includes(artist.toLowerCase()))
      ) {
        results.push({
          ...lyric,
          score: this.calculateMatchScore(title, artist, lyric),
        });
      }
    }

    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  async getLyricsBySong(songTitle: string, songArtist: string): Promise<LyricSearchResult | null> {
    const results = await this.searchLyrics(songTitle, songArtist);
    return results.length > 0 ? results[0] : null;
  }

  parseLyrics(lrcContent: string): LyricLine[] {
    const lines: LyricLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    const parts = lrcContent.split("\n");

    for (const part of parts) {
      const match = timeRegex.exec(part);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3].padEnd(3, "0"));
        const time = minutes * 60 + seconds + milliseconds / 1000;
        const text = part.replace(timeRegex, "").trim();

        if (text) {
          lines.push({ time, text });
        }
      }
    }

    return lines.sort((a, b) => a.time - b.time);
  }

  private calculateMatchScore(
    title: string,
    artist: string | undefined,
    lyric: LyricSearchResult
  ): number {
    let score = 0;
    const titleMatch = lyric.title.toLowerCase() === title.toLowerCase();
    const artistMatch = artist && lyric.artist.toLowerCase() === artist.toLowerCase();

    if (titleMatch) score += 50;
    if (artistMatch) score += 50;

    if (!titleMatch && lyric.title.toLowerCase().includes(title.toLowerCase())) {
      score += 25;
    }
    if (artist && !artistMatch && lyric.artist.toLowerCase().includes(artist.toLowerCase())) {
      score += 25;
    }

    return score;
  }
}

export const lyricsSearchService = new LyricsSearchService();
