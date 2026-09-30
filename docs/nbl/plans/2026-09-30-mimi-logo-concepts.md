# MIMI Music Player Logo Concept Prototypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `nbl.parallel-subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three visually distinct, reviewable SVG logo candidates and a comparison board while leaving the production logo and application behavior unchanged.

**Architecture:** Keep each candidate as an independent, transparent SVG under the approved design-spec asset directory. Create a self-contained comparison SVG that shows all three candidates on dark and light surfaces, as monochrome variants, on launcher tiles, and at 64px, 22px, and 16px. Do not edit production logo resources or application source.

**Tech Stack:** Plain SVG 1.1 and the existing MIMI Aurora Purple color token; PowerShell XML parsing for file-integrity checks and browser rendering for visual review.

---

## File Map

| File                                                      | Responsibility                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `docs/nbl/specs/assets/mimi-logo-concepts/option-a.svg`   | Geometric M with cat-ear peaks and one short audio-pulse accent.                                            |
| `docs/nbl/specs/assets/mimi-logo-concepts/option-b.svg`   | Minimal cat-face silhouette with a negative-space rhythm mark; no tiny eyes or whiskers.                    |
| `docs/nbl/specs/assets/mimi-logo-concepts/option-c.svg`   | Thick continuous M/melody curve ending in a restrained cat-tail cue.                                        |
| `docs/nbl/specs/assets/mimi-logo-concepts/comparison.svg` | Self-contained review sheet with the three marks, surface/monochrome/launcher treatments, and target sizes. |
| `docs/nbl/specs/2026-09-30-mimi-logo-design.md`           | Approved brief; modify only if visual constraints need correction.                                          |
| `docs/nbl/plans/2026-09-30-mimi-logo-concepts.md`         | This implementation and verification record.                                                                |

Do not modify `public/logo.svg`, `src/components/layout/Logo.tsx`, `src/app/layout.tsx`, or `src/components/layout/HeaderToolbar.tsx`. The last file has an unrelated user change in the current workspace and must remain unstaged and untouched.

## Task 1: Create Candidate A — M Wave Cat-Ear Mark

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: Draw the 64×64 SVG master**

Create `docs/nbl/specs/assets/mimi-logo-concepts/option-a.svg` with a fixed `viewBox="0 0 64 64"`, transparent background, a broad white geometric M whose two upper peaks also read as cat ears, and one compact Aurora Purple pulse detail. Keep the mark centered inside a 4-unit safe margin. The artwork is an icon only: do not add the MIMI wordmark. Use filled paths rather than hairline strokes; do not use gradients, blur, filters, or a tile background. Add an SVG `<title>` and `<desc>` describing this as the M-wave cat-ear concept.

- [ ] **Step 2: Check the master’s structure**

Run PowerShell `[xml](Get-Content -Raw 'docs/nbl/specs/assets/mimi-logo-concepts/option-a.svg')` and confirm it parses as SVG with a 64×64 viewBox, one white primary shape, and a single purple accent shape.

## Task 2: Create Candidate B — Rhythm Cat Face

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: Draw the 64×64 SVG master**

Create `docs/nbl/specs/assets/mimi-logo-concepts/option-b.svg` with the same transparent canvas, 4-unit safe margin, white primary fill, and single Aurora Purple accent. This is an icon only; do not add the MIMI wordmark. Form a simplified feline face using two ear points and a single enclosing cheek/jaw contour; create the rhythm cue from one or two broad negative-space cuts in the lower half. Do not draw eyes, whiskers, mouth, or small decorative marks. Add an SVG `<title>` and `<desc>` describing this as the rhythm cat-face concept.

- [ ] **Step 2: Check the master’s structure**

Run PowerShell `[xml](Get-Content -Raw 'docs/nbl/specs/assets/mimi-logo-concepts/option-b.svg')` and confirm it parses as SVG with a 64×64 viewBox, white primary geometry, and no more than one purple accent shape.

## Task 3: Create Candidate C — Tail Melody Mark

**Dependencies:** None
**Parallelizable:** Yes

- [ ] **Step 1: Draw the 64×64 SVG master**

Create `docs/nbl/specs/assets/mimi-logo-concepts/option-c.svg` with the same transparent canvas and palette. This is an icon only; do not add the MIMI wordmark. Use one visually continuous, thick white path to suggest an M-shaped melody route; let its terminal curve imply a cat tail without forming a separate character. Add one compact Aurora Purple signal node. Keep the minimum path width equivalent to at least 6 units on the 64-unit canvas so the curve does not disappear at 16px. Add an SVG `<title>` and `<desc>` describing this as the tail-melody concept.

- [ ] **Step 2: Check the master’s structure**

Run PowerShell `[xml](Get-Content -Raw 'docs/nbl/specs/assets/mimi-logo-concepts/option-c.svg')` and confirm it parses as SVG with a 64×64 viewBox, a thick continuous primary path, and a single purple accent.

## Task 4: Build the Comparison Board

**Dependencies:** Task 1, Task 2, Task 3
**Parallelizable:** No (the board must use the final geometry of all three masters)

- [ ] **Step 1: Compose all options on one board**

Create `docs/nbl/specs/assets/mimi-logo-concepts/comparison.svg`, sized 1600×1080 with a light neutral page background. Arrange A, B, and C in labeled columns. For each candidate, include the white/purple master at 64px, 22px, and 16px on both deep-carbon and light swatches; a deep-carbon monochrome version at 64px, 22px, and 16px on a light swatch; and an app-icon preview using a deep-carbon rounded square. Repeat the actual candidate geometry in each treatment; use SVG presentation attributes to recolor paths instead of using screenshot images. Include concise labels for “主标 / 深色背景”, “主标 / 浅色背景”, “深色单色版 / 浅色背景”, “16px”, “22px”, “64px”, and “启动图标”.

- [ ] **Step 2: Check the board’s structure**

Run PowerShell `[xml](Get-Content -Raw 'docs/nbl/specs/assets/mimi-logo-concepts/comparison.svg')` and confirm the board parses as SVG, has a 1600×1080 viewBox, and contains all three labeled columns, all three target sizes on dark and light swatches, the monochrome previews, and the launcher tiles.

## Task 5: Visual Review and Branch Handoff

**Dependencies:** Task 4
**Parallelizable:** No (visual acceptance depends on the complete board)

- [ ] **Step 1: Review the comparison SVG in a browser**

Open `docs/nbl/specs/assets/mimi-logo-concepts/comparison.svg` in a browser and inspect every column at the rendered sizes specified on the board. Confirm the M/cat/audio balance remains readable at 22px and 16px; white/purple is visible on deep carbon; the deep-carbon monochrome is visible on light; the launcher tile is consistent; no candidate relies on glow, thin lines, or facial micro-detail.

- [ ] **Step 2: Confirm production and user changes are untouched**

Run `git status --short --branch` and `git diff -- public/logo.svg src/components/layout/Logo.tsx src/app/layout.tsx src/components/layout/HeaderToolbar.tsx`. Confirm the four production files have no changes from this work and leave the existing `HeaderToolbar.tsx` diff unstaged.

- [ ] **Step 3: Stage only the design brief, plan, and candidate assets**

Run `git add docs/nbl/specs/2026-09-30-mimi-logo-design.md docs/nbl/plans/2026-09-30-mimi-logo-concepts.md docs/nbl/specs/assets/mimi-logo-concepts/option-a.svg docs/nbl/specs/assets/mimi-logo-concepts/option-b.svg docs/nbl/specs/assets/mimi-logo-concepts/option-c.svg docs/nbl/specs/assets/mimi-logo-concepts/comparison.svg`. Then run `git diff --cached --check` and `git diff --cached --stat`. Do not use `git add -A` or stage the unrelated toolbar edit.

- [ ] **Step 4: Commit the reviewable concept set**

Run `git commit -m "feat(brand): add logo concept previews"` on `feature/brand-logo-concepts`. Do not merge the concept branch yet; the user must select a candidate before production logo integration.

## Verification Notes

- Automated unit tests and app build are not applicable to isolated documentation SVGs; this work changes no application runtime code.
- XML parsing checks catch malformed SVG source. The decisive acceptance check is browser review of the full comparison board at 64px, 22px, and 16px on both light and dark surfaces.
- Do not report the logo as integrated into the application. The deliverable is a review set; final production adoption depends on the user selecting one candidate.

---

**Execution Mode:** parallel
