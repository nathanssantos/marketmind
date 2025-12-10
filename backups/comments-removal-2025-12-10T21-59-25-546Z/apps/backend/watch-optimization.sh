#!/bin/bash

# Script para monitorar progresso da otimização em tempo real

echo "🔍 Monitorando otimização batch..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verifica se o processo está rodando
if [ -f optimization.pid ]; then
    PID=$(cat optimization.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Processo rodando (PID: $PID)"
    else
        echo "❌ Processo não encontrado"
        exit 1
    fi
else
    echo "❌ Arquivo optimization.pid não encontrado"
    exit 1
fi

echo ""
echo "📊 Progresso:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Conta estratégias completas
COMPLETED=$(grep -c "✅ Optimization complete" optimization-log.txt 2>/dev/null || echo "0")
echo "Estratégias concluídas: $COMPLETED/10"

echo ""
echo "📈 Últimas linhas do log:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -20 optimization-log.txt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Comandos úteis:"
echo "  • Ver log completo: tail -f optimization-log.txt"
echo "  • Parar otimização: kill $PID"
echo "  • Este script: bash watch-optimization.sh"
