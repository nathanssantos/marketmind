export interface ParsedSignal {
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
}

export const parseSignalFromResponse = (text: string): ParsedSignal | null => {
  const signalRegex = /\*\*Current Signal\*\*:?\s*(STRONG[_\s]+BUY|BUY|HOLD|SELL|STRONG[_\s]+SELL)/i;
  const confidenceRegex = /\*\*Confidence\*\*:?\s*(\d+)%?/i;

  const signalMatch = text.match(signalRegex);
  const confidenceMatch = text.match(confidenceRegex);

  if (!signalMatch || !signalMatch[1]) return null;

  const normalizedSignal = signalMatch[1].toUpperCase().replace(/[_\s]+/g, '_');

  const signalMap: Record<string, 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'> = {
    STRONG_BUY: 'strong_buy',
    BUY: 'buy',
    HOLD: 'hold',
    SELL: 'sell',
    STRONG_SELL: 'strong_sell',
  };

  const signal = signalMap[normalizedSignal];

  if (!signal) return null;

  const confidence = confidenceMatch && confidenceMatch[1] ? parseInt(confidenceMatch[1], 10) : 50;

  return { signal, confidence };
};
