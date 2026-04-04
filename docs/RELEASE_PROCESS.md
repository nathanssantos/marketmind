# Release Process

## Version Locations (ALL must be updated)

| Location | File | Field |
|----------|------|-------|
| Root | `package.json` | `version` |
| Backend | `apps/backend/package.json` | `version` |
| Electron | `apps/electron/package.json` | `version` |
| README badge | `README.md` | `![Version](...badge/version-X.Y.Z...)` |
| Changelog | `CHANGELOG.md` | New `## [X.Y.Z]` entry at top |
| Landing site | `marketmind-site/src/config/site.ts` | `stats.version` |

## Steps

### 1. Pre-release checks

```bash
pnpm test
pnpm --filter @marketmind/backend type-check
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/electron lint
```

All must pass. No exceptions.

### 2. Bump version

Update all 3 `package.json` files and README badge to `X.Y.Z`.

### 3. Update CHANGELOG.md

Add entry at the top following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
### Fixed
### Changed
### Removed
```

### 4. Commit, tag, push

```bash
git add -A
git commit -m "chore: bump version to vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
```

### 5. Create GitHub release

```bash
gh release create vX.Y.Z --title "vX.Y.Z — Release Title" --notes "Release notes here"
```

### 6. Update landing site

In the `marketmind-site` repo:
- Update `src/config/site.ts` → `stats.version` to `vX.Y.Z`
- Commit and push (Vercel auto-deploys)
