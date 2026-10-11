export interface ParsedLyricLine {
  start: number;
  text: string;
  ordinal: number;
}

export interface LyricLineGroup {
  start: number;
  lines: ParsedLyricLine[];
}

export interface TimedLyricUnit {
  text: string;
  start: number;
  end: number;
  lineIndex: number;
}

interface WeightedLyricUnit {
  text: string;
  weight: number;
}

type GraphemeKind = "word" | "cjk" | "space" | "punctuation" | "symbol";

interface GraphemeToken {
  text: string;
  kind: GraphemeKind;
}

const LRC_TIMESTAMP = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
const OFFSET_TAG = /\[offset:[^\]]*\]/gi;

const UNICODE_WORD_PATTERN = createUnicodePattern("[\\p{L}\\p{N}]");
const UNICODE_MARK_PATTERN = createUnicodePattern("\\p{M}");
const UNICODE_PUNCTUATION_PATTERN = createUnicodePattern("^\\p{P}+$");

const OPENING_PUNCTUATION = new Set([
  "(",
  "[",
  "{",
  "（",
  "［",
  "｛",
  "《",
  "〈",
  "「",
  "『",
  "【",
  "〔",
  "〖",
  "〘",
  "〚",
  "“",
  "‘",
  "‹",
  "«",
]);

const PAUSE_WEIGHTS: ReadonlyArray<readonly [string, number]> = [
  ["…", 1.2],
  ["...", 1.2],
  [".", 1.0],
  ["。", 1.0],
  ["!", 1.05],
  ["！", 1.05],
  ["?", 1.05],
  ["？", 1.05],
  [",", 0.55],
  ["，", 0.55],
  ["、", 0.45],
  [";", 0.75],
  ["；", 0.75],
  [":", 0.65],
  ["：", 0.65],
  ["—", 0.55],
  ["–", 0.45],
  ["-", 0.3],
];

/** Parse LRC lines, retaining source order in `ordinal` when timestamps tie. */
export function parseTimedLyrics(raw: string): ParsedLyricLine[] {
  if (typeof raw !== "string" || raw.length === 0) return [];

  const parsed: ParsedLyricLine[] = [];
  const seen = new Set<string>();
  let ordinal = 0;

  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line) continue;

    LRC_TIMESTAMP.lastIndex = 0;
    const timestamps = Array.from(line.matchAll(LRC_TIMESTAMP));
    if (timestamps.length === 0) continue;

    const text = line.replace(LRC_TIMESTAMP, "").replace(OFFSET_TAG, "").trim();
    if (isMetadataLine(text)) continue;

    for (const match of timestamps) {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const milliseconds = match[3] ? Number.parseInt(match[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      const start = minutes * 60 + seconds + milliseconds / 1000;
      const lineOrdinal = ordinal;
      ordinal += 1;

      const key = `${start}\u0000${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push({ start, text, ordinal: lineOrdinal });
    }
  }

  return parsed.sort((left, right) => left.start - right.start || left.ordinal - right.ordinal);
}

/** Sort lines into timestamp groups while retaining source order within each group. */
export function groupLyricsByStart(lines: readonly ParsedLyricLine[]): LyricLineGroup[] {
  const sorted = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => Number.isFinite(line.start) && typeof line.text === "string")
    .sort((left, right) => {
      const startDifference = left.line.start - right.line.start;
      if (startDifference !== 0) return startDifference;

      const leftOrdinal = Number.isFinite(left.line.ordinal) ? left.line.ordinal : left.index;
      const rightOrdinal = Number.isFinite(right.line.ordinal) ? right.line.ordinal : right.index;
      return leftOrdinal - rightOrdinal || left.index - right.index;
    });

  const groups: LyricLineGroup[] = [];
  for (const { line } of sorted) {
    let group = groups[groups.length - 1];
    if (!group || group.start !== line.start) {
      group = { start: line.start, lines: [] };
      groups.push(group);
    }

    if (!group.lines.some((existing) => existing.text === line.text)) {
      group.lines.push(line);
    }
  }

  return groups;
}

/** Return the latest group whose start is not later than the music time. */
export function findActiveGroupIndex(groups: readonly LyricLineGroup[], musicTime: number): number {
  if (!Number.isFinite(musicTime) || groups.length === 0) return -1;

  let low = 0;
  let high = groups.length - 1;
  let activeIndex = -1;

  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    if (groups[middle].start <= musicTime) {
      activeIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return activeIndex;
}

/** Estimate lyric reveal units without allowing the final unit past the line end. */
export function estimateLineUnits(
  text: string,
  start: number,
  end: number,
  lineIndex: number
): TimedLyricUnit[] {
  if (
    typeof text !== "string" ||
    text.trim().length === 0 ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
    return [];
  }

  const duration = end - start;
  const durationTolerance = Number.EPSILON * Math.max(1, Math.abs(start), Math.abs(end)) * 4;
  if (duration < 0.18 - durationTolerance) {
    return [{ text, start, end, lineIndex }];
  }

  const weightedUnits = buildWeightedUnits(text);
  if (weightedUnits.length === 0) return [];

  const revealUnits =
    duration <= 0.45 + durationTolerance
      ? groupWeightedUnits(weightedUnits, duration < 0.3 ? 2 : 3)
      : weightedUnits;
  const totalWeight = revealUnits.reduce((sum, unit) => sum + unit.weight, 0);
  let elapsedWeight = 0;
  let unitStart = start;

  return revealUnits.map((unit, index) => {
    elapsedWeight += unit.weight;
    const unitEnd =
      index === revealUnits.length - 1 || totalWeight <= 0
        ? end
        : start + (duration * elapsedWeight) / totalWeight;
    const timedUnit = { text: unit.text, start: unitStart, end: unitEnd, lineIndex };
    unitStart = unitEnd;
    return timedUnit;
  });
}

function isMetadataLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  return (
    /^(作词|作曲|编曲|制作|混音|录音|母带|吉他|贝斯|鼓手|和声|监制|企划|文案|出品|发行|提供|翻唱|原唱|统筹|OP|SP|Written|Composed|Arranged|Produced|Mixed|Mastered|Vocals|Guitar|Bass|Drums|Engineer|Publisher|Record)[\s:：]/i.test(
      trimmed
    ) ||
    /^(作词|作曲|编曲|词曲|制作人|录音室|混音室)[\s:：]/i.test(trimmed) ||
    /^(QQ音乐|网易云音乐|酷狗|酷我|咪咕|Kugou|Netease|TME)$/i.test(trimmed)
  );
}

function createUnicodePattern(source: string): RegExp | null {
  try {
    return new RegExp(source, "u");
  } catch {
    return null;
  }
}

function segmentGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined") {
    const Segmenter = (
      Intl as unknown as {
        Segmenter?: new (
          locales?: string | string[],
          options?: { granularity: "grapheme" }
        ) => { segment: (input: string) => Iterable<{ segment: string }> };
      }
    ).Segmenter;

    if (Segmenter) {
      try {
        const segmenter = new Segmenter(undefined, { granularity: "grapheme" });
        return Array.from(segmenter.segment(text), ({ segment }) => segment);
      } catch {
        // Use the local fallback when a partial Intl implementation rejects Segmenter.
      }
    }
  }

  return segmentGraphemesFallback(text);
}

function segmentGraphemesFallback(text: string): string[] {
  const codePoints = Array.from(text);
  const graphemes: string[] = [];
  let regionalIndicatorRun = 0;

  for (const codePoint of codePoints) {
    const previous = graphemes[graphemes.length - 1];
    const previousCodePoint = previous ? Array.from(previous).at(-1) : undefined;
    const isRegionalIndicator = isRegionalIndicatorCodePoint(codePoint);
    const joinsPrevious =
      previous !== undefined &&
      (isGraphemeExtender(codePoint) ||
        codePoint === "\u200d" ||
        previousCodePoint === "\u200d" ||
        (isRegionalIndicator &&
          isRegionalIndicatorCodePoint(previousCodePoint) &&
          regionalIndicatorRun % 2 === 1));

    if (joinsPrevious) {
      graphemes[graphemes.length - 1] += codePoint;
    } else {
      graphemes.push(codePoint);
    }

    if (isRegionalIndicator) {
      regionalIndicatorRun += 1;
    } else if (!isGraphemeExtender(codePoint) && codePoint !== "\u200d") {
      regionalIndicatorRun = 0;
    }
  }

  return graphemes;
}

function isGraphemeExtender(codePoint: string): boolean {
  const value = codePoint.codePointAt(0) ?? 0;
  if (UNICODE_MARK_PATTERN?.test(codePoint)) return true;

  return (
    (value >= 0x0300 && value <= 0x036f) ||
    (value >= 0x0483 && value <= 0x0489) ||
    (value >= 0x0591 && value <= 0x05bd) ||
    value === 0x05bf ||
    (value >= 0x05c1 && value <= 0x05c2) ||
    (value >= 0x0610 && value <= 0x061a) ||
    (value >= 0x064b && value <= 0x065f) ||
    value === 0x0670 ||
    (value >= 0x06d6 && value <= 0x06ed) ||
    (value >= 0x0900 && value <= 0x0903) ||
    (value >= 0x093a && value <= 0x094f) ||
    (value >= 0x0951 && value <= 0x0957) ||
    (value >= 0x0962 && value <= 0x0963) ||
    (value >= 0x1ab0 && value <= 0x1aff) ||
    (value >= 0x1dc0 && value <= 0x1dff) ||
    (value >= 0x20d0 && value <= 0x20ff) ||
    (value >= 0xfe00 && value <= 0xfe0f) ||
    (value >= 0xfe20 && value <= 0xfe2f) ||
    (value >= 0x1f3fb && value <= 0x1f3ff) ||
    (value >= 0xe0020 && value <= 0xe007f) ||
    (value >= 0xe0100 && value <= 0xe01ef)
  );
}

function isRegionalIndicatorCodePoint(codePoint: string | undefined): boolean {
  if (!codePoint) return false;
  const value = codePoint.codePointAt(0) ?? 0;
  return value >= 0x1f1e6 && value <= 0x1f1ff;
}

function buildWeightedUnits(text: string): WeightedLyricUnit[] {
  const graphemes = segmentGraphemes(text);
  const tokens: GraphemeToken[] = [];

  for (let index = 0; index < graphemes.length; index += 1) {
    const grapheme = graphemes[index];
    const kind = classifyGrapheme(grapheme);

    if (kind === "word" && !isCjkGrapheme(grapheme)) {
      let word = grapheme;
      while (index + 1 < graphemes.length) {
        const next = graphemes[index + 1];
        const nextKind = classifyGrapheme(next);
        const connector =
          isWordConnector(next) &&
          index + 2 < graphemes.length &&
          classifyGrapheme(graphemes[index + 2]) === "word" &&
          !isCjkGrapheme(graphemes[index + 2]);

        if (nextKind === "word" && !isCjkGrapheme(next)) {
          word += next;
          index += 1;
        } else if (connector) {
          word += next + graphemes[index + 2];
          index += 2;
        } else {
          break;
        }
      }
      tokens.push({ text: word, kind: "word" });
      continue;
    }

    const previousToken = tokens[tokens.length - 1];
    if (kind === "space" && previousToken?.kind === "space") {
      previousToken.text += grapheme;
    } else {
      tokens.push({ text: grapheme, kind });
    }
  }

  return attachPunctuation(tokens);
}

function classifyGrapheme(grapheme: string): GraphemeKind {
  if (/^\s+$/u.test(grapheme)) return "space";
  if (isPunctuationGrapheme(grapheme)) return "punctuation";
  if (isCjkGrapheme(grapheme)) return "cjk";
  if (UNICODE_WORD_PATTERN?.test(grapheme) || isFallbackWordGrapheme(grapheme)) {
    return "word";
  }
  return "symbol";
}

function isPunctuationGrapheme(grapheme: string): boolean {
  if (UNICODE_PUNCTUATION_PATTERN?.test(grapheme)) return true;
  return /^[!-/:-@[-`{-~，。！？、；：…—–「」『』（）［］｛｝《》〈〉【】〔〕〖〗〘〙〚〛“”‘’‹›«»]+$/u.test(
    grapheme
  );
}

function isCjkGrapheme(grapheme: string): boolean {
  const value = grapheme.codePointAt(0) ?? 0;
  return (
    (value >= 0x2e80 && value <= 0x2fff) ||
    (value >= 0x3040 && value <= 0x30ff) ||
    (value >= 0x3100 && value <= 0x312f) ||
    (value >= 0x31a0 && value <= 0x31bf) ||
    (value >= 0x31f0 && value <= 0x31ff) ||
    (value >= 0x3400 && value <= 0x4dbf) ||
    (value >= 0x4e00 && value <= 0x9fff) ||
    (value >= 0xac00 && value <= 0xd7af) ||
    (value >= 0xf900 && value <= 0xfaff) ||
    (value >= 0x20000 && value <= 0x323af)
  );
}

function isFallbackWordGrapheme(grapheme: string): boolean {
  const value = grapheme.codePointAt(0) ?? 0;
  return (
    (value >= 0x30 && value <= 0x39) ||
    (value >= 0x41 && value <= 0x5a) ||
    (value >= 0x61 && value <= 0x7a) ||
    (value >= 0x00c0 && value <= 0x02ff) ||
    (value >= 0x0370 && value <= 0x052f) ||
    (value >= 0x0531 && value <= 0x1fff) ||
    (value >= 0x2c00 && value <= 0x2dff) ||
    (value >= 0xa640 && value <= 0xa69f) ||
    (value >= 0xff10 && value <= 0xff5a)
  );
}

function isWordConnector(grapheme: string): boolean {
  return ["'", "’", "-", "‐", "‑"].includes(grapheme);
}

function attachPunctuation(tokens: readonly GraphemeToken[]): WeightedLyricUnit[] {
  const units: WeightedLyricUnit[] = [];
  let pendingPrefix = "";

  for (const token of tokens) {
    if (token.kind === "punctuation") {
      if (OPENING_PUNCTUATION.has(token.text)) {
        pendingPrefix += token.text;
      } else if (units.length > 0) {
        const previous = units[units.length - 1];
        previous.text += token.text;
        previous.weight += pauseWeight(token.text);
      } else {
        pendingPrefix += token.text;
      }
      continue;
    }

    if (token.kind === "space") {
      if (units.length > 0) {
        units[units.length - 1].text += token.text;
      } else {
        pendingPrefix += token.text;
      }
      continue;
    }

    const text = `${pendingPrefix}${token.text}`;
    pendingPrefix = "";
    const baseWeight =
      token.kind === "word" ? Math.max(1, segmentGraphemes(token.text).length * 0.45) : 1;
    units.push({ text, weight: baseWeight });
  }

  if (pendingPrefix) {
    if (units.length > 0) {
      units[units.length - 1].text += pendingPrefix;
    } else {
      units.push({ text: pendingPrefix, weight: 1 });
    }
  }

  return units;
}

function pauseWeight(punctuation: string): number {
  return PAUSE_WEIGHTS.find(([symbol]) => symbol === punctuation)?.[1] ?? 0.25;
}

function groupWeightedUnits(
  units: readonly WeightedLyricUnit[],
  desiredGroupCount: number
): WeightedLyricUnit[] {
  const groupCount = Math.min(units.length, desiredGroupCount);
  if (groupCount <= 1) return [{ ...units[0] }];

  const groups: WeightedLyricUnit[] = [];
  for (let index = 0; index < units.length; index += 1) {
    const groupIndex = Math.floor((index * groupCount) / units.length);
    const unit = units[index];
    const existing = groups[groupIndex];
    if (existing) {
      existing.text += unit.text;
      existing.weight += unit.weight;
    } else {
      groups[groupIndex] = { ...unit };
    }
  }

  return groups;
}
