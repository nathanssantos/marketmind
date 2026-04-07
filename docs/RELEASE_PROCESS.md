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

Pushing the tag triggers:
- **Desktop builds** via `.github/workflows/desktop-release.yml` (macOS DMG+ZIP, Windows NSIS)
- electron-builder uploads installers to the GitHub Release automatically

### 5. Create GitHub release (before tag push)

Create the release first so electron-builder can attach assets to it:

```bash
gh release create vX.Y.Z --title "vX.Y.Z — Release Title" --notes "Release notes here"
```

Or let electron-builder create the release automatically (it creates a draft release if none exists).

### 6. Update landing site

In the `marketmind-site` repo:
- Update `src/config/site.ts` → `stats.version` to `vX.Y.Z`
- Commit and push (Vercel auto-deploys)

### 7. Verify desktop builds

After ~10-15 minutes, check the GitHub Release for attached artifacts:
- `MarketMind-X.Y.Z-arm64.dmg` (macOS Apple Silicon)
- `MarketMind-X.Y.Z-arm64-mac.zip` (macOS auto-update package)
- `MarketMind-X.Y.Z.dmg` (macOS Intel)
- `MarketMind-X.Y.Z-mac.zip` (macOS Intel auto-update)
- `MarketMind-Setup-X.Y.Z.exe` (Windows)
- `latest-mac.yml` (macOS update manifest)
- `latest.yml` (Windows update manifest)

## Auto-Update Flow

Users with an installed version receive updates automatically:
1. App checks GitHub Releases every 24 hours (or manually via Settings → About)
2. If new version found → notification banner appears
3. User clicks "Download" → progress bar shown
4. Download complete → "Restart and Install" button
5. App restarts with new version

## Code Signing (Optional)

To enable code signing, add these secrets to the GitHub repo:

**macOS** (Apple Developer ID, $99/year):
- `CSC_LINK` — Base64-encoded .p12 certificate
- `CSC_KEY_PASSWORD` — Certificate password
- `APPLE_ID` — Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` — App-specific password for notarization
- `APPLE_TEAM_ID` — Team ID

**Windows** (Code signing certificate):
- `WIN_CSC_LINK` — Base64-encoded .pfx certificate
- `WIN_CSC_KEY_PASSWORD` — Certificate password

Without code signing:
- macOS: users must right-click → Open on first install (Gatekeeper warning)
- Windows: SmartScreen warning on first install (click "More info" → "Run anyway")
