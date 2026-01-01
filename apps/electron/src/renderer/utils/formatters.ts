import { getKlineClose, getKlineOpen, getKlineVolume } from '@shared/utils';
import type { ChartContextData } from '../context/ChartContext';

export const formatPriceDisplay = (price: number): string => {
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

export const formatTimestamp = (timestamp: number, interval?: string, previousTimestamp?: number): string => {
  const date = new Date(timestamp);
  const prevDate = previousTimestamp ? new Date(previousTimestamp) : null;
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  const sameDay = prevDate && 
    prevDate.getDate() === date.getDate() && 
    prevDate.getMonth() === date.getMonth() && 
    prevDate.getFullYear() === date.getFullYear();

  if (interval === '1m' || interval === '5m' || interval === '15m' || interval === '30m') {
    if (!sameDay && prevDate) {
      return `${day}/${month} ${hours}:${minutes}`;
    }
    return `${hours}:${minutes}`;
  }

  if (interval === '1h' || interval === '2h' || interval === '4h' || interval === '6h' || interval === '8h' || interval === '12h') {
    if (!sameDay && prevDate) {
      return `${day}/${month} ${hours}h`;
    }
    return `${hours}h`;
  }

  if (interval === '1d' || interval === '3d') {
    const sameYear = prevDate && prevDate.getFullYear() === date.getFullYear();
    if (!sameYear && prevDate) {
      return `${day}/${month}/${year}`;
    }
    return `${day}/${month}`;
  }

  if (interval === '1w' || interval === '1M') {
    return `${month}/${year}`;
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

export const formatVolumeDisplay = (volume: number): string => {
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
  const recentKlines = chartData.klines.slice(-100);
  
  if (recentKlines.length === 0) {
    return 'No chart data available';
  }
  
  const prices = recentKlines.map((c) => getKlineClose(c));
  const volumes = recentKlines.map((c) => getKlineVolume(c));
  
  const currentPrice = prices[prices.length - 1] || 0;
  const previousPrice = prices[prices.length - 2] || currentPrice;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice !== 0 ? (priceChange / previousPrice) * 100 : 0;
  
  const highPrice = Math.max(...prices);
  const lowPrice = Math.min(...prices);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const currentVolume = volumes[volumes.length - 1] || 0;
  
  const bullishKlines = recentKlines.filter((c) => getKlineClose(c) > getKlineOpen(c)).length;
  const bearishKlines = recentKlines.filter((c) => getKlineClose(c) < getKlineOpen(c)).length;
  
  const trend = bullishKlines > bearishKlines ? 'Bullish' : bearishKlines > bullishKlines ? 'Bearish' : 'Neutral';
  
  let contextText = `# Chart Analysis Context\n\n`;
  contextText += `## Asset Information\n`;
  contextText += `- Symbol: ${chartData.symbol}\n`;
  contextText += `- Timeframe: ${chartData.timeframe}\n`;
  contextText += `- Chart Type: ${chartData.chartType}\n\n`;
  
  contextText += `## Price Statistics (Last 100 Klines)\n`;
  contextText += `- Current Price: $${formatPriceDisplay(currentPrice)}\n`;
  contextText += `- Price Change: ${priceChange > 0 ? '+' : ''}${formatPriceDisplay(priceChange)} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)\n`;
  contextText += `- High: $${formatPriceDisplay(highPrice)}\n`;
  contextText += `- Low: $${formatPriceDisplay(lowPrice)}\n`;
  contextText += `- Price Range: $${formatPriceDisplay(highPrice - lowPrice)}\n\n`;

  contextText += `## Volume Analysis\n`;
  contextText += `- Average Volume: ${formatVolumeDisplay(avgVolume)}\n`;
  contextText += `- Current Volume: ${formatVolumeDisplay(currentVolume)}\n\n`;
  
  contextText += `## Price Action\n`;
  contextText += `- Bullish Klines: ${bullishKlines} (${((bullishKlines / recentKlines.length) * 100).toFixed(1)}%)\n`;
  contextText += `- Bearish Klines: ${bearishKlines} (${((bearishKlines / recentKlines.length) * 100).toFixed(1)}%)\n`;
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
  
  return contextText;
};
