/**
 * S2-6 dev-console recipe: sample window.__audioMetrics for 60s and print JSON.
 *
 * Browser (recommended):
 *   1. npm run dev  (http://127.0.0.1:3025)
 *   2. DevTools console -> paste this whole file -> wait 60s.
 *   3. JSON is printed (and copied when clipboard permission allows).
 *      Save it as perf/audio-<date>.json alongside commit + machine info.
 *
 * Node: node scripts/perf/audio-metrics.mjs prints these instructions.
 */
/* eslint-env browser, node */
void (async () => {
  const DURATION_MS = 60_000;

  if (typeof window === "undefined" || typeof document === "undefined") {
    console.log("[audio-metrics] Paste this file into the DevTools console of npm run dev.");
    console.log(
      "[audio-metrics] It samples window.__audioMetrics for " + DURATION_MS / 1000 + "s."
    );
    return;
  }

  const api = window.__audioMetrics;
  if (!api) {
    console.error("[audio-metrics] window.__audioMetrics missing; run the dev server and reload.");
    return;
  }

  api.reset();
  window.__audioGraphStats?.reset?.();
  api.start();
  console.log("[audio-metrics] sampling " + DURATION_MS / 1000 + "s...");
  await new Promise((resolve) => setTimeout(resolve, DURATION_MS));

  const payload = {
    scenario: "audio-metrics-dev-60s",
    generatedAt: new Date().toISOString(),
    url: location.href,
    userAgent: navigator.userAgent,
    metrics: api.stop(),
  };
  const json = JSON.stringify(payload, null, 2);
  console.log(json);

  try {
    await navigator.clipboard.writeText(json);
    console.log("[audio-metrics] JSON copied to clipboard.");
  } catch {
    console.log("[audio-metrics] Clipboard unavailable; copy the JSON above.");
  }
})();
