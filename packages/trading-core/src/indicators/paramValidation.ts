import { z } from 'zod';
import { INDICATOR_CATALOG } from './catalog';
import type { IndicatorParamValue, ParamSchema } from './types';

export interface CatalogValidationError {
  field: string;
  message: string;
}

export interface SanitizeResult {
  params: Record<string, IndicatorParamValue>;
  errors: CatalogValidationError[];
}

const coerceNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const clampNumber = (value: number, spec: ParamSchema): number => {
  let next = value;
  if (typeof spec.min === 'number' && next < spec.min) next = spec.min;
  if (typeof spec.max === 'number' && next > spec.max) next = spec.max;
  if (spec.type === 'integer') next = Math.round(next);
  return next;
};

const coerceParam = (
  spec: ParamSchema,
  raw: unknown,
): { value: IndicatorParamValue; error?: string } => {
  if (spec.type === 'number' || spec.type === 'integer') {
    const n = coerceNumber(raw);
    if (n === null) return { value: spec.default, error: `${spec.key} must be a finite number` };
    return { value: clampNumber(n, spec) };
  }
  if (spec.type === 'boolean') {
    if (typeof raw === 'boolean') return { value: raw };
    if (raw === 'true') return { value: true };
    if (raw === 'false') return { value: false };
    return { value: spec.default, error: `${spec.key} must be a boolean` };
  }
  if (spec.type === 'select') {
    const allowed = spec.options?.map((o) => o.value) ?? [];
    if (allowed.length === 0) return { value: spec.default };
    const match = allowed.find((v) => v === raw);
    if (match !== undefined) return { value: match };
    return { value: spec.default, error: `${spec.key} must be one of ${allowed.join(', ')}` };
  }
  if (spec.type === 'color') {
    if (typeof raw === 'string' && raw.trim() !== '') return { value: raw };
    return { value: spec.default, error: `${spec.key} must be a color string` };
  }
  return { value: spec.default };
};

export const sanitizeIndicatorParams = (
  catalogType: string,
  raw: Record<string, unknown> | null | undefined,
): SanitizeResult => {
  const def = INDICATOR_CATALOG[catalogType];
  if (!def) {
    return {
      params: {},
      errors: [{ field: 'catalogType', message: `Unknown indicator type: ${catalogType}` }],
    };
  }
  const input = raw ?? {};
  const params: Record<string, IndicatorParamValue> = {};
  const errors: CatalogValidationError[] = [];
  const knownKeys = new Set<string>();
  for (const spec of def.params) {
    knownKeys.add(spec.key);
    if (input[spec.key] === undefined || input[spec.key] === null) {
      params[spec.key] = spec.default;
      continue;
    }
    const { value, error } = coerceParam(spec, input[spec.key]);
    params[spec.key] = value;
    if (error) errors.push({ field: spec.key, message: error });
  }
  for (const key of Object.keys(input)) {
    if (!knownKeys.has(key)) {
      errors.push({ field: key, message: `Unknown param "${key}" for ${catalogType}` });
    }
  }
  return { params, errors };
};

export const validateIndicatorParams = (
  catalogType: string,
  raw: Record<string, unknown>,
): Record<string, IndicatorParamValue> => {
  const { params, errors } = sanitizeIndicatorParams(catalogType, raw);
  if (errors.length > 0) {
    const detail = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`Invalid params for ${catalogType}: ${detail}`);
  }
  return params;
};

export const buildIndicatorParamSchema = (
  catalogType: string,
): z.ZodType<Record<string, IndicatorParamValue>> => {
  return z
    .record(z.string(), z.unknown())
    .transform((raw, ctx) => {
      const { params, errors } = sanitizeIndicatorParams(catalogType, raw);
      for (const e of errors) {
        ctx.addIssue({ code: 'custom', message: e.message, path: [e.field] });
      }
      return params;
    });
};
