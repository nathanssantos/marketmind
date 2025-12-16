#!/bin/bash

# Script de Monitoramento de Performance - MarketMind
# Uso: ./scripts/monitor-performance.sh [duration_seconds]

DURATION=${1:-300}  # Default: 5 minutos
INTERVAL=5
LOG_FILE="performance-monitor-$(date +%Y%m%d-%H%M%S).log"

echo "🔍 Monitorando Performance do MarketMind"
echo "Duração: ${DURATION}s (${INTERVAL}s por iteração)"
echo "Log: ${LOG_FILE}"
echo ""

# Função para capturar métricas
capture_metrics() {
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    
    echo "=== $timestamp ===" | tee -a "$LOG_FILE"
    
    # 1. Processos MarketMind
    echo "### Processos ###" | tee -a "$LOG_FILE"
    ps aux | grep -E "marketmind|electron|node.*backend" | grep -v grep | \
        awk '{printf "%-40s CPU: %6s MEM: %6s\n", substr($11" "$12,1,40), $3"%", $4"%"}' | \
        tee -a "$LOG_FILE"
    
    # 2. Totais
    echo "" | tee -a "$LOG_FILE"
    echo "### Totais ###" | tee -a "$LOG_FILE"
    ps aux | grep -E "marketmind|electron|node.*backend" | grep -v grep | \
        awk '{cpu+=$3; mem+=$4} END {printf "Total CPU: %.1f%%\nTotal MEM: %.1f%%\n", cpu, mem}' | \
        tee -a "$LOG_FILE"
    
    # 3. Conexões PostgreSQL
    echo "" | tee -a "$LOG_FILE"
    echo "### PostgreSQL Connections ###" | tee -a "$LOG_FILE"
    psql marketmind -c "SELECT state, COUNT(*) as count FROM pg_stat_activity WHERE datname = 'marketmind' GROUP BY state;" 2>/dev/null | \
        tee -a "$LOG_FILE"
    
    # 4. Watchers Ativos
    echo "" | tee -a "$LOG_FILE"
    echo "### Active Watchers ###" | tee -a "$LOG_FILE"
    psql marketmind -c "SELECT COUNT(*) as total_watchers FROM active_watchers;" 2>/dev/null | \
        tee -a "$LOG_FILE"
    
    # 5. Posições Abertas
    echo "" | tee -a "$LOG_FILE"
    echo "### Open Positions ###" | tee -a "$LOG_FILE"
    psql marketmind -c "SELECT COUNT(*) as open_positions FROM trade_executions WHERE status = 'open';" 2>/dev/null | \
        tee -a "$LOG_FILE"
    
    # 6. Price Cache Size
    echo "" | tee -a "$LOG_FILE"
    echo "### Price Cache ###" | tee -a "$LOG_FILE"
    psql marketmind -c "SELECT COUNT(*) as cached_prices, pg_size_pretty(pg_total_relation_size('price_cache')) as table_size FROM price_cache;" 2>/dev/null | \
        tee -a "$LOG_FILE"
    
    echo "" | tee -a "$LOG_FILE"
    echo "---" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# Loop de monitoramento
elapsed=0
while [ $elapsed -lt $DURATION ]; do
    capture_metrics
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
done

echo "✅ Monitoramento concluído!"
echo "Log salvo em: $LOG_FILE"
echo ""

# Gerar resumo
echo "📊 Resumo do Monitoramento" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# CPU médio
echo "CPU Médio:" | tee -a "$LOG_FILE"
grep "Total CPU:" "$LOG_FILE" | awk '{sum+=$3; count++} END {printf "  %.1f%%\n", sum/count}' | tee -a "$LOG_FILE"

# Memória média
echo "Memória Média:" | tee -a "$LOG_FILE"
grep "Total MEM:" "$LOG_FILE" | awk '{sum+=$3; count++} END {printf "  %.1f%%\n", sum/count}' | tee -a "$LOG_FILE"

# Conexões DB média
echo "Conexões DB (média):" | tee -a "$LOG_FILE"
grep -A 5 "PostgreSQL Connections" "$LOG_FILE" | grep "idle" | awk '{sum+=$3; count++} END {printf "  %.0f idle\n", sum/count}' | tee -a "$LOG_FILE"

echo ""
echo "Para análise completa, veja: $LOG_FILE"
