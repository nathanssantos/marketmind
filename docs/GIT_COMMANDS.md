# 📝 Git & GitHub Commands - Quick Guide

## 🚀 Initial Repository Setup

### Option 1: Automated Script (Recommended)
```bash
./scripts/setup-github.sh
```

### Option 2: Manual Commands

#### 1. Create repository on GitHub
```bash
# Public repository
gh repo create marketmind \
  --public \
  --description "AI consultant for technical analysis of financial charts" \
  --source=. \
  --remote=origin \
  --push

# OR private repository
gh repo create marketmind \
  --private \
  --description "AI consultant for technical analysis of financial charts" \
  --source=. \
  --remote=origin \
  --push
```

#### 2. Create develop branch
```bash
git checkout -b develop
git push -u origin develop
```

#### 3. Set develop as default branch (optional)
```bash
gh repo edit --default-branch develop
```

#### 4. Add topics
```bash
gh repo edit --add-topic electron
gh repo edit --add-topic react
gh repo edit --add-topic typescript
gh repo edit --add-topic trading
gh repo edit --add-topic ai
gh repo edit --add-topic kline-chart
gh repo edit --add-topic technical-analysis
gh repo edit --add-topic cryptocurrency
gh repo edit --add-topic stock-market
```

---

## 🔄 Daily Workflow

### Start new feature
```bash
# 1. Update develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/chart-rendering

# 3. Make changes...
# (code)

# 4. Commit
git add .
git commit -m "feat: add kline rendering"

# 5. Push
git push -u origin feature/chart-rendering

# 6. Create Pull Request
gh pr create \
  --base develop \
  --title "Add kline rendering" \
  --body "Implements kline chart rendering with Canvas API"
```

### Review Pull Request
```bash
# List open PRs
gh pr list

# View PR details
gh pr view 1

# Checkout PR to test
gh pr checkout 1

# Add review
gh pr review 1 --approve
gh pr review 1 --comment --body "Great work!"
gh pr review 1 --request-changes --body "Needs adjustments"

# Merge PR
gh pr merge 1 --merge  # merge commit
gh pr merge 1 --squash # squash commits
gh pr merge 1 --rebase # rebase
```

### Frequent commits
```bash
# Add specific files
git add src/renderer/components/Chart/ChartCanvas.tsx

# Add all
git add .

# Commit with message
git commit -m "feat: add chart zoom"

# Amend (fix last commit)
git commit --amend -m "feat: add zoom and pan to chart"

# Push
git push

# Force push (careful! use only on your own branches)
git push --force-with-lease
```

---

## 📦 Releases

### Create Release
```bash
# 1. Update main with develop
git checkout main
git pull origin main
git merge develop
git push origin main

# 2. Create tag
git tag -a v1.0.0 -m "Release v1.0.0 - Initial Release"
git push origin v1.0.0

# 3. Build installers
npm run build:all

# 4. Create release on GitHub
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "
## 🎉 First Release

### Features
- ✅ Kline chart rendering
- ✅ AI integration
- ✅ Interactive chat
- ✅ Auto-update

### Download
- macOS: marketmind-1.0.0.dmg
- Windows: marketmind-1.0.0.exe
" \
  dist-electron/*.dmg \
  dist-electron/*.exe \
  dist-electron/latest-mac.yml \
  dist-electron/latest.yml
```

### Pre-release (beta)
```bash
gh release create v1.0.0-beta.1 \
  --title "v1.0.0-beta.1" \
  --notes "Beta release for testing" \
  --prerelease \
  dist-electron/*.dmg \
  dist-electron/*.exe
```

### List releases
```bash
gh release list
```

### Delete release
```bash
gh release delete v1.0.0 --yes
git push --delete origin v1.0.0  # delete tag too
```

---

## 🌿 Branch Management

### Create branch
```bash
git checkout -b feature/ai-integration
git push -u origin feature/ai-integration
```

### Switch branch
```bash
git checkout develop
git checkout main
git checkout feature/chart-rendering
```

### List branches
```bash
# Local
git branch

# Remote
git branch -r

# All
git branch -a
```

### Delete branch
```bash
# Local
git branch -d feature/old-feature

# Remote
git push origin --delete feature/old-feature
```

### Update branch with develop
```bash
# Option 1: Merge
git checkout feature/my-feature
git merge develop

# Option 2: Rebase (keeps linear history)
git checkout feature/my-feature
git rebase develop
```

---

## 🔍 Viewing and History

### View status
```bash
git status
git status -s  # short format
```

### View differences
```bash
# Unstaged changes
git diff

# Staged changes
git diff --staged

# Difference between branches
git diff main develop

# Difference in specific file
git diff src/main/index.ts
```

### View history
```bash
# Full log
git log

# Summary log
git log --oneline

# Log with graph
git log --oneline --graph --all

# Log of a file
git log -- src/main/index.ts

# Filtered log
git log --author="Nathan"
git log --since="2025-01-01"
git log --grep="feat"
```

### View authors
```bash
git shortlog -s -n
```

---

## 🔧 Undoing Changes

### Discard local changes
```bash
# Specific file
git checkout -- src/main/index.ts

# All files
git checkout -- .

# Remove untracked files
git clean -fd
```

### Undo commit (keeping changes)
```bash
git reset --soft HEAD~1
```

### Undo commit (discarding changes)
```bash
git reset --hard HEAD~1
```

### Revert commit (creates new commit)
```bash
git revert HEAD
git revert abc123  # revert specific commit
```

### Undo push (CAREFUL!)
```bash
# Only if nobody else has pulled
git reset --hard HEAD~1
git push --force-with-lease
```

---

## 🏷️ Tags

### Create tag
```bash
# Annotated tag (recommended)
git tag -a v1.0.0 -m "Version 1.0.0"

# Simple tag
git tag v1.0.0

# Tag on specific commit
git tag -a v1.0.0 abc123 -m "Version 1.0.0"
```

### List tags
```bash
git tag
git tag -l "v1.*"  # filter
```

### Push tags
```bash
# Specific tag
git push origin v1.0.0

# All tags
git push origin --tags
```

### Delete tag
```bash
# Local
git tag -d v1.0.0

# Remote
git push origin --delete v1.0.0
```

---

## 🔄 Synchronization

### Update local repository
```bash
# Fetch (get changes without merge)
git fetch origin

# Pull (fetch + merge)
git pull origin develop

# Pull with rebase
git pull --rebase origin develop
```

### Push
```bash
# Push current branch
git push

# Push with upstream
git push -u origin feature/new-feature

# Push all branches
git push --all

# Forced push (CAREFUL!)
git push --force-with-lease
```

---

## 🐛 Issues

### Create issue
```bash
gh issue create \
  --title "Bug: Chart not rendering in dark mode" \
  --body "Problem description..." \
  --label "bug" \
  --assignee "@me"
```

### List issues
```bash
# All open
gh issue list

# Filter by label
gh issue list --label "bug"

# Filter by assignee
gh issue list --assignee "@me"

# Include closed
gh issue list --state all
```

### View issue
```bash
gh issue view 1
gh issue view 1 --web  # open in browser
```

### Close issue
```bash
gh issue close 1 --comment "Fixed in v1.0.1"
```

### Reopen issue
```bash
gh issue reopen 1
```

---

## 👥 Collaboration

### Clone repository
```bash
gh repo clone USER/marketmind
# or
git clone https://github.com/USER/marketmind.git
```

### Fork
```bash
gh repo fork USER/marketmind --clone
```

### Add collaborator
```bash
gh repo edit --enable-issues
gh repo edit --enable-wiki
```

### View collaborators
```bash
gh api repos/:owner/:repo/contributors
```

---

## 📊 Statistics

### View contributions
```bash
# By file
git log --pretty=format: --name-only | sort | uniq -c | sort -rg | head -10

# By author
git shortlog -s -n

# Lines added/removed
git log --shortstat --author="Nathan"
```

### View repository size
```bash
git count-objects -vH
```

---

## 🔐 Configuration

### Configure user
```bash
# Global
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Local (only this repo)
git config user.name "Your Name"
git config user.email "your@email.com"
```

### Configure editor
```bash
git config --global core.editor "code --wait"
```

### Configure aliases
```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.lg "log --oneline --graph --all"
```

### View settings
```bash
git config --list
git config --global --list
```

---

## 🚨 Troubleshooting

### Merge conflicts
```bash
# View conflicted files
git status

# After resolving conflicts
git add .
git commit -m "merge: resolve conflicts"

# Abort merge
git merge --abort
```

### Recover deleted file
```bash
git checkout HEAD -- file.txt
```

### Recover deleted commit
```bash
# View complete history (including deleted commits)
git reflog

# Recover
git checkout abc123
```

### Clear Git cache
```bash
git rm -r --cached .
git add .
git commit -m "chore: clear git cache"
```

---

## 📚 Useful Resources

### Documentation
- [Git Docs](https://git-scm.com/doc)
- [GitHub CLI Docs](https://cli.github.com/manual/)
- [Conventional Commits](https://www.conventionalcommits.org/)

### Tools
- **GitHub Desktop** - Git GUI
- **GitKraken** - Visual Git client
- **SourceTree** - Free Git manager

### VS Code Extensions
- GitLens
- Git Graph
- GitHub Pull Requests

---

**Tip:** Add these aliases to your `.zshrc` or `.bashrc`:

```bash
# Git aliases
alias gs='git status'
alias ga='git add .'
alias gc='git commit -m'
alias gp='git push'
alias gl='git pull'
alias gco='git checkout'
alias gb='git branch'
alias gm='git merge'
alias glg='git log --oneline --graph --all'

# GitHub CLI aliases
alias ghv='gh repo view --web'
alias ghpr='gh pr create'
alias ghprl='gh pr list'
alias ghil='gh issue list'
```

Reload terminal: `source ~/.zshrc`

---

Back to [main README](../README.md) | [Scripts](./README.md)
