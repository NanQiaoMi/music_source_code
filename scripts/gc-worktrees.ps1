<#
.SYNOPSIS
  Worktree garbage collection for MIMI (S0-5). Default is dry-run.

.DESCRIPTION
  Removes clean, non-main, non-baseline git worktrees. Dirty or locked worktrees are always
  skipped; baseline/checkpoint/arch-perf worktrees are protected by name. Requires -Apply
  to actually remove anything.

.EXAMPLE
  powershell -File scripts/gc-worktrees.ps1
  powershell -File scripts/gc-worktrees.ps1 -Apply
#>
param([switch]$Apply)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'git not found in PATH'
}

$repo = (& git rev-parse --show-toplevel).Trim()
$entries = @()
$block = @{}
foreach ($line in (& git worktree list --porcelain)) {
  if ([string]::IsNullOrWhiteSpace($line)) {
    if ($block.Count -gt 0) {
      $entries += ,@{ worktree = $block['worktree']; branch = $block['branch']; locked = $block['locked'] }
      $block = @{}
    }
    continue
  }
  $pair = $line -split ' ', 2
  $block[$pair[0]] = if ($pair.Length -gt 1) { $pair[1] } else { $true }
}
if ($block.Count -gt 0) {
  $entries += ,@{ worktree = $block['worktree']; branch = $block['branch']; locked = $block['locked'] }
}

$before = $entries.Count
$removed = 0
$keptDirty = 0

foreach ($entry in $entries) {
  $path = $entry.worktree
  if (-not $path) { continue }
  if ($path -eq $repo) { continue }
  if ($path -match 'arch-perf|checkpoint') { continue }
  if ($entry.locked) { continue }
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "[gc] skip (missing path): $path"
    continue
  }

  $status = & git -C $path status --porcelain 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[gc] skip (not a worktree): $path"
    continue
  }
  if ($status) {
    $keptDirty += 1
    Write-Host "[gc] skip (dirty): $path"
    continue
  }

  if ($Apply) {
    & git worktree remove --force $path
    if ($LASTEXITCODE -eq 0) { $removed += 1 } else { Write-Host "[gc] remove failed: $path" }
  } else {
    Write-Host "[gc] would remove (clean): $path"
  }
}

if ($Apply) {
  & git worktree prune
}

$after = ((& git worktree list) | Measure-Object -Line).Lines
Write-Host ("[gc] worktrees before={0} after={1} removed={2} dirtySkipped={3} apply={4}" -f $before, $after, $removed, $keptDirty, [bool]$Apply)
if (-not $Apply) {
  Write-Host '[gc] dry-run only; re-run with -Apply to remove the clean candidates above.'
}
