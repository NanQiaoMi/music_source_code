export interface LyricLayoutUnit {
  text: string;
  start: number;
  end: number;
  lineIndex: number;
}

export interface LyricLayoutOptions {
  maxWidth: number;
  fontSize: number;
  /** Font family whose metrics the measurement callback represents. */
  fontFamily: string;
  seed: string | number;
  measureText: (text: string, fontSize: number) => number;
}

export interface LyricLayoutItem extends LyricLayoutUnit {
  x: number;
  y: number;
  rowIndex: number;
  fontSize: number;
  width: number;
}

interface UnitLayout {
  lines: string[];
  fontSize: number;
}

const MAX_ROWS_PER_UNIT = 5;
const SAFE_MARGIN_RATIO = 0.08;
const MAX_SAFE_MARGIN = 24;
const ROW_HEIGHT_RATIO = 1.32;
const HORIZONTAL_STAGGER_RATIO = 0.06;
const VERTICAL_STAGGER_RATIO = 0.06;

const graphemeSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter !== "undefined"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;

const segmentGraphemes = (text: string): string[] => {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), (part) => part.segment);
  }

  return Array.from(text);
};

const isWhitespace = (grapheme: string): boolean => /^\s+$/u.test(grapheme);
const isPunctuation = (grapheme: string): boolean => /^\p{P}+$/u.test(grapheme);
const isWordCharacter = (grapheme: string): boolean => /[\p{L}\p{N}\p{M}_]/u.test(grapheme);

const tokenizeText = (text: string): string[] => {
  const tokens: string[] = [];
  let currentWord = "";

  const flushWord = (): void => {
    if (currentWord) {
      tokens.push(currentWord);
      currentWord = "";
    }
  };

  for (const grapheme of segmentGraphemes(text)) {
    if (isWhitespace(grapheme)) {
      flushWord();
      if (tokens.length > 0) {
        tokens[tokens.length - 1] += grapheme;
      } else {
        tokens.push(grapheme);
      }
      continue;
    }

    if (isWordCharacter(grapheme)) {
      currentWord += grapheme;
      continue;
    }

    if (isPunctuation(grapheme)) {
      if (currentWord) {
        currentWord += grapheme;
      } else if (tokens.length > 0) {
        tokens[tokens.length - 1] += grapheme;
      } else {
        tokens.push(grapheme);
      }
      continue;
    }

    flushWord();
    tokens.push(grapheme);
  }

  flushWord();
  return tokens;
};

const makeBreakableUnits = (token: string): string[] => {
  const units: string[] = [];

  for (const grapheme of segmentGraphemes(token)) {
    if (isPunctuation(grapheme) && units.length > 0) {
      units[units.length - 1] += grapheme;
    } else {
      units.push(grapheme);
    }
  }

  return units;
};

const measure = (
  text: string,
  fontSize: number,
  measureText: LyricLayoutOptions["measureText"]
): number => {
  const width = measureText(text, fontSize);
  return Number.isFinite(width) ? Math.max(0, width) : 0;
};

const wrapText = (
  text: string,
  maxWidth: number,
  fontSize: number,
  measureText: LyricLayoutOptions["measureText"]
): string[] => {
  const lines: string[] = [];
  let currentLine = "";

  const pushCurrentLine = (): void => {
    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }
  };

  for (const token of tokenizeText(text)) {
    if (measure(currentLine + token, fontSize, measureText) <= maxWidth) {
      currentLine += token;
      continue;
    }

    pushCurrentLine();

    if (measure(token, fontSize, measureText) <= maxWidth) {
      currentLine = token;
      continue;
    }

    for (const unit of makeBreakableUnits(token)) {
      if (currentLine && measure(currentLine + unit, fontSize, measureText) > maxWidth) {
        pushCurrentLine();
      }
      currentLine += unit;
    }
  }

  if (currentLine || lines.length === 0) {
    lines.push(currentLine);
  }

  return lines;
};

const allLinesFit = (
  lines: string[],
  maxWidth: number,
  fontSize: number,
  measureText: LyricLayoutOptions["measureText"]
): boolean =>
  lines.length <= MAX_ROWS_PER_UNIT &&
  lines.every((line) => measure(line, fontSize, measureText) <= maxWidth);

const layoutUnit = (
  text: string,
  maxWidth: number,
  requestedFontSize: number,
  measureText: LyricLayoutOptions["measureText"]
): UnitLayout => {
  const originalLines = wrapText(text, maxWidth, requestedFontSize, measureText);
  if (allLinesFit(originalLines, maxWidth, requestedFontSize, measureText)) {
    return { lines: originalLines, fontSize: requestedFontSize };
  }

  const minimumFontSize = Math.min(requestedFontSize, Math.max(requestedFontSize / 128, 0.25));
  let bestFontSize = minimumFontSize;
  let bestLines = wrapText(text, maxWidth, minimumFontSize, measureText);
  let low = minimumFontSize;
  let high = requestedFontSize;

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidateFontSize = (low + high) / 2;
    const candidateLines = wrapText(text, maxWidth, candidateFontSize, measureText);

    if (allLinesFit(candidateLines, maxWidth, candidateFontSize, measureText)) {
      bestFontSize = candidateFontSize;
      bestLines = candidateLines;
      low = candidateFontSize;
    } else {
      high = candidateFontSize;
    }
  }

  return { lines: bestLines, fontSize: bestFontSize };
};

const stableUnitInterval = (seed: string | number, rowIndex: number, axis: string): number => {
  const value = `${String(seed)}| ${rowIndex}| ${axis}`;
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0xffffffff;
};

const jitter = (seed: string | number, rowIndex: number, axis: string, amount: number): number =>
  (stableUnitInterval(seed, rowIndex, axis) * 2 - 1) * amount;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export const layoutLyricUnits = (
  units: readonly LyricLayoutUnit[],
  options: LyricLayoutOptions
): LyricLayoutItem[] => {
  const maxWidth = Number.isFinite(options.maxWidth) ? Math.max(0, options.maxWidth) : 0;
  const requestedFontSize =
    Number.isFinite(options.fontSize) && options.fontSize > 0 ? options.fontSize : 16;
  const safeMargin = Math.min(maxWidth * SAFE_MARGIN_RATIO, MAX_SAFE_MARGIN);
  const contentWidth = Math.max(0, maxWidth - safeMargin * 2);
  const rows: Array<{
    unit: LyricLayoutUnit;
    text: string;
    fontSize: number;
  }> = [];

  for (const unit of units) {
    const layout = layoutUnit(unit.text, contentWidth, requestedFontSize, options.measureText);
    for (const text of layout.lines) {
      rows.push({ unit, text, fontSize: layout.fontSize });
    }
  }

  const totalRows = rows.length;
  const rowHeight = requestedFontSize * ROW_HEIGHT_RATIO;

  return rows.map(({ unit, text, fontSize }, rowIndex) => {
    const width = measure(text, fontSize, options.measureText);
    const centeredX = (maxWidth - width) / 2;
    const horizontalJitter = jitter(
      options.seed,
      rowIndex,
      "x",
      Math.min(contentWidth * HORIZONTAL_STAGGER_RATIO, 18)
    );
    const maxX = Math.max(safeMargin, maxWidth - safeMargin - width);
    const x = clamp(centeredX + horizontalJitter, safeMargin, maxX);
    const centeredY = (rowIndex - (totalRows - 1) / 2) * rowHeight;
    const verticalJitter = jitter(
      options.seed,
      rowIndex,
      "y",
      Math.min(fontSize * VERTICAL_STAGGER_RATIO, rowHeight * 0.08)
    );

    return {
      ...unit,
      text,
      x,
      y: centeredY + verticalJitter,
      rowIndex,
      fontSize,
      width,
    };
  });
};
