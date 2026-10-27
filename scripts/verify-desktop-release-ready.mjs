#!/usr/bin/env node
// Desktop release readiness guard (S0-3).
//
// Evidence (2026-10-21): Next 16 "output: export" fails on the 31 API routes
// (/api/audio/proxy, /api/kugou/..., ...) with:
//   "export const dynamic = force-static/revalidate not configured on route ... with output: export"
// Therefore static export cannot ship the current online-capable frontend.
// D2 recommendation: bundle a local Next runtime (S7-4) and keep app:// origin bridging.
// Until that lands, desktop packaging is intentionally frozen instead of shipping a stale out/.
const runtime = process.env.MIMI_DESKTOP_RUNTIME || "frozen";
if (runtime !== "next-local") {
  console.error("[desktop-release-guard] BLOCKED: desktop packaging is frozen until S7-4 (local Next runtime).");
  console.error("  Reason: static export is incompatible with 31 API routes (P0-8 / D2).");
  console.error("  Current out/: see node scripts/verify-static-export.mjs (stale since 2026-07-30).");
  console.error("  To unblock: implement S7-4 (D2-B) or explicitly set MIMI_DESKTOP_RUNTIME=next-local once ready.");
  process.exit(1);
}
console.log("[desktop-release-guard] desktop runtime = next-local; continue with S7-4 build path");
