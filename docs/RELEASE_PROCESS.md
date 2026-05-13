# Release Process

Every step below is a CLI command (or an edit to a tracked file). No GitHub UI needed.

## Branching model

- `develop` → active integration branch
- `main` → production; every release tag is cut from here
- Version bumps ship via `chore/release-vX.Y.Z` → PR to `develop` → PR `develop → main` → tag on `main`

**Never** commit version bumps directly to `main` or `develop`.

## Version locations (ALL must be updated — checklist)

App repo (`marketmind/`):
- [ ] `package.json` → `version`
- [ ] `apps/backend/package.json` → `version`
- [ ] `apps/electron/package.json` → `version`
- [ ] `README.md` → version badge
- [ ] `CHANGELOG.md` → new `## [X.Y.Z] - YYYY-MM-DD` entry at the top

Landing site repo (`../marketmind-site/`) — **separate repo, separate commit, EASY TO FORGET**:
- [ ] `src/config/site.ts` → `stats.version`

If a release ships and the site still shows the old version, this checklist was skipped.

## Steps

### 1. Pre-release checks (must all pass before bumping)

```bash
pnpm -r test:run
pnpm --filter @marketmind/backend type-check
pnpm --filter @marketmind/electron type-check
pnpm --filter @marketmind/electron lint
```

CLAUDE.md mandate: zero failing tests, zero TS errors. Abort if any fails.

### 2. Gather what's shipping

```bash
# List commits since the previous tag — drives the CHANGELOG draft
git fetch --tags
LAST_TAG=$(git describe --tags --abbrev=0)
git log --oneline "$LAST_TAG"..origin/develop
```

### 3. Cut the release branch off develop

```bash
git fetch origin
git checkout develop
git pull --ff-only
git checkout -b chore/release-vX.Y.Z
```

### 4. Bump versions (app repo)

Edit four files — use `Edit` tool, `sed -i ''`, or your editor. Exactly one occurrence each:

- `package.json`                       — `"version": "X.Y.Z"`
- `apps/backend/package.json`          — `"version": "X.Y.Z"`
- `apps/electron/package.json`         — `"version": "X.Y.Z"`
- `README.md`                          — `![Version](https://img.shields.io/badge/version-X.Y.Z-blue.svg)`

### 5. Update CHANGELOG.md

Insert at the top, following [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
### Fixed
### Changed
### Removed
### Notes
```

Fill sections from the `git log` output in step 2. Drop empty sections.

### 6. Commit + PR into develop

```bash
git add package.json apps/backend/package.json apps/electron/package.json README.md CHANGELOG.md
git commit -m "chore(release): vX.Y.Z"
git push -u origin chore/release-vX.Y.Z

gh pr create \
  --base develop \
  --head chore/release-vX.Y.Z \
  --title "chore(release): vX.Y.Z" \
  --body "Version bump + CHANGELOG for vX.Y.Z."

gh pr merge --admin --squash --delete-branch
```

### 7. Promote develop → main via PR

```bash
git checkout develop
git pull --ff-only

gh pr create \
  --base main \
  --head develop \
  --title "Release vX.Y.Z" \
  --body "$(cat <<'EOF'
Promotes develop to main for vX.Y.Z.

See CHANGELOG.md for the full list of changes.
EOF
)"

gh pr merge --admin --merge   # merge commit preserves develop history on main
```

### 8. Update landing site (separate repo — DO NOT SKIP)

#### 8a. (Optional) Refresh new-user default layout seed

Skip this step unless your day-to-day layouts have meaningfully changed
since the previous release. Otherwise jump to 8b.

The seed at `apps/electron/src/renderer/store/seed/defaultLayoutSeed.ts`
ships every new user's initial 9-preset / 6-tab setup + indicator
instances. The dumper reads it back out of your local Postgres:

```bash
# Reads DATABASE_URL from apps/backend/.env. If your DB has multiple
# users, the script lists them and exits — pass the right userId.
node --experimental-strip-types scripts/dump-default-layout-seed.ts [userId]
```

The marketing screenshots pipeline reuses the same snapshot via
`packages/mcp-screenshot/src/layoutFixture.json`. After updating the
seed, re-dump the fixture so 8b's `switchLayout('1h / 4h / 1d')` etc.
keep matching the same preset names:

```bash
psql "$(grep DATABASE_URL apps/backend/.env | cut -d= -f2-)" \
  -t -A -c "SELECT data FROM user_layouts WHERE user_id='<userId>'" \
  | python3 -m json.tool > packages/mcp-screenshot/src/layoutFixture.json

pnpm --filter @marketmind/mcp-screenshot build   # JSON copies to dist/
```

The seed update gets PR'd to develop on its own branch (see PR #604 for
the pattern); marketing screenshots ride on the release branch later.

#### 8b. Refresh marketing screenshots

```bash
# 1) Boot the renderer dev server (separate terminal, leave running)
pnpm --filter @marketmind/electron dev:web
# Confirm it answers on http://localhost:5174 (the script's default).

# 2) Build the screenshot package
pnpm --filter @marketmind/mcp-screenshot build

# 3) Run the curated marketing pass — captures 9 scenes at 4K (3840x2160)
#    dark theme + writes to ../marketmind-site/public/images/screenshot-{0..8}.png
#    Scenes: 0–4 layouts, 5 trading-profiles dialog, 6 market indicators,
#    7 BTCUSDT 1h chart with Fibonacci, 8 wallets dialog.
node scripts/marketing-screenshots.mjs
```

Stage the regenerated PNGs from the marketmind-site repo together with the
version bump in step 8c — keeps the deploy a single commit.

If a step fails:
- `MM_MCP_BASE_URL` / `MM_MCP_VIEWPORT` / `MM_MCP_SCALE` env vars override
  the defaults (see the script header).
- The script injects mock data via Playwright `addInitScript`, so no
  auth bypass and no live backend is required — but the renderer
  must be running.
- Port 5174 is sticky on macOS — kill stale vite processes (`lsof -ti :5174 | xargs kill`)
  before starting fresh, otherwise the script connects to a stale process
  on a different port and fails on later modal captures.

#### 8c. Bump site version + commit

```bash
cd ../marketmind-site
git checkout main
git pull --ff-only

# Edit src/config/site.ts → stats.version: 'vX.Y.Z'
git add src/config/site.ts public/images/screenshot-*.png
git commit -m "chore: bump version to vX.Y.Z + refresh screenshots"
git push     # Vercel auto-deploys in ~1-2 min

cd -
```

Verify https://marketmind-app.vercel.app once the deploy finishes.

### 9. Create GitHub release + tag (triggers desktop builds)

```bash
git checkout main
git pull --ff-only

# Create the release first so electron-builder attaches assets to it
gh release create vX.Y.Z \
  --target main \
  --title "vX.Y.Z — <short title>" \
  --notes "$(awk '/^## \[X.Y.Z\]/{flag=1;next}/^## \[/{flag=0}flag' CHANGELOG.md)"
```

Replace `X.Y.Z` in the `awk` pattern with the literal version — the pattern extracts the current release section from the CHANGELOG.

`gh release create` creates the tag on `main`, which triggers:
- **Desktop builds** via `.github/workflows/desktop-release.yml` (macOS DMG+ZIP, Windows NSIS)
- electron-builder uploads installers to the GitHub Release automatically

### 10. Sync local state + return to develop

```bash
git checkout develop
git pull --ff-only
git fetch --tags
```

Terminal ends on `develop`, fully up to date.

### 11. Verify desktop builds (~10-15 min after tag push)

```bash
gh release view vX.Y.Z
```

Expected assets:
- `MarketMind-X.Y.Z-arm64.dmg` (macOS Apple Silicon)
- `MarketMind-X.Y.Z-arm64-mac.zip` (macOS auto-update package)
- `MarketMind-X.Y.Z.dmg` (macOS Intel)
- `MarketMind-X.Y.Z-mac.zip` (macOS Intel auto-update)
- `MarketMind-Setup-X.Y.Z.exe` (Windows)
- `latest-mac.yml` / `latest.yml` (update manifests)

If assets are missing, check `gh run list --workflow=desktop-release.yml`.

## Auto-update flow

Users with an installed version receive updates automatically:
1. App checks GitHub Releases every 24h (or manually via Settings → About)
2. New version found → notification banner
3. User clicks "Download" → progress bar
4. Download complete → "Restart and Install"
5. App restarts with new version

## Code signing (optional)

To enable code signing, add these secrets to the GitHub repo:

**macOS** (Apple Developer ID, $99/year):
- `CSC_LINK` — base64-encoded `.p12` certificate
- `CSC_KEY_PASSWORD` — certificate password
- `APPLE_ID` — Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password for notarization
- `APPLE_TEAM_ID` — Team ID

**Windows** (code signing certificate):
- `WIN_CSC_LINK` — base64-encoded `.pfx` certificate
- `WIN_CSC_KEY_PASSWORD` — certificate password

Without code signing:
- macOS: users must right-click → Open on first install (Gatekeeper warning)
- Windows: SmartScreen warning on first install (click "More info" → "Run anyway")
