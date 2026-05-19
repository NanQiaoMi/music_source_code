import { describe, expect, it } from "vitest";
import {
  buildSmartPlaylistRule,
  getSmartPlaylistOperatorOptions,
  normalizeSmartPlaylistOperator,
  normalizeSmartPlaylistRuleValue,
} from "./smartPlaylistRules";

describe("smartPlaylistRules", () => {
  it("limits text fields to text operators", () => {
    expect(getSmartPlaylistOperatorOptions("artist").map((operator) => operator.value)).toEqual([
      "contains",
      "equals",
      "notContains",
      "notEquals",
    ]);
  });

  it("normalizes invalid operators when the field changes", () => {
    expect(normalizeSmartPlaylistOperator("duration", "contains")).toBe("greaterThan");
    expect(normalizeSmartPlaylistOperator("emotion", "equals")).toBe("inQuadrant");
    expect(normalizeSmartPlaylistOperator("title", "greaterThan")).toBe("contains");
  });

  it("converts numeric rule values while preserving text values", () => {
    expect(normalizeSmartPlaylistRuleValue("playCount", "12")).toBe(12);
    expect(normalizeSmartPlaylistRuleValue("duration", "")).toBe(0);
    expect(normalizeSmartPlaylistRuleValue("genre", "Synthpop")).toBe("Synthpop");
  });

  it("builds a normalized rule object from editor draft state", () => {
    expect(
      buildSmartPlaylistRule("rule-1", {
        field: "playCount",
        operator: "contains",
        value: "5",
      })
    ).toEqual({
      id: "rule-1",
      field: "playCount",
      operator: "greaterThan",
      value: 5,
    });
  });
});
