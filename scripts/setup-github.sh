#!/bin/bash

# ============================================================================
# MarketMind - Script de Publicação no GitHub
# ============================================================================
# Este script automatiza a criação e configuração do repositório no GitHub
# ============================================================================

set -e  # Parar em caso de erro

echo "🚀 MarketMind - Setup do Repositório GitHub"
echo "==========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================================
# 1. Verificar se GitHub CLI está instalado
# ============================================================================
echo -e "${BLUE}📋 Verificando GitHub CLI...${NC}"
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI não está instalado!${NC}"
    echo ""
    echo "Instale com Homebrew:"
    echo "  brew install gh"
    echo ""
    echo "Ou baixe em: https://cli.github.com/"
    exit 1
fi
echo -e "${GREEN}✅ GitHub CLI encontrado${NC}"
echo ""

# ============================================================================
# 2. Verificar autenticação
# ============================================================================
echo -e "${BLUE}🔐 Verificando autenticação...${NC}"
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Você não está autenticado no GitHub${NC}"
    echo ""
    echo "Execute:"
    echo "  gh auth login"
    echo ""
    read -p "Deseja fazer login agora? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh auth login
    else
        exit 1
    fi
fi
echo -e "${GREEN}✅ Autenticado no GitHub${NC}"
echo ""

# ============================================================================
# 3. Configurações do repositório
# ============================================================================
echo -e "${BLUE}⚙️  Configurações do repositório${NC}"
echo ""

# Nome do repositório
read -p "Nome do repositório [marketmind]: " REPO_NAME
REPO_NAME=${REPO_NAME:-marketmind}

# Visibilidade
echo ""
echo "Visibilidade do repositório:"
echo "  1) Público (qualquer um pode ver)"
echo "  2) Privado (apenas você e colaboradores)"
read -p "Escolha (1 ou 2) [1]: " VISIBILITY_CHOICE
VISIBILITY_CHOICE=${VISIBILITY_CHOICE:-1}

if [ "$VISIBILITY_CHOICE" = "1" ]; then
    VISIBILITY="public"
else
    VISIBILITY="private"
fi

# Descrição
read -p "Descrição do repositório: " DESCRIPTION
DESCRIPTION=${DESCRIPTION:-"Consultor de IA para análise técnica de gráficos financeiros"}

echo ""
echo -e "${YELLOW}📝 Resumo:${NC}"
echo "  Nome: $REPO_NAME"
echo "  Visibilidade: $VISIBILITY"
echo "  Descrição: $DESCRIPTION"
echo ""
read -p "Confirmar criação? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Cancelado pelo usuário${NC}"
    exit 1
fi

# ============================================================================
# 4. Criar repositório no GitHub
# ============================================================================
echo ""
echo -e "${BLUE}🔨 Criando repositório no GitHub...${NC}"

gh repo create "$REPO_NAME" \
    --"$VISIBILITY" \
    --description "$DESCRIPTION" \
    --source=. \
    --remote=origin \
    --push

echo -e "${GREEN}✅ Repositório criado e código enviado!${NC}"
echo ""

# ============================================================================
# 5. Configurar branch develop
# ============================================================================
echo -e "${BLUE}🌿 Criando branch develop...${NC}"
git checkout -b develop
git push -u origin develop
git checkout main
echo -e "${GREEN}✅ Branch develop criada${NC}"
echo ""

# ============================================================================
# 6. Configurar branch padrão para develop (opcional)
# ============================================================================
echo ""
read -p "Deseja definir 'develop' como branch padrão? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh repo edit --default-branch develop
    echo -e "${GREEN}✅ Branch padrão alterada para develop${NC}"
fi
echo ""

# ============================================================================
# 7. Adicionar tópicos ao repositório
# ============================================================================
echo -e "${BLUE}🏷️  Adicionando tópicos...${NC}"
gh repo edit --add-topic "electron"
gh repo edit --add-topic "react"
gh repo edit --add-topic "typescript"
gh repo edit --add-topic "trading"
gh repo edit --add-topic "ai"
gh repo edit --add-topic "candlestick-chart"
gh repo edit --add-topic "technical-analysis"
gh repo edit --add-topic "cryptocurrency"
gh repo edit --add-topic "stock-market"
echo -e "${GREEN}✅ Tópicos adicionados${NC}"
echo ""

# ============================================================================
# 8. Configurar proteções da branch main (opcional)
# ============================================================================
echo ""
read -p "Deseja proteger a branch main? (require PR, y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔒 Configurando proteção da branch...${NC}"
    # Nota: Proteções de branch via CLI requerem repo público ou GitHub Pro
    echo -e "${YELLOW}⚠️  Configure manualmente em:${NC}"
    echo "  Settings → Branches → Add rule"
    echo "  - Branch name pattern: main"
    echo "  - ✓ Require a pull request before merging"
    echo "  - ✓ Require status checks to pass before merging"
fi
echo ""

# ============================================================================
# 9. Finalização
# ============================================================================
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✨ Repositório configurado com sucesso!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${BLUE}📦 Informações do repositório:${NC}"
gh repo view --web
echo ""
echo -e "${BLUE}📚 Próximos passos:${NC}"
echo "  1. Configurar GitHub Actions (CI/CD)"
echo "  2. Adicionar badges ao README"
echo "  3. Configurar GitHub Releases para auto-update"
echo "  4. Começar a desenvolver na branch develop!"
echo ""
echo -e "${YELLOW}💡 Comandos úteis:${NC}"
echo "  gh repo view --web          # Abrir repo no navegador"
echo "  gh issue create             # Criar issue"
echo "  gh pr create                # Criar pull request"
echo "  git checkout develop        # Mudar para branch develop"
echo ""
echo -e "${GREEN}Bom desenvolvimento! 🚀${NC}"
echo ""
