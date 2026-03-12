import { Text } from '@chakra-ui/react';
import { memo } from 'react';
import { convertUsdtToBrl, useCurrencyStore } from '../store/currencyStore';
import { formatBRL } from '../utils/currencyFormatter';

interface BrlValueProps {
    usdtValue: number;
    fontSize?: string;
}

export const BrlValue = memo(({ usdtValue, fontSize = '2xs' }: BrlValueProps) => {
    const usdtBrlRate = useCurrencyStore((s) => s.usdtBrlRate);
    const showBrlValues = useCurrencyStore((s) => s.showBrlValues);

    if (!showBrlValues) return null;

    const brlValue = convertUsdtToBrl(usdtValue, usdtBrlRate);

    return (
        <Text fontSize={fontSize} color="fg.muted" lineHeight="1.2">
            {formatBRL(brlValue)}
        </Text>
    );
});

BrlValue.displayName = 'BrlValue';
