import type { TimedLyricUnit } from "./lyricTimeline";
import { segmentLyricFilmGraphemes } from "./lyricFilmComposition";

export interface HandwrittenLayoutUnit {
  text: string;
  width: number;
  start: number;
  end: number;
  scaleBoost?: number;
}

export interface HandwrittenLayoutLine {
  items: HandwrittenLayoutUnit[];
  width: number;
}

export interface HandwrittenLayoutEmphasis {
  unitIndex: number;
  unitCount: number;
  scaleBoost: number;
}

const MAX_BALANCED_ITEM_COUNT = 256;
const MAX_BALANCED_LINE_COUNT = 3;

function startsWithClosingPunctuation(text: string): boolean {
  return /^[\u3001\u3002\uff01\uff1f\uff0c\uff1b\uff1a,.!?;:)\]}<>\u300b\u3009\u300f\u201d\u2019\u2026\u2014]/u.test(
    text
  );
}

function endsWithOpeningPunctuation(text: string): boolean {
  return /[([{\u3010\u300a\u300c\u300e\u201c\u2018]$/u.test(text);
}

/** Split only a timed unit that cannot fit on a line; preserve its full LRC span. */
export function prepareHandwrittenUnits(
  units: readonly TimedLyricUnit[],
  maxWidth: number,
  measure: (text: string) => number
): HandwrittenLayoutUnit[] {
  const prepared: HandwrittenLayoutUnit[] = [];

  for (const unit of units) {
    const width = Math.max(0, measure(unit.text));
    const graphemes = segmentLyricFilmGraphemes(unit.text);
    if (width <= maxWidth || graphemes.length < 2) {
      prepared.push({ text: unit.text, width, start: unit.start, end: unit.end });
      continue;
    }

    const widths = graphemes.map((grapheme) => Math.max(0, measure(grapheme)));
    const totalWidth = widths.reduce((sum, itemWidth) => sum + itemWidth, 0);
    const span = Math.max(0, unit.end - unit.start);
    let elapsedWidth = 0;
    graphemes.forEach((grapheme, index) => {
      const itemWidth = widths[index] ?? 0;
      const start =
        totalWidth > 0
          ? unit.start + (span * elapsedWidth) / totalWidth
          : unit.start + (span * index) / graphemes.length;
      elapsedWidth += itemWidth;
      const end =
        index === graphemes.length - 1
          ? unit.end
          : totalWidth > 0
            ? unit.start + (span * elapsedWidth) / totalWidth
            : unit.start + (span * (index + 1)) / graphemes.length;
      prepared.push({ text: grapheme, width: itemWidth, start, end });
    });
  }

  return prepared;
}

/** Layout static title/translation copy as grapheme units without dropping any source text. */
export function layoutHandwrittenPlainText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number
): HandwrittenLayoutLine[] {
  const units = segmentLyricFilmGraphemes(text).map((grapheme, index) => ({
    text: grapheme,
    width: Math.max(0, measure(grapheme)),
    start: index,
    end: index + 1,
  }));
  return wrapHandwrittenPhrase(units, maxWidth, null);
}

/** Wrap measured units while reserving visual scale and keeping emphasis with its phrase. */
export function wrapHandwrittenPhrase(
  units: readonly HandwrittenLayoutUnit[],
  maxWidth: number,
  emphasis: HandwrittenLayoutEmphasis | null
): HandwrittenLayoutLine[] {
  const lines: HandwrittenLayoutLine[] = [];
  let lineItems: HandwrittenLayoutUnit[] = [];
  let lineWidth = 0;

  const scaleAt = (index: number) =>
    Math.min(
      emphasis && index >= emphasis.unitIndex && index < emphasis.unitIndex + emphasis.unitCount
        ? Math.max(1, emphasis.scaleBoost)
        : 1,
      maxWidth / Math.max(1, units[index]?.width ?? 0)
    );
  const advanceAt = (index: number) => (units[index]?.width ?? 0) * scaleAt(index);
  const withScale = (unit: HandwrittenLayoutUnit, scale: number): HandwrittenLayoutUnit => ({
    ...unit,
    ...(Math.abs(scale - 1) > 0.001 ? { scaleBoost: scale } : {}),
  });
  const pushLine = () => {
    if (lineItems.length === 0) return;
    lines.push({ items: lineItems, width: lineWidth });
    lineItems = [];
    lineWidth = 0;
  };

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index]!;
    const advance = advanceAt(index);
    const emphasisStarts = emphasis?.unitIndex === index;
    let emphasisWidth = 0;
    if (emphasisStarts && emphasis) {
      for (let offset = 0; offset < emphasis.unitCount; offset += 1) {
        emphasisWidth += advanceAt(index + offset);
      }
    }

    const overflow = lineWidth + advance > maxWidth;
    const keepsOpeningMarkWithNext =
      overflow && endsWithOpeningPunctuation(lineItems.at(-1)?.text ?? "");
    if (
      lineItems.length > 0 &&
      (overflow ||
        (emphasisStarts && emphasisWidth <= maxWidth && lineWidth + emphasisWidth > maxWidth))
    ) {
      // Keep a closing mark beside the glyph before it when the pair fits. Move that glyph
      // forward instead of allowing punctuation to push the line outside the safe measure.
      if (startsWithClosingPunctuation(unit.text) && lineItems.length > 1) {
        const previous = lineItems.pop()!;
        lineWidth -= previous.width * (previous.scaleBoost ?? 1);
        pushLine();
        const pairWidth = advanceAt(index - 1) + advance;
        const pairScale = Math.min(1, maxWidth / Math.max(1, pairWidth));
        const previousItem = withScale(previous, scaleAt(index - 1) * pairScale);
        const punctuationItem = withScale(unit, scaleAt(index) * pairScale);
        lineItems.push(previousItem, punctuationItem);
        lineWidth =
          previous.width * (previousItem.scaleBoost ?? 1) +
          unit.width * (punctuationItem.scaleBoost ?? 1);
        continue;
      }
      if (startsWithClosingPunctuation(unit.text) && lineItems.length === 1) {
        const previous = lineItems[0]!;
        const pairWidth = previous.width * (previous.scaleBoost ?? 1) + advance;
        const shrink = maxWidth / Math.max(1, pairWidth);
        const previousItem = withScale(previous, (previous.scaleBoost ?? 1) * shrink);
        const punctuationItem = withScale(unit, scaleAt(index) * shrink);
        lineItems = [previousItem, punctuationItem];
        lineWidth = maxWidth;
        continue;
      }
      if (keepsOpeningMarkWithNext && lineItems.length > 1) {
        const openingMark = lineItems.pop()!;
        lineWidth -= openingMark.width * (openingMark.scaleBoost ?? 1);
        pushLine();
        const pairWidth = advanceAt(index - 1) + advance;
        const pairScale = Math.min(1, maxWidth / Math.max(1, pairWidth));
        const openingItem = withScale(openingMark, scaleAt(index - 1) * pairScale);
        const followingItem = withScale(unit, scaleAt(index) * pairScale);
        lineItems.push(openingItem, followingItem);
        lineWidth =
          openingMark.width * (openingItem.scaleBoost ?? 1) +
          unit.width * (followingItem.scaleBoost ?? 1);
        continue;
      }
      if (keepsOpeningMarkWithNext && lineItems.length === 1) {
        const openingMark = lineItems[0]!;
        const pairWidth = lineWidth + advance;
        const shrink = maxWidth / Math.max(1, pairWidth);
        const openingItem = withScale(openingMark, (openingMark.scaleBoost ?? 1) * shrink);
        const followingItem = withScale(unit, scaleAt(index) * shrink);
        lineItems = [openingItem, followingItem];
        lineWidth = maxWidth;
        continue;
      }
      pushLine();
    }

    const scaleBoost = scaleAt(index);
    const item = withScale(unit, scaleBoost);
    lineItems.push(item);
    lineWidth += advance;
  }

  pushLine();

  if (lines.length > 1 && lines.at(-1)?.items.length === 1) {
    const last = lines.at(-1)!;
    const previous = lines.at(-2)!;
    if (previous.width + last.width <= maxWidth) {
      previous.items.push(...last.items);
      previous.width += last.width;
      lines.pop();
    }
  }

  return balanceHandwrittenLines(lines, maxWidth, emphasis);
}

/**
 * Reflow the final measured units into a compact editorial block. Greedy wrapping can leave a
 * nearly full first row followed by one glyph; this pass keeps the same timed items and moves
 * only line breaks, preferring phrase pauses while balancing the row widths.
 */
function balanceHandwrittenLines(
  greedyLines: readonly HandwrittenLayoutLine[],
  maxWidth: number,
  emphasis: HandwrittenLayoutEmphasis | null
): HandwrittenLayoutLine[] {
  const items = greedyLines.flatMap((line) => line.items);
  if (items.length < 2 || !Number.isFinite(maxWidth) || maxWidth <= 0) return [...greedyLines];

  const advances = items.map((item) => item.width * (item.scaleBoost ?? 1));
  const prefix = [0];
  advances.forEach((advance) => prefix.push(prefix[prefix.length - 1]! + advance));
  const totalWidth = prefix.at(-1) ?? 0;
  if (totalWidth <= maxWidth * 0.68) return [...greedyLines];

  const phrasePauseCount = items
    .slice(0, -1)
    .filter(
      (item) => /\s$/u.test(item.text) || startsWithClosingPunctuation(item.text.slice(-1))
    ).length;
  const minimumLineCount = Math.max(1, Math.ceil(totalWidth / maxWidth));
  const widthDrivenLineCount = Math.ceil(totalWidth / (maxWidth * 0.78));
  const phraseDrivenLineCount = totalWidth > maxWidth * 0.8 && phrasePauseCount >= 2 ? 3 : 1;
  const lineCount = Math.max(
    minimumLineCount,
    Math.min(3, widthDrivenLineCount),
    phraseDrivenLineCount
  );
  if (
    lineCount <= 1 ||
    lineCount > MAX_BALANCED_LINE_COUNT ||
    items.length > MAX_BALANCED_ITEM_COUNT ||
    lineCount > items.length
  ) {
    return [...greedyLines];
  }

  const wordBreaks = resolveWordBreakBoundaries(items);

  const emphasisEnd = emphasis ? emphasis.unitIndex + emphasis.unitCount : -1;
  const emphasisWidth = emphasis
    ? advances.slice(emphasis.unitIndex, emphasisEnd).reduce((sum, advance) => sum + advance, 0)
    : 0;
  const canKeepEmphasisTogether = emphasisWidth <= maxWidth;
  const targetWidth = totalWidth / lineCount;

  const solve = (preservePhrasePairs: boolean): number[] | null => {
    type Path = { cost: number; breaks: number[] };
    let previous: Array<Path | null> = Array(items.length + 1).fill(null);
    previous[0] = { cost: 0, breaks: [] };

    for (let row = 1; row <= lineCount; row += 1) {
      const current: Array<Path | null> = Array(items.length + 1).fill(null);
      const minimumEnd = row;
      const maximumEnd = items.length - (lineCount - row);

      for (let end = minimumEnd; end <= maximumEnd; end += 1) {
        for (let start = row - 1; start < end; start += 1) {
          const prior = previous[start];
          if (!prior) continue;

          const lineWidth = prefix[end]! - prefix[start]!;
          if (lineWidth > maxWidth + 0.001) continue;

          if (end < items.length) {
            if (preservePhrasePairs) {
              if (
                canKeepEmphasisTogether &&
                emphasis &&
                end > emphasis.unitIndex &&
                end < emphasisEnd
              ) {
                continue;
              }

              const previousText = items[end - 1]?.text ?? "";
              const nextText = items[end]?.text ?? "";
              const punctuationPairWidth = advances[end - 1]! + advances[end]!;
              if (
                punctuationPairWidth <= maxWidth + 0.001 &&
                (startsWithClosingPunctuation(nextText) || endsWithOpeningPunctuation(previousText))
              ) {
                continue;
              }
            }
          }

          const normalizedDifference = (lineWidth - targetWidth) / Math.max(1, targetWidth);
          let breakPenalty = 0;
          if (end < items.length) {
            const previousText = items[end - 1]?.text ?? "";
            const nextText = items[end]?.text ?? "";
            const naturalPause =
              /\s$/u.test(previousText) ||
              startsWithClosingPunctuation(previousText.slice(-1)) ||
              endsWithOpeningPunctuation(previousText);
            const adjacentLatinWord =
              /[\p{Script=Latin}\p{N}]$/u.test(previousText) &&
              /^[\p{Script=Latin}\p{N}]/u.test(nextText);
            breakPenalty = naturalPause
              ? 0
              : wordBreaks.has(end)
                ? adjacentLatinWord
                  ? 0.04
                  : 0.025
                : adjacentLatinWord
                  ? 0.78
                  : 0.72;
            if (
              !canKeepEmphasisTogether &&
              emphasis &&
              end > emphasis.unitIndex &&
              end < emphasisEnd
            ) {
              breakPenalty += 0.22;
            }
          }

          const cost = prior.cost + normalizedDifference ** 2 + breakPenalty;
          const existing = current[end];
          if (!existing || cost < existing.cost) {
            current[end] = { cost, breaks: [...prior.breaks, end] };
          }
        }
      }

      previous = current;
    }

    return previous[items.length]?.breaks ?? null;
  };

  const breaks = solve(true) ?? solve(false);
  if (!breaks || breaks.length !== lineCount) return [...greedyLines];

  const balanced: HandwrittenLayoutLine[] = [];
  let start = 0;
  for (const end of breaks) {
    const lineItems = items.slice(start, end);
    balanced.push({
      items: lineItems,
      width: lineItems.reduce((sum, item) => sum + item.width * (item.scaleBoost ?? 1), 0),
    });
    start = end;
  }
  return balanced;
}

/** Word boundaries let CJK phrases stay intact even though their timing is per grapheme. */
function resolveWordBreakBoundaries(items: readonly HandwrittenLayoutUnit[]): Set<number> {
  const text = items.map((item) => item.text).join("");
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        locales?: string | string[],
        options?: { granularity: "word" }
      ) => {
        segment: (
          input: string
        ) => Iterable<{ segment: string; index: number; isWordLike?: boolean }>;
      };
    }
  ).Segmenter;
  if (!Segmenter || text.length === 0) return new Set();

  try {
    const segmenter = new Segmenter(["zh", "en"], { granularity: "word" });
    const segmentEnds = new Set(
      Array.from(segmenter.segment(text), ({ segment, index }) => index + segment.length)
    );
    const boundaries = new Set<number>();
    let offset = 0;
    items.forEach((item, index) => {
      offset += item.text.length;
      if (segmentEnds.has(offset)) boundaries.add(index + 1);
    });
    return boundaries;
  } catch {
    return new Set();
  }
}
