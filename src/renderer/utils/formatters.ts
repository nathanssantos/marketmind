import { formatDistanceToNow } from 'date-fns';
import type { ChartContextData } from '../context/ChartContext';

export const formatPrice = (price: number): string => {
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(2)}M`;
  }
  if (price >= 1000) {
    return `${(price / 1000).toFixed(2)}K`;
  }
  if (price >= 1) {
    return price.toFixed(2);
  }
  if (price >= 0.01) {
    return price.toFixed(4);
  }
  return price.toFixed(8);
};

export const formatTimestamp = (timestamp: number, interval?: string): string => {
  const date = new Date(timestamp);
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  if (interval === '1m' || interval === '5m' || interval === '15m' || interval === '30m') {
    return `${hours}:${minutes}`;
  }

  if (interval === '1h' || interval === '4h') {
    return `${day}/${month} ${hours}:${minutes}`;
  }

  return `${day}/${month}/${year}`;
};

export const formatDateTimeTooltip = (timestamp: number | Date): string => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

export const formatVolume = (volume: number): string => {
  if (volume >= 1000000000) {
    return `${(volume / 1000000000).toFixed(2)}B`;
  }
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(2)}K`;
  }
  return volume.toFixed(0);
};

export const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatChartDataContext = (chartData: ChartContextData): string => {
  const recentCandles = chartData.candles.slice(-100);
  
  if (recentCandles.length === 0) {
    return 'No chart data available';
  }
  
  const prices = recentCandles.map((c) => c.close);
  const volumes = recentCandles.map((c) => c.volume);
  
  const currentPrice = prices[prices.length - 1] || 0;
  const previousPrice = prices[prices.length - 2] || currentPrice;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice !== 0 ? (priceChange / previousPrice) * 100 : 0;
  
  const highPrice = Math.max(...prices);
  const lowPrice = Math.min(...prices);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const currentVolume = volumes[volumes.length - 1] || 0;
  
  const bullishCandles = recentCandles.filter((c) => c.close > c.open).length;
  const bearishCandles = recentCandles.filter((c) => c.close < c.open).length;
  
  const trend = bullishCandles > bearishCandles ? 'Bullish' : bearishCandles > bullishCandles ? 'Bearish' : 'Neutral';
  
  let contextText = `# Chart Analysis Context\n\n`;
  contextText += `## Asset Information\n`;
  contextText += `- Symbol: ${chartData.symbol}\n`;
  contextText += `- Timeframe: ${chartData.timeframe}\n`;
  contextText += `- Chart Type: ${chartData.chartType}\n\n`;
  
  contextText += `## Price Statistics (Last 100 Candles)\n`;
  contextText += `- Current Price: $${formatPrice(currentPrice)}\n`;
  contextText += `- Price Change: ${priceChange > 0 ? '+' : ''}${formatPrice(priceChange)} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)\n`;
  contextText += `- High: $${formatPrice(highPrice)}\n`;
  contextText += `- Low: $${formatPrice(lowPrice)}\n`;
  contextText += `- Price Range: $${formatPrice(highPrice - lowPrice)}\n\n`;
  
  contextText += `## Volume Analysis\n`;
  contextText += `- Average Volume: ${formatVolume(avgVolume)}\n`;
  contextText += `- Current Volume: ${formatVolume(currentVolume)}\n\n`;
  
  contextText += `## Price Action\n`;
  contextText += `- Bullish Candles: ${bullishCandles} (${((bullishCandles / recentCandles.length) * 100).toFixed(1)}%)\n`;
  contextText += `- Bearish Candles: ${bearishCandles} (${((bearishCandles / recentCandles.length) * 100).toFixed(1)}%)\n`;
  contextText += `- Overall Trend: ${trend}\n\n`;
  
  if (chartData.movingAverages && chartData.movingAverages.length > 0) {
    contextText += `## Moving Averages\n`;
    chartData.movingAverages
      .filter((ma) => ma.visible)
      .forEach((ma) => {
        contextText += `- ${ma.type}-${ma.period}: Active\n`;
      });
    contextText += `\n`;
  }
  
  if (chartData.news && chartData.news.length > 0) {
    contextText += `## Recent News (${chartData.news.length} articles)\n\n`;
    
    const sentimentCounts = {
      positive: chartData.news.filter((n) => n.sentiment === 'positive').length,
      negative: chartData.news.filter((n) => n.sentiment === 'negative').length,
      neutral: chartData.news.filter((n) => n.sentiment === 'neutral').length,
    };
    
    contextText += `### News Sentiment Summary\n`;
    contextText += `- Positive: ${sentimentCounts.positive} (${((sentimentCounts.positive / chartData.news.length) * 100).toFixed(1)}%)\n`;
    contextText += `- Negative: ${sentimentCounts.negative} (${((sentimentCounts.negative / chartData.news.length) * 100).toFixed(1)}%)\n`;
    contextText += `- Neutral: ${sentimentCounts.neutral} (${((sentimentCounts.neutral / chartData.news.length) * 100).toFixed(1)}%)\n\n`;
    
    contextText += `### Latest News Articles\n`;
    chartData.news.slice(0, 10).forEach((article, index) => {
      contextText += `${index + 1}. **${article.title}**\n`;
      contextText += `   - Source: ${article.source}\n`;
      contextText += `   - Published: ${formatDistanceToNow(article.publishedAt, { addSuffix: true })}\n`;
      contextText += `   - Sentiment: ${article.sentiment || 'Unknown'}\n`;
      if (article.description) {
        contextText += `   - Summary: ${article.description.slice(0, 150)}${article.description.length > 150 ? '...' : ''}\n`;
      }
      contextText += `\n`;
    });
  }
  
  return contextText;
};
