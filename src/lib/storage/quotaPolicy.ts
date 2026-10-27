/**
 * Storage write policy (S1-3).
 *
 * Rules:
 * - Never remove the previous value before a successful write (fixes the queue data-loss path).
 * - Try progressively smaller payloads; stop at the first success.
 * - If every candidate fails with QuotaExceededError, keep the previous value and report degradation.
 */
export type DegradedReason = "history-trimmed" | "minimal-songs" | "index-only" | "pruned";

export interface PersistCandidate {
  value: string;
  degradedTo?: DegradedReason;
}

export type PersistOutcome =
  | { ok: true; bytes: number; degradedTo?: DegradedReason }
  | { ok: false; reason: "quota" | "unknown"; keptPrevious: true };

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  if (candidate.name === "QuotaExceededError") return true;
  return candidate.code === 22 || candidate.code === 1014;
}

export function writeWithPolicy(
  candidates: readonly PersistCandidate[],
  write: (value: string) => void
): PersistOutcome {
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      write(candidate.value);
      return { ok: true, bytes: candidate.value.length, degradedTo: candidate.degradedTo };
    } catch (error) {
      lastError = error;
      if (!isQuotaExceededError(error)) break;
    }
  }
  return {
    ok: false,
    reason: isQuotaExceededError(lastError) ? "quota" : "unknown",
    keptPrevious: true,
  };
}
