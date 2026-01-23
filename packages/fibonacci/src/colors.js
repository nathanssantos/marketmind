import { FIBONACCI_LEVEL_TO_NAME } from './levels';
export const FIBONACCI_DEFAULT_COLOR = 'rgba(128, 128, 128, 0.35)';
export const FIBONACCI_LEVEL_COLORS = {
    level0: FIBONACCI_DEFAULT_COLOR,
    level236: FIBONACCI_DEFAULT_COLOR,
    level382: FIBONACCI_DEFAULT_COLOR,
    level50: FIBONACCI_DEFAULT_COLOR,
    level618: FIBONACCI_DEFAULT_COLOR,
    level786: FIBONACCI_DEFAULT_COLOR,
    level886: FIBONACCI_DEFAULT_COLOR,
    level100: FIBONACCI_DEFAULT_COLOR,
    level127: FIBONACCI_DEFAULT_COLOR,
    level161: FIBONACCI_DEFAULT_COLOR,
    level200: FIBONACCI_DEFAULT_COLOR,
    level261: FIBONACCI_DEFAULT_COLOR,
};
export const getLevelColor = (level, customColors, defaultColor = FIBONACCI_DEFAULT_COLOR) => {
    const levelName = FIBONACCI_LEVEL_TO_NAME[level];
    if (!levelName)
        return defaultColor;
    return customColors?.[levelName] ?? FIBONACCI_LEVEL_COLORS[levelName] ?? defaultColor;
};
export const FIBONACCI_COLOR_NAMES = Object.keys(FIBONACCI_LEVEL_COLORS);
