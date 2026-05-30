#!/bin/bash

# ============================================================================
# MarketMind - GitHub Publishing Script
# ============================================================================
# This script automates the creation and configuration of the GitHub repository
# ============================================================================

set -e  # Stop on error

echo "🚀 MarketMind - GitHub Repository Setup"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================================
# 1. Check if GitHub CLI is installed
# ============================================================================
echo -e "${BLUE}📋 Checking GitHub CLI...${NC}"
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI is not installed!${NC}"
    echo ""
    echo "Install with Homebrew:"
    echo "  brew install gh"
    echo ""
    echo "Or download from: https://cli.github.com/"
    exit 1
fi
echo -e "${GREEN}✅ GitHub CLI found${NC}"
echo ""

# ============================================================================
# 2. Verify authentication
# ============================================================================
echo -e "${BLUE}🔐 Verifying authentication...${NC}"
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  You are not authenticated with GitHub${NC}"
    echo ""
    echo "Run:"
    echo "  gh auth login"
    echo ""
    read -p "Do you want to log in now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh auth login
    else
        exit 1
    fi
fi
echo -e "${GREEN}✅ Authenticated with GitHub${NC}"
echo ""

# ============================================================================
# 3. Repository settings
# ============================================================================
echo -e "${BLUE}⚙️  Repository settings${NC}"
echo ""

# Repository name
read -p "Repository name [marketmind]: " REPO_NAME
REPO_NAME=${REPO_NAME:-marketmind}

# Visibility
echo ""
echo "Repository visibility:"
echo "  1) Public (anyone can see)"
echo "  2) Private (only you and collaborators)"
read -p "Choose (1 or 2) [1]: " VISIBILITY_CHOICE
VISIBILITY_CHOICE=${VISIBILITY_CHOICE:-1}

if [ "$VISIBILITY_CHOICE" = "1" ]; then
    VISIBILITY="public"
else
    VISIBILITY="private"
fi

# Description
read -p "Repository description: " DESCRIPTION
DESCRIPTION=${DESCRIPTION:-"AI consultant for technical analysis of financial charts"}

echo ""
echo -e "${YELLOW}📝 Summary:${NC}"
echo "  Name: $REPO_NAME"
echo "  Visibility: $VISIBILITY"
echo "  Description: $DESCRIPTION"
echo ""
read -p "Confirm creation? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Cancelled by user${NC}"
    exit 1
fi

# ============================================================================
# 4. Create repository on GitHub
# ============================================================================
echo ""
echo -e "${BLUE}🔨 Creating repository on GitHub...${NC}"

gh repo create "$REPO_NAME" \
    --"$VISIBILITY" \
    --description "$DESCRIPTION" \
    --source=. \
    --remote=origin \
    --push

echo -e "${GREEN}✅ Repository created and code pushed!${NC}"
echo ""

# ============================================================================
# 5. Configure develop branch
# ============================================================================
echo -e "${BLUE}🌿 Creating develop branch...${NC}"
git checkout -b develop
git push -u origin develop
git checkout main
echo -e "${GREEN}✅ develop branch created${NC}"
echo ""

# ============================================================================
# 6. Set develop as default branch (optional)
# ============================================================================
echo ""
read -p "Do you want to set 'develop' as the default branch? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh repo edit --default-branch develop
    echo -e "${GREEN}✅ Default branch changed to develop${NC}"
fi
echo ""

# ============================================================================
# 7. Add topics to the repository
# ============================================================================
echo -e "${BLUE}🏷️  Adding topics...${NC}"
gh repo edit --add-topic "electron"
gh repo edit --add-topic "react"
gh repo edit --add-topic "typescript"
gh repo edit --add-topic "trading"
gh repo edit --add-topic "ai"
gh repo edit --add-topic "kline-chart"
gh repo edit --add-topic "technical-analysis"
gh repo edit --add-topic "cryptocurrency"
gh repo edit --add-topic "stock-market"
echo -e "${GREEN}✅ Topics added${NC}"
echo ""

# ============================================================================
# 8. Configure main branch protection (optional)
# ============================================================================
echo ""
read -p "Do you want to protect the main branch? (require PR, y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔒 Configuring branch protection...${NC}"
    # Note: Branch protection via CLI requires a public repo or GitHub Pro
    echo -e "${YELLOW}⚠️  Configure manually at:${NC}"
    echo "  Settings → Branches → Add rule"
    echo "  - Branch name pattern: main"
    echo "  - ✓ Require a pull request before merging"
    echo "  - ✓ Require status checks to pass before merging"
fi
echo ""

# ============================================================================
# 9. Finalization
# ============================================================================
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✨ Repository configured successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${BLUE}📦 Repository information:${NC}"
gh repo view --web
echo ""
echo -e "${BLUE}📚 Next steps:${NC}"
echo "  1. Configure GitHub Actions (CI/CD)"
echo "  2. Add badges to README"
echo "  3. Configure GitHub Releases for auto-update"
echo "  4. Start developing on the develop branch!"
echo ""
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo "  gh repo view --web          # Open repo in browser"
echo "  gh issue create             # Create an issue"
echo "  gh pr create                # Create a pull request"
echo "  git checkout develop        # Switch to the develop branch"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
echo ""
