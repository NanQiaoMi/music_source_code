# 2026-05-25 Audio Source Runtime Stability

## Scope

This pass continues the current MIMI Music Player stabilization track. It intentionally avoids a large visual redesign, avoids rewriting the protected V7 Home View / Player View / fullscreen lyrics behavior, preserves existing `localStorage` and IndexedDB keys/shapes, and adds no new dependencies.

## Completed Work

### Runtime Stability

- Reconfirmed the safe Windows validation sequence: `eslint -> vitest -> tsc -> build -> clean-port/dev -> HTTP smoke`.
- Reconfirmed `scripts/clean-port.js 3025` can terminate the existing listener and report the port as available.
- Avoided running `npm run build` or `npm run clean` against a live dev server; the build step was run only after clearing the old 3025 listener.
- Restarted `npm run dev` after build; the command ran `clean-port`, cleaned `.next`, and served Next.js on port 3025.
- Verified `/` and `/data-manager` by HTTP after the clean dev restart.

### Audio Source And Playback Integrity

Current source now includes and was verified through tests/build/smoke:

- `src/lib/audio/playableAudioSource.ts` centralizes playable-source checks and user-facing missing-source messages.
- `src/store/audioStore.ts` rejects missing-source songs in `playSong`, `playQueue`, `appendSongsAndPlay`, and play toggles without selecting or queueing the unavailable song.
- `src/components/player/MusicCardStack.tsx` keeps empty demo cards out of playback and queue writes.
- `src/components/player/SearchPanel.tsx`, `src/components/player/QueuePanel.tsx`, and `src/lib/search/commandExecutor.ts` route playback through safe audio-store actions.
- `src/lib/history/historyPlayback.ts` resolves compact `HistorySong` entries back to current library `Song` entries before replay.
- `src/components/library/HistoryPanel.tsx` warns for unavailable historical sources instead of replaying stale compact history objects.
- `src/lib/audio/AudioEngine.ts` creates `AudioContext` lazily; startup inspection and EQ/volume reads no longer instantiate a browser audio context.
- `src/hooks/useAudioPlayer.ts` initializes the audio graph on actual playback paths rather than on mount.
- `src/components/library/LocalMusicManager.tsx` now shows a visible unsupported-file import error, including selected filenames, when a user chooses files with no supported audio.
- `src/components/library/LocalMusicManager.test.tsx` covers the unsupported-file path and verifies no IndexedDB save is attempted for non-audio selections.
- Isolated Chrome/CDP smoke imported a real generated WAV fixture through `/data-manager`, verified one `VibeMusicDB/localMusic` record, refreshed home, and confirmed the imported `Smoke` / `Codex` song replaced demo content.

### Code Health And Docs

- Confirmed current `src/app/page.tsx`, `src/app/data-manager/page.tsx`, and `src/hooks/useMusicLibrarySync.ts` are readable as UTF-8. PowerShell may still display Chinese as mojibake depending on code page, but Node UTF-8 inspection shows the source text is readable.
- Repaired `src/components/widgets/GlassRadarWidget.tsx` visible emotion-matrix copy: expanded title, quadrant labels, per-song mark toast, and global emotion toast now render readable Chinese.
- Narrowed the same widget's Framer Motion transform callback from `LegacyAny[]` to a typed `number[]` input with defaults.
- Added `src/components/widgets/GlassRadarWidget.test.tsx` to guard readable expanded radar labels.
- Added `src/components/library/directoryInputProps.ts` so Chromium/WebKit folder-import attributes are typed locally, allowing `LocalMusicManager` and `DataManager` to remove directory-upload `@ts-expect-error` comments without global React type augmentation.
- Replaced corrupted active `docs/nbl/ROADMAP.md` content with a readable current-state roadmap and priority list.
- Replaced corrupted active changelog tail entries with readable current history.
- Updated `docs/nbl/plans/INDEX.md` with this implementation record.

## Validation Results

Run order and results:

1. `npx eslint src --max-warnings=99999`
   - Passed with 0 errors.
2. `npm run test -- --run`
   - Passed: 93 files, 452 tests.
3. `npx tsc --noEmit --incremental false --pretty false`
   - Passed.
4. `node scripts/clean-port.js 3025`
   - Found and terminated old 3025 listeners during this pass; latest run terminated PID `273648` and reported port 3025 available.
5. `npm run build`
   - Passed. Next.js reported static routes `/`, `/_not-found`, and `/data-manager`.
6. `npm run dev`
   - Started successfully on port 3025 after `clean-port` and `.next` cleanup; latest dev start reported ready in 333 ms.
7. HTTP smoke:
   - `http://127.0.0.1:3025/` returned 200, length 160311.
   - `http://127.0.0.1:3025/data-manager` returned 200, length 32251.

## Browser Smoke

Chrome CDP/headless smoke loaded both routes after the clean dev restart. The Codex in-app Browser Node bridge returned `unsupported call` in this session, and local Playwright/Puppeteer were not installed, so system Chrome CDP/headless checks were used without adding dependencies.

A second isolated Chrome/CDP import smoke used a fresh temporary Chrome profile and generated `scratch/Codex - Smoke.wav` (88244 bytes). It loaded `/data-manager`, confirmed the empty local-library state, set the audio file input with CDP `DOM.setFileInputFiles`, waited for IndexedDB, then navigated to `/` to verify refresh recovery. Result: one `VibeMusicDB/localMusic` record with title `Smoke`, artist `Codex`, file `Codex - Smoke.wav`, type `audio/wav`, and 88244 bytes; home displayed `1 songs`, `Smoke`, and `Codex`; demo title text was absent; Next error portal text was absent; console errors/warnings and JavaScript exceptions were 0.

Home page:

- Title: `MIMI Music Player`
- URL: `http://127.0.0.1:3025/`
- Primary text included `Music Library`, `3 songs`, `Lyrics`, `Library`, `Discover`, `Tools`, `Manage music`, demo cards, and the readable Chinese card-play hint.
- Headings included `Music Library`, `Welcome to VIBE Player`, and the readable Chinese empty now-playing heading.
- Buttons included `Lyrics`, `Library`, `Discover`, `Tools`, and readable Chinese lyrics search/manual import actions.
- Next dev portal was present only as the normal empty development overlay.
- Console errors/warnings: 0.
- JavaScript exceptions: 0.
- Log errors/warnings: 0.
- Focused regression coverage verified expanded `GlassRadarWidget` text includes `情绪偏好矩阵`, `高能明亮`, `忧郁阴影`, `平静低沉`, and `欢快明亮`.

Data manager page:

- Title: `MIMI Music Player`
- URL: `http://127.0.0.1:3025/data-manager`
- Primary text included readable Chinese labels for the data manager title, local music tab, data tab, drag-import empty state, supported audio formats, file/folder selection, empty library state, mini-player prompt, and paused status.
- Heading included the readable Chinese data manager title.
- Buttons included readable Chinese labels for local music, data management, choose file, and choose folder.
- Next dev portal was present only as an empty 0x0 element.
- Console errors/warnings: 0.
- JavaScript exceptions: 0.
- Log errors/warnings: 0.

Note: the first CDP wrapper process returned a non-zero exit only because Windows still held the temporary Chrome profile during deletion. The collected page evidence was complete, and a follow-up cleanup removed the temp profile successfully.

## Remaining Risks

- Native OS file-picker UI was not manually clicked; the verified import smoke used CDP `DOM.setFileInputFiles` against a real WAV file in an isolated Chrome profile.
- Headless smoke verified import persistence and home refresh recovery but did not click the imported song to confirm audible playback after a user gesture.
- `audioStore` still acts as a compatibility hub around player, queue, recommendation, playlist, and EQ state. Further decoupling should be incremental and selector/coordinator-based.
- V8 visualization effects and legacy browser/Electron/jsmediatags seams still contain broad `any`, `LegacyAny`, and `eslint-disable` debt.
- Archived docs may still contain historical mojibake; active `ROADMAP.md`, `CHANGELOG.md`, and plan index are now readable.
- Panel-level smoke did not exhaustively click every panel in this pass; the CDP smoke covered route load, console/exception state, and major DOM markers, while the new widget test covers the repaired emotion radar copy.

## Next Recommendations

1. Run one manual native file-picker/audio-output smoke with a local MP3/FLAC/WAV: import through the visible picker, click the imported song after a user gesture, refresh, and verify audible playback plus missing-source feedback after deleting the stored blob.
2. Continue a low-risk `audioStore` boundary pass: extract selectors and coordinator helpers without changing persisted keys or backup fields.
3. Add targeted panel smoke/tests for Search, Queue, Lyrics Search/Import/Cover Editor, Backup Restore, Format Converter, DSD, Track Cutter, Crossfade, Stats, Smart Playlist, Smart Mix, Listening Journal, and Professional Tools.
4. Continue replacing V8 effect-local `any` state with narrow private interfaces, one effect at a time.