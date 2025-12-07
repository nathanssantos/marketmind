/**
 * Dynamic Strategy Detection Module
 *
 * This module provides a JSON-based strategy definition system that allows
 * trading strategies to be defined in external files without TypeScript code changes.
 */

export { IndicatorEngine } from './IndicatorEngine';
export { ConditionEvaluator } from './ConditionEvaluator';
export { ExitCalculator } from './ExitCalculator';
export { StrategyInterpreter, type StrategyInterpreterConfig } from './StrategyInterpreter';
export { StrategyLoader, StrategyValidationException } from './StrategyLoader';
