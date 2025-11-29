# 🔍 Setup Detection Debug Logs

Sistema de logs detalhados para depuração da detecção de setups algorítmicos.

## 📋 Configuração

### 1. Ativar Debug Logs

Crie ou edite o arquivo `.env` na raiz do projeto:

```bash
# .env
VITE_DEBUG_SETUPS=true
```

### 2. Reiniciar Aplicação

```bash
npm run dev
```

## 📊 Informações Exibidas

Quando ativado, o sistema exibe logs detalhados no console do navegador (DevTools):

### Informações Gerais (Início da Detecção)
```
[SetupDetection 14:32:45] === Setup Detection Started ===
[SetupDetection 14:32:45] Current Index: 249
[SetupDetection 14:32:45] Trend: bullish
[SetupDetection 14:32:45] Trend Filter Enabled: true
[SetupDetection 14:32:45] Allow Counter-Trend: false
[SetupDetection 14:32:45] Cooldown Period: 10
```

### Análise por Detector

Para cada setup, o sistema mostra:

#### Setup Habilitado
```
[SetupDetection 14:32:45] 
--- Setup 9.1 ---
[SetupDetection 14:32:45] Can Detect (Cooldown): true
[SetupDetection 14:32:45] Detection Result: { hasSetup: true, confidence: 82 }
[SetupDetection 14:32:45] Trend Aligned: true (LONG vs bullish)
[SetupDetection 14:32:45] ✅ Setup 9.1 DETECTED
```

#### Setup Rejeitado por Cooldown
```
[SetupDetection 14:32:45] 
--- Setup 9.1 ---
[SetupDetection 14:32:45] Can Detect (Cooldown): false
[SetupDetection 14:32:45] ❌ Cooldown active (last: 245, need: 10 candles)
```

#### Setup Rejeitado por Tendência
```
[SetupDetection 14:32:45] 
--- Bull Trap ---
[SetupDetection 14:32:45] Can Detect (Cooldown): true
[SetupDetection 14:32:45] Detection Result: { hasSetup: true, confidence: 75 }
[SetupDetection 14:32:45] Trend Aligned: false (SHORT vs bullish)
[SetupDetection 14:32:45] ❌ Rejected by Trend Filter
```

#### Setup sem Padrão Formado
```
[SetupDetection 14:32:45] 
--- Pattern 1-2-3 ---
[SetupDetection 14:32:45] Can Detect (Cooldown): true
[SetupDetection 14:32:45] Detection Result: { hasSetup: false, confidence: 0 }
[SetupDetection 14:32:45] ❌ No setup found (not enough pivots or breakout not confirmed)
```

#### Setup Desabilitado
```
[SetupDetection 14:32:45] 
--- Breakout Retest ---
[SetupDetection 14:32:45] ❌ Disabled in config
```

### Resumo Final
```
[SetupDetection 14:32:45] 
=== Detection Summary ===
[SetupDetection 14:32:45] Total Setups Found: 2
[SetupDetection 14:32:45]   - setup-9-1: LONG @ 98456.32 (Confidence: 82%)
[SetupDetection 14:32:45]   - bear-trap: SHORT @ 98234.12 (Confidence: 75%)
[SetupDetection 14:32:45] ===========================
```

## 🎯 Casos de Uso

### 1. Investigar por que setup não está sendo detectado

**Problema:** "Pattern 1-2-3 nunca é acionado"

**Solução:**
1. Ativar `VITE_DEBUG_SETUPS=true`
2. Recarregar app
3. Observar logs no console
4. Verificar motivo:
   - ❌ Disabled in config → Habilitar em Settings
   - ❌ Cooldown active → Aguardar período de cooldown
   - ❌ No setup found → Padrão não está formado no mercado
   - ❌ Rejected by Trend Filter → Desabilitar filtro ou ajustar tendência

### 2. Entender frequência de detecção

**Objetivo:** Descobrir qual setup está sendo mais/menos detectado

**Solução:**
1. Ativar debug logs
2. Deixar app rodando por algumas horas
3. Analisar frequência de "✅ DETECTED" para cada setup
4. Ajustar parâmetros (`minConfidence`, `lookbackPeriod`, etc.) se necessário

### 3. Validar configuração de trend filter

**Objetivo:** Confirmar que apenas trades alinhados com tendência são permitidos

**Solução:**
1. Ativar `VITE_DEBUG_SETUPS=true`
2. Em Settings → Setups:
   - Habilitar "Trend Filter"
   - Desabilitar "Allow Counter-Trend"
3. Observar logs:
   - `Trend: bullish` → Apenas LONG permitido
   - `Trend: bearish` → Apenas SHORT permitido
   - Setups contra-tendência devem mostrar "❌ Rejected by Trend Filter"

### 4. Testar cooldown

**Objetivo:** Verificar se cooldown está prevenindo duplicatas

**Solução:**
1. Configurar `setupCooldownPeriod: 5` (período curto para teste)
2. Ativar debug logs
3. Observar:
   - Primeira detecção: "✅ DETECTED"
   - Próximas 5 candles: "❌ Cooldown active"
   - Após 5+ candles: "Can Detect: true" novamente

## 🛠️ Mensagens de Debug por Setup

### Setup 9.1
- ✅ Detectado: Padrão 9.1 formado com volume confirmação
- ❌ No setup found: Confidence muito baixa ou padrão incompleto

### Pattern 1-2-3
- ✅ Detectado: 3 pivôs formados + breakout confirmado
- ❌ No setup found: Menos de 3 pivôs ou breakout não confirmado

### Bull Trap
- ✅ Detectado: Falso rompimento de alta + reversão
- ❌ No setup found: Sem fake breakout ou reversão fraca

### Bear Trap
- ✅ Detectado: Falso rompimento de baixa + reversão
- ❌ No setup found: Sem fake breakdown ou reversão fraca

### Breakout Retest
- ✅ Detectado: Rompimento + reteste + continuação
- ❌ No setup found: Sem breakout ou reteste não confirmado

## ⚠️ Performance

**Importante:** Logs de debug têm impacto mínimo na performance porque:
- Apenas executam quando `VITE_DEBUG_SETUPS=true`
- Check `if (!DEBUG_ENABLED)` é a primeira linha (early return)
- Em produção (`VITE_DEBUG_SETUPS=false`), zero overhead

**Recomendação:**
- ✅ Usar em desenvolvimento e debug
- ❌ Desabilitar em produção (`.env` ou build de produção)

## 📝 Exemplo de Sessão de Debug

```bash
# 1. Ativar debug
echo "VITE_DEBUG_SETUPS=true" >> .env

# 2. Reiniciar app
npm run dev

# 3. Abrir DevTools (Cmd+Option+I)
# 4. Ir para aba Console
# 5. Aguardar novos candles ou mudar símbolo/timeframe
# 6. Observar logs detalhados

# 7. Quando finalizar debug
echo "VITE_DEBUG_SETUPS=false" > .env
# ou remover linha do .env
```

## 🔧 Troubleshooting

### Logs não aparecem

**Possíveis causas:**
1. `.env` não criado ou `VITE_DEBUG_SETUPS` não configurado
2. App não foi reiniciado após mudar `.env`
3. Console filtrado (verificar níveis de log no DevTools)

**Solução:**
```bash
# Verificar .env
cat .env | grep VITE_DEBUG_SETUPS

# Deve mostrar:
# VITE_DEBUG_SETUPS=true

# Reiniciar app
npm run dev
```

### Muitos logs poluindo console

**Solução 1:** Filtrar logs
```javascript
// No console do DevTools, filtrar por:
[SetupDetection]
```

**Solução 2:** Logs apenas de um setup específico
```javascript
// Modificar temporariamente SetupDetectionService.ts
private debugLog(...args: unknown[]): void {
  if (!DEBUG_ENABLED) return;
  // Filtrar apenas Setup 9.1
  if (!args.join(' ').includes('Setup 9.1')) return;
  // ... resto do código
}
```

---

**Última atualização:** 29 de Novembro de 2025  
**Versão:** 0.29.0
