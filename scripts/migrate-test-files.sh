#!/bin/bash

# Script para migrar arquivos de teste para o padrão Binance (Kline)
# - timestamp → openTime
# - Adiciona closeTime quando necessário
# - Converte preços/volumes numéricos para strings

echo "Migrando arquivos de teste para padrão Binance Kline..."

# Encontrar todos os arquivos de teste
TEST_FILES=$(find src -name "*.test.ts*" -type f)

for file in $TEST_FILES; do
  echo "Processando: $file"
  
  # 1. Substituir parâmetros timestamp por openTime em funções createKline/createTestKline
  sed -i '' 's/timestamp: number/openTime: number/g' "$file"
  
  # 2. Substituir propriedade timestamp por openTime em objetos Kline
  # Padrão: { timestamp: 1000, open: 100, ... } → { openTime: 1000, open: '100', ... }
  # Isso requer processamento mais cuidadoso, então faremos manualmente nos arquivos principais
done

echo "Migração automática concluída!"
echo "ATENÇÃO: Conversão de números para strings precisa ser feita manualmente."
echo "Próximos passos:"
echo "1. Converter open/high/low/close/volume de number para string"
echo "2. Adicionar closeTime onde necessário"
echo "3. Atualizar startTimestamp/endTimestamp para startOpenTime/endOpenTime"
