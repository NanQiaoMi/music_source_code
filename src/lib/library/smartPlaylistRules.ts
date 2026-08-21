import type { SmartPlaylistRule } from "@/store/smartPlaylistStore";

export type SmartPlaylistRuleField = SmartPlaylistRule["field"];
export type SmartPlaylistRuleOperator = SmartPlaylistRule["operator"];
export type SmartPlaylistRuleDraft = Omit<SmartPlaylistRule, "id">;

export interface SmartPlaylistRuleOption<T extends string> {
  value: T;
  label: string;
}

export const SMART_PLAYLIST_FIELD_OPTIONS: SmartPlaylistRuleOption<SmartPlaylistRuleField>[] = [
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
  { value: "genre", label: "Genre" },
  { value: "duration", label: "Duration" },
  { value: "playCount", label: "Play count" },
  { value: "addedTime", label: "Added time" },
  { value: "emotion", label: "Emotion" },
];

export const SMART_PLAYLIST_OPERATOR_OPTIONS: SmartPlaylistRuleOption<SmartPlaylistRuleOperator>[] =
  [
    { value: "contains", label: "contains" },
    { value: "equals", label: "equals" },
    { value: "notContains", label: "does not contain" },
    { value: "notEquals", label: "does not equal" },
    { value: "greaterThan", label: "greater than" },
    { value: "lessThan", label: "less than" },
    { value: "inQuadrant", label: "in quadrant" },
  ];

export const DEFAULT_SMART_PLAYLIST_RULE_DRAFT: SmartPlaylistRuleDraft = {
  field: "artist",
  operator: "contains",
  value: "",
};

function isNumericField(field: SmartPlaylistRuleField): boolean {
  return field === "duration" || field === "playCount" || field === "addedTime";
}

export function canUseSmartPlaylistOperator(
  field: SmartPlaylistRuleField,
  operator: SmartPlaylistRuleOperator
): boolean {
  if (field === "emotion") return operator === "inQuadrant";
  if (isNumericField(field)) {
    return (
      operator === "equals" ||
      operator === "notEquals" ||
      operator === "greaterThan" ||
      operator === "lessThan"
    );
  }

  return (
    operator === "contains" ||
    operator === "equals" ||
    operator === "notContains" ||
    operator === "notEquals"
  );
}

export function normalizeSmartPlaylistOperator(
  field: SmartPlaylistRuleField,
  operator: SmartPlaylistRuleOperator
): SmartPlaylistRuleOperator {
  if (canUseSmartPlaylistOperator(field, operator)) return operator;
  if (field === "emotion") return "inQuadrant";
  if (isNumericField(field)) return "greaterThan";
  return "contains";
}

export function normalizeSmartPlaylistRuleValue(
  field: SmartPlaylistRuleField,
  value: string | number
): string | number {
  if (isNumericField(field)) return Number(value || 0);
  return value;
}

export function getSmartPlaylistOperatorOptions(
  field: SmartPlaylistRuleField
): SmartPlaylistRuleOption<SmartPlaylistRuleOperator>[] {
  return SMART_PLAYLIST_OPERATOR_OPTIONS.filter((operator) =>
    canUseSmartPlaylistOperator(field, operator.value)
  );
}

export function buildSmartPlaylistRule(
  id: string,
  draft: SmartPlaylistRuleDraft
): SmartPlaylistRule {
  return {
    id,
    field: draft.field,
    operator: normalizeSmartPlaylistOperator(draft.field, draft.operator),
    value: normalizeSmartPlaylistRuleValue(draft.field, draft.value),
  };
}
