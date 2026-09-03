"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Music2,
  Disc3,
  Sun,
  Moon,
  Sunset,
  Coffee,
  Compass,
  Volume2,
  ArrowUpRight,
  Radio,
  Search,
  Sliders,
} from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { Song } from "@/types/song";

interface CuratorWelcomeHeroCardProps {
  onSendPrompt: (text: string) => void;
}

interface TimeGreeting {
  badge: string;
  badgeIcon: React.ElementType;
  title: string;
  subtitle: string;
}

function getTimeGreeting(date: Date = new Date()): TimeGreeting {
  const hour = date.getHours();

  if (hour >= 0 && hour < 5) {
    return {
      badge: "深夜沉思 · 万籁俱寂",
      badgeIcon: Moon,
      title: "夜深了，听点沉静温润的旋律",
      subtitle:
        "万籁沉寂的午夜，无论是一句浮游在心底的歌词残片，还是想寻觅温暖的民谣箱体共振，我都随时在此为你淘取好音。",
    };
  }
  if (hour >= 5 && hour < 9) {
    return {
      badge: "清晨曙光 · 晨光初醒",
      badgeIcon: Sun,
      title: "晨光熹微，让音符唤醒知觉",
      subtitle: "新的一天启程，点播一首轻快跳跃的早安节拍，或让微风般的纯音乐伴随洗漱与早餐。",
    };
  }
  if (hour >= 9 && hour < 12) {
    return {
      badge: "上午专注 · 灵感涌动",
      badgeIcon: Coffee,
      title: "专注时刻，伴随舒展的器乐音浪",
      subtitle: "高能专注的时段，适合极简 Lo-Fi 节拍、低保真音轨或古典钢琴，让思维随旋律平稳流淌。",
    };
  }
  if (hour >= 12 && hour < 14) {
    return {
      badge: "午间小憩 · 惬意时光",
      badgeIcon: Coffee,
      title: "午后慵懒，与好旋律不期而遇",
      subtitle: "午后阳光斜照，适合听几首舒缓法式香颂、城市流行或轻柔吉他，享受片刻的放空与治愈。",
    };
  }
  if (hour >= 14 && hour < 18) {
    return {
      badge: "午后时光 · 光影流转",
      badgeIcon: Sun,
      title: "午后正好，听点律动与放克节奏",
      subtitle: "驱散困倦，让充满弹性的贝斯 Line、复古合成器浪潮与明朗流行曲点燃整个下午的灵感。",
    };
  }
  if (hour >= 18 && hour < 22) {
    return {
      badge: "黄昏归途 · 霓虹交织",
      badgeIcon: Sunset,
      title: "落日余晖，沉浸在温暖的声音里",
      subtitle: "结束奔波归家，适宜爵士微醺、R&B 律动或抒情流行，让声音包裹一整天的疲惫。",
    };
  }
  return {
    badge: "深夜独处 · 独享宁静",
    badgeIcon: Moon,
    title: "夜色渐浓，吉他与低语的自留地",
    subtitle:
      "属于自己的深夜时间，适合探索冷门黑胶宝载、氛围环境音，或深入剖析一首藏在岁月里的老歌。",
  };
}

interface InspirationGroup {
  category: string;
  icon: React.ElementType;
  prompts: string[];
}

function getAdaptiveInspiration(hour: number, currentSong: Song | null): InspirationGroup[] {
  const isNight = hour >= 21 || hour < 5;

  if (isNight) {
    return [
      {
        category: "深夜微醺",
        icon: Moon,
        prompts: ["来几首适合深夜独自沉思的吉他民谣", "心情低落时听的治愈系钢琴曲"],
      },
      {
        category: "环境入眠",
        icon: Radio,
        prompts: ["伴随雨声与白噪音的极简氛围音乐", "失眠时听的极度失重慢节奏"],
      },
      {
        category: "歌词探寻",
        icon: Search,
        prompts: ["有句歌词是'如果天黑之前来得及'", "搜歌词包含'爱是一道光'的歌"],
      },
      {
        category: currentSong ? "当前曲风延伸" : "经典黑胶",
        icon: Disc3,
        prompts: currentSong
          ? [
              `推荐几首与《${currentSong.title}》气质相通的歌曲`,
              `深度剖析《${currentSong.title}》的词曲意境`,
            ]
          : ["推荐几张被低估的华语流行神专", "推荐周杰伦经典冷门慢歌"],
      },
    ];
  }

  // 白天与傍晚
  return [
    {
      category: "场景心境",
      icon: Compass,
      prompts: ["适合专注工作编程的极简 Lo-Fi 节奏", "开车兜风时的动感放克与复古 Synth"],
    },
    {
      category: "歌手精选",
      icon: Disc3,
      prompts: ["推荐周杰伦的经典抒情慢歌", "推荐几首陈奕迅小众但好听的粤语歌"],
    },
    {
      category: "歌词探寻",
      icon: Search,
      prompts: ["有句歌词是'想念是会呼吸的痛'", "搜歌名带有'晴天'或'夏天'的歌曲"],
    },
    {
      category: currentSong ? "当前曲风延伸" : "流派探索",
      icon: Music2,
      prompts: currentSong
        ? [
            `推荐几首与《${currentSong.title}》气质相通的歌曲`,
            `深度剖析《${currentSong.title}》的配器编排`,
          ]
        : ["推荐几首极具呼吸感的法式独立流行", "来点让人心情明朗的轻快爵士"],
    },
  ];
}

export const CuratorWelcomeHeroCard: React.FC<CuratorWelcomeHeroCardProps> = React.memo(
  ({ onSendPrompt }) => {
    const currentSong = useAudioStore((state) => state.currentSong);
    const isPlaying = useAudioStore((state) => state.isPlaying);

    const timeGreeting = useMemo(() => getTimeGreeting(), []);
    const BadgeIcon = timeGreeting.badgeIcon;

    const hour = useMemo(() => new Date().getHours(), []);
    const inspirationGroups = useMemo(
      () => getAdaptiveInspiration(hour, currentSong),
      [hour, currentSong]
    );

    const handleExploreCurrentSong = () => {
      if (currentSong) {
        onSendPrompt(
          `请帮我深度剖析当前播放的《${currentSong.title}》（${currentSong.artist}），解析它的编曲亮点与歌词意境。`
        );
      }
    };

    return (
      <div className="space-y-3.5 my-1">
        {/* Apple 灵动流光微晶看板 */}
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-[26px] p-5 overflow-hidden border border-white/[0.12] bg-gradient-to-b from-white/[0.07] to-white/[0.02] backdrop-blur-3xl shadow-[0_16px_48px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] text-white group"
        >
          {/* 液态微光漫射光晕 (Aurora Glow) */}
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-gradient-to-br from-cyan-500/20 via-indigo-500/15 to-transparent blur-3xl pointer-events-none rounded-full animate-pulse" />
          <div className="absolute -bottom-20 -left-12 w-48 h-48 bg-gradient-to-tr from-purple-500/15 via-rose-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />

          {/* 1. 顶部时段微胶囊与主理人微标 */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.14] text-[11.5px] font-medium text-white/90 shadow-sm backdrop-blur-md">
              <BadgeIcon className="w-3.5 h-3.5 text-cyan-300" />
              <span>{timeGreeting.badge}</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-white/50 tracking-wider font-mono">
              <Disc3 className="w-3.5 h-3.5 text-white/40 animate-[spin_8s_linear_infinite]" />
              <span>CURATOR</span>
            </div>
          </div>

          {/* 2. 主标题与策展人诗意导言 */}
          <div className="relative z-10 space-y-1.5">
            <h2 className="text-[17px] font-semibold text-white tracking-tight leading-snug flex items-center gap-1.5 drop-shadow-sm">
              <span>{timeGreeting.title}</span>
              <Sparkles className="w-4 h-4 text-cyan-300 shrink-0 inline" />
            </h2>
            <p className="text-[12.5px] text-white/70 font-light leading-relaxed">
              {timeGreeting.subtitle}
            </p>
          </div>

          {/* 3. 当前播放感知胶囊 (Now Playing Capsule) */}
          <div className="relative z-10 mt-4 pt-3.5 border-t border-white/[0.08]">
            {currentSong ? (
              <button
                type="button"
                onClick={handleExploreCurrentSong}
                className="w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] hover:border-white/[0.2] transition-all group/capsule text-left shadow-sm active:scale-[0.99]"
                title="点击让 AI 深度剖析这首歌"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="relative w-9 h-9 rounded-xl bg-black/40 border border-white/[0.15] overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                    {currentSong.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentSong.cover}
                        alt={currentSong.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music2 className="w-4 h-4 text-white/70" />
                    )}
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10.5px] font-semibold tracking-wider text-cyan-300/90 uppercase">
                        {isPlaying ? "正在播放" : "当前载入"}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      <span className="text-[10.5px] text-white/50 truncate">
                        {currentSong.artist}
                      </span>
                    </div>
                    <div className="text-[13px] font-medium text-white truncate group-hover/capsule:text-cyan-200 transition-colors">
                      {currentSong.title}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11.5px] font-medium text-white/60 group-hover/capsule:text-white shrink-0 pl-2">
                  <span>探讨这首</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover/capsule:translate-x-0.5 group-hover/capsule:-translate-y-0.5 transition-transform" />
                </div>
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white/50 text-[12px]">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-white/40" />
                  <span>聆听静默 · 暂无正在播放的旋律</span>
                </div>
                <span className="text-[11px] text-white/40">轻点下方开启探索</span>
              </div>
            )}
          </div>

          {/* 4. 三大核心能力徽标 */}
          <div className="relative z-10 grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/70">
              <Search className="w-3.5 h-3.5 text-cyan-300" />
              <span>灵感寻歌</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/70">
              <Sliders className="w-3.5 h-3.5 text-emerald-300" />
              <span>沉浸播控</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/70">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>音乐通感</span>
            </div>
          </div>
        </motion.div>

        {/* 5. 自适应灵感探索矩阵 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-2.5 pt-1"
        >
          <div className="text-[11.5px] font-medium text-white/60 flex items-center gap-1.5 px-1">
            <Compass className="w-3.5 h-3.5 text-white/50" />
            <span>自适应灵感探索（即点即搜）：</span>
          </div>

          <div className="space-y-2">
            {inspirationGroups.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div
                  key={group.category}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-2.5 space-y-2 transition-all hover:bg-white/[0.05]"
                >
                  <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white/75 px-1">
                    <GroupIcon className="w-3.5 h-3.5 text-cyan-300/80" />
                    <span>{group.category}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {group.prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => onSendPrompt(prompt)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] hover:border-white/[0.22] text-[12px] text-white/85 hover:text-white transition-all active:scale-95 shadow-sm text-left group/prompt"
                      >
                        <span className="line-clamp-1">{prompt}</span>
                        <ArrowUpRight className="w-3 h-3 text-white/40 group-hover/prompt:text-cyan-300 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }
);

CuratorWelcomeHeroCard.displayName = "CuratorWelcomeHeroCard";
