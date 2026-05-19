import type { SmartPlaylistRule } from "@/store/smartPlaylistStore";
import type { Song } from "@/types/song";

export type RuleEmotionMap = Record<string, { x: number; y: number } | undefined>;

function textValue(song: Song, field: SmartPlaylistRule["field"]): string {
  if (field === "title") return song.title || "";
  if (field === "artist") return song.artist || "";
  if (field === "album") return song.album || "";
  if (field === "genre") return song.genre || "";
  return "";
}

function numberValue(song: Song, field: SmartPlaylistRule["field"]): number {
  if (field === "duration") return song.duration || 0;
  if (field === "playCount") return song.playCount || 0;
  if (field === "addedTime") return song.addedAt || 0;
  return 0;
}

function matchesText(
  actual: string,
  operator: SmartPlaylistRule["operator"],
  expected: string
): boolean {
  const left = actual.toLowerCase();
  const right = expected.toLowerCase();
  if (operator === "contains") return left.includes(right);
  if (operator === "notContains") return !left.includes(right);
  if (operator === "equals") return left === right;
  if (operator === "notEquals") return left !== right;
  return true;
}

function matchesNumber(
  actual: number,
  operator: SmartPlaylistRule["operator"],
  expected: number
): boolean {
  if (operator === "greaterThan") return actual > expected;
  if (operator === "lessThan") return actual < expected;
  if (operator === "equals") return actual === expected;
  if (operator === "notEquals") return actual !== expected;
  return true;
}

function matchesQuadrant(point: { x: number; y: number } | undefined, value: string | number) {
  if (!point) return false;
  const quadrant = String(value);
  if (quadrant === "Q1") return point.x > 0 && point.y > 0;
  if (quadrant === "Q2") return point.x < 0 && point.y > 0;
  if (quadrant === "Q3") return point.x < 0 && point.y < 0;
  if (quadrant === "Q4") return point.x > 0 && point.y < 0;
  return false;
}

export function evaluateSmartPlaylistRule(
  song: Song,
  rule: SmartPlaylistRule,
  emotions: RuleEmotionMap
): boolean {
  if (["title", "artist", "album", "genre"].includes(rule.field)) {
    return matchesText(textValue(song, rule.field), rule.operator, String(rule.value));
  }

  if (["duration", "playCount", "addedTime"].includes(rule.field)) {
    return matchesNumber(numberValue(song, rule.field), rule.operator, Number(rule.value));
  }

  if (rule.field === "emotion") {
    return rule.operator === "inQuadrant" ? matchesQuadrant(emotions[song.id], rule.value) : true;
  }

  return true;
}

export function evaluateSmartPlaylistRules(
  song: Song,
  rules: SmartPlaylistRule[],
  emotions: RuleEmotionMap
): boolean {
  return rules.every((rule) => evaluateSmartPlaylistRule(song, rule, emotions));
}
