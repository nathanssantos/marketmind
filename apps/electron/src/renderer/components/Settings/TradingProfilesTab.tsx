import { Separator, Stack } from '@chakra-ui/react';
import { TradingProfilesManager } from '@renderer/components/Trading/TradingProfilesManager';
import { WatcherManager } from '@renderer/components/Trading/WatcherManager';
import type { ReactElement } from 'react';

export const TradingProfilesTab = (): ReactElement => {
  return (
    <Stack gap={6}>
      <TradingProfilesManager />
      <Separator />
      <WatcherManager />
    </Stack>
  );
};
