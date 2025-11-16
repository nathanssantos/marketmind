# 🧪 Guia de Teste - Sistema de Estudos da AI

## Como Testar os Desenhos da AI

### 1. Preparação
1. **Inicie a aplicação**: `yarn dev`
2. **Abra o Console do Browser**: `Cmd+Option+I` (macOS) ou `F12` (Windows/Linux)
3. **Selecione um ativo**: Ex: BTCUSDT
4. **Escolha um timeframe**: Ex: 1d (diário)

### 2. Fazendo uma Análise

#### Passo 1: Configure a AI
- Vá em **Settings** (ícone de engrenagem)
- Configure sua **API Key** do Claude/OpenAI/Gemini
- Selecione o **modelo** desejado (ex: Claude Sonnet 4.5)

#### Passo 2: Abra o Chat
- Clique no ícone de chat no header
- O painel lateral deve abrir

#### Passo 3: Solicite Análise
Digite uma mensagem como:
```
Analyze this Bitcoin chart and identify key support and resistance levels. Draw them on the chart.
```

ou em português:
```
Analise este gráfico do Bitcoin e identifique suportes e resistências importantes. Desenhe-os no gráfico.
```

⚠️ **IMPORTANTE**: Seja explícito ao pedir para "desenhar" ou "draw" os níveis. Isso aumenta a chance da AI retornar o JSON necessário.

### 3. O Que Observar no Console

Você deve ver logs como:

```
[useAIStudies] Loading studies for symbol: BTCUSDT
[useAIStudies] No studies found
[useAIStudies] Processing AI response, hasStudies: false
[AIResponseParser] Parsing response, length: 1234
[AIResponseParser] Found JSON block: {"studies":[...]}
[AIResponseParser] Parsed studies: 2
[AIResponseParser] Studies data: [{type: "support", ...}, {type: "resistance", ...}]
[AIResponseParser] Valid studies: 2
[useAIStudies] Saving studies: [{...}, {...}]
```

### 4. Verificando os Desenhos

#### Sinais de Sucesso ✅
- **Ícone "AI" roxo** aparece no gráfico
- **Linhas ou zonas** desenhadas nos níveis mencionados pela AI
- **Console mostra** "Valid studies: X" (onde X > 0)
- **localStorage** contém dados: Abra Application > Local Storage > `marketmind-ai-studies`

#### Problemas Comuns ❌

**Nenhum desenho aparece:**
```
[AIResponseParser] No JSON block found in response
```
→ A AI não retornou JSON. Tente reformular a pergunta ou use outro modelo.

**Estudos inválidos:**
```
[AIResponseParser] Invalid line study - points: undefined
```
→ A AI usou timestamps incorretos. Verifique se os timestamps estão no range correto.

**Timestamps fora do range:**
```
[AIResponseParser] Invalid zone study: {topPrice: ..., startTimestamp: 0}
```
→ A AI não seguiu as instruções de timestamp. Tente novamente.

### 5. Testando o Menu de Contexto

1. **Clique direito** no canvas do gráfico
2. Deve aparecer menu com opção **"Apagar Estudos da AI"**
3. Clique na opção
4. Os desenhos devem desaparecer
5. Console deve mostrar:
```
[useAIStudies] Loading studies for symbol: BTCUSDT
[useAIStudies] No studies found
```

### 6. Testando Persistência por Símbolo

1. **Crie estudos** para BTCUSDT (Bitcoin)
2. **Mude para outro símbolo**: Ex: ETHUSDT (Ethereum)
3. Console deve mostrar:
```
[useAIStudies] Loading studies for symbol: ETHUSDT
[useAIStudies] No studies found
```
4. **Volte para BTCUSDT**
5. Console deve mostrar:
```
[useAIStudies] Loading studies for symbol: BTCUSDT
[useAIStudies] Found studies: [...]
```
6. Os desenhos do BTC devem aparecer novamente!

### 7. Testando Prevenção de Duplicatas

1. **Faça uma análise** → Estudos são criados
2. **Faça outra análise**
3. Console deve mostrar:
```
[useAIStudies] Processing AI response, hasStudies: true
[useAIStudies] Already has studies, returning original response
```
4. **Nenhum novo desenho** deve ser criado
5. Para criar novos:
   - Clique direito → "Apagar Estudos da AI"
   - Faça nova análise → Novos estudos serão criados

### 8. Inspecionando Dados no localStorage

Abra **DevTools** → **Application** → **Local Storage** → `http://localhost:5173`

Procure pela chave: `marketmind-ai-studies`

Estrutura esperada:
```json
{
  "BTCUSDT": {
    "id": "BTCUSDT-1700000000000",
    "symbol": "BTCUSDT",
    "createdAt": 1700000000000,
    "studies": [
      {
        "type": "support",
        "points": [
          {"timestamp": 1699920000000, "price": 42000},
          {"timestamp": 1700000000000, "price": 42000}
        ],
        "label": "Strong Support"
      }
    ]
  }
}
```

### 9. Exemplo de Resposta da AI Correta

A AI deve retornar algo como:

```markdown
**Summary**: Bitcoin is showing strong bullish momentum with key support at $42,000...

**Key Observations**:
- Support level at $42,000 holding strong
- Resistance zone between $45,000-$46,000
- Bullish trendline forming

... (resto da análise) ...

```json
{
  "studies": [
    {
      "type": "support",
      "points": [
        {"timestamp": 1731628800000, "price": 42000},
        {"timestamp": 1731715200000, "price": 42000}
      ],
      "label": "Key Support"
    },
    {
      "type": "resistance",
      "points": [
        {"timestamp": 1731628800000, "price": 46000},
        {"timestamp": 1731715200000, "price": 46000}
      ],
      "label": "Resistance Zone"
    }
  ]
}
```
```

### 10. Troubleshooting

#### Problema: "No JSON block found"
**Solução**: A AI precisa ser mais específica. Tente:
```
Please analyze this chart and provide your analysis with JSON data for drawing support/resistance levels
```

#### Problema: "Invalid timestamp"
**Solução**: Verifique se o timestamp está no console:
```
=== TIMESTAMP INFORMATION FOR DRAWING STUDIES ===
First Candle Timestamp: 1731000000000
Last Candle Timestamp: 1731715200000
```
Os timestamps da AI devem estar entre esses valores.

#### Problema: Desenhos não aparecem mas JSON é válido
**Solução**: 
1. Verifique se `ChartCanvas` está recebendo `aiStudies` prop
2. Verifique se `AIStudyRenderer` está renderizando
3. Abra React DevTools e inspecione props do `ChartCanvas`

### 11. Comandos Úteis

```bash
# Ver localStorage no terminal
yarn dev
# No console do browser:
localStorage.getItem('marketmind-ai-studies')

# Limpar todos os estudos
localStorage.removeItem('marketmind-ai-studies')
window.location.reload()

# Ver todos os dados armazenados
Object.keys(localStorage).filter(k => k.startsWith('marketmind'))
```

---

## ✅ Checklist de Teste Completo

- [ ] App inicia sem erros
- [ ] Console mostra logs de "[useAIStudies]"
- [ ] AI retorna JSON válido
- [ ] Desenhos aparecem no gráfico com ícone "AI"
- [ ] Menu de contexto abre (clique direito)
- [ ] "Apagar Estudos" funciona
- [ ] Persistência por símbolo funciona
- [ ] Prevenção de duplicatas funciona
- [ ] Timestamps estão corretos
- [ ] localStorage contém dados corretos

---

**Última Atualização**: Novembro 2024
