export type SearchCommandKind = "play" | "queue" | "clear" | "shuffle" | "sleep" | "text-search";

export interface SearchCommand {
  kind: SearchCommandKind;
  query: string;
  minutes?: number;
  raw: string;
}

const COMMANDS = new Set(["play", "queue", "clear", "shuffle", "sleep"]);

export function parseSearchCommand(input: string): SearchCommand {
  const raw = input;
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { kind: "text-search", query: trimmed, raw };
  }

  const [commandToken = "", ...rest] = trimmed.slice(1).split(/\s+/);
  const command = commandToken.toLowerCase();
  const query = rest.join(" ").trim();

  if (!COMMANDS.has(command)) {
    return { kind: "text-search", query: trimmed, raw };
  }

  if (command === "sleep") {
    const match = query.match(/^(\d{1,3})m?$/i);
    return {
      kind: "sleep",
      query,
      minutes: match ? Math.max(1, Number(match[1])) : undefined,
      raw,
    };
  }

  return {
    kind: command as Exclude<SearchCommandKind, "text-search" | "sleep">,
    query,
    raw,
  };
}

export const SEARCH_COMMAND_HINTS = [
  "/play",
  "/queue",
  "/clear",
  "/shuffle",
  "/sleep 30m",
] as const;
