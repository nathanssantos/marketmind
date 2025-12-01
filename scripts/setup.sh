#!/bin/bash

# ===================================
# MarketMind - Setup Automático
# ===================================

set -e  # Exit on error

echo "🚀 MarketMind - Setup Automático"
echo "=================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para printar mensagens
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar Node.js
echo "Verificando Node.js..."
if ! command -v node &> /dev/null; then
    print_error "Node.js não encontrado!"
    echo "Instale Node.js 20+: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js 20+ é necessário (atual: $(node -v))"
    exit 1
fi
print_success "Node.js $(node -v)"

# Verificar pnpm
echo "Verificando pnpm..."
if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm não encontrado, instalando..."
    npm install -g pnpm@9
fi
print_success "pnpm $(pnpm -v)"

# Instalar dependências
echo ""
echo "📦 Instalando dependências..."
pnpm install --frozen-lockfile
print_success "Dependências instaladas"

# Setup Frontend .env
echo ""
echo "🔧 Configurando Frontend (.env)..."
if [ ! -f .env ]; then
    cp .env.example .env
    print_success "Arquivo .env criado (raiz do projeto)"
    print_warning "Configure suas API keys de IA em .env"
    echo "   - VITE_ANTHROPIC_API_KEY (recomendado)"
    echo "   - VITE_OPENAI_API_KEY (alternativa)"
    echo "   - VITE_GEMINI_API_KEY (alternativa gratuita)"
else
    print_success "Arquivo .env já existe"
fi

# Setup Backend .env
echo ""
echo "🔧 Configurando Backend (apps/backend/.env)..."
if [ ! -f apps/backend/.env ]; then
    cp apps/backend/.env.example apps/backend/.env
    
    # Gerar keys de segurança
    echo "Gerando keys de segurança..."
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -hex 64)
    
    # Substituir no arquivo
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-32-byte-hex-key-here/$ENCRYPTION_KEY/" apps/backend/.env
        sed -i '' "s/your-session-secret-here/$SESSION_SECRET/" apps/backend/.env
    else
        # Linux
        sed -i "s/your-32-byte-hex-key-here/$ENCRYPTION_KEY/" apps/backend/.env
        sed -i "s/your-session-secret-here/$SESSION_SECRET/" apps/backend/.env
    fi
    
    print_success "Arquivo .env criado (apps/backend/)"
    print_success "Keys de segurança geradas automaticamente"
else
    print_success "Arquivo .env já existe (apps/backend/)"
fi

# Verificar PostgreSQL
echo ""
echo "🗄️  Verificando PostgreSQL..."
if command -v psql &> /dev/null; then
    print_success "PostgreSQL instalado"
    
    # Tentar criar database
    if psql postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'marketmind'" | grep -q 1; then
        print_success "Database 'marketmind' já existe"
    else
        echo "Criando database 'marketmind'..."
        psql postgres -c "CREATE DATABASE marketmind;" 2>/dev/null || true
        print_success "Database 'marketmind' criado"
    fi
    
    # Tentar habilitar TimescaleDB
    psql marketmind -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" 2>/dev/null || print_warning "TimescaleDB não disponível (opcional)"
    
elif command -v docker &> /dev/null; then
    print_warning "PostgreSQL não encontrado localmente"
    print_warning "Você pode usar Docker: docker-compose up -d postgres"
else
    print_error "PostgreSQL não encontrado!"
    echo "Opções:"
    echo "  1. Instale PostgreSQL 17: brew install postgresql@17"
    echo "  2. Use Docker: docker-compose up -d postgres"
fi

# Build packages
echo ""
echo "🔨 Compilando packages..."
pnpm --filter @marketmind/types build
pnpm --filter @marketmind/indicators build
print_success "Packages compilados"

# Executar migrations (se PostgreSQL disponível)
if command -v psql &> /dev/null || [ -f apps/backend/.env ]; then
    echo ""
    echo "🗄️  Executando migrations do banco..."
    cd apps/backend
    pnpm db:generate 2>/dev/null || true
    pnpm db:migrate 2>/dev/null || print_warning "Migrations falharam (normal se DB não estiver rodando)"
    cd ../..
fi

# Executar testes
echo ""
echo "🧪 Executando testes..."
if pnpm test -- --run > /dev/null 2>&1; then
    print_success "Todos os testes passaram!"
else
    print_warning "Alguns testes falharam (verifique manualmente)"
fi

# Resumo final
echo ""
echo "=================================="
echo "✅ Setup Completo!"
echo "=================================="
echo ""
echo "📋 Checklist:"
echo ""

# Verificar .env
if [ -f .env ]; then
    if grep -q "VITE_ANTHROPIC_API_KEY=$" .env || grep -q "VITE_OPENAI_API_KEY=$" .env || grep -q "VITE_GEMINI_API_KEY=$" .env; then
        print_warning "Configure pelo menos 1 API key de IA em .env"
        echo "   - VITE_ANTHROPIC_API_KEY (https://console.anthropic.com)"
        echo "   - VITE_OPENAI_API_KEY (https://platform.openai.com)"
        echo "   - VITE_GEMINI_API_KEY (https://aistudio.google.com)"
    else
        print_success "API keys configuradas em .env"
    fi
else
    print_warning "Crie arquivo .env na raiz"
fi

# Verificar backend .env
if [ -f apps/backend/.env ]; then
    print_success "Backend .env configurado"
else
    print_warning "Crie arquivo apps/backend/.env"
fi

# Verificar PostgreSQL
if command -v psql &> /dev/null; then
    print_success "PostgreSQL instalado"
elif command -v docker &> /dev/null; then
    print_warning "Use: docker-compose up -d postgres"
else
    print_warning "Instale PostgreSQL ou Docker"
fi

echo ""
echo "🚀 Próximos Passos:"
echo ""
echo "1. Configure API keys em .env (se ainda não fez)"
echo ""
echo "2. Inicie o backend:"
echo "   pnpm --filter @marketmind/backend dev"
echo ""
echo "3. Em outro terminal, inicie o frontend:"
echo "   pnpm --filter @marketmind/electron dev"
echo ""
echo "4. O app Electron abrirá automaticamente!"
echo ""
echo "📚 Documentação completa: docs/SETUP_GUIDE.md"
echo ""
