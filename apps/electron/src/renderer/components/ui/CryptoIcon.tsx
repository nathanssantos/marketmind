import { Box } from '@chakra-ui/react';
import { Image } from './image';
import { memo, useState } from 'react';

interface CryptoIconProps {
    symbol: string;
    size?: number;
    onClick?: () => void;
    cursor?: string;
}

const extractBaseAsset = (symbol: string): string => {
    const quoteAssets = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'GBP', 'TRY', 'BRL', 'FDUSD', 'TUSD'];

    for (const quote of quoteAssets) {
        if (symbol.endsWith(quote)) {
            return symbol.slice(0, -quote.length).toLowerCase();
        }
    }

    return symbol.toLowerCase();
};

const ICON_SOURCES = [
    (asset: string) => `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/icon/${asset}.png`,
    (asset: string) => `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${asset}.png`,
    (asset: string) => `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/icon/${asset}.png`,
    (asset: string) => `https://assets.coincap.io/assets/icons/${asset}@2x.png`,
];

const workingSourceByAsset = new Map<string, number>();
const knownBadAssets = new Set<string>();

const CryptoIconComponent = ({ symbol, size = 16, onClick, cursor }: CryptoIconProps) => {
    const baseAsset = extractBaseAsset(symbol);
    const [sourceIndex, setSourceIndex] = useState(() => workingSourceByAsset.get(baseAsset) ?? 0);
    const [hasError, setHasError] = useState(() => knownBadAssets.has(baseAsset));

    const handleError = () => {
        if (sourceIndex < ICON_SOURCES.length - 1) {
            setSourceIndex(prev => prev + 1);
        } else {
            knownBadAssets.add(baseAsset);
            setHasError(true);
        }
    };

    const handleLoad = () => {
        workingSourceByAsset.set(baseAsset, sourceIndex);
    };

    if (hasError) {
        return (
            <Box
                w={`${size}px`}
                h={`${size}px`}
                borderRadius="full"
                bg="gray.500"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize={`${Math.max(size * 0.5, 8)}px`}
                fontWeight="bold"
                color="white"
                flexShrink={0}
                onClick={onClick}
                cursor={cursor}
            >
                {baseAsset.charAt(0).toUpperCase()}
            </Box>
        );
    }

    return (
        <Image
            src={ICON_SOURCES[sourceIndex]?.(baseAsset) ?? ''}
            alt={`${symbol} icon`}
            w={`${size}px`}
            h={`${size}px`}
            borderRadius="full"
            objectFit="cover"
            onError={handleError}
            onLoad={handleLoad}
            flexShrink={0}
            onClick={onClick}
            cursor={cursor}
        />
    );
};

export const CryptoIcon = memo(CryptoIconComponent);
