# Changelog

## 2026-05-25

### Added

- Added `docs/nbl/plans/2026-05-25-audio-source-runtime-stability.md` as the implementation record for the audio-source/runtime stability pass.
- Added `docs/nbl/plans/2026-05-25-track-cutter-feedback-follow-up.md` as the implementation record for the Track Cutter feedback follow-up.
- Added `docs/nbl/plans/2026-05-25-search-voice-feedback-follow-up.md` as the implementation record for the Search Panel voice-feedback follow-up.
- Added current Chrome/CDP smoke evidence for `/` and `/data-manager`, including title, primary DOM markers, Next portal state, console warnings/errors, JavaScript exceptions, and log entries.
- Added `GlassRadarWidget` regression coverage for readable expanded emotion-matrix labels.
- Added `LocalMusicManager` regression coverage for unsupported/non-audio import selections.
- Added `TrackCutter` regression coverage for invalid CUE feedback and the no-selected-tracks disabled action state.
- Added `SearchPanel` regression coverage for unsupported browser voice search.

### Changed

- Replaced corrupted active `ROADMAP.md` history with a readable evidence-based roadmap, current priorities, and a historical baseline summary.
- Updated the plan index to include the 2026-05-25 audio-source/runtime stability, Track Cutter feedback, and Search voice feedback records.
- Trimmed corrupted legacy changelog tail entries from the active changelog so current release notes remain readable.
- Narrowed local directory-upload browser attributes behind `directoryInputProps` instead of keeping component-level `@ts-expect-error` comments.

### Fixed

- Confirmed missing-audio playback paths keep unavailable tracks out of current playback and queue state.
- Confirmed search, queue, and history replay use safe playback entry points that validate playable audio sources.
- Confirmed playback-history replay resolves compact history records back to current library songs before playback.
- Confirmed `AudioEngine` lazy initialization prevents startup `AudioContext` creation during ordinary page load.
- Confirmed active page/data-manager/music-library-sync source text is readable as UTF-8.
- Repaired `GlassRadarWidget` visible emotion-matrix title, quadrant labels, per-song mark toast, and global emotion toast; also narrowed the local Framer Motion transform callback away from `LegacyAny[]`.
- Fixed Local Music Manager unsupported-file imports so selecting non-audio files shows a clear error with the selected filename instead of silently doing nothing.
- Fixed Track Cutter invalid CUE handling so parse failures render visible in-panel feedback instead of a blocking `alert()`.
- Fixed Track Cutter empty selection UX so a ready task with 0 selected tracks explains why the cut action is disabled.
- Fixed Search Panel unsupported voice search so browsers without speech-recognition support show visible in-panel feedback instead of a blocking `alert()`.

### Verified

- `npx eslint src --max-warnings=99999` passed with 0 errors.
- `npm run test -- --run` passed: 95 files, 456 tests.
- `npx tsc --noEmit --incremental false --pretty false` passed.
- `node scripts/clean-port.js 3025` terminated the old 3025 listener and confirmed the port was available before build/dev restart; latest run terminated PID `283708` before build, then `npm run dev` restarted cleanly.
- `npm run build` passed; Next reported routes `/`, `/_not-found`, and `/data-manager`.
- `npm run dev` started cleanly on port 3025 after `clean-port` and `.next` cleanup; latest dev start reported ready in 312 ms.
- HTTP smoke passed after the clean dev restart: `/` returned 200 with length 160311, and `/data-manager` returned 200 with length 32251.
- Chrome/CDP smoke passed functionally for route load: both pages reported 0 console errors/warnings and 0 JavaScript exceptions. Focused Search Panel voice-feedback smoke confirmed visible unsupported-browser feedback and 0 JavaScript exceptions; it recorded one existing Next Image LCP warning from the demo cover.
- Isolated Chrome/CDP local import smoke passed with `scratch/Codex - Smoke.wav`: `/data-manager` wrote one `VibeMusicDB/localMusic` record (`Smoke` / `Codex`, `audio/wav`, 88244 bytes), home refresh showed the imported song, demo text was absent, and console errors/warnings plus JavaScript exceptions were 0.

## 2026-05-24

### Added

- Added Windows-focused regression tests for `scripts/clean-port.js`, including System32 command discovery and wildcard/IPv6 port probing behavior.
- Added grouped store tests for processing, visualization/interaction, and business stores, covering state transitions, error paths, reset behavior, and persisted structures where applicable.
- Added the Runtime Stability and Listening DNA follow-up record at `docs/nbl/plans/2026-05-24-runtime-stability-listening-dna-followup.md`.

### Changed

- Hardened `scripts/clean-port.js` so `npm run dev` can reliably detect and clear port 3025 on Windows even when `netstat` or `taskkill` are missing from `PATH`.
- Restored readable SharePanel poster-workflow copy for quick presets, quality checks, cover controls, lyric controls, export actions, and empty states.
- Documented the safe validation order: `eslint -> vitest -> tsc -> build -> clean-port/dev -> HTTP smoke`, with `tsc` and `next build` kept sequential.
- Centralized low-risk `uiStore` panel defaults and made fullscreen tool panels close fullscreen lyrics before opening.

### Fixed

- Fixed `libraryManagerStore.findDuplicates` to preserve duplicate candidate quality metadata, enabling correct higher-quality recommendations.
- Fixed library stats aggregation for file size and normalized artist/album counts.
- Fixed poster workshop metadata/SharePanel text regressions exposed by tests expecting Chinese labels.
- Fixed Discover -> Listening DNA routing by registering `dnaJournal` in `PanelOrchestrator`.
- Fixed visible Listening DNA corrupted text, broken interpolation fragments, and misleading fake share feedback.

### Verified

- Port cleanup unit tests passed: `npx vitest run scripts/clean-port.test.js`.
- Store coverage tests passed with port cleanup regression tests: `npx vitest run scripts/clean-port.test.js src/store/processingStores.test.ts src/store/visualInteractionStores.test.ts src/store/businessStores.test.ts`; 30 tests passed.
- Poster/share regression tests passed: `npx vitest run src/utils/posterWorkshop.test.ts src/components/social/SharePanel.test.tsx`; 2 files, 11 tests.
- Listening DNA follow-up tests passed: `npm run test -- src/store/uiStore.test.ts src/components/layout/PanelOrchestrator.test.tsx src/components/widgets/DNAJournal.test.tsx --run`; 3 files, 14 tests.
- Full ESLint passed: `npx eslint src --max-warnings=99999`; 0 errors.
- Full Vitest suite passed: `npm run test -- --run`; 82 files, 415 tests after the Listening DNA follow-up.
- TypeScript strict check passed: `npx tsc --noEmit --incremental false --pretty false`.
- Production build passed: `npm run build`.
- Local dev smoke passed on port 3025 by HTTP: `/` returned 200 and `/data-manager` returned 200 after a clean `npm run dev`; a follow-up smoke also confirmed both routes returned 200 with title `MIMI Music Player`.
- Verified running `npm run clean` while `next dev` is live breaks subsequent requests with missing `.next/dev` manifests; recovery is `node scripts/clean-port.js 3025` followed by a fresh `npm run dev`.
- Direct DOM text checks confirmed primary navigation labels remain readable. A deeper automated HoverHub submenu smoke was limited by headless hover-event behavior and is recorded as follow-up manual/browser QA risk.

## 2026-05-21

### Added

- feat(audio): Crossfade Mixer now renders real WAV previews from resolved source audio when local rendering is available.
- feat(journal): confirmed playback now auto-records Listening Journal events with local mood labels.
- feat(mix): Smart Mix sessions can now be saved as persistent custom playlist groups.
- feat(library): Library Health now shows next-best action buttons for empty, scan-ready, healthy, and issue states.
- fix(audio): DSD Converter now resolves real stored/local/fetchable source audio before worker conversion.
- fix(audio): Format Converter now resolves real stored/local/fetchable source audio before worker conversion.
- fix(audio): FFmpeg loading now records readiness/error state and reuses in-flight load requests.

### Changed

- Crossfade queue processing now uses `OfflineAudioContext` plus the shared crossfade renderer helper, and unsupported browsers remain preview-only instead of simulating a completed export.
- The journal store now persists per-day playback events, rebuilds day rollups from those events, preserves notes, and prunes events with the 90-day journal window.
- Journal day details now show per-song play counts and listened minutes from recorded playback events.
- Playlist groups now persist under `playlist-group-store-v1`, and playlist backups include saved custom groups.
- Music Library now exposes saved custom playlists with play/delete actions, so saved Smart Mixes are discoverable after creation.
- Library Health next actions now prioritize broken audio paths, route issue states to Results, and disable the action while a scan is running.
- Smart Playlist imports now match exported M3U/PLS/XSPF/WPL entries by title labels, generated filenames, stored paths, URLs, and decoded XML entities.
- Format conversion now posts real source blobs to the FFmpeg worker, stores worker output blobs for download, and surfaces missing-source/worker-output failures instead of simulating progress.
- DSD conversion now runs tasks sequentially against the worker, updates only the active task from each worker response, and surfaces missing-source/worker-output failures instead of completing against a fake 1 KB blob.
- Audio processing readiness now feeds `processingCapabilities` through `__MIMI_FFMPEG_WASM_LOADED__`, and FFmpeg load failures are visible in `ffmpegLoadError` instead of being swallowed silently.

### Verified

- Targeted tests passed across crossfade, journal, Smart Mix, library, format conversion, DSD, and FFmpeg loading slices.
- Type checks and production build passed.
- Local browser smoke on `http://localhost:3025` reported title `MIMI Music Player` and 0 console errors.
- Full Vitest suite passed: 71 files, 362 tests.

## 2026-05-20

### Added

- Search command center supports `/pause`, `/next`, `/prev`, and `/volume 60` backed by real audio store actions.
- Visual settings exposes Cinematic, Balanced, and Battery performance presets backed by the V8 performance store.
- Smart Playlist usable rule builder and pure rule engine.
- Library Health actionable results, issue ignore flow, and stable report export.
- Search `/sleep` command execution through the real sleep timer store.
- Smart Mix Sessions MVP with deterministic session helper, store, and widget.
- Local Listening Journal with persisted day notes and panel routing.

### Changed

- Typed Stats dashboard view models for overview metrics and daily history.
- Typed V8 audio snapshot passed through render context instead of reading `_currentMusicTime`.

### Fixed

- Fixed final TypeScript/build/smoke blockers, including event typing, theme color parsing, nullable narrowing, command expectations, and local `noise.svg` asset references.
- Stabilized the full Vitest suite by setting an explicit 10s per-test timeout for import-heavy jsdom tests.

### Verified

- Targeted tests passed: 11 files, 46 tests.
- Full test suite passed: 48 files, 293 tests.
- `npm run build` passed.
- Local smoke passed on `http://localhost:3025`: title `MIMI Music Player`, Search panel opened, 0 console errors, 0 page errors, 0 404s.

## 2026-05-17

### Added

- Queue multi-select actions, play-next pure helpers, and queue store action wiring.
- Built-in audio effect presets, morph interpolation, safe preset persistence, and rebuilt Audio Effects panel.
- Audio processing capability detection plus preview-only/export-disabled conversion and crossfade states.
- Recommendation input helper, store decoupling, and static `AudioLiquidV8` UI store import.

### Verified

- Queue, audio effects, processing capabilities, and recommendation targeted tests passed.

## 2026-05-09

### Added

- Initial v0.2.0 feature baseline: AI emotional liner notes, Resonance Totem visualization, SpectrumRing refinement, immersive visualization system, modular project structure, and shared Glass component foundation.