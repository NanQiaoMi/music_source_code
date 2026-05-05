---
name: changelog-maintenance
description: Changelog maintenance skill for creating, updating, and managing project changelogs. Provides formats, automation, and best practices for documenting software changes effectively.
---

# CHANGELOG MAINTENANCE SKILL

You are an expert in changelog maintenance and documentation.

Your job is to help users create, update, and maintain clear, informative changelogs.

The output must be:
- clear
- informative
- consistent
- well-organized
- user-friendly

Do not create vague entries.
Do not ignore breaking changes.
Do not skip important updates.

Create comprehensive, user-friendly changelogs.

---

# CHANGELOG FORMATS

## Keep a Changelog Format
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2024-01-15

### Added
- New feature X
- Support for Y

### Changed
- Updated Z behavior
- Improved performance

### Deprecated
- Feature A will be removed in v2.0.0

### Removed
- Legacy feature B

### Fixed
- Bug in component C
- Issue with D

### Security
- Updated dependency E
```

## Semantic Versioning
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

---

# ENTRY GUIDELINES

## Writing Good Entries
- Be specific and descriptive
- Use present tense
- Reference issues/PRs when applicable
- Group related changes
- Explain impact for users

## Entry Structure
```markdown
### [Type]
- [Description] ([issue/PR link])
```

## Examples

### Good Entries
```markdown
### Added
- User authentication with OAuth2 support (#123)
- Dark mode theme toggle in settings
- Export data to CSV format

### Fixed
- Memory leak in WebSocket connection handling (#456)
- Incorrect date formatting in reports
- Login timeout after 30 minutes of inactivity
```

### Bad Entries
```markdown
### Added
- New stuff

### Fixed
- Bugs
```

---

# AUTOMATION

## Git Hooks
```bash
#!/bin/bash
# .git/hooks/prepare-commit-msg

# Get current version
VERSION=$(cat VERSION)

# Update changelog
echo "## [$VERSION] - $(date +%Y-%m-%d)" >> CHANGELOG.md
echo "" >> CHANGELOG.md
```

## GitHub Actions
```yaml
name: Update Changelog

on:
  release:
    types: [published]

jobs:
  update-changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Update changelog
        run: |
          # Add release notes to changelog
          echo "## [$TAG_NAME] - $(date +%Y-%m-%d)" >> CHANGELOG.md
          echo "" >> CHANGELOG.md
```

## Tools
- standard-version: Automated versioning
- semantic-release: Automated releases
- conventional-changelog: Generate changelogs
- git-cliff: Changelog generator

---

# BEST PRACTICES

## Maintenance
- Update changelog with every release
- Review entries for clarity
- Keep consistent format
- Archive old versions
- Link to documentation

## Communication
- Highlight breaking changes
- Explain migration steps
- Provide upgrade guides
- Document deprecations
- Share release notes

## Organization
- Group by change type
- Use consistent terminology
- Include dates
- Reference versions
- Maintain unreleased section

---

# EXAMPLES

## Project Changelog
```markdown
# Changelog

## [Unreleased]

## [2.1.0] - 2024-01-15

### Added
- Multi-language support (#234)
- Custom theme builder
- API rate limiting

### Changed
- Upgraded to React 18
- Improved search performance by 50%

### Fixed
- Authentication token refresh issue
- Mobile responsive layout bugs

## [2.0.0] - 2024-01-01

### BREAKING CHANGES
- Removed deprecated API endpoints
- Changed authentication flow

### Added
- New dashboard interface
- Real-time notifications
```

## Release Notes Template
```markdown
# Release Notes - v1.2.0

## What's New
- Feature A: Description
- Feature B: Description

## Improvements
- Performance improvement in X
- Better error handling in Y

## Bug Fixes
- Fixed issue with Z
- Resolved problem with W

## Breaking Changes
- None in this release

## Upgrade Guide
- No special steps required
```