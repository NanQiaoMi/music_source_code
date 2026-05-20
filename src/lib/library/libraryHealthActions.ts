export type LibraryHealthActionTarget = "scan" | "results";
export type LibraryHealthStatus = "empty" | "ready" | "healthy" | "issues";

export interface LibraryHealthNextActionInput {
  songsCount: number;
  hasScanned: boolean;
  totalIssues: number;
  missingFileCount?: number;
}

export interface LibraryHealthNextAction {
  status: LibraryHealthStatus;
  label: string;
  target: LibraryHealthActionTarget;
}

function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : plural || singular + "s";
  return count + " " + word;
}

export function getLibraryHealthStatus({
  songsCount,
  hasScanned,
  totalIssues,
}: LibraryHealthNextActionInput): LibraryHealthStatus {
  if (songsCount === 0) return "empty";
  if (!hasScanned) return "ready";
  if (totalIssues === 0) return "healthy";
  return "issues";
}

export function getLibraryHealthNextAction(
  input: LibraryHealthNextActionInput
): LibraryHealthNextAction {
  const status = getLibraryHealthStatus(input);

  if (status === "empty" || status === "ready") {
    return { status, label: "Scan folder", target: "scan" };
  }
  if (status === "healthy") {
    return { status, label: "Run weekly check", target: "scan" };
  }

  const missingFileCount = input.missingFileCount ?? 0;
  if (missingFileCount > 0) {
    return {
      status,
      label: "Resolve " + pluralize(missingFileCount, "broken path"),
      target: "results",
    };
  }

  return {
    status,
    label: "Review " + pluralize(input.totalIssues, "active issue"),
    target: "results",
  };
}
