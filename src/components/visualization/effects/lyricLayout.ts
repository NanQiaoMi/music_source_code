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

interface UnitGroup {
  indexes: number[];
}

interface PackedRow {
  groupIndexes: number[];
  width: number;
}

interface PackedLayout {
  groups: UnitGroup[];
  rows: PackedRow[];
  unitWidths: number[];
  fontSize: number;
  fits: boolean;
}

interface UnitPosition {
  x: number;
  y: number;
  rowIndex: number;
  width: number;
}

const MAX_ROWS = 5;
const MIN_ROWS = 2;
const SAFE_MARGIN_RATIO = 0.08;
const MAX_SAFE_MARGIN = 24;
const ROW_HEIGHT_RATIO = 1.32;
const HORIZONTAL_STAGGER_RATIO = 0.06;
const VERTICAL_STAGGER_RATIO = 0.06;
const ROW_FILL_RATIO = 0.72;
const LATIN_WORD_GAP_RATIO = 0.2;

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

const isPunctuation = (grapheme: string): boolean => /^\p{P}+$/u.test(grapheme);
const isOnlyPunctuation = (text: string): boolean => {
  const graphemes = segmentGraphemes(text);
  return graphemes.length > 0 && graphemes.every(isPunctuation);
};
const isOnlyWhitespace = (text: string): boolean => /^\s+$/u.test(text);
const containsCjk = (text: string): boolean =>
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(text);

const firstGrapheme = (text: string): string => segmentGraphemes(text)[0] ?? "";

const measure = (
  text: string,
  fontSize: number,
  measureText: LyricLayoutOptions["measureText"]
): number => {
  const width = measureText(text, fontSize);
  return Number.isFinite(width) ? Math.max(0, width) : 0;
};

const gapBetweenUnits = (
  previous: LyricLayoutUnit,
  next: LyricLayoutUnit,
  fontSize: number
): number => {
  if (/\s$/u.test(previous.text) || /^\s/u.test(next.text)) {
    return 0;
  }

  if (isPunctuation(firstGrapheme(next.text))) {
    return 0;
  }

  const previousHasCjk = containsCjk(previous.text);
  const nextHasCjk = containsCjk(next.text);
  if (previousHasCjk && nextHasCjk) {
    return 0;
  }

  if (isOnlyPunctuation(previous.text) && nextHasCjk) {
    return 0;
  }

  return fontSize * LATIN_WORD_GAP_RATIO;
};

const groupTimedUnits = (units: readonly LyricLayoutUnit[]): UnitGroup[] => {
  const groups: UnitGroup[] = [];

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const attachesToPrevious = isOnlyPunctuation(unit.text) || isOnlyWhitespace(unit.text);

    if (attachesToPrevious && groups.length > 0) {
      groups[groups.length - 1].indexes.push(index);
    } else {
      groups.push({ indexes: [index] });
    }
  }

  return groups;
};

const getGroupWidth = (
  group: UnitGroup,
  units: readonly LyricLayoutUnit[],
  unitWidths: number[],
  fontSize: number
): number => {
  let width = 0;

  for (let index = 0; index < group.indexes.length; index += 1) {
    const unitIndex = group.indexes[index];
    if (index > 0) {
      const previousIndex = group.indexes[index - 1];
      width += gapBetweenUnits(units[previousIndex], units[unitIndex], fontSize);
    }
    width += unitWidths[unitIndex];
  }

  return width;
};

const packGroups = (
  groups: UnitGroup[],
  units: readonly LyricLayoutUnit[],
  unitWidths: number[],
  contentWidth: number,
  fontSize: number
): { rows: PackedRow[]; fits: boolean } => {
  if (groups.length === 0) {
    return { rows: [], fits: true };
  }

  const groupWidths = groups.map((group) => getGroupWidth(group, units, unitWidths, fontSize));
  const groupGaps = groups.map((group, index) => {
    if (index === 0) {
      return 0;
    }

    const previousGroup = groups[index - 1];
    const previousUnitIndex = previousGroup.indexes[previousGroup.indexes.length - 1];
    const nextUnitIndex = group.indexes[0];
    return gapBetweenUnits(units[previousUnitIndex], units[nextUnitIndex], fontSize);
  });
  const totalWidth = groupWidths.reduce((sum, width, index) => sum + width + groupGaps[index], 0);
  const maxRows = Math.min(MAX_ROWS, groups.length);
  const minimumRows = Math.min(MIN_ROWS, maxRows);
  const estimatedRows = Math.ceil(totalWidth / Math.max(contentWidth * ROW_FILL_RATIO, 1));
  const targetRows = Math.min(maxRows, Math.max(minimumRows, estimatedRows));
  const targetRowWidth = totalWidth / targetRows;
  const rows: PackedRow[] = [{ groupIndexes: [], width: 0 }];
  let fits = true;

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    let row = rows[rows.length - 1];
    const groupWidth = groupWidths[groupIndex];
    const previousGroupIndex = row.groupIndexes[row.groupIndexes.length - 1];
    const gap =
      previousGroupIndex === undefined
        ? 0
        : gapBetweenUnits(
            units[groups[previousGroupIndex].indexes.at(-1) ?? 0],
            units[groups[groupIndex].indexes[0]],
            fontSize
          );
    const wouldOverflow = row.width + gap + groupWidth > contentWidth;
    const groupsRemaining = groups.length - groupIndex;
    const rowsRemaining = targetRows - rows.length;
    const reserveRowForRemainingGroups =
      row.groupIndexes.length > 0 && rows.length < targetRows && groupsRemaining <= rowsRemaining;
    const reachedTargetWidth = row.groupIndexes.length > 0 && row.width >= targetRowWidth;
    const canStartRow = rows.length < maxRows;

    if (
      row.groupIndexes.length > 0 &&
      canStartRow &&
      (wouldOverflow ||
        reserveRowForRemainingGroups ||
        (rows.length < targetRows && reachedTargetWidth))
    ) {
      row = { groupIndexes: [], width: 0 };
      rows.push(row);
    }

    const rowPreviousGroupIndex = row.groupIndexes[row.groupIndexes.length - 1];
    const rowGap =
      rowPreviousGroupIndex === undefined
        ? 0
        : gapBetweenUnits(
            units[groups[rowPreviousGroupIndex].indexes.at(-1) ?? 0],
            units[groups[groupIndex].indexes[0]],
            fontSize
          );

    if (groupWidth > contentWidth || row.width + rowGap + groupWidth > contentWidth) {
      fits = false;
    }

    row.groupIndexes.push(groupIndex);
    row.width += rowGap + groupWidth;
  }

  if (rows.length > MAX_ROWS) {
    fits = false;
  }

  return { rows, fits };
};

const createPackedLayout = (
  units: readonly LyricLayoutUnit[],
  contentWidth: number,
  fontSize: number,
  measureText: LyricLayoutOptions["measureText"]
): PackedLayout => {
  const groups = groupTimedUnits(units);
  const unitWidths = units.map((unit) => measure(unit.text, fontSize, measureText));
  const packed = packGroups(groups, units, unitWidths, contentWidth, fontSize);

  return {
    groups,
    rows: packed.rows,
    unitWidths,
    fontSize,
    fits: packed.fits,
  };
};

const fitUnitsToRows = (
  units: readonly LyricLayoutUnit[],
  contentWidth: number,
  requestedFontSize: number,
  measureText: LyricLayoutOptions["measureText"]
): PackedLayout => {
  const initial = createPackedLayout(units, contentWidth, requestedFontSize, measureText);
  if (initial.fits) {
    return initial;
  }

  const minimumFontSize = Math.min(requestedFontSize, Math.max(requestedFontSize / 4096, 0.01));
  let low = minimumFontSize;
  let high = requestedFontSize;
  let best = createPackedLayout(units, contentWidth, minimumFontSize, measureText);

  for (let attempt = 0; attempt < 36; attempt += 1) {
    const candidateFontSize = (low + high) / 2;
    const candidate = createPackedLayout(units, contentWidth, candidateFontSize, measureText);

    if (candidate.fits) {
      best = candidate;
      low = candidateFontSize;
    } else {
      high = candidateFontSize;
    }
  }

  return best;
};

const stableUnitInterval = (seed: string | number, index: number, axis: string): number => {
  const value = `${String(seed)}|${index}|${axis}`;
  let hash = 2166136261;

  for (let position = 0; position < value.length; position += 1) {
    hash ^= value.charCodeAt(position);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0xffffffff;
};

const jitter = (seed: string | number, index: number, axis: string, amount: number): number =>
  (stableUnitInterval(seed, index, axis) * 2 - 1) * amount;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

/**
 * Packs ordered timed units into at most five short visual rows, targeting two or more for multiple layout groups.
 * Oversized units are fit by reducing the shared font size, so timed text is never split or duplicated.
 */
export const layoutLyricUnits = (
  units: readonly LyricLayoutUnit[],
  options: LyricLayoutOptions
): LyricLayoutItem[] => {
  if (units.length === 0) {
    return [];
  }

  const maxWidth = Number.isFinite(options.maxWidth) ? Math.max(0, options.maxWidth) : 0;
  const requestedFontSize =
    Number.isFinite(options.fontSize) && options.fontSize > 0 ? options.fontSize : 16;
  const safeMargin = Math.min(maxWidth * SAFE_MARGIN_RATIO, MAX_SAFE_MARGIN);
  const contentWidth = Math.max(0, maxWidth - safeMargin * 2);
  const layout = fitUnitsToRows(units, contentWidth, requestedFontSize, options.measureText);
  const rowOfUnit = new Array<number>(units.length);
  const positions = new Array<UnitPosition>(units.length);
  const rowHeight = requestedFontSize * ROW_HEIGHT_RATIO;
  let flatUnitIndex = 0;

  for (let rowIndex = 0; rowIndex < layout.rows.length; rowIndex += 1) {
    const row = layout.rows[rowIndex];
    const horizontalJitter = jitter(
      options.seed,
      rowIndex,
      "x",
      Math.min(contentWidth * HORIZONTAL_STAGGER_RATIO, 18)
    );
    const maxRowX = Math.max(safeMargin, maxWidth - safeMargin - row.width);
    const rowX = clamp(
      safeMargin + (contentWidth - row.width) / 2 + horizontalJitter,
      safeMargin,
      maxRowX
    );
    const centeredY = (rowIndex - (layout.rows.length - 1) / 2) * rowHeight;
    let cursorX = rowX;
    let previousUnitIndex: number | undefined;

    for (const groupIndex of row.groupIndexes) {
      const group = layout.groups[groupIndex];
      for (const unitIndex of group.indexes) {
        const unit = units[unitIndex];
        if (previousUnitIndex !== undefined) {
          cursorX += gapBetweenUnits(units[previousUnitIndex], unit, layout.fontSize);
        }

        rowOfUnit[unitIndex] = rowIndex;
        positions[unitIndex] = {
          x: cursorX,
          y:
            centeredY +
            jitter(
              options.seed,
              flatUnitIndex,
              "y",
              Math.min(layout.fontSize * VERTICAL_STAGGER_RATIO, rowHeight * 0.08)
            ),
          rowIndex,
          width: layout.unitWidths[unitIndex],
        };
        cursorX += layout.unitWidths[unitIndex];
        previousUnitIndex = unitIndex;
        flatUnitIndex += 1;
      }
    }
  }

  return units.map((unit, index) => {
    const position = positions[index];
    return {
      ...unit,
      x: position?.x ?? safeMargin,
      y: position?.y ?? 0,
      rowIndex: rowOfUnit[index] ?? 0,
      fontSize: layout.fontSize,
      width: position?.width ?? measure(unit.text, layout.fontSize, options.measureText),
    };
  });
};
