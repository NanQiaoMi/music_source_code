# MIMI Music Player Roadmap

This file tracks the current, evidence-based roadmap for MIMI Music Player. Older plans remain in `docs/nbl/plans/` and `docs/nbl/archive/`; this page should reflect the current state rather than historical assumptions.

## 2026-05-25 Search Voice Feedback Follow-up

Completed record: `docs/nbl/plans/2026-05-25-search-voice-feedback-follow-up.md`.

- Kept protected V7 Home View, Player View, and fullscreen lyrics behavior unchanged; no visual redesign was performed.
- Preserved existing `localStorage` / IndexedDB keys and persisted shapes; no new dependencies were added.
- Replaced Search Panel unsupported voice-search `alert()` behavior with visible in-panel feedback in the existing `aria-live` area.
- Added focused Search Panel regression coverage for browsers without `SpeechRecognition` / `webkitSpeechRecognition`.
- Verification passed in the required order: `npx eslint src --max-warnings=99999`, `npm run test -- --run` (95 files, 456 tests), `npx tsc --noEmit --incremental false --pretty false`, `node scripts/clean-port.js 3025` (terminated PID `283708`), `npm run build`, `npm run dev` (ready in 312 ms), HTTP smoke for `/` and `/data-manager`, route-level Chrome CDP smoke, and focused Search Panel voice-feedback CDP smoke.

Remaining risks: focused Search Panel smoke recorded one existing Next Image LCP warning from the Unsplash demo cover; microphone permission prompts were not manually exercised; broader panel-level smoke remains needed for Lyrics, Backup/Restore, Format Converter, DSD, Crossfade, Smart Mix, Listening Journal, and V8 visualization.

---

## 2026-05-25 Track Cutter Feedback Follow-up

Completed record: `docs/nbl/plans/2026-05-25-track-cutter-feedback-follow-up.md`.

- Kept the protected V7 Home View, Player View, and fullscreen lyrics behavior unchanged; no large visual redesign was performed.
- Preserved existing `localStorage` / IndexedDB keys and persisted shapes; no new dependencies were added.
- Replaced Track Cutter blocking `alert()` feedback for invalid CUE files with a visible in-panel error message.
- Added visible Track Cutter guidance when a ready task has 0 selected tracks, so the disabled cut action now explains what the user must do next.
- Added focused Track Cutter regression coverage for invalid CUE feedback and empty selected-track state.
- Reconfirmed `uiStore` / `PanelOrchestrator` panel registration coverage after the earlier `PANEL_NAMES` registry test, and formatted that test file to keep the global lint gate clean.
- Verification passed in the required order: `npx eslint src --max-warnings=99999`, `npm run test -- --run` (95 files, 456 tests), `npx tsc --noEmit --incremental false --pretty false`, `node scripts/clean-port.js 3025` (terminated PID `281968`), `npm run build`, `npm run dev` (ready in 394 ms), HTTP smoke for `/` and `/data-manager`, and system Chrome CDP smoke with 0 console errors/warnings and 0 JavaScript exceptions.

Remaining risks: Track Cutter still needs a deeper real cutting/source-resolution pass; native file-picker and audible playback were not manually exercised; broader panel-level smoke is still needed for Lyrics, Backup/Restore, Format Converter, DSD, Crossfade, Smart Mix, Listening Journal, and V8 visualization; `audioStore` and V8 effect typing remain incremental architecture/code-health tracks.

---

## 2026-05-25 Audio Source Runtime Stability Pass

Completed record: `docs/nbl/plans/2026-05-25-audio-source-runtime-stability.md`.

- Kept the project on the current V7 Home View, Player View, and fullscreen lyrics architecture; no large visual redesign was performed.
- Preserved existing `localStorage` / IndexedDB keys and persisted shapes; no new dependencies were added.
- Confirmed the missing-audio guard path now keeps unavailable songs out of `currentSong`, player state, and queue writes.
- Confirmed search, queue clicks, and history replay route through safe audio-store actions instead of writing playback state directly.
- Confirmed compact playback-history records resolve back to current library songs before replay, with unavailable sources reported instead of queued.
- Confirmed `AudioEngine` creates `AudioContext` lazily, reducing startup autoplay warnings and keeping graph initialization on the playback path.
- Confirmed page-visible text in `src/app/page.tsx`, `src/app/data-manager/page.tsx`, and `src/hooks/useMusicLibrarySync.ts` is readable when inspected as UTF-8.
- Repaired `GlassRadarWidget` visible emotion-matrix title, quadrant labels, and toast feedback, and added a focused regression test for the expanded radar copy.
- Added a visible Local Music Manager error state for unsupported/non-audio selections so file import failures no longer look like a no-op.
- Removed the local library directory-upload `@ts-expect-error` comments by narrowing the browser-only `webkitdirectory` / `directory` attributes behind a local typed helper.
- Repaired this active roadmap and changelog so current docs no longer expose corrupted historical route/changelog text as active guidance.
- Verification passed in the required order: `npx eslint src --max-warnings=99999`, `npm run test -- --run` (93 files, 452 tests), `npx tsc --noEmit --incremental false --pretty false`, `npm run build`, `npm run dev`, HTTP smoke for `/` and `/data-manager`, and Chrome CDP smoke.
- Chrome/CDP smoke loaded `/` and `/data-manager` with title `MIMI Music Player`, readable primary DOM markers, Next dev portal present only as the normal empty dev overlay, 0 console errors/warnings, and 0 JavaScript exceptions. The in-app Browser Node bridge returned `unsupported call` in this session, so system Chrome CDP was used without adding dependencies.
- A real local-file import smoke used an isolated Chrome profile and `scratch/Codex - Smoke.wav` to verify `/data-manager` writes one IndexedDB `VibeMusicDB/localMusic` record, refreshes home with `Smoke` / `Codex`, removes demo songs from the home text, and reports 0 console errors/warnings or JavaScript exceptions.

Remaining risks: native OS file-picker UI was not manually clicked because CDP set the file input directly; headless smoke did not click through actual playback gesture/audio output; `audioStore` remains a broad compatibility hub; V8 effect private state still contains legacy `any`/`eslint-disable` debt; Electron/backend/browser-only boundaries still need a focused pass; old archived docs may still contain mojibake but are no longer the active roadmap source.

---

## 2026-05-24 Runtime Stability And Listening DNA Follow-up

Completed record: `docs/nbl/plans/2026-05-24-runtime-stability-listening-dna-followup.md`.

- Reconfirmed the Windows dev-server path on port 3025: `clean-port` runs before startup, `.next` is cleaned before Next starts, and `/` plus `/data-manager` return 200 after first-request compilation.
- Verified an important runtime constraint: running `npm run clean` while `next dev` is alive deletes `.next/dev` manifests and causes subsequent requests to return 500. Correct order is stop old dev server, clean `.next`, then restart dev.
- Verified `scripts/clean-port.js` recovered the broken live server by finding and terminating the 3025 listener, after which a fresh `npm run dev` recreated `.next/dev` and both smoke routes returned 200.
- Fixed the Discover -> Listening DNA path by registering `dnaJournal` in `PanelOrchestrator` and adding a lazy-panel regression test.
- Reduced a low-risk `uiStore` panel boundary issue by centralizing panel defaults in `PANEL_NAMES` and closing fullscreen lyrics before opening fullscreen tool panels.
- Repaired visible Listening DNA copy and broken interpolation in `DNAJournal`, replacing corrupted text and misleading fake clipboard feedback with readable states and honest user feedback.
- Verification passed: `npx eslint src --max-warnings=99999`, `npm run test -- --run` (82 files, 415 tests), `npx tsc --noEmit --incremental false --pretty false`, and `npm run build`.

Remaining risks recorded at that time: browser-level console/exception smoke needed stronger automation, `audioStore`/`uiStore` remained broad hubs, and `professionalTools` naming required follow-up boundary review.

---

## 2026-05-24 Stability And Code Health Reality Update

Completed record: `docs/nbl/plans/2026-05-24-stability-code-health-store-coverage.md`.

- Windows dev startup on port 3025 was hardened in `scripts/clean-port.js`: System32 `netstat.exe` / `taskkill.exe` discovery, IPv6/wildcard/loopback port probing, and regression tests.
- Current source ESLint gate is clean: `npx eslint src --max-warnings=99999` exits with 0 errors.
- Store coverage expanded through grouped tests for processing, visualization/interaction, and business stores, including duplicate-quality behavior in `libraryManagerStore`.
- Poster workshop/share workflow copy was repaired where tests exposed corrupted strings; `SharePanel` now renders quick presets, quality checks, export labels, cover controls, and resolution labels as readable Chinese.
- Verification passed: `npm run test -- --run` (80 files, 412 tests), `npx tsc --noEmit --incremental false --pretty false`, and `npm run build`.
- Local smoke passed by HTTP on `http://127.0.0.1:3025/` and `http://127.0.0.1:3025/data-manager`; system Chrome headless/CDP loaded both routes with title `MIMI Music Player`, visible body text, 0 console errors, 0 JavaScript exceptions, and no visible Next error dialog.

Remaining architecture risks: `audioStore`/`uiStore` are still broad dependency hubs; V8 effect private state still needs typed boundaries; Electron/backend integration remains a follow-up boundary review.

---

## Current Priorities

### P0 - Runtime And Playback Integrity

- Keep the Windows validation order strict: `eslint -> vitest -> tsc -> build -> clean-port/dev -> HTTP smoke`. Do not run `next build` and bare `tsc` in parallel, and do not clean `.next` while a live dev server is serving requests.
- Continue hardening local import and refresh recovery: IndexedDB music should rehydrate into the playlist, demo songs should disappear once real music exists, and missing stored sources should produce clear user feedback without corrupting current playback or queue state.
- Keep all playback entry points on safe audio-store actions: home card, search, queue, history replay, batch play, Smart Mix, and recommendation playback.

### P1 - Functional Completeness And UX Clarity

- Cover core real-user paths with manual or automated smoke: home playback, library import/manage, search, queue, lyrics search/import/cover editor, backup/restore, format conversion, DSD, deeper track cutting/source rendering, crossfade, V8 visualization, stats, smart playlists, Smart Mix, Listening Journal, professional tools, and data manager.
- Add or improve empty, loading, unsupported-browser, and failure states where actions depend on browser APIs, local files, IndexedDB, Web Audio, FFmpeg, or workers.
- Make operation results visible: import complete, restore failure, missing audio source, unsupported conversion, empty queue/search results, and panel open failures should all have explicit feedback.

### P2 - Code Health And Architecture Boundaries

- Keep `npx eslint src --max-warnings=99999` at 0 errors without expanding ignores.
- Continue replacing broad `any`, legacy `LegacyAny`, `eslint-disable`, and `@ts-expect-error` in visualization, browser API, Electron, and jsmediatags seams with narrow types or local wrappers.
- Keep `audioStore` compatibility stable while gradually extracting selectors/coordinators around `playerStore`, `queueStore`, `recommendationStore`, and `eqStore`.
- Keep `uiStore` and `PanelOrchestrator` panel names aligned; fullscreen panels should remain mutually exclusive with fullscreen lyrics.
- Preserve all existing persisted keys and backup/restore fields unless a tested migration is explicitly introduced.

### P3 - Test And Documentation Quality

- Add focused tests for store state transitions, persisted structures, missing audio sources, import/restore failures, queue-empty behavior, search no-results, browser capability gaps, panel open failures, and V8 effect registration.
- Reduce noisy Vitest output only when the warning is not useful for real failure diagnosis.
- Keep active docs readable and evidence-based; archived docs can retain historical context, but active roadmap/changelog/plan index should not contain corrupted text.

## Historical Baseline Summary

The original 2026-05-10 roadmap described five broad phases: infrastructure/process setup, store decoupling, P0 feature reality checks, P1 feature enhancement, and architecture/test/UX polish. Its raw lower section was damaged by encoding corruption, so the active guidance above replaces it while retaining the useful intent: stabilize runtime first, preserve user data formats, improve real user paths, and reduce code-health debt incrementally.