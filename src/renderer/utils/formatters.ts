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
