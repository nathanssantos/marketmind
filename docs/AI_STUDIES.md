# Sistema de Estudos Técnicos da AI

## 📋 Visão Geral

O MarketMind possui um sistema que permite à AI desenhar estudos técnicos diretamente no gráfico. Os desenhos incluem suportes, resistências, linhas de tendência, zonas de liquidez, e outras análises visuais.

**⚠️ IMPORTANTE:** Os estudos podem ser desligados através do botão de toggle na sidebar do chat. Quando desligados, a AI **não receberá instruções sobre como desenhar estudos** e suas respostas não conterão referências a "Study #1", "Study #2", etc.

## 🎛️ Controle de Estudos

### Ativar/Desativar Estudos

Os estudos podem ser controlados através da UI:

1. Abra a sidebar do chat (ícone à esquerda)
2. Clique no botão "Enable AI Studies" / "Disable AI Studies"
3. Quando **desligado**:
   - ✅ A AI usa prompt **simplificado** (respostas mais curtas)
   - ✅ Respostas **não** contêm referências a "Study #1", "Study #2"
   - ✅ Análises focam apenas em texto sem desenhos
   - ✅ Ideal para perguntas rápidas e respostas concisas

4. Quando **ligado**:
   - ✅ A AI usa prompt **completo** (análises detalhadas)
   - ✅ Respostas incluem estudos desenhados no gráfico
   - ✅ Análises mais abrangentes com suporte/resistência
   - ✅ Ideal para análises técnicas completas

### Estado do Toggle

```typescript
import { useAIStore } from '@/renderer/store/aiStore';

const enableAIStudies = useAIStore((state) => state.enableAIStudies);
const toggleAIStudies = useAIStore((state) => state.toggleAIStudies);

// Verificar se estudos estão habilitados
if (enableAIStudies) {
  // Processar estudos da resposta
}

// Alternar estado
toggleAIStudies();
```

## 🎯 Características

### Tipos de Estudos Suportados

#### Linhas
- **Support** (Suporte): Linha horizontal em nível de preço importante
- **Resistance** (Resistência): Linha horizontal em nível de resistência
- **Trendline Bullish** (Linha de Tendência de Alta): Linha diagonal ascendente
- **Trendline Bearish** (Linha de Tendência de Baixa): Linha diagonal descendente

#### Zonas
- **Liquidity Zone** (Zona de Liquidez): Área retangular roxa
- **Sell Zone** (Zona de Venda): Área retangular vermelha
- **Buy Zone** (Zona de Compra): Área retangular verde
- **Accumulation Zone** (Zona de Acumulação): Área retangular azul

### Identificação Visual

Todos os estudos da AI são marcados com um **ícone roxo "AI"** no canto superior esquerdo, permitindo fácil identificação visual.

## 🏗️ Arquitetura

### Componentes Principais

1. **AIStudyRenderer** (`src/renderer/components/Chart/AIStudyRenderer.tsx`)
   - Renderiza os estudos no canvas usando overlay
   - Desenha linhas e zonas com cores específicas
   - Adiciona ícone "AI" a cada estudo

2. **AIStudyStorage** (`src/renderer/services/ai/AIStudyStorage.ts`)
   - Gerencia persistência de estudos por símbolo
   - Usa localStorage para armazenamento
   - Mantém estudos separados por ativo (BTC, ETH, SOL, etc)

3. **AIResponseParser** (`src/renderer/services/ai/AIResponseParser.ts`)
   - Extrai JSON de estudos da resposta da AI
   - Valida estrutura dos dados
   - Separa análise textual dos dados de desenho

4. **useAIStudies** (`src/renderer/hooks/useAIStudies.ts`)
   - Hook React para gerenciar estudos
   - Carrega/salva/deleta estudos por símbolo
   - Processa respostas da AI

### Fluxo de Dados

```
Usuário faz pergunta → AI responde com análise + JSON de estudos
                                          ↓
                    AIResponseParser extrai JSON e valida
                                          ↓
                    useAIStudies salva estudos no localStorage
                                          ↓
                    ChartCanvas renderiza estudos via AIStudyRenderer
                                          ↓
                    Ícone "AI" identifica cada estudo visualmente
```

## 📝 Formato da Resposta da AI

A AI foi instruída a retornar suas análises com um bloco JSON estruturado:

```markdown
**Análise do Gráfico:**

[Análise técnica normal aqui...]

```json
{
  "studies": [
    {
      "type": "support",
      "points": [
        {"timestamp": 1700000000000, "price": 42000},
        {"timestamp": 1700086400000, "price": 42000}
      ],
      "label": "Suporte Forte",
      "confidence": 85
    },
    {
      "type": "buy-zone",
      "topPrice": 43500,
      "bottomPrice": 42800,
      "startTimestamp": 1700000000000,
      "endTimestamp": 1700172800000,
      "label": "Zona de Acumulação",
      "confidence": 75
    }
  ]
}
```
```

## 🎨 Cores dos Estudos

```typescript
const AI_STUDY_COLORS = {
  support: '#26a69a',              // Verde água
  resistance: '#ef5350',           // Vermelho
  'trendline-bullish': '#4caf50',  // Verde
  'trendline-bearish': '#f44336',  // Vermelho
  'liquidity-zone': 'rgba(156, 39, 176, 0.2)',    // Roxo transparente
  'sell-zone': 'rgba(244, 67, 54, 0.2)',          // Vermelho transparente
  'buy-zone': 'rgba(76, 175, 80, 0.2)',           // Verde transparente
  'accumulation-zone': 'rgba(33, 150, 243, 0.2)', // Azul transparente
};
```

## 🖱️ Interação do Usuário

### Menu de Contexto

Clique com o **botão direito** no canvas para abrir o menu de contexto:
- **Apagar Estudos da AI**: Remove todos os estudos do ativo atual

### Comportamento Inteligente

- **Persistência por Símbolo**: Estudos do BTC permanecem quando você volta ao BTC
- **Prevenção de Duplicatas**: Novos estudos só são criados quando os anteriores são apagados
- **Análise sem Desenho**: A AI pode mencionar níveis na análise sem necessariamente desenhá-los

## 🔧 Uso Programático

### Usar o Hook

```typescript
import { useAIStudies } from '@/renderer/hooks/useAIStudies';

function MyComponent() {
  const { studies, hasStudies, deleteStudies, processAIResponse } = useAIStudies('BTCUSDT');
  
  // Renderizar estudos
  <ChartCanvas aiStudies={studies} onDeleteAIStudies={deleteStudies} />
  
  // Processar resposta da AI
  const cleanResponse = processAIResponse(aiResponse);
}
```

### Integração com aiStore

```typescript
// No App.tsx, o processador é registrado automaticamente
const { processAIResponse } = useAIStudies(symbol);
const setResponseProcessor = useAIStore(state => state.setResponseProcessor);

useEffect(() => {
  setResponseProcessor(processAIResponse);
  return () => setResponseProcessor(null);
}, [processAIResponse, setResponseProcessor]);
```

## 📊 Estrutura de Dados

### Tipo AIStudy

```typescript
type AIStudyLine = {
  type: 'support' | 'resistance' | 'trendline-bullish' | 'trendline-bearish';
  points: [
    { timestamp: number; price: number },
    { timestamp: number; price: number }
  ];
  label?: string;
  confidence?: number;
};

type AIStudyZone = {
  type: 'liquidity-zone' | 'sell-zone' | 'buy-zone' | 'accumulation-zone';
  topPrice: number;
  bottomPrice: number;
  startTimestamp: number;
  endTimestamp: number;
  label?: string;
  confidence?: number;
};

type AIStudy = AIStudyLine | AIStudyZone;
```

### Armazenamento

```typescript
interface AIStudyData {
  id: string;
  symbol: string;
  createdAt: number;
  studies: AIStudy[];
}

// localStorage key: 'marketmind-ai-studies'
// Estrutura: { [symbol: string]: AIStudyData }
```

## 🚀 Próximas Melhorias

### Planejadas para v1.1+
- [ ] Edição de estudos (arrastar pontos, redimensionar zonas)
- [ ] Estudos desenhados manualmente pelo usuário
- [ ] Exportar/importar estudos
- [ ] Mais tipos de estudos (Fibonacci, Elliott Waves, etc)
- [ ] Histórico de versões de estudos
- [ ] Snapshot de estudos junto com análise
- [ ] Filtros por tipo de estudo (mostrar/ocultar)

## 🐛 Troubleshooting

### Estudos não aparecem
1. **Verifique se os estudos estão habilitados**: Toggle na sidebar do chat deve estar azul
2. Verifique se a AI retornou JSON válido
3. Abra o console e procure por erros de parsing
4. Confirme que os timestamps estão dentro do range dos candles

### AI menciona "Study #1" mas estudos estão desligados
- **Causa**: Estado do toggle não foi propagado corretamente para o AIService
- **Solução**: 
  1. Reabra a sidebar do chat
  2. Toggle os estudos (desligar e ligar novamente)
  3. Envie nova mensagem para a AI
  4. O prompt será atualizado automaticamente

### Respostas da AI muito longas com instruções de desenho
- **Causa**: Estudos habilitados usam prompt "full" com análises detalhadas
- **Solução**: Desabilite os estudos através do toggle para ativar o prompt "simple" e obter respostas mais curtas e objetivas

### Diferença entre prompts
- **Prompt Full** (estudos ligados): ~2000+ caracteres, análise detalhada com seções estruturadas
- **Prompt Simple** (estudos desligados): ~300 caracteres, respostas diretas e concisas
4. Verifique se o símbolo está correto

### Estudos não são salvos
1. Verifique permissões do localStorage
2. Confirme que não há limite de quota excedido
3. Teste com outro símbolo

### Menu de contexto não abre
1. Verifique se o evento onContextMenu está conectado
2. Confirme que não há conflito com outros event listeners
3. Teste em área diferente do canvas

## 📚 Referências

- **Tipos**: `src/shared/types/aiStudy.ts`
- **Renderer**: `src/renderer/components/Chart/AIStudyRenderer.tsx`
- **Storage**: `src/renderer/services/ai/AIStudyStorage.ts`
- **Parser**: `src/renderer/services/ai/AIResponseParser.ts`
- **Hook**: `src/renderer/hooks/useAIStudies.ts`
- **Prompts**: `src/renderer/services/ai/prompts.json`

---

**Versão:** 1.0  
**Data:** Novembro 2024  
**Autor:** Sistema de AI Studies do MarketMind
