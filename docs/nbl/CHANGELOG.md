# Changelog

## 2026-10-12

### Added

- Added a deterministic LRC lyric timeline, stable short-line layout, and RAF-projected lyric playback clock for the Folia-inspired `温光浮字` stage.

### Changed

- Reworked `cinematicLyricDrift` into a layered lyric scene with estimated glyph highlighting, restrained lyric trails, warm light beams, bounded dust, song-info idle state, and reduced-motion behavior.
- Updated the existing effect setting labels to match their new visual roles; preserved the effect ID and settings shape.
- Refreshes the current media time and duration from the existing audio element when the visualization returns from a hidden page.

### Verified

- Focused Vitest checks passed: 3 files, 33 tests. Changed-file ESLint, strict TypeScript, Prettier, and `git diff --check` passed.
- `npm run build` passed and generated 28 static pages plus the existing API routes. Next reported the workspace's multiple-lockfile root warning and an outdated Browserslist data notice.
- A local production preview confirmed the effect selector and the no-track ambient state. Real audio playback, lyric progression, rate changes, seeks, track changes, narrow-screen playback, and OS reduced-motion playback were not verified because the preview had no playable audio session.

### Reworked

- Replaced the earlier rejected blended treatment with a whole-song Folia Lumiere-inspired lyric MV: deterministic intro/lyric/interlude/instrumental/outro shots, seven stage-light profiles, and lights-out/flare/focus transitions. The previous 2026-10-12 rendering entry above is historical and was superseded by this rework.
- Preserved independent simultaneous LRC rows and estimated grapheme reveal timing; connected the existing motion-speed and glow settings to camera/light/fog/dust and stage illumination without changing persisted setting fields.

### Verified

- Focused Vitest checks passed: 6 files, 79 tests. Changed-file ESLint, Prettier, `git diff --check`, strict TypeScript, and the Next.js 16 webpack production build passed; the build generated 28 static pages.
- The local app returned HTTP 200 after the build. Dynamic lyric-shot playback, pause/rate/seek, and reduced-motion visuals remain unverified because the open player was already near the end of a track and advanced naturally; playback was not repositioned.

## 2026-09-30

### Added

- Added a compact fixed playback dock for `/data-manager`; it reads the existing playback and queue stores, and the manager route hosts the existing queue panel while the home floating player stays on the home page.
- Added library search failure feedback and retry states, including a playlist search route response for provider-wide failures.
- Added regression coverage for client-side library navigation, playback-store fallback, queue divergence/removal and duplicate-ID boundaries, manager queue-panel open/close, search failure and out-of-order request boundaries (including keyword edits and unmount/remount), responsive library sections and script cards, reduced-motion behavior, and the source manager tabs.

### Changed

- Changed the toolbar and navigation-island library entries to client-side navigation so route changes retain the root audio owner.
- Unified the seven library sections around a responsive 1720px content shell, glass storage dashboard, and bottom safe space; aligned the five-tab source manager modal and narrow script cards with the same cyan/blue glass styling and scoped reduced-motion behavior.
- Updated playlist search to return 503 only when at least one provider was attempted and all attempted providers failed; successful empty results, partial successes, and no-attempt results keep their success behavior and schema.

### Fixed

- Fixed return-to-home navigation resetting playback by moving app bootstrap to the persistent root and making persisted playback restoration run once per client application lifecycle; failed service initialization can retry without overwriting playback changes.
- Fixed manager next/previous actions to align by the active song ID; if the playing song was removed from the queue, Next selects the visible current-index candidate and Previous selects the item before it. Single-item playback remains available, and shuffle keeps its existing random behavior.
- Fixed the manager queue button so it opens the existing QueuePanel on `/data-manager` and resets shared panel state when the panel closes.
- Fixed the dock display to follow the home floating player’s PlayerStore fallback when AudioStore has no current song.
- Fixed duplicate-song queue navigation to preserve QueueStore.currentIndex when that index points to the active song.
- Fixed queue-panel duplicate entries so only the active index is highlighted and a single-row removal preserves other entries with the same song ID.
- Fixed aggregate search failures being shown as empty results; successful empty results remain distinguishable from request failures.
- Fixed stale library-search requests from replacing newer results/errors or clearing newer loading state after source, mode, or keyword changes.
- Fixed in-flight searches from an unmounted library-search tab writing into shared search state after the tab is remounted.
- Fixed a blank library workspace after reload when Zustand restored a non-default active section before the Keep-Alive visited-section set caught up; the restored section now renders immediately and stays mounted after switching away.
- Fixed the source-management modal and its matrix/script switches to respect the system reduced-motion preference without changing homepage motion.
- Fixed narrow source-script rows so descriptive text can wrap while switch and delete actions remain usable.
- Replaced the manager queue-panel test's fixed delay with a condition-based wait for lazy content.

### Verified

- Added regression coverage for one-time persisted playback restoration, retry-safe initialization, and manager-to-home client navigation while the root audio owner stays mounted. Focused result: 5 files, 26 tests passed; queue/search/listening-insights smoke result: 3 files, 32 tests passed.
- `npx tsc --noEmit --incremental false --pretty false`, scoped ESLint, Prettier check, and `git diff --check` passed for the playback-continuity change; `npm run build` passed and generated both `/` and `/data-manager`.
- A manual transition with a real authenticated online track was not run; playback continuity is covered by store/bootstrap regression tests, not claimed as live-provider evidence.
- Focused regression suite passed: 20 files, 128 tests, including persisted-section hydration, the manager queue-panel host, duplicate-ID queue alignment/removal, deferred search-request races across edits and unmount/remount, reduced-motion behavior, queue/search stores, and listening-insights smoke tests.
- `npx tsc --noEmit --incremental false --pretty false`, scoped ESLint over changed TS/TSX files, Prettier over changed files, and `git diff --check` passed.
- `npm run build` passed and generated 28 static pages plus `/api/playlist/search`. Next emitted a workspace-root warning because both the primary repository and isolated worktree contain a `package-lock.json`.
- After the `--no-ff` merge into `master` (`901c6a5`), the same focused suite (20 files / 128 tests), TypeScript check, changed-file ESLint, Prettier, diff check, and production build passed again; the root build generated `/data-manager` and `/api/playlist/search` without the isolated-worktree lockfile warning.
- Browser review passed for both library entry paths, all seven sections at 1024px, 1280px, 1440px, and 1780px, 320px source-script cards, the five source-modal tabs, and the persisted non-default section after a production-page reload. Search failure and retry were visible at 375px, 768px, 1024px, 1280px, 1440px, and 1780px. The document stayed within each viewport; the content shell capped at 1720px and reserved 128px at the bottom from 1024px upward. Reduced-motion behavior is component-tested but was not checked through an OS preference toggle in the browser.
- Real audio-continuity checks for a currently playing track, paused track, or live provider were not run: the isolated browser preview had no current playback session and no authenticated online provider. Store tests cover those state boundaries; they are not runtime audio evidence.

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
