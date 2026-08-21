# Existing Feature Release Checklist

Use this checklist before handing off an iteration that changes existing player, library, lyrics, visualization, backup, or settings workflows.

## Automated Verification

Run the focused smoke suite for the core daily workflows:

```bash
npm test -- --run src/store/queueStore.test.ts src/store/searchStore.test.ts src/utils/listeningInsights.test.ts
npm run build
npm run dev
```

For a static export preview, use:

```bash
npm run build
npx serve@latest out -l 3025
```

Open `http://localhost:3025/` and keep DevTools console visible while checking the flows below.

## Manual Product Checks

### Import Music

- [ ] Import at least one local audio file.
- [ ] Confirm title, artist, duration, and cover fallback render without blocking playback.
- [ ] Refresh the page and confirm imported library data still appears.

### Play, Pause, Next, Previous

- [ ] Play a track from the library or search results.
- [ ] Pause and resume without losing current time.
- [ ] Use next and previous controls with a queue of at least three tracks.
- [ ] Confirm the current song stays synchronized across player panels.

### Queue Edit And Persistence

- [ ] Add multiple tracks to the queue.
- [ ] Use play next, remove, and clear played actions.
- [ ] Confirm current item markers and disabled states are accurate.
- [ ] Refresh the page and confirm the persisted queue does not restore oversized cover data.

### Search And Play From Result

- [ ] Search by exact title, partial title, artist, and album.
- [ ] Confirm exact title matches rank before weaker matches.
- [ ] Play a result directly.
- [ ] Add a result to queue and play next.
- [ ] Confirm recent search chips update without duplicating empty queries.

### Lyrics Search And Manual Import

- [ ] Open lyrics for a song without lyrics and confirm the recovery state appears.
- [ ] Search for lyrics and confirm source state changes while searching.
- [ ] Manually import timestamped lyrics.
- [ ] Confirm imported lines render in the visualizer and survive panel reopen.
- [ ] Apply Compact, Focus, and Karaoke presets and confirm readability.

### Visualization Canvas And WebGL Effect

- [ ] Open visualization and confirm the default effect is not blank.
- [ ] Switch to at least one Canvas effect.
- [ ] Switch to at least one WebGL effect, if WebGL is available.
- [ ] Lower performance level and confirm quality settings update.
- [ ] Trigger or inspect fallback controls for no effect, WebGL unavailable, or low FPS states.

### Stats Update After Playback

- [ ] Play enough of a track to create a listening record.
- [ ] Open listening history and confirm rankings update.
- [ ] Open stats and confirm trend, completion, skip balance, and next action sections render.
- [ ] Confirm empty or low-data states remain actionable.

### Backup Export And Restore Preview

- [ ] Open backup panel and generate a backup preview.
- [ ] Confirm included stores and schema version are visible.
- [ ] Start restore from a valid backup and review the preview before applying.
- [ ] Try an incompatible major schema version sample and confirm restore is rejected with a visible error.
- [ ] Cancel restore preview and confirm app state is unchanged.

### Settings And Shortcut Edit

- [ ] Search settings by label and description.
- [ ] Edit one keyboard shortcut.
- [ ] Attempt a duplicate shortcut and confirm conflict warning blocks save.
- [ ] Clear one shortcut and restore defaults.
- [ ] Refresh the page and confirm persisted settings still load.

## Handoff Notes

- [ ] Record the commands run and their results in the final handoff.
- [ ] Note any skipped manual checks and why they were skipped.
- [ ] Confirm no `.env`, `credentials.json`, generated logs, or local-only artifacts were staged.
- [ ] Confirm the work remains on a non-`master` branch until reviewed.
