export const FIBONACCI_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 0.886, 1];
export const FIBONACCI_EXTENSION_LEVELS = [1, 1.272, 1.618, 2, 2.618];
export const FIBONACCI_ALL_LEVELS = [
    0, 0.236, 0.382, 0.5, 0.618, 0.786, 0.886, 1, 1.272, 1.618, 2, 2.618,
];
export const FIBONACCI_TARGET_LEVELS = ['auto', '1', '1.272', '1.618', '2', '2.618'];
export const FIBONACCI_PYRAMID_LEVELS = ['1', '1.272', '1.618', '2', '2.618'];
export const FIBONACCI_LEVEL_TO_NAME = {
    0: 'level0',
    0.236: 'level236',
    0.382: 'level382',
    0.5: 'level50',
    0.618: 'level618',
    0.786: 'level786',
    0.886: 'level886',
    1: 'level100',
    1.27: 'level127',
    1.272: 'level127',
    1.618: 'level161',
    2: 'level200',
    2.618: 'level261',
};
export const FIBONACCI_PYRAMID_VALUES = {
    '1': 1.0,
    '1.272': 1.272,
    '1.618': 1.618,
    '2': 2.0,
    '2.618': 2.618,
};
export const formatFibonacciLabel = (level) => `${(level * 100).toFixed(1)}%`;
export const getLevelName = (level) => FIBONACCI_LEVEL_TO_NAME[level];
