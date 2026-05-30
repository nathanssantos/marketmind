# 🚀 MarketMind Scripts

Useful scripts for repository management and development.

## ⚡ Quick Setup (RECOMMENDED)

```bash
./scripts/setup/setup.sh
```

**Fully automated setup that:**
- ✅ Checks for Node.js 20+ and pnpm 9+
- ✅ Installs monorepo dependencies
- ✅ Creates .env files (frontend + backend)
- ✅ Automatically generates security keys
- ✅ Configures PostgreSQL (if available)
- ✅ Runs database migrations
- ✅ Builds shared packages
- ✅ Runs tests to validate the setup
- ✅ Shows checklist and next steps

**After running:**
1. Configure at least 1 AI API key in `.env`
2. Start backend: `pnpm --filter @marketmind/backend dev`
3. Start frontend: `pnpm --filter @marketmind/electron dev`

📚 Full documentation: [docs/SETUP_GUIDE.md](../docs/SETUP_GUIDE.md)

---

## 📂 Structure (scripts grouped by category)

```
scripts/
├── audit/      # code/UI audits (shade-literals, dialog-rules, panel-rules, i18n, files, indicators)
├── visual/     # screenshots and visual diffs (gallery, diff, marketing-screenshots)
├── setup/      # environment setup (setup, github, install-hooks, enable-testnet)
├── perf/       # performance (chart-perf, baselines, monitor-performance)
├── sql/        # standalone SQL scripts
├── backtest/   # backtest runners at the monorepo level
├── build/      # build/release (notarize)
├── dev/        # dev utilities (clear-storage, sync-ai-instructions)
└── mcp-install.mjs   # MCP server installer (`pnpm mcp:install`)
```

> Backend-specific scripts live in `apps/backend/scripts/<category>/`
> (trading, debug, maintenance, data, audit, sql, utils). Never leave scripts
> loose at a package root.

## 📜 Available Scripts

### `setup/setup.sh` ⭐

Fully automated project setup script.

### `clear-storage.mjs`

Script to completely clear Electron storage (persisted data).

**What it does:**
- ✅ Deletes `config.json` (electron-store)
- ✅ Removes all saved data (API keys, conversations, trading data)
- ✅ Lists files in the storage directory
- ✅ Works on macOS, Windows, and Linux

**Usage:**

```bash
npm run clear-storage
# or
node scripts/dev/clear-storage.mjs
```

**⚠️ WARNING:** This removes ALL saved data. Use with care!

**Storage paths by platform:**
- macOS: `~/Library/Application Support/MarketMind/config.json`
- Windows: `%APPDATA%\MarketMind\config.json`
- Linux: `~/.config/MarketMind/config.json`

### `setup-github.sh`

Automated script to configure the repository on GitHub.

### `install-hooks.sh`

Script to install local protection Git Hooks.

### `setup/github.sh`

Script to create and configure the repository on GitHub.

**What it does:**
- ✅ Verifies GitHub CLI installation
- ✅ Verifies authentication
- ✅ Creates the repository on GitHub (public or private)
- ✅ Pushes the initial code
- ✅ Creates and configures the `develop` branch
- ✅ Adds relevant topics to the repository
- ✅ Option to configure branch protection

**Usage:**

```bash
./scripts/setup/github.sh
```

**Prerequisites:**
- GitHub CLI installed (`brew install gh`)
- Authentication configured (`gh auth login`)

### `install-hooks.sh`

**What it does:**
- ✅ Installs the pre-push Git Hook
- ✅ Protects the `main` branch against direct pushes locally
- ✅ Enforces use of Pull Requests

**Usage:**

```bash
./scripts/setup/install-hooks.sh
```

**Note:** Since the repository is private, branch protection via GitHub requires GitHub Pro. This hook provides local protection.

---

## 🛠 GitHub CLI Installation

### macOS
```bash
brew install gh
```

### Windows
```bash
winget install GitHub.cli
```

Or download from: https://cli.github.com/

### Authentication
```bash
gh auth login
```

Choose:
1. GitHub.com
2. HTTPS
3. Login via browser

---

## 📚 Useful GitHub CLI Commands

### Repository
```bash
# View repo info
gh repo view

# Open repo in browser
gh repo view --web

# Clone repo
gh repo clone USER/REPO
```

### Issues
```bash
# List issues
gh issue list

# Create an issue
gh issue create

# View a specific issue
gh issue view NUMBER
```

### Pull Requests
```bash
# Create a PR
gh pr create

# List PRs
gh pr list

# View a specific PR
gh pr view NUMBER

# Checkout a PR
gh pr checkout NUMBER

# Merge a PR
gh pr merge NUMBER
```

### Releases
```bash
# List releases
gh release list

# Create a release
gh release create v1.0.0

# Upload assets
gh release upload v1.0.0 dist/*.dmg dist/*.exe
```

### Workflows (Actions)
```bash
# List workflows
gh workflow list

# View runs for a workflow
gh run list

# View details of a run
gh run view RUN_ID
```

---

## 🔄 Recommended Workflow

### 1. Create a new feature

```bash
# Update develop
git checkout develop
git pull origin develop

# Create the feature branch
git checkout -b feature/my-feature

# Develop...
git add .
git commit -m "feat: add my feature"

# Push to GitHub
git push -u origin feature/my-feature

# Create PR
gh pr create --base develop --title "Add my feature" --body "Description..."
```

### 2. Review and merge

```bash
# View PR
gh pr view

# Checkout to test
gh pr checkout NUMBER

# Approve and merge
gh pr merge NUMBER --merge
```

### 3. Create a release

```bash
# Update main from develop
git checkout main
git merge develop
git push origin main

# Create tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Create release on GitHub
gh release create v1.0.0 \
  --title "v1.0.0 - Release Name" \
  --notes "Changelog here..." \
  dist/*.dmg dist/*.exe
```

---

## 🎯 Semantic Commits

Use prefixes in commits for better organization:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting, semicolons, etc.
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes
- `build:` - Build system changes

**Examples:**
```bash
git commit -m "feat: add kline rendering"
git commit -m "fix: correct moving average calculation"
git commit -m "docs: update README with instructions"
git commit -m "perf: optimize canvas rendering"
```

---

## 🌿 Branch Strategy

```
main (production - always stable)
  ← develop (integration)
      ← feature/feature-name
      ← feature/other-feature
      ← bugfix/bug-name
```

**Rules:**
- `main` - Production code, only via PR
- `develop` - Main development branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes

---

## 📦 Release Publishing

### Automatic (via GitHub Actions)

When a tag is created, CI/CD automatically:
1. Builds for macOS and Windows
2. Signs the binaries
3. Creates the release on GitHub
4. Uploads the installers
5. Updates `latest.yml` for auto-update

### Manual

```bash
# Local build
npm run build:all

# Create release
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes-file CHANGELOG.md \
  dist-electron/*.dmg \
  dist-electron/*.exe \
  dist-electron/latest-mac.yml \
  dist-electron/latest.yml
```

---

## 🔧 Troubleshooting

### GitHub CLI not found
```bash
# Verify installation
which gh

# Reinstall
brew reinstall gh
```

### Not authenticated
```bash
# Re-authenticate
gh auth logout
gh auth login
```

### Error creating repository
```bash
# Check if it already exists
gh repo view USER/REPO

# Check permissions
gh auth status
```

---

Back to [main README](../README.md)
