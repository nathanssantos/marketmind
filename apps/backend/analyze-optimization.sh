#!/bin/bash

# Script para analisar resultados da otimização

echo "📊 RESULTADOS DA OTIMIZAÇÃO BATCH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Pega os arquivos mais recentes de cada estratégia
STRATEGIES=(
    "order-block-fvg"
    "liquidity-sweep"
    "divergence-rsi-macd"
    "larry-williams-9-1"
    "larry-williams-9-2"
    "larry-williams-9-3"
    "larry-williams-9-4"
    "connors-rsi2-original"
    "mean-reversion-bb-rsi"
    "rsi2-mean-reversion"
)

for strategy in "${STRATEGIES[@]}"; do
    # Pega o arquivo mais recente para esta estratégia
    FILE=$(ls -t results/optimizations/${strategy}_BTCUSDT_1h_*.json 2>/dev/null | head -1)
    
    if [ -f "$FILE" ]; then
        echo "📈 $strategy"
        echo "────────────────────────────────────────────────────────"
        
        # Extrai informações do melhor resultado
        jq -r '
            .statistics.best | 
            "  Trades: \(.metrics.totalTrades)
  Win Rate: \(.metrics.winRate)%
  PnL: \(.metrics.totalPnlPercent | tonumber | . * 100 | round / 100)%
  Profit Factor: \(.metrics.profitFactor // "N/A")
  Sharpe Ratio: \(.metrics.sharpeRatio | tonumber | . * 100 | round / 100)
  Max Drawdown: \(.metrics.maxDrawdownPercent | tonumber | . * 100 | round / 100)%
  
  📝 Parâmetros otimizados:
\(.params | to_entries | map("    • \(.key): \(.value)") | join("\n"))"
        ' "$FILE"
        
        echo ""
        echo ""
    else
        echo "⚠️  $strategy - Arquivo não encontrado"
        echo ""
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Análise completa!"
