import type { IndicatorType } from '@marketmind/types';

import { ADVANCED_HANDLERS } from './handlers-advanced';
import { CORE_HANDLERS } from './handlers-core';
import type { IndicatorHandlerMap } from './types';

export { calculateVolumeSMA } from './indicator-utils';
export { calculateHighest, calculateLowest } from './indicator-utils';

export const createIndicatorHandlers = (): IndicatorHandlerMap =>
  ({ ...CORE_HANDLERS, ...ADVANCED_HANDLERS }) as Record<IndicatorType, IndicatorHandlerMap[IndicatorType]>;
