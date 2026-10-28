// Shared schema + CLI helpers for perf/perf-history.jsonl (append-history / perf-dashboard).
import fs from "node:fs";

export const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
// maxDelta mirrors the bundle-diff gzip gates (+ CSS/async/public guards used by the dashboard).
export const FIELDS = [
  { key: "rootMainGzipKB", label: "rootMain gzip", unit: " KB", maxDelta: 5 },
  { key: "firstLoadGzipKB", label: "First load gzip", unit: " KB", maxDelta: 10 },
  { key: "cssGzipKB", label: "CSS gzip", unit: " KB", maxDelta: 5 },
  { key: "asyncMaxKB", label: "Max async", unit: " KB", maxDelta: 10 },
  { key: "publicMB", label: "public", unit: " MB", maxDelta: 1 },
];
export const flag = (argv, name) => argv.includes("--" + name);
export function option(argv, name, fallback) {
  const index = argv.indexOf("--" + name);
  const value = index >= 0 ? argv[index + 1] : null;
  return value && !value.startsWith("--") ? value : fallback;
}
export function entryError(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "not a JSON object";
  if (typeof entry.ts !== "string" || !ISO_RE.test(entry.ts) || Number.isNaN(Date.parse(entry.ts))) return "ts must be an ISO 8601 timestamp";
  if (typeof entry.commit !== "string" || entry.commit.trim() === "") return "commit must be a non-empty string";
  for (const field of FIELDS) {
    const value = entry[field.key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return field.key + " must be a non-negative number";
  }
  if ("metrics" in entry && (!entry.metrics || typeof entry.metrics !== "object" || Array.isArray(entry.metrics))) return "metrics must be an object when present";
  return null;
}
export function parseHistory(text, label = "history") {
  const entries = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      throw new Error(label + " line " + (index + 1) + " is not valid JSON: " + error.message);
    }
    const error = entryError(entry);
    if (error) throw new Error(label + " line " + (index + 1) + ": " + error);
    const previous = entries.at(-1);
    if (previous && Date.parse(entry.ts) <= Date.parse(previous.ts)) throw new Error(label + " line " + (index + 1) + ": ts must be strictly increasing (previous " + previous.ts + ")");
    entries.push(entry);
  });
  return entries;
}
export function readHistory(file) {
  if (!fs.existsSync(file)) return [];
  return parseHistory(fs.readFileSync(file, "utf8"), file);
}
