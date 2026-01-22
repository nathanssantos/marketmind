#!/bin/bash

# Script para auditar cores hardcoded no projeto MarketMind
# Executa buscas por padrões de cores que não vêm do tema Chakra

RENDERER_PATH="apps/electron/src/renderer"

# Arquivos permitidos (cores definidas intencionalmente)
EXCLUDE_PATTERNS="grep -v '\.test\.' | grep -v 'theme/index.ts' | grep -v 'preReactColors.ts' | grep -v 'constants/defaults.ts' | grep -v 'node_modules'"

echo "=================================="
echo "MarketMind - Auditoria de Cores Hardcoded"
echo "=================================="
echo ""

# Arquivos permitidos:
# - theme/index.ts - onde os tokens são definidos
# - constants/preReactColors.ts - cores para estados antes do React carregar
# - constants/defaults.ts - valores default com fallbacks
# - *.test.ts - arquivos de teste

echo "1. CORES HEXADECIMAIS (#xxx)"
echo "----------------------------"
HEX_COUNT=$(grep -rn --include="*.tsx" --include="*.ts" \
  -E "#[0-9a-fA-F]{3,8}" \
  "$RENDERER_PATH" | \
  grep -v "\.test\." | \
  grep -v "theme/index.ts" | \
  grep -v "preReactColors.ts" | \
  grep -v "constants/defaults.ts" | \
  grep -v "node_modules" | \
  wc -l | tr -d ' ')

echo "Total encontrado: $HEX_COUNT ocorrências"
echo ""

if [ "$HEX_COUNT" -gt 0 ]; then
  echo "Arquivos com cores hex hardcoded:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "#[0-9a-fA-F]{3,8}" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "theme/index.ts" | \
    grep -v "preReactColors.ts" | \
    grep -v "constants/defaults.ts" | \
    grep -v "node_modules" | \
    cut -d: -f1 | sort -u
  echo ""
fi

echo "2. CORES RGBA/RGB"
echo "-----------------"
RGBA_COUNT=$(grep -rn --include="*.tsx" --include="*.ts" \
  -E "rgba?\([0-9]" \
  "$RENDERER_PATH" | \
  grep -v "\.test\." | \
  grep -v "theme/index.ts" | \
  grep -v "preReactColors.ts" | \
  grep -v "constants/defaults.ts" | \
  grep -v "node_modules" | \
  wc -l | tr -d ' ')

echo "Total encontrado: $RGBA_COUNT ocorrências"
echo ""

if [ "$RGBA_COUNT" -gt 0 ]; then
  echo "Arquivos com cores rgba/rgb hardcoded:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "rgba?\([0-9]" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "theme/index.ts" | \
    grep -v "preReactColors.ts" | \
    grep -v "constants/defaults.ts" | \
    grep -v "node_modules" | \
    cut -d: -f1 | sort -u
  echo ""
fi

echo "3. INLINE STYLES COM CORES"
echo "--------------------------"
INLINE_COUNT=$(grep -rn --include="*.tsx" --include="*.ts" \
  -E "style=\{[^}]*(color|background)" \
  "$RENDERER_PATH" | \
  grep -v "\.test\." | \
  grep -v "preReactColors.ts" | \
  grep -v "node_modules" | \
  wc -l | tr -d ' ')

echo "Total encontrado: $INLINE_COUNT ocorrências"
echo ""

echo "=================================="
echo "RESUMO"
echo "=================================="
TOTAL=$((HEX_COUNT + RGBA_COUNT + INLINE_COUNT))
echo "Total de cores hardcoded: $TOTAL"
echo ""

if [ "$TOTAL" -eq 0 ]; then
  echo "✅ Nenhuma cor hardcoded encontrada!"
else
  echo "⚠️  Existem cores hardcoded que precisam ser migradas para o tema."
  echo ""
  echo "Para ver detalhes, execute com --verbose:"
  echo "  $0 --verbose"
fi

# Se --verbose flag passada, mostra todas as ocorrências
if [ "$1" == "--verbose" ]; then
  echo ""
  echo "=================================="
  echo "DETALHES COMPLETOS"
  echo "=================================="
  echo ""
  echo "Cores Hexadecimais:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "#[0-9a-fA-F]{3,8}" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "theme/index.ts" | \
    grep -v "preReactColors.ts" | \
    grep -v "constants/defaults.ts" | \
    grep -v "node_modules"

  echo ""
  echo "Cores RGBA/RGB:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "rgba?\([0-9]" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "theme/index.ts" | \
    grep -v "preReactColors.ts" | \
    grep -v "constants/defaults.ts" | \
    grep -v "node_modules"

  echo ""
  echo "Inline Styles com cores:"
  grep -rn --include="*.tsx" --include="*.ts" \
    -E "style=\{[^}]*(color|background)" \
    "$RENDERER_PATH" | \
    grep -v "\.test\." | \
    grep -v "preReactColors.ts" | \
    grep -v "node_modules"
fi
