export const isCalcExpression = (value) => typeof value === 'object' && value !== null && 'calc' in value;
export const isParameterReference = (value) => typeof value === 'string' && value.startsWith('$');
export const isIndicatorReference = (value) => typeof value === 'string' && !value.startsWith('$') && !isPriceReference(value);
export const isPriceReference = (value) => typeof value === 'string' &&
    ['open', 'high', 'low', 'close', 'volume'].includes(value);
export const isConditionGroup = (condition) => 'operator' in condition && 'conditions' in condition;
export const isIndicatorExitLevel = (exit) => exit.type === 'indicator' || exit.type === 'atr';
