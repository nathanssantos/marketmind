import { Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

export const MarketNoData = () => {
  const { t } = useTranslation();
  return <Text fontSize="xs" color="fg.muted">{t('common.noData')}</Text>;
};
