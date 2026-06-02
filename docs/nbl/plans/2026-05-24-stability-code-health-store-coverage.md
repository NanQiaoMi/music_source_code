# Stability, Code Health, and Store Coverage Completion Record

> Date: 2026-05-24  
> Scope: Windows dev-server stability, ESLint/test/build validation, store coverage expansion, low-risk UX/code-health fixes, and remaining architecture risks.

## Goals

- Restore reliable local development startup on TCP port 3025 in the current Windows environment.
- Keep the current ESLint cleanup at 0 source errors.
- Expand test coverage for under-tested Zustand stores without changing persisted storage formats.
- Fix low-risk correctness and user-facing workflow issues discovered during verification.
- Record the evidence, remaining risks, and next recommendations for the Phase 0/4 code-health track.

## Guardrails Observed

- No new runtime dependencies were added.
- V7.0 protected core views were not behaviorally redesigned.
- No localStorage or IndexedDB compatibility formats were changed.
- Fixes stayed inside port cleanup, store tests, library duplicate quality metadata, poster/share workflow text, and docs.

## Completed Work

### Windows dev server and port cleanup

- Hardened `scripts/clean-port.js` for Windows shells where `netstat` and `taskkill` are not on `PATH` by resolving candidates under `%WINDIR%\System32`.
- Updated port availability probing to check wildcard and loopback bind behavior across `::`, `0.0.0.0`, and `127.0.0.1`, preventing false-free results when Next listens on IPv6/wildcard addresses.
- Exported testable helpers from `scripts/clean-port.js` and added regression coverage in `scripts/clean-port.test.js`.
- Verified both empty-port and stale-process cleanup paths in the local Windows environment.

### ESLint and code health

- Preserved the current cleanup target: `npx eslint src --max-warnings=99999` exits with 0 errors.
- Restored readable poster workshop/share panel Chinese labels after tests exposed corrupted strings in `src/utils/posterWorkshop.ts` and `src/components/social/SharePanel.tsx`.
- Kept the SharePanel fix limited to visible copy/toast text and quality summary text; no poster config or export data format changed.

### Store and business logic tests

- Added grouped store coverage for processing stores in `src/store/processingStores.test.ts`:
  - `dsdProcessingStore`, `formatConversionStore`, `recordingStore`, `trackCuttingStore`, `waveformStore`, `hiresStore`, `fingerprintStore`, `spectrumStore`, and `professionalModeStore`.
- Added grouped visual/interaction store coverage in `src/store/visualInteractionStores.test.ts`:
  - `emotionStore`, `visualizationStore`, `visualizationV8Store`, `lyricSettingsStore`, `gestureStore`, `animationStore`, `totemStore`, and `presetStore`.
- Added grouped business store coverage in `src/store/businessStores.test.ts`:
  - `crossfadeStore`, `knowledgeStore`, `linerNotesStore`, `metadataEditorStore`, and `libraryManagerStore`.
- Fixed `libraryManagerStore.findDuplicates` so duplicate candidates retain `fileSize`, `bitRate`, and `format`, allowing higher-quality recommendations to use real metadata.
- Fixed library stats aggregation so total file size and artist/album counts use normalized stored values.

### Local usability checks

- Verified `npm run dev` starts cleanly on port 3025 after the port cleanup script runs.
- Verified HTTP access to:
  - `http://127.0.0.1:3025/` -> 200
  - `http://127.0.0.1:3025/data-manager` -> 200
- Confirmed `netstat` shows a single active listener on TCP 3025 after startup.

## Verification Evidence

- `npx vitest run src/utils/posterWorkshop.test.ts src/components/social/SharePanel.test.tsx` -> 2 files, 11 tests passed.
- `npx eslint src --max-warnings=99999` -> 0 errors.
- `npm run test -- --run` -> 80 files, 412 tests passed.
- `npx tsc --noEmit --incremental false --pretty false` -> exit 0.
- `npm run build` -> Next.js production build passed; `/` and `/data-manager` prerendered.
- `node scripts/clean-port.js` -> empty-port path reports port 3025 available.
- `npm run dev` -> Next.js Ready on port 3025; HTTP smoke for `/` and `/data-manager` returned 200.
- System Chrome headless `--dump-dom` smoke returned HTML DOM for `/` (163,325 chars) and `/data-manager` (33,903 chars), both containing application markers.
- System Chrome CDP smoke loaded both routes with title `MIMI Music Player`, visible body text, 0 console errors, 0 JavaScript exceptions, and no visible Next error dialog.

## Core Feature Smoke Notes

- Home and Data Manager routes were verified through HTTP and Chrome CDP. Both routes rendered visible body text, showed the title `MIMI Music Player`, and reported 0 console errors / 0 JavaScript exceptions.
- Source-level DOM checks confirmed the primary navigation labels are readable (`Music Library`, `Import music to begin`, `Lyrics`, `Library`, `Discover`, `Tools`, and `Manage music`). A coarse whole-body text sample occasionally dropped the letter `s` in headless output, but direct `textContent` / `innerText` character-code checks showed the DOM text is correct.
- A deeper automated HoverHub submenu smoke was attempted for Lyrics, Library, Discover, Tools, and Professional Tools entries, but headless Chrome mouse events did not trigger the hover-open state for those menus. Because the menus are hover-driven and the route/page had 0 runtime errors, this was recorded as an automation limitation rather than a product failure.
- The named feature areas are covered this pass by targeted/unit tests where practical: poster/share workflow tests, HeaderToolbar navigation label tests, Smart Mix/Journal/Library/Audio processing tests already in the suite, and the new grouped store tests. Manual browser QA of every hover submenu remains a follow-up risk.

## Browser Smoke Note

The Codex in-app Browser runtime was attempted after reading the Browser skill, but the available `mcp__node_repl__js` tool returned `unsupported call` in this session. `playwright` and `@playwright/test` were also not installed in the local `node_modules`, so no new browser dependency was introduced. A no-dependency Edge `--dump-dom` probe returned no DOM output, but system Chrome headless and Chrome CDP checks succeeded for both `/` and `/data-manager`. The recorded smoke evidence for this pass is HTTP-level, Next dev-server logs, Chrome headless DOM output, and Chrome CDP console/exception checks.

## Architecture Findings and Remaining Risks

- `audioStore` and `uiStore` remain broad dependency hubs and should still be split behind smaller typed selectors/coordinators before further feature growth.
- `visualizationStore` and `visualizationV8Store` have better test coverage now, but V8 effect state still needs a dedicated typed boundary pass to reduce private-state `any` usage and renderer coupling.
- Audio processing stores now have broader state-transition tests, but real browser audio capability paths still need browser-level QA once an in-app browser or Playwright runtime is available.
- Electron/backend integration boundaries were identified as remaining architecture risk areas but were not changed in this pass because the current request prioritized Windows dev startup, source lint, store tests, and low-risk fixes.
- Many legacy docs still contain historical mojibake. This pass repaired only touched user-facing poster/share workflow copy and did not bulk re-encode archived documentation.

## Recommended Next Phase

1. Split the `audioStore` surface into typed player/queue/library selectors or coordinators, starting with the highest-imported read-only selectors.
2. Add browser-capability QA for audio processing, V8 visualization, backup/restore, Smart Mix, and Listening Journal when the Browser plugin or Playwright runtime is available.
3. Continue replacing V8 effect private `any` state with explicit effect-local interfaces, one effect file at a time.
4. Add coverage reports back to CI after stabilizing the remaining long-tail store and UI panel tests.
