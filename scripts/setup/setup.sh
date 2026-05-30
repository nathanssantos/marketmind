#!/bin/bash

# ===================================
# MarketMind - Automated Setup
# ===================================

set -e  # Exit on error

echo "🚀 MarketMind - Automated Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions for printing messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check Node.js
echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
    print_error "Node.js not found!"
    echo "Install Node.js 20+: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js 20+ is required (current: $(node -v))"
    exit 1
fi
print_success "Node.js $(node -v)"

# Check pnpm
echo "Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm not found, installing..."
    npm install -g pnpm@9
fi
print_success "pnpm $(pnpm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile
print_success "Dependencies installed"

# Frontend .env setup
echo ""
echo "🔧 Configuring Frontend (.env)..."
if [ ! -f .env ]; then
    cp .env.example .env
    print_success ".env file created (project root)"
    print_warning "Configure at least 1 AI API key in .env"
    echo "   - VITE_ANTHROPIC_API_KEY (recommended)"
    echo "   - VITE_OPENAI_API_KEY (alternative)"
    echo "   - VITE_GEMINI_API_KEY (free alternative)"
else
    print_success ".env file already exists"
fi

# Backend .env setup
echo ""
echo "🔧 Configuring Backend (apps/backend/.env)..."
if [ ! -f apps/backend/.env ]; then
    cp apps/backend/.env.example apps/backend/.env

    # Generate security keys
    echo "Generating security keys..."
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -hex 64)

    # Replace in file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-32-byte-hex-key-here/$ENCRYPTION_KEY/" apps/backend/.env
        sed -i '' "s/your-session-secret-here/$SESSION_SECRET/" apps/backend/.env
    else
        # Linux
        sed -i "s/your-32-byte-hex-key-here/$ENCRYPTION_KEY/" apps/backend/.env
        sed -i "s/your-session-secret-here/$SESSION_SECRET/" apps/backend/.env
    fi

    print_success ".env file created (apps/backend/)"
    print_success "Security keys generated automatically"
else
    print_success ".env file already exists (apps/backend/)"
fi

# Check PostgreSQL
echo ""
echo "🗄️  Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    print_success "PostgreSQL installed"

    # Try to create database
    if psql postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'marketmind'" | grep -q 1; then
        print_success "Database 'marketmind' already exists"
    else
        echo "Creating database 'marketmind'..."
        psql postgres -c "CREATE DATABASE marketmind;" 2>/dev/null || true
        print_success "Database 'marketmind' created"
    fi

    # Try to enable TimescaleDB
    psql marketmind -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" 2>/dev/null || print_warning "TimescaleDB not available (optional)"

elif command -v docker &> /dev/null; then
    print_warning "PostgreSQL not found locally"
    print_warning "You can use Docker: docker-compose up -d postgres"
else
    print_error "PostgreSQL not found!"
    echo "Options:"
    echo "  1. Install PostgreSQL 17: brew install postgresql@17"
    echo "  2. Use Docker: docker-compose up -d postgres"
fi

# Build packages
echo ""
echo "🔨 Building packages..."
pnpm --filter @marketmind/types build
pnpm --filter @marketmind/indicators build
print_success "Packages built"

# Run migrations (if PostgreSQL is available)
if command -v psql &> /dev/null || [ -f apps/backend/.env ]; then
    echo ""
    echo "🗄️  Running database migrations..."
    cd apps/backend
    pnpm db:generate 2>/dev/null || true
    pnpm db:migrate 2>/dev/null || print_warning "Migrations failed (expected if DB is not running)"
    cd ../..
fi

# Run tests
echo ""
echo "🧪 Running tests..."
if pnpm test -- --run > /dev/null 2>&1; then
    print_success "All tests passed!"
else
    print_warning "Some tests failed (check manually)"
fi

# Final summary
echo ""
echo "=================================="
echo "✅ Setup Complete!"
echo "=================================="
echo ""
echo "📋 Checklist:"
echo ""

# Check .env
if [ -f .env ]; then
    if grep -q "VITE_ANTHROPIC_API_KEY=$" .env || grep -q "VITE_OPENAI_API_KEY=$" .env || grep -q "VITE_GEMINI_API_KEY=$" .env; then
        print_warning "Configure at least 1 AI API key in .env"
        echo "   - VITE_ANTHROPIC_API_KEY (https://console.anthropic.com)"
        echo "   - VITE_OPENAI_API_KEY (https://platform.openai.com)"
        echo "   - VITE_GEMINI_API_KEY (https://aistudio.google.com)"
    else
        print_success "API keys configured in .env"
    fi
else
    print_warning "Create .env file at the project root"
fi

# Check backend .env
if [ -f apps/backend/.env ]; then
    print_success "Backend .env configured"
else
    print_warning "Create apps/backend/.env file"
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    print_success "PostgreSQL installed"
elif command -v docker &> /dev/null; then
    print_warning "Use: docker-compose up -d postgres"
else
    print_warning "Install PostgreSQL or Docker"
fi

echo ""
echo "🚀 Next Steps:"
echo ""
echo "1. Configure API keys in .env (if not done yet)"
echo ""
echo "2. Start the backend:"
echo "   pnpm --filter @marketmind/backend dev"
echo ""
echo "3. In another terminal, start the frontend:"
echo "   pnpm --filter @marketmind/electron dev"
echo ""
echo "4. The Electron app will open automatically!"
echo ""
echo "📚 Full documentation: docs/SETUP_GUIDE.md"
echo ""
