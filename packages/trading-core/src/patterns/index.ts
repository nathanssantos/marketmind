export type {
  PatternCategory,
  PatternSentiment,
  PatternParamDef,
  PatternDefinition,
  PatternParams,
  PatternHit,
  PatternBarWindow,
} from './types';
export { parsePatternExpression, PatternParseError, type Expr as PatternExpr } from './parser';
export { evaluatePatternExpression } from './evaluator';
export { compilePattern, detectPatterns, type CompiledPattern } from './detect';
export { PRIMITIVE_FNS, type PrimitiveFnName } from './primitives';
export {
  BUILTIN_PATTERNS,
  BUILTIN_PATTERN_MAP,
  DEFAULT_ENABLED_PATTERN_IDS,
} from './builtin';
