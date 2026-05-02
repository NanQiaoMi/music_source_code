import { LyricLine } from "@/services/lyricsSearchService";

export interface TotemKeyword {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  intensity: number; // 0.5 to 1.0 based on importance
}

// Emotional keywords dictionary (Chinese/English)
const EMOTIONAL_DICTIONARY = [
  // High intensity
  "虚假", "喧哗", "自由", "孤独", "绝望", "疯狂", "毁灭", "重生", "永恒", "深渊",
  "Fake", "Noise", "Freedom", "Loneliness", "Despair", "Crazy", "Destruction", "Rebirth", "Eternal", "Abyss",
  // Medium intensity
  "梦", "光", "暗", "心", "碎", "爱", "恨", "生", "死", "风", "雨", "雷", "电",
  "Dream", "Light", "Dark", "Heart", "Broken", "Love", "Hate", "Life", "Death", "Wind", "Rain", "Thunder",
  // Verbs/Adjectives
  "跳动", "燃烧", "冰冷", "温暖", "颤抖", "呼唤", "沉默", "爆发",
  "Beat", "Burn", "Cold", "Warm", "Tremble", "Call", "Silence", "Burst"
];

/**
 * Automatically extracts high-impact keywords from lyrics
 */
export function extractKeywords(lyrics: LyricLine[]): TotemKeyword[] {
  if (!lyrics || lyrics.length === 0) return [];

  const keywords: TotemKeyword[] = [];
  const textFrequency: Record<string, number> = {};
  
  // 1. Analyze frequency to find chorus keywords
  lyrics.forEach(line => {
    const text = line.text.trim();
    if (text.length < 2) return;
    textFrequency[text] = (textFrequency[text] || 0) + 1;
  });

  // 2. Identify potential chorus lines (repeated lines)
  const chorusLines = Object.keys(textFrequency).filter(text => textFrequency[text] >= 2);

  lyrics.forEach((line, index) => {
    const text = line.text.trim();
    if (text.length < 2) return;

    let foundWord = "";
    let intensity = 0.5;

    // Check against dictionary
    for (const dictWord of EMOTIONAL_DICTIONARY) {
      if (text.includes(dictWord)) {
        foundWord = dictWord;
        intensity = 0.8;
        break;
      }
    }

    // If not in dictionary but in chorus, take a meaningful segment
    if (!foundWord && chorusLines.includes(text)) {
      // Take the most "meaningful" part (longest word or segments)
      // For simplicity, we'll take segments of 2-4 chars
      const segments = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
      if (segments.length > 0) {
        foundWord = segments.sort((a, b) => b.length - a.length)[0] || "";
        intensity = 0.7;
      }
    }

    if (foundWord) {
      // Calculate duration (until next line or max 5s)
      const nextTime = lyrics[index + 1]?.time || line.time + 5;
      const duration = Math.min(nextTime - line.time, 5);

      keywords.push({
        id: `totem-${index}-${foundWord}`,
        text: foundWord,
        startTime: line.time,
        duration: duration,
        intensity: intensity
      });
    }
  });

  // Limit to one keyword every few seconds to avoid clutter
  const filteredKeywords: TotemKeyword[] = [];
  let lastTime = -10;

  keywords.forEach(kw => {
    if (kw.startTime - lastTime > 4) {
      filteredKeywords.push(kw);
      lastTime = kw.startTime;
    }
  });

  return filteredKeywords;
}
