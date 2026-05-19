import { describe, expect, it } from "vitest";
import { evaluateSmartPlaylistRules, type RuleEmotionMap } from "./ruleEngine";
import type { SmartPlaylistRule } from "@/store/smartPlaylistStore";
import type { Song } from "@/types/song";

const song: Song = {
  id: "s1",
  title: "Midnight City",
  artist: "M83",
  album: "Hurry Up",
  duration: 245,
  source: "local",
  audioUrl: "blob:s1",
};

function rule(overrides: Partial<SmartPlaylistRule>): SmartPlaylistRule {
  return {
    id: "r1",
    field: "title",
    operator: "contains",
    value: "midnight",
    ...overrides,
  };
}

describe("evaluateSmartPlaylistRules", () => {
  it("matches text contains and notContains operators", () => {
    expect(evaluateSmartPlaylistRules(song, [rule({ value: "city" })], {})).toBe(true);
    expect(
      evaluateSmartPlaylistRules(song, [rule({ operator: "notContains", value: "city" })], {})
    ).toBe(false);
  });

  it("matches numeric duration comparisons", () => {
    expect(
      evaluateSmartPlaylistRules(
        song,
        [rule({ field: "duration", operator: "greaterThan", value: 200 })],
        {}
      )
    ).toBe(true);
    expect(
      evaluateSmartPlaylistRules(
        song,
        [rule({ field: "duration", operator: "lessThan", value: 200 })],
        {}
      )
    ).toBe(false);
  });

  it("uses injected emotion data for quadrant rules", () => {
    const emotions: RuleEmotionMap = { s1: { x: 0.4, y: 0.8 } };
    expect(
      evaluateSmartPlaylistRules(
        song,
        [rule({ field: "emotion", operator: "inQuadrant", value: "Q1" })],
        emotions
      )
    ).toBe(true);
    expect(
      evaluateSmartPlaylistRules(
        song,
        [rule({ field: "emotion", operator: "inQuadrant", value: "Q3" })],
        emotions
      )
    ).toBe(false);
  });

  it("requires all rules to match", () => {
    expect(
      evaluateSmartPlaylistRules(
        song,
        [
          rule({ field: "artist", value: "m83" }),
          rule({ field: "album", operator: "contains", value: "rush" }),
        ],
        {}
      )
    ).toBe(false);
  });
});
