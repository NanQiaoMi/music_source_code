import type { RecommendationReason } from "@/utils/recommendationLogic";

const REASON_COPY: Record<RecommendationReason["code"], { label: string; detail: string }> = {
  "artist-match": {
    label: "Common artist",
    detail: "Matches artists you already play often.",
  },
  "genre-match": {
    label: "Preferred style",
    detail: "Fits one of your strongest recent genres.",
  },
  "fresh-discovery": {
    label: "Fresh discovery",
    detail: "Adds variety without drifting too far from your library.",
  },
  "replay-friendly": {
    label: "Replay friendly",
    detail: "Has enough plays to be a reliable pick.",
  },
  "skip-avoidance": {
    label: "Low skip risk",
    detail: "No recent skip signal is attached to this track.",
  },
};

export interface RecommendationReasonDisplay {
  code: RecommendationReason["code"];
  label: string;
  detail: string;
  weightLabel: string;
}

export function buildRecommendationReasonDisplay(
  reasons: RecommendationReason[]
): RecommendationReasonDisplay[] {
  return reasons.map((reason) => {
    const copy = REASON_COPY[reason.code];

    return {
      code: reason.code,
      label: copy.label,
      detail: copy.detail,
      weightLabel: reason.weight > 0 ? `+${reason.weight}` : String(reason.weight),
    };
  });
}
