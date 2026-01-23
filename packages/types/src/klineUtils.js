export const parseKlinePrice = (price) => parseFloat(price);
export const parseKlineVolume = (volume) => parseFloat(volume);
export const getKlineOpen = (kline) => parseFloat(kline.open);
export const getKlineHigh = (kline) => parseFloat(kline.high);
export const getKlineLow = (kline) => parseFloat(kline.low);
export const getKlineClose = (kline) => parseFloat(kline.close);
export const getKlineVolume = (kline) => parseFloat(kline.volume);
export const getKlineTimestamp = (kline) => kline.openTime;
export const getKlineCloseTime = (kline) => kline.closeTime;
export const getKlineDuration = (kline) => kline.closeTime - kline.openTime;
export const isKlineBullish = (kline) => parseFloat(kline.close) > parseFloat(kline.open);
export const isKlineBearish = (kline) => parseFloat(kline.close) < parseFloat(kline.open);
export const getKlineBodySize = (kline) => Math.abs(parseFloat(kline.close) - parseFloat(kline.open));
export const getKlineUpperWick = (kline) => {
    const high = parseFloat(kline.high);
    const open = parseFloat(kline.open);
    const close = parseFloat(kline.close);
    return high - Math.max(open, close);
};
export const getKlineLowerWick = (kline) => {
    const low = parseFloat(kline.low);
    const open = parseFloat(kline.open);
    const close = parseFloat(kline.close);
    return Math.min(open, close) - low;
};
export const getKlineQuoteVolume = (kline) => parseFloat(kline.quoteVolume);
export const getKlineTrades = (kline) => kline.trades;
export const getKlineTakerBuyBaseVolume = (kline) => parseFloat(kline.takerBuyBaseVolume);
export const getKlineTakerBuyQuoteVolume = (kline) => parseFloat(kline.takerBuyQuoteVolume);
export const getKlineBuyPressure = (kline) => {
    const totalVolume = parseFloat(kline.volume);
    if (totalVolume === 0)
        return 0.5;
    const buyVolume = parseFloat(kline.takerBuyBaseVolume);
    return buyVolume / totalVolume;
};
export const getKlineSellPressure = (kline) => 1 - getKlineBuyPressure(kline);
export const getKlinePressureType = (kline) => {
    const buyPressure = getKlineBuyPressure(kline);
    if (buyPressure > 0.55)
        return 'buy';
    if (buyPressure < 0.45)
        return 'sell';
    return 'neutral';
};
export const getKlineAverageTradeSize = (kline) => {
    const trades = kline.trades;
    if (trades === 0)
        return 0;
    const volume = parseFloat(kline.volume);
    return volume / trades;
};
export const getKlineAverageTradeValue = (kline) => {
    const trades = kline.trades;
    if (trades === 0)
        return 0;
    const quoteVolume = parseFloat(kline.quoteVolume);
    return quoteVolume / trades;
};
