# Runtime Stability and Listening DNA Follow-up Completion Record

> Date: 2026-05-24  
> Scope: Windows dev-server runtime behavior, safe verification order, Listening DNA panel routing, visible copy repair, and targeted regression coverage.

## Goals

- Reconfirm `npm run dev` behavior on Windows port 3025 after the previous port-cleanup hardening.
- Verify the effect of deleting `.next` while a Next dev server is already running.
- Keep validation ordered so `npx tsc --noEmit` and `npm run build` do not run concurrently and create false `.next/dev/types` failures.
- Repair one low-risk real user path from the Discover hub to Listening DNA without changing protected V7.0 views or persisted data formats.
- Record exact verification evidence, browser-smoke limitations, remaining risks, and next recommendations.

## Guardrails Observed

- No new dependencies were added.
- No localStorage, IndexedDB, backup, or playlist persistence keys were renamed or migrated.
- Protected V7.0 Home View, Player View, and fullscreen lyrics implementations were not redesigned.
- The `audioStore` split and other high-risk architecture work were intentionally deferred.

## Completed Work

### Windows runtime stability

- Verified `node scripts/clean-port.js 3025` reports an empty port as available.
- Verified `npm run dev` runs `clean-port`, clears `.next` before startup, starts Next dev on port 3025, and serves both routes after first-request compilation.
- Verified running `npm run clean` while the dev server is still alive deletes `.next/dev` manifests and causes subsequent requests to return 500 with `ENOENT` for `.next/dev/server/app-paths-manifest.json` and `.next/dev/routes-manifest.json`.
- Verified recovery: `node scripts/clean-port.js 3025` found and terminated the live Next listener, released the port, and a fresh `npm run dev` recreated `.next/dev`; `/` and `/data-manager` returned 200 again.
- Documented the correct validation order: `eslint -> vitest -> tsc -> build -> clean-port/dev -> HTTP smoke`. Do not run `npm run build` and bare `tsc` in parallel, and do not run `npm run clean` against an already-running dev server.

### Listening DNA path and UX repair

- Registered `dnaJournal` in `PanelOrchestrator`, so the Discover hub's Listening DNA action now renders the panel instead of only toggling store state.
- Consolidated `uiStore` panel defaults behind `PANEL_NAMES`, reducing duplicated panel-name maintenance while keeping the existing `PanelName` union and state shape compatible.
- Updated fullscreen-panel behavior so opening fullscreen tool panels closes fullscreen lyrics first; regular panels still preserve existing panel state.
- Repaired `DNAJournal` visible copy and broken interpolation that previously displayed mojibake or literal `{dnaJournal...}` fragments.
- Replaced misleading fake clipboard/share feedback in `DNAJournal` with an honest prompt that routes users to the Share Music workflow.
- Added React act environment setup in `src/test/setup.ts` to reduce component-test warning noise.

## Tests Added

- `src/components/layout/PanelOrchestrator.test.tsx`: verifies the `dnaJournal` route renders through the lazy panel orchestrator.
- `src/components/widgets/DNAJournal.test.tsx`: verifies readable empty-state copy and the disabled-AI warning toast.
- `src/store/uiStore.test.ts`: verifies fullscreen lyrics close before opening fullscreen tool panels.

## Verification Evidence

- Targeted tests: `npm run test -- src/store/uiStore.test.ts src/components/layout/PanelOrchestrator.test.tsx src/components/widgets/DNAJournal.test.tsx --run` -> 3 files, 14 tests passed.
- Targeted ESLint: `npx eslint src/store/uiStore.ts src/store/uiStore.test.ts src/components/layout/PanelOrchestrator.tsx src/components/layout/PanelOrchestrator.test.tsx src/components/widgets/DNAJournal.tsx src/components/widgets/DNAJournal.test.tsx src/test/setup.ts --max-warnings=99999` -> passed.
- Full ESLint: `npx eslint src --max-warnings=99999` -> exit 0.
- Full Vitest: `npm run test -- --run` -> 82 files, 415 tests passed.
- TypeScript: `npx tsc --noEmit --incremental false --pretty false` -> exit 0.
- Production build: `npm run build` -> passed; routes `/`, `/_not-found`, and `/data-manager` generated.
- Empty-port check: `node scripts/clean-port.js 3025` -> port available.
- First clean dev startup: `npm run dev` -> Next ready on port 3025; HTTP smoke returned `/` 200 and `/data-manager` 200 with title `MIMI Music Player`.
- Running `.next` cleanup impact: `npm run clean` while dev server was live -> next HTTP requests returned 500; dev terminal showed `ENOENT` for `.next/dev` manifests.
- Old-process cleanup: `node scripts/clean-port.js 3025` found PID `97192`, terminated it, and reported port 3025 available.
- Recovery startup: fresh `npm run dev` after cleanup -> Next ready; HTTP smoke returned `/` 200 and `/data-manager` 200 again with title `MIMI Music Player`.

## Browser Smoke Notes

- Codex in-app Browser was attempted after loading the Browser skill, but the available Node/browser call returned `unsupported call` in this session.
- System Chrome CDP fallback was attempted. A first attempt could not connect to the remote debugging port; a second headless attempt exited with `Multiple targets are not supported in headless mode`.
- Chrome `--dump-dom` fallback triggered successful page requests on the dev server but returned no DOM stdout in this Windows session. The reliable browser-level evidence for this pass is therefore limited to HTTP smoke plus dev-server request logs, not console/exception capture.
- During Chrome fallback, Next dev logged a cross-origin HMR warning for `127.0.0.1`; route responses still returned 200. Follow-up can add `allowedDevOrigins: ['127.0.0.1']` if Chrome-based local smoke remains standard.

## Remaining Risks

- Browser automation was limited by this desktop session; console error and JavaScript exception capture should be repeated when the in-app Browser or a stable Playwright/CDP runtime is available.
- Legacy documentation still contains historical mojibake outside the touched runtime notes.
- `audioStore` and `uiStore` remain broad hubs; this pass only reduced a low-risk `uiStore` panel-name duplication point.
- V8 effect private-state typing, old visualization boundaries, and browser-only/Electron/backend capability boundaries still need incremental passes.
- The `professionalTools` panel name remains in `uiStore` but is used as a dropdown/control concept rather than a registered `PanelOrchestrator` panel; keep this on the naming-boundary review list.

## Recommended Next Phase

1. Add a small guard or documented wrapper for cleaning `.next` only after the dev server is stopped, or split `clean:next` and `dev:restart` commands so accidental runtime cleanup is harder.
2. Add stable browser automation for Discover -> Listening DNA, Search, Data Manager, Backup/Restore, and audio-processing unsupported-capability states once Browser/Playwright is available.
3. Continue replacing visible mojibake in actively rendered components and top-level docs before touching archived docs.
4. Continue the low-risk `uiStore` and `PanelOrchestrator` naming-boundary pass, especially `professionalTools` vs actual panel names.
